"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, PackageMinus } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Estado } from "@/components/ui/estado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { comprimirImagen, subirFirmado } from "@/lib/archivos/cliente";
import { prepararSubidaAccion } from "../../acciones";
import {
  confirmarFotoAccion,
  descontarReposicionAccion,
  deshacerCaidaAccion,
  deshacerReposicionAccion,
  guardarNotaAccion,
  registrarCaidaAccion,
} from "./acciones";

export interface DienteOdontograma {
  fdi: number;
  nombre: string;
  /** Caídas previas de este paciente en el diente. */
  caidas: number;
}

interface Reposicion {
  varianteId: number;
  nombre: string;
  existencia: number;
}

interface Registrado {
  id: number;
  fdi: number;
  nombre: string;
  reposiciones: Reposicion[];
  foto: "no" | "subiendo" | "lista";
  repuesto: string | null;
}

const CORTO = ["Incisivo central", "Incisivo lateral", "Canino", "1.er premolar", "2.º premolar", "1.er molar", "2.º molar", "3.er molar"];

/** Cuadrantes en el orden en que se ven de frente: derecho del paciente a la izquierda. */
const CUADRANTES = [
  { arcada: "Arcada superior", lados: [{ texto: "Derecho", fdi: [18, 17, 16, 15, 14, 13, 12, 11] }, { texto: "Izquierdo", fdi: [21, 22, 23, 24, 25, 26, 27, 28] }] },
  { arcada: "Arcada inferior", lados: [{ texto: "Derecho", fdi: [48, 47, 46, 45, 44, 43, 42, 41] }, { texto: "Izquierdo", fdi: [31, 32, 33, 34, 35, 36, 37, 38] }] },
];

export function Odontograma({ pacienteId, dientes }: { pacienteId: number; dientes: DienteOdontograma[] }) {
  const [registrado, setRegistrado] = useState<Registrado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [pendiente, iniciar] = useTransition();
  const fotoRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { mostrar } = useConfirmacion();
  const porFdi = new Map(dientes.map((d) => [d.fdi, d]));

  function registrar(d: DienteOdontograma) {
    setError(null);
    setNota("");
    iniciar(async () => {
      const r = await registrarCaidaAccion({ pacienteId, dienteFdi: d.fdi });
      if (!r.ok) return setError(r.error);
      setRegistrado({ id: r.id, fdi: d.fdi, nombre: d.nombre, reposiciones: r.reposiciones, foto: "no", repuesto: null });
      mostrar({
        mensaje: `Caída registrada: diente ${d.fdi}`,
        alDeshacer: async () => {
          const u = await deshacerCaidaAccion(r.id, pacienteId);
          if (!u.ok) return setError(u.error);
          setRegistrado(null);
          router.refresh();
        },
      });
      router.refresh();
    });
  }

  async function subirFoto(lista: FileList | null) {
    const archivo = lista?.[0];
    if (!archivo || !registrado) return;
    const actual = registrado;
    setError(null);
    setRegistrado({ ...actual, foto: "subiendo" });
    try {
      const blob = await comprimirImagen(archivo);
      const prep = await prepararSubidaAccion({ pacienteId, tipoContenido: blob.type || archivo.type, tamano: blob.size });
      if (!prep.ok) throw new Error(prep.error);
      await subirFirmado(blob, prep);
      const conf = await confirmarFotoAccion({ bracketId: actual.id, pacienteId, boleto: prep.boleto });
      if (!conf.ok) throw new Error(conf.error);
      setRegistrado((r) => (r && r.id === actual.id ? { ...r, foto: "lista" } : r));
      mostrar({ mensaje: "Foto guardada" });
      router.refresh();
    } catch (e) {
      setRegistrado((r) => (r && r.id === actual.id ? { ...r, foto: "no" } : r));
      setError(e instanceof Error ? e.message : "No se pudo guardar la foto.");
    } finally {
      if (fotoRef.current) fotoRef.current.value = "";
    }
  }

  function descontar(rep: Reposicion) {
    if (!registrado) return;
    const actual = registrado;
    setError(null);
    iniciar(async () => {
      const r = await descontarReposicionAccion({ bracketId: actual.id, pacienteId, varianteId: rep.varianteId });
      if (!r.ok) return setError(r.error);
      setRegistrado((x) => (x && x.id === actual.id ? { ...x, repuesto: rep.nombre } : x));
      mostrar({
        mensaje: `Se descontó 1 bracket ${rep.nombre}`,
        alDeshacer: async () => {
          const u = await deshacerReposicionAccion({ bracketId: actual.id, pacienteId, grupoId: r.grupoId });
          if (!u.ok) return setError(u.error);
          setRegistrado((x) => (x && x.id === actual.id ? { ...x, repuesto: null } : x));
        },
      });
    });
  }

  function guardarNota() {
    if (!registrado) return;
    const actual = registrado;
    iniciar(async () => {
      const r = await guardarNotaAccion(actual.id, pacienteId, nota);
      if (!r.ok) return setError(r.error);
      mostrar({ mensaje: "Nota guardada" });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {CUADRANTES.map((a) => (
        <section key={a.arcada} aria-label={a.arcada} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{a.arcada}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {a.lados.map((lado) => (
              <div key={lado.texto} className="flex flex-col gap-1">
                <p className="text-muted-foreground">{lado.texto}</p>
                <div className="grid grid-cols-4 gap-2">
                  {lado.fdi.map((fdi) => {
                    const d = porFdi.get(fdi);
                    if (!d) return null;
                    const elegido = registrado?.fdi === fdi;
                    return (
                      <button
                        key={fdi}
                        type="button"
                        data-fdi={fdi}
                        disabled={pendiente}
                        onClick={() => registrar(d)}
                        aria-label={`Registrar caída del diente ${fdi}, ${d.nombre}${d.caidas > 0 ? `. Caídas previas: ${d.caidas}` : ""}`}
                        className={cn(
                          "relative flex min-h-16 flex-col items-center justify-center rounded-lg border px-1 py-1 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
                          elegido ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted",
                        )}
                      >
                        <span className="text-lg leading-tight font-semibold">{fdi}</span>
                        <span className={cn("text-sm leading-tight", elegido ? "" : "text-muted-foreground")}>{CORTO[(fdi % 10) - 1]}</span>
                        {d.caidas > 0 ? (
                          <span aria-hidden="true" className="absolute -top-2 -right-1 rounded-full bg-advertencia-fondo px-1.5 text-sm font-semibold text-advertencia">
                            {d.caidas}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {error ? <Estado tipo="alerta" texto={error} /> : null}

      {registrado ? (
        <section aria-label="Caída registrada" className="flex flex-col gap-3 rounded-xl border border-primary p-4" data-registrado={registrado.fdi}>
          <Estado tipo="correcto" texto={`Registrado hoy: diente ${registrado.fdi}, ${registrado.nombre}`} />

          <input
            ref={fotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-label="Foto de evidencia"
            data-foto-bracket
            onChange={(e) => void subirFoto(e.target.files)}
          />
          {registrado.foto === "lista" ? (
            <Estado tipo="correcto" texto="Foto de evidencia guardada" />
          ) : (
            <Button size="lg" className="h-14 text-lg" disabled={registrado.foto === "subiendo"} onClick={() => fotoRef.current?.click()}>
              <Camera aria-hidden="true" />
              {registrado.foto === "subiendo" ? "Guardando foto…" : "Agregar foto"}
            </Button>
          )}

          {registrado.repuesto ? (
            <Estado tipo="correcto" texto={`Se descontó 1 bracket ${registrado.repuesto} del inventario`} />
          ) : registrado.reposiciones.length === 0 ? (
            <Estado tipo="neutro" texto={`No hay brackets de reposición del diente ${registrado.fdi} en el inventario.`} />
          ) : (
            <div className="flex flex-col gap-2">
              <p className="font-medium">Descontar bracket de reposición</p>
              {registrado.reposiciones.map((rep) => (
                <Button key={rep.varianteId} variant="outline" size="lg" className="h-auto min-h-12 justify-start py-2 text-left whitespace-normal" disabled={pendiente} onClick={() => descontar(rep)}>
                  <PackageMinus aria-hidden="true" />
                  Descontar {rep.nombre} (quedan {rep.existencia})
                </Button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="nota-bracket">Nota (opcional)</Label>
            <div className="flex gap-2">
              <Input id="nota-bracket" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} autoComplete="off" />
              <Button variant="outline" disabled={pendiente || nota.trim() === ""} onClick={guardarNota}>
                Guardar
              </Button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
