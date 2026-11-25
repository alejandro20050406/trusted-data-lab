import { inventarioConEstado } from "./consultas";
import { sincronizarAvisosInventario } from "./avisos-inventario";
import { hoyLocal } from "./estado";

/**
 * Recalcula los avisos de inventario para hoy. La llaman el cron diario
 * (/api/cron/inventario) y el panel de inicio al abrirse.
 */
export async function actualizarAvisosInventario(hoy = hoyLocal()) {
  return sincronizarAvisosInventario(await inventarioConEstado(hoy));
}
