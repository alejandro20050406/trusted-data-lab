# Prompt: implementar las tareas A-01 a A-14 de Angel

Copia todo lo que está debajo de la línea en una sesión nueva de Claude Code abierta en la raíz del repositorio `trusted-data-lab`.

---

Implementa las tareas **A-01 a A-14** del sistema de inventario odontológico descritas en `docs/sistema-insumos/plan-angel.md`. Ese plan es la fuente de verdad: léelo completo antes de empezar, junto con la sección "Contrato con Angel" de `docs/sistema-insumos/plan-adrian.md`, porque Adrián construirá su módulo sobre tu código.

## Alcance

- Haz solo A-01 a A-14, en ese orden.
- No hagas A-15 ni A-16 (prueba con la clienta, despliegue y manual).
- No hagas nada del plan de Adrián: pacientes, citas, escaneos, brackets caídos, tareas periódicas, PWA (`app/manifest.ts`, *service worker*, notificaciones push), gráfica de precios (D-13) ni reporte de colores de ligas (D-14). Tú preparas los datos que él usa (`historialPrecios()` y el consumo con color), pero no sus pantallas.
- No guardes datos de pacientes. Los modelos 3D están fuera de alcance.

## Stack fijo

No lo cambies sin preguntarme:

- Next.js (App Router) con TypeScript, en un directorio nuevo `consultorio/` en la raíz del repo, separado del pipeline de Python (`src/`).
- Neon (PostgreSQL) con `@neondatabase/serverless`, Drizzle ORM y `drizzle-kit`.
- Better Auth con correo y contraseña y el adaptador de Drizzle.
- Tailwind CSS y shadcn/ui; Zod en el servidor; Server Actions para las mutaciones.
- Vercel Cron para las rutas `/api/cron/...`, protegidas con `CRON_SECRET`.
- Vitest para la lógica y Playwright para los flujos de interfaz.

Antes de configurar cada librería, consulta su documentación oficial actual. Las APIs de Next.js, Better Auth y Drizzle cambian entre versiones: no programes de memoria.

## Git

- Crea la rama `feat/consultorio-angel` desde `main`. No toques los archivos sin seguimiento que ya existen en el repo (`datos/bronce/osm/lote-prueba/`, `datos/e2/mapa-prueba/`, `salida-e1-prueba-e2/`).
- Haz un commit por tarea, con mensaje que empiece con el ID (`feat(A-05): lista de inventario con nombre y cantidad`).
- No hagas `push` ni abras PR sin preguntarme.

## Credenciales

- No crees cuentas en Neon, Vercel ni otros servicios. Cuando necesites la base de datos, pídeme la cadena de conexión de mi rama de Neon `dev-angel` y espera.
- Guarda los secretos solo en `consultorio/.env.local`, que debe estar en `.gitignore`. Documenta cada variable sin valor en `consultorio/.env.example`.
- Genera `BETTER_AUTH_SECRET` y `CRON_SECRET` localmente. No los escribas en el chat ni en commits.
- Para el usuario de desarrollo de la dentista, usa credenciales de prueba definidas en el *seed* o en `.env.local`, no datos reales.

## Contrato con Adrián

Al terminar A-01, deja creadas y commiteadas las firmas de estas funciones, aunque solo lancen `Error("no implementado")`. Así Adrián puede programar contra ellas sin esperar:

- `crearAviso(datos)` en `consultorio/lib/avisos.ts`.
- `registrarConsumo({ insumoId, cantidad, varianteId })` en `consultorio/lib/inventario/consumo.ts`.
- `historialPrecios(insumoId)` en `consultorio/lib/inventario/precios.ts`.
- `requireSession()` para proteger páginas y Server Actions.

Respeta los nombres, campos y archivos del plan. Si necesitas cambiar una firma, pregúntame primero, porque afecta el código de Adrián. Tú eres dueño de `lib/db/schema/nucleo.ts` e `inventario.ts`; no crees `clinica.ts`.

## Decisiones pendientes con la clienta

No inventes estos valores. Déjalos como campos configurables, sin valor por defecto, y muéstralos como "Sin definir" en la interfaz:

- Cuántos días son válidas las ligas después de comprarlas (`vidaUtilDias`).
- La unidad en que se cuentan los pasantes para la resina.
- El mínimo de reserva de cada insumo (el *seed* puede cargar la caja de guantes de reserva que pidió la clienta).

## A-13: precios del observatorio

- Busca `oro_inventario.csv` en las salidas del pipeline E1 (`python -m src.e1 --salida <dir>`; revisa `docs/E1/ENTREGA.md`). Si no hay un archivo generado, dímelo; no fabriques precios.
- Conserva por registro la tienda, la URL, la fecha de captura y el `sha256` del archivo Bronce de origen.
- La correspondencia entre `insumo` y los productos del observatorio se revisa a mano. Crea la tabla y una forma simple de capturarla, pero no la llenes con coincidencias automáticas sin mostrármelas.

## Cómo trabajar cada tarea

1. Relee la tarea en el plan y su criterio de aceptación.
2. Escribe primero las pruebas de la lógica (Vitest) y después el código.
3. En tareas con interfaz, agrega una prueba de Playwright a 360 px y a 1280 px de ancho. Revisa el contraste WCAG AA y que los botones midan al menos 44×44 px.
4. Antes del commit, ejecuta `npm run lint`, `npx tsc --noEmit` y `npx vitest run`. Todo debe pasar. No desactives reglas, no uses `@ts-ignore` y no saltes pruebas para lograrlo.
5. Comprueba el criterio de aceptación. Si el criterio mide toques o tiempo, cuenta los toques del flujo en la prueba de Playwright.
6. Agrega una línea a `calidad/tiempo-angel.csv` con la fecha, la tarea, los minutos y una descripción. Si encontraste y corregiste un defecto, regístralo en `calidad/defectos-angel.csv`. Respeta las columnas existentes.

## Cuándo detenerte y preguntar

- Necesitas una credencial o crear una cuenta.
- Un criterio de aceptación es ambiguo o contradice otra parte del plan.
- Tienes que cambiar el stack, una firma del contrato o algo fuera de A-01 a A-14.
- Una prueba falla y no sabes por qué después de investigar la causa.

## Reporte final

Al terminar, entrégame una tabla con cada tarea de A-01 a A-14 que diga su estado (hecha, parcial o bloqueada), su commit y cómo verificaste el criterio de aceptación. Lista aparte lo que no pudiste verificar y las decisiones que tomaste sin preguntarme.
