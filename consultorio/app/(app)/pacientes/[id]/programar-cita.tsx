"use client";

import { useActionState, useEffect, useRef } from "react";
import { BotonPrimario } from "@/components/ui/boton-primario";
import { CampoFormulario, FormularioCorto } from "@/components/ui/formulario-corto";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { programarCitaAccion, type EstadoFormulario } from "../acciones";

const inicial: EstadoFormulario = { ok: false, error: null, valores: {} };

export function ProgramarCita({ pacienteId, hoy }: { pacienteId: number; hoy: string }) {
  const [estado, accion, pendiente] = useActionState(programarCitaAccion, inicial);
  const { mostrar } = useConfirmacion();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!estado.ok) return;
    mostrar({ mensaje: "Cita programada" });
    formRef.current?.reset();
  }, [estado, mostrar]);

  return (
    <FormularioCorto
      ref={formRef}
      action={accion}
      noValidate
      envio={
        <BotonPrimario type="submit" pendiente={pendiente}>
          Programar cita
        </BotonPrimario>
      }
    >
      <input type="hidden" name="pacienteId" value={pacienteId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoFormulario etiqueta="Fecha" nombre="fecha" tipo="date" min={hoy} defaultValue={estado.valores.fecha ?? ""} error={estado.error?.includes("fecha") ? estado.error : null} />
        <CampoFormulario etiqueta="Hora" nombre="hora" tipo="time" step={300} defaultValue={estado.valores.hora ?? ""} error={estado.error && !estado.error.includes("fecha") ? estado.error : null} />
      </div>
    </FormularioCorto>
  );
}
