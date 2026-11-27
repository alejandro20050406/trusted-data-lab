import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { COBERTURA_DIAS, reporteColoresActual } from "@/lib/reportes/colores";
import { Estado } from "@/components/ui/estado";
import { Tarjeta, TarjetaContenido, TarjetaTitulo } from "@/components/ui/tarjeta";
import { leerPeriodo, SelectorPeriodo } from "../selector-periodo";

export const metadata = { title: "Colores de ligas · Consultorio" };

export default async function ReporteColores(props: PageProps<"/reportes/colores">) {
  await requireSession();
  const dias = leerPeriodo((await props.searchParams).dias, 90);
  const reportes = await reporteColoresActual(dias);
  const periodo = dias === 365 ? "el último año" : `los últimos ${dias} días`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/reportes" className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Reportes
        </Link>
        <h1 className="text-2xl font-semibold">Colores de ligas más usados</h1>
        <SelectorPeriodo ruta="/reportes/colores" actual={dias} />
        <p className="text-muted-foreground">
          Consumo de {periodo}. La compra sugerida cubre {COBERTURA_DIAS} días al mismo ritmo, menos lo que ya tienes.
        </p>
      </div>

      {reportes.length === 0 ? <Estado tipo="neutro" texto={`No hay consumos de ligas por color en ${periodo}.`} /> : null}

      {reportes.map((r) => {
        const max = Math.max(...r.filas.map((f) => f.cantidad));
        return (
          <Tarjeta key={r.insumoId} data-insumo={r.insumoId}>
            <TarjetaTitulo>
              {r.insumo} · {r.total} usadas
            </TarjetaTitulo>
            <TarjetaContenido className="flex flex-col gap-4">
              <ol className="flex flex-col gap-3" aria-label={`Consumo por color de ${r.insumo}`}>
                {r.filas.map((f) => (
                  <li key={f.varianteId} className="flex flex-col gap-1" data-color={f.nombre}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-medium">
                        <span aria-hidden="true" className="inline-block size-5 shrink-0 rounded-full border border-border" style={{ backgroundColor: f.colorHex ?? "transparent" }} />
                        {f.nombre}
                      </span>
                      <span className="tabular-nums">
                        <span className="font-semibold" data-cantidad={f.cantidad}>
                          {f.cantidad}
                        </span>{" "}
                        <span className="text-muted-foreground" data-porcentaje={f.porcentaje}>
                          ({f.porcentaje.toFixed(1)} %)
                        </span>
                      </span>
                    </div>
                    <div aria-hidden="true" className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${(f.cantidad / max) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ol>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-base">
                  <caption className="mb-2 text-left font-semibold">Compra sugerida</caption>
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">Color</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Tienes</th>
                      <th scope="col" className="py-2 text-right font-medium">Comprar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.filas.map((f) => (
                      <tr key={f.varianteId} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3">{f.nombre}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{f.existencia}</td>
                        <td className="py-2 text-right font-semibold tabular-nums" data-sugerido={f.sugerido}>
                          {f.sugerido === 0 ? "Alcanza" : f.sugerido}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TarjetaContenido>
          </Tarjeta>
        );
      })}
    </div>
  );
}
