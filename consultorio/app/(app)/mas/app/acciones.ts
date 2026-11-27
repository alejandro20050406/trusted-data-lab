"use server";

import { requireSession } from "@/lib/sesion";
import { borrarSuscripcion, enviarPrueba, esquemaSuscripcion, guardarSuscripcion, pushConfigurado } from "@/lib/clinica/push";

export type Resultado = { ok: true; mensaje?: string } | { ok: false; error: string };

export async function guardarSuscripcionAccion(datos: unknown): Promise<Resultado> {
  const sesion = await requireSession();
  const d = esquemaSuscripcion.safeParse(datos);
  if (!d.success) return { ok: false, error: "No se pudo activar en este navegador." };
  await guardarSuscripcion(d.data, sesion.user.id);
  return { ok: true };
}

export async function borrarSuscripcionAccion(endpoint: string): Promise<Resultado> {
  await requireSession();
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false, error: "Datos inválidos." };
  await borrarSuscripcion(endpoint);
  return { ok: true };
}

export async function enviarPruebaAccion(): Promise<Resultado> {
  await requireSession();
  if (!pushConfigurado()) return { ok: false, error: "Faltan las llaves VAPID en el servidor." };
  const n = await enviarPrueba();
  return n > 0 ? { ok: true, mensaje: "Notificación enviada; debe llegar en unos segundos." } : { ok: false, error: "No hay celulares con notificaciones activas." };
}
