import { asc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/sesion";
import { getDb } from "@/lib/db";
import { insumo } from "@/lib/db/schema";
import { buscarProductos, vinculos } from "@/lib/observatorio/correspondencias";
import { contarPreciosReferencia } from "@/lib/observatorio/importar";
import { pesos } from "@/lib/inventario/formato";
import { Button } from "@/components/ui/button";
import { Estado } from "@/components/ui/estado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { desvincular, vincular } from "./acciones";

export const metadata = { title: "Precios de referencia · Consultorio" };

const fecha = (d: Date) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" }).format(d);

export default async function PaginaObservatorio({ searchParams }: PageProps<"/mas/observatorio">) {
  await requireSession();
  const { q } = await searchParams;
  const texto = typeof q === "string" ? q.slice(0, 80) : "";
  const [total, insumos, actuales, resultados] = await Promise.all([
    contarPreciosReferencia(),
    getDb().select({ id: insumo.id, nombre: insumo.nombre }).from(insumo).where(eq(insumo.activo, true)).orderBy(asc(insumo.nombre)),
    vinculos(),
    texto ? buscarProductos(texto) : Promise.resolve([]),
  ]);
  const nombreInsumo = new Map(insumos.map((i) => [i.id, i.nombre]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Precios de referencia</h1>
        <p className="text-muted-foreground">
          Vincula cada insumo con productos del observatorio. Revisa marca y presentación antes de vincular: la correspondencia se hace a mano.
        </p>
      </div>

      {total === 0 ? (
        <Estado tipo="neutro" texto="Aún no hay precios importados del observatorio." />
      ) : (
        <p>{total} precios importados.</p>
      )}

      <section aria-labelledby="titulo-vinculos" className="flex flex-col gap-3">
        <h2 id="titulo-vinculos" className="text-xl font-semibold">
          Vinculados
        </h2>
        {actuales.length === 0 ? (
          <p className="text-muted-foreground">Ningún insumo vinculado.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {actuales.map((v) => (
              <li key={v.id} className="flex flex-col gap-2 px-4 py-3">
                <span className="font-medium">{nombreInsumo.get(v.insumoId)}</span>
                <span>
                  {v.producto} · {pesos(v.precio)} en {v.tienda}, capturado el {fecha(v.fechaCaptura)}
                </span>
                <form action={desvincular}>
                  <input type="hidden" name="id" value={v.id} />
                  <Button type="submit" variant="outline" aria-label={`Quitar vínculo de ${v.producto}`}>
                    Quitar
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-buscar" className="flex flex-col gap-3">
        <h2 id="titulo-buscar" className="text-xl font-semibold">
          Buscar producto
        </h2>
        <form className="flex flex-col gap-2 sm:flex-row sm:items-end" role="search">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="q">Nombre del producto</Label>
            <Input id="q" name="q" defaultValue={texto} placeholder="Ej. ligas intraorales" />
          </div>
          <Button type="submit">Buscar</Button>
        </form>
        {texto && resultados.length === 0 ? <p>No hay productos con ese nombre.</p> : null}
        <ul className="flex flex-col gap-3">
          {resultados.map((p) => (
            <li key={p.url} className="flex flex-col gap-2 rounded-xl border border-border px-4 py-3">
              <span className="font-medium">{p.producto}</span>
              <span>
                {pesos(p.precio)} en {p.tienda}, capturado el {fecha(p.fechaCaptura)}
              </span>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center text-primary underline">
                Ver en la tienda
              </a>
              <form action={vincular} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <input type="hidden" name="url" value={p.url} />
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor={`insumo-${p.url}`}>Insumo</Label>
                  <select id={`insumo-${p.url}`} name="insumoId" required className="h-11 rounded-lg border border-input bg-background px-3 text-base">
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit">Vincular</Button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
