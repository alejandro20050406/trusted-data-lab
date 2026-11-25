import { defineConfig, devices } from "@playwright/test";

const PUERTO = 3100;

/**
 * Las pruebas de interfaz corren contra `next dev` con una base PGlite en
 * memoria (DATABASE_URL=pglite:memoria), así no tocan ninguna rama de Neon.
 * Las credenciales son solo de prueba.
 */
export const E2E_DENTISTA = { email: "dentista@consultorio.test", password: "clave-e2e-solo-pruebas" };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PUERTO}`, trace: "retain-on-failure" },
  projects: [
    { name: "celular-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 }, hasTouch: true } },
    { name: "escritorio-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx next dev --port ${PUERTO}`,
    url: `http://localhost:${PUERTO}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: "pglite:memoria",
      BETTER_AUTH_SECRET: "secreto-e2e-solo-para-pruebas-0123456789abcdef",
      BETTER_AUTH_URL: `http://localhost:${PUERTO}`,
      CRON_SECRET: "cron-e2e-solo-pruebas",
      SEED_DENTISTA_EMAIL: E2E_DENTISTA.email,
      SEED_DENTISTA_PASSWORD: E2E_DENTISTA.password,
      SEED_DENTISTA_NOMBRE: "Dentista de prueba",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
