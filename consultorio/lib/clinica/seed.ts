import type { Db } from "@/lib/db";
import { tareaPeriodica } from "@/lib/db/schema";

/**
 * Tareas periódicas precargadas. Idempotente.
 * - Residuos: cada 60 días con aviso 7 días antes (D-11, ajustable).
 * - Esterilización: la periodicidad queda "Sin definir" hasta acordarla con la clienta (D-10).
 */
export async function sembrarClinica(db: Db): Promise<void> {
  await db
    .insert(tareaPeriodica)
    .values([
      { nombre: "Esterilización de piezas", tipo: "esterilizacion", cadaDias: null, diasAnticipacion: 0 },
      { nombre: "Recolección de residuos", tipo: "residuos", cadaDias: 60, diasAnticipacion: 7 },
    ])
    .onConflictDoNothing({ target: tareaPeriodica.nombre });
}
