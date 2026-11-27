import { historialPrecios } from "@/lib/inventario/precios";
import { fechaCorta, pesos } from "@/lib/inventario/formato";
import { resumenVariacion, textoCambio } from "@/lib/reportes/precios";
import { Estado } from "@/components/ui/estado";
import { Tarjeta, TarjetaContenido, TarjetaTitulo } from "@/components/ui/tarjeta";
import { GraficaPrecio } from "./grafica-precio";

/**
 * Bloque "Variación de precio" (D-13) para el detalle del insumo: último
 * precio, mínimo, cambio respecto a la compra anterior, gráfica y tabla.
 */
export async function VariacionPrecio({ insumoId, unidad }: { insumoId: number; unidad: string | null }) {
  const r = resumenVariacion(await historialPrecios(insumoId));
  const sufijo = r.base === "pieza" ? "por pieza" : unidad ? `por ${unidad}` : "por unidad";

  return (
    <Tarjeta data-variacion-precio>
      <TarjetaTitulo>Variación de precio</TarjetaTitulo>
      <TarjetaContenido className="flex flex-col gap-4">
        {r.puntos.length === 0 ? (
          <Estado tipo="neutro" texto="Registra compras con precio para ver cómo cambia." />
        ) : r.puntos.length === 1 ? (
          <Estado tipo="neutro" texto={`Solo hay una compra (${pesos(r.ultimo!.precio)} ${sufijo}). Con la siguiente compra se verá la variación.`} />
        ) : (
          <>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Último precio</dt>
                <dd className="text-xl font-semibold tabular-nums" data-ultimo>
                  {pesos(r.ultimo!.precio)} <span className="text-base font-normal">{sufijo}</span>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Mínimo</dt>
                <dd className="text-xl font-semibold tabular-nums" data-minimo>
                  {pesos(r.minimo!.precio)} <span className="text-base font-normal">({r.minimo!.proveedor})</span>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Contra la compra anterior</dt>
                <dd className="text-xl font-semibold tabular-nums" data-cambio={r.cambioPct}>
                  {textoCambio(r.cambioPct!)} <span className="text-base font-normal">{r.cambioPct! > 0 ? "más caro" : r.cambioPct! < 0 ? "más barato" : ""}</span>
                </dd>
              </div>
            </dl>
            <GraficaPrecio puntos={r.puntos} series={r.series} unidad={sufijo} />
          </>
        )}
        {r.puntos.length > 0 ? (
          <details open={r.puntos.length <= 3}>
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">Tabla de compras</summary>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base">
                <caption className="sr-only">Precio {sufijo} de cada compra</caption>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Fecha</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Proveedor</th>
                    <th scope="col" className="py-2 text-right font-medium">Precio {sufijo}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...r.puntos].reverse().map((p) => (
                    <tr key={p.loteId} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{fechaCorta(p.fecha)}</td>
                      <td className="py-2 pr-3">{p.proveedor}</td>
                      <td className="py-2 text-right tabular-nums">{pesos(p.precio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </TarjetaContenido>
    </Tarjeta>
  );
}
