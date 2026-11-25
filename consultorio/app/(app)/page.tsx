import { requireSession } from "@/lib/sesion";
import { cerrarSesion } from "@/app/login/acciones";

export default async function Inicio() {
  const sesion = await requireSession();
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Hola, {sesion.user.name}</h1>
      <form action={cerrarSesion}>
        <button type="submit" className="mt-4 underline">Cerrar sesión</button>
      </form>
    </main>
  );
}
