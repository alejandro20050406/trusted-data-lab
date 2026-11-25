import { asc } from "drizzle-orm";
import { requireSession } from "@/lib/sesion";
import { getDb } from "@/lib/db";
import { diente } from "@/lib/db/schema";
import { hoyLocal } from "@/lib/inventario/estado";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { ultimaCompra } from "@/lib/inventario/compras";
import { FormularioCompra, type InsumoCompra, type UltimaCompra } from "./formulario-compra";

export default async function RegistrarCompra(props: PageProps<"/inventario/compra">) {
  await requireSession();
  const { insumo: parametro, diente: parametroDiente } = await props.searchParams;
  const hoy = hoyLocal();
  const [insumos, dientes] = await Promise.all([
    inventarioConEstado(hoy),
    getDb().select({ fdi: diente.fdi, nombre: diente.nombre }).from(diente).orderBy(asc(diente.fdi)),
  ]);

  const opciones: InsumoCompra[] = insumos.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    usaCaducidad: i.usaCaducidad,
    tipoVariante: i.tipoVariante,
    colores: i.variantes.filter((v) => v.tipo === "color").map((v) => ({ id: v.id, nombre: v.nombre, colorHex: v.colorHex ?? "#CCCCCC" })),
  }));
  const ultimas: Record<number, UltimaCompra | null> = {};
  await Promise.all(
    insumos.map(async (i) => {
      ultimas[i.id] = await ultimaCompra(i.id);
    }),
  );

  const pedido = Number(Array.isArray(parametro) ? parametro[0] : parametro);
  const inicial = insumos.some((i) => i.id === pedido) ? pedido : null;
  const dientePedido = Number(Array.isArray(parametroDiente) ? parametroDiente[0] : parametroDiente);
  const dienteInicial = dientes.some((d) => d.fdi === dientePedido) ? dientePedido : null;

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Registrar compra</h1>
      <FormularioCompra insumos={opciones} dientes={dientes} ultimas={ultimas} insumoInicial={inicial} dienteInicial={dienteInicial} hoy={hoy} />
    </>
  );
}
