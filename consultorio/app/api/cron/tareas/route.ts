import { autorizarCron } from "@/lib/cron";
import { sincronizarAvisosTareas } from "@/lib/clinica/tareas";
import { enviarNotificacionesPendientes } from "@/lib/clinica/push";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron la llama una vez al día (ver vercel.json), después de la de
 * inventario. Crea los avisos de esterilización y residuos y manda por push
 * los avisos de prioridad alta que aún no se notificaron.
 */
export async function GET(request: Request) {
  if (!autorizarCron(request)) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const tareas = await sincronizarAvisosTareas();
  const notificaciones = await enviarNotificacionesPendientes();
  return Response.json({ ok: true, tareas, notificaciones });
}
