import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** Base de datos con el esquema completo. La usan Neon y, en pruebas, PGlite. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const global_ = globalThis as unknown as { __consultorioDb?: Db };

/** Permite a las pruebas y al modo local usar otra base (PGlite). */
export function usarDb(db: Db | undefined): void {
  global_.__consultorioDb = db;
}

/**
 * Conexión a Neon con el driver de WebSocket (Pool), que admite transacciones.
 * Se crea al primer uso para que el build no exija DATABASE_URL.
 */
export function getDb(): Db {
  if (!global_.__consultorioDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("Falta DATABASE_URL. Revisa consultorio/.env.example.");
    }
    if (url.startsWith("pglite:")) {
      throw new Error("La base PGlite local aún no está lista; espera a que arranque el servidor.");
    }
    global_.__consultorioDb = drizzle({ client: new Pool({ connectionString: url }), schema });
  }
  return global_.__consultorioDb;
}

export { schema };
