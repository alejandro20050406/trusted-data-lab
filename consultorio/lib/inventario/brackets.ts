import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { diente, insumo } from "@/lib/db/schema";
import type { VarianteConExistencia } from "./consultas";

export interface DienteBrackets {
  fdi: number;
  nombre: string;
  cuadrante: number;
  arcada: "superior" | "inferior";
  /** Existencia por sistema y slot. */
  variantes: VarianteConExistencia[];
  total: number;
}

export interface ArcadaBrackets {
  arcada: "superior" | "inferior";
  dientes: DienteBrackets[];
}

/** Orden de lectura en boca: superior 18→11, 21→28; inferior 48→41, 31→38. */
function ordenClinico(fdi: number): number {
  const cuadrante = Math.floor(fdi / 10);
  const pieza = fdi % 10;
  const izquierda = cuadrante === 1 || cuadrante === 4;
  return (cuadrante <= 2 ? 0 : 100) + (izquierda ? 9 - pieza : 10 + pieza);
}

/** Agrupa las variantes de brackets por arcada y diente, con los 32 dientes aunque no tengan existencia. */
export function agruparBracketsPorDiente(
  dientes: readonly { fdi: number; nombre: string; cuadrante: number; arcada: "superior" | "inferior" }[],
  variantes: readonly VarianteConExistencia[],
): ArcadaBrackets[] {
  const porDiente = new Map<number, VarianteConExistencia[]>();
  for (const v of variantes) {
    if (v.dienteFdi === null) continue;
    porDiente.set(v.dienteFdi, [...(porDiente.get(v.dienteFdi) ?? []), v]);
  }
  const ordenados = [...dientes].sort((a, b) => ordenClinico(a.fdi) - ordenClinico(b.fdi));
  return (["superior", "inferior"] as const).map((arcada) => ({
    arcada,
    dientes: ordenados
      .filter((d) => d.arcada === arcada)
      .map((d) => {
        const propias = (porDiente.get(d.fdi) ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre));
        return { ...d, variantes: propias, total: propias.reduce((t, v) => t + v.existencia, 0) };
      }),
  }));
}

/** Id del insumo de brackets (el que usa variante por diente). */
export async function insumoBrackets(): Promise<{ id: number; nombre: string } | null> {
  const [fila] = await getDb()
    .select({ id: insumo.id, nombre: insumo.nombre })
    .from(insumo)
    .where(eq(insumo.tipoVariante, "diente"))
    .orderBy(asc(insumo.id))
    .limit(1);
  return fila ?? null;
}

export async function catalogoDientes() {
  return getDb().select().from(diente).orderBy(asc(diente.fdi));
}
