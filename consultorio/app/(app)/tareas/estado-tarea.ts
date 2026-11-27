import type { EstadoTarea } from "@/lib/clinica/tareas";
import type { TipoEstado } from "@/components/ui/estado";

export const TIPO_ESTADO: Record<EstadoTarea, TipoEstado> = {
  vencida: "alerta",
  hoy: "alerta",
  proxima: "advertencia",
  sin_registro: "advertencia",
  sin_definir: "neutro",
  al_dia: "correcto",
};
