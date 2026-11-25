import { crearDbLocal } from "@/lib/db/local";
import { usarDb, type Db } from "@/lib/db";

/** Crea una base PGlite en memoria con las migraciones y la instala como `getDb()`. */
export async function prepararDb(): Promise<{ db: Db; cerrar: () => Promise<void> }> {
  const local = await crearDbLocal();
  usarDb(local.db);
  return {
    db: local.db,
    cerrar: async () => {
      usarDb(undefined);
      await local.cerrar();
    },
  };
}
