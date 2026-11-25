"use client";

import { useActionState } from "react";
import { BotonPrimario } from "@/components/ui/boton-primario";
import { Estado } from "@/components/ui/estado";
import { CampoFormulario, FormularioCorto } from "@/components/ui/formulario-corto";
import { guardarReglasAccion, type EstadoSimple } from "../acciones";

const inicial: EstadoSimple = { ok: false, error: null };

interface Props {
  insumoId: number;
  unidad: string | null;
  minimoReserva: number | null;
  diasAvisoCaducidad: number | null;
  vidaUtilDias: number | null;
}

export function FormularioReglas({ insumoId, unidad, minimoReserva, diasAvisoCaducidad, vidaUtilDias }: Props) {
  const [estado, accion, pendiente] = useActionState(guardarReglasAccion, inicial);
  const numero = (n: number | null) => (n === null ? "" : String(n));
  // Al guardar, los valores nuevos llegan por props: la clave vuelve a montar los campos con ellos.
  const clave = [unidad, minimoReserva, diasAvisoCaducidad, vidaUtilDias].join("|");

  return (
    <FormularioCorto
      action={accion}
      titulo="Editar reglas"
      noValidate
      envio={<BotonPrimario type="submit" pendiente={pendiente}>Guardar reglas</BotonPrimario>}
    >
      <p className="text-base text-muted-foreground">Deja un campo vacío para dejarlo sin definir.</p>
      <input type="hidden" name="insumoId" value={insumoId} />
      <div key={clave} className="contents">
        <CampoFormulario etiqueta="Unidad" nombre="unidad" defaultValue={unidad ?? ""} placeholder="Ej. caja" />
        <CampoFormulario etiqueta="Reserva mínima" nombre="minimoReserva" tipo="number" inputMode="numeric" min={0} step={1} defaultValue={numero(minimoReserva)} />
        <CampoFormulario
          etiqueta="Aviso de caducidad (días)"
          nombre="diasAvisoCaducidad"
          tipo="number"
          inputMode="numeric"
          min={0}
          step={1}
          defaultValue={numero(diasAvisoCaducidad)}
        />
        <CampoFormulario etiqueta="Vida útil (días)" nombre="vidaUtilDias" tipo="number" inputMode="numeric" min={0} step={1} defaultValue={numero(vidaUtilDias)} />
      </div>
      <div role="status">{estado.ok ? <Estado tipo="correcto" texto="Reglas guardadas" /> : null}</div>
      {estado.error ? (
        <div role="alert">
          <Estado tipo="alerta" texto={estado.error} />
        </div>
      ) : null}
    </FormularioCorto>
  );
}
