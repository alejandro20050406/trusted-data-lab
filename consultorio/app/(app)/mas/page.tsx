import { LogOut } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { cerrarSesion } from "@/app/login/acciones";
import { BotonPrimario } from "@/components/ui/boton-primario";

export default async function Mas() {
  await requireSession();
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Más</h1>
      <form action={cerrarSesion}>
        <BotonPrimario type="submit">
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </BotonPrimario>
      </form>
    </>
  );
}
