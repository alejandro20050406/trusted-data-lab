import { referenciaMasBarata } from "@/lib/observatorio/correspondencias";
import { inventarioConEstado } from "./consultas";
import { sincronizarAvisosInventario } from "./avisos-inventario";
import { hoyLocal } from "./estado";
import { compraMasBarata, historialPrecios } from "./precios";
import { textoRecompra } from "./recompra";

/**
 * Recalcula los avisos de inventario para hoy. La llaman el cron diario
 * (/api/cron/inventario) y el panel de inicio al abrirse. Los avisos de
 * reserva incluyen la opción más barata conocida (A-14).
 */
export async function actualizarAvisosInventario(hoy = hoyLocal()) {
  const inventario = await inventarioConEstado(hoy);
  const porReponer = inventario.filter((i) => i.estado.nivel !== "suficiente");
  const textos = new Map<number, string | null>();
  await Promise.all(
    porReponer.map(async (i) => {
      const [historial, referencia] = await Promise.all([historialPrecios(i.id), referenciaMasBarata(i.id)]);
      textos.set(i.id, textoRecompra(i.unidad, compraMasBarata(historial), referencia));
    }),
  );
  return sincronizarAvisosInventario(inventario, (i) => textos.get(i.id) ?? null);
}
