"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { darDeBajaAccion, type EstadoSimple } from "../acciones";

const inicial: EstadoSimple = { ok: false, error: null };

export function BotonDarDeBaja({ loteId }: { loteId: number }) {
  const [estado, accion, pendiente] = useActionState(darDeBajaAccion, inicial);
  return (
    <form action={accion} className="flex flex-col gap-2">
      <input type="hidden" name="loteId" value={loteId} />
      <Button type="submit" variant="outline" disabled={pendiente} aria-busy={pendiente || undefined} className="w-full md:w-auto">
        {pendiente ? "Dando de baja…" : "Dar de baja"}
      </Button>
      {estado.error ? <p className="text-base text-alerta">{estado.error}</p> : null}
    </form>
  );
}
