/**
 * Avisos del panel de inicio. Contrato con Adrián: él crea avisos con
 * `crearAviso()` (p. ej. `origen: "esterilizacion"` o `"residuos"`) y el panel
 * de inicio los muestra junto con los de inventario.
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { aviso } from "@/lib/db/schema";

export type PrioridadAviso = "alta" | "media" | "baja";

export type OrigenAviso = "inventario" | "esterilizacion" | "residuos" | (string & {});

export interface DatosAviso {
  /** Clasificación libre dentro del origen, p. ej. "reserva_baja". */
  tipo: string;
  titulo: string;
  detalle?: string | null;
  prioridad: PrioridadAviso;
  /** Fecha límite del aviso (AAAA-MM-DD), si aplica. */
  fechaVencimiento?: string | null;
  /** Ruta interna del botón de acción directa, p. ej. "/inventario/compra?insumo=3". */
  urlAccion?: string | null;
  origen: OrigenAviso;
  /**
   * Llave opcional para no duplicar avisos abiertos. Si ya existe un aviso sin
   * atender con la misma clave, se actualiza en lugar de crear otro.
   */
  clave?: string | null;
}

export interface Aviso extends Required<Omit<DatosAviso, "clave">> {
  id: number;
  clave: string | null;
  atendido: boolean;
  creadoEn: Date;
  atendidoEn: Date | null;
}

const esquemaAviso = z.object({
  tipo: z.string().trim().min(1),
  titulo: z.string().trim().min(1),
  detalle: z.string().nullish(),
  prioridad: z.enum(["alta", "media", "baja"]),
  fechaVencimiento: z.iso.date().nullish(),
  urlAccion: z
    .string()
    .refine((u) => u.startsWith("/") && !u.startsWith("//"), { error: "urlAccion debe ser una ruta interna." })
    .nullish(),
  origen: z.string().trim().min(1),
  clave: z.string().trim().min(1).nullish(),
});

type FilaAviso = typeof aviso.$inferSelect;

function aAviso(f: FilaAviso): Aviso {
  return {
    id: f.id,
    tipo: f.tipo,
    titulo: f.titulo,
    detalle: f.detalle,
    prioridad: f.prioridad,
    fechaVencimiento: f.fechaVencimiento,
    urlAccion: f.urlAccion,
    origen: f.origen,
    clave: f.clave,
    atendido: f.atendido,
    creadoEn: f.creadoEn,
    atendidoEn: f.atendidoEn,
  };
}

/**
 * Crea un aviso pendiente. Con `clave`, si ya hay uno abierto con esa clave se
 * actualiza su contenido (no se duplica).
 */
export async function crearAviso(datos: DatosAviso): Promise<Aviso> {
  const d = esquemaAviso.parse(datos);
  const valores = {
    tipo: d.tipo,
    titulo: d.titulo,
    detalle: d.detalle ?? null,
    prioridad: d.prioridad,
    fechaVencimiento: d.fechaVencimiento ?? null,
    urlAccion: d.urlAccion ?? null,
    origen: d.origen,
    clave: d.clave ?? null,
  };
  const db = getDb();
  if (valores.clave === null) {
    const [fila] = await db.insert(aviso).values(valores).returning();
    return aAviso(fila);
  }
  const { clave, ...cambios } = valores;
  void clave;
  const [fila] = await db
    .insert(aviso)
    .values(valores)
    .onConflictDoUpdate({
      target: aviso.clave,
      targetWhere: sql`${aviso.atendido} = false`,
      set: { ...cambios, actualizadoEn: new Date() },
    })
    .returning();
  return aAviso(fila);
}

const ORDEN_PRIORIDAD = sql`case ${aviso.prioridad} when 'alta' then 0 when 'media' then 1 else 2 end`;

/** Avisos sin atender: primero prioridad alta, después los que vencen antes. */
export async function avisosPendientes(): Promise<Aviso[]> {
  const filas = await getDb()
    .select()
    .from(aviso)
    .where(eq(aviso.atendido, false))
    .orderBy(ORDEN_PRIORIDAD, sql`${aviso.fechaVencimiento} asc nulls last`, asc(aviso.creadoEn));
  return filas.map(aAviso);
}

/** Marca un aviso como atendido. Devuelve false si no existía o ya estaba atendido. */
export async function marcarAvisoAtendido(id: number): Promise<boolean> {
  const filas = await getDb()
    .update(aviso)
    .set({ atendido: true, atendidoEn: new Date() })
    .where(and(eq(aviso.id, id), eq(aviso.atendido, false)))
    .returning({ id: aviso.id });
  return filas.length > 0;
}

/** Cierra los avisos abiertos con esas claves (p. ej. al reponer un insumo). */
export async function cerrarAvisosPorClave(claves: string[]): Promise<number> {
  if (claves.length === 0) return 0;
  const filas = await getDb()
    .update(aviso)
    .set({ atendido: true, atendidoEn: new Date() })
    .where(and(inArray(aviso.clave, claves), eq(aviso.atendido, false)))
    .returning({ id: aviso.id });
  return filas.length;
}
