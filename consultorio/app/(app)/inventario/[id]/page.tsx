import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { hoyLocal } from "@/lib/inventario/estado";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { historialPrecios } from "@/lib/inventario/precios";
import { cantidadConUnidad, fechaCorta, pesos, SIN_DEFINIR } from "@/lib/inventario/formato";
import { BotonPrimario } from "@/components/ui/boton-primario";
import { Estado, type TipoEstado } from "@/components/ui/estado";
import { Tarjeta, TarjetaContenido, TarjetaTitulo } from "@/components/ui/tarjeta";
import { BotonDarDeBaja } from "./boton-dar-de-baja";
import { FormularioReglas } from "./formulario-reglas";
import { VariacionPrecio } from "@/app/(app)/reportes/precios/variacion-precio";

const NIVEL: Record<"suficiente" | "reserva" | "agotado", { tipo: TipoEstado; texto: string }> = {
  agotado: { tipo: "alerta", texto: "Agotado" },
  reserva: { tipo: "advertencia", texto: "En reserva" },
  suficiente: { tipo: "correcto", texto: "Hay" },
};

const dias = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

export default async function DetalleInsumo(props: PageProps<"/inventario/[id]">) {
  await requireSession();
  const { id: idTexto } = await props.params;
  const id = Number(idTexto);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const hoy = hoyLocal();
  const insumos = await inventarioConEstado(hoy);
  const insumo = insumos.find((i) => i.id === id);
  if (!insumo) notFound();
  const precios = new Map((await historialPrecios(id)).map((p) => [p.loteId, p]));

  const { estado } = insumo;
  const nivel = NIVEL[estado.nivel];
  const caducados = new Set(estado.lotesCaducados.map((l) => l.id));
  const vencidos = new Map(estado.lotesVencidos.filter((l) => !caducados.has(l.id)).map((l) => [l.id, l.venceEl]));
  const porCaducar = new Map(estado.lotesPorCaducar.map((l) => [l.id, l.diasRestantes]));
  const lotes = [...insumo.lotes].sort((a, b) => (a.fechaCompra < b.fechaCompra ? 1 : a.fechaCompra > b.fechaCompra ? -1 : b.id - a.id));
  const nombreVariante = new Map(insumo.variantes.map((v) => [v.id, v.nombre]));

  const reglas: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Unidad", valor: insumo.unidad ?? SIN_DEFINIR },
    { etiqueta: "Reserva mínima", valor: insumo.minimoReserva === null ? SIN_DEFINIR : String(insumo.minimoReserva) },
    { etiqueta: "Aviso de caducidad (días)", valor: insumo.diasAvisoCaducidad === null ? SIN_DEFINIR : String(insumo.diasAvisoCaducidad) },
    { etiqueta: "Vida útil (días)", valor: insumo.vidaUtilDias === null ? SIN_DEFINIR : String(insumo.vidaUtilDias) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/inventario" className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Inventario
        </Link>
        <h1 className="text-2xl font-semibold">{insumo.nombre}</h1>
        <div className="flex flex-wrap items-center gap-3 text-lg">
          <span>
            Quedan {insumo.unidad ? cantidadConUnidad(estado.existenciaUtil, insumo.unidad) : estado.existenciaUtil}
          </span>
          <Estado tipo={nivel.tipo} texto={nivel.texto} />
        </div>
        <BotonPrimario asChild>
          <Link href={`/inventario/compra?insumo=${insumo.id}`}>
            <Plus aria-hidden="true" />
            Registrar compra
          </Link>
        </BotonPrimario>
      </div>

      <Tarjeta>
        <TarjetaTitulo>Reglas</TarjetaTitulo>
        <TarjetaContenido className="flex flex-col gap-6">
          <dl className="grid gap-3 sm:grid-cols-2">
            {reglas.map((r) => (
              <div key={r.etiqueta}>
                <dt className="text-base text-muted-foreground">{r.etiqueta}</dt>
                <dd className="text-lg font-medium">{r.valor}</dd>
              </div>
            ))}
          </dl>
          <FormularioReglas
            insumoId={insumo.id}
            unidad={insumo.unidad}
            minimoReserva={insumo.minimoReserva}
            diasAvisoCaducidad={insumo.diasAvisoCaducidad}
            vidaUtilDias={insumo.vidaUtilDias}
          />
        </TarjetaContenido>
      </Tarjeta>

      <VariacionPrecio insumoId={insumo.id} unidad={insumo.unidad} />

      <Tarjeta>
        <TarjetaTitulo>Lotes y compras</TarjetaTitulo>
        <TarjetaContenido>
          {lotes.length === 0 ? (
            <p className="text-muted-foreground">Todavía no hay compras de este insumo.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {lotes.map((l) => {
                const precio = precios.get(l.id);
                const dif = porCaducar.get(l.id);
                const vence = vencidos.get(l.id);
                return (
                  <li key={l.id} className="flex flex-col gap-2 rounded-xl border border-border p-3" data-lote={l.id}>
                    <p className="text-lg font-semibold">
                      {l.marca ?? "Sin marca"}
                      {l.varianteId !== null && nombreVariante.get(l.varianteId) ? ` · ${nombreVariante.get(l.varianteId)}` : ""}
                    </p>
                    <dl className="grid gap-x-4 gap-y-1 text-base sm:grid-cols-2">
                      <div>
                        <dt className="inline text-muted-foreground">Proveedor: </dt>
                        <dd className="inline">{l.proveedor ?? SIN_DEFINIR}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Presentación: </dt>
                        <dd className="inline">
                          {l.presentacion ?? SIN_DEFINIR}
                          {l.contenidoPorUnidad ? ` (${l.contenidoPorUnidad} piezas por unidad)` : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Compra: </dt>
                        <dd className="inline">{fechaCorta(l.fechaCompra)}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Caducidad: </dt>
                        <dd className="inline">{l.fechaCaducidad ? fechaCorta(l.fechaCaducidad) : "No aplica"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Comprado: </dt>
                        <dd className="inline">{insumo.unidad ? cantidadConUnidad(l.cantidad, insumo.unidad) : l.cantidad}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Queda: </dt>
                        <dd className="inline">{insumo.unidad ? cantidadConUnidad(l.restante, insumo.unidad) : l.restante}</dd>
                      </div>
                      <div>
                        <dt className="inline text-muted-foreground">Precio: </dt>
                        <dd className="inline">
                          {l.precioTotal === null ? SIN_DEFINIR : pesos(l.precioTotal)}
                          {precio ? ` (${pesos(precio.precioUnitario)} por unidad)` : ""}
                        </dd>
                      </div>
                    </dl>
                    {caducados.has(l.id) && l.restante > 0 ? (
                      <>
                        <Estado tipo="alerta" texto={`Caducado${l.fechaCaducidad ? ` el ${fechaCorta(l.fechaCaducidad)}` : ""}: ya no se puede usar`} />
                        <BotonDarDeBaja loteId={l.id} />
                      </>
                    ) : null}
                    {vence && l.restante > 0 ? (
                      <>
                        <Estado tipo="alerta" texto={`Vencido desde el ${fechaCorta(vence)}: pasó su vida útil`} />
                        <BotonDarDeBaja loteId={l.id} />
                      </>
                    ) : null}
                    {dif !== undefined ? <Estado tipo="advertencia" texto={`Caduca en ${dias(dif)}`} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
