"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Ellipsis, House, LogOut, Users, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { cerrarSesion } from "@/app/login/acciones";
import { Button } from "@/components/ui/button";

interface Seccion {
  href: string;
  texto: string;
  Icono: LucideIcon;
}

const SECCIONES: Seccion[] = [
  { href: "/", texto: "Inicio", Icono: House },
  { href: "/inventario", texto: "Inventario", Icono: Boxes },
  { href: "/pacientes", texto: "Pacientes", Icono: Users },
  { href: "/mas", texto: "Más", Icono: Ellipsis },
];

function esActiva(ruta: string, href: string) {
  return href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`);
}

export function Navegacion() {
  const ruta = usePathname();

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-4">
          {SECCIONES.map(({ href, texto, Icono }) => {
            const activa = esActiva(ruta, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={activa ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-base leading-tight font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    activa ? "bg-muted text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icono aria-hidden="true" className="size-5" />
                  <span>{texto}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-background p-4 md:flex">
        <p className="px-3 py-2 text-xl font-semibold text-primary">Consultorio</p>
        <nav aria-label="Navegación lateral" className="mt-4 flex-1">
          <ul className="flex flex-col gap-1">
            {SECCIONES.map(({ href, texto, Icono }) => {
              const activa = esActiva(ruta, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={activa ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      activa ? "bg-muted text-primary" : "text-foreground hover:bg-muted",
                    )}
                  >
                    <Icono aria-hidden="true" className="size-5" />
                    <span>{texto}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <form action={cerrarSesion}>
          <Button type="submit" variant="outline" className="w-full justify-start">
            <LogOut aria-hidden="true" />
            Cerrar sesión
          </Button>
        </form>
      </aside>
    </>
  );
}
