/**
 * Historial de precios de compra. Contrato con Adrián: `historialPrecios()`
 * alimenta la gráfica de variación de precio (D-13).
 */

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

export async function historialPrecios(insumoId: number): Promise<RegistroPrecio[]> {
  void insumoId;
  throw new Error("no implementado");
}
