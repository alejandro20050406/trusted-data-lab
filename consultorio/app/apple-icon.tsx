import { imagenIcono } from "@/lib/pwa/icono";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícono de "Agregar a inicio" en iPhone. */
export default function AppleIcon() {
  return imagenIcono(180, { redondeado: false });
}
