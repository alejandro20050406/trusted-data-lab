import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { prepararDb } from "./ayuda-db";
import type { Db } from "@/lib/db";
import { insumo, movimiento, variante } from "@/lib/db/schema";
import { sembrarCatalogos } from "@/lib/db/seed";
import { CompraInvalida, registrarCompra, ultimaCompra } from "@/lib/inventario/compras";
import { ConsumoInvalido, deshacerConsumo, registrarConsumo } from "@/lib/inventario/consumo";
import { ExistenciaInsuficiente } from "@/lib/inventario/estado";
import { existenciaInsumo, lotesConExistencia } from "@/lib/inventario/existencia";

let db: Db;
let cerrar: () => Promise<void>;
const id: Record<string, number> = {};

beforeAll(async () => {
  ({ db, cerrar } = await prepararDb());
  await sembrarCatalogos(db);
  for (const i of await db.select().from(insumo)) id[i.nombre] = i.id;
});
afterAll(async () => cerrar());

describe("A-07 registrarCompra", () => {
  it("crea el lote y la entrada con la fecha de hoy por omisión", async () => {
    const { loteId } = await registrarCompra({ insumoId: id.Guantes, cantidad: 2, precioTotal: 180, proveedor: "Depósito A" });
    const [lote] = await lotesConExistencia({ insumoId: id.Guantes });
    expect(lote).toMatchObject({ id: loteId, restante: 2, precioTotal: 180, proveedor: "Depósito A" });
    expect(lote.fechaCompra).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await ultimaCompra(id.Guantes)).toMatchObject({ proveedor: "Depósito A" });
  });

  it("acepta datos de formulario como texto", async () => {
    await registrarCompra({ insumoId: String(id.Jeringas), cantidad: "3", precioTotal: "45.5", fechaCompra: "2026-11-20" });
    expect(await existenciaInsumo(id.Jeringas)).toBe(3);
  });

  it("rechaza cantidad cero, caducidad anterior a la compra y ligas sin color", async () => {
    await expect(registrarCompra({ insumoId: id.Guantes, cantidad: 0 })).rejects.toThrow(CompraInvalida);
    await expect(
      registrarCompra({ insumoId: id.Resina, cantidad: 1, fechaCompra: "2026-11-20", fechaCaducidad: "2026-11-01" }),
    ).rejects.toThrow("La caducidad no puede ser anterior a la compra.");
    await expect(registrarCompra({ insumoId: id.Ligas, cantidad: 1 })).rejects.toThrow("Elige el color.");
  });
});

describe("A-08 registrarConsumo (contrato con Adrián)", () => {
  it("descuenta en orden FEFO y devuelve la existencia restante", async () => {
    await registrarCompra({ insumoId: id.Anestesia, cantidad: 2, fechaCompra: "2026-11-01", fechaCaducidad: "2030-06-01" });
    await registrarCompra({ insumoId: id.Anestesia, cantidad: 2, fechaCompra: "2026-11-02", fechaCaducidad: "2030-01-01" });
    const r = await registrarConsumo({ insumoId: id.Anestesia, cantidad: 3 });
    expect(r.existenciaRestante).toBe(1);
    const lotes = await lotesConExistencia({ insumoId: id.Anestesia });
    const porCaducidad = Object.fromEntries(lotes.map((l) => [l.fechaCaducidad, l.restante]));
    expect(porCaducidad).toEqual({ "2030-01-01": 0, "2030-06-01": 1 });
    const movs = await db.select().from(movimiento).where(eq(movimiento.grupoId, r.grupoId));
    expect(movs.map((m) => m.cantidad).sort()).toEqual([-1, -2]);
  });

  it("guarda el color de la liga en cada movimiento de consumo", async () => {
    const [azul] = await db.insert(variante).values({ insumoId: id.Ligas, tipo: "color", nombre: "Azul", colorHex: "#1D4ED8" }).returning();
    await registrarCompra({ insumoId: id.Ligas, cantidad: 5, varianteId: azul.id });
    const r = await registrarConsumo({ insumoId: id.Ligas, cantidad: 1, varianteId: azul.id });
    expect(r.existenciaRestante).toBe(4);
    const [m] = await db.select().from(movimiento).where(eq(movimiento.grupoId, r.grupoId));
    expect(m).toMatchObject({ tipo: "consumo", varianteId: azul.id, cantidad: -1 });
  });

  it("descuenta un bracket del diente indicado (uso de Adrián)", async () => {
    const [b11] = await db
      .insert(variante)
      .values({ insumoId: id.Brackets, tipo: "diente", nombre: "11 metálico 0.022", dienteFdi: 11, sistema: "metalico", slot: "0.022" })
      .returning();
    const [b21] = await db
      .insert(variante)
      .values({ insumoId: id.Brackets, tipo: "diente", nombre: "21 metálico 0.022", dienteFdi: 21, sistema: "metalico", slot: "0.022" })
      .returning();
    await registrarCompra({ insumoId: id.Brackets, cantidad: 2, varianteId: b11.id });
    await registrarCompra({ insumoId: id.Brackets, cantidad: 3, varianteId: b21.id });
    const r = await registrarConsumo({ insumoId: id.Brackets, cantidad: 1, varianteId: b11.id });
    expect(r.existenciaRestante).toBe(1);
    expect(await existenciaInsumo(id.Brackets, b21.id)).toBe(3);
  });

  it("rechaza consumos sin variante, de variante ajena o mayores que la existencia", async () => {
    await expect(registrarConsumo({ insumoId: id.Ligas, cantidad: 1 })).rejects.toThrow(ConsumoInvalido);
    const [otra] = await db.select().from(variante).where(eq(variante.insumoId, id.Brackets));
    await expect(registrarConsumo({ insumoId: id.Ligas, cantidad: 1, varianteId: otra.id })).rejects.toThrow(ConsumoInvalido);
    await expect(registrarConsumo({ insumoId: id.Guantes, cantidad: 99 })).rejects.toThrow(ExistenciaInsuficiente);
    await expect(registrarConsumo({ insumoId: id.Guantes, cantidad: 0 })).rejects.toThrow(ConsumoInvalido);
  });

  it("deshacer devuelve la existencia y solo funciona dentro de la ventana", async () => {
    const antes = await existenciaInsumo(id.Guantes);
    const r = await registrarConsumo({ insumoId: id.Guantes, cantidad: 1 });
    expect(await existenciaInsumo(id.Guantes)).toBe(antes - 1);
    expect(await deshacerConsumo(r.grupoId)).toBe(true);
    expect(await existenciaInsumo(id.Guantes)).toBe(antes);
    expect(await deshacerConsumo(r.grupoId)).toBe(false);

    const tarde = await registrarConsumo({ insumoId: id.Guantes, cantidad: 1 });
    expect(await deshacerConsumo(tarde.grupoId, new Date(Date.now() + 120_000))).toBe(false);
  });
});
