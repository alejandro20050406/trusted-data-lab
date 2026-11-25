# Plan de implementación: Angel

**Sistema:** inventario de insumos odontológicos para el consultorio de la dentista clienta.
**Responsable:** Angel.
**Compañero:** Adrián (pacientes, citas, brackets caídos, expedientes, recordatorios periódicos, app instalable y reportes). Su plan está en [plan-adrian.md](plan-adrian.md).

**Entrega:** 4 de diciembre de 2026. Todas las tareas se entregan juntas en una sola entrega. Los bloques indican el orden de implementación según las dependencias; no son entregas parciales ni tienen fechas propias.

## Tu parte

Te corresponden la base del sistema y el módulo de inventario y compras:

- La estructura del proyecto, la base de datos, el inicio de sesión, el diseño visual (azul con buen contraste) y los componentes compartidos.
- El panel que aparece al abrir el sistema, con el inventario y los avisos.
- El inventario: existencias, mínimos de reserva, caducidades, lotes con fecha de compra y consumo rápido.
- Las compras, el precio por unidad y el aviso de recompra con precios de referencia.

## Features asignadas

| Feature solicitada | Tareas |
|---|---|
| Fácil de usar e intuitivo, azul con buen contraste | A-02, A-03 |
| Uso en celular (diseño adaptable; la instalación como app es de Adrián) | A-03 |
| No requiere muchas acciones ni muchos botones | A-03, A-07, A-08 |
| Inventario al abrir el sistema | A-09 |
| Guarda el inventario y avisa cuántos quedan (reserva mínima, p. ej. una caja de guantes) | A-04, A-06, A-09, A-10 |
| Mostrar solo el nombre de los insumos, con la cantidad junto al nombre | A-05 |
| Fechas de caducidad (resina, anestesia) y aviso antes de caducar | A-06, A-10 |
| Inventario de brackets y nombres de los dientes | A-04, A-11 |
| Ligas intermaxilares en inventario | A-04 |
| Inventario de pasantes para resina, anestesia, jeringas y fresas para limpieza | A-04 |
| Fecha exacta de compra de las ligas para saber si siguen siendo válidas | A-06, A-10 |
| Comparativa de precios personales (datos y precio por unidad; la gráfica es de Adrián) | A-12 |
| Colores de ligas más usados (registro del color al consumir; el reporte es de Adrián) | A-08 |
| Aviso: "ya casi no tienes ligas, cómprate de estas (están baratas)" | A-13, A-14 |

## Decisiones técnicas compartidas

Ambos planes usan las mismas decisiones. Cualquier cambio se acuerda entre los dos antes de aplicarlo.

- **Framework:** Next.js (App Router) con TypeScript. Un solo código para escritorio y celular.
- **Base de datos:** Neon (PostgreSQL *serverless*), con el driver `@neondatabase/serverless`.
- **ORM y migraciones:** Drizzle ORM y `drizzle-kit`.
- **Ramas de base de datos:** cada integrante trabaja en su propia rama de Neon (`dev-angel`, `dev-adrian`) creada desde `main`. Las ramas de vista previa de cada PR usan otra rama de Neon.
- **Inicio de sesión:** Better Auth con correo y contraseña y el adaptador de Drizzle. Las tablas de sesión viven en Neon.
- **Archivos:** Neon no guarda archivos. Los escaneos y fotos van a un bucket **privado** de Cloudflare R2 (compatible con S3). Se sirven solo con URL firmadas de corta duración, después de verificar la sesión.
- **Interfaz:** Tailwind CSS y componentes de shadcn/ui, con la paleta azul de este plan. Diseño *mobile-first*.
- **Mutaciones:** Server Actions de Next.js, con validación de Zod en el servidor.
- **Gráficas:** Recharts.
- **Tareas diarias:** Vercel Cron llama a rutas protegidas (`/api/cron/...`) con un secreto en el encabezado.
- **Hospedaje:** Vercel, con las variables de entorno de Neon y R2.
- **Pruebas:** Vitest para la lógica y Playwright para los flujos principales en tamaño celular y escritorio.
- **Ubicación:** directorio nuevo `consultorio/` separado del pipeline de datos (`src/`).
- **Ramas de Git:** una rama por tarea (`feat/a-04-inventario`), con PR revisado por el compañero.

## Contrato con Adrián

Estas piezas las construyes tú y Adrián las usa. Constrúyelas primero (Bloque 1) para que él no quede bloqueado.

1. **Tabla `diente`:** catálogo de 32 dientes permanentes con notación FDI (11–48), nombre (p. ej. "Incisivo central superior derecho"), cuadrante y arcada. Se carga con un *seed*.
2. **Tabla `aviso` y función `crearAviso()` en `lib/avisos.ts`:** campos `tipo`, `titulo`, `detalle`, `prioridad` (alta, media, baja), `fechaVencimiento`, `urlAccion`, `origen` (`inventario`, `esterilizacion`, `residuos`, …) y `atendido`. Adrián crea avisos con `crearAviso(...)` y tú los muestras en el panel.
3. **Función `registrarConsumo({ insumoId, cantidad, varianteId })` en `lib/inventario/consumo.ts`:** Adrián la llama al registrar un bracket caído.
4. **Diseño base:** `app/(app)/layout.tsx`, barra de navegación inferior para celular y componentes: tarjeta, botón primario, botón de un toque, formulario corto y mensaje de confirmación con opción de deshacer. Adrián reutiliza estos componentes y no crea estilos propios.
5. **Sesión:** función `requireSession()` que protege cada página y cada Server Action.
6. **Esquema por dueño:** tú eres dueño de `lib/db/schema/nucleo.ts` e `inventario.ts`; Adrián, de `clinica.ts`. Las migraciones se generan una a la vez y se avisan en el chat del equipo para no crear dos migraciones con el mismo número.

## Bloques y tareas

Registra el tiempo real en `calidad/tiempo-angel.csv` y los defectos en `calidad/defectos-angel.csv`.

### Bloque 1 — Base del proyecto (va primero)

**A-01. Crear el proyecto y conectar Neon.**
Crear `consultorio/` con `create-next-app` (TypeScript, Tailwind, App Router, ESLint). Configurar Drizzle con Neon, `drizzle.config.ts`, las ramas de Neon de cada integrante, Better Auth y `requireSession()`. Agregar un workflow `.github/workflows/consultorio.yml` que ejecute `lint`, `tsc` y Vitest.
*Criterio de aceptación:* CI pasa; `npm run dev` arranca con un `.env.example` documentado y la dentista puede iniciar sesión.

**A-02. Sistema de diseño azul con contraste.**
Definir los colores en Tailwind y en las variables de shadcn/ui: azul primario, azul oscuro para texto sobre fondo claro, alerta (rojo), advertencia (ámbar) y correcto (verde). Todo texto cumple WCAG AA (4.5:1 en texto normal, 3:1 en texto grande e íconos). El color nunca es el único indicador: cada estado lleva ícono o texto.
*Criterio de aceptación:* página `/estilo` con todos los componentes y una tabla de contrastes medidos.

**A-03. Diseño base y componentes compartidos.**
Layout *mobile-first*: barra inferior con 4 secciones como máximo (Inicio, Inventario, Pacientes, Más) en celular y barra lateral en escritorio. Botones de al menos 44×44 px y texto de 16 px como mínimo. Crear los componentes del Contrato 4.
*Criterio de aceptación:* se ve bien a 360 px y 1280 px de ancho y Adrián puede usarlo.

**A-04. Esquema de inventario, `diente` y `aviso`.**
Tablas `categoria`, `insumo` (nombre, categoría, unidad, `minimoReserva`, `diasAvisoCaducidad`, `vidaUtilDias` opcional, `controlaLote`), `lote` (insumo, cantidad, `fechaCompra`, `fechaCaducidad` opcional, proveedor, precio, presentación), `movimiento` (entrada, consumo o ajuste, con fecha y cantidad) y `variante` (color de ligas o diente de los brackets). Incluir `diente` y `aviso` del contrato. *Seed* con las categorías iniciales: guantes, resinas, pasantes para resina, anestesia, jeringas, fresas para limpieza, brackets, ligas y ligas intermaxilares.
*Criterio de aceptación:* migración aplicada en la rama de Neon, *seed* cargado y pruebas de existencia calculada desde los movimientos.
*Confirmado con la clienta:* los pasantes para la resina son un producto propio que se inventaría como cualquier otro insumo. Falta confirmar en qué unidad se cuentan.

### Bloque 2 — Inventario usable

**A-05. Lista de inventario con nombre y cantidad.**
Cada fila muestra solo el nombre del insumo y, junto a él, la cantidad disponible con su unidad (p. ej. "Guantes · 2 cajas"). La cantidad lleva un color de estado con ícono o texto. Marca, proveedor, lote y precio aparecen solo al tocar el insumo. Búsqueda instantánea por nombre.
*Criterio de aceptación:* la dentista localiza un insumo en menos de 5 segundos y la lista no muestra datos distintos del nombre y la cantidad.

**A-06. Reglas de existencia, reserva, caducidad y validez.**
Función `estadoInsumo()` que calcula la existencia total, la compara con `minimoReserva` y revisa cada lote: caducidad próxima (`diasAvisoCaducidad`, p. ej. 30 días para resina y anestesia) y validez por fecha de compra (`vidaUtilDias`, p. ej. para ligas). El consumo sigue el orden FEFO: primero el lote que caduca antes.
*Criterio de aceptación:* pruebas de Vitest con fechas fijas para cada caso: suficiente, en reserva, agotado, por caducar, caducado y liga vencida por antigüedad.
*Pendiente con la clienta:* cuántos días se consideran válidas las ligas después de comprarlas. El sistema no debe inventar ese número.

**A-07. Registro de compra en un paso.**
Formulario corto: insumo, cantidad y precio. La fecha de compra se llena con la de hoy y puede editarse. Los campos de caducidad y variante (color o diente) aparecen solo si el insumo los usa. Se recuerda el último proveedor de cada insumo.
*Criterio de aceptación:* registrar una compra toma 3 toques y como máximo 2 campos escritos.

**A-08. Consumo de un toque y color de ligas.**
Botón "−1" junto a cada insumo y botón "−N" con cantidades frecuentes, ambos con actualización optimista. Para ligas, el botón muestra los colores disponibles como círculos de color con su nombre escrito; cada consumo guarda el color para el reporte de Adrián. Cada consumo puede deshacerse durante 10 segundos. Exponer `registrarConsumo()` del contrato.
*Criterio de aceptación:* descontar un insumo toma 1 toque y descontar una liga de un color toma 2 toques.

**A-09. Panel de inicio con inventario y avisos.**
Al abrir el sistema se ve primero: (1) avisos pendientes ordenados por prioridad, incluidos los de Adrián; (2) insumos en reserva o agotados; (3) lotes por caducar. Cada aviso tiene un botón de acción directa ("Registrar compra", "Marcar como hecho").
*Criterio de aceptación:* el panel carga en menos de 2 segundos en un celular de gama media con 4G y los avisos de prioridad alta se ven sin desplazarse.

**A-10. Generación automática de avisos de inventario.**
Ruta `/api/cron/inventario` llamada una vez al día por Vercel Cron y función que también se ejecuta al abrir el panel. Crea avisos con `crearAviso()` para reserva baja ("Te queda 1 caja de guantes; la reserva es 1 caja"), caducidad próxima y ligas vencidas por antigüedad. No duplica avisos abiertos y los cierra al reponer el insumo.
*Criterio de aceptación:* pruebas de que no se repiten avisos, de que se cierran solos y de que la ruta rechaza llamadas sin el secreto.

**A-11. Inventario de brackets por diente.**
Vista de brackets agrupada por arcada y diente, con el nombre del diente y su número FDI. Permite registrar existencias por diente, sistema (metálico, estético) y slot.
*Criterio de aceptación:* la dentista ve cuántos brackets quedan para cada diente y Adrián puede descontarlos con `registrarConsumo()`.

### Bloque 3 — Compras inteligentes

**A-12. Historial de precios y precio por unidad.**
Cada compra guarda precio total, cantidad y presentación. Calcular el precio por unidad para comparar presentaciones distintas (p. ej. caja de 100 guantes frente a caja de 50). Exponer una consulta `historialPrecios(insumoId)` que Adrián usa para la gráfica.
*Criterio de aceptación:* pruebas del cálculo con presentaciones distintas.

**A-13. Importar precios de referencia del observatorio.**
Tabla `precio_referencia` (producto, tienda, precio, presentación, URL, `fechaCaptura`, `sha256` del archivo Bronce de origen). Script que lee `oro_inventario.csv` del pipeline E1 y lo carga en Neon; puede escribirse en Python con `psycopg` para reutilizar el código de `src/`. Tabla de correspondencias entre `insumo` y los productos del observatorio, revisada a mano.
*Criterio de aceptación:* importar dos veces el mismo archivo no duplica registros y cada precio conserva su fuente y fecha.

**A-14. Aviso de recompra con la opción más barata.**
Cuando las ligas (o cualquier insumo) llegan a la reserva, el aviso incluye la opción más barata conocida: primero el historial personal y después el precio más reciente del observatorio. El aviso muestra la fuente y la fecha, y aclara que el precio puede haber cambiado.
*Criterio de aceptación:* el aviso nunca muestra un precio sin fecha ni fuente; si no hay datos, muestra solo la cantidad restante.

### Bloque 4 — Cierre (antes de la entrega)

**A-15. Prueba de uso con la clienta.**
Sesión de 30 minutos con la dentista en su celular y en su computadora. Tareas: ver qué falta, registrar una compra, descontar ligas de un color y revisar una caducidad. Medir toques y tiempo por tarea, y anotar dudas.
*Criterio de aceptación:* resultados en `docs/sistema-insumos/prueba-uso.md` con los cambios priorizados.

**A-16. Correcciones, despliegue y manual corto.**
Aplicar los cambios de prioridad alta, desplegar en Vercel con la rama `main` de Neon y escribir una guía de una página con capturas.
*Criterio de aceptación:* la dentista usa el sistema sin ayuda.

## Coordinación con Adrián

- **Primero:** terminar A-01 a A-04 y avisarle. Él crea su rama de Neon desde `main` y empieza su esquema.
- **Firmas desde el inicio:** define el primer día los nombres y parámetros de `crearAviso()`, `registrarConsumo()` e `historialPrecios()`, aunque todavía no hagan nada. Así Adrián programa contra ellas sin esperar a que estén terminadas.
- **Revisión cruzada:** cada PR tuyo lo revisa Adrián y cada PR suyo lo revisas tú.
- **Carpetas:** eres dueño de `lib/db/schema/nucleo.ts`, `lib/db/schema/inventario.ts`, `lib/avisos.ts`, `lib/inventario/`, `components/ui/` y `app/(app)/inventario/`. Si Adrián necesita cambiarlos, lo pide en el PR o en un issue.
- **Puntos de integración:** `crearAviso()`, `registrarConsumo()` e `historialPrecios()`. Pruébenlos juntos antes del Bloque 4.
- **Reunión corta:** dos veces por semana, 15 minutos, para revisar bloqueos.

## Riesgos

- **Precios del observatorio:** la captura actual cubre pocas tiendas y no garantiza precio ni disponibilidad. El aviso de A-14 debe decirlo.
- **Migraciones en paralelo:** dos migraciones generadas a la vez pueden chocar. Generarlas una a la vez (Contrato 6).
- **Arranque en frío de Neon:** el plan gratuito suspende la base tras un tiempo sin uso y la primera consulta tarda más. Medirlo en A-09; si afecta el panel, ajustar la suspensión automática o el plan.
