import { requireSession } from "@/lib/sesion";
import { Navegacion } from "@/components/navegacion";
import { ProveedorConfirmacion } from "@/components/ui/confirmacion";
import { AvisoSinConexion, RegistroServiceWorker } from "@/app/_pwa/pwa";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  await requireSession();
  return (
    <ProveedorConfirmacion>
      <RegistroServiceWorker />
      <AvisoSinConexion />
      <Navegacion />
      <main className="min-h-dvh px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:ml-60 md:px-8 md:pb-10">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </ProveedorConfirmacion>
  );
}
