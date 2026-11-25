"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { getAuth } from "@/lib/auth";

const esquema = z.object({
  email: z.email({ error: "Escribe un correo válido." }),
  password: z.string().min(1, { error: "Escribe tu contraseña." }),
});

export interface EstadoLogin {
  error: string | null;
  email: string;
}

export async function iniciarSesion(_previo: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const datos = esquema.safeParse({ email, password: formData.get("password") });
  if (!datos.success) {
    return { error: datos.error.issues[0]?.message ?? "Revisa los datos.", email };
  }
  try {
    await getAuth().api.signInEmail({ body: datos.data, headers: await headers() });
  } catch (error) {
    if (error instanceof APIError) {
      return { error: "El correo o la contraseña no coinciden.", email };
    }
    throw error;
  }
  redirect("/");
}

export async function cerrarSesion(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}
