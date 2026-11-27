/**
 * Variación de precio de un insumo (D-13) a partir de `historialPrecios()`
 * de Angel. Se compara el precio por pieza si todas las compras lo tienen
 * (presentaciones distintas); si no, el precio por unidad del insumo.
 */
import type { RegistroPrecio } from "@/lib/inventario/precios";

/** Máximo de proveedores con línea propia; el resto se agrupa en "Otros". */
export const MAX_PROVEEDORES = 3;
export const OTROS = "Otros proveedores";
export const SIN_PROVEEDOR = "Sin proveedor";

export interface PuntoPrecio {
  loteId: number;
  fecha: string;
  proveedor: string;
  /** Serie de la gráfica: el proveedor o "Otros proveedores". */
  serie: string;
  precio: number;
  presentacion: string | null;
}

export interface ResumenVariacion {
  base: "pieza" | "unidad";
  puntos: PuntoPrecio[];
  series: string[];
  ultimo: PuntoPrecio | null;
  minimo: PuntoPrecio | null;
  /** Cambio de la última compra respecto a la anterior, en %; null con menos de 2 compras. */
  cambioPct: number | null;
  /** Precio de la compra anterior a la última. */
  anterior: PuntoPrecio | null;
}

const redondear = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function resumenVariacion(historial: readonly RegistroPrecio[]): ResumenVariacion {
  const ordenado = [...historial].sort((a, b) => (a.fechaCompra < b.fechaCompra ? -1 : a.fechaCompra > b.fechaCompra ? 1 : a.loteId - b.loteId));
  const base = ordenado.length > 0 && ordenado.every((h) => h.precioPorPieza !== null) ? "pieza" : "unidad";

  // Proveedores con más compras primero; empate por la compra más reciente.
  const frecuencia = new Map<string, { n: number; ultima: string }>();
  for (const h of ordenado) {
    const p = h.proveedor?.trim() || SIN_PROVEEDOR;
    const f = frecuencia.get(p) ?? { n: 0, ultima: "" };
    frecuencia.set(p, { n: f.n + 1, ultima: h.fechaCompra > f.ultima ? h.fechaCompra : f.ultima });
  }
  const ranking = [...frecuencia.entries()].sort((a, b) => b[1].n - a[1].n || b[1].ultima.localeCompare(a[1].ultima) || a[0].localeCompare(b[0]));
  const propios = new Set(ranking.slice(0, ranking.length > MAX_PROVEEDORES ? MAX_PROVEEDORES : ranking.length).map(([p]) => p));

  const puntos: PuntoPrecio[] = ordenado.map((h) => {
    const proveedor = h.proveedor?.trim() || SIN_PROVEEDOR;
    return {
      loteId: h.loteId,
      fecha: h.fechaCompra,
      proveedor,
      serie: propios.has(proveedor) ? proveedor : OTROS,
      precio: base === "pieza" ? h.precioPorPieza! : h.precioUnitario,
      presentacion: h.presentacion,
    };
  });
  const series = [...ranking.filter(([p]) => propios.has(p)).map(([p]) => p), ...(puntos.some((p) => p.serie === OTROS) ? [OTROS] : [])];

  const ultimo = puntos.at(-1) ?? null;
  const anterior = puntos.length >= 2 ? puntos[puntos.length - 2] : null;
  const minimo = puntos.reduce<PuntoPrecio | null>((m, p) => (m === null || p.precio < m.precio || (p.precio === m.precio && p.fecha > m.fecha) ? p : m), null);
  const cambioPct = ultimo && anterior && anterior.precio > 0 ? redondear(((ultimo.precio - anterior.precio) / anterior.precio) * 100) : null;
  return { base, puntos, series, ultimo, minimo, cambioPct, anterior };
}

/** "+12.5 %", "−3.0 %", "sin cambio". */
export function textoCambio(pct: number): string {
  if (pct === 0) return "sin cambio";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)} %`;
}
