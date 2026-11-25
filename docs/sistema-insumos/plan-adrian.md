# Plan de implementación: Adrián

**Sistema:** inventario de insumos odontológicos para el consultorio de la dentista clienta.
**Responsable:** Adrián.
**Compañero:** Angel (base del sistema, diseño, inventario, compras y precios de referencia). Su plan está en [plan-angel.md](plan-angel.md).

**Entrega:** 4 de diciembre de 2026. Todas las tareas se entregan juntas en una sola entrega. Los bloques indican el orden de implementación según las dependencias; no son entregas parciales ni tienen fechas propias.

## Tu parte

Te corresponde el módulo clínico, los recordatorios, la app instalable y los reportes:

- Los pacientes, la última visita y el conteo de citas reagendadas.
- El registro con evidencia de los brackets que tumban los pacientes.
- El escaneo de archivos de pacientes.
- Los recordatorios periódicos de esterilización y de recolección de residuos.
- La instalación del sistema como app en el celular (PWA) y las notificaciones.
- Los reportes de variación de precios y de colores de ligas más usados.

## Features asignadas

| Feature solicitada | Tareas |
|---|---|
| Escanear archivos de pacientes para llevar un registro | D-05, D-06 |
| Evidencia de cuáles brackets tumban los pacientes | D-07, D-08 |
| Última vez que vino cada paciente | D-03, D-04 |
| Cuántas veces reagendan citas | D-03, D-04 |
| Esterilización de piezas: guardar la fecha para que se realice periódicamente | D-09, D-10 |
| Avisos de recolección de residuos cada dos meses | D-09, D-11 |
| Que se pueda usar en celular (instalación como app y notificaciones) | D-02, D-12 |
| Comparativa de precios personales para observar la variación (gráfica) | D-13 |
| Colores de ligas más usados para comprar más de determinado color (reporte) | D-14 |
| Fácil de usar, sin muchos botones (aplica a todas tus pantallas) | Todas; usa los componentes de Angel |

## Fuera de alcance por ahora

- **Modelos 3D y simulaciones con dientes removibles.** Los modelos de la clienta llegan en una sola pieza y separar los dientes requiere trabajo manual por paciente. Se retoma cuando la clienta confirme para qué usa las demostraciones (modelo genérico o boca de cada paciente) y si su escáner puede exportar los dientes separados.

## Decisiones técnicas compartidas

Ambos planes usan las mismas decisiones. Cualquier cambio se acuerda entre los dos antes de aplicarlo.

- **Framework:** Next.js (App Router) con TypeScript. Un solo código para escritorio y celular.
- **Base de datos:** Neon (PostgreSQL *serverless*), con el driver `@neondatabase/serverless`.
- **ORM y migraciones:** Drizzle ORM y `drizzle-kit`.
- **Ramas de base de datos:** cada integrante trabaja en su propia rama de Neon (`dev-angel`, `dev-adrian`) creada desde `main`. Las ramas de vista previa de cada PR usan otra rama de Neon.
- **Inicio de sesión:** Better Auth con correo y contraseña y el adaptador de Drizzle. Las tablas de sesión viven en Neon.
- **Archivos:** Neon no guarda archivos. Los escaneos y fotos van a un bucket **privado** de Cloudflare R2 (compatible con S3). Se sirven solo con URL firmadas de corta duración, después de verificar la sesión.
- **Interfaz:** Tailwind CSS y componentes de shadcn/ui, con la paleta azul que define Angel. Diseño *mobile-first*.
- **Mutaciones:** Server Actions de Next.js, con validación de Zod en el servidor.
- **Gráficas:** Recharts.
- **Tareas diarias:** Vercel Cron llama a rutas protegidas (`/api/cron/...`) con un secreto en el encabezado.
- **Hospedaje:** Vercel, con las variables de entorno de Neon y R2.
- **Pruebas:** Vitest para la lógica y Playwright para los flujos principales en tamaño celular y escritorio.
- **Ubicación:** directorio nuevo `consultorio/` separado del pipeline de datos (`src/`).
- **Ramas de Git:** una rama por tarea (`feat/d-03-pacientes`), con PR revisado por el compañero.

## Contrato con Angel

Angel construye estas piezas primero (su Bloque 1). Úsalas tal como están; si necesitas un cambio, pídelo en su PR o en un issue.

1. **Tabla `diente`:** catálogo FDI de 32 dientes permanentes (11–48) con nombre, cuadrante y arcada. Lo usas para los brackets caídos.
2. **Tabla `aviso` y función `crearAviso()` en `lib/avisos.ts`:** creas con ella los avisos de esterilización y residuos con `origen: "esterilizacion"` u `origen: "residuos"`. El panel de inicio de Angel los muestra; tú no creas otro panel de avisos.
3. **Función `registrarConsumo({ insumoId, cantidad, varianteId })`:** la llamas al registrar un bracket caído.
4. **Consulta `historialPrecios(insumoId)` y movimientos de consumo con color:** son los datos de tus reportes D-13 y D-14.
5. **Diseño base y componentes:** layout, barra inferior, tarjeta, botones, formulario corto y confirmación con deshacer. No crees estilos propios.
6. **Sesión:** `requireSession()` protege cada página y cada Server Action tuya.
7. **Esquema por dueño:** eres dueño de `lib/db/schema/clinica.ts`. Las migraciones se generan una a la vez y se avisan en el chat del equipo.

**Mientras Angel termina la base:** haz D-01 y D-02, que no dependen del código de Angel.

## Bloques y tareas

Registra el tiempo real en `calidad/tiempo-adrian.csv` y los defectos en `calidad/defectos-adrian.csv`.

### Bloque 1 — Preparación (mientras Angel arma la base)

**D-01. Requisitos de datos de pacientes y protección.**
Los expedientes y escaneos son datos personales sensibles de salud. Documentar en `docs/sistema-insumos/datos-pacientes.md`: qué datos se guardan (mínimos necesarios), quién accede (solo la dentista), aviso de privacidad y consentimiento del paciente, tiempo de conservación y respaldo. Revisar con la clienta la Ley Federal de Protección de Datos Personales en Posesión de los Particulares y la NOM-004-SSA3-2012 del expediente clínico antes de guardar datos reales. Neon, R2 y Vercel guardan los datos fuera de México: anotar la región elegida y mencionarlo en el aviso de privacidad como transferencia a un proveedor.
*Criterio de aceptación:* documento revisado por Angel y por la clienta antes de iniciar D-05.
*Nota:* `docs/etica-datos.md` indica que el observatorio no recopila datos de pacientes. Este sistema es distinto, para uso de la dentista, y debe mantenerse separado del observatorio.

**D-02. Prueba técnica de la app instalable.**
Prototipo aislado en Next.js con `app/manifest.ts`, íconos y un *service worker* (Serwist) que guarde en caché los recursos estáticos. Probar la instalación y una notificación push de prueba en Android (Chrome) y en iPhone (Safari, "Agregar a inicio", iOS 16.4 o posterior).
*Criterio de aceptación:* nota con lo que funcionó en cada celular, en especial si las notificaciones llegan en el iPhone de la clienta.

### Bloque 2 — Pacientes y citas

**D-03. Esquema de pacientes y citas.**
Tablas `paciente` (nombre, teléfono, notas cortas, `activo`) y `cita` (paciente, `fechaHora`, `estado`: programada, atendida, reagendada, cancelada o no asistió; `citaOriginalId` para enlazar una cita reagendada con la que reemplaza). Calcular `ultimaVisita` como la última cita atendida y `vecesReagendada` como el número de citas reagendadas del paciente.
*Criterio de aceptación:* pruebas de Vitest de ambos cálculos, incluido el caso de una cita reagendada dos veces.

**D-04. Pantallas de pacientes y citas con pocos toques.**
Lista de pacientes con nombre, última visita ("hace 3 semanas") y una insignia si reagenda con frecuencia (p. ej. 3 veces o más; el umbral lo define la clienta). En la ficha del paciente, botones grandes "Atendida" y "Reagendar". "Reagendar" abre solo un selector de fecha y crea la nueva cita enlazada.
*Criterio de aceptación:* marcar una cita como atendida toma 1 toque y reagendarla toma 3 toques o menos.

**D-05. Escaneo de archivos de pacientes.**
En la ficha del paciente, botón "Escanear" que abre la cámara del celular (`<input type="file" accept="image/*,application/pdf" capture="environment">`) y permite varias páginas. En escritorio, el mismo botón permite arrastrar archivos. Guardar cada archivo en R2 con fecha, tipo (radiografía, consentimiento, receta, otro) y nombre automático; la tabla `archivo_paciente` en Neon guarda solo los metadatos y la llave del objeto. Comprimir imágenes antes de subirlas.
*Criterio de aceptación:* escanear y guardar una hoja toma 3 toques; los archivos no se pueden abrir sin sesión.
*Depende de:* D-01 aprobado.

**D-06. Seguridad del almacenamiento de archivos.**
Bucket de R2 privado. La subida usa una URL firmada que genera una Server Action después de `requireSession()`. La descarga pasa por una ruta que verifica la sesión y devuelve una URL firmada válida por 60 segundos. Llaves aleatorias, límite de tamaño, validación del tipo real del archivo y respaldo. Registrar quién y cuándo abrió cada archivo.
*Criterio de aceptación:* pruebas de que un usuario sin sesión recibe 401 o redirección al inicio de sesión y de que se rechaza un archivo con extensión falsa.

### Bloque 3 — Brackets y recordatorios

**D-07. Registro de brackets caídos.**
Tabla `bracket_caido` (paciente, diente, fecha, llave de foto opcional, nota). Pantalla con un odontograma simple (dos arcadas con los dientes como botones con su número FDI y nombre) donde un toque en el diente registra la caída con la fecha de hoy. La foto se toma con la cámara como en D-05. Después de registrar, ofrecer "Descontar bracket de reposición", que llama a `registrarConsumo()`.
*Criterio de aceptación:* registrar una caída toma 2 toques sin foto y 3 con foto.

**D-08. Reporte de brackets caídos.**
Reporte por paciente (cuántos brackets ha tumbado y de qué dientes) y general (dientes que se caen con más frecuencia y pacientes con más caídas en los últimos 90 días). Galería con la evidencia fotográfica.
*Criterio de aceptación:* los conteos coinciden con los registros en las pruebas.

**D-09. Motor de tareas periódicas.**
Tabla `tarea_periodica` (nombre, tipo: esterilización o residuos, `cadaDias`, `ultimaRealizacion`, `diasAnticipacion`). Calcular `proximaFecha`. Ruta `/api/cron/tareas` llamada una vez al día por Vercel Cron que crea avisos con `crearAviso()` cuando se acerca la fecha. Al marcar la tarea como hecha, se guarda la fecha real y se cierra el aviso.
*Criterio de aceptación:* pruebas con fechas fijas para tarea al día, próxima, vencida y realizada; sin avisos duplicados; la ruta rechaza llamadas sin el secreto.

**D-10. Esterilización de piezas.**
Registrar cada ciclo de esterilización con fecha, piezas o paquetes y nota opcional. Configurar la periodicidad con la clienta. Botón de un toque "Esterilización hecha hoy" en el aviso y en la pantalla de la tarea.
*Criterio de aceptación:* el historial muestra la fecha de cada ciclo y la próxima fecha programada.
*Pendiente con la clienta:* periodicidad exacta y si se registra por pieza, por paquete o por ciclo de autoclave.

**D-11. Recolección de residuos cada dos meses.**
Tarea periódica precargada con `cadaDias = 60` y aviso con 7 días de anticipación (ajustable). Guardar la fecha real de cada recolección y, si la clienta lo usa, el número de manifiesto o comprobante del recolector.
*Criterio de aceptación:* después de marcar una recolección, la próxima fecha aparece 60 días después.

### Bloque 4 — App instalable, reportes y cierre

**D-12. PWA y notificaciones en el sistema real.**
Llevar el prototipo de D-02 a `consultorio/`: manifiesto, íconos con los colores de Angel, *service worker* y aviso claro cuando se pierde la conexión. Si D-02 confirmó que funcionan, agregar notificaciones push (Web Push con llaves VAPID) para los avisos de prioridad alta de inventario, esterilización y residuos. Guardar las suscripciones en una tabla `suscripcion_push`.
*Criterio de aceptación:* el sistema se instala en Android y en iPhone; una tarea vencida genera una notificación en el celular de prueba.

**D-13. Gráfica de variación de precio.**
En el detalle de cada insumo, gráfica de línea del precio unitario por fecha y proveedor con `historialPrecios()` de Angel. Mostrar el último precio, el mínimo y el cambio porcentual respecto a la compra anterior, con una tabla de respaldo. Debe leerse en celular.
*Criterio de aceptación:* con al menos 2 compras se ve la variación; con 1 compra se muestra un mensaje claro en lugar de una gráfica vacía.

**D-14. Reporte de colores de ligas más usados.**
Consumo por color en los últimos 30, 90 y 365 días, con el porcentaje de cada color, usando los movimientos de consumo de Angel. Sugerir cantidades de compra por color según el consumo. Mostrar el color con su nombre escrito, no solo como muestra de color.
*Criterio de aceptación:* el reporte coincide con los movimientos de consumo en las pruebas.

**D-15. Prueba de uso con la clienta.**
Junto con la sesión de Angel (A-15): registrar una cita reagendada, escanear un documento, registrar un bracket caído, marcar una esterilización, instalar la app y revisar los dos reportes. Medir toques y tiempo por tarea.
*Criterio de aceptación:* resultados agregados a `docs/sistema-insumos/prueba-uso.md`.

**D-16. Correcciones y manual de tu módulo.**
Aplicar los cambios de prioridad alta y agregar tu sección a la guía de una página.
*Criterio de aceptación:* la dentista usa pacientes, recordatorios y reportes sin ayuda.

## Coordinación con Angel

- **Al inicio:** tú haces D-01 y D-02 mientras Angel arma la base. Revisa su PR para confirmar que `diente`, `aviso`, `registrarConsumo()` y los componentes te sirven.
- **Revisión cruzada:** cada PR tuyo lo revisa Angel y cada PR suyo lo revisas tú.
- **Carpetas:** eres dueño de `lib/db/schema/clinica.ts`, `lib/clinica/`, `lib/archivos/`, `app/(app)/pacientes/`, `app/(app)/tareas/`, `app/(app)/reportes/`, `app/manifest.ts` y el *service worker*. Lo de Angel (`nucleo`, `inventario`, `components/ui/`) se cambia por issue o PR.
- **Puntos de integración:** `crearAviso()`, `registrarConsumo()` e `historialPrecios()`. Pruébenlos juntos antes de D-15.
- **Dependencias:** D-07 necesita `registrarConsumo()` (A-08) y los brackets por diente (A-11); D-13 necesita `historialPrecios()` (A-12); D-14 necesita el consumo con color (A-08). Si alguna no está lista, programa contra su firma acordada y conéctala al final.
- **Reunión corta:** dos veces por semana, 15 minutos, para revisar bloqueos.

## Riesgos

- **Datos de salud:** no usar datos reales de pacientes hasta terminar D-01 y D-06. En desarrollo, usar pacientes ficticios y la rama `dev-adrian` de Neon.
- **Notificaciones en iPhone:** solo funcionan con la app instalada en la pantalla de inicio. Si fallan, los avisos siguen apareciendo en el panel de inicio.
- **Vercel Cron en el plan gratuito:** las tareas diarias pueden ejecutarse con retraso dentro del día. Los avisos se calculan por fecha, no por hora, así que el retraso no cambia el resultado.
