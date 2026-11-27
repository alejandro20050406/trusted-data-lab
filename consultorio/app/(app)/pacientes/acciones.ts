"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/sesion";
import {
  actualizarPaciente,
  CitaInvalida,
  crearPaciente,
  deshacerMarcaCita,
  esquemaPaciente,
  marcarCita,
  programarCita,
  reagendarCita,
} from "@/lib/clinica/pacientes";
import { fechaHoraLocalAUtc } from "@/lib/clinica/fechas";
import { confirmarSubida, prepararSubida, type SubidaPreparada } from "@/lib/archivos/archivos";
import { ArchivoInvalido, TIPOS_ARCHIVO_ESCANEO } from "@/lib/archivos/validacion";

export type Resultado = { ok: true } | { ok: false; error: string };

export interface EstadoFormulario {
  ok: boolean;
  error: string | null;
  valores: Record<string, string>;
}

const esquemaId = z.coerce.number().int().positive();

function texto(formData: FormData, nombre: string): string {
  const v = formData.get(nombre);
  return typeof v === "string" ? v.trim() : "";
}

function revalidarPaciente(id?: number) {
  revalidatePath("/pacientes");
  if (id) revalidatePath(`/pacientes/${id}`);
}

// ---------------------------------------------------------------------------
// Pacientes
// ---------------------------------------------------------------------------

export async function crearPacienteAccion(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  await requireSession();
  const valores = { nombre: texto(formData, "nombre"), telefono: texto(formData, "telefono"), notas: texto(formData, "notas") };
  const datos = esquemaPaciente.safeParse(valores);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos.", valores };
  const id = await crearPaciente(datos.data);
  revalidarPaciente();
  redirect(`/pacientes/${id}`);
}

export async function editarPacienteAccion(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  await requireSession();
  const id = esquemaId.safeParse(texto(formData, "pacienteId"));
  const valores = { nombre: texto(formData, "nombre"), telefono: texto(formData, "telefono"), notas: texto(formData, "notas") };
  if (!id.success) return { ok: false, error: "El paciente no existe.", valores };
  const datos = esquemaPaciente.safeParse(valores);
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los datos.", valores };
  await actualizarPaciente(id.data, datos.data);
  revalidarPaciente(id.data);
  return { ok: true, error: null, valores };
}

// ---------------------------------------------------------------------------
// Citas
// ---------------------------------------------------------------------------

const esquemaFecha = z.iso.date({ error: "Elige la fecha." });
const esquemaHora = z.string().regex(/^\d{2}:\d{2}$/, { error: "Elige la hora." });

export async function programarCitaAccion(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  await requireSession();
  const valores = { fecha: texto(formData, "fecha"), hora: texto(formData, "hora") };
  const id = esquemaId.safeParse(texto(formData, "pacienteId"));
  if (!id.success) return { ok: false, error: "El paciente no existe.", valores };
  const fecha = esquemaFecha.safeParse(valores.fecha);
  if (!fecha.success) return { ok: false, error: "Elige la fecha.", valores };
  const hora = esquemaHora.safeParse(valores.hora);
  if (!hora.success) return { ok: false, error: "Elige la hora.", valores };
  try {
    await programarCita(id.data, fechaHoraLocalAUtc(fecha.data, hora.data));
  } catch (e) {
    if (e instanceof CitaInvalida || e instanceof RangeError) return { ok: false, error: e.message, valores };
    throw e;
  }
  revalidarPaciente(id.data);
  return { ok: true, error: null, valores: {} };
}

const esquemaMarca = z.object({
  citaId: z.number().int().positive(),
  pacienteId: z.number().int().positive(),
  estado: z.enum(["atendida", "cancelada", "no_asistio"]),
});

/** "Atendida" (un toque), "No asistió" o "Cancelar". */
export async function marcarCitaAccion(datos: z.input<typeof esquemaMarca>): Promise<Resultado> {
  await requireSession();
  const d = esquemaMarca.safeParse(datos);
  if (!d.success) return { ok: false, error: "Datos inválidos." };
  try {
    await marcarCita(d.data.citaId, d.data.estado);
  } catch (e) {
    if (e instanceof CitaInvalida) return { ok: false, error: e.message };
    throw e;
  }
  revalidarPaciente(d.data.pacienteId);
  return { ok: true };
}

export async function deshacerMarcaCitaAccion(citaId: number, pacienteId: number): Promise<Resultado> {
  await requireSession();
  const id = esquemaId.safeParse(citaId);
  if (!id.success) return { ok: false, error: "No se pudo deshacer." };
  const ok = await deshacerMarcaCita(id.data);
  revalidarPaciente(pacienteId);
  return ok ? { ok: true } : { ok: false, error: "Ya no se puede deshacer." };
}

const esquemaReagenda = z.object({
  citaId: z.number().int().positive(),
  pacienteId: z.number().int().positive(),
  fecha: esquemaFecha,
  hora: esquemaHora,
});

/** "Reagendar": crea la nueva cita enlazada con la original. */
export async function reagendarCitaAccion(datos: z.input<typeof esquemaReagenda>): Promise<Resultado> {
  await requireSession();
  const d = esquemaReagenda.safeParse(datos);
  if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "Elige la nueva fecha." };
  try {
    await reagendarCita(d.data.citaId, fechaHoraLocalAUtc(d.data.fecha, d.data.hora));
  } catch (e) {
    if (e instanceof CitaInvalida || e instanceof RangeError) return { ok: false, error: e.message };
    throw e;
  }
  revalidarPaciente(d.data.pacienteId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Archivos (D-05 y D-06)
// ---------------------------------------------------------------------------

export type ResultadoSubida = ({ ok: true } & SubidaPreparada) | { ok: false; error: string };

/** Firma la subida directa al bucket, solo con sesión. */
export async function prepararSubidaAccion(datos: { pacienteId: number; tipoContenido: string; tamano: number }): Promise<ResultadoSubida> {
  await requireSession();
  const d = z
    .object({ pacienteId: z.number().int().positive(), tipoContenido: z.string().max(100), tamano: z.number().int() })
    .safeParse(datos);
  if (!d.success) return { ok: false, error: "Datos inválidos." };
  try {
    return { ok: true, ...(await prepararSubida(d.data.pacienteId, d.data.tipoContenido, d.data.tamano)) };
  } catch (e) {
    if (e instanceof ArchivoInvalido) return { ok: false, error: e.message };
    throw e;
  }
}

export type ResultadoConfirmacion = { ok: true; id: number; nombre: string } | { ok: false; error: string };

export async function confirmarSubidaAccion(datos: { boleto: string; tipo: string; pacienteId: number }): Promise<ResultadoConfirmacion> {
  const sesion = await requireSession();
  const d = z
    .object({ boleto: z.string().min(10).max(2000), tipo: z.enum(TIPOS_ARCHIVO_ESCANEO), pacienteId: z.number().int().positive() })
    .safeParse(datos);
  if (!d.success) return { ok: false, error: "Elige el tipo de archivo." };
  try {
    const archivo = await confirmarSubida(d.data.boleto, d.data.tipo, sesion.user.id);
    revalidarPaciente(archivo.pacienteId);
    return { ok: true, id: archivo.id, nombre: archivo.nombre };
  } catch (e) {
    if (e instanceof ArchivoInvalido) return { ok: false, error: e.message };
    throw e;
  }
}
