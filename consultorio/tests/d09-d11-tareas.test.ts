import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { prepararDb } from "./ayuda-db";
import type { Db } from "@/lib/db";
import { aviso, realizacionTarea, tareaPeriodica } from "@/lib/db/schema";
import { sembrarClinica } from "@/lib/clinica/seed";
import { avisosPendientes } from "@/lib/avisos";
import {
  calcularTarea,
  claveAvisoTarea,
  configurarTarea,
  deshacerRealizacion,
  historialTarea,
  listarTareas,
  marcarTareaHecha,
  planAvisoTarea,
  sincronizarAvisosTareas,
  tareaDeAviso,
  type Tarea,
} from "@/lib/clinica/tareas";
import { autorizarCron } from "@/lib/cron";

const HOY = "2026-11-27";
const base = { cadaDias: 60, diasAnticipacion: 7 };

describe("D-09 cálculo con fechas fijas", () => {
  it("al día, próxima, hoy, vencida y sin registro", () => {
    expect(calcularTarea({ ...base, ultimaRealizacion: "2026-11-01" }, HOY)).toEqual({ estado: "al_dia", proximaFecha: "2026-12-31", diasRestantes: 34 });
    expect(calcularTarea({ ...base, ultimaRealizacion: "2026-10-01" }, HOY)).toMatchObject({ estado: "proxima", proximaFecha: "2026-11-30", diasRestantes: 3 });
    expect(calcularTarea({ ...base, ultimaRealizacion: "2026-09-28" }, HOY)).toMatchObject({ estado: "hoy", diasRestantes: 0 });
    expect(calcularTarea({ ...base, ultimaRealizacion: "2026-09-20" }, HOY)).toMatchObject({ estado: "vencida", diasRestantes: -8 });
    expect(calcularTarea({ ...base, ultimaRealizacion: null }, HOY).estado).toBe("sin_registro");
    expect(calcularTarea({ cadaDias: null, diasAnticipacion: 0, ultimaRealizacion: "2026-11-01" }, HOY).estado).toBe("sin_definir");
  });

  it("el límite de anticipación es inclusivo", () => {
    expect(calcularTarea({ ...base, ultimaRealizacion: "2026-10-05" }, HOY).estado).toBe("proxima");
    expect(calcularTarea({ ...base, ultimaRealizacion: "2026-10-06" }, HOY).estado).toBe("al_dia");
  });

  it("plan de aviso: alta si vence hoy o ya venció; nada si está al día", () => {
    const t: Tarea = { id: 4, nombre: "Recolección", tipo: "residuos", activo: true, ...base, ultimaRealizacion: "2026-09-20" };
    expect(planAvisoTarea(t, HOY)).toMatchObject({ prioridad: "alta", origen: "residuos", clave: "residuos:tarea:4", urlAccion: "/tareas/4", tipo: "tarea_vencida" });
    expect(planAvisoTarea({ ...t, ultimaRealizacion: "2026-10-01" }, HOY)).toMatchObject({ prioridad: "media", fechaVencimiento: "2026-11-30" });
    expect(planAvisoTarea({ ...t, ultimaRealizacion: "2026-11-20" }, HOY)).toBeNull();
    expect(planAvisoTarea({ ...t, activo: false }, HOY)).toBeNull();
  });

  it("reconoce los avisos de tareas", () => {
    expect(tareaDeAviso({ origen: "esterilizacion", clave: "esterilizacion:tarea:7" })).toBe(7);
    expect(tareaDeAviso({ origen: "inventario", clave: "inventario:reserva:7" })).toBeNull();
  });
});

describe("D-09 a D-11 con base de datos", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let residuos: Tarea;
  let esterilizacion: Tarea;

  beforeAll(async () => {
    ({ db, cerrar } = await prepararDb());
    await sembrarClinica(db);
    await sembrarClinica(db);
    const tareas = await listarTareas();
    expect(tareas).toHaveLength(2);
    residuos = tareas.find((t) => t.tipo === "residuos")!;
    esterilizacion = tareas.find((t) => t.tipo === "esterilizacion")!;
  });
  afterAll(async () => cerrar());

  const abiertos = async (t: Tarea) => (await avisosPendientes()).filter((a) => a.clave === claveAvisoTarea(t));

  it("residuos precargada con 60 días y 7 de anticipación; esterilización sin definir", () => {
    expect(residuos).toMatchObject({ cadaDias: 60, diasAnticipacion: 7, ultimaRealizacion: null });
    expect(esterilizacion.cadaDias).toBeNull();
  });

  it("sin registro avisa una sola vez aunque se sincronice varias veces", async () => {
    await sincronizarAvisosTareas(HOY);
    await sincronizarAvisosTareas(HOY);
    await sincronizarAvisosTareas(HOY);
    expect(await abiertos(residuos)).toHaveLength(1);
    expect(await abiertos(esterilizacion)).toHaveLength(0);
  });

  it("al marcar la recolección se guarda la fecha real y el comprobante, se cierra el aviso y la próxima queda 60 días después", async () => {
    const r = await marcarTareaHecha(residuos.id, { fecha: "2026-11-25", comprobante: "MAN-123" }, HOY);
    expect(r.calculo).toMatchObject({ estado: "al_dia", proximaFecha: "2027-01-24" });
    expect(await abiertos(residuos)).toHaveLength(0);
    const [h] = await historialTarea(residuos.id);
    expect(h).toMatchObject({ fecha: "2026-11-25", comprobante: "MAN-123" });
    await sincronizarAvisosTareas(HOY);
    expect(await abiertos(residuos)).toHaveLength(0);
  });

  it("vuelve a avisar cuando se acerca la fecha y sube a alta al vencer, sin duplicar", async () => {
    await sincronizarAvisosTareas("2027-01-18");
    const [proxima] = await abiertos(residuos);
    expect(proxima.prioridad).toBe("media");
    await sincronizarAvisosTareas("2027-01-26");
    const vencida = await abiertos(residuos);
    expect(vencida).toHaveLength(1);
    expect(vencida[0]).toMatchObject({ id: proxima.id, prioridad: "alta" });
  });

  it("una fecha anterior no hace retroceder la última realización; no acepta fechas futuras", async () => {
    await marcarTareaHecha(residuos.id, { fecha: "2026-10-01" }, HOY);
    const [t] = await db.select().from(tareaPeriodica).where(eq(tareaPeriodica.id, residuos.id));
    expect(t.ultimaRealizacion).toBe("2026-11-25");
    await expect(marcarTareaHecha(residuos.id, { fecha: "2026-12-01" }, HOY)).rejects.toThrow("futura");
  });

  it("esterilización: configurar, marcar hoy y ver historial con próxima fecha", async () => {
    await expect(configurarTarea(esterilizacion.id, { cadaDias: 7, diasAnticipacion: 7 })).rejects.toThrow("menor");
    await configurarTarea(esterilizacion.id, { cadaDias: 7, diasAnticipacion: 1 });
    const r = await marcarTareaHecha(esterilizacion.id, { detalle: "3 paquetes" }, HOY);
    expect(r.calculo.proximaFecha).toBe("2026-12-04");
    expect((await historialTarea(esterilizacion.id))[0]).toMatchObject({ fecha: HOY, detalle: "3 paquetes" });
  });

  it("deshacer quita la realización dentro de la ventana", async () => {
    const { realizacionId } = await marcarTareaHecha(esterilizacion.id, {}, HOY);
    expect(await deshacerRealizacion(realizacionId)).toBe(true);
    expect(await db.select().from(realizacionTarea).where(eq(realizacionTarea.id, realizacionId))).toHaveLength(0);
    const viejo = await marcarTareaHecha(esterilizacion.id, {}, HOY);
    expect(await deshacerRealizacion(viejo.realizacionId, new Date(Date.now() + 120_000))).toBe(false);
  });

  it("no toca los avisos de inventario", async () => {
    await db.insert(aviso).values({ tipo: "reserva_baja", titulo: "Guantes", prioridad: "alta", origen: "inventario", clave: "inventario:reserva:1" });
    await sincronizarAvisosTareas(HOY);
    expect((await avisosPendientes()).some((a) => a.clave === "inventario:reserva:1")).toBe(true);
  });
});

describe("D-09 ruta diaria", () => {
  it("rechaza llamadas sin el secreto", async () => {
    process.env.CRON_SECRET = "secreto-cron-pruebas";
    const { GET } = await import("@/app/api/cron/tareas/route");
    expect((await GET(new Request("http://x/api/cron/tareas"))).status).toBe(401);
    expect((await GET(new Request("http://x/api/cron/tareas", { headers: { authorization: "Bearer otro" } }))).status).toBe(401);
    expect(autorizarCron(new Request("http://x", { headers: { authorization: "Bearer secreto-cron-pruebas" } }))).toBe(true);
  });
});
