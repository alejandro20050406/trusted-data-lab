import * as React from "react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"

type Props = Omit<React.ComponentProps<typeof Button>, "variant"> & {
  /** Mientras es true muestra `textoPendiente` y el botón queda deshabilitado. */
  pendiente?: boolean
  textoPendiente?: string
}

function BotonPrimario({
  pendiente = false,
  textoPendiente = "Guardando…",
  className,
  children,
  disabled,
  ...props
}: Props) {
  return (
    <Button
      variant="default"
      className={cn("w-full md:w-auto", className)}
      disabled={disabled || pendiente}
      aria-busy={pendiente || undefined}
      {...props}
    >
      {pendiente ? textoPendiente : children}
    </Button>
  )
}

export { BotonPrimario }
