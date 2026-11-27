"use client";

import { useActionState, useEffect } from "react";
import { BotonPrimario } from "@/components/ui/boton-primario";
import { CampoFormulario, FormularioCorto } from "@/components/ui/formulario-corto";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { configurarTareaAccion, type EstadoConfiguracion } from "../acciones";

const inicial: EstadoConfiguracion = { ok: false, error: null };

export function FormularioPeriodicidad({ tareaId, cadaDias, diasAnticipacion }: { tareaId: number; cadaDias: number | null; diasAnticipacion: number }) {
  const [estado, accion, pendiente] = useActionState(configurarTareaAccion, inicial);
  const { mostrar } = useConfirmacion();
  useEffect(() => {
    if (estado.ok) mostrar({ mensaje: "Periodicidad guardada" });
  }, [estado, mostrar]);

  return (
    <FormularioCorto
      action={accion}
      noValidate
      envio={
        <BotonPrimario type="submit" pendiente={pendiente}>
          Guardar periodicidad
        </BotonPrimario>
      }
    >
      <input type="hidden" name="tareaId" value={tareaId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoFormulario etiqueta="Cada cuántos días" nombre="cadaDias" tipo="number" inputMode="numeric" min={1} defaultValue={cadaDias ?? ""} />
        <CampoFormulario etiqueta="Avisar con días de anticipación" nombre="diasAnticipacion" tipo="number" inputMode="numeric" min={0} defaultValue={diasAnticipacion} />
      </div>
      {estado.error ? <p className="text-base text-alerta">{estado.error}</p> : null}
    </FormularioCorto>
  );
}
