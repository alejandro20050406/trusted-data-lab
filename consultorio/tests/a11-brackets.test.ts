import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepararDb } from "./ayuda-db";
import { sembrarCatalogos } from "@/lib/db/seed";
import { DIENTES } from "@/lib/db/catalogos";
import { agruparBracketsPorDiente, catalogoDientes, insumoBrackets } from "@/lib/inventario/brackets";
import { registrarCompra } from "@/lib/inventario/compras";
import { registrarConsumo } from "@/lib/inventario/consumo";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { obtenerOCrearBracket } from "@/lib/inventario/variantes";

describe("A-11 agrupación por arcada y diente", () => {
  it("incluye los 32 dientes en orden clínico, 16 por arcada", () => {
    const [sup, inf] = agruparBracketsPorDiente(DIENTES, []);
    expect(sup.arcada).toBe("superior");
    expect(sup.dientes.map((d) => d.fdi)).toEqual([18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]);
    expect(inf.dientes.map((d) => d.fdi)).toEqual([48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]);
    expect(sup.dientes.every((d) => d.total === 0)).toBe(true);
  });
});

describe("A-11 existencias por diente, sistema y slot", () => {
  let cerrar: () => Promise<void>;
  beforeAll(async () => {
    const p = await prepararDb();
    cerrar = p.cerrar;
    await sembrarCatalogos(p.db);
  });
  afterAll(async () => cerrar());

  it("la dentista ve cuántos quedan por diente y Adrián descuenta con registrarConsumo()", async () => {
    const brackets = (await insumoBrackets())!;
    const metal11 = await obtenerOCrearBracket(brackets.id, { dienteFdi: 11, sistema: "metalico", slot: "0.022" });
    const estetico11 = await obtenerOCrearBracket(brackets.id, { dienteFdi: 11, sistema: "estetico", slot: "0.018" });
    expect(await obtenerOCrearBracket(brackets.id, { dienteFdi: 11, sistema: "metalico", slot: "0.022" })).toBe(metal11);
    await registrarCompra({ insumoId: brackets.id, cantidad: 4, varianteId: metal11 });
    await registrarCompra({ insumoId: brackets.id, cantidad: 2, varianteId: estetico11 });

    await registrarConsumo({ insumoId: brackets.id, cantidad: 1, varianteId: metal11 });

    const inventario = await inventarioConEstado("2026-11-25");
    const variantes = inventario.find((i) => i.id === brackets.id)!.variantes;
    const [sup] = agruparBracketsPorDiente(await catalogoDientes(), variantes);
    const d11 = sup.dientes.find((d) => d.fdi === 11)!;
    expect(d11.nombre).toBe("Incisivo central superior derecho");
    expect(d11.total).toBe(5);
    expect(d11.variantes.map((v) => [v.sistema, v.slot, v.existencia])).toEqual([
      ["estetico", "0.018", 2],
      ["metalico", "0.022", 3],
    ]);
  });

  it("rechaza dientes que no existen", async () => {
    const brackets = (await insumoBrackets())!;
    await expect(obtenerOCrearBracket(brackets.id, { dienteFdi: 19, sistema: "metalico", slot: "0.022" })).rejects.toThrow();
  });
});
