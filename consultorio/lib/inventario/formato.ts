/** Formato de cantidades y fechas para la interfaz y los avisos. */

export const SIN_DEFINIR = "Sin definir";

export function pluralizar(palabra: string, n: number): string {
  if (n === 1) return palabra;
  if (/[aeiouáéíóú]$/i.test(palabra)) return `${palabra}s`;
  if (/z$/i.test(palabra)) return `${palabra.slice(0, -1)}ces`;
  return `${palabra}es`;
}

/** "1 caja", "2 cajas"; si la unidad no está definida, solo el número. */
export function cantidadConUnidad(n: number, unidad: string | null): string {
  return unidad ? `${n} ${pluralizar(unidad, n)}` : `${n}`;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-11-25" → "25 nov 2026". */
export function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

export function pesos(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}
