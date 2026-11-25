import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/sesion";
import { FormularioLogin } from "./formulario-login";

export const metadata = { title: "Iniciar sesión · Consultorio" };

export default async function PaginaLogin() {
  if (await obtenerSesion()) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Inventario del consultorio</h1>
      <FormularioLogin />
    </main>
  );
}
