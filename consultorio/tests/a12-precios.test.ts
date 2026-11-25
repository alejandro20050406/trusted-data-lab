import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { prepararDb } from "./ayuda-db";
import { insumo } from "@/lib/db/schema";
import { sembrarCatalogos } from "@/lib/db/seed";
import { registrarCompra } from "@/lib/inventario/compras";
import { calcularPrecioUnitario, compraMasBarata, historialPrecios } from "@/lib/inventario/precios";

describe("A-12 precio por unidad", () => {
  it("compara una caja de 100 guantes con una de 50", () => {
    const caja100 = calcularPrecioUnitario({ precioTotal: 150, cantidad: 1, contenidoPorUnidad: 100 });
    const caja50 = calcularPrecioUnitario({ precioTotal: 90, cantidad: 1, contenidoPorUnidad: 50 });
    expect(caja100).toEqual({ precioUnitario: 150, precioPorPieza: 1.5 });
    expect(caja50).toEqual({ precioUnitario: 90, precioPorPieza: 1.8 });
    expect(caja100.precioPorPieza!).toBeLessThan(caja50.precioPorPieza!);
  });

  it("divide el total entre las unidades compradas", () => {
    expect(calcularPrecioUnitario({ precioTotal: 300, cantidad: 4 })).toEqual({ precioUnitario: 75, precioPorPieza: null });
    expect(calcularPrecioUnitario({ precioTotal: 100, cantidad: 3 }).precioUnitario).toBe(33.33);
    expect(calcularPrecioUnitario({ precioTotal: 0, cantidad: 2 }).precioUnitario).toBe(0);
  });

  it("rechaza cantidad cero y precios inválidos", () => {
    expect(() => calcularPrecioUnitario({ precioTotal: 10, cantidad: 0 })).toThrow();
    expect(() => calcularPrecioUnitario({ precioTotal: -1, cantidad: 1 })).toThrow();
    expect(() => calcularPrecioUnitario({ precioTotal: Number.NaN, cantidad: 1 })).toThrow();
  });
});

describe("A-12 historialPrecios (contrato con Adrián)", () => {
  let cerrar: () => Promise<void>;
  let guantes: number;
  beforeAll(async () => {
    const p = await prepararDb();
    cerrar = p.cerrar;
    await sembrarCatalogos(p.db);
    [{ id: guantes }] = await p.db.select({ id: insumo.id }).from(insumo).where(eq(insumo.nombre, "Guantes"));
  });
  afterAll(async () => cerrar());

  it("devuelve las compras con precio en orden de fecha, con precio por unidad y por pieza", async () => {
    await registrarCompra({ insumoId: guantes, cantidad: 2, precioTotal: 180, fechaCompra: "2026-11-10", proveedor: "B", presentacion: "Caja de 50", contenidoPorUnidad: 50 });
    await registrarCompra({ insumoId: guantes, cantidad: 1, precioTotal: 150, fechaCompra: "2026-10-01", proveedor: "A", presentacion: "Caja de 100", contenidoPorUnidad: 100 });
    await registrarCompra({ insumoId: guantes, cantidad: 1, fechaCompra: "2026-11-20" }); // sin precio: no entra
    const h = await historialPrecios(guantes);
    expect(h.map((r) => [r.fechaCompra, r.proveedor, r.precioUnitario, r.precioPorPieza])).toEqual([
      ["2026-10-01", "A", 150, 1.5],
      ["2026-11-10", "B", 90, 1.8],
    ]);
    expect(compraMasBarata(h)?.proveedor).toBe("A");
  });

  it("un insumo sin compras devuelve una lista vacía", async () => {
    expect(await historialPrecios(999_999)).toEqual([]);
    expect(compraMasBarata([])).toBeNull();
  });
});
