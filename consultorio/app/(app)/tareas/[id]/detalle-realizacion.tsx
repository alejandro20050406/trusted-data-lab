"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BotonTareaHecha } from "../boton-tarea-hecha";

/**
 * Registro con datos opcionales: fecha real (si no fue hoy), piezas o
 * paquetes (esterilización) o número de manifiesto (residuos).
 */
export function DetalleRealizacion({ tareaId, tipo, hoy }: { tareaId: number; tipo: "esterilizacion" | "residuos"; hoy: string }) {
  const fecha = useRef<HTMLInputElement>(null);
  const detalle = useRef<HTMLInputElement>(null);
  const nota = useRef<HTMLInputElement>(null);
  const esEsterilizacion = tipo === "esterilizacion";

  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">Registrar con detalle u otra fecha</summary>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="realizacion-fecha">Fecha en que se hizo</Label>
          <Input ref={fecha} id="realizacion-fecha" type="date" max={hoy} defaultValue={hoy} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="realizacion-detalle">{esEsterilizacion ? "Piezas, paquetes o ciclo (opcional)" : "Número de manifiesto o comprobante (opcional)"}</Label>
          <Input ref={detalle} id="realizacion-detalle" maxLength={esEsterilizacion ? 200 : 100} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="realizacion-nota">Nota (opcional)</Label>
          <Input ref={nota} id="realizacion-nota" maxLength={300} autoComplete="off" />
        </div>
        <BotonTareaHecha
          tareaId={tareaId}
          tipo={tipo}
          texto="Guardar registro"
          variante="outline"
          extra={() => {
            const d = detalle.current?.value.trim() ?? "";
            return {
              fecha: fecha.current?.value ?? "",
              nota: nota.current?.value.trim() ?? "",
              ...(esEsterilizacion ? { detalle: d } : { comprobante: d }),
            };
          }}
        />
      </div>
    </details>
  );
}
