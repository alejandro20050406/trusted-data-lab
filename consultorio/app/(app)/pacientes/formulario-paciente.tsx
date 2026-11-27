"use client";

import { useActionState, useEffect } from "react";
import { BotonPrimario } from "@/components/ui/boton-primario";
import { CampoFormulario, FormularioCorto } from "@/components/ui/formulario-corto";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { crearPacienteAccion, editarPacienteAccion, type EstadoFormulario } from "./acciones";

interface Props {
  /** Si viene, el formulario edita a ese paciente. */
  paciente?: { id: number; nombre: string; telefono: string | null; notas: string | null };
}

export function FormularioPaciente({ paciente }: Props) {
  const inicial: EstadoFormulario = {
    ok: false,
    error: null,
    valores: paciente ? { nombre: paciente.nombre, telefono: paciente.telefono ?? "", notas: paciente.notas ?? "" } : {},
  };
  const [estado, accion, pendiente] = useActionState(paciente ? editarPacienteAccion : crearPacienteAccion, inicial);
  const { mostrar } = useConfirmacion();

  useEffect(() => {
    if (estado.ok && paciente) mostrar({ mensaje: "Datos guardados" });
  }, [estado, paciente, mostrar]);

  return (
    <FormularioCorto
      action={accion}
      noValidate
      envio={
        <BotonPrimario type="submit" pendiente={pendiente}>
          {paciente ? "Guardar cambios" : "Guardar paciente"}
        </BotonPrimario>
      }
    >
      {paciente ? <input type="hidden" name="pacienteId" value={paciente.id} /> : null}
      <CampoFormulario
        etiqueta="Nombre"
        nombre="nombre"
        autoComplete="off"
        required
        defaultValue={estado.valores.nombre ?? ""}
        error={estado.error && !estado.error.includes("teléfono") && !estado.error.includes("notas") ? estado.error : null}
        autoFocus={!paciente}
      />
      <CampoFormulario
        etiqueta="Teléfono (opcional)"
        nombre="telefono"
        tipo="tel"
        inputMode="tel"
        autoComplete="off"
        defaultValue={estado.valores.telefono ?? ""}
        error={estado.error?.includes("teléfono") ? estado.error : null}
      />
      <CampoFormulario
        etiqueta="Notas cortas (opcional)"
        nombre="notas"
        autoComplete="off"
        maxLength={300}
        defaultValue={estado.valores.notas ?? ""}
        error={estado.error?.includes("notas") ? estado.error : null}
      />
    </FormularioCorto>
  );
}
