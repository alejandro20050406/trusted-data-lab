import { requireSession } from "@/lib/sesion";
import { cerrarSesion } from "@/app/login/acciones";
import { Button } from "@/components/ui/button";
import { Tarjeta, TarjetaContenido, TarjetaTitulo } from "@/components/ui/tarjeta";

export default async function Inicio() {
  const sesion = await requireSession();
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Hola, {sesion.user.name}</h1>
      <Tarjeta>
        <TarjetaTitulo>Resumen</TarjetaTitulo>
        <TarjetaContenido>
          <p className="text-muted-foreground">Aquí verás lo que necesita atención del consultorio.</p>
        </TarjetaContenido>
      </Tarjeta>
      {/* En escritorio el cierre de sesión vive en la barra lateral. */}
      <form action={cerrarSesion} className="mt-4 md:hidden">
        <Button type="submit" variant="outline" className="w-full">
          Cerrar sesión
        </Button>
      </form>
    </>
  );
}
