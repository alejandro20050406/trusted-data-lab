import Link from "next/link";
import { cn } from "cn";

export const PERIODOS = [30, 90, 365] as const;
export type Periodo = (typeof PERIODOS)[number];

/** Lee `?dias=` y cae al valor por omisión si no es uno de los periodos. */
export function leerPeriodo(valor: string | string[] | undefined, porOmision: Periodo): Periodo {
  const n = Number(Array.isArray(valor) ? valor[0] : valor);
  return (PERIODOS as readonly number[]).includes(n) ? (n as Periodo) : porOmision;
}

/** Tres enlaces grandes para cambiar el periodo del reporte. */
export function SelectorPeriodo({ ruta, actual }: { ruta: string; actual: Periodo }) {
  return (
    <nav aria-label="Periodo del reporte" className="grid grid-cols-3 gap-2">
      {PERIODOS.map((p) => (
        <Link
          key={p}
          href={`${ruta}?dias=${p}`}
          aria-current={p === actual ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center justify-center rounded-lg border px-2 text-base font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            p === actual ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted",
          )}
        >
          {p === 365 ? "1 año" : `${p} días`}
        </Link>
      ))}
    </nav>
  );
}
