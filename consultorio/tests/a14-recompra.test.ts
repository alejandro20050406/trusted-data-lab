import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { prepararDb } from "./ayuda-db";
import type { Db } from "@/lib/db";
import { insumo } from "@/lib/db/schema";
import { sembrarCatalogos } from "@/lib/db/seed";
import { avisosPendientes } from "@/lib/avisos";
import { registrarCompra } from "@/lib/inventario/compras";
import { actualizarAvisosInventario } from "@/lib/inventario/generar-avisos";
import { ADVERTENCIA_PRECIO, textoRecompra } from "@/lib/inventario/recompra";
import type { RegistroPrecio } from "@/lib/inventario/precios";
import { importarPrecios, leerOroInventario } from "@/lib/observatorio/importar";
import { vincularProducto } from "@/lib/observatorio/correspondencias";

const compra: RegistroPrecio = {
  loteId: 1,
  fechaCompra: "2026-10-01",
  proveedor: "Depósito A",
  presentacion: "Caja de 100",
  varianteId: null,
  cantidad: 2,
  precioTotal: 300,
  precioUnitario: 150,
  precioPorPieza: 1.5,
};
const referencia = {
  producto: "Ligas de prueba",
  tienda: "Tienda A",
  precio: 85.5,
  presentacion: null,
  url: "https://tienda-a.test/ligas",
  fechaCaptura: new Date("2026-11-13T02:24:54Z"),
};

describe("A-14 texto de recompra", () => {
  it("sin datos no muestra precio (el aviso queda solo con la cantidad)", () => {
    expect(textoRecompra("caja", null, null)).toBeNull();
  });

  it("historial personal: precio con proveedor, fecha y advertencia", () => {
    const t = textoRecompra("caja", compra, null)!;
    expect(t).toContain("Tu compra más barata:");
    expect(t).toContain("por caja");
    expect(t).toContain("con Depósito A");
    expect(t).toContain("1 oct 2026");
    expect(t).toContain(ADVERTENCIA_PRECIO);
  });

  it("observatorio: tienda y fecha de captura; va después del historial", () => {
    const t = textoRecompra(null, compra, referencia)!;
    const [primera, segunda] = t.split("\n");
    expect(primera).toContain("Tu compra más barata");
    expect(segunda).toContain("Tienda A");
    expect(segunda).toContain("capturado el 12 nov 2026"); // 02:24 UTC = 12 nov en Ciudad de México
    expect(t).toContain(ADVERTENCIA_PRECIO);
  });

  it("todo precio mostrado lleva fuente y fecha", () => {
    for (const t of [textoRecompra("caja", compra, null), textoRecompra(null, null, referencia), textoRecompra("caja", compra, referencia)]) {
      for (const linea of t!.split("\n").filter((l) => l.includes("$"))) {
        expect(linea).toMatch(/ (con|en) /);
        expect(linea).toMatch(/\d{1,2} [a-z]{3} \d{4}/);
      }
    }
  });
});

describe("A-14 aviso de recompra generado", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  const id: Record<string, number> = {};
  beforeAll(async () => {
    ({ db, cerrar } = await prepararDb());
    await sembrarCatalogos(db);
    for (const i of await db.select().from(insumo)) id[i.nombre] = i.id;
  });
  afterAll(async () => cerrar());

  const avisoDe = async (insumoId: number) => (await avisosPendientes()).find((a) => a.clave === `inventario:reserva:${insumoId}`);

  it("sin precios conocidos solo dice la cantidad restante", async () => {
    await registrarCompra({ insumoId: id.Guantes, cantidad: 1 });
    await actualizarAvisosInventario();
    expect((await avisoDe(id.Guantes))?.detalle).toBe("Te queda 1 caja de guantes; la reserva es 1 caja.");
  });

  it("con historial y observatorio vinculado incluye ambas opciones con fuente y fecha", async () => {
    await db.update(insumo).set({ minimoReserva: 2 }).where(eq(insumo.id, id.Ligas));
    const { obtenerOCrearColor } = await import("@/lib/inventario/variantes");
    const azul = await obtenerOCrearColor(id.Ligas, { nombre: "Azul", colorHex: "#1D4ED8" });
    await registrarCompra({ insumoId: id.Ligas, cantidad: 1, varianteId: azul, precioTotal: 95, proveedor: "Depósito B", fechaCompra: "2026-09-15" });
    const csv = readFileSync(new URL("./fixtures/oro_inventario_prueba.csv", import.meta.url), "utf8");
    await importarPrecios(leerOroInventario(csv).precios);
    await vincularProducto({ insumoId: id.Ligas, url: "https://tienda-a.test/ligas-azules" });

    await actualizarAvisosInventario();
    const detalle = (await avisoDe(id.Ligas))!.detalle!;
    expect(detalle.split("\n")[0]).toBe("Te queda 1 de ligas (unidad sin definir); la reserva es 2.");
    expect(detalle).toContain("Tu compra más barata:");
    expect(detalle).toContain("con Depósito B, el 15 sep 2026");
    expect(detalle).toContain("en Tienda A, capturado el 12 nov 2026");
    expect(detalle).toContain(ADVERTENCIA_PRECIO);
  });
});
