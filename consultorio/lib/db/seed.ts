import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import type { Db } from "./index";
import { account, user } from "./schema";

/**
 * Crea la cuenta de prueba de la dentista con las variables SEED_DENTISTA_*.
 * Es idempotente: si el correo ya existe, no hace nada.
 */
export async function sembrarDentista(db: Db): Promise<void> {
  const email = process.env.SEED_DENTISTA_EMAIL;
  const password = process.env.SEED_DENTISTA_PASSWORD;
  const nombre = process.env.SEED_DENTISTA_NOMBRE || "Dentista";
  if (!email || !password) {
    throw new Error("Faltan SEED_DENTISTA_EMAIL y SEED_DENTISTA_PASSWORD en .env.local.");
  }
  const existente = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existente.length > 0) return;

  const id = randomUUID();
  const ahora = new Date();
  await db.insert(user).values({ id, name: nombre, email, emailVerified: true, createdAt: ahora, updatedAt: ahora });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(password),
    createdAt: ahora,
    updatedAt: ahora,
  });
}

/** Seed completo e idempotente. */
export async function sembrar(db: Db): Promise<void> {
  await sembrarDentista(db);
}
