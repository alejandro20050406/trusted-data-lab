import type { MetadataRoute } from "next";
import { COLOR_ICONO, FONDO_APP } from "@/lib/pwa/icono";

/** Manifiesto de la app instalable (D-02 y D-12). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Consultorio",
    short_name: "Consultorio",
    description: "Inventario, pacientes y recordatorios del consultorio dental",
    lang: "es-MX",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: FONDO_APP,
    theme_color: COLOR_ICONO,
    icons: [
      { src: "/iconos/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
