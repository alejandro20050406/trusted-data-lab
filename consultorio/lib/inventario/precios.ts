/**
 * Historial de precios de compra. Contrato con Adrián: `historialPrecios()`
 * alimenta la gráfica de variación de precio (D-13).
 */
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { lote } from "@/lib/db/schema";

export interface RegistroPrecio {
  loteId: number;
  /** Fecha de compra (AAAA-MM-DD). */
  fechaCompra: string;
  proveedor: string | null;
  presentacion: string | null;
  varianteId: number | null;
  /** Cantidad comprada en la unidad del insumo. */
  cantidad: number;
  precioTotal: number;
  /** Precio por unidad del insumo: precioTotal / cantidad. */
  precioUnitario: number;
  /** Precio por pieza cuando se conoce el contenido de cada unidad; si no, null. */
  precioPorPieza: number | null;
}

const redondear = (n: number, decimales: number) => Math.round(n * 10 ** decimales) / 10 ** decimales;

/**
 * Precio por unidad del insumo y, si se sabe cuántas piezas trae cada unidad,
 * precio por pieza. Así se comparan presentaciones distintas (caja de 100
 * guantes frente a caja de 50).
 */
export function calcularPrecioUnitario(compra: {
  precioTotal: number;
  cantidad: number;
  contenidoPorUnidad?: number | null;
}): { precioUnitario: number; precioPorPieza: number | null } {
  if (!(compra.cantidad > 0)) throw new RangeError("La cantidad debe ser mayor que cero.");
  if (!(compra.precioTotal >= 0) || !Number.isFinite(compra.precioTotal)) throw new RangeError("Precio inválido.");
  const precioUnitario = compra.precioTotal / compra.cantidad;
  const contenido = compra.contenidoPorUnidad ?? null;
  return {
    precioUnitario: redondear(precioUnitario, 2),
    precioPorPieza: contenido && contenido > 0 ? redondear(precioUnitario / contenido, 4) : null,
  };
}

/** Compras con precio del insumo, de la más antigua a la más reciente. */
export async function historialPrecios(insumoId: number): Promise<RegistroPrecio[]> {
  const filas = await getDb()
    .select()
    .from(lote)
    .where(and(eq(lote.insumoId, insumoId), isNotNull(lote.precioTotal)))
    .orderBy(asc(lote.fechaCompra), asc(lote.id));
  return filas.map((f) => {
    const precioTotal = Number(f.precioTotal);
    return {
      loteId: f.id,
      fechaCompra: f.fechaCompra,
      proveedor: f.proveedor,
      presentacion: f.presentacion,
      varianteId: f.varianteId,
      cantidad: f.cantidad,
      precioTotal,
      ...calcularPrecioUnitario({ precioTotal, cantidad: f.cantidad, contenidoPorUnidad: f.contenidoPorUnidad }),
    };
  });
}

/** La compra personal con menor precio por pieza (o por unidad si no hay piezas). */
export function compraMasBarata(historial: readonly RegistroPrecio[]): RegistroPrecio | null {
  if (historial.length === 0) return null;
  const conPieza = historial.filter((h) => h.precioPorPieza !== null);
  const base = conPieza.length > 0 ? conPieza : historial;
  const clave = (h: RegistroPrecio) => (conPieza.length > 0 ? h.precioPorPieza! : h.precioUnitario);
  return base.reduce((mejor, h) => (clave(h) < clave(mejor) || (clave(h) === clave(mejor) && h.fechaCompra > mejor.fechaCompra) ? h : mejor));
}
