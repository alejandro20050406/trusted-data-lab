import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth, type Auth } from "@/lib/auth";

export type Sesion = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

/** Devuelve la sesión actual o `null`, sin redirigir. */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  // Primero `headers()`: marca la página como dinámica antes de tocar la base.
  const cabeceras = await headers();
  return getAuth().api.getSession({ headers: cabeceras });
});

/**
 * Protege páginas y Server Actions. Si no hay sesión válida, redirige a
 * `/login`; si la hay, devuelve la sesión con el usuario.
 */
export async function requireSession(): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) {
    redirect("/login");
  }
  return sesion;
}
