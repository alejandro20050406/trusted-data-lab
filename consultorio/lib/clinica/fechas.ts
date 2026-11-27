/** Fechas y horas del consultorio (zona America/Mexico_City por omisión). */

export const ZONA_CONSULTORIO = () => process.env.ZONA_HORARIA || "America/Mexico_City";

const DIA_MS = 86_400_000;

/** Partes de una fecha en la zona dada. */
function partes(fecha: Date, zona: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const v = (t: string) => Number(f.find((p) => p.type === t)?.value);
  return { a: v("year"), m: v("month"), d: v("day"), h: v("hour"), min: v("minute"), s: v("second") };
}

/** Diferencia en minutos entre la hora local de `zona` y UTC en ese instante. */
function desfaseMin(instante: Date, zona: string): number {
  const p = partes(instante, zona);
  const comoUtc = Date.UTC(p.a, p.m - 1, p.d, p.h, p.min, p.s);
  return Math.round((comoUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60_000);
}

/**
 * Convierte "2026-12-01" + "10:30" escritos en la zona del consultorio a un
 * instante (Date en UTC). Lanza RangeError si el formato no es válido.
 */
export function fechaHoraLocalAUtc(fecha: string, hora: string, zona = ZONA_CONSULTORIO()): Date {
  const mf = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  const mh = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!mf || !mh) throw new RangeError("Fecha u hora inválida.");
  const [a, m, d] = [Number(mf[1]), Number(mf[2]), Number(mf[3])];
  const [h, min] = [Number(mh[1]), Number(mh[2])];
  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) throw new RangeError("Fecha u hora inválida.");
  const ingenuo = Date.UTC(a, m - 1, d, h, min);
  // Dos pasadas por si el desfase cambia entre la estimación y el resultado (horario de verano).
  let instante = ingenuo - desfaseMin(new Date(ingenuo), zona) * 60_000;
  instante = ingenuo - desfaseMin(new Date(instante), zona) * 60_000;
  const resultado = new Date(instante);
  const check = partes(resultado, zona);
  if (check.d !== d || check.m !== m) throw new RangeError("Fecha u hora inválida.");
  return resultado;
}

/** Fecha (AAAA-MM-DD) y hora (HH:MM) de un instante en la zona del consultorio. */
export function fechaHoraLocal(instante: Date, zona = ZONA_CONSULTORIO()): { fecha: string; hora: string } {
  const p = partes(instante, zona);
  const dos = (n: number) => String(n).padStart(2, "0");
  return { fecha: `${p.a}-${dos(p.m)}-${dos(p.d)}`, hora: `${dos(p.h)}:${dos(p.min)}` };
}

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "lun 1 dic 2026, 10:30". */
export function fechaHoraLegible(instante: Date, zona = ZONA_CONSULTORIO()): string {
  const { fecha, hora } = fechaHoraLocal(instante, zona);
  const [a, m, d] = fecha.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS_SEMANA[diaSemana]} ${d} ${MESES[m - 1]} ${a}, ${hora}`;
}

/**
 * Tiempo transcurrido en palabras desde `fecha` (AAAA-MM-DD) hasta `hoy`:
 * "hoy", "ayer", "hace 5 días", "hace 3 semanas", "hace 2 meses", "hace 1 año".
 */
export function haceTiempo(fecha: string, hoy: string): string {
  const dias = Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${fecha}T00:00:00Z`)) / DIA_MS);
  if (dias < 0) return "fecha futura";
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  if (dias < 365) {
    const meses = Math.floor(dias / 30);
    return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
  }
  const anios = Math.floor(dias / 365);
  return `hace ${anios} ${anios === 1 ? "año" : "años"}`;
}
