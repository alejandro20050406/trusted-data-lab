import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, schema } from "@/lib/db";

function crearAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      // Solo la dentista usa el sistema: la cuenta se crea con el seed.
      disableSignUp: true,
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof crearAuth>;

let instancia: Auth | undefined;

/**
 * Better Auth se crea al primer uso, no al importar el módulo, para que
 * `next build` no necesite conectarse a la base.
 */
export function getAuth(): Auth {
  instancia ??= crearAuth();
  return instancia;
}
