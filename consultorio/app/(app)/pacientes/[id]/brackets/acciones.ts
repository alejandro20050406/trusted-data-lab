"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/sesion";
import {
  adjuntarFotoBracket,
  BracketInvalido,
  descontarReposicion,
  deshacerBracketCaido,
  guardarNotaBracket,
  quitarReposicion,
  registrarBracketCaido,
  reposicionesParaDiente,
  type Reposicion,
} from "@/lib/clinica/brackets";
import { ArchivoInvalido } from "@/lib/archivos/validacion";
import { deshacerConsumo } from "@/lib/inventario/consumo";
import { ExistenciaInsuficiente } from "@/lib/inventario/estado";
import { ConsumoInvalido } from "@/lib/inventario/consumo";

type Fallo = { ok: false; error: string };

function revalidar(pacienteId: number) {
  revalidatePath(`/pacientes/${pacienteId}/brackets`);
  revalidatePath("/reportes/brackets");
  revalidatePath("/inventario");
  revalidatePath("/inventario/brackets");
}

const id = z.number().int().positive();

export type ResultadoRegistro = { ok: true; id: number; reposiciones: Reposicion[] } | Fallo;

/** Un toque en el diente: registra la caída con la fecha de hoy. */
export async function registrarCaidaAccion(datos: { pacienteId: number; dienteFdi: number }): Promise<ResultadoRegistro> {
  await requireSession();
  const d = z.object({ pacienteId: id, dienteFdi: z.number().int().min(11).max(48) }).safeParse(datos);
  if (!d.success) return { ok: false, error: "Elige un diente." };
  try {
    const nuevo = await registrarBracketCaido(d.data);
    const repos = await reposicionesParaDiente(d.data.dienteFdi);
    revalidar(d.data.pacienteId);
    return { ok: true, id: nuevo, reposiciones: repos?.opciones ?? [] };
  } catch (e) {
    if (e instanceof BracketInvalido) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deshacerCaidaAccion(bracketId: number, pacienteId: number): Promise<{ ok: true } | Fallo> {
  await requireSession();
  if (!id.safeParse(bracketId).success) return { ok: false, error: "No se pudo deshacer." };
  const ok = await deshacerBracketCaido(bracketId);
  revalidar(pacienteId);
  return ok ? { ok: true } : { ok: false, error: "Ya tiene foto o reposición; no se puede deshacer." };
}

export async function guardarNotaAccion(bracketId: number, pacienteId: number, nota: string): Promise<{ ok: true } | Fallo> {
  await requireSession();
  if (!id.safeParse(bracketId).success || typeof nota !== "string") return { ok: false, error: "Datos inválidos." };
  try {
    await guardarNotaBracket(bracketId, nota);
  } catch (e) {
    if (e instanceof BracketInvalido) return { ok: false, error: e.message };
    throw e;
  }
  revalidar(pacienteId);
  return { ok: true };
}

export async function confirmarFotoAccion(datos: { bracketId: number; pacienteId: number; boleto: string }): Promise<{ ok: true } | Fallo> {
  const sesion = await requireSession();
  const d = z.object({ bracketId: id, pacienteId: id, boleto: z.string().min(10).max(2000) }).safeParse(datos);
  if (!d.success) return { ok: false, error: "Datos inválidos." };
  try {
    await adjuntarFotoBracket(d.data.bracketId, d.data.boleto, sesion.user.id);
  } catch (e) {
    if (e instanceof BracketInvalido || e instanceof ArchivoInvalido) return { ok: false, error: e.message };
    throw e;
  }
  revalidar(d.data.pacienteId);
  return { ok: true };
}

export type ResultadoReposicion = { ok: true; grupoId: string; existenciaRestante: number } | Fallo;

/** "Descontar bracket de reposición" con `registrarConsumo()`. */
export async function descontarReposicionAccion(datos: { bracketId: number; pacienteId: number; varianteId: number }): Promise<ResultadoReposicion> {
  await requireSession();
  const d = z.object({ bracketId: id, pacienteId: id, varianteId: id }).safeParse(datos);
  if (!d.success) return { ok: false, error: "Elige el bracket." };
  try {
    const r = await descontarReposicion(d.data.bracketId, d.data.varianteId);
    revalidar(d.data.pacienteId);
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof BracketInvalido || e instanceof ExistenciaInsuficiente || e instanceof ConsumoInvalido) return { ok: false, error: e.message };
    throw e;
  }
}

export async function deshacerReposicionAccion(datos: { bracketId: number; pacienteId: number; grupoId: string }): Promise<{ ok: true } | Fallo> {
  await requireSession();
  const d = z.object({ bracketId: id, pacienteId: id, grupoId: z.uuid() }).safeParse(datos);
  if (!d.success) return { ok: false, error: "No se pudo deshacer." };
  const ok = await deshacerConsumo(d.data.grupoId);
  if (ok) await quitarReposicion(d.data.bracketId, d.data.grupoId);
  revalidar(d.data.pacienteId);
  return ok ? { ok: true } : { ok: false, error: "Ya no se puede deshacer." };
}
