/**
 * Pacientes y citas (D-03). `ultimaVisita` es la última cita atendida y
 * `vecesReagendada` el número de citas del paciente en estado `reagendada`.
 */
import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { cita, paciente } from "@/lib/db/schema";
import { fechaHoraLocal } from "./fechas";

export type EstadoCita = "programada" | "atendida" | "reagendada" | "cancelada" | "no_asistio";

/**
 * A partir de cuántas citas reagendadas se muestra la insignia "Reagenda seguido".
 * Valor provisional: el umbral lo define la clienta.
 */
export const UMBRAL_REAGENDA = Number(process.env.UMBRAL_REAGENDA) || 3;

export interface CitaResumen {
  id: number;
  fechaHora: Date;
  estado: EstadoCita;
  citaOriginalId: number | null;
}

/** Instante de la última cita atendida, o null si nunca ha sido atendido. */
export function calcularUltimaVisita(citas: readonly Pick<CitaResumen, "fechaHora" | "estado">[]): Date | null {
  let ultima: Date | null = null;
  for (const c of citas) {
    if (c.estado === "atendida" && (ultima === null || c.fechaHora > ultima)) ultima = c.fechaHora;
  }
  return ultima;
}

/** Cuántas citas del paciente se reagendaron. */
export function calcularVecesReagendada(citas: readonly Pick<CitaResumen, "estado">[]): number {
  return citas.filter((c) => c.estado === "reagendada").length;
}

export function reagendaFrecuente(veces: number, umbral = UMBRAL_REAGENDA): boolean {
  return veces >= umbral;
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

export const esquemaPaciente = z.object({
  nombre: z.string().trim().min(2, { error: "Escribe el nombre del paciente." }).max(120),
  telefono: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9 +()-]*$/, { error: "El teléfono solo lleva números." })
    .transform((v) => (v === "" ? null : v))
    .nullish(),
  notas: z
    .string()
    .trim()
    .max(300, { error: "Las notas son cortas: máximo 300 caracteres." })
    .transform((v) => (v === "" ? null : v))
    .nullish(),
});

export class CitaInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "CitaInvalida";
  }
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export interface PacienteLista {
  id: number;
  nombre: string;
  telefono: string | null;
  /** Fecha local (AAAA-MM-DD) de la última cita atendida. */
  ultimaVisita: string | null;
  vecesReagendada: number;
  proximaCita: Date | null;
}

export async function crearPaciente(datos: z.input<typeof esquemaPaciente>): Promise<number> {
  const d = esquemaPaciente.parse(datos);
  const [fila] = await getDb()
    .insert(paciente)
    .values({ nombre: d.nombre, telefono: d.telefono ?? null, notas: d.notas ?? null })
    .returning({ id: paciente.id });
  return fila.id;
}

export async function actualizarPaciente(id: number, datos: z.input<typeof esquemaPaciente>): Promise<void> {
  const d = esquemaPaciente.parse(datos);
  await getDb()
    .update(paciente)
    .set({ nombre: d.nombre, telefono: d.telefono ?? null, notas: d.notas ?? null })
    .where(eq(paciente.id, id));
}

/** Pacientes activos con última visita, veces reagendada y próxima cita, ordenados por nombre. */
export async function listarPacientes(ahora = new Date()): Promise<PacienteLista[]> {
  const db = getDb();
  const filas = await db
    .select({
      id: paciente.id,
      nombre: paciente.nombre,
      telefono: paciente.telefono,
      ultimaVisita: sql<Date | string | null>`max(${cita.fechaHora}) filter (where ${cita.estado} = 'atendida')`,
      vecesReagendada: sql<number>`count(${cita.id}) filter (where ${cita.estado} = 'reagendada')::int`,
      proximaCita: sql<Date | string | null>`min(${cita.fechaHora}) filter (where ${cita.estado} = 'programada' and ${cita.fechaHora} >= ${ahora.toISOString()})`,
    })
    .from(paciente)
    .leftJoin(cita, eq(cita.pacienteId, paciente.id))
    .where(eq(paciente.activo, true))
    .groupBy(paciente.id)
    .orderBy(asc(paciente.nombre));
  const aFecha = (v: Date | string | null) => (v === null ? null : v instanceof Date ? v : new Date(v));
  return filas.map((f) => {
    const ultima = aFecha(f.ultimaVisita);
    return {
      id: f.id,
      nombre: f.nombre,
      telefono: f.telefono,
      ultimaVisita: ultima ? fechaHoraLocal(ultima).fecha : null,
      vecesReagendada: Number(f.vecesReagendada),
      proximaCita: aFecha(f.proximaCita),
    };
  });
}

export interface FichaPaciente {
  id: number;
  nombre: string;
  telefono: string | null;
  notas: string | null;
  activo: boolean;
  citas: CitaResumen[];
  ultimaVisita: Date | null;
  vecesReagendada: number;
  /** La siguiente cita programada (la más próxima, aunque ya haya pasado la hora). */
  citaPendiente: CitaResumen | null;
}

export async function fichaPaciente(id: number): Promise<FichaPaciente | null> {
  const db = getDb();
  const [p] = await db.select().from(paciente).where(eq(paciente.id, id));
  if (!p) return null;
  const citas = await db
    .select({ id: cita.id, fechaHora: cita.fechaHora, estado: cita.estado, citaOriginalId: cita.citaOriginalId })
    .from(cita)
    .where(eq(cita.pacienteId, id))
    .orderBy(desc(cita.fechaHora), desc(cita.id));
  const programadas = citas.filter((c) => c.estado === "programada").sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime());
  return {
    id: p.id,
    nombre: p.nombre,
    telefono: p.telefono,
    notas: p.notas,
    activo: p.activo,
    citas,
    ultimaVisita: calcularUltimaVisita(citas),
    vecesReagendada: calcularVecesReagendada(citas),
    citaPendiente: programadas[0] ?? null,
  };
}

export async function programarCita(pacienteId: number, fechaHora: Date): Promise<number> {
  if (Number.isNaN(fechaHora.getTime())) throw new CitaInvalida("Fecha inválida.");
  const db = getDb();
  const [p] = await db.select({ id: paciente.id }).from(paciente).where(eq(paciente.id, pacienteId));
  if (!p) throw new CitaInvalida("El paciente no existe.");
  const [fila] = await db.insert(cita).values({ pacienteId, fechaHora, estado: "programada" }).returning({ id: cita.id });
  return fila.id;
}

/** Cambia una cita programada a atendida, cancelada o no asistió. */
export async function marcarCita(citaId: number, estado: "atendida" | "cancelada" | "no_asistio"): Promise<void> {
  const filas = await getDb()
    .update(cita)
    .set({ estado, actualizadoEn: new Date() })
    .where(and(eq(cita.id, citaId), eq(cita.estado, "programada")))
    .returning({ id: cita.id });
  if (filas.length === 0) throw new CitaInvalida("La cita ya no está programada.");
}

/** Margen del servidor para deshacer una marca; la interfaz ofrece 10 segundos. */
export const VENTANA_DESHACER_CITA_MS = 60_000;

/** Regresa a `programada` una cita marcada hace menos de un minuto. */
export async function deshacerMarcaCita(citaId: number, ahora = new Date()): Promise<boolean> {
  const limite = new Date(ahora.getTime() - VENTANA_DESHACER_CITA_MS);
  const filas = await getDb()
    .update(cita)
    .set({ estado: "programada", actualizadoEn: ahora })
    .where(and(eq(cita.id, citaId), inArray(cita.estado, ["atendida", "cancelada", "no_asistio"]), gt(cita.actualizadoEn, limite)))
    .returning({ id: cita.id });
  return filas.length > 0;
}

/**
 * Reagenda una cita programada (o a la que no asistió): la original queda en
 * `reagendada` y se crea la nueva cita enlazada con `citaOriginalId`.
 */
export async function reagendarCita(citaId: number, nuevaFechaHora: Date): Promise<number> {
  if (Number.isNaN(nuevaFechaHora.getTime())) throw new CitaInvalida("Fecha inválida.");
  return getDb().transaction(async (tx) => {
    const [original] = await tx.select().from(cita).where(eq(cita.id, citaId)).for("update");
    if (!original) throw new CitaInvalida("La cita no existe.");
    if (original.estado !== "programada" && original.estado !== "no_asistio") {
      throw new CitaInvalida("Solo se reagenda una cita programada o a la que no asistió.");
    }
    await tx.update(cita).set({ estado: "reagendada", actualizadoEn: new Date() }).where(eq(cita.id, citaId));
    const [nueva] = await tx
      .insert(cita)
      .values({ pacienteId: original.pacienteId, fechaHora: nuevaFechaHora, estado: "programada", citaOriginalId: citaId })
      .returning({ id: cita.id });
    return nueva.id;
  });
}

export async function nombrePaciente(id: number): Promise<string | null> {
  const [p] = await getDb().select({ nombre: paciente.nombre }).from(paciente).where(eq(paciente.id, id));
  return p?.nombre ?? null;
}
