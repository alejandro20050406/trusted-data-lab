import * as React from "react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"

type Props = Omit<React.ComponentProps<typeof Button>, "variant" | "aria-label"> & {
  /** Obligatorio: el botón suele mostrar solo un símbolo como "−1". */
  "aria-label": string
}

function BotonUnToque({ className, ...props }: Props) {
  return (
    <Button
      variant="outline"
      className={cn("h-12 min-w-12 px-3 text-lg font-semibold", className)}
      {...props}
    />
  )
}

export { BotonUnToque }
