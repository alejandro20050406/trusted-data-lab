import { CODIGO_SW } from "@/lib/pwa/service-worker";

export const dynamic = "force-static";

/** Service worker en /sw.js, sin caché HTTP para que las versiones nuevas se apliquen. */
export function GET() {
  return new Response(CODIGO_SW, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      "content-security-policy": "default-src 'self'; script-src 'self'",
      "service-worker-allowed": "/",
    },
  });
}
