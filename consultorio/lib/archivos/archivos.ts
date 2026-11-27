/**
 * Archivos de pacientes (D-05 y D-06). La subida va directo del navegador al
 * bucket con una URL firmada; después se confirma: el servidor lee los
 * primeros bytes, verifica el tipo real y el tamaño, y solo entonces guarda
 * los metadatos en `archivo_paciente`.
 */
import "server-only";
import { and, count, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { accesoArchivo, archivoPaciente, paciente } from "@/lib/db/schema";
import { hoyLocal } from "@/lib/inventario/estado";
import { getAlmacen } from "./almacen";
import {
  ArchivoInvalido,
  BYTES_FIRMA,
  crearBoleto,
  generarLlave,
  leerBoleto,
  nombreAutomatico,
  type TipoArchivo,
  validarDeclaracion,
  validarSubido,
} from "./validacion";

/** Segundos que vale la URL firmada de subida. */
export const SEGUNDOS_SUBIDA = 300;
/** Segundos que vale la URL firmada de descarga. */
export const SEGUNDOS_DESCARGA = 60;

export interface SubidaPreparada {
  boleto: string;
  url: string;
  headers: Record<string, string>;
}

export async function prepararSubida(pacienteId: number, tipoContenido: string, tamano: number): Promise<SubidaPreparada> {
  validarDeclaracion(tipoContenido, tamano);
  const [p] = await getDb().select({ id: paciente.id }).from(paciente).where(eq(paciente.id, pacienteId));
  if (!p) throw new ArchivoInvalido("El paciente no existe.");
  const llave = generarLlave();
  const { url, headers } = await getAlmacen().urlSubida(llave, tipoContenido, SEGUNDOS_SUBIDA);
  const boleto = crearBoleto({ llave, pacienteId, tipoContenido, tamano, exp: Date.now() + SEGUNDOS_SUBIDA * 1000 });
  return { boleto, url, headers };
}

export interface ArchivoGuardado {
  id: number;
  pacienteId: number;
  nombre: string;
  tipo: TipoArchivo;
  tipoContenido: string;
  tamanoBytes: number;
  fecha: string;
  creadoEn: Date;
}

/**
 * Verifica lo que se subió y guarda los metadatos. Si el archivo no pasa la
 * validación, se borra del bucket y se lanza `ArchivoInvalido`.
 */
export async function confirmarSubida(boleto: string, tipo: TipoArchivo, userId: string | null, fecha = hoyLocal()): Promise<ArchivoGuardado> {
  const datos = leerBoleto(boleto);
  const almacen = getAlmacen();
  const inicio = await almacen.leerInicio(datos.llave, BYTES_FIRMA);
  if (!inicio) throw new ArchivoInvalido("No se encontró el archivo subido; vuelve a intentarlo.");
  let tipoReal: string;
  try {
    tipoReal = validarSubido(datos.tipoContenido, inicio.bytes, inicio.tamano);
  } catch (e) {
    await almacen.borrar(datos.llave);
    throw e;
  }

  const db = getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(archivoPaciente)
    .where(and(eq(archivoPaciente.pacienteId, datos.pacienteId), eq(archivoPaciente.tipo, tipo), eq(archivoPaciente.fecha, fecha)));
  const [fila] = await db
    .insert(archivoPaciente)
    .values({
      pacienteId: datos.pacienteId,
      tipo,
      nombre: nombreAutomatico(tipo, fecha, Number(n)),
      llave: datos.llave,
      tipoContenido: tipoReal,
      tamanoBytes: inicio.tamano,
      fecha,
      subidoPor: userId,
    })
    .onConflictDoNothing({ target: archivoPaciente.llave })
    .returning();
  if (!fila) throw new ArchivoInvalido("Este archivo ya se había guardado.");
  return fila;
}

/** Archivos escaneados del paciente (sin las fotos de brackets), del más reciente al más antiguo. */
export async function listarArchivos(pacienteId: number): Promise<ArchivoGuardado[]> {
  return getDb()
    .select({
      id: archivoPaciente.id,
      pacienteId: archivoPaciente.pacienteId,
      nombre: archivoPaciente.nombre,
      tipo: archivoPaciente.tipo,
      tipoContenido: archivoPaciente.tipoContenido,
      tamanoBytes: archivoPaciente.tamanoBytes,
      fecha: archivoPaciente.fecha,
      creadoEn: archivoPaciente.creadoEn,
    })
    .from(archivoPaciente)
    .where(and(eq(archivoPaciente.pacienteId, pacienteId), ne(archivoPaciente.tipo, "foto_bracket")))
    .orderBy(desc(archivoPaciente.fecha), desc(archivoPaciente.id));
}

/**
 * Registra el acceso y devuelve una URL firmada de 60 segundos. Devuelve null
 * si el archivo no existe. Quien llama ya verificó la sesión.
 */
export async function abrirArchivo(id: number, userId: string, accion = "ver"): Promise<string | null> {
  const db = getDb();
  const [a] = await db.select({ llave: archivoPaciente.llave }).from(archivoPaciente).where(eq(archivoPaciente.id, id));
  if (!a) return null;
  await db.insert(accesoArchivo).values({ archivoId: id, userId, accion });
  return getAlmacen().urlDescarga(a.llave, SEGUNDOS_DESCARGA);
}

/** Últimos accesos a un archivo (quién y cuándo). */
export async function accesosDeArchivo(id: number) {
  return getDb().select().from(accesoArchivo).where(eq(accesoArchivo.archivoId, id)).orderBy(desc(accesoArchivo.fecha));
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
