import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Image as IconoImagen, Phone, Repeat, Stethoscope } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { fichaPaciente, reagendaFrecuente } from "@/lib/clinica/pacientes";
import { fechaHoraLegible, fechaHoraLocal, haceTiempo } from "@/lib/clinica/fechas";
import { listarArchivos, tamanoLegible } from "@/lib/archivos/archivos";
import { NOMBRE_TIPO_ARCHIVO } from "@/lib/archivos/tipos";
import { hoyLocal } from "@/lib/inventario/estado";
import { fechaCorta } from "@/lib/inventario/formato";
import { Button } from "@/components/ui/button";
import { Estado } from "@/components/ui/estado";
import { Tarjeta, TarjetaContenido, TarjetaTitulo } from "@/components/ui/tarjeta";
import { FormularioPaciente } from "../formulario-paciente";
import { CitaPendiente } from "./cita-pendiente";
import { Escanear } from "./escanear";
import { ProgramarCita } from "./programar-cita";

export const metadata = { title: "Paciente · Consultorio" };

const ESTADO_CITA = {
  programada: "Programada",
  atendida: "Atendida",
  reagendada: "Reagendada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
} as const;

export default async function FichaPaciente(props: PageProps<"/pacientes/[id]">) {
  await requireSession();
  const id = Number((await props.params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [ficha, archivos] = await Promise.all([fichaPaciente(id), listarArchivos(id)]);
  if (!ficha) notFound();
  const hoy = hoyLocal();
  const ultima = ficha.ultimaVisita ? fechaHoraLocal(ficha.ultimaVisita).fecha : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/pacientes" className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Pacientes
        </Link>
        <h1 className="text-2xl font-semibold">{ficha.nombre}</h1>
        <div className="flex flex-col gap-1 text-lg">
          <p data-ultima-visita>
            <span className="text-muted-foreground">Última visita: </span>
            {ultima ? `${haceTiempo(ultima, hoy)} (${fechaCorta(ultima)})` : "sin visitas registradas"}
          </p>
          <p data-veces-reagendada>
            <span className="text-muted-foreground">Veces que reagendó: </span>
            {ficha.vecesReagendada}
          </p>
          {ficha.telefono ? (
            <a href={`tel:${ficha.telefono.replace(/[^0-9+]/g, "")}`} className="inline-flex min-h-11 w-fit items-center gap-2 text-primary underline underline-offset-4">
              <Phone aria-hidden="true" className="size-4" />
              {ficha.telefono}
            </a>
          ) : null}
          {ficha.notas ? <p className="text-muted-foreground">{ficha.notas}</p> : null}
        </div>
        {reagendaFrecuente(ficha.vecesReagendada) ? (
          <Estado tipo="advertencia" texto={`Reagenda seguido: ${ficha.vecesReagendada} veces`} />
        ) : null}
      </div>

      <Tarjeta>
        <TarjetaTitulo>Cita</TarjetaTitulo>
        <TarjetaContenido className="flex flex-col gap-4">
          {ficha.citaPendiente ? (
            <CitaPendiente
              pacienteId={ficha.id}
              citaId={ficha.citaPendiente.id}
              textoFecha={fechaHoraLegible(ficha.citaPendiente.fechaHora)}
              hora={fechaHoraLocal(ficha.citaPendiente.fechaHora).hora}
              hoy={hoy}
            />
          ) : (
            <>
              <p className="text-muted-foreground">No tiene cita programada.</p>
              <ProgramarCita pacienteId={ficha.id} hoy={hoy} />
            </>
          )}
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaTitulo>Archivos</TarjetaTitulo>
        <TarjetaContenido className="flex flex-col gap-4">
          <Escanear pacienteId={ficha.id} />
          {archivos.length === 0 ? (
            <p className="text-muted-foreground">Todavía no hay archivos escaneados.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border" aria-label="Archivos del paciente">
              {archivos.map((a) => (
                <li key={a.id} data-archivo={a.id}>
                  <a
                    href={`/api/archivos/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-14 items-center gap-3 px-4 py-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {a.tipoContenido === "application/pdf" ? (
                      <FileText aria-hidden="true" className="size-5 shrink-0 text-primary" />
                    ) : (
                      <IconoImagen aria-hidden="true" className="size-5 shrink-0 text-primary" />
                    )}
                    <span className="flex flex-col">
                      <span className="font-medium">{a.nombre}</span>
                      <span className="text-muted-foreground">
                        {NOMBRE_TIPO_ARCHIVO[a.tipo]} · {a.tipoContenido === "application/pdf" ? "PDF" : "Foto"} · {tamanoLegible(a.tamanoBytes)}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaTitulo>Brackets caídos</TarjetaTitulo>
        <TarjetaContenido className="flex flex-col gap-3">
          <Button asChild size="lg" variant="outline" className="h-14 justify-start text-lg">
            <Link href={`/pacientes/${ficha.id}/brackets`}>
              <Stethoscope aria-hidden="true" />
              Registrar bracket caído
            </Link>
          </Button>
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaTitulo>Historial de citas</TarjetaTitulo>
        <TarjetaContenido>
          {ficha.citas.length === 0 ? (
            <p className="text-muted-foreground">Sin citas.</p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Historial de citas">
              {ficha.citas.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2" data-estado={c.estado}>
                  <span>{fechaHoraLegible(c.fechaHora)}</span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    {c.estado === "reagendada" ? <Repeat aria-hidden="true" className="size-4" /> : null}
                    {ESTADO_CITA[c.estado]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TarjetaContenido>
      </Tarjeta>

      <details className="rounded-xl border border-border p-4">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">Editar datos del paciente</summary>
        <div className="mt-3">
          <FormularioPaciente paciente={{ id: ficha.id, nombre: ficha.nombre, telefono: ficha.telefono, notas: ficha.notas }} />
        </div>
      </details>
    </div>
  );
}
