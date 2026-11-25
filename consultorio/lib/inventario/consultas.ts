import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { categoria, insumo, movimiento, variante } from "@/lib/db/schema";
import { estadoInsumo, type EstadoInsumo } from "./estado";
import { lotesConExistencia, type LoteConExistencia } from "./existencia";

export interface VarianteConExistencia {
  id: number;
  tipo: "color" | "diente";
  nombre: string;
  colorHex: string | null;
  dienteFdi: number | null;
  sistema: "metalico" | "estetico" | null;
  slot: string | null;
  existencia: number;
}

export interface InsumoConEstado {
  id: number;
  nombre: string;
  categoria: string;
  unidad: string | null;
  minimoReserva: number | null;
  diasAvisoCaducidad: number | null;
  vidaUtilDias: number | null;
  usaCaducidad: boolean;
  tipoVariante: "color" | "diente" | null;
  estado: EstadoInsumo;
  lotes: LoteConExistencia[];
  variantes: VarianteConExistencia[];
}

/** Todos los insumos activos con su estado calculado para `hoy`. */
export async function inventarioConEstado(hoy: string): Promise<InsumoConEstado[]> {
  const db = getDb();
  const [insumos, lotes, variantes] = await Promise.all([
    db
      .select({
        id: insumo.id,
        nombre: insumo.nombre,
        categoria: categoria.nombre,
        orden: categoria.orden,
        unidad: insumo.unidad,
        minimoReserva: insumo.minimoReserva,
        diasAvisoCaducidad: insumo.diasAvisoCaducidad,
        vidaUtilDias: insumo.vidaUtilDias,
        usaCaducidad: insumo.usaCaducidad,
        tipoVariante: insumo.tipoVariante,
      })
      .from(insumo)
      .innerJoin(categoria, eq(categoria.id, insumo.categoriaId))
      .where(eq(insumo.activo, true))
      .orderBy(asc(insumo.nombre)),
    lotesConExistencia(),
    db
      .select({
        id: variante.id,
        insumoId: variante.insumoId,
        tipo: variante.tipo,
        nombre: variante.nombre,
        colorHex: variante.colorHex,
        dienteFdi: variante.dienteFdi,
        sistema: variante.sistema,
        slot: variante.slot,
        existencia: sql<number>`coalesce(sum(${movimiento.cantidad}), 0)::int`,
      })
      .from(variante)
      .leftJoin(movimiento, eq(movimiento.varianteId, variante.id))
      .where(eq(variante.activo, true))
      .groupBy(variante.id)
      .orderBy(asc(variante.dienteFdi), asc(variante.nombre)),
  ]);

  return insumos.map(({ orden, ...i }) => {
    void orden;
    const propios = lotes.filter((l) => l.insumoId === i.id);
    return {
      ...i,
      estado: estadoInsumo(i, propios, hoy),
      lotes: propios,
      variantes: variantes
        .filter((v) => v.insumoId === i.id)
        .map(({ insumoId, ...v }) => {
          void insumoId;
          return { ...v, existencia: Number(v.existencia) };
        }),
    };
  });
}
