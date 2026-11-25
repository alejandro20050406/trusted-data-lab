import Link from "next/link";
import { requireSession } from "@/lib/sesion";
import { agruparBracketsPorDiente, catalogoDientes, insumoBrackets } from "@/lib/inventario/brackets";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { hoyLocal } from "@/lib/inventario/estado";
import { NOMBRE_SISTEMA } from "@/lib/inventario/variantes";
import { Button } from "@/components/ui/button";
import { Estado } from "@/components/ui/estado";

export const metadata = { title: "Brackets por diente · Consultorio" };

export default async function PaginaBrackets() {
  await requireSession();
  const brackets = await insumoBrackets();
  if (!brackets) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Brackets por diente</h1>
        <Estado tipo="neutro" texto="No hay un insumo de brackets configurado." />
      </div>
    );
  }
  const [dientes, inventario] = await Promise.all([catalogoDientes(), inventarioConEstado(hoyLocal())]);
  const variantes = inventario.find((i) => i.id === brackets.id)?.variantes ?? [];
  const arcadas = agruparBracketsPorDiente(dientes, variantes);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Brackets por diente</h1>
        <p className="text-muted-foreground">Cuántos quedan para cada diente, por sistema y slot.</p>
      </div>
      {arcadas.map((a) => (
        <section key={a.arcada} aria-labelledby={`arcada-${a.arcada}`} className="flex flex-col gap-3">
          <h2 id={`arcada-${a.arcada}`} className="text-xl font-semibold">
            Arcada {a.arcada}
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {a.dientes.map((d) => (
              <li key={d.fdi} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-fdi={d.fdi}>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {d.fdi} · {d.nombre}
                  </span>
                  {d.variantes.length === 0 ? (
                    <span className="text-muted-foreground">Sin registrar</span>
                  ) : (
                    <ul className="text-muted-foreground">
                      {d.variantes.map((v) => (
                        <li key={v.id}>
                          {v.sistema ? NOMBRE_SISTEMA[v.sistema] : ""} slot {v.slot}: {v.existencia}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="min-w-16 text-right font-semibold" aria-label={`Quedan ${d.total} para el diente ${d.fdi}`}>
                    {d.total}
                  </span>
                  <Button asChild variant="outline">
                    <Link href={`/inventario/compra?insumo=${brackets.id}&diente=${d.fdi}`} aria-label={`Registrar brackets del diente ${d.fdi}`}>
                      Registrar
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
