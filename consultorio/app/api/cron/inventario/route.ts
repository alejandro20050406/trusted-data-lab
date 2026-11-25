import { autorizarCron } from "@/lib/cron";
import { actualizarAvisosInventario } from "@/lib/inventario/generar-avisos";

export const dynamic = "force-dynamic";

/** Vercel Cron la llama una vez al día (ver vercel.json). */
export async function GET(request: Request) {
  if (!autorizarCron(request)) {
    return Response.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const resumen = await actualizarAvisosInventario();
  return Response.json({ ok: true, ...resumen });
}
