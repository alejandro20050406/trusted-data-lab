import Link from "next/link";
import { requireSession } from "@/lib/sesion";
import { avisosPendientes, type Aviso } from "@/lib/avisos";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { hoyLocal } from "@/lib/inventario/estado";
import { cantidadConUnidad, fechaCorta } from "@/lib/inventario/formato";
import { actualizarAvisosInventario } from "@/lib/inventario/generar-avisos";
import { Button } from "@/components/ui/button";
import { Estado, type TipoEstado } from "@/components/ui/estado";
import { Tarjeta, TarjetaContenido } from "@/components/ui/tarjeta";
import { marcarAvisoHecho } from "./acciones";
import { sincronizarAvisosTareas, tareaDeAviso } from "@/lib/clinica/tareas";
import { BotonTareaHecha } from "./tareas/boton-tarea-hecha";

export const metadata = { title: "Inicio · Consultorio" };

const TIPO_POR_PRIORIDAD: Record<Aviso["prioridad"], TipoEstado> = { alta: "alerta", media: "advertencia", baja: "neutro" };
const TEXTO_PRIORIDAD: Record<Aviso["prioridad"], string> = { alta: "Urgente", media: "Pronto", baja: "Aviso" };

function textoAccion(a: Aviso): string {
  if (a.tipo === "reserva_baja" || a.tipo === "agotado") return "Registrar compra";
  if (a.origen === "inventario") return "Ver insumo";
  if (a.origen === "esterilizacion" || a.origen === "residuos") return "Ver recordatorio";
  return "Abrir";
}

function TarjetaAviso({ aviso }: { aviso: Aviso }) {
  const [primera, ...resto] = (aviso.detalle ?? "").split("\n");
  const tareaId = tareaDeAviso(aviso);
  return (
    <li>
      <Tarjeta className="gap-3 py-4" data-prioridad={aviso.prioridad}>
        <TarjetaContenido className="flex flex-col gap-2">
          <Estado tipo={TIPO_POR_PRIORIDAD[aviso.prioridad]} texto={`${TEXTO_PRIORIDAD[aviso.prioridad]}: ${aviso.titulo}`} />
          {primera ? <p>{primera}</p> : null}
          {resto.length > 0 ? (
            <div className="flex flex-col gap-1 text-muted-foreground">
              {resto.map((linea) => (
                <p key={linea}>{linea}</p>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {aviso.urlAccion ? (
              <Button asChild>
                <Link href={aviso.urlAccion}>{textoAccion(aviso)}</Link>
              </Button>
            ) : null}
            {tareaId !== null ? (
              // Avisos de esterilización y residuos: un toque registra la tarea hecha hoy y cierra el aviso.
              <BotonTareaHecha tareaId={tareaId} tipo={aviso.origen as "esterilizacion" | "residuos"} variante="outline" />
            ) : (
              <form action={marcarAvisoHecho}>
                <input type="hidden" name="id" value={aviso.id} />
                <Button type="submit" variant="outline">
                  Marcar como hecho
                </Button>
              </form>
            )}
          </div>
        </TarjetaContenido>
      </Tarjeta>
    </li>
  );
}

export default async function Inicio() {
  await requireSession();
  const hoy = hoyLocal();
  await actualizarAvisosInventario(hoy);
  await sincronizarAvisosTareas(hoy);
  const [avisos, inventario] = await Promise.all([avisosPendientes(), inventarioConEstado(hoy)]);
  const porReponer = inventario.filter((i) => i.estado.nivel !== "suficiente" && (i.estado.reservaDefinida || i.lotes.length > 0));
  const porCaducar = inventario
    .flatMap((i) => i.estado.lotesPorCaducar.map((l) => ({ insumo: i, lote: l })))
    .sort((a, b) => a.lote.diasRestantes - b.lote.diasRestantes);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Inicio</h1>

      <section aria-labelledby="titulo-avisos" className="flex flex-col gap-3">
        <h2 id="titulo-avisos" className="text-xl font-semibold">
          Avisos pendientes{avisos.length > 0 ? ` (${avisos.length})` : ""}
        </h2>
        {avisos.length === 0 ? (
          <Estado tipo="correcto" texto="No hay avisos pendientes." />
        ) : (
          <ul className="flex flex-col gap-3">
            {avisos.map((a) => (
              <TarjetaAviso key={a.id} aviso={a} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-reponer" className="flex flex-col gap-3">
        <h2 id="titulo-reponer" className="text-xl font-semibold">
          En reserva o agotados
        </h2>
        {porReponer.length === 0 ? (
          <Estado tipo="correcto" texto="Nada por reponer." />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {porReponer.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <Link href={`/inventario/${i.id}`} className="flex min-h-11 items-center font-medium underline-offset-4 hover:underline">
                  {i.nombre} · {cantidadConUnidad(i.estado.existenciaUtil, i.unidad)}
                </Link>
                <Estado
                  tipo={i.estado.nivel === "agotado" ? "alerta" : "advertencia"}
                  texto={i.estado.nivel === "agotado" ? "Agotado" : "En reserva"}
                  className="py-1"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-caducar" className="flex flex-col gap-3">
        <h2 id="titulo-caducar" className="text-xl font-semibold">
          Por caducar
        </h2>
        {porCaducar.length === 0 ? (
          <Estado tipo="correcto" texto="Ningún lote por caducar." />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {porCaducar.map(({ insumo, lote }) => (
              <li key={lote.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <Link href={`/inventario/${insumo.id}`} className="flex min-h-11 items-center font-medium underline-offset-4 hover:underline">
                  {insumo.nombre} · {cantidadConUnidad(lote.restante, insumo.unidad)}
                </Link>
                <span className="text-right">
                  {lote.diasRestantes === 0 ? "Caduca hoy" : `Caduca el ${fechaCorta(lote.fechaCaducidad!)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
