"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/sesion";
import { configurarTarea, deshacerRealizacion, esquemaConfiguracion, marcarTareaHecha, TareaInvalida } from "@/lib/clinica/tareas";
import { fechaCorta } from "@/lib/inventario/formato";

export type Resultado = { ok: true } | { ok: false; error: string };
export type ResultadoHecha = { ok: true; realizacionId: number; mensaje: string } | { ok: false; error: string };

function revalidar(id: number) {
  revalidatePath("/tareas");
  revalidatePath(`/tareas/${id}`);
  revalidatePath("/");
}

const esquemaHecha = z.object({
  tareaId: z.number().int().positive(),
  fecha: z.union([z.iso.date(), z.literal("")]).optional(),
  detalle: z.string().max(200).optional(),
  comprobante: z.string().max(100).optional(),
  nota: z.string().max(300).optional(),
});

/** "Esterilización hecha hoy" / "Recolección hecha hoy" (un toque). */
export async function marcarTareaHechaAccion(datos: z.input<typeof esquemaHecha>): Promise<ResultadoHecha> {
  await requireSession();
  const d = esquemaHecha.safeParse(datos);
  if (!d.success) return { ok: false, error: "Revisa los datos." };
  const { tareaId, fecha, ...resto } = d.data;
  try {
    const r = await marcarTareaHecha(tareaId, { ...resto, fecha: fecha || undefined });
    revalidar(tareaId);
    const proxima = r.calculo.proximaFecha;
    return { ok: true, realizacionId: r.realizacionId, mensaje: proxima ? `Registrado. Próxima: ${fechaCorta(proxima)}` : "Registrado" };
  } catch (e) {
    if (e instanceof TareaInvalida) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "Revisa los datos." };
    throw e;
  }
}

export async function deshacerTareaAccion(realizacionId: number, tareaId: number): Promise<Resultado> {
  await requireSession();
  if (!Number.isInteger(realizacionId) || realizacionId <= 0) return { ok: false, error: "No se pudo deshacer." };
  const ok = await deshacerRealizacion(realizacionId);
  revalidar(tareaId);
  return ok ? { ok: true } : { ok: false, error: "Ya no se puede deshacer." };
}

export interface EstadoConfiguracion {
  ok: boolean;
  error: string | null;
}

export async function configurarTareaAccion(_previo: EstadoConfiguracion, formData: FormData): Promise<EstadoConfiguracion> {
  await requireSession();
  const id = z.coerce.number().int().positive().safeParse(formData.get("tareaId"));
  if (!id.success) return { ok: false, error: "La tarea no existe." };
  const datos = esquemaConfiguracion.safeParse({ cadaDias: formData.get("cadaDias"), diasAnticipacion: formData.get("diasAnticipacion") });
  if (!datos.success) return { ok: false, error: datos.error.issues[0]?.message ?? "Revisa los valores." };
  try {
    await configurarTarea(id.data, datos.data);
  } catch (e) {
    if (e instanceof TareaInvalida) return { ok: false, error: e.message };
    throw e;
  }
  revalidar(id.data);
  return { ok: true, error: null };
}
