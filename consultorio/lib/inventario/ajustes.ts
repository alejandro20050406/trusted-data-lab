import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { insumo, lote, movimiento } from "@/lib/db/schema";

const enteroOpcional = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.coerce.number().int({ error: "Usa un número entero." }).min(0, { error: "No puede ser negativo." }).nullable(),
);

/** Valores que define la clienta. Vacío = "Sin definir". */
export const esquemaReglas = z.object({
  unidad: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(30).nullable()),
  minimoReserva: enteroOpcional,
  diasAvisoCaducidad: enteroOpcional,
  vidaUtilDias: enteroOpcional,
});

export async function actualizarReglasInsumo(insumoId: number, datos: z.input<typeof esquemaReglas>): Promise<void> {
  const d = esquemaReglas.parse(datos);
  const filas = await getDb().update(insumo).set(d).where(eq(insumo.id, insumoId)).returning({ id: insumo.id });
  if (filas.length === 0) throw new Error("El insumo no existe.");
}

/** Da de baja lo que queda de un lote (caducado, vencido o roto) con un ajuste. */
export async function darDeBajaLote(loteId: number, nota: string): Promise<number> {
  return getDb().transaction(async (tx) => {
    const [l] = await tx.select().from(lote).where(eq(lote.id, loteId)).for("update");
    if (!l) throw new Error("El lote no existe.");
    const [{ restante }] = await tx
      .select({ restante: sql<number>`coalesce(sum(${movimiento.cantidad}), 0)::int` })
      .from(movimiento)
      .where(eq(movimiento.loteId, loteId));
    const n = Number(restante);
    if (n <= 0) return 0;
    await tx.insert(movimiento).values({
      insumoId: l.insumoId,
      loteId,
      varianteId: l.varianteId,
      tipo: "ajuste",
      cantidad: -n,
      grupoId: randomUUID(),
      nota: nota.slice(0, 200),
    });
    return n;
  });
}
