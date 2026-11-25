import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`. Sin CRON_SECRET
 * configurado se rechaza todo.
 */
export function autorizarCron(request: Request, secreto = process.env.CRON_SECRET): boolean {
  if (!secreto) return false;
  const recibido = Buffer.from(request.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${secreto}`);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}
