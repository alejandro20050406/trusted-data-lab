import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { hoyLocal } from "@/lib/inventario/estado";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { BotonPrimario } from "@/components/ui/boton-primario";
import { ListaInventario, type ItemLista } from "./lista-inventario";

export default async function Inventario() {
  await requireSession();
  const insumos = await inventarioConEstado(hoyLocal());
  const items: ItemLista[] = insumos.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    unidad: i.unidad,
    cantidad: i.estado.existenciaUtil,
    minimoReserva: i.minimoReserva,
    tipoVariante: i.tipoVariante,
    variantes: i.variantes.map((v) => ({ id: v.id, nombre: v.nombre, colorHex: v.colorHex, existencia: v.existencia })),
  }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <BotonPrimario asChild>
          <Link href="/inventario/compra">
            <Plus aria-hidden="true" />
            Registrar compra
          </Link>
        </BotonPrimario>
      </div>
      <ListaInventario items={items} />
    </>
  );
}
