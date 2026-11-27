"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Estado } from "@/components/ui/estado";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { comprimirImagen, subirFirmado } from "@/lib/archivos/cliente";
import { NOMBRE_TIPO_ARCHIVO, TIPOS_ARCHIVO_ESCANEO } from "@/lib/archivos/tipos";
import { confirmarSubidaAccion, prepararSubidaAccion } from "../acciones";

type TipoEscaneo = (typeof TIPOS_ARCHIVO_ESCANEO)[number];

interface Progreso {
  nombre: string;
  estado: "subiendo" | "listo" | "error";
  mensaje?: string;
}

/**
 * Botón "Escanear" (D-05): abre la cámara trasera en el celular y acepta
 * varias páginas; en escritorio también permite arrastrar archivos. El tipo
 * elegido se aplica a todo lo que se sube. Con el tipo ya elegido, escanear
 * una hoja son 3 toques: Escanear, disparar y usar la foto.
 */
export function Escanear({ pacienteId }: { pacienteId: number }) {
  const [tipo, setTipo] = useState<TipoEscaneo>("otro");
  const [progreso, setProgreso] = useState<Progreso[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const camaraRef = useRef<HTMLInputElement>(null);
  const archivosRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { mostrar } = useConfirmacion();

  const ocupado = progreso.some((p) => p.estado === "subiendo");

  async function subirUno(archivo: File, i: number) {
    const actualizar = (p: Partial<Progreso>) => setProgreso((todos) => todos.map((x, j) => (j === i ? { ...x, ...p } : x)));
    try {
      const blob = await comprimirImagen(archivo);
      const tipoContenido = blob.type || archivo.type;
      const prep = await prepararSubidaAccion({ pacienteId, tipoContenido, tamano: blob.size });
      if (!prep.ok) throw new Error(prep.error);
      await subirFirmado(blob, prep);
      const conf = await confirmarSubidaAccion({ boleto: prep.boleto, tipo, pacienteId });
      if (!conf.ok) throw new Error(conf.error);
      actualizar({ estado: "listo", nombre: conf.nombre });
      return true;
    } catch (e) {
      actualizar({ estado: "error", mensaje: e instanceof Error ? e.message : "No se pudo guardar." });
      return false;
    }
  }

  async function subir(lista: FileList | File[] | null) {
    const archivos = Array.from(lista ?? []);
    if (archivos.length === 0) return;
    setProgreso(archivos.map((a) => ({ nombre: a.name || "Foto", estado: "subiendo" })));
    let guardados = 0;
    // Una página a la vez para no saturar la conexión del celular.
    for (const [i, a] of archivos.entries()) if (await subirUno(a, i)) guardados++;
    if (guardados > 0) {
      mostrar({ mensaje: guardados === 1 ? "Archivo guardado" : `${guardados} archivos guardados` });
      router.refresh();
    }
    if (camaraRef.current) camaraRef.current.value = "";
    if (archivosRef.current) archivosRef.current.value = "";
  }

  function alSoltar(e: DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    void subir(e.dataTransfer.files);
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-medium">Tipo de archivo</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS_ARCHIVO_ESCANEO.map((t) => (
            <label
              key={t}
              className={cn(
                "flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-base font-medium has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                tipo === t ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background",
              )}
            >
              <input type="radio" name="tipo-archivo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
              {NOMBRE_TIPO_ARCHIVO[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
        data-zona-arrastre
        className={cn("flex flex-col gap-3 rounded-xl border-2 border-dashed p-4", arrastrando ? "border-primary bg-muted" : "border-border")}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" className="h-14 text-lg" disabled={ocupado} onClick={() => camaraRef.current?.click()}>
            <Camera aria-hidden="true" />
            Escanear
          </Button>
          <Button size="lg" variant="outline" className="h-14 text-lg" disabled={ocupado} onClick={() => archivosRef.current?.click()}>
            <Upload aria-hidden="true" />
            Elegir archivos
          </Button>
        </div>
        <p className="hidden text-center text-muted-foreground md:block">o arrastra aquí fotos o PDF</p>
        <input
          ref={camaraRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Tomar foto con la cámara"
          data-camara
          onChange={(e) => void subir(e.target.files)}
        />
        <input
          ref={archivosRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Elegir archivos del dispositivo"
          data-archivos
          onChange={(e) => void subir(e.target.files)}
        />
      </div>

      {progreso.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {progreso.map((p, i) => (
            <li key={i}>
              {p.estado === "subiendo" ? <Estado tipo="neutro" texto={`Guardando ${p.nombre}…`} /> : null}
              {p.estado === "listo" ? <Estado tipo="correcto" texto={`Guardado: ${p.nombre}`} /> : null}
              {p.estado === "error" ? <Estado tipo="alerta" texto={`${p.nombre}: ${p.mensaje}`} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
