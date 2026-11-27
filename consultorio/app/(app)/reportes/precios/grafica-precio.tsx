"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Gráfica de línea del precio por fecha y proveedor (D-13). Una línea por
 * proveedor (máximo 3 y "Otros proveedores" en gris). La identidad nunca va
 * solo en el color: hay leyenda con nombre, forma distinta de marcador y la
 * tabla de respaldo debajo.
 *
 * Colores: azul primario de Angel + naranja y aqua de la paleta categórica de
 * referencia; validados con el script de dataviz (CVD ΔE 9.2 en todos los
 * pares, fondo blanco). El aqua queda bajo 3:1, por eso siempre hay tabla.
 */
const COLORES = ["#1D4ED8", "#EB6834", "#1BAF7A"];
const GRIS_OTROS = "#64748B";
const FORMAS = ["circle", "square", "diamond", "triangle"] as const;

export interface PuntoGrafica {
  fecha: string;
  serie: string;
  proveedor: string;
  precio: number;
  presentacion: string | null;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const aTiempo = (f: string) => Date.parse(`${f}T12:00:00Z`);
const fechaCorta = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
};
const pesos = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: n < 10 ? 2 : 0 }).format(n);

function Marcador({ cx, cy, color, forma }: { cx?: number; cy?: number; color: string; forma: (typeof FORMAS)[number] }) {
  if (cx === undefined || cy === undefined || Number.isNaN(cx) || Number.isNaN(cy)) return null;
  const comun = { fill: color, stroke: "#FFFFFF", strokeWidth: 2 };
  if (forma === "square") return <rect x={cx - 5} y={cy - 5} width={10} height={10} rx={1} {...comun} />;
  if (forma === "diamond") return <polygon points={`${cx},${cy - 6} ${cx + 6},${cy} ${cx},${cy + 6} ${cx - 6},${cy}`} {...comun} />;
  if (forma === "triangle") return <polygon points={`${cx},${cy - 6} ${cx + 6},${cy + 5} ${cx - 6},${cy + 5}`} {...comun} />;
  return <circle cx={cx} cy={cy} r={5} {...comun} />;
}

interface Fila {
  t: number;
  punto: PuntoGrafica;
  [serie: string]: number | PuntoGrafica | null;
}

function Ayuda({ active, payload, unidad }: { active?: boolean; payload?: { payload: Fila }[]; unidad: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload.punto;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-base shadow-md">
      <p className="font-semibold">{pesos(p.precio)} {unidad}</p>
      <p>{p.proveedor}</p>
      <p className="text-muted-foreground">{fechaCorta(aTiempo(p.fecha))}</p>
      {p.presentacion ? <p className="text-muted-foreground">{p.presentacion}</p> : null}
    </div>
  );
}

export function GraficaPrecio({ puntos, series, unidad }: { puntos: PuntoGrafica[]; series: string[]; unidad: string }) {
  const color = (s: string, i: number) => (s === "Otros proveedores" ? GRIS_OTROS : COLORES[i] ?? GRIS_OTROS);
  const filas: Fila[] = puntos.map((p) => {
    const fila: Fila = { t: aTiempo(p.fecha), punto: p };
    for (const s of series) fila[s] = s === p.serie ? p.precio : null;
    return fila;
  });
  const precios = puntos.map((p) => p.precio);
  const min = Math.min(...precios);
  const max = Math.max(...precios);
  const margen = Math.max((max - min) * 0.15, max * 0.05);

  return (
    <figure className="flex flex-col gap-2" aria-label={`Gráfica del precio ${unidad} por fecha y proveedor`}>
      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Proveedores">
          {series.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <svg width="22" height="12" aria-hidden="true">
                <line x1="0" y1="6" x2="22" y2="6" stroke={color(s, i)} strokeWidth="2" />
                <Marcador cx={11} cy={6} color={color(s, i)} forma={FORMAS[i] ?? "circle"} />
              </svg>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="h-64 w-full" role="img" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filas} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#E2E8F0" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin - 86400000", "dataMax + 86400000"]}
              tickFormatter={fechaCorta}
              tick={{ fill: "#475569", fontSize: 13 }}
              stroke="#CBD5E1"
              minTickGap={24}
            />
            <YAxis
              domain={[Math.max(0, min - margen), max + margen]}
              tickFormatter={(v: number) => pesos(v)}
              tick={{ fill: "#475569", fontSize: 13 }}
              stroke="#CBD5E1"
              width={72}
            />
            <Tooltip content={<Ayuda unidad={unidad} />} cursor={{ stroke: "#94A3B8", strokeWidth: 1 }} />
            {series.map((s, i) => (
              <Line
                key={s}
                dataKey={s}
                name={s}
                type="linear"
                connectNulls
                stroke={color(s, i)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; index?: number; value?: unknown }) =>
                  props.value === null || props.value === undefined ? (
                    <g key={`${s}-${props.index}`} />
                  ) : (
                    <Marcador key={`${s}-${props.index}`} cx={props.cx} cy={props.cy} color={color(s, i)} forma={FORMAS[i] ?? "circle"} />
                  )
                }
                activeDot={{ r: 7, stroke: "#FFFFFF", strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
