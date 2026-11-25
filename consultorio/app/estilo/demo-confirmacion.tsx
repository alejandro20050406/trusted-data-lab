"use client";

import { Button } from "@/components/ui/button";
import { DURACION_DESHACER_MS, useConfirmacion } from "@/components/ui/confirmacion";

export function DemoConfirmacion() {
  const { mostrar } = useConfirmacion();
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => mostrar({ mensaje: "Se registró −1 guante", alDeshacer: () => undefined, duracionMs: DURACION_DESHACER_MS })}
    >
      Probar confirmación con Deshacer
    </Button>
  );
}
