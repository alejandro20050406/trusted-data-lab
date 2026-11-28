/**
 * Código del service worker (D-02 y D-12), servido en /sw.js por
 * `app/sw.js/route.ts`.
 *
 * - Guarda en caché solo recursos estáticos (/_next/static, íconos). Nunca
 *   guarda páginas ni respuestas de /api: tienen datos de pacientes.
 * - Sin conexión, una navegación muestra una página propia "Sin conexión".
 * - Muestra las notificaciones push y abre la ruta del aviso al tocarlas.
 *
 * Se escribe a mano (guía de PWA de Next.js) en lugar de Serwist para no
 * depender de un plugin de compilación con Turbopack.
 *
 * Solo en producción se guardan los estáticos: ahí los nombres de
 * /_next/static cambian con cada versión. En desarrollo no cambian y la caché
 * serviría código viejo, así que el service worker no guarda nada y borra lo
 * que hubiera guardado.
 */
export const VERSION_SW = "consultorio-v1";

export function codigoSW(cachearEstaticos: boolean): string {
  return String.raw`
const CACHE = "${VERSION_SW}";
const CACHEAR = ${cachearEstaticos ? "true" : "false"};
const ESTATICOS = /^\/(_next\/static\/|iconos\/|apple-icon)/;

const SIN_CONEXION = '<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión · Consultorio</title><style>body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fff;color:#0F2A5C;padding:24px}main{max-width:28rem}h1{font-size:1.5rem}p{font-size:1.125rem;line-height:1.5}button{margin-top:16px;min-height:48px;padding:0 20px;font-size:1.125rem;border:0;border-radius:8px;background:#1D4ED8;color:#fff}</style></head><body><main><h1>Sin conexión</h1><p>El consultorio necesita internet para mostrar y guardar datos. Revisa el wifi o los datos del celular.</p><p>Los avisos importantes siguen en el panel de inicio cuando vuelva la conexión.</p><button onclick="location.reload()">Reintentar</button></main></body></html>';

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => !CACHEAR || c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => new Response(SIN_CONEXION, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } })),
    );
    return;
  }

  if (CACHEAR && ESTATICOS.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const guardada = await cache.match(req);
        if (guardada) return guardada;
        const resp = await fetch(req);
        if (resp.ok) cache.put(req, resp.clone());
        return resp;
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let datos = {};
  try { datos = event.data ? event.data.json() : {}; } catch { datos = { body: event.data ? event.data.text() : "" }; }
  const titulo = datos.title || "Consultorio";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.body || "Tienes un aviso nuevo.",
      icon: "/iconos/192.png",
      badge: "/iconos/badge-96.png",
      tag: datos.tag,
      data: { url: datos.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  if (destino.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ("focus" in v) { v.navigate(destino.href); return v.focus(); }
      }
      return self.clients.openWindow(destino.href);
    }),
  );
});
`;
}
