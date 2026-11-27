/**
 * Motor de tareas periódicas (D-09): esterilización de piezas (D-10) y
 * recolección de residuos (D-11). La próxima fecha es la última realización
 * más `cadaDias`. La ruta diaria crea o actualiza un aviso por tarea con
 * `crearAviso()` cuando se acerca la fecha; al marcarla como hecha se guarda
 * la fecha real y se cierra el aviso.
 */
import { and, asc, desc, eq, gt, max } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { realizacionTarea, tareaPeriodica } from "@/lib/db/schema";
import { cerrarAvisosPorClave, crearAviso, type DatosAviso } from "@/lib/avisos";
import { diasEntre, hoyLocal, sumarDias } from "@/lib/inventario/estado";

export type TipoTarea = "esterilizacion" | "residuos";

export type EstadoTarea = "sin_definir" | "sin_registro" | "al_dia" | "proxima" | "hoy" | "vencida";

export interface ReglasTarea {
  cadaDias: number | null;
  ultimaRealizacion: string | null;
  diasAnticipacion: number;
}

export interface CalculoTarea {
  estado: EstadoTarea;
  /** AAAA-MM-DD; null si falta la periodicidad o la primera realización. */
  proximaFecha: string | null;
  /** Días de hoy a la próxima fecha (negativo si ya pasó). */
  diasRestantes: number | null;
}

/** Estado de una tarea para `hoy`. */
export function calcularTarea(t: ReglasTarea, hoy: string): CalculoTarea {
  if (t.cadaDias === null) return { estado: "sin_definir", proximaFecha: null, diasRestantes: null };
  if (t.ultimaRealizacion === null) return { estado: "sin_registro", proximaFecha: null, diasRestantes: null };
  const proximaFecha = sumarDias(t.ultimaRealizacion, t.cadaDias);
  const diasRestantes = diasEntre(hoy, proximaFecha);
  const estado: EstadoTarea = diasRestantes < 0 ? "vencida" : diasRestantes === 0 ? "hoy" : diasRestantes <= t.diasAnticipacion ? "proxima" : "al_dia";
  return { estado, proximaFecha, diasRestantes };
}

export interface Tarea extends ReglasTarea {
  id: number;
  nombre: string;
  tipo: TipoTarea;
  activo: boolean;
}

export const claveAvisoTarea = (t: Pick<Tarea, "id" | "tipo">) => `${t.tipo}:tarea:${t.id}`;

/** Id de la tarea de un aviso creado por este módulo, o null si no es de una tarea. */
export function tareaDeAviso(aviso: { origen: string; clave: string | null }): number | null {
  if (aviso.origen !== "esterilizacion" && aviso.origen !== "residuos") return null;
  const m = /^(?:esterilizacion|residuos):tarea:(\d+)$/.exec(aviso.clave ?? "");
  return m ? Number(m[1]) : null;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fecha = (f: string) => {
  const [a, m, d] = f.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
};
const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** Texto corto del estado, para la interfaz y los avisos. */
export function textoEstado(c: CalculoTarea): string {
  switch (c.estado) {
    case "sin_definir":
      return "Falta definir cada cuántos días se hace";
    case "sin_registro":
      return "Registra la última vez que se hizo";
    case "hoy":
      return "Toca hoy";
    case "vencida":
      return `Vencida hace ${dias(-c.diasRestantes!)} (tocaba el ${fecha(c.proximaFecha!)})`;
    case "proxima":
      return `Toca en ${dias(c.diasRestantes!)}, el ${fecha(c.proximaFecha!)}`;
    case "al_dia":
      return `Al día. Próxima: ${fecha(c.proximaFecha!)}`;
  }
}

/** Aviso que corresponde a la tarea hoy, o null si no debe haber aviso. */
export function planAvisoTarea(t: Tarea, hoy: string): DatosAviso | null {
  if (!t.activo) return null;
  const c = calcularTarea(t, hoy);
  if (c.estado === "al_dia" || c.estado === "sin_definir") return null;
  const esEsterilizacion = t.tipo === "esterilizacion";
  const titulo =
    c.estado === "sin_registro"
      ? `${t.nombre}: registra la última vez`
      : esEsterilizacion
        ? `Toca esterilizar: ${t.nombre}`
        : `Recolección de residuos: ${t.nombre}`;
  return {
    tipo: c.estado === "vencida" ? "tarea_vencida" : c.estado === "sin_registro" ? "tarea_sin_registro" : "tarea_proxima",
    titulo,
    detalle: textoEstado(c),
    prioridad: c.estado === "vencida" || c.estado === "hoy" ? "alta" : "media",
    fechaVencimiento: c.proximaFecha,
    urlAccion: `/tareas/${t.id}`,
    origen: t.tipo,
    clave: claveAvisoTarea(t),
  };
}

// ---------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------

export async function listarTareas(): Promise<Tarea[]> {
  return getDb().select().from(tareaPeriodica).orderBy(asc(tareaPeriodica.tipo), asc(tareaPeriodica.nombre));
}

export async function obtenerTarea(id: number): Promise<Tarea | null> {
  const [t] = await getDb().select().from(tareaPeriodica).where(eq(tareaPeriodica.id, id));
  return t ?? null;
}

export interface ResumenSincronizacion {
  avisados: number;
  cerrados: number;
}

/**
 * Crea o actualiza el aviso de cada tarea que lo necesita y cierra los de las
 * tareas al día. Usa la clave del aviso, así que llamarla varias veces el
 * mismo día no duplica avisos.
 */
export async function sincronizarAvisosTareas(hoy = hoyLocal()): Promise<ResumenSincronizacion> {
  const tareas = await listarTareas();
  let avisados = 0;
  const porCerrar: string[] = [];
  for (const t of tareas) {
    const plan = planAvisoTarea(t, hoy);
    if (plan) {
      await crearAviso(plan);
      avisados++;
    } else {
      porCerrar.push(claveAvisoTarea(t));
    }
  }
  const cerrados = await cerrarAvisosPorClave(porCerrar);
  return { avisados, cerrados };
}

export class TareaInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "TareaInvalida";
  }
}

export const esquemaRealizacion = z.object({
  fecha: z.iso.date({ error: "Fecha inválida." }).optional(),
  detalle: z.string().trim().max(200).optional(),
  comprobante: z.string().trim().max(100).optional(),
  nota: z.string().trim().max(300).optional(),
});

const vacio = (v?: string) => (v && v !== "" ? v : null);

/**
 * Marca la tarea como hecha: guarda la realización con su fecha real, mueve
 * `ultimaRealizacion` y cierra el aviso abierto.
 */
export async function marcarTareaHecha(tareaId: number, datos: z.input<typeof esquemaRealizacion> = {}, hoy = hoyLocal()): Promise<{ realizacionId: number; calculo: CalculoTarea }> {
  const d = esquemaRealizacion.parse(datos);
  const fechaReal = d.fecha ?? hoy;
  if (fechaReal > hoy) throw new TareaInvalida("La fecha no puede ser futura.");
  const db = getDb();
  const { realizacionId, tarea } = await db.transaction(async (tx) => {
    const [t] = await tx.select().from(tareaPeriodica).where(eq(tareaPeriodica.id, tareaId)).for("update");
    if (!t) throw new TareaInvalida("La tarea no existe.");
    const [r] = await tx
      .insert(realizacionTarea)
      .values({ tareaId, fecha: fechaReal, detalle: vacio(d.detalle), comprobante: vacio(d.comprobante), nota: vacio(d.nota) })
      .returning({ id: realizacionTarea.id });
    // Si se registra una fecha anterior a la última, la última no retrocede.
    const ultima = t.ultimaRealizacion && t.ultimaRealizacion > fechaReal ? t.ultimaRealizacion : fechaReal;
    const [actualizada] = await tx.update(tareaPeriodica).set({ ultimaRealizacion: ultima }).where(eq(tareaPeriodica.id, tareaId)).returning();
    return { realizacionId: r.id, tarea: actualizada };
  });
  await cerrarAvisosPorClave([claveAvisoTarea(tarea)]);
  return { realizacionId, calculo: calcularTarea(tarea, hoy) };
}

/** Margen del servidor para deshacer; la interfaz ofrece 10 segundos. */
export const VENTANA_DESHACER_TAREA_MS = 60_000;

/** Deshace una realización recién registrada y recalcula la última fecha. */
export async function deshacerRealizacion(realizacionId: number, ahora = new Date()): Promise<boolean> {
  const db = getDb();
  const limite = new Date(ahora.getTime() - VENTANA_DESHACER_TAREA_MS);
  const [borrada] = await db
    .delete(realizacionTarea)
    .where(and(eq(realizacionTarea.id, realizacionId), gt(realizacionTarea.creadoEn, limite)))
    .returning({ tareaId: realizacionTarea.tareaId });
  if (!borrada) return false;
  const [{ ultima }] = await db
    .select({ ultima: max(realizacionTarea.fecha) })
    .from(realizacionTarea)
    .where(eq(realizacionTarea.tareaId, borrada.tareaId));
  await db.update(tareaPeriodica).set({ ultimaRealizacion: ultima ?? null }).where(eq(tareaPeriodica.id, borrada.tareaId));
  await sincronizarAvisosTareas();
  return true;
}

export const esquemaConfiguracion = z.object({
  cadaDias: z.coerce
    .number({ error: "Escribe cada cuántos días." })
    .int({ error: "Usa un número entero de días." })
    .min(1, { error: "Debe ser al menos 1 día." })
    .max(3650),
  diasAnticipacion: z.coerce
    .number({ error: "Escribe los días de anticipación." })
    .int({ error: "Usa un número entero de días." })
    .min(0, { error: "No puede ser negativo." })
    .max(365),
});

export async function configurarTarea(id: number, datos: z.input<typeof esquemaConfiguracion>): Promise<void> {
  const d = esquemaConfiguracion.parse(datos);
  if (d.diasAnticipacion >= d.cadaDias) throw new TareaInvalida("La anticipación debe ser menor que la periodicidad.");
  const filas = await getDb().update(tareaPeriodica).set(d).where(eq(tareaPeriodica.id, id)).returning({ id: tareaPeriodica.id });
  if (filas.length === 0) throw new TareaInvalida("La tarea no existe.");
  await sincronizarAvisosTareas();
}

export async function historialTarea(tareaId: number, limite = 50) {
  return getDb()
    .select()
    .from(realizacionTarea)
    .where(eq(realizacionTarea.tareaId, tareaId))
    .orderBy(desc(realizacionTarea.fecha), desc(realizacionTarea.id))
    .limit(limite);
}
