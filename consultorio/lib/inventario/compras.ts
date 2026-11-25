import { randomUUID } from "node:crypto";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { insumo, lote, movimiento, variante } from "@/lib/db/schema";
import { hoyLocal } from "./estado";

const fecha = z.iso.date({ error: "Usa una fecha válida." });

export const esquemaCompra = z.object({
  insumoId: z.coerce.number().int().positive({ error: "Elige un insumo." }),
  cantidad: z.coerce.number().int({ error: "La cantidad debe ser entera." }).min(1, { error: "La cantidad debe ser mayor que cero." }),
  /** Precio total pagado por la compra, en pesos. */
  precioTotal: z.coerce.number().min(0, { error: "El precio no puede ser negativo." }).nullish(),
  fechaCompra: fecha.optional(),
  fechaCaducidad: fecha.nullish(),
  varianteId: z.coerce.number().int().positive().nullish(),
  proveedor: z.string().trim().max(120).nullish(),
  marca: z.string().trim().max(120).nullish(),
  presentacion: z.string().trim().max(120).nullish(),
  contenidoPorUnidad: z.coerce.number().int().min(1, { error: "El contenido debe ser mayor que cero." }).nullish(),
});

export type DatosCompra = z.input<typeof esquemaCompra>;

export class CompraInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "CompraInvalida";
  }
}

/** Crea el lote de la compra y su movimiento de entrada. */
export async function registrarCompra(datos: DatosCompra): Promise<{ loteId: number }> {
  const valido = esquemaCompra.safeParse(datos);
  if (!valido.success) throw new CompraInvalida(valido.error.issues[0]?.message ?? "Revisa los datos de la compra.");
  const d = valido.data;
  const vacioANull = (v: string | null | undefined) => (v ? v : null);

  return getDb().transaction(async (tx) => {
    const [ins] = await tx.select().from(insumo).where(eq(insumo.id, d.insumoId));
    if (!ins) throw new CompraInvalida("El insumo no existe.");
    const varianteId = d.varianteId ?? null;
    if (ins.tipoVariante !== null && varianteId === null) {
      throw new CompraInvalida(ins.tipoVariante === "color" ? "Elige el color." : "Elige el diente.");
    }
    if (varianteId !== null) {
      const [v] = await tx.select().from(variante).where(eq(variante.id, varianteId));
      if (!v || v.insumoId !== ins.id) throw new CompraInvalida("La variante no pertenece al insumo.");
    }
    const fechaCompra = d.fechaCompra ?? hoyLocal();
    const fechaCaducidad = d.fechaCaducidad ?? null;
    if (fechaCaducidad !== null && fechaCaducidad < fechaCompra) {
      throw new CompraInvalida("La caducidad no puede ser anterior a la compra.");
    }

    const [nuevo] = await tx
      .insert(lote)
      .values({
        insumoId: ins.id,
        varianteId,
        cantidad: d.cantidad,
        fechaCompra,
        fechaCaducidad,
        proveedor: vacioANull(d.proveedor),
        marca: vacioANull(d.marca),
        presentacion: vacioANull(d.presentacion),
        contenidoPorUnidad: d.contenidoPorUnidad ?? null,
        precioTotal: d.precioTotal ?? null,
      })
      .returning({ id: lote.id });
    await tx.insert(movimiento).values({
      insumoId: ins.id,
      loteId: nuevo.id,
      varianteId,
      tipo: "entrada",
      cantidad: d.cantidad,
      grupoId: randomUUID(),
    });
    return { loteId: nuevo.id };
  });
}

/** Último proveedor y presentación usados para un insumo, para prellenar la compra. */
export async function ultimaCompra(
  insumoId: number,
): Promise<{ proveedor: string | null; presentacion: string | null; contenidoPorUnidad: number | null } | null> {
  const [fila] = await getDb()
    .select({ proveedor: lote.proveedor, presentacion: lote.presentacion, contenidoPorUnidad: lote.contenidoPorUnidad })
    .from(lote)
    .where(and(eq(lote.insumoId, insumoId), isNotNull(lote.proveedor)))
    .orderBy(desc(lote.fechaCompra), desc(lote.id))
    .limit(1);
  return fila ?? null;
}
