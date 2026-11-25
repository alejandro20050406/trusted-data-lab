/**
 * Importa precios de referencia desde `oro_inventario.csv` del pipeline E1
 * (`python -m src.e1 --salida <dir>`). Solo toma ofertas comerciales con
 * precio, URL, fecha de captura y sha256 del archivo Bronce. Importar dos
 * veces el mismo archivo no duplica registros.
 */
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { precioReferencia } from "@/lib/db/schema";

/** Parser CSV (RFC 4180): comillas dobles, comas y saltos de línea dentro de campos. */
export function parsearCsv(texto: string): string[][] {
  const limpio = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => !(f.length === 1 && f[0] === ""));
}

export interface PrecioImportable {
  producto: string;
  tienda: string;
  fuente: string;
  precio: number;
  presentacion: string | null;
  categoria: string | null;
  disponibilidad: string | null;
  url: string;
  fechaCaptura: Date;
  sha256: string;
}

export interface ResultadoLectura {
  precios: PrecioImportable[];
  descartados: { linea: number; motivo: string }[];
}

const COLUMNAS = ["tipo_registro", "fuente", "producto", "precio_observado_mxn", "fecha_utc", "url", "sha256"] as const;

/** Convierte las filas de `oro_inventario.csv` en precios importables, con el motivo de cada descarte. */
export function leerOroInventario(texto: string): ResultadoLectura {
  const [encabezado, ...filas] = parsearCsv(texto);
  if (!encabezado) throw new Error("El archivo está vacío.");
  const indice = new Map(encabezado.map((c, i) => [c.trim(), i]));
  const faltan = COLUMNAS.filter((c) => !indice.has(c));
  if (faltan.length) throw new Error(`No es un oro_inventario.csv: faltan columnas ${faltan.join(", ")}.`);
  const valor = (f: string[], c: string) => (f[indice.get(c) ?? -1] ?? "").trim();

  const precios: PrecioImportable[] = [];
  const descartados: ResultadoLectura["descartados"] = [];
  filas.forEach((f, i) => {
    const linea = i + 2;
    if (valor(f, "tipo_registro") !== "oferta_comercial") return; // catálogo ISSSTE: sin precio comercial
    const precio = Number(valor(f, "precio_observado_mxn"));
    const url = valor(f, "url");
    const sha256 = valor(f, "sha256");
    const fecha = new Date(valor(f, "fecha_utc"));
    const producto = valor(f, "producto");
    let motivo: string | null = null;
    if (!producto) motivo = "sin producto";
    else if (!valor(f, "precio_observado_mxn") || !Number.isFinite(precio) || precio <= 0) motivo = "precio inválido";
    else if (!/^https?:\/\//.test(url)) motivo = "sin URL";
    else if (!valor(f, "fecha_utc") || Number.isNaN(fecha.getTime())) motivo = "sin fecha de captura";
    else if (!/^[0-9a-f]{64}$/i.test(sha256)) motivo = "sin sha256 del archivo Bronce";
    if (motivo) {
      descartados.push({ linea, motivo });
      return;
    }
    const fuente = valor(f, "fuente");
    precios.push({
      producto,
      tienda: valor(f, "vendedor") || valor(f, "tienda_imdent") || fuente,
      fuente,
      precio,
      presentacion: valor(f, "unidad") || null,
      categoria: valor(f, "categoria") || null,
      disponibilidad: valor(f, "disponibilidad") || null,
      url,
      fechaCaptura: fecha,
      sha256: sha256.toLowerCase(),
    });
  });
  return { precios, descartados };
}

/** Inserta los precios; los que ya existen (misma URL, fecha y sha256) se omiten. */
export async function importarPrecios(precios: readonly PrecioImportable[]): Promise<{ insertados: number; omitidos: number }> {
  const db = getDb();
  let insertados = 0;
  for (let i = 0; i < precios.length; i += 500) {
    const bloque = precios.slice(i, i + 500);
    if (bloque.length === 0) continue;
    const filas = await db.insert(precioReferencia).values(bloque).onConflictDoNothing().returning({ id: precioReferencia.id });
    insertados += filas.length;
  }
  return { insertados, omitidos: precios.length - insertados };
}

export async function contarPreciosReferencia(): Promise<number> {
  const [fila] = await getDb().select({ n: sql<number>`count(*)::int` }).from(precioReferencia);
  return Number(fila.n);
}
