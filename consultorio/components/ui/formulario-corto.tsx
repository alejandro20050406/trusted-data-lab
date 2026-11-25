import * as React from "react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type PropsFormulario = Omit<React.ComponentProps<"form">, "action"> & {
  action: (formData: FormData) => void | Promise<void>
  titulo?: string
  /** Slot del botón de envío, normalmente un `BotonPrimario`. */
  envio?: React.ReactNode
}

function FormularioCorto({ action, titulo, envio, className, children, ...props }: PropsFormulario) {
  return (
    <form action={action} className={cn("flex flex-col gap-4", className)} {...props}>
      {titulo ? <h2 className="text-xl font-semibold">{titulo}</h2> : null}
      {children}
      {envio}
    </form>
  )
}

type PropsCampo = Omit<React.ComponentProps<typeof Input>, "name" | "type"> & {
  etiqueta: string
  nombre: string
  tipo?: React.ComponentProps<"input">["type"]
  error?: string | null
}

function CampoFormulario({ etiqueta, nombre, tipo = "text", error, id, className, ...props }: PropsCampo) {
  const idCampo = id ?? `campo-${nombre}`
  const idError = `${idCampo}-error`
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={idCampo}>{etiqueta}</Label>
      <Input
        id={idCampo}
        name={nombre}
        type={tipo}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : undefined}
        {...props}
      />
      {error ? (
        <p id={idError} className="text-base text-alerta">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export { FormularioCorto, CampoFormulario }
