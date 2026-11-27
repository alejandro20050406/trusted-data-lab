"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useConfirmacion } from "@/components/ui/confirmacion";
import { deshacerTareaAccion, marcarTareaHechaAccion } from "./acciones";

export const TEXTO_HECHA = { esterilizacion: "Esterilización hecha hoy", residuos: "Recolección hecha hoy" } as const;

export interface ExtraRealizacion {
  fecha?: string;
  detalle?: string;
  comprobante?: string;
  nota?: string;
}

interface Props {
  tareaId: number;
  tipo: "esterilizacion" | "residuos";
  className?: string;
  grande?: boolean;
  /** Datos opcionales que se mandan con la realización. */
  extra?: () => ExtraRealizacion;
  texto?: string;
  variante?: "default" | "outline";
}

/** Botón de un toque que registra la tarea con la fecha de hoy, con "Deshacer". */
export function BotonTareaHecha({ tareaId, tipo, className, grande = false, extra, texto, variante = "default" }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const { mostrar } = useConfirmacion();
  const router = useRouter();

  function marcar() {
    setError(null);
    iniciar(async () => {
      const r = await marcarTareaHechaAccion({ tareaId, ...(extra?.() ?? {}) });
      if (!r.ok) return setError(r.error);
      mostrar({
        mensaje: r.mensaje,
        alDeshacer: async () => {
          const d = await deshacerTareaAccion(r.realizacionId, tareaId);
          if (!d.ok) setError(d.error);
          router.refresh();
        },
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant={variante} onClick={marcar} disabled={pendiente} size={grande ? "lg" : "default"} className={cn(grande && "h-14 text-lg", className)}>
        <CircleCheck aria-hidden="true" />
        {texto ?? TEXTO_HECHA[tipo]}
      </Button>
      {error ? <p className="text-base text-alerta">{error}</p> : null}
    </div>
  );
}
