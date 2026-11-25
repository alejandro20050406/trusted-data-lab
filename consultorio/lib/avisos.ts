/**
 * Avisos del panel de inicio. Contrato con Adrián: él crea avisos con
 * `crearAviso()` (p. ej. `origen: "esterilizacion"` o `"residuos"`) y el panel
 * de inicio los muestra junto con los de inventario.
 */

export type PrioridadAviso = "alta" | "media" | "baja";

export type OrigenAviso = "inventario" | "esterilizacion" | "residuos" | (string & {});

export interface DatosAviso {
  /** Clasificación libre dentro del origen, p. ej. "reserva_baja". */
  tipo: string;
  titulo: string;
  detalle?: string | null;
  prioridad: PrioridadAviso;
  /** Fecha límite del aviso (AAAA-MM-DD), si aplica. */
  fechaVencimiento?: string | null;
  /** Ruta interna del botón de acción directa, p. ej. "/inventario/compra?insumo=3". */
  urlAccion?: string | null;
  origen: OrigenAviso;
  /**
   * Llave opcional para no duplicar avisos abiertos. Si ya existe un aviso sin
   * atender con la misma clave, se actualiza en lugar de crear otro.
   */
  clave?: string | null;
}

export interface Aviso extends Required<Omit<DatosAviso, "clave">> {
  id: number;
  clave: string | null;
  atendido: boolean;
  creadoEn: Date;
  atendidoEn: Date | null;
}

export async function crearAviso(datos: DatosAviso): Promise<Aviso> {
  void datos;
  throw new Error("no implementado");
}
