/**
 * Almacén de archivos (D-06). En producción es un bucket **privado** de
 * Cloudflare R2 (API compatible con S3, firmada con aws4fetch). Sin las
 * variables de R2 y fuera de producción, usa una carpeta local con URL
 * firmadas por la propia app (desarrollo y pruebas de Playwright).
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile, open } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { AwsClient } from "aws4fetch";

export interface Almacen {
  /** URL firmada para que el navegador suba el archivo con PUT. */
  urlSubida(llave: string, tipoContenido: string, segundos: number): Promise<{ url: string; headers: Record<string, string> }>;
  /** URL firmada de lectura de corta duración. */
  urlDescarga(llave: string, segundos: number): Promise<string>;
  /** Primeros `n` bytes y tamaño total del objeto; null si no existe. */
  leerInicio(llave: string, n: number): Promise<{ bytes: Uint8Array; tamano: number } | null>;
  borrar(llave: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Cloudflare R2
// ---------------------------------------------------------------------------

class AlmacenR2 implements Almacen {
  private cliente: AwsClient;
  private base: string;

  constructor(cuenta: string, llaveAcceso: string, secreto: string, bucket: string) {
    this.cliente = new AwsClient({ accessKeyId: llaveAcceso, secretAccessKey: secreto, service: "s3", region: "auto" });
    this.base = `https://${cuenta}.r2.cloudflarestorage.com/${bucket}`;
  }

  private url(llave: string) {
    return `${this.base}/${llave.split("/").map(encodeURIComponent).join("/")}`;
  }

  async urlSubida(llave: string, tipoContenido: string, segundos: number) {
    const url = new URL(this.url(llave));
    url.searchParams.set("X-Amz-Expires", String(segundos));
    const firmado = await this.cliente.sign(new Request(url, { method: "PUT", headers: { "content-type": tipoContenido } }), {
      aws: { signQuery: true, allHeaders: true },
    });
    return { url: firmado.url, headers: { "content-type": tipoContenido } };
  }

  async urlDescarga(llave: string, segundos: number) {
    const url = new URL(this.url(llave));
    url.searchParams.set("X-Amz-Expires", String(segundos));
    const firmado = await this.cliente.sign(new Request(url, { method: "GET" }), { aws: { signQuery: true } });
    return firmado.url;
  }

  async leerInicio(llave: string, n: number) {
    const r = await this.cliente.fetch(this.url(llave), { headers: { range: `bytes=0-${n - 1}` } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`R2 respondió ${r.status} al leer el archivo.`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    const rango = r.headers.get("content-range");
    const tamano = rango ? Number(rango.split("/")[1]) : Number(r.headers.get("content-length") ?? bytes.length);
    return { bytes: bytes.slice(0, n), tamano };
  }

  async borrar(llave: string) {
    const r = await this.cliente.fetch(this.url(llave), { method: "DELETE" });
    if (!r.ok && r.status !== 404) throw new Error(`R2 respondió ${r.status} al borrar el archivo.`);
  }
}

// ---------------------------------------------------------------------------
// Carpeta local (solo desarrollo y pruebas)
// ---------------------------------------------------------------------------

export const RUTA_ALMACEN_LOCAL = "/api/almacen-local";

function secretoLocal(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("Falta BETTER_AUTH_SECRET.");
  return s;
}

const firmaLocal = (metodo: string, llave: string, exp: number, tipo: string) =>
  createHmac("sha256", secretoLocal()).update(`${metodo}\n${llave}\n${exp}\n${tipo}`).digest("base64url");

/** Verifica una URL firmada del almacén local. */
export function verificarFirmaLocal(metodo: "PUT" | "GET", llave: string, exp: string | null, firma: string | null, tipo = "", ahora = Date.now()): boolean {
  if (!exp || !firma || Number(exp) < ahora) return false;
  const esperada = Buffer.from(firmaLocal(metodo, llave, Number(exp), tipo));
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

export function carpetaLocal(): string {
  return process.env.ALMACEN_LOCAL_DIR || path.join(tmpdir(), "consultorio-almacen");
}

/** Ruta en disco de una llave, sin permitir salir de la carpeta. */
export function rutaLocal(llave: string): string {
  if (!/^[a-z_]+\/[0-9a-f-]{36}$/.test(llave)) throw new Error("Llave inválida.");
  return path.join(carpetaLocal(), ...llave.split("/"));
}

class AlmacenLocal implements Almacen {
  async urlSubida(llave: string, tipoContenido: string, segundos: number) {
    const exp = Date.now() + segundos * 1000;
    const q = new URLSearchParams({ exp: String(exp), firma: firmaLocal("PUT", llave, exp, tipoContenido) });
    return { url: `${RUTA_ALMACEN_LOCAL}/${llave}?${q}`, headers: { "content-type": tipoContenido } };
  }

  async urlDescarga(llave: string, segundos: number) {
    const exp = Date.now() + segundos * 1000;
    const q = new URLSearchParams({ exp: String(exp), firma: firmaLocal("GET", llave, exp, "") });
    return `${RUTA_ALMACEN_LOCAL}/${llave}?${q}`;
  }

  async leerInicio(llave: string, n: number) {
    const ruta = rutaLocal(llave);
    try {
      const info = await stat(ruta);
      const archivo = await open(ruta, "r");
      try {
        const buffer = Buffer.alloc(Math.min(n, info.size));
        await archivo.read(buffer, 0, buffer.length, 0);
        return { bytes: new Uint8Array(buffer), tamano: info.size };
      } finally {
        await archivo.close();
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async borrar(llave: string) {
    await rm(rutaLocal(llave), { force: true });
    await rm(`${rutaLocal(llave)}.tipo`, { force: true });
  }
}

/** Escribe un archivo del almacén local (lo usa la ruta PUT). */
export async function escribirLocal(llave: string, datos: Uint8Array, tipo: string): Promise<void> {
  const ruta = rutaLocal(llave);
  await mkdir(path.dirname(ruta), { recursive: true });
  await writeFile(ruta, datos);
  await writeFile(`${ruta}.tipo`, tipo);
}

export async function leerLocal(llave: string): Promise<{ datos: Buffer; tipo: string } | null> {
  const ruta = rutaLocal(llave);
  try {
    const [datos, tipo] = await Promise.all([readFile(ruta), readFile(`${ruta}.tipo`, "utf8").catch(() => "application/octet-stream")]);
    return { datos, tipo };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

// ---------------------------------------------------------------------------

export function almacenLocalPermitido(): boolean {
  return !(process.env.VERCEL && process.env.NODE_ENV === "production");
}

let instancia: Almacen | undefined;

/** Permite a las pruebas usar un almacén falso. */
export function usarAlmacen(a: Almacen | undefined): void {
  instancia = a;
}

export function getAlmacen(): Almacen {
  if (instancia) return instancia;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
    instancia = new AlmacenR2(R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET);
  } else if (almacenLocalPermitido()) {
    instancia = new AlmacenLocal();
  } else {
    throw new Error("Faltan las variables de R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).");
  }
  return instancia;
}
