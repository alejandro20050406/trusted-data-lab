# Consultorio: inventario de insumos

App de Next.js (App Router) para el inventario del consultorio dental. Está separada del pipeline de datos de `src/`.

## Arranque local

1. `npm install`
2. Copia `.env.example` a `.env.local` y llena cada variable. `DATABASE_URL` es la cadena de tu rama de Neon (`dev-angel` o `dev-adrian`).
3. `npm run db:migrate` aplica las migraciones de `drizzle/` en tu rama.
4. `npm run db:seed` crea la cuenta de prueba de la dentista y los catálogos.
5. `npm run dev` y abre http://localhost:3000.

Sin Neon, `DATABASE_URL=pglite:memoria` levanta una base en memoria con las migraciones y el seed (se pierde al detener el servidor). Las pruebas de Playwright usan ese modo.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Revisión de tipos (antes, `npx next typegen` si no hay `.next/`) |
| `npx vitest run` | Pruebas de lógica, con PGlite en memoria |
| `npx playwright test` | Flujos de interfaz a 360 px y 1280 px |
| `npm run db:generate` | Genera una migración desde `lib/db/schema/` |

## Migraciones

Genera una migración a la vez y avísala en el chat del equipo para no repetir números. Angel es dueño de `lib/db/schema/nucleo.ts` e `inventario.ts`; Adrián, de `clinica.ts`.

## Contrato con Adrián

- `crearAviso(datos)` en `lib/avisos.ts`
- `registrarConsumo({ insumoId, cantidad, varianteId })` en `lib/inventario/consumo.ts`
- `historialPrecios(insumoId)` en `lib/inventario/precios.ts`
- `requireSession()` en `lib/sesion.ts`
