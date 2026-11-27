import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepararDb } from "./ayuda-db";
import type { Db } from "@/lib/db";
import { aviso, insumo, notificacionEnviada, suscripcionPush } from "@/lib/db/schema";
import { sembrarCatalogos } from "@/lib/db/seed";
import { sembrarClinica } from "@/lib/clinica/seed";
import { enviarNotificacionesPendientes, guardarSuscripcion, usarEnviador, type MensajePush } from "@/lib/clinica/push";
import { listarTareas, marcarTareaHecha, sincronizarAvisosTareas } from "@/lib/clinica/tareas";
import { registrarCompra } from "@/lib/inventario/compras";
import { registrarConsumo } from "@/lib/inventario/consumo";
import { historialPrecios, type RegistroPrecio } from "@/lib/inventario/precios";
import { hoyLocal } from "@/lib/inventario/estado";
import { obtenerOCrearColor } from "@/lib/inventario/variantes";
import { OTROS, resumenVariacion, textoCambio } from "@/lib/reportes/precios";
import { reporteColores, reporteColoresActual } from "@/lib/reportes/colores";

const compra = (loteId: number, fechaCompra: string, precioUnitario: number, proveedor: string | null, precioPorPieza: number | null = null): RegistroPrecio => ({
  loteId,
  fechaCompra,
  proveedor,
  presentacion: null,
  varianteId: null,
  cantidad: 1,
  precioTotal: precioUnitario,
  precioUnitario,
  precioPorPieza,
});

describe("D-13 resumen de variación de precio", () => {
  it("con una compra no hay cambio; con dos calcula el cambio contra la anterior", () => {
    expect(resumenVariacion([compra(1, "2026-10-01", 100, "A")])).toMatchObject({ cambioPct: null, anterior: null });
    const r = resumenVariacion([compra(2, "2026-11-01", 125, "B"), compra(1, "2026-10-01", 100, "A")]);
    expect(r.cambioPct).toBe(25);
    expect(r.ultimo?.precio).toBe(125);
    expect(r.minimo).toMatchObject({ precio: 100, proveedor: "A" });
    expect(r.base).toBe("unidad");
    expect(textoCambio(25)).toBe("+25.0 %");
    expect(textoCambio(-3)).toBe("−3.0 %");
    expect(textoCambio(0)).toBe("sin cambio");
  });

  it("usa el precio por pieza cuando todas las compras lo tienen", () => {
    const r = resumenVariacion([compra(1, "2026-10-01", 200, "A", 2), compra(2, "2026-11-01", 150, "A", 3)]);
    expect(r.base).toBe("pieza");
    expect(r.puntos.map((p) => p.precio)).toEqual([2, 3]);
    expect(r.cambioPct).toBe(50);
  });

  it("deja máximo tres proveedores con línea propia y agrupa el resto", () => {
    const r = resumenVariacion([
      compra(1, "2026-01-01", 10, "A"),
      compra(2, "2026-02-01", 10, "A"),
      compra(3, "2026-03-01", 11, "B"),
      compra(4, "2026-04-01", 12, "C"),
      compra(5, "2026-05-01", 9, "D"),
      compra(6, "2026-06-01", 13, null),
    ]);
    expect(r.series).toHaveLength(4);
    expect(r.series[0]).toBe("A");
    expect(r.series.at(-1)).toBe(OTROS);
    expect(r.puntos.filter((p) => p.serie === OTROS)).toHaveLength(2);
  });
});

describe("D-14 reporte de colores", () => {
  it("calcula porcentajes y compra sugerida por color", () => {
    const consumos = [
      { insumoId: 1, insumo: "Ligas", varianteId: 10, nombre: "Rojo", colorHex: "#B91C1C", cantidad: 60 },
      { insumoId: 1, insumo: "Ligas", varianteId: 11, nombre: "Azul", colorHex: "#1D4ED8", cantidad: 30 },
      { insumoId: 1, insumo: "Ligas", varianteId: 12, nombre: "Verde", colorHex: "#166534", cantidad: 10 },
    ];
    const [r] = reporteColores(consumos, new Map([[10, 5], [11, 50]]), 90, 30);
    expect(r.total).toBe(100);
    expect(r.filas.map((f) => [f.nombre, f.porcentaje, f.sugerido])).toEqual([
      ["Rojo", 60, 15], // 60/90*30 = 20 - 5
      ["Azul", 30, 0], // 10 - 50 → 0
      ["Verde", 10, 4], // ceil(3.33) - 0
    ]);
  });
});

describe("D-12 a D-14 con base de datos", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  const ids: Record<string, number> = {};
  const enviados: { endpoint: string; mensaje: MensajePush }[] = [];

  beforeAll(async () => {
    ({ db, cerrar } = await prepararDb());
    await sembrarCatalogos(db);
    await sembrarClinica(db);
    for (const i of await db.select().from(insumo)) ids[i.nombre] = i.id;
  });
  afterAll(async () => {
    usarEnviador(undefined);
    await cerrar();
  });

  it("D-13: con historialPrecios() de Angel se ve la variación tras 2 compras", async () => {
    await registrarCompra({ insumoId: ids.Guantes, cantidad: 2, precioTotal: 200, fechaCompra: "2026-10-01", proveedor: "Depósito A" });
    expect(resumenVariacion(await historialPrecios(ids.Guantes)).cambioPct).toBeNull();
    await registrarCompra({ insumoId: ids.Guantes, cantidad: 1, precioTotal: 110, fechaCompra: "2026-11-01", proveedor: "Depósito B" });
    const r = resumenVariacion(await historialPrecios(ids.Guantes));
    expect(r.cambioPct).toBe(10);
    expect(r.series).toEqual(["Depósito B", "Depósito A"]);
  });

  it("D-14: el reporte coincide con los movimientos de consumo", async () => {
    const rojo = await obtenerOCrearColor(ids.Ligas, { nombre: "Rojo", colorHex: "#B91C1C" });
    const azul = await obtenerOCrearColor(ids.Ligas, { nombre: "Azul", colorHex: "#1D4ED8" });
    await registrarCompra({ insumoId: ids.Ligas, cantidad: 50, varianteId: rojo });
    await registrarCompra({ insumoId: ids.Ligas, cantidad: 50, varianteId: azul });
    await registrarConsumo({ insumoId: ids.Ligas, cantidad: 6, varianteId: rojo });
    await registrarConsumo({ insumoId: ids.Ligas, cantidad: 3, varianteId: rojo });
    await registrarConsumo({ insumoId: ids.Ligas, cantidad: 1, varianteId: azul });
    const [r] = await reporteColoresActual(30, hoyLocal());
    expect(r.insumo).toBe("Ligas");
    expect(r.total).toBe(10);
    expect(r.filas.map((f) => [f.nombre, f.cantidad, f.porcentaje, f.existencia])).toEqual([
      ["Rojo", 9, 90, 41],
      ["Azul", 1, 10, 49],
    ]);
  });

  it("D-12: una tarea vencida genera una notificación una sola vez y se borran suscripciones vencidas", async () => {
    usarEnviador(async (destino, mensaje) => {
      if (destino.endpoint.includes("vencida")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      enviados.push({ endpoint: destino.endpoint, mensaje });
    });
    await guardarSuscripcion({ endpoint: "https://push.test/celular", keys: { p256dh: "clave-publica-de-prueba", auth: "auth-prueba" } }, null);
    await guardarSuscripcion({ endpoint: "https://push.test/vencida", keys: { p256dh: "clave-publica-de-prueba", auth: "auth-prueba" } }, null);

    const residuos = (await listarTareas()).find((t) => t.tipo === "residuos")!;
    await marcarTareaHecha(residuos.id, { fecha: "2026-01-01" }, "2026-11-27");
    await sincronizarAvisosTareas("2026-11-27");

    const r = await enviarNotificacionesPendientes();
    expect(r).toMatchObject({ configurado: true, suscripcionesBorradas: 1 });
    const deResiduos = enviados.filter((e) => e.mensaje.url === `/tareas/${residuos.id}`);
    expect(deResiduos).toHaveLength(1);
    expect(deResiduos[0].mensaje.title).toContain("Recolección de residuos");
    expect(await db.select().from(suscripcionPush)).toHaveLength(1);

    const antes = enviados.length;
    await enviarNotificacionesPendientes();
    expect(enviados.length).toBe(antes);
    expect((await db.select().from(notificacionEnviada)).length).toBeGreaterThan(0);
  });

  it("D-12: no notifica avisos de prioridad media", async () => {
    await db.insert(aviso).values({ tipo: "x", titulo: "Media", prioridad: "media", origen: "inventario" });
    const antes = enviados.length;
    await enviarNotificacionesPendientes();
    expect(enviados.slice(antes).some((e) => e.mensaje.title === "Media")).toBe(false);
  });

  it("D-12: sin llaves VAPID no intenta enviar", async () => {
    usarEnviador(undefined);
    delete process.env.VAPID_PRIVATE_KEY;
    expect((await enviarNotificacionesPendientes()).configurado).toBe(false);
  });

  it("D-12: rechaza suscripciones que no son https", async () => {
    await expect(guardarSuscripcion({ endpoint: "http://inseguro.test", keys: { p256dh: "clave-publica-de-prueba", auth: "auth" } }, null)).rejects.toThrow();
  });
});
