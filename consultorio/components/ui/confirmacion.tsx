"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"

export const DURACION_DESHACER_MS = 10000

interface OpcionesConfirmacion {
  mensaje: string
  alDeshacer?: () => void | Promise<void>
  duracionMs?: number
}

interface ContextoConfirmacion {
  mostrar: (opciones: OpcionesConfirmacion) => void
}

const Contexto = React.createContext<ContextoConfirmacion | null>(null)

interface Visible {
  id: number
  mensaje: string
  alDeshacer?: () => void | Promise<void>
}

export function ProveedorConfirmacion({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = React.useState<Visible | null>(null)
  const temporizador = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const contador = React.useRef(0)

  const limpiar = React.useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
  }, [])

  React.useEffect(() => limpiar, [limpiar])

  const programarCierre = React.useCallback(
    (id: number, ms: number) => {
      limpiar()
      temporizador.current = setTimeout(() => {
        setVisible((actual) => (actual?.id === id ? null : actual))
      }, ms)
    },
    [limpiar],
  )

  const mostrar = React.useCallback(
    ({ mensaje, alDeshacer, duracionMs = DURACION_DESHACER_MS }: OpcionesConfirmacion) => {
      const id = ++contador.current
      setVisible({ id, mensaje, alDeshacer })
      programarCierre(id, duracionMs)
    },
    [programarCierre],
  )

  async function deshacer() {
    if (!visible?.alDeshacer) return
    const { id, alDeshacer } = visible
    limpiar()
    await alDeshacer()
    setVisible({ id, mensaje: "Se deshizo" })
    programarCierre(id, 4000)
  }

  const valor = React.useMemo(() => ({ mostrar }), [mostrar])

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 md:bottom-6"
      >
        {visible ? (
          <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl bg-foreground py-2 pr-2 pl-4 text-base text-background shadow-lg">
            <span>{visible.mensaje}</span>
            {visible.alDeshacer ? (
              <Button type="button" variant="secondary" onClick={deshacer}>
                Deshacer
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Contexto.Provider>
  )
}

export function useConfirmacion(): ContextoConfirmacion {
  const contexto = React.useContext(Contexto)
  if (!contexto) throw new Error("useConfirmacion debe usarse dentro de ProveedorConfirmacion")
  return contexto
}
