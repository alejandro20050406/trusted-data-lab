import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { prepararDb } from "./ayuda-db";
import type { Db } from "@/lib/db";
import { aviso, categoria, diente, insumo, lote, movimiento } from "@/lib/db/schema";
import { sembrarCatalogos } from "@/lib/db/seed";
import { existenciaInsumo, lotesConExistencia, sumarExistencia } from "@/lib/inventario/existencia";

let db: Db;
let cerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db, cerrar } = await prepararDb());
  await sembrarCatalogos(db);
  await sembrarCatalogos(db); // idempotente
});
afterAll(async () => cerrar());

async function idInsumo(nombre: string) {
  const [fila] = await db.select({ id: insumo.id }).from(insumo).where(eq(insumo.nombre, nombre));
  return fila.id;
}

describe("A-04 seed", () => {
  it("carga 32 dientes FDI del 11 al 48 con nombre, cuadrante y arcada", async () => {
    const dientes = await db.select().from(diente);
    expect(dientes).toHaveLength(32);
    const fdi = dientes.map((d) => d.fdi).sort((a, b) => a - b);
    expect(fdi[0]).toBe(11);
    expect(fdi.at(-1)).toBe(48);
    expect(dientes.find((d) => d.fdi === 11)).toMatchObject({
      nombre: "Incisivo central superior derecho",
      cuadrante: 1,
      arcada: "superior",
    });
    expect(dientes.find((d) => d.fdi === 36)).toMatchObject({
      nombre: "Primer molar inferior izquierdo",
      cuadrante: 3,
      arcada: "inferior",
    });
    expect(dientes.find((d) => d.fdi === 48)).toMatchObject({ nombre: "Tercer molar inferior derecho", cuadrante: 4 });
  });

  it("carga las 9 categorías iniciales", async () => {
    const nombres = (await db.select().from(categoria)).map((c) => c.nombre);
    expect(nombres).toEqual(
      expect.arrayContaining([
        "Guantes",
        "Resinas",
        "Pasantes para resina",
        "Anestesia",
        "Jeringas",
        "Fresas para limpieza",
        "Brackets",
        "Ligas",
        "Ligas intermaxilares",
      ]),
    );
    expect(nombres).toHaveLength(9);
  });

  it("deja sin definir la vida útil de las ligas y la unidad de los pasantes", async () => {
    const [ligas] = await db.select().from(insumo).where(eq(insumo.nombre, "Ligas"));
    const [pasantes] = await db.select().from(insumo).where(eq(insumo.nombre, "Pasantes para resina"));
    const [guantes] = await db.select().from(insumo).where(eq(insumo.nombre, "Guantes"));
    expect(ligas.vidaUtilDias).toBeNull();
    expect(pasantes.unidad).toBeNull();
    expect(guantes).toMatchObject({ unidad: "caja", minimoReserva: 1 });
  });
});

describe("A-04 existencia calculada desde los movimientos", () => {
  it("suma entradas, consumos y ajustes", () => {
    expect(sumarExistencia([])).toBe(0);
    expect(sumarExistencia([{ cantidad: 5 }, { cantidad: -2 }, { cantidad: -1 }, { cantidad: 1 }])).toBe(3);
  });

  it("calcula la existencia por insumo y por lote en la base", async () => {
    const guantes = await idInsumo("Guantes");
    const [l1] = await db.insert(lote).values({ insumoId: guantes, cantidad: 2, fechaCompra: "2026-10-01" }).returning();
    const [l2] = await db.insert(lote).values({ insumoId: guantes, cantidad: 3, fechaCompra: "2026-11-01" }).returning();
    const g = randomUUID();
    await db.insert(movimiento).values([
      { insumoId: guantes, loteId: l1.id, tipo: "entrada", cantidad: 2, grupoId: randomUUID() },
      { insumoId: guantes, loteId: l2.id, tipo: "entrada", cantidad: 3, grupoId: randomUUID() },
      { insumoId: guantes, loteId: l1.id, tipo: "consumo", cantidad: -2, grupoId: g },
      { insumoId: guantes, loteId: l2.id, tipo: "consumo", cantidad: -1, grupoId: g },
      { insumoId: guantes, loteId: l2.id, tipo: "ajuste", cantidad: -1, grupoId: randomUUID(), nota: "Caja rota" },
    ]);
    expect(await existenciaInsumo(guantes)).toBe(1);
    const lotes = await lotesConExistencia({ insumoId: guantes });
    expect(lotes.map((l) => [l.id, l.restante])).toEqual([
      [l1.id, 0],
      [l2.id, 1],
    ]);
  });

  it("un insumo sin movimientos tiene existencia 0", async () => {
    expect(await existenciaInsumo(await idInsumo("Anestesia"))).toBe(0);
  });

  it("la base rechaza un consumo con signo positivo", async () => {
    const resina = await idInsumo("Resina");
    const [l] = await db.insert(lote).values({ insumoId: resina, cantidad: 1, fechaCompra: "2026-11-01" }).returning();
    await expect(
      db.insert(movimiento).values({ insumoId: resina, loteId: l.id, tipo: "consumo", cantidad: 1, grupoId: randomUUID() }),
    ).rejects.toThrow();
  });
});

describe("A-04 avisos", () => {
  it("no admite dos avisos abiertos con la misma clave, pero sí uno abierto y otro atendido", async () => {
    const base = {
      tipo: "reserva_baja",
      titulo: "x",
      prioridad: "alta" as const,
      origen: "inventario",
      clave: "inventario:reserva:1",
    };
    await db.insert(aviso).values({ ...base, atendido: true });
    await db.insert(aviso).values(base);
    await expect(db.insert(aviso).values(base)).rejects.toThrow();
  });
});
