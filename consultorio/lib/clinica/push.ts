/**
 * Notificaciones push (D-12) con Web Push y llaves VAPID. Se notifican los
 * avisos pendientes de prioridad alta (inventario, esterilización y residuos)
 * una sola vez cada uno. Si las notificaciones fallan, los avisos siguen en el
 * panel de inicio.
 */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { aviso, notificacionEnviada, suscripcionPush } from "@/lib/db/schema";

export interface MensajePush {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface DestinoPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Envía un mensaje; lanza un error con `statusCode` si el servicio lo rechaza. */
export type Enviador = (destino: DestinoPush, mensaje: MensajePush) => Promise<void>;

export function pushConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

let enviadorPrueba: Enviador | undefined;

/** Permite a las pruebas reemplazar el envío real. */
export function usarEnviador(e: Enviador | undefined): void {
  enviadorPrueba = e;
}

async function enviadorWebPush(): Promise<Enviador | null> {
  if (enviadorPrueba) return enviadorPrueba;
  if (!pushConfigurado()) return null;
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return async (destino, mensaje) => {
    await webpush.sendNotification(destino, JSON.stringify(mensaje), { TTL: 60 * 60 * 24, urgency: "high" });
  };
}

export const esquemaSuscripcion = z.object({
  endpoint: z.url().startsWith("https://", { error: "La suscripción no es válida." }).max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

export async function guardarSuscripcion(datos: z.input<typeof esquemaSuscripcion>, userId: string | null): Promise<void> {
  const d = esquemaSuscripcion.parse(datos);
  await getDb()
    .insert(suscripcionPush)
    .values({ endpoint: d.endpoint, p256dh: d.keys.p256dh, auth: d.keys.auth, userId })
    .onConflictDoUpdate({ target: suscripcionPush.endpoint, set: { p256dh: d.keys.p256dh, auth: d.keys.auth, userId } });
}

export async function borrarSuscripcion(endpoint: string): Promise<void> {
  await getDb().delete(suscripcionPush).where(eq(suscripcionPush.endpoint, endpoint));
}

export interface ResumenPush {
  configurado: boolean;
  avisos: number;
  enviadas: number;
  suscripcionesBorradas: number;
}

/** Manda por push los avisos de prioridad alta pendientes que no se habían notificado. */
export async function enviarNotificacionesPendientes(): Promise<ResumenPush> {
  const enviar = await enviadorWebPush();
  if (!enviar) return { configurado: false, avisos: 0, enviadas: 0, suscripcionesBorradas: 0 };
  const db = getDb();
  const pendientes = await db
    .select({ id: aviso.id, titulo: aviso.titulo, detalle: aviso.detalle, urlAccion: aviso.urlAccion })
    .from(aviso)
    .leftJoin(notificacionEnviada, eq(notificacionEnviada.avisoId, aviso.id))
    .where(and(eq(aviso.atendido, false), eq(aviso.prioridad, "alta"), isNull(notificacionEnviada.avisoId)));
  const suscripciones = await db.select().from(suscripcionPush);
  if (pendientes.length === 0 || suscripciones.length === 0) {
    return { configurado: true, avisos: pendientes.length, enviadas: 0, suscripcionesBorradas: 0 };
  }

  let enviadas = 0;
  const vencidas = new Set<string>();
  for (const a of pendientes) {
    const mensaje: MensajePush = {
      title: a.titulo,
      body: (a.detalle ?? "").split("\n")[0] || "Abre el consultorio para ver el aviso.",
      url: a.urlAccion ?? "/",
      tag: `aviso-${a.id}`,
    };
    let entregado = false;
    for (const s of suscripciones) {
      if (vencidas.has(s.endpoint)) continue;
      try {
        await enviar({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, mensaje);
        entregado = true;
        enviadas++;
      } catch (e) {
        const estado = (e as { statusCode?: number }).statusCode;
        // 404/410: el navegador anuló la suscripción; se borra.
        if (estado === 404 || estado === 410) vencidas.add(s.endpoint);
      }
    }
    if (entregado) await db.insert(notificacionEnviada).values({ avisoId: a.id }).onConflictDoNothing();
  }
  if (vencidas.size > 0) await db.delete(suscripcionPush).where(inArray(suscripcionPush.endpoint, [...vencidas]));
  return { configurado: true, avisos: pendientes.length, enviadas, suscripcionesBorradas: vencidas.size };
}

/** Notificación de prueba a todas las suscripciones (botón en "Notificaciones"). */
export async function enviarPrueba(): Promise<number> {
  const enviar = await enviadorWebPush();
  if (!enviar) return 0;
  const suscripciones = await getDb().select().from(suscripcionPush);
  let n = 0;
  for (const s of suscripciones) {
    try {
      await enviar(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        { title: "Consultorio", body: "Las notificaciones funcionan en este celular.", url: "/", tag: "prueba" },
      );
      n++;
    } catch {
      // Se ignora: la prueba solo informa cuántas llegaron al servicio de push.
    }
  }
  return n;
}
