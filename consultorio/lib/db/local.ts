import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import type { Db } from "./index";

/**
 * Base PostgreSQL en memoria (PGlite) con las migraciones de `drizzle/`.
 * Solo para pruebas y para correr la app sin Neon (`DATABASE_URL=pglite:memoria`).
 */
export async function crearDbLocal(carpeta?: string): Promise<{ db: Db; cerrar: () => Promise<void> }> {
  const cliente = new PGlite(carpeta);
  const db = drizzle({ client: cliente, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db: db as unknown as Db, cerrar: () => cliente.close() };
}
