"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarClock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Estado } from "@/components/ui/estado";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { deshacerMarcaCitaAccion, marcarCitaAccion, reagendarCitaAccion } from "../acciones";

interface Props {
  pacienteId: number;
  citaId: number;
  /** "mar 1 dic 2026, 10:30" */
  textoFecha: string;
  /** Hora local de la cita (HH:MM): la nueva cita la conserva salvo que se cambie. */
  hora: string;
  hoy: string;
}

const MENSAJE: Record<"atendida" | "cancelada" | "no_asistio", string> = {
  atendida: "Cita marcada como atendida",
  cancelada: "Cita cancelada",
  no_asistio: "Se marcó que no asistió",
};

export function CitaPendiente({ pacienteId, citaId, textoFecha, hora, hoy }: Props) {
  const [reagendando, setReagendando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const fechaRef = useRef<HTMLInputElement>(null);
  const { mostrar } = useConfirmacion();

  function marcar(estado: "atendida" | "cancelada" | "no_asistio") {
    setError(null);
    iniciar(async () => {
      const r = await marcarCitaAccion({ citaId, pacienteId, estado });
      if (!r.ok) return setError(r.error);
      mostrar({
        mensaje: MENSAJE[estado],
        alDeshacer: async () => {
          const d = await deshacerMarcaCitaAccion(citaId, pacienteId);
          if (!d.ok) setError(d.error);
        },
      });
    });
  }

  function abrirReagenda() {
    setError(null);
    setReagendando(true);
    // El selector de fecha se abre con el mismo toque (si el navegador lo permite).
    requestAnimationFrame(() => {
      const campo = fechaRef.current;
      if (!campo) return;
      campo.focus();
      try {
        campo.showPicker?.();
      } catch {
        // Algunos navegadores solo abren el selector con un toque directo en el campo.
      }
    });
  }

  function reagendar(formData: FormData) {
    setError(null);
    const fecha = String(formData.get("fecha") ?? "");
    const nuevaHora = String(formData.get("hora") ?? "") || hora;
    iniciar(async () => {
      const r = await reagendarCitaAccion({ citaId, pacienteId, fecha, hora: nuevaHora });
      if (!r.ok) return setError(r.error);
      setReagendando(false);
      mostrar({ mensaje: "Cita reagendada" });
    });
  }

  return (
    <div className="flex flex-col gap-3" data-cita={citaId}>
      <p className="text-lg">
        <span className="text-muted-foreground">Próxima cita: </span>
        <span className="font-semibold">{textoFecha}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" className="h-14 text-lg" disabled={pendiente} onClick={() => marcar("atendida")}>
          <Check aria-hidden="true" />
          Atendida
        </Button>
        <Button size="lg" variant="outline" className="h-14 text-lg" disabled={pendiente} onClick={abrirReagenda} aria-expanded={reagendando}>
          <CalendarClock aria-hidden="true" />
          Reagendar
        </Button>
      </div>

      {reagendando ? (
        <form action={reagendar} className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="reagenda-fecha">Nueva fecha</Label>
            <Input ref={fechaRef} id="reagenda-fecha" name="fecha" type="date" min={hoy} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reagenda-hora">Hora</Label>
            <Input id="reagenda-hora" name="hora" type="time" defaultValue={hora} step={300} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pendiente}>
              Guardar nueva fecha
            </Button>
            <Button type="button" variant="ghost" onClick={() => setReagendando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      <details className="group">
        <summary className="flex min-h-11 cursor-pointer items-center text-primary underline underline-offset-4">Otras opciones</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" disabled={pendiente} onClick={() => marcar("no_asistio")}>
            No asistió
          </Button>
          <Button variant="outline" disabled={pendiente} onClick={() => marcar("cancelada")}>
            Cancelar cita
          </Button>
        </div>
      </details>

      {error ? <Estado tipo="alerta" texto={error} /> : null}
    </div>
  );
}
