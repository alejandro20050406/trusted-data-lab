/**
 * Modo local sin Neon: si DATABASE_URL empieza con `pglite:`, el servidor
 * levanta una base PGlite en memoria con las migraciones y el seed. Se usa
 * en las pruebas de Playwright. En Vercel, DATABASE_URL apunta a Neon y esto
 * no hace nada.
 */
export async function register() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.NEXT_RUNTIME !== "nodejs" || !url.startsWith("pglite:")) return;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
    throw new Error("PGlite no se usa en producción.");
  }
  const { crearDbLocal } = await import("./lib/db/local");
  const { usarDb } = await import("./lib/db");
  const { sembrar } = await import("./lib/db/seed");
  const { db } = await crearDbLocal();
  usarDb(db);
  await sembrar(db);
}
