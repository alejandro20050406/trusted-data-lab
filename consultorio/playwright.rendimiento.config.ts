import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

const PUERTO = 3200;

/**
 * Medición de carga del panel (A-09) contra el build de producción
 * (`next build` + `next start`), con red 4G y CPU de gama media simuladas en
 * la prueba. Usa la base PGlite en memoria, no Neon: no mide el arranque en
 * frío de Neon.
 */
export default defineConfig({
  ...base,
  testDir: "./e2e/rendimiento",
  testIgnore: [],
  projects: [{ name: "celular-4g", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 740 } } }],
  use: { baseURL: `http://localhost:${PUERTO}` },
  webServer: {
    ...(Array.isArray(base.webServer) ? base.webServer[0] : base.webServer!),
    command: `npx next build && npx next start --port ${PUERTO}`,
    url: `http://localhost:${PUERTO}/login`,
    reuseExistingServer: false,
    timeout: 400_000,
    env: {
      ...(Array.isArray(base.webServer) ? base.webServer[0].env : base.webServer!.env),
      BETTER_AUTH_URL: `http://localhost:${PUERTO}`,
      NEXT_DIST_DIR: ".next-build",
    },
  },
});
