import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { hoyLocal } from "@/lib/inventario/estado";

export const metadata = { title: "Reportes · Consultorio" };

function Enlace({ href, titulo, detalle }: { href: string; titulo: string; detalle: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="flex flex-col">
          <span className="text-lg font-medium">{titulo}</span>
          <span className="text-muted-foreground">{detalle}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

export default async function Reportes() {
  await requireSession();
  const conCompras = (await inventarioConEstado(hoyLocal())).filter((i) => i.lotes.some((l) => l.precioTotal !== null));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Reportes</h1>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        <Enlace href="/reportes/colores" titulo="Colores de ligas más usados" detalle="Consumo por color y cuánto comprar" />
        <Enlace href="/reportes/brackets" titulo="Brackets caídos" detalle="Dientes y pacientes con más caídas, con fotos" />
      </ul>
      <section aria-labelledby="titulo-precios" className="flex flex-col gap-3">
        <h2 id="titulo-precios" className="text-xl font-semibold">
          Variación de precios
        </h2>
        {conCompras.length === 0 ? (
          <p className="text-muted-foreground">Registra compras con precio para ver cómo cambian.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {conCompras.map((i) => (
              <Enlace key={i.id} href={`/inventario/${i.id}`} titulo={i.nombre} detalle={`${i.lotes.filter((l) => l.precioTotal !== null).length} compras con precio`} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
