/**
 * Reglas puras de existencia, reserva, caducidad y validez (A-06).
 * Las fechas son cadenas AAAA-MM-DD en la zona horaria del consultorio; así
 * los cálculos no cambian por la hora del servidor.
 */

export interface ReglasInsumo {
  minimoReserva: number | null;
  diasAvisoCaducidad: number | null;
  vidaUtilDias: number | null;
}

export interface LoteEstado {
  id: number;
  restante: number;
  fechaCompra: string;
  fechaCaducidad: string | null;
}

export type NivelExistencia = "suficiente" | "reserva" | "agotado";

export interface EstadoInsumo {
  /** Todo lo que queda, incluidos lotes caducados o vencidos. */
  existencia: number;
  /** Lo que se puede usar: sin lotes caducados ni vencidos por antigüedad. */
  existenciaUtil: number;
  nivel: NivelExistencia;
  reservaDefinida: boolean;
  vidaUtilDefinida: boolean;
  lotesPorCaducar: (LoteEstado & { diasRestantes: number })[];
  lotesCaducados: LoteEstado[];
  /** Lotes cuya validez por fecha de compra ya terminó (p. ej. ligas). */
  lotesVencidos: (LoteEstado & { venceEl: string })[];
}

export class ExistenciaInsuficiente extends Error {
  constructor(
    readonly solicitada: number,
    readonly disponible: number,
  ) {
    super(`Solo quedan ${disponible} y se pidieron ${solicitada}.`);
    this.name = "ExistenciaInsuficiente";
  }
}

const DIA_MS = 86_400_000;

function aUtc(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date(aUtc(fecha) + dias * DIA_MS).toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / DIA_MS);
}

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria del consultorio. */
export function hoyLocal(zona = process.env.ZONA_HORARIA || "America/Mexico_City", ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

function estaCaducado(l: LoteEstado, hoy: string): boolean {
  return l.fechaCaducidad !== null && l.fechaCaducidad < hoy;
}

function venceEl(l: LoteEstado, reglas: ReglasInsumo): string | null {
  return reglas.vidaUtilDias === null ? null : sumarDias(l.fechaCompra, reglas.vidaUtilDias);
}

function esUtil(l: LoteEstado, reglas: ReglasInsumo, hoy: string): boolean {
  if (l.restante <= 0 || estaCaducado(l, hoy)) return false;
  const vence = venceEl(l, reglas);
  return vence === null || hoy < vence;
}

export function estadoInsumo(reglas: ReglasInsumo, lotes: readonly LoteEstado[], hoy: string): EstadoInsumo {
  const conExistencia = lotes.filter((l) => l.restante > 0);
  const existencia = conExistencia.reduce((t, l) => t + l.restante, 0);
  const existenciaUtil = conExistencia.filter((l) => esUtil(l, reglas, hoy)).reduce((t, l) => t + l.restante, 0);

  const lotesCaducados = conExistencia.filter((l) => estaCaducado(l, hoy));
  const lotesPorCaducar =
    reglas.diasAvisoCaducidad === null
      ? []
      : conExistencia
          .filter((l) => l.fechaCaducidad !== null && !estaCaducado(l, hoy))
          .map((l) => ({ ...l, diasRestantes: diasEntre(hoy, l.fechaCaducidad!) }))
          .filter((l) => l.diasRestantes <= reglas.diasAvisoCaducidad!)
          .sort((a, b) => a.diasRestantes - b.diasRestantes);
  const lotesVencidos = conExistencia
    .map((l) => ({ ...l, venceEl: venceEl(l, reglas) }))
    .filter((l): l is LoteEstado & { venceEl: string } => l.venceEl !== null && hoy >= l.venceEl);

  let nivel: NivelExistencia = "suficiente";
  if (existenciaUtil <= 0) nivel = "agotado";
  else if (reglas.minimoReserva !== null && existenciaUtil <= reglas.minimoReserva) nivel = "reserva";

  return {
    existencia,
    existenciaUtil,
    nivel,
    reservaDefinida: reglas.minimoReserva !== null,
    vidaUtilDefinida: reglas.vidaUtilDias !== null,
    lotesPorCaducar,
    lotesCaducados,
    lotesVencidos,
  };
}

/**
 * Reparte un consumo entre lotes en orden FEFO: primero el que caduca antes;
 * los lotes sin caducidad van al final, del más antiguo al más reciente. No
 * toca lotes caducados ni vencidos por antigüedad.
 */
export function planConsumoFEFO(
  lotes: readonly LoteEstado[],
  cantidad: number,
  hoy: string,
  reglas: ReglasInsumo = { minimoReserva: null, diasAvisoCaducidad: null, vidaUtilDias: null },
): { loteId: number; cantidad: number }[] {
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new RangeError("La cantidad debe ser un entero mayor que cero.");
  }
  const utiles = lotes
    .filter((l) => esUtil(l, reglas, hoy))
    .sort((a, b) => {
      if (a.fechaCaducidad !== b.fechaCaducidad) {
        if (a.fechaCaducidad === null) return 1;
        if (b.fechaCaducidad === null) return -1;
        return a.fechaCaducidad < b.fechaCaducidad ? -1 : 1;
      }
      if (a.fechaCompra !== b.fechaCompra) return a.fechaCompra < b.fechaCompra ? -1 : 1;
      return a.id - b.id;
    });
  const disponible = utiles.reduce((t, l) => t + l.restante, 0);
  if (disponible < cantidad) throw new ExistenciaInsuficiente(cantidad, disponible);

  const plan: { loteId: number; cantidad: number }[] = [];
  let pendiente = cantidad;
  for (const l of utiles) {
    if (pendiente === 0) break;
    const tomar = Math.min(l.restante, pendiente);
    plan.push({ loteId: l.id, cantidad: tomar });
    pendiente -= tomar;
  }
  return plan;
}
