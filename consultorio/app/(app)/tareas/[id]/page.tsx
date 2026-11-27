import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { calcularTarea, historialTarea, obtenerTarea, textoEstado } from "@/lib/clinica/tareas";
import { hoyLocal } from "@/lib/inventario/estado";
import { fechaCorta, SIN_DEFINIR } from "@/lib/inventario/formato";
import { Estado } from "@/components/ui/estado";
import { Tarjeta, TarjetaContenido, TarjetaTitulo } from "@/components/ui/tarjeta";
import { BotonTareaHecha } from "../boton-tarea-hecha";
import { TIPO_ESTADO } from "../estado-tarea";
import { DetalleRealizacion } from "./detalle-realizacion";
import { FormularioPeriodicidad } from "./formulario-periodicidad";

export const metadata = { title: "Recordatorio · Consultorio" };

export default async function DetalleTarea(props: PageProps<"/tareas/[id]">) {
  await requireSession();
  const id = Number((await props.params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const tarea = await obtenerTarea(id);
  if (!tarea) notFound();
  const hoy = hoyLocal();
  const c = calcularTarea(tarea, hoy);
  const historial = await historialTarea(id);
  const esEsterilizacion = tarea.tipo === "esterilizacion";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/tareas" className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Recordatorios
        </Link>
        <h1 className="text-2xl font-semibold">{tarea.nombre}</h1>
        <Estado tipo={TIPO_ESTADO[c.estado]} texto={textoEstado(c)} />
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Próxima fecha</dt>
            <dd className="text-lg font-medium" data-proxima={c.proximaFecha ?? ""}>
              {c.proximaFecha ? fechaCorta(c.proximaFecha) : SIN_DEFINIR}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Última vez</dt>
            <dd className="text-lg font-medium">{tarea.ultimaRealizacion ? fechaCorta(tarea.ultimaRealizacion) : "Sin registro"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Se repite</dt>
            <dd className="text-lg font-medium">{tarea.cadaDias ? `cada ${tarea.cadaDias} días` : SIN_DEFINIR}</dd>
          </div>
        </dl>
        <BotonTareaHecha tareaId={tarea.id} tipo={tarea.tipo} grande />
        <DetalleRealizacion tareaId={tarea.id} tipo={tarea.tipo} hoy={hoy} />
      </div>

      <Tarjeta>
        <TarjetaTitulo>Historial</TarjetaTitulo>
        <TarjetaContenido>
          {historial.length === 0 ? (
            <p className="text-muted-foreground">Todavía no hay registros.</p>
          ) : (
            <ul className="flex flex-col gap-3" aria-label="Historial de la tarea">
              {historial.map((h) => (
                <li key={h.id} className="flex flex-col border-b border-border pb-2 last:border-0">
                  <span className="font-medium">{fechaCorta(h.fecha)}</span>
                  {h.detalle ? <span>{h.detalle}</span> : null}
                  {h.comprobante ? <span>Comprobante: {h.comprobante}</span> : null}
                  {h.nota ? <span className="text-muted-foreground">{h.nota}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaTitulo>Periodicidad</TarjetaTitulo>
        <TarjetaContenido className="flex flex-col gap-3">
          {esEsterilizacion && tarea.cadaDias === null ? (
            <p className="text-muted-foreground">Define con qué frecuencia se esteriliza para recibir avisos.</p>
          ) : null}
          <FormularioPeriodicidad tareaId={tarea.id} cadaDias={tarea.cadaDias} diasAnticipacion={tarea.diasAnticipacion} />
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
