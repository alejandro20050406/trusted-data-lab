import * as React from "react"
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"
import { cn } from "cn"

const TIPOS = {
  alerta: { Icono: CircleAlert, clases: "bg-alerta-fondo text-alerta" },
  advertencia: { Icono: TriangleAlert, clases: "bg-advertencia-fondo text-advertencia" },
  correcto: { Icono: CircleCheck, clases: "bg-correcto-fondo text-correcto" },
  neutro: { Icono: Info, clases: "bg-muted text-foreground" },
} as const

export type TipoEstado = keyof typeof TIPOS

/** El color nunca va solo: siempre lleva ícono y texto. */
function Estado({ tipo, texto, className }: { tipo: TipoEstado; texto: string; className?: string }) {
  const { Icono, clases } = TIPOS[tipo]
  return (
    <p
      data-slot="estado"
      data-tipo={tipo}
      className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-base font-medium", clases, className)}
    >
      <Icono aria-hidden="true" className="size-5 shrink-0" />
      <span>{texto}</span>
    </p>
  )
}

export { Estado }
