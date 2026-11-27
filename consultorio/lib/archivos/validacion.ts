/**
 * Reglas de los archivos de pacientes (D-06): tipos permitidos, tamaño máximo,
 * detección del tipo real por los primeros bytes y llaves aleatorias.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type TipoContenido = (typeof TIPOS_PERMITIDOS)[number];

/** 10 MB. Las fotos se comprimen en el celular antes de subirse. */
export const TAMANO_MAXIMO = 10 * 1024 * 1024;

/** Bytes que se leen del inicio del archivo para reconocer su tipo. */
export const BYTES_FIRMA = 16;

import { NOMBRE_TIPO_ARCHIVO, type TipoArchivo } from "./tipos";

export { NOMBRE_TIPO_ARCHIVO, TIPOS_ARCHIVO_ESCANEO, type TipoArchivo } from "./tipos";

export function esTipoPermitido(tipo: string): tipo is TipoContenido {
  return (TIPOS_PERMITIDOS as readonly string[]).includes(tipo);
}

const empiezaCon = (b: Uint8Array, firma: readonly number[], desde = 0) => firma.every((x, i) => b[desde + i] === x);

/** Tipo real según la firma de los primeros bytes; null si no es un tipo permitido. */
export function detectarTipo(bytes: Uint8Array): TipoContenido | null {
  if (empiezaCon(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (empiezaCon(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // RIFF....WEBP
  if (empiezaCon(bytes, [0x52, 0x49, 0x46, 0x46]) && empiezaCon(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  // %PDF-
  if (empiezaCon(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

export class ArchivoInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ArchivoInvalido";
  }
}

/** Revisa lo que declara el navegador antes de firmar la subida. */
export function validarDeclaracion(tipoContenido: string, tamano: number): asserts tipoContenido is TipoContenido {
  if (!esTipoPermitido(tipoContenido)) throw new ArchivoInvalido("Solo se aceptan fotos (JPG, PNG, WebP) o PDF.");
  if (!Number.isInteger(tamano) || tamano <= 0) throw new ArchivoInvalido("El archivo está vacío.");
  if (tamano > TAMANO_MAXIMO) throw new ArchivoInvalido("El archivo pesa más de 10 MB.");
}

/**
 * Revisa lo que realmente se subió: el tipo por sus bytes debe coincidir con
 * el declarado (una extensión falsa se rechaza) y el tamaño con el límite.
 */
export function validarSubido(declarado: TipoContenido, inicio: Uint8Array, tamanoReal: number): TipoContenido {
  const real = detectarTipo(inicio);
  if (real === null) throw new ArchivoInvalido("El archivo no es una foto ni un PDF válido.");
  if (real !== declarado) throw new ArchivoInvalido("El contenido del archivo no coincide con su tipo.");
  if (tamanoReal <= 0) throw new ArchivoInvalido("El archivo está vacío.");
  if (tamanoReal > TAMANO_MAXIMO) throw new ArchivoInvalido("El archivo pesa más de 10 MB.");
  return real;
}

/** Llave aleatoria del objeto. No incluye el nombre del paciente ni del archivo. */
export function generarLlave(): string {
  return `archivos/${randomUUID()}`;
}

/** "Receta 27 nov 2026", con "(2)", "(3)"... si ya hay otro igual ese día. */
export function nombreAutomatico(tipo: TipoArchivo, fecha: string, existentesMismoDia: number): string {
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [a, m, d] = fecha.split("-").map(Number);
  const base = `${NOMBRE_TIPO_ARCHIVO[tipo]} ${d} ${MESES[m - 1]} ${a}`;
  return existentesMismoDia > 0 ? `${base} (${existentesMismoDia + 1})` : base;
}

// ---------------------------------------------------------------------------
// Boleto de subida: amarra la llave al paciente y al tipo declarado, para que
// la confirmación no acepte una llave que el servidor no firmó.
// ---------------------------------------------------------------------------

export interface BoletoSubida {
  llave: string;
  pacienteId: number;
  tipoContenido: TipoContenido;
  tamano: number;
  /** Expiración en milisegundos desde época. */
  exp: number;
}

function secretoBoleto(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("Falta BETTER_AUTH_SECRET.");
  return s;
}

const firmar = (texto: string, secreto: string) => createHmac("sha256", secreto).update(texto).digest("base64url");

export function crearBoleto(datos: BoletoSubida, secreto = secretoBoleto()): string {
  const cuerpo = Buffer.from(JSON.stringify(datos)).toString("base64url");
  return `${cuerpo}.${firmar(`subida:${cuerpo}`, secreto)}`;
}

export function leerBoleto(boleto: string, ahora = Date.now(), secreto = secretoBoleto()): BoletoSubida {
  const [cuerpo, firma] = boleto.split(".");
  if (!cuerpo || !firma) throw new ArchivoInvalido("La subida no es válida.");
  const esperada = Buffer.from(firmar(`subida:${cuerpo}`, secreto));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) throw new ArchivoInvalido("La subida no es válida.");
  const datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString()) as BoletoSubida;
  if (datos.exp < ahora) throw new ArchivoInvalido("La subida tardó demasiado; vuelve a intentarlo.");
  return datos;
}
