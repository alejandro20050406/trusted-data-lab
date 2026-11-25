import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las pruebas de Playwright usan otra carpeta para no chocar con `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Cache Components queda apagado: todas las pantallas leen la sesión y datos
  // que cambian en cada visita, así que se renderizan de forma dinámica.
  cacheComponents: false,
  // PGlite solo se carga en pruebas locales (ver instrumentation.ts).
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
