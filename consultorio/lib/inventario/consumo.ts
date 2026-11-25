/**
 * Consumo de insumos. Contrato con Adrián: `registrarConsumo()` se llama al
 * registrar un bracket caído (con `varianteId` del diente) y desde los botones
 * de consumo del inventario.
 */
import { randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { insumo, lote, movimiento, variante } from "@/lib/db/schema";
import { hoyLocal, planConsumoFEFO } from "./estado";

export interface DatosConsumo {
  insumoId: number;
  /** Cantidad a descontar, entera y mayor que cero, en la unidad del insumo. */
  cantidad: number;
  /** Variante consumida: color de ligas o diente de brackets. */
  varianteId?: number | null;
}

export interface ResultadoConsumo {
  /** Identificador del consumo; sirve para deshacerlo. */
  grupoId: string;
  /** Existencia del insumo (o de la variante) después del consumo. */
  existenciaRestante: number;
}

export class ConsumoInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ConsumoInvalido";
  }
}

const esquemaConsumo = z.object({
  insumoId: z.number().int().positive(),
  cantidad: z.number().int().min(1),
  varianteId: z.number().int().positive().nullish(),
});

/**
 * Descuenta `cantidad` del insumo siguiendo FEFO (primero el lote que caduca
 * antes) y guarda un movimiento de consumo por lote tocado, con la variante.
 * Lanza `ExistenciaInsuficiente` si no alcanza y `ConsumoInvalido` si los datos
 * no corresponden al insumo.
 */
export async function registrarConsumo(datos: DatosConsumo): Promise<ResultadoConsumo> {
  const valido = esquemaConsumo.safeParse(datos);
  if (!valido.success) throw new ConsumoInvalido("Datos de consumo inválidos.");
  const { insumoId, cantidad } = valido.data;
  const varianteId = valido.data.varianteId ?? null;
  const hoy = hoyLocal();

  return getDb().transaction(async (tx) => {
    const [ins] = await tx.select().from(insumo).where(eq(insumo.id, insumoId));
    if (!ins) throw new ConsumoInvalido("El insumo no existe.");
    if (ins.tipoVariante !== null && varianteId === null) {
      throw new ConsumoInvalido(ins.tipoVariante === "color" ? "Elige el color." : "Elige el diente.");
    }
    if (varianteId !== null) {
      const [v] = await tx.select().from(variante).where(eq(variante.id, varianteId));
      if (!v || v.insumoId !== insumoId) throw new ConsumoInvalido("La variante no pertenece al insumo.");
    }

    const condicion = varianteId === null ? eq(lote.insumoId, insumoId) : and(eq(lote.insumoId, insumoId), eq(lote.varianteId, varianteId));
    // FOR UPDATE bloquea los lotes del insumo para que dos consumos simultáneos no los dejen en negativo.
    await tx.select({ id: lote.id }).from(lote).where(condicion).for("update");
    const restantes = await tx
      .select({
        id: lote.id,
        fechaCompra: lote.fechaCompra,
        fechaCaducidad: lote.fechaCaducidad,
        restante: sql<number>`coalesce(sum(${movimiento.cantidad}), 0)::int`,
      })
      .from(lote)
      .leftJoin(movimiento, eq(movimiento.loteId, lote.id))
      .where(condicion)
      .groupBy(lote.id);

    const plan = planConsumoFEFO(
      restantes.map((l) => ({ ...l, restante: Number(l.restante) })),
      cantidad,
      hoy,
      ins,
    );
    const grupoId = randomUUID();
    await tx.insert(movimiento).values(
      plan.map((p) => ({ insumoId, loteId: p.loteId, varianteId, tipo: "consumo" as const, cantidad: -p.cantidad, grupoId })),
    );

    const totalAntes = restantes.reduce((t, l) => t + Number(l.restante), 0);
    return { grupoId, existenciaRestante: totalAntes - cantidad };
  });
}

/** Margen del servidor para deshacer; la interfaz ofrece 10 segundos. */
export const VENTANA_DESHACER_MS = 60_000;

/**
 * Deshace un consumo reciente borrando sus movimientos. Devuelve false si ya
 * no existe o si pasó la ventana para deshacer.
 */
export async function deshacerConsumo(grupoId: string, ahora = new Date()): Promise<boolean> {
  const limite = new Date(ahora.getTime() - VENTANA_DESHACER_MS);
  const borrados = await getDb()
    .delete(movimiento)
    .where(and(eq(movimiento.grupoId, grupoId), eq(movimiento.tipo, "consumo"), gt(movimiento.fecha, limite)))
    .returning({ id: movimiento.id });
  return borrados.length > 0;
}
