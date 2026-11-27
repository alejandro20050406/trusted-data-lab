import { almacenLocalPermitido, escribirLocal, leerLocal, verificarFirmaLocal } from "@/lib/archivos/almacen";
import { TAMANO_MAXIMO } from "@/lib/archivos/validacion";

export const dynamic = "force-dynamic";

/**
 * Sustituto local de R2 para desarrollo y pruebas: acepta PUT y GET solo con
 * una URL firmada por la app y vigente. En producción en Vercel no existe.
 */
async function llaveDe(ctx: RouteContext<"/api/almacen-local/[...llave]">) {
  return (await ctx.params).llave.join("/");
}

export async function PUT(request: Request, ctx: RouteContext<"/api/almacen-local/[...llave]">) {
  if (!almacenLocalPermitido()) return new Response(null, { status: 404 });
  const llave = await llaveDe(ctx);
  const q = new URL(request.url).searchParams;
  const tipo = request.headers.get("content-type") ?? "";
  if (!verificarFirmaLocal("PUT", llave, q.get("exp"), q.get("firma"), tipo)) {
    return new Response("Firma inválida", { status: 403 });
  }
  const datos = new Uint8Array(await request.arrayBuffer());
  if (datos.length > TAMANO_MAXIMO) return new Response("Demasiado grande", { status: 413 });
  await escribirLocal(llave, datos, tipo);
  return new Response(null, { status: 200 });
}

export async function GET(request: Request, ctx: RouteContext<"/api/almacen-local/[...llave]">) {
  if (!almacenLocalPermitido()) return new Response(null, { status: 404 });
  const llave = await llaveDe(ctx);
  const q = new URL(request.url).searchParams;
  if (!verificarFirmaLocal("GET", llave, q.get("exp"), q.get("firma"))) {
    return new Response("Firma inválida o vencida", { status: 403 });
  }
  const archivo = await leerLocal(llave);
  if (!archivo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(archivo.datos), {
    headers: { "content-type": archivo.tipo, "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
