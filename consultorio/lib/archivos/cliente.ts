/**
 * Utilidades de navegador para subir archivos: compresión de fotos y subida
 * directa al bucket con la URL firmada que entrega el servidor.
 */

/** Lado mayor de las fotos comprimidas, suficiente para leer una hoja o una radiografía. */
export const LADO_MAXIMO = 2000;
export const CALIDAD_JPEG = 0.8;

/** Dimensiones a las que se reduce una imagen sin deformarla. */
export function dimensionesReducidas(ancho: number, alto: number, ladoMaximo = LADO_MAXIMO): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto);
  if (mayor <= ladoMaximo) return { ancho, alto };
  const factor = ladoMaximo / mayor;
  return { ancho: Math.round(ancho * factor), alto: Math.round(alto * factor) };
}

/**
 * Comprime una foto a JPEG antes de subirla. Los PDF se suben tal cual. Si la
 * imagen no se puede decodificar (p. ej. HEIC en un navegador sin soporte),
 * se sube la original y el servidor decide si la acepta.
 */
export async function comprimirImagen(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith("image/") || typeof createImageBitmap !== "function") return archivo;
  try {
    const imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
    const { ancho, alto } = dimensionesReducidas(imagen.width, imagen.height);
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return archivo;
    ctx.drawImage(imagen, 0, 0, ancho, alto);
    imagen.close();
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", CALIDAD_JPEG));
    if (!blob) return archivo;
    // Si la original ya era un JPEG más ligero, se queda la original.
    return archivo.type === "image/jpeg" && archivo.size <= blob.size ? archivo : blob;
  } catch {
    return archivo;
  }
}

export interface Preparada {
  boleto: string;
  url: string;
  headers: Record<string, string>;
}

/** Sube el blob con PUT a la URL firmada. Lanza Error con un mensaje para la dentista. */
export async function subirFirmado(blob: Blob, preparada: Preparada): Promise<void> {
  let r: Response;
  try {
    r = await fetch(preparada.url, { method: "PUT", body: blob, headers: preparada.headers });
  } catch {
    throw new Error("No hay conexión. Vuelve a intentarlo.");
  }
  if (!r.ok) throw new Error("No se pudo subir el archivo. Vuelve a intentarlo.");
}
