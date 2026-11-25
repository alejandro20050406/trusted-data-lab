import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { prepararDb } from "./ayuda-db";
import type { Db } from "@/lib/db";
import { aviso, insumo } from "@/lib/db/schema";
import { sembrarCatalogos } from "@/lib/db/seed";
import { avisosPendientes, marcarAvisoAtendido } from "@/lib/avisos";
import { registrarCompra } from "@/lib/inventario/compras";
import { registrarConsumo } from "@/lib/inventario/consumo";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { planAvisosInventario, sincronizarAvisosInventario } from "@/lib/inventario/avisos-inventario";
import { actualizarAvisosInventario } from "@/lib/inventario/generar-avisos";
import { autorizarCron } from "@/lib/cron";

const HOY = "2026-11-25";
let db: Db;
let cerrar: () => Promise<void>;
const id: Record<string, number> = {};

beforeAll(async () => {
  ({ db, cerrar } = await prepararDb());
  await sembrarCatalogos(db);
  for (const i of await db.select().from(insumo)) id[i.nombre] = i.id;
});
afterAll(async () => cerrar());

const sincronizar = async () => sincronizarAvisosInventario(await inventarioConEstado(HOY));
const abiertosDe = async (prefijo: string) => (await avisosPendientes()).filter((a) => a.clave?.startsWith(prefijo));

describe("A-10 plan de avisos", () => {
  it("redacta la reserva baja con cantidad y unidad", async () => {
    await registrarCompra({ insumoId: id.Guantes, cantidad: 1, fechaCompra: "2026-11-01" });
    const plan = planAvisosInventario(await inventarioConEstado(HOY));
    const guantes = plan.find((a) => a.clave === `inventario:reserva:${id.Guantes}`);
    expect(guantes).toMatchObject({ tipo: "reserva_baja", prioridad: "alta", urlAccion: `/inventario/compra?insumo=${id.Guantes}` });
    expect(guantes?.detalle).toBe("Te queda 1 caja de guantes; la reserva es 1 caja.");
  });

  it("no avisa de insumos sin reserva definida que nunca se han comprado", async () => {
    const plan = planAvisosInventario(await inventarioConEstado(HOY));
    expect(plan.find((a) => a.clave === `inventario:reserva:${id.Jeringas}`)).toBeUndefined();
  });

  it("avisa caducidad próxima y lotes caducados", async () => {
    await registrarCompra({ insumoId: id.Anestesia, cantidad: 2, fechaCompra: "2026-11-01", fechaCaducidad: "2026-12-05" });
    await registrarCompra({ insumoId: id.Resina, cantidad: 1, fechaCompra: "2026-01-01", fechaCaducidad: "2026-11-20" });
    const plan = planAvisosInventario(await inventarioConEstado(HOY));
    const porCaducar = plan.find((a) => a.tipo === "por_caducar");
    expect(porCaducar).toMatchObject({ titulo: "Por caducar: Anestesia", fechaVencimiento: "2026-12-05", prioridad: "media" });
    expect(porCaducar?.detalle).toContain("en 10 días");
    expect(plan.find((a) => a.tipo === "caducado")).toMatchObject({ titulo: "Caducado: Resina", prioridad: "alta" });
  });

  it("avisa ligas vencidas por antigüedad solo cuando la vida útil está definida", async () => {
    const { obtenerOCrearColor } = await import("@/lib/inventario/variantes");
    const varianteId = await obtenerOCrearColor(id.Ligas, { nombre: "Rojo", colorHex: "#B91C1C" });
    await registrarCompra({ insumoId: id.Ligas, cantidad: 3, varianteId, fechaCompra: "2026-01-10" });
    expect(planAvisosInventario(await inventarioConEstado(HOY)).some((a) => a.tipo === "vencido_antiguedad")).toBe(false);
    await db.update(insumo).set({ vidaUtilDias: 180 }).where(eq(insumo.id, id.Ligas));
    const vencido = planAvisosInventario(await inventarioConEstado(HOY)).find((a) => a.tipo === "vencido_antiguedad");
    expect(vencido?.titulo).toBe("Ya no son válidas: Ligas");
    await db.update(insumo).set({ vidaUtilDias: null }).where(eq(insumo.id, id.Ligas));
  });
});

describe("A-10 sincronización", () => {
  it("no repite avisos al sincronizar varias veces", async () => {
    await sincronizar();
    const antes = (await avisosPendientes()).length;
    await sincronizar();
    await sincronizar();
    expect((await avisosPendientes()).length).toBe(antes);
    expect(await abiertosDe(`inventario:reserva:${id.Guantes}`)).toHaveLength(1);
  });

  it("actualiza el aviso abierto cuando cambia la cantidad (agotado)", async () => {
    await registrarConsumo({ insumoId: id.Guantes, cantidad: 1 });
    await sincronizar();
    const [a] = await abiertosDe(`inventario:reserva:${id.Guantes}`);
    expect(a).toMatchObject({ tipo: "agotado", titulo: "Se acabó: Guantes" });
  });

  it("cierra el aviso solo al reponer el insumo", async () => {
    await registrarCompra({ insumoId: id.Guantes, cantidad: 5 });
    const r = await sincronizar();
    expect(r.cerrados).toBeGreaterThanOrEqual(1);
    expect(await abiertosDe(`inventario:reserva:${id.Guantes}`)).toHaveLength(0);
  });

  it("si la dentista lo marca como hecho no se reabre, pero vuelve a avisar en la siguiente baja", async () => {
    await registrarConsumo({ insumoId: id.Guantes, cantidad: 4 }); // queda 1 = reserva
    await sincronizar();
    const [a] = await abiertosDe(`inventario:reserva:${id.Guantes}`);
    await marcarAvisoAtendido(a.id);
    await sincronizar();
    expect(await abiertosDe(`inventario:reserva:${id.Guantes}`)).toHaveLength(0);

    await registrarCompra({ insumoId: id.Guantes, cantidad: 3 }); // se repone: libera la clave
    await sincronizar();
    await registrarConsumo({ insumoId: id.Guantes, cantidad: 3 }); // otra vez en reserva
    await sincronizar();
    expect(await abiertosDe(`inventario:reserva:${id.Guantes}`)).toHaveLength(1);
  });

  it("no toca los avisos de Adrián (otros orígenes)", async () => {
    await db.insert(aviso).values({ tipo: "t", titulo: "Esterilizar", prioridad: "alta", origen: "esterilizacion", clave: "esterilizacion:1" });
    await sincronizar();
    expect((await avisosPendientes()).some((a) => a.clave === "esterilizacion:1")).toBe(true);
  });

  it("actualizarAvisosInventario usa la fecha de hoy y devuelve el resumen", async () => {
    const r = await actualizarAvisosInventario();
    expect(r).toHaveProperty("abiertos");
    expect(r).toHaveProperty("cerrados");
  });
});

describe("A-10 secreto del cron", () => {
  const conAuth = (valor?: string) => new Request("http://x/api/cron/inventario", { headers: valor ? { authorization: valor } : {} });

  it("rechaza llamadas sin el secreto o con uno incorrecto", () => {
    expect(autorizarCron(conAuth(), "secreto")).toBe(false);
    expect(autorizarCron(conAuth("Bearer otro"), "secreto")).toBe(false);
    expect(autorizarCron(conAuth("secreto"), "secreto")).toBe(false);
  });

  it("rechaza todo si CRON_SECRET no está configurado", () => {
    expect(autorizarCron(conAuth("Bearer "), undefined)).toBe(false);
    expect(autorizarCron(conAuth("Bearer "), "")).toBe(false);
  });

  it("acepta el encabezado Authorization: Bearer <CRON_SECRET>", () => {
    expect(autorizarCron(conAuth("Bearer secreto"), "secreto")).toBe(true);
  });

  it("la ruta responde 401 sin secreto y 200 con él", async () => {
    process.env.CRON_SECRET = "secreto-de-prueba";
    const { GET } = await import("@/app/api/cron/inventario/route");
    expect((await GET(conAuth())).status).toBe(401);
    const ok = await GET(conAuth("Bearer secreto-de-prueba"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true });
  });
});
