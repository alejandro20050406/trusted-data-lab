import { ImageResponse } from "next/og";

/** Azul primario y blanco de la paleta de Angel (lib/diseno/colores.ts). */
export const COLOR_ICONO = "#1D4ED8";
export const FONDO_APP = "#FFFFFF";

/**
 * Ícono de la app: un diente blanco sobre azul. `seguro` deja el margen de
 * la zona segura de los íconos "maskable" (80 % central).
 */
export function imagenIcono(lado: number, { seguro = false, redondeado = true } = {}) {
  const escala = seguro ? 0.5 : 0.62;
  const diente = Math.round(lado * escala);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLOR_ICONO,
          borderRadius: redondeado && !seguro ? lado * 0.22 : 0,
        }}
      >
        <svg width={diente} height={diente} viewBox="0 0 100 100">
          <path
            d="M27 8c-12 0-21 10-21 25 0 12 5 20 8 30 3 11 4 29 13 29 8 0 8-17 12-24 3-5 5-6 11-6s8 1 11 6c4 7 4 24 12 24 9 0 10-18 13-29 3-10 8-18 8-30C94 18 85 8 73 8c-9 0-14 5-23 5S36 8 27 8z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
    ),
    { width: lado, height: lado },
  );
}
