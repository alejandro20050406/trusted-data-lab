import { z } from "zod";
import { obtenerSesion } from "@/lib/sesion";
import { abrirArchivo } from "@/lib/archivos/archivos";

export const dynamic = "force-dynamic";

/**
 * Abre un archivo de paciente (D-06): verifica la sesión, registra quién lo
 * abrió y redirige a una URL firmada válida por 60 segundos.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/archivos/[id]">) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return Response.json({ ok: false, error: "Inicia sesión para ver este archivo." }, { status: 401 });
  }
  const id = z.coerce.number().int().positive().safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ ok: false, error: "No encontrado" }, { status: 404 });
  const accion = new URL(request.url).searchParams.get("origen") === "galeria" ? "galeria" : "ver";
  const url = await abrirArchivo(id.data, sesion.user.id, accion);
  if (!url) return Response.json({ ok: false, error: "No encontrado" }, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { location: url, "cache-control": "private, no-store", "referrer-policy": "no-referrer" },
  });
}
