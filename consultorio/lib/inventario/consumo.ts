/**
 * Consumo de insumos. Contrato con Adrián: `registrarConsumo()` se llama al
 * registrar un bracket caído (con `varianteId` del diente) y desde los botones
 * de consumo del inventario.
 */

export interface DatosConsumo {
  insumoId: number;
  /** Cantidad a descontar, entera y mayor que cero, en la unidad del insumo. */
  cantidad: number;
  /** Variante consumida: color de ligas o diente de brackets. */
  varianteId?: number | null;
}

export interface ResultadoConsumo {
  /** Identificador del consumo; sirve para deshacerlo. */
  grupoId: string;
  /** Existencia del insumo (o de la variante) después del consumo. */
  existenciaRestante: number;
}

export async function registrarConsumo(datos: DatosConsumo): Promise<ResultadoConsumo> {
  void datos;
  throw new Error("no implementado");
}
