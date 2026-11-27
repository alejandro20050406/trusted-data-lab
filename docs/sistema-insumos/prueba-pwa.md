# Prueba técnica de la app instalable (D-02)

**Responsable:** Adrián. **Fecha:** 27 de noviembre de 2026.

## Decisión técnica

El prototipo se hizo directamente dentro de `consultorio/` (no como proyecto aislado) porque no depende del código de Angel y así D-12 no repite trabajo:

- `app/manifest.ts`: manifiesto con nombre, colores azules de Angel y tres íconos (192, 512 y *maskable* 512).
- `app/iconos/[nombre]/route.ts` y `app/apple-icon.tsx`: íconos PNG generados con `next/og`, sin archivos binarios en el repositorio.
- `app/sw.js/route.ts` + `lib/pwa/service-worker.ts`: *service worker* escrito a mano siguiendo la guía de PWA de Next.js 16, en lugar de Serwist. Motivo: Serwist necesita un plugin de compilación y el proyecto usa Turbopack; el caso de uso solo requiere caché de estáticos, una página sin conexión y `push`. **Cambio respecto al plan compartido; Angel debe aprobarlo en la revisión del PR.**
- El *service worker* guarda en caché solo `/_next/static/` y los íconos. **Nunca** guarda páginas ni respuestas de `/api`, porque contienen datos de pacientes.

## Qué se verificó automáticamente (Playwright, Chromium de escritorio)

| Comprobación | Resultado |
|---|---|
| `/manifest.webmanifest` responde con `display: standalone`, `start_url`, `theme_color` | Ver resultados de `e2e/d07-d14-clinica.spec.ts` en el PR |
| Los tres íconos responden `200 image/png` | Ídem |
| `/sw.js` se sirve como JavaScript sin caché HTTP y queda activo | Ídem |
| Franja "Sin conexión" al cortar la red | Ídem |
| Envío de push con suscripción falsa; suscripción vencida (410) se borra | `tests/d12-d14-push-reportes.test.ts` |

## Pendiente en celulares reales (no se puede automatizar)

Requiere la app desplegada con HTTPS (vista previa de Vercel) y las llaves VAPID configuradas (`npx web-push generate-vapid-keys`).

| Prueba | Android (Chrome) | iPhone de la clienta (Safari, iOS ≥ 16.4) |
|---|---|---|
| Aparece "Instalar app" / "Agregar a inicio" | _pendiente_ | _pendiente_ |
| Abre a pantalla completa con el ícono azul | _pendiente_ | _pendiente_ |
| "Activar notificaciones" pide permiso | _pendiente_ | _pendiente (solo desde la app instalada)_ |
| "Enviar una de prueba" llega con la app cerrada | _pendiente_ | _pendiente_ |
| Tocar la notificación abre el aviso | _pendiente_ | _pendiente_ |
| Versión de sistema | | |

Si las notificaciones no llegan en el iPhone, los avisos siguen en el panel de inicio (riesgo ya previsto en el plan).
