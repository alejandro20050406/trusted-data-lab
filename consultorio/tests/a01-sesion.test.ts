import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prepararDb } from "./ayuda-db";

const cabeceras = new Headers();
vi.mock("next/headers", () => ({ headers: async () => cabeceras }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

process.env.BETTER_AUTH_SECRET = "secreto-de-prueba-solo-para-vitest-0123456789";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.SEED_DENTISTA_EMAIL = "dentista@consultorio.test";
process.env.SEED_DENTISTA_PASSWORD = "clave-de-prueba-123";

let cerrar: () => Promise<void>;

beforeAll(async () => {
  const preparada = await prepararDb();
  cerrar = preparada.cerrar;
  const { sembrar } = await import("@/lib/db/seed");
  await sembrar(preparada.db);
  await sembrar(preparada.db); // idempotente
});

afterAll(async () => cerrar());

describe("A-01 inicio de sesión", () => {
  it("la dentista del seed inicia sesión con correo y contraseña", async () => {
    const { getAuth } = await import("@/lib/auth");
    const auth = getAuth();
    const respuesta = await auth.api.signInEmail({
      body: { email: "dentista@consultorio.test", password: "clave-de-prueba-123" },
      asResponse: true,
    });
    expect(respuesta.status).toBe(200);
    const cookie = respuesta.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("better-auth.session_token");

    cabeceras.set("cookie", cookie.split(";")[0]);
    const { requireSession } = await import("@/lib/sesion");
    const sesion = await requireSession();
    expect(sesion.user.email).toBe("dentista@consultorio.test");
  });

  it("rechaza una contraseña incorrecta", async () => {
    const { getAuth } = await import("@/lib/auth");
    const auth = getAuth();
    const respuesta = await auth.api.signInEmail({
      body: { email: "dentista@consultorio.test", password: "otra" },
      asResponse: true,
    });
    expect(respuesta.status).toBe(401);
  });

  it("no permite crear cuentas nuevas desde fuera", async () => {
    const { getAuth } = await import("@/lib/auth");
    const auth = getAuth();
    const respuesta = await auth.api.signUpEmail({
      body: { name: "X", email: "x@consultorio.test", password: "clave-larga-123" },
      asResponse: true,
    });
    expect(respuesta.ok).toBe(false);
  });

  it("requireSession redirige a /login sin sesión", async () => {
    vi.resetModules();
    cabeceras.delete("cookie");
    const { requireSession } = await import("@/lib/sesion");
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("Contrato con Adrián (firmas)", () => {
  it("exporta las funciones acordadas", async () => {
    const avisos = await import("@/lib/avisos");
    const consumo = await import("@/lib/inventario/consumo");
    const precios = await import("@/lib/inventario/precios");
    expect(typeof avisos.crearAviso).toBe("function");
    expect(typeof consumo.registrarConsumo).toBe("function");
    expect(typeof precios.historialPrecios).toBe("function");
  });
});
