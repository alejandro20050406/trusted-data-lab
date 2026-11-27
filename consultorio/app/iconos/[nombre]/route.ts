import { notFound } from "next/navigation";
import { imagenIcono } from "@/lib/pwa/icono";

/** Íconos del manifiesto: /iconos/192.png, /iconos/512.png y /iconos/maskable-512.png. */
const ICONOS: Record<string, () => Response> = {
  "192.png": () => imagenIcono(192),
  "512.png": () => imagenIcono(512),
  "maskable-512.png": () => imagenIcono(512, { seguro: true }),
  "badge-96.png": () => imagenIcono(96, { redondeado: false }),
};

export function generateStaticParams() {
  return Object.keys(ICONOS).map((nombre) => ({ nombre }));
}

export const dynamicParams = false;

export async function GET(_request: Request, ctx: RouteContext<"/iconos/[nombre]">) {
  const crear = ICONOS[(await ctx.params).nombre];
  if (!crear) notFound();
  return crear();
}
