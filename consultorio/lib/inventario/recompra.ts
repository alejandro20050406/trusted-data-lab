/**
 * A-14: texto del aviso de recompra con la opción más barata conocida.
 * Primero el historial personal de compras y después el precio más reciente
 * del observatorio. Nunca se muestra un precio sin su fuente y su fecha.
 */
import { cantidadConUnidad, fechaCorta, pesos } from "./formato";
import type { RegistroPrecio } from "./precios";

export interface ReferenciaObservatorio {
  producto: string;
  tienda: string;
  precio: number;
  presentacion: string | null;
  url: string;
  fechaCaptura: Date;
}

export const ADVERTENCIA_PRECIO = "El precio puede haber cambiado y no garantiza disponibilidad.";

function fechaDe(d: Date, zona = process.env.ZONA_HORARIA || "America/Mexico_City"): string {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return fechaCorta(iso);
}

/**
 * Devuelve las líneas a agregar al aviso, o null si no hay precios con fuente
 * y fecha (entonces el aviso solo dice cuánto queda).
 */
export function textoRecompra(
  unidad: string | null,
  personal: RegistroPrecio | null,
  referencia: ReferenciaObservatorio | null,
): string | null {
  const lineas: string[] = [];
  if (personal && personal.fechaCompra) {
    const fuente = personal.proveedor ? `con ${personal.proveedor}` : "con proveedor sin anotar";
    const porPieza = personal.precioPorPieza !== null ? ` (${pesos(personal.precioPorPieza)} por pieza)` : "";
    const porUnidad = unidad ? `${pesos(personal.precioUnitario)} por ${cantidadConUnidad(1, unidad).replace(/^1 /, "")}` : `${pesos(personal.precioUnitario)} por unidad`;
    lineas.push(`Tu compra más barata: ${porUnidad}${porPieza}, ${fuente}, el ${fechaCorta(personal.fechaCompra)}.`);
  }
  if (referencia && referencia.tienda && !Number.isNaN(referencia.fechaCaptura.getTime())) {
    const presentacion = referencia.presentacion ? ` (${referencia.presentacion})` : "";
    lineas.push(
      `Precio de referencia del observatorio: ${pesos(referencia.precio)} por "${referencia.producto}"${presentacion} en ${referencia.tienda}, capturado el ${fechaDe(referencia.fechaCaptura)}.`,
    );
  }
  if (lineas.length === 0) return null;
  lineas.push(ADVERTENCIA_PRECIO);
  return lineas.join("\n");
}
