import { requireSession } from "@/lib/sesion";
import { contarPorDiente, contarPorPaciente, enUltimosDias, listarCaidas } from "@/lib/clinica/brackets";
import { hoyLocal, sumarDias } from "@/lib/inventario/estado";
import { fechaCorta } from "@/lib/inventario/formato";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Estado } from "@/components/ui/estado";
import { Tarjeta, TarjetaContenido, TarjetaTitulo } from "@/components/ui/tarjeta";
import { leerPeriodo, SelectorPeriodo } from "../selector-periodo";

export const metadata = { title: "Reporte de brackets caídos · Consultorio" };

function Ranking({ titulo, filas, etiqueta }: { titulo: string; filas: { clave: number; nombre: string; caidas: number; href?: string }[]; etiqueta: string }) {
  const max = Math.max(1, ...filas.map((f) => f.caidas));
  return (
    <Tarjeta>
      <TarjetaTitulo>{titulo}</TarjetaTitulo>
      <TarjetaContenido>
        {filas.length === 0 ? (
          <p className="text-muted-foreground">Sin caídas en este periodo.</p>
        ) : (
          <ol className="flex flex-col gap-3" aria-label={etiqueta}>
            {filas.slice(0, 10).map((f) => (
              <li key={f.clave} className="flex flex-col gap-1" data-clave={f.clave}>
                <div className="flex justify-between gap-3">
                  {f.href ? (
                    <Link href={f.href} className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">
                      {f.nombre}
                    </Link>
                  ) : (
                    <span className="font-medium">{f.nombre}</span>
                  )}
                  <span className="font-semibold tabular-nums" data-caidas={f.caidas}>
                    {f.caidas}
                  </span>
                </div>
                <div aria-hidden="true" className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${(f.caidas / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </TarjetaContenido>
    </Tarjeta>
  );
}

export default async function ReporteBrackets(props: PageProps<"/reportes/brackets">) {
  await requireSession();
  const dias = leerPeriodo((await props.searchParams).dias, 90);
  const hoy = hoyLocal();
  const todas = await listarCaidas({ desde: sumarDias(hoy, -(dias - 1)) });
  const periodo = enUltimosDias(todas, hoy, dias);
  const porDiente = contarPorDiente(periodo);
  const porPaciente = contarPorPaciente(periodo).map((p) => ({ ...p, href: `/pacientes/${p.clave}/brackets` }));
  const conFoto = periodo.filter((c) => c.fotoArchivoId !== null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/reportes" className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Reportes
        </Link>
        <h1 className="text-2xl font-semibold">Brackets caídos</h1>
        <SelectorPeriodo ruta="/reportes/brackets" actual={dias} />
        <p className="text-lg" data-total={periodo.length}>
          {periodo.length} {periodo.length === 1 ? "caída" : "caídas"} en {dias === 365 ? "el último año" : `los últimos ${dias} días`}.
        </p>
      </div>

      {periodo.length === 0 ? <Estado tipo="correcto" texto="No se registraron brackets caídos en este periodo." /> : null}

      <Ranking titulo="Dientes que se caen más" etiqueta="Dientes con más caídas" filas={porDiente} />
      <Ranking titulo="Pacientes con más caídas" etiqueta="Pacientes con más caídas" filas={porPaciente} />

      <Tarjeta>
        <TarjetaTitulo>Evidencia fotográfica</TarjetaTitulo>
        <TarjetaContenido>
          {conFoto.length === 0 ? (
            <p className="text-muted-foreground">Sin fotos en este periodo.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Galería de brackets caídos">
              {conFoto.map((c) => (
                <li key={c.id} className="flex flex-col gap-1">
                  <a href={`/api/archivos/${c.fotoArchivoId}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-border">
                    {/* Imagen privada servida con URL firmada de 60 s; no pasa por el optimizador de Next. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/archivos/${c.fotoArchivoId}?origen=galeria`}
                      alt={`Bracket caído del diente ${c.dienteFdi}, ${c.pacienteNombre}, ${fechaCorta(c.fecha)}`}
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  </a>
                  <span className="text-sm">
                    {c.dienteFdi} · {c.pacienteNombre} · {fechaCorta(c.fecha)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
