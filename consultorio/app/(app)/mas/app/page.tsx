import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { Tarjeta, TarjetaContenido, TarjetaTitulo } from "@/components/ui/tarjeta";
import { Notificaciones } from "./notificaciones";

export const metadata = { title: "Instalar la app · Consultorio" };

export default async function PaginaApp() {
  await requireSession();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/mas" className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Más
        </Link>
        <h1 className="text-2xl font-semibold">Instalar la app y notificaciones</h1>
      </div>

      <Tarjeta>
        <TarjetaTitulo>Instalar en el celular</TarjetaTitulo>
        <TarjetaContenido className="flex flex-col gap-4 text-lg">
          <div>
            <h2 className="font-semibold">Android (Chrome)</h2>
            <ol className="ml-6 list-decimal">
              <li>Toca el menú ⋮ arriba a la derecha.</li>
              <li>Elige “Instalar app” o “Agregar a pantalla principal”.</li>
            </ol>
          </div>
          <div>
            <h2 className="font-semibold">iPhone (Safari)</h2>
            <ol className="ml-6 list-decimal">
              <li>Toca el botón Compartir (el cuadro con la flecha hacia arriba).</li>
              <li>Elige “Agregar a inicio” y luego “Agregar”.</li>
              <li>Abre el consultorio desde el ícono nuevo para activar las notificaciones.</li>
            </ol>
          </div>
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaTitulo>Notificaciones</TarjetaTitulo>
        <TarjetaContenido className="flex flex-col gap-3">
          <p className="text-muted-foreground">Llegan cuando hay un aviso urgente: insumo agotado o en reserva, esterilización o recolección de residuos vencida.</p>
          <Notificaciones llavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
