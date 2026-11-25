/**
 * Avisos automáticos de inventario (A-10): reserva baja o agotado, caducidad
 * próxima, lotes caducados y ligas vencidas por antigüedad.
 */
import { and, eq, inArray, like, notInArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aviso } from "@/lib/db/schema";
import { crearAviso, type DatosAviso } from "@/lib/avisos";
import { cantidadConUnidad, fechaCorta } from "./formato";
import type { InsumoConEstado } from "./consultas";

export const PREFIJO_CLAVE = "inventario:";

/** Texto extra del aviso de reserva (A-14: opción más barata). */
export type DetalleRecompra = (insumo: InsumoConEstado) => string | null;

function frase(n: number, unidad: string | null, nombre: string): string {
  const verbo = n === 1 ? "queda" : "quedan";
  return unidad ? `Te ${verbo} ${cantidadConUnidad(n, unidad)} de ${nombre.toLowerCase()}` : `Te ${verbo} ${n} de ${nombre.toLowerCase()} (unidad sin definir)`;
}

/** Calcula los avisos que deben estar abiertos según el estado del inventario. */
export function planAvisosInventario(inventario: readonly InsumoConEstado[], detalleRecompra?: DetalleRecompra): (DatosAviso & { clave: string })[] {
  const avisos: (DatosAviso & { clave: string })[] = [];
  for (const i of inventario) {
    const e = i.estado;
    const compra = `/inventario/compra?insumo=${i.id}`;
    const detalleExtra = (base: string) => {
      const extra = detalleRecompra?.(i);
      return extra ? `${base}\n${extra}` : base;
    };

    if (e.nivel === "agotado" && (e.reservaDefinida || e.existencia > 0 || i.lotes.length > 0)) {
      avisos.push({
        clave: `${PREFIJO_CLAVE}reserva:${i.id}`,
        origen: "inventario",
        tipo: "agotado",
        prioridad: "alta",
        titulo: `Se acabó: ${i.nombre}`,
        detalle: detalleExtra(`No queda ${i.nombre.toLowerCase()} disponible.`),
        urlAccion: compra,
      });
    } else if (e.nivel === "reserva") {
      avisos.push({
        clave: `${PREFIJO_CLAVE}reserva:${i.id}`,
        origen: "inventario",
        tipo: "reserva_baja",
        prioridad: "alta",
        titulo: `Reserva baja: ${i.nombre}`,
        detalle: detalleExtra(`${frase(e.existenciaUtil, i.unidad, i.nombre)}; la reserva es ${cantidadConUnidad(i.minimoReserva!, i.unidad)}.`),
        urlAccion: compra,
      });
    }

    for (const l of e.lotesPorCaducar) {
      avisos.push({
        clave: `${PREFIJO_CLAVE}caducidad:${l.id}`,
        origen: "inventario",
        tipo: "por_caducar",
        prioridad: l.diasRestantes <= 7 ? "alta" : "media",
        titulo: `Por caducar: ${i.nombre}`,
        detalle: `${cantidadConUnidad(l.restante, i.unidad)} caduca${l.restante === 1 ? "" : "n"} el ${fechaCorta(l.fechaCaducidad!)} (${l.diasRestantes === 0 ? "hoy" : `en ${l.diasRestantes} día${l.diasRestantes === 1 ? "" : "s"}`}).`,
        fechaVencimiento: l.fechaCaducidad,
        urlAccion: `/inventario/${i.id}`,
      });
    }
    for (const l of e.lotesCaducados) {
      avisos.push({
        clave: `${PREFIJO_CLAVE}caducado:${l.id}`,
        origen: "inventario",
        tipo: "caducado",
        prioridad: "alta",
        titulo: `Caducado: ${i.nombre}`,
        detalle: `${cantidadConUnidad(l.restante, i.unidad)} caducó el ${fechaCorta(l.fechaCaducidad!)}. Retíralo y dalo de baja.`,
        fechaVencimiento: l.fechaCaducidad,
        urlAccion: `/inventario/${i.id}`,
      });
    }
    for (const l of e.lotesVencidos) {
      avisos.push({
        clave: `${PREFIJO_CLAVE}vencido:${l.id}`,
        origen: "inventario",
        tipo: "vencido_antiguedad",
        prioridad: "media",
        titulo: `Ya no son válidas: ${i.nombre}`,
        detalle: `${cantidadConUnidad(l.restante, i.unidad)} comprada${l.restante === 1 ? "" : "s"} el ${fechaCorta(l.fechaCompra)} pasó de los ${i.vidaUtilDias} días de validez.`,
        fechaVencimiento: l.venceEl,
        urlAccion: `/inventario/${i.id}`,
      });
    }
  }
  return avisos;
}

/**
 * Deja los avisos de inventario iguales al plan:
 * - crea o actualiza los avisos activos (sin duplicar, por `clave`);
 * - cierra los abiertos cuya condición desapareció (p. ej. se repuso el insumo);
 * - si la dentista marcó un aviso como hecho y la condición sigue, no lo reabre;
 *   cuando la condición desaparece, se libera la clave para avisar de nuevo.
 */
export async function sincronizarAvisosInventario(
  inventario: readonly InsumoConEstado[],
  detalleRecompra?: DetalleRecompra,
): Promise<{ abiertos: number; cerrados: number }> {
  const plan = planAvisosInventario(inventario, detalleRecompra);
  const claves = plan.map((a) => a.clave);
  const db = getDb();
  const deInventario = like(aviso.clave, `${PREFIJO_CLAVE}%`);
  const fuera = claves.length > 0 ? notInArray(aviso.clave, claves) : undefined;

  const cerrados = await db
    .update(aviso)
    .set({ atendido: true, atendidoEn: new Date() })
    .where(and(deInventario, eq(aviso.atendido, false), fuera))
    .returning({ id: aviso.id });
  // Libera las claves de avisos ya atendidos cuya condición terminó.
  await db.update(aviso).set({ clave: null }).where(and(deInventario, eq(aviso.atendido, true), fuera));

  const descartados =
    claves.length === 0
      ? new Set<string>()
      : new Set(
          (
            await db
              .select({ clave: aviso.clave })
              .from(aviso)
              .where(and(inArray(aviso.clave, claves), eq(aviso.atendido, true)))
          ).map((f) => f.clave!),
        );
  let abiertos = 0;
  for (const datos of plan) {
    if (descartados.has(datos.clave)) continue;
    await crearAviso(datos);
    abiertos += 1;
  }
  return { abiertos, cerrados: cerrados.length };
}
