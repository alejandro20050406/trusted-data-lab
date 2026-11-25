"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { cn } from "cn";
import { BotonUnToque } from "@/components/ui/boton-un-toque";
import { BotonPrimario } from "@/components/ui/boton-primario";
import { Estado, type TipoEstado } from "@/components/ui/estado";
import { Input } from "@/components/ui/input";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { cantidadConUnidad } from "@/lib/inventario/formato";
import { descontarAccion, deshacerConsumoAccion } from "./acciones";

export interface VarianteLista {
  id: number;
  nombre: string;
  colorHex: string | null;
  existencia: number;
}

export interface ItemLista {
  id: number;
  nombre: string;
  unidad: string | null;
  /** Existencia que se puede usar (sin lotes caducados ni vencidos). */
  cantidad: number;
  minimoReserva: number | null;
  tipoVariante: "color" | "diente" | null;
  variantes: VarianteLista[];
}

interface Cambio {
  insumoId: number;
  varianteId: number | null;
  delta: number;
}

type Nivel = "suficiente" | "reserva" | "agotado";

/** Misma regla que `estadoInsumo`, para recalcular el nivel al descontar. */
function nivelDe(cantidad: number, minimoReserva: number | null): Nivel {
  if (cantidad <= 0) return "agotado";
  if (minimoReserva !== null && cantidad <= minimoReserva) return "reserva";
  return "suficiente";
}

const ESTADO_NIVEL: Record<Nivel, { tipo: TipoEstado; texto: string }> = {
  agotado: { tipo: "alerta", texto: "Agotado" },
  reserva: { tipo: "advertencia", texto: "En reserva" },
  suficiente: { tipo: "correcto", texto: "Hay" },
};

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function aplicarCambio(items: ItemLista[], { insumoId, varianteId, delta }: Cambio): ItemLista[] {
  return items.map((i) =>
    i.id !== insumoId
      ? i
      : {
          ...i,
          cantidad: Math.max(0, i.cantidad + delta),
          variantes: i.variantes.map((v) => (v.id === varianteId ? { ...v, existencia: Math.max(0, v.existencia + delta) } : v)),
        },
  );
}

type Panel = { insumoId: number; modo: "variantes" | "varios" } | null;

export function ListaInventario({ items }: { items: ItemLista[] }) {
  const [visibles, aplicar] = useOptimistic(items, aplicarCambio);
  const [busqueda, setBusqueda] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const { mostrar } = useConfirmacion();

  const consulta = normalizar(busqueda);
  const filtrados = consulta === "" ? visibles : visibles.filter((i) => normalizar(i.nombre).includes(consulta));

  function deshacer(grupoId: string, insumoId: number, varianteId: number | null, cantidad: number) {
    return new Promise<void>((resolver) => {
      iniciar(async () => {
        aplicar({ insumoId, varianteId, delta: cantidad });
        const r = await deshacerConsumoAccion(grupoId);
        if (!r.ok) setError(r.error);
        resolver();
      });
    });
  }

  function descontar(item: ItemLista, cantidad: number, varianteId: number | null, nombreVariante?: string) {
    setError(null);
    setPanel(null);
    iniciar(async () => {
      aplicar({ insumoId: item.id, varianteId, delta: -cantidad });
      const r = await descontarAccion({ insumoId: item.id, cantidad, varianteId });
      if (!r.ok) {
        setError(`${item.nombre}: ${r.error}`);
        return;
      }
      const detalle = nombreVariante ? ` (${nombreVariante})` : "";
      mostrar({
        mensaje: `Se descontó ${cantidad} de ${item.nombre}${detalle}`,
        alDeshacer: () => deshacer(r.grupoId, item.id, varianteId, cantidad),
      });
    });
  }

  return (
    <>
      <Input
        type="search"
        aria-label="Buscar insumo"
        placeholder="Buscar insumo"
        autoComplete="off"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="mb-4"
      />
      {error ? (
        <div role="alert" className="mb-4">
          <Estado tipo="alerta" texto={error} />
        </div>
      ) : null}
      {filtrados.length === 0 ? (
        <p className="py-6 text-center text-muted-foreground">No hay insumos con ese nombre</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtrados.map((item) => (
            <FilaInsumo
              key={item.id}
              item={item}
              panel={panel?.insumoId === item.id ? panel.modo : null}
              alAbrir={(modo) => setPanel((actual) => (actual?.insumoId === item.id && actual.modo === modo ? null : { insumoId: item.id, modo }))}
              alDescontar={descontar}
            />
          ))}
        </ul>
      )}
    </>
  );
}

interface PropsFila {
  item: ItemLista;
  panel: "variantes" | "varios" | null;
  alAbrir: (modo: "variantes" | "varios") => void;
  alDescontar: (item: ItemLista, cantidad: number, varianteId: number | null, nombreVariante?: string) => void;
}

function FilaInsumo({ item, panel, alAbrir, alDescontar }: PropsFila) {
  const nivel = ESTADO_NIVEL[nivelDe(item.cantidad, item.minimoReserva)];
  const agotado = item.cantidad <= 0;
  const conVariantes = item.tipoVariante !== null;
  const disponibles = item.variantes.filter((v) => v.existencia > 0);

  return (
    <li data-cantidad={item.cantidad} className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-lg">
          <Link href={`/inventario/${item.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4">
            {item.nombre}
          </Link>
          <span>
            · {item.unidad ? cantidadConUnidad(item.cantidad, item.unidad) : item.cantidad}
          </span>
          {item.unidad ? null : <span className="text-sm text-muted-foreground">· unidad sin definir</span>}
        </p>
        <Estado tipo={nivel.tipo} texto={nivel.texto} />
      </div>
      <div className="flex gap-2">
        <BotonUnToque
          aria-label={`Descontar 1 de ${item.nombre}`}
          disabled={agotado}
          aria-expanded={conVariantes ? panel === "variantes" : undefined}
          onClick={() => (conVariantes ? alAbrir("variantes") : alDescontar(item, 1, null))}
        >
          −1
        </BotonUnToque>
        <BotonUnToque
          aria-label={`Descontar varios de ${item.nombre}`}
          disabled={agotado}
          aria-expanded={panel === "varios"}
          onClick={() => alAbrir("varios")}
        >
          −N
        </BotonUnToque>
      </div>
      {panel === "variantes" ? (
        disponibles.length === 0 ? (
          <p className="text-base text-muted-foreground">
            {item.tipoVariante === "color" ? "No hay colores con existencia." : "No hay brackets con existencia."}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label={item.tipoVariante === "color" ? "Colores disponibles" : "Brackets disponibles"}>
            {disponibles.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  aria-label={`Descontar 1 ${item.tipoVariante === "color" ? "liga" : "bracket"} ${v.nombre}`}
                  onClick={() => alDescontar(item, 1, v.id, v.nombre)}
                  className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg border border-input px-3 text-base hover:bg-muted"
                >
                  {v.colorHex ? (
                    <span aria-hidden="true" className="size-6 shrink-0 rounded-full border border-foreground/40" style={{ backgroundColor: v.colorHex }} />
                  ) : null}
                  <span>{v.nombre}</span>
                  <span className="text-sm text-muted-foreground">({v.existencia})</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {panel === "varios" ? <ControlVarios item={item} disponibles={disponibles} alDescontar={alDescontar} /> : null}
    </li>
  );
}

function ControlVarios({
  item,
  disponibles,
  alDescontar,
}: {
  item: ItemLista;
  disponibles: VarianteLista[];
  alDescontar: PropsFila["alDescontar"];
}) {
  const [cantidad, setCantidad] = useState("");
  const [varianteId, setVarianteId] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const conVariantes = item.tipoVariante !== null;

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const n = Number(cantidad);
    if (!Number.isInteger(n) || n < 1) {
      setAviso("Escribe un número entero mayor que cero.");
      return;
    }
    if (conVariantes) {
      const elegida = disponibles.find((v) => String(v.id) === varianteId);
      if (!elegida) {
        setAviso(item.tipoVariante === "color" ? "Elige el color." : "Elige el bracket.");
        return;
      }
      alDescontar(item, n, elegida.id, elegida.nombre);
      return;
    }
    alDescontar(item, n, null);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2" noValidate>
      <div className="flex flex-wrap items-center gap-2">
        {conVariantes ? (
          <select
            aria-label={item.tipoVariante === "color" ? `Color de ${item.nombre}` : `Bracket de ${item.nombre}`}
            value={varianteId}
            onChange={(e) => setVarianteId(e.target.value)}
            className={cn("h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-base")}
          >
            <option value="">{item.tipoVariante === "color" ? "Elige el color" : "Elige el bracket"}</option>
            {disponibles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre} ({v.existencia})
              </option>
            ))}
          </select>
        ) : null}
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          aria-label={`Cantidad a descontar de ${item.nombre}`}
          placeholder="Cantidad"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="w-28"
          autoFocus
        />
        <BotonPrimario type="submit" aria-label={`Descontar cantidad de ${item.nombre}`} className="w-auto">
          Descontar
        </BotonPrimario>
      </div>
      {aviso ? <p className="text-base text-alerta">{aviso}</p> : null}
    </form>
  );
}
