import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { nombrePaciente } from "@/lib/clinica/pacientes";
import { contarPorDiente, dientesOrdenados, listarCaidas } from "@/lib/clinica/brackets";
import { fechaCorta } from "@/lib/inventario/formato";
import { Tarjeta, TarjetaContenido, TarjetaTitulo } from "@/components/ui/tarjeta";
import { Odontograma } from "./odontograma";

export const metadata = { title: "Brackets caídos · Consultorio" };

export default async function BracketsPaciente(props: PageProps<"/pacientes/[id]/brackets">) {
  await requireSession();
  const id = Number((await props.params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const nombre = await nombrePaciente(id);
  if (!nombre) notFound();
  const [dientes, caidas] = await Promise.all([dientesOrdenados(), listarCaidas({ pacienteId: id })]);
  const porDiente = contarPorDiente(caidas);
  const conteo = new Map(porDiente.map((c) => [c.clave, c.caidas]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/pacientes/${id}`} className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">
          <ArrowLeft aria-hidden="true" className="size-4" />
          {nombre}
        </Link>
        <h1 className="text-2xl font-semibold">Brackets caídos</h1>
        <p className="text-muted-foreground">Toca el diente del bracket que se cayó. Se registra con la fecha de hoy.</p>
      </div>

      <Odontograma pacienteId={id} dientes={dientes.map((d) => ({ fdi: d.fdi, nombre: d.nombre, caidas: conteo.get(d.fdi) ?? 0 }))} />

      <Tarjeta>
        <TarjetaTitulo>Resumen del paciente</TarjetaTitulo>
        <TarjetaContenido className="flex flex-col gap-3">
          <p className="text-lg" data-total-caidas={caidas.length}>
            {caidas.length === 0 ? "No ha tumbado brackets." : `Ha tumbado ${caidas.length} ${caidas.length === 1 ? "bracket" : "brackets"}.`}
          </p>
          {porDiente.length > 0 ? (
            <ul className="flex flex-col gap-1" aria-label="Caídas por diente">
              {porDiente.map((c) => (
                <li key={c.clave} className="flex justify-between gap-3">
                  <span>{c.nombre}</span>
                  <span className="font-semibold">{c.caidas}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </TarjetaContenido>
      </Tarjeta>

      {caidas.length > 0 ? (
        <Tarjeta>
          <TarjetaTitulo>Historial</TarjetaTitulo>
          <TarjetaContenido>
            <ul className="flex flex-col gap-3">
              {caidas.map((c) => (
                <li key={c.id} className="flex flex-col gap-1 border-b border-border pb-3 last:border-0">
                  <span className="font-medium">
                    {fechaCorta(c.fecha)} · diente {c.dienteFdi}
                  </span>
                  <span className="text-muted-foreground">
                    {c.repuesto ? "Bracket repuesto del inventario" : "Sin reposición registrada"}
                    {c.fotoArchivoId ? " · con foto" : ""}
                  </span>
                  {c.fotoArchivoId ? (
                    <a href={`/api/archivos/${c.fotoArchivoId}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-fit items-center text-primary underline underline-offset-4">
                      Ver foto
                    </a>
                  ) : null}
                  {c.nota ? <span>{c.nota}</span> : null}
                </li>
              ))}
            </ul>
          </TarjetaContenido>
        </Tarjeta>
      ) : null}
    </div>
  );
}
