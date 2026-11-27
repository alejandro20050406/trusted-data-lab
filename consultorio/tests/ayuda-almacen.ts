import type { Almacen } from "@/lib/archivos/almacen";

/** Almacén en memoria para pruebas: guarda lo que se "sube" con `poner()`. */
export class AlmacenMemoria implements Almacen {
  objetos = new Map<string, Uint8Array>();
  borrados: string[] = [];
  descargas: { llave: string; segundos: number }[] = [];

  poner(llave: string, datos: Uint8Array) {
    this.objetos.set(llave, datos);
  }

  async urlSubida(llave: string, tipoContenido: string, segundos: number) {
    return { url: `https://bucket.test/${llave}?put&exp=${segundos}`, headers: { "content-type": tipoContenido } };
  }

  async urlDescarga(llave: string, segundos: number) {
    this.descargas.push({ llave, segundos });
    return `https://bucket.test/${llave}?get&exp=${segundos}`;
  }

  async leerInicio(llave: string, n: number) {
    const o = this.objetos.get(llave);
    return o ? { bytes: o.slice(0, n), tamano: o.length } : null;
  }

  async borrar(llave: string) {
    this.borrados.push(llave);
    this.objetos.delete(llave);
  }
}

export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1]);
export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
export const PDF = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n1 0 obj\n");
export const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
/** Un ejecutable de Windows ("MZ") disfrazado de foto. */
export const FALSO = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0]);
