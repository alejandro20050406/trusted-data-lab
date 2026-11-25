/**
 * Correspondencias revisadas a mano entre insumos y productos del
 * observatorio. No se crean automáticamente: la dentista (o el equipo)
 * busca el producto y lo vincula.
 */
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { correspondenciaObservatorio, precioReferencia } from "@/lib/db/schema";

export interface ProductoObservatorio {
  url: string;
  producto: string;
  tienda: string;
  fuente: string;
  precio: number;
  presentacion: string | null;
  fechaCaptura: Date;
  sha256: string;
}

/** Última captura de cada URL que cumple la condición. */
async function ultimasCapturas(condicion: ReturnType<typeof and>, limite = 50): Promise<ProductoObservatorio[]> {
  const filas = await getDb()
    .selectDistinctOn([precioReferencia.url], {
      url: precioReferencia.url,
      producto: precioReferencia.producto,
      tienda: precioReferencia.tienda,
      fuente: precioReferencia.fuente,
      precio: precioReferencia.precio,
      presentacion: precioReferencia.presentacion,
      fechaCaptura: precioReferencia.fechaCaptura,
      sha256: precioReferencia.sha256,
    })
    .from(precioReferencia)
    .where(condicion)
    .orderBy(precioReferencia.url, desc(precioReferencia.fechaCaptura))
    .limit(limite);
  return filas.map((f) => ({ ...f, precio: Number(f.precio) }));
}

/** Busca productos del observatorio por texto (todas las palabras deben aparecer). */
export async function buscarProductos(texto: string): Promise<ProductoObservatorio[]> {
  const palabras = texto.trim().split(/\s+/).filter((p) => p.length >= 2).slice(0, 5);
  if (palabras.length === 0) return [];
  const escapar = (p: string) => p.replace(/[\\%_]/g, (c) => `\\${c}`);
  return ultimasCapturas(and(...palabras.map((p) => ilike(precioReferencia.producto, `%${escapar(p)}%`))), 30);
}

const esquemaVinculo = z.object({
  insumoId: z.coerce.number().int().positive(),
  url: z.url({ protocol: /^https?$/ }),
  nota: z.string().trim().max(200).nullish(),
});

export async function vincularProducto(datos: z.input<typeof esquemaVinculo>): Promise<void> {
  const d = esquemaVinculo.parse(datos);
  const [existe] = await getDb().select({ id: precioReferencia.id }).from(precioReferencia).where(eq(precioReferencia.url, d.url)).limit(1);
  if (!existe) throw new Error("Ese producto no está en los precios importados.");
  await getDb()
    .insert(correspondenciaObservatorio)
    .values({ insumoId: d.insumoId, url: d.url, nota: d.nota || null })
    .onConflictDoUpdate({
      target: [correspondenciaObservatorio.insumoId, correspondenciaObservatorio.url],
      set: { nota: d.nota || null, revisadoEn: new Date() },
    });
}

export async function desvincularProducto(id: number): Promise<void> {
  await getDb().delete(correspondenciaObservatorio).where(eq(correspondenciaObservatorio.id, id));
}

export interface Vinculo extends ProductoObservatorio {
  id: number;
  insumoId: number;
  nota: string | null;
}

/** Productos vinculados (con su última captura), de un insumo o de todos. */
export async function vinculos(insumoId?: number): Promise<Vinculo[]> {
  const db = getDb();
  const filas = await db
    .select()
    .from(correspondenciaObservatorio)
    .where(insumoId === undefined ? undefined : eq(correspondenciaObservatorio.insumoId, insumoId))
    .orderBy(correspondenciaObservatorio.insumoId, correspondenciaObservatorio.id);
  if (filas.length === 0) return [];
  const capturas = await ultimasCapturas(
    inArray(
      precioReferencia.url,
      filas.map((f) => f.url),
    ),
    filas.length,
  );
  const porUrl = new Map(capturas.map((c) => [c.url, c]));
  return filas.flatMap((f) => {
    const c = porUrl.get(f.url);
    return c ? [{ ...c, id: f.id, insumoId: f.insumoId, nota: f.nota }] : [];
  });
}

/**
 * Precio de referencia más barato entre los productos vinculados al insumo,
 * tomando de cada producto su captura más reciente.
 */
export async function referenciaMasBarata(insumoId: number): Promise<Vinculo | null> {
  const lista = await vinculos(insumoId);
  if (lista.length === 0) return null;
  return lista.reduce((mejor, v) => (v.precio < mejor.precio || (v.precio === mejor.precio && v.fechaCaptura > mejor.fechaCaptura) ? v : mejor));
}

export async function totalVinculos(): Promise<number> {
  const [f] = await getDb().select({ n: sql<number>`count(*)::int` }).from(correspondenciaObservatorio);
  return Number(f.n);
}
