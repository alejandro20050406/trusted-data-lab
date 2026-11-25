import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { lote, movimiento } from "@/lib/db/schema";

/** La existencia es la suma de los movimientos (entradas +, consumos −, ajustes ±). */
export function sumarExistencia(movimientos: readonly { cantidad: number }[]): number {
  return movimientos.reduce((total, m) => total + m.cantidad, 0);
}

export interface LoteConExistencia {
  id: number;
  insumoId: number;
  varianteId: number | null;
  cantidad: number;
  fechaCompra: string;
  fechaCaducidad: string | null;
  proveedor: string | null;
  marca: string | null;
  presentacion: string | null;
  contenidoPorUnidad: number | null;
  precioTotal: number | null;
  /** Lo que queda del lote según sus movimientos. */
  restante: number;
}

/** Lotes con la existencia que les queda, calculada desde `movimiento`. */
export async function lotesConExistencia(
  filtro: { insumoId?: number; varianteId?: number | null } = {},
): Promise<LoteConExistencia[]> {
  const condiciones: SQL[] = [];
  if (filtro.insumoId !== undefined) condiciones.push(eq(lote.insumoId, filtro.insumoId));
  if (filtro.varianteId !== undefined && filtro.varianteId !== null) {
    condiciones.push(eq(lote.varianteId, filtro.varianteId));
  }
  const filas = await getDb()
    .select({
      id: lote.id,
      insumoId: lote.insumoId,
      varianteId: lote.varianteId,
      cantidad: lote.cantidad,
      fechaCompra: lote.fechaCompra,
      fechaCaducidad: lote.fechaCaducidad,
      proveedor: lote.proveedor,
      marca: lote.marca,
      presentacion: lote.presentacion,
      contenidoPorUnidad: lote.contenidoPorUnidad,
      precioTotal: lote.precioTotal,
      restante: sql<number>`coalesce(sum(${movimiento.cantidad}), 0)::int`,
    })
    .from(lote)
    .leftJoin(movimiento, eq(movimiento.loteId, lote.id))
    .where(condiciones.length ? and(...condiciones) : undefined)
    .groupBy(lote.id)
    .orderBy(asc(lote.fechaCompra), asc(lote.id));
  return filas.map((f) => ({
    ...f,
    precioTotal: f.precioTotal === null ? null : Number(f.precioTotal),
    restante: Number(f.restante),
  }));
}

/** Existencia total de un insumo (o de una de sus variantes). */
export async function existenciaInsumo(insumoId: number, varianteId?: number | null): Promise<number> {
  const condiciones: SQL[] = [eq(movimiento.insumoId, insumoId)];
  if (varianteId !== undefined && varianteId !== null) condiciones.push(eq(movimiento.varianteId, varianteId));
  const [fila] = await getDb()
    .select({ total: sql<number>`coalesce(sum(${movimiento.cantidad}), 0)::int` })
    .from(movimiento)
    .where(and(...condiciones));
  return Number(fila?.total ?? 0);
}
