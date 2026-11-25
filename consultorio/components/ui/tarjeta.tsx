import * as React from "react"
import { cn } from "cn"
import { Card, CardContent, CardTitle } from "@/components/ui/card"

function Tarjeta({ className, ...props }: React.ComponentProps<typeof Card>) {
  return <Card className={cn("text-base", className)} {...props} />
}

function TarjetaTitulo({ className, ...props }: React.ComponentProps<typeof CardTitle>) {
  return <CardTitle className={cn("px-(--card-spacing) text-lg font-semibold", className)} {...props} />
}

function TarjetaContenido({ className, ...props }: React.ComponentProps<typeof CardContent>) {
  return <CardContent className={className} {...props} />
}

export { Tarjeta, TarjetaTitulo, TarjetaContenido }
