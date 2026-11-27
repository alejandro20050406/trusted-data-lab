/** Tipos de archivo de pacientes. Sin dependencias de Node: se usa también en el navegador. */

export type TipoArchivo = "radiografia" | "consentimiento" | "receta" | "otro" | "foto_bracket";

export const TIPOS_ARCHIVO_ESCANEO = ["radiografia", "consentimiento", "receta", "otro"] as const;

export const NOMBRE_TIPO_ARCHIVO: Record<TipoArchivo, string> = {
  radiografia: "Radiografía",
  consentimiento: "Consentimiento",
  receta: "Receta",
  otro: "Documento",
  foto_bracket: "Foto de bracket",
};
