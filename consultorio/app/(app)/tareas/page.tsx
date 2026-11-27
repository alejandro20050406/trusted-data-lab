import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { calcularTarea, listarTareas, sincronizarAvisosTareas, textoEstado } from "@/lib/clinica/tareas";
import { hoyLocal } from "@/lib/inventario/estado";
import { Estado } from "@/components/ui/estado";
import { Tarjeta, TarjetaContenido, TarjetaTitulo } from "@/components/ui/tarjeta";
import { BotonTareaHecha } from "./boton-tarea-hecha";
import { TIPO_ESTADO } from "./estado-tarea";

export const metadata = { title: "Recordatorios · Consultorio" };

export default async function Tareas() {
  await requireSession();
  const hoy = hoyLocal();
  await sincronizarAvisosTareas(hoy);
  const tareas = (await listarTareas()).filter((t) => t.activo);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Recordatorios</h1>
      <p className="text-muted-foreground">Esterilización y recolección de residuos. Cuando se acerca la fecha aparece un aviso en Inicio.</p>
      <ul className="flex flex-col gap-4">
        {tareas.map((t) => {
          const c = calcularTarea(t, hoy);
          return (
            <li key={t.id} data-tarea={t.id} data-estado={c.estado}>
              <Tarjeta>
                <TarjetaTitulo>
                  <Link href={`/tareas/${t.id}`} className="flex min-h-11 items-center justify-between gap-2 underline-offset-4 hover:underline">
                    {t.nombre}
                    <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
                  </Link>
                </TarjetaTitulo>
                <TarjetaContenido className="flex flex-col gap-3">
                  <Estado tipo={TIPO_ESTADO[c.estado]} texto={textoEstado(c)} />
                  {c.estado === "sin_definir" ? (
                    <Link href={`/tareas/${t.id}`} className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">
                      Definir cada cuántos días
                    </Link>
                  ) : (
                    <BotonTareaHecha tareaId={t.id} tipo={t.tipo} grande />
                  )}
                </TarjetaContenido>
              </Tarjeta>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
