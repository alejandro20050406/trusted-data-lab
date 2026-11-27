/**
 * Brackets caídos (D-07) y su reporte (D-08). Un toque en el diente registra
 * la caída con la fecha de hoy; después se puede agregar la foto de evidencia
 * y descontar el bracket de reposición del inventario con `registrarConsumo()`.
 */
import "server-only";
import { and, asc, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { archivoPaciente, bracketCaido, diente, paciente } from "@/lib/db/schema";
import { confirmarSubida } from "@/lib/archivos/archivos";
import { ArchivoInvalido, leerBoleto } from "@/lib/archivos/validacion";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { insumoBrackets } from "@/lib/inventario/brackets";
import { registrarConsumo } from "@/lib/inventario/consumo";
import { hoyLocal, sumarDias } from "@/lib/inventario/estado";

export class BracketInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "BracketInvalido";
  }
}

export interface RegistroCaida {
  id: number;
  pacienteId: number;
  pacienteNombre: string;
  dienteFdi: number;
  dienteNombre: string;
  fecha: string;
  fotoArchivoId: number | null;
  nota: string | null;
  repuesto: boolean;
}

// ---------------------------------------------------------------------------
// Cálculos puros del reporte
// ---------------------------------------------------------------------------

export interface Conteo<K> {
  clave: K;
  nombre: string;
  caidas: number;
}

function contar<K>(registros: readonly RegistroCaida[], clave: (r: RegistroCaida) => K, nombre: (r: RegistroCaida) => string): Conteo<K>[] {
  const mapa = new Map<K, Conteo<K>>();
  for (const r of registros) {
    const k = clave(r);
    const actual = mapa.get(k) ?? { clave: k, nombre: nombre(r), caidas: 0 };
    actual.caidas++;
    mapa.set(k, actual);
  }
  // Más caídas primero; empate por nombre para que el orden sea estable.
  return [...mapa.values()].sort((a, b) => b.caidas - a.caidas || a.nombre.localeCompare(b.nombre));
}

export const contarPorDiente = (r: readonly RegistroCaida[]) => contar(r, (x) => x.dienteFdi, (x) => `${x.dienteFdi} · ${x.dienteNombre}`);
export const contarPorPaciente = (r: readonly RegistroCaida[]) => contar(r, (x) => x.pacienteId, (x) => x.pacienteNombre);

/** Registros desde `hoy - dias + 1` hasta `hoy`, inclusive. */
export function enUltimosDias(registros: readonly RegistroCaida[], hoy: string, dias: number): RegistroCaida[] {
  const desde = sumarDias(hoy, -(dias - 1));
  return registros.filter((r) => r.fecha >= desde && r.fecha <= hoy);
}

// ---------------------------------------------------------------------------
// Base de datos
// ---------------------------------------------------------------------------

export async function registrarBracketCaido(datos: { pacienteId: number; dienteFdi: number; fecha?: string; nota?: string | null }): Promise<number> {
  const db = getDb();
  const [p] = await db.select({ id: paciente.id }).from(paciente).where(eq(paciente.id, datos.pacienteId));
  if (!p) throw new BracketInvalido("El paciente no existe.");
  const [d] = await db.select({ fdi: diente.fdi }).from(diente).where(eq(diente.fdi, datos.dienteFdi));
  if (!d) throw new BracketInvalido("El diente no existe.");
  const nota = datos.nota?.trim() ? datos.nota.trim().slice(0, 300) : null;
  const [fila] = await db
    .insert(bracketCaido)
    .values({ pacienteId: datos.pacienteId, dienteFdi: datos.dienteFdi, fecha: datos.fecha ?? hoyLocal(), nota })
    .returning({ id: bracketCaido.id });
  return fila.id;
}

async function obtener(id: number) {
  const [b] = await getDb().select().from(bracketCaido).where(eq(bracketCaido.id, id));
  if (!b) throw new BracketInvalido("El registro no existe.");
  return b;
}

export async function guardarNotaBracket(id: number, nota: string): Promise<void> {
  await obtener(id);
  const limpia = nota.trim().slice(0, 300);
  await getDb().update(bracketCaido).set({ nota: limpia === "" ? null : limpia }).where(eq(bracketCaido.id, id));
}

/** Confirma la foto subida y la enlaza con la caída. */
export async function adjuntarFotoBracket(id: number, boleto: string, userId: string | null): Promise<number> {
  const b = await obtener(id);
  if (leerBoleto(boleto).pacienteId !== b.pacienteId) throw new ArchivoInvalido("La foto no corresponde a este paciente.");
  const archivo = await confirmarSubida(boleto, "foto_bracket", userId, b.fecha);
  await getDb().update(bracketCaido).set({ fotoArchivoId: archivo.id }).where(eq(bracketCaido.id, id));
  return archivo.id;
}

export interface Reposicion {
  varianteId: number;
  nombre: string;
  existencia: number;
}

/** Brackets en inventario para ese diente (por sistema y slot) con existencia. */
export async function reposicionesParaDiente(dienteFdi: number): Promise<{ insumoId: number; opciones: Reposicion[] } | null> {
  const brackets = await insumoBrackets();
  if (!brackets) return null;
  const inventario = await inventarioConEstado(hoyLocal());
  const variantes = inventario.find((i) => i.id === brackets.id)?.variantes ?? [];
  return {
    insumoId: brackets.id,
    opciones: variantes
      .filter((v) => v.dienteFdi === dienteFdi && v.existencia > 0)
      .map((v) => ({ varianteId: v.id, nombre: v.nombre, existencia: v.existencia }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
}

/**
 * "Descontar bracket de reposición": descuenta 1 bracket del diente con
 * `registrarConsumo()` de Angel y guarda el consumo en la caída.
 */
export async function descontarReposicion(id: number, varianteId: number): Promise<{ grupoId: string; existenciaRestante: number }> {
  const b = await obtener(id);
  if (b.consumoGrupoId) throw new BracketInvalido("Ya se descontó el bracket de reposición.");
  const repos = await reposicionesParaDiente(b.dienteFdi);
  if (!repos) throw new BracketInvalido("No hay un insumo de brackets configurado.");
  if (!repos.opciones.some((o) => o.varianteId === varianteId)) throw new BracketInvalido("Ese bracket no es del diente o ya no hay.");
  const resultado = await registrarConsumo({ insumoId: repos.insumoId, cantidad: 1, varianteId });
  await getDb()
    .update(bracketCaido)
    .set({ consumoGrupoId: resultado.grupoId })
    .where(and(eq(bracketCaido.id, id), isNull(bracketCaido.consumoGrupoId)));
  return resultado;
}

/** Quita el enlace del consumo (lo usa "Deshacer" después de deshacer el consumo). */
export async function quitarReposicion(id: number, grupoId: string): Promise<void> {
  await getDb()
    .update(bracketCaido)
    .set({ consumoGrupoId: null })
    .where(and(eq(bracketCaido.id, id), eq(bracketCaido.consumoGrupoId, grupoId)));
}

/** Borra una caída recién registrada (deshacer), si aún no tiene foto ni consumo. */
export async function deshacerBracketCaido(id: number): Promise<boolean> {
  const filas = await getDb()
    .delete(bracketCaido)
    .where(and(eq(bracketCaido.id, id), isNull(bracketCaido.fotoArchivoId), isNull(bracketCaido.consumoGrupoId)))
    .returning({ id: bracketCaido.id });
  return filas.length > 0;
}

/** Caídas registradas, de la más reciente a la más antigua. */
export async function listarCaidas(filtro: { pacienteId?: number; desde?: string; soloConFoto?: boolean } = {}): Promise<RegistroCaida[]> {
  const condiciones = [
    filtro.pacienteId ? eq(bracketCaido.pacienteId, filtro.pacienteId) : undefined,
    filtro.desde ? gte(bracketCaido.fecha, filtro.desde) : undefined,
    filtro.soloConFoto ? isNotNull(bracketCaido.fotoArchivoId) : undefined,
  ].filter((c) => c !== undefined);
  const filas = await getDb()
    .select({
      id: bracketCaido.id,
      pacienteId: bracketCaido.pacienteId,
      pacienteNombre: paciente.nombre,
      dienteFdi: bracketCaido.dienteFdi,
      dienteNombre: diente.nombre,
      fecha: bracketCaido.fecha,
      fotoArchivoId: bracketCaido.fotoArchivoId,
      nota: bracketCaido.nota,
      consumoGrupoId: bracketCaido.consumoGrupoId,
    })
    .from(bracketCaido)
    .innerJoin(paciente, eq(paciente.id, bracketCaido.pacienteId))
    .innerJoin(diente, eq(diente.fdi, bracketCaido.dienteFdi))
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .orderBy(desc(bracketCaido.fecha), desc(bracketCaido.id));
  return filas.map(({ consumoGrupoId, ...r }) => ({ ...r, repuesto: consumoGrupoId !== null }));
}

export async function dientesOrdenados() {
  return getDb().select().from(diente).orderBy(asc(diente.fdi));
}

/** Para la galería: confirma que el archivo es una foto de bracket. */
export async function esFotoBracket(archivoId: number): Promise<boolean> {
  const [a] = await getDb().select({ tipo: archivoPaciente.tipo }).from(archivoPaciente).where(eq(archivoPaciente.id, archivoId));
  return a?.tipo === "foto_bracket";
}
