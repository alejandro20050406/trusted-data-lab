/**
 * Colores de ligas más usados (D-14) a partir de los movimientos de consumo
 * con variante de color que registra el inventario de Angel.
 */
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { insumo, movimiento, variante } from "@/lib/db/schema";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { hoyLocal, sumarDias } from "@/lib/inventario/estado";
import { fechaHoraLocalAUtc } from "@/lib/clinica/fechas";

/** Días que debe cubrir la compra sugerida. */
export const COBERTURA_DIAS = 30;

export interface ConsumoColor {
  insumoId: number;
  insumo: string;
  varianteId: number;
  nombre: string;
  colorHex: string | null;
  /** Unidades consumidas en el periodo (positivo). */
  cantidad: number;
}

export interface FilaColor extends ConsumoColor {
  porcentaje: number;
  existencia: number;
  /** Unidades a comprar para cubrir `cobertura` días al ritmo del periodo. */
  sugerido: number;
}

export interface ReporteInsumoColores {
  insumoId: number;
  insumo: string;
  total: number;
  filas: FilaColor[];
}

/**
 * Porcentaje de cada color y compra sugerida:
 * `ceil(consumo / dias * cobertura) - existencia`, nunca negativa.
 */
export function reporteColores(
  consumos: readonly ConsumoColor[],
  existencias: ReadonlyMap<number, number>,
  dias: number,
  cobertura = COBERTURA_DIAS,
): ReporteInsumoColores[] {
  const porInsumo = new Map<number, ConsumoColor[]>();
  for (const c of consumos) {
    if (c.cantidad <= 0) continue;
    porInsumo.set(c.insumoId, [...(porInsumo.get(c.insumoId) ?? []), c]);
  }
  return [...porInsumo.values()]
    .map((lista) => {
      const total = lista.reduce((t, c) => t + c.cantidad, 0);
      const filas = lista
        .map((c) => {
          const existencia = existencias.get(c.varianteId) ?? 0;
          const necesario = Math.ceil((c.cantidad / dias) * cobertura - 1e-9);
          return {
            ...c,
            porcentaje: Math.round((c.cantidad / total) * 1000) / 10,
            existencia,
            sugerido: Math.max(0, necesario - existencia),
          };
        })
        .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre));
      return { insumoId: lista[0].insumoId, insumo: lista[0].insumo, total, filas };
    })
    .sort((a, b) => b.total - a.total);
}

/** Consumo por color desde `hoy - dias + 1` (inclusive), en la zona del consultorio. */
export async function consumoPorColor(dias: number, hoy = hoyLocal()): Promise<ConsumoColor[]> {
  const desde = fechaHoraLocalAUtc(sumarDias(hoy, -(dias - 1)), "00:00");
  const filas = await getDb()
    .select({
      insumoId: insumo.id,
      insumo: insumo.nombre,
      varianteId: variante.id,
      nombre: variante.nombre,
      colorHex: variante.colorHex,
      cantidad: sql<number>`(-sum(${movimiento.cantidad}))::int`,
    })
    .from(movimiento)
    .innerJoin(variante, eq(variante.id, movimiento.varianteId))
    .innerJoin(insumo, eq(insumo.id, movimiento.insumoId))
    .where(and(eq(movimiento.tipo, "consumo"), eq(variante.tipo, "color"), gte(movimiento.fecha, desde)))
    .groupBy(insumo.id, insumo.nombre, variante.id, variante.nombre, variante.colorHex);
  return filas.map((f) => ({ ...f, cantidad: Number(f.cantidad) }));
}

export async function reporteColoresActual(dias: number, hoy = hoyLocal()): Promise<ReporteInsumoColores[]> {
  const [consumos, inventario] = await Promise.all([consumoPorColor(dias, hoy), inventarioConEstado(hoy)]);
  const existencias = new Map(inventario.flatMap((i) => i.variantes.map((v) => [v.id, v.existencia] as const)));
  return reporteColores(consumos, existencias, dias);
}
