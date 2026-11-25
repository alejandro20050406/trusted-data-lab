import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { cerrarSesion } from "@/app/login/acciones";
import { BotonPrimario } from "@/components/ui/boton-primario";
import { Button } from "@/components/ui/button";

export default async function Mas() {
  await requireSession();
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Más</h1>
      <nav aria-label="Más opciones" className="mb-6 flex flex-col gap-2">
        <Button asChild variant="outline" className="justify-start">
          <Link href="/inventario/brackets">Brackets por diente</Link>
        </Button>
      </nav>
      <form action={cerrarSesion}>
        <BotonPrimario type="submit">
          <LogOut aria-hidden="true" />
          Cerrar sesión
        </BotonPrimario>
      </form>
    </>
  );
}
