import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { diente, insumo, variante } from "@/lib/db/schema";

export const esquemaColor = z.object({
  nombre: z.string().trim().min(1, { error: "Escribe el nombre del color." }).max(40),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Color inválido." }),
});

export const esquemaBracket = z.object({
  dienteFdi: z.coerce.number().int(),
  sistema: z.enum(["metalico", "estetico"], { error: "Elige el sistema." }),
  slot: z.string().trim().min(1, { error: "Escribe el slot." }).max(20),
});

export const NOMBRE_SISTEMA = { metalico: "metálico", estetico: "estético" } as const;

export function nombreBracket(fdi: number, sistema: "metalico" | "estetico", slot: string): string {
  return `${fdi} ${NOMBRE_SISTEMA[sistema]} ${slot}`;
}

async function insumoConTipo(insumoId: number, tipo: "color" | "diente") {
  const [ins] = await getDb().select().from(insumo).where(eq(insumo.id, insumoId));
  if (!ins || ins.tipoVariante !== tipo) throw new Error("El insumo no usa esa variante.");
  return ins;
}

/** Busca o crea el color de un insumo de ligas. */
export async function obtenerOCrearColor(insumoId: number, datos: z.input<typeof esquemaColor>): Promise<number> {
  const d = esquemaColor.parse(datos);
  await insumoConTipo(insumoId, "color");
  const db = getDb();
  const [existente] = await db
    .select({ id: variante.id })
    .from(variante)
    .where(and(eq(variante.insumoId, insumoId), eq(variante.nombre, d.nombre)));
  if (existente) return existente.id;
  const [nueva] = await db
    .insert(variante)
    .values({ insumoId, tipo: "color", nombre: d.nombre, colorHex: d.colorHex.toUpperCase() })
    .returning({ id: variante.id });
  return nueva.id;
}

/** Busca o crea la variante de bracket por diente, sistema y slot. */
export async function obtenerOCrearBracket(insumoId: number, datos: z.input<typeof esquemaBracket>): Promise<number> {
  const d = esquemaBracket.parse(datos);
  await insumoConTipo(insumoId, "diente");
  const db = getDb();
  const [d_] = await db.select({ fdi: diente.fdi }).from(diente).where(eq(diente.fdi, d.dienteFdi));
  if (!d_) throw new Error("El diente no existe.");
  const nombre = nombreBracket(d.dienteFdi, d.sistema, d.slot);
  const [existente] = await db
    .select({ id: variante.id })
    .from(variante)
    .where(and(eq(variante.insumoId, insumoId), eq(variante.nombre, nombre)));
  if (existente) return existente.id;
  const [nueva] = await db
    .insert(variante)
    .values({ insumoId, tipo: "diente", nombre, dienteFdi: d.dienteFdi, sistema: d.sistema, slot: d.slot })
    .returning({ id: variante.id });
  return nueva.id;
}
