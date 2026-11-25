"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/sesion";
import { ExistenciaInsuficiente, hoyLocal } from "@/lib/inventario/estado";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { CompraInvalida, registrarCompra } from "@/lib/inventario/compras";
import { ConsumoInvalido, deshacerConsumo, registrarConsumo } from "@/lib/inventario/consumo";
import { esquemaBracket, esquemaColor, obtenerOCrearBracket, obtenerOCrearColor } from "@/lib/inventario/variantes";
import { actualizarReglasInsumo, darDeBajaLote } from "@/lib/inventario/ajustes";

export type Resultado = { ok: true } | { ok: false; error: string };

export type ResultadoConsumoAccion = { ok: true; grupoId: string; existenciaRestante: number } | { ok: false; error: string };

export interface EstadoCompra {
  ok: boolean;
  error: string | null;
  /** Campo del formulario al que pertenece el error. */
  campo: string | null;
  /** Lo escrito, para que el formulario no se vacíe cuando hay un error. */
  valores: Record<string, string>;
}

export interface EstadoSimple {
  ok: boolean;
  error: string | null;
}

function revalidar() {
  revalidatePath("/inventario");
  revalidatePath("/inventario/[id]", "page");
  revalidatePath("/");
}

function texto(formData: FormData, nombre: string): string {
  const v = formData.get(nombre);
  return typeof v === "string" ? v.trim() : "";
}

const vacioAUndefined = (v: string) => (v === "" ? undefined : v);

const esquemaFormularioCompra = z.object({
  insumoId: z.coerce.number().int().positive({ error: "Elige un insumo." }),
  cantidad: z.string().min(1, { error: "Escribe la cantidad." }),
  precioTotal: z.string().min(1, { error: "Escribe el precio total." }),
});

function campoDelError(mensaje: string): string | null {
  const m = mensaje.toLowerCase();
  if (m.includes("cantidad")) return "cantidad";
  if (m.includes("precio")) return "precioTotal";
  if (m.includes("caducidad")) return "fechaCaducidad";
  if (m.includes("contenido")) return "contenidoPorUnidad";
  if (m.includes("color")) return "colorId";
  if (m.includes("diente")) return "dienteFdi";
  if (m.includes("insumo")) return "insumoId";
  if (m.includes("fecha")) return "fechaCompra";
  return null;
}

export async function registrarCompraAccion(_previo: EstadoCompra, formData: FormData): Promise<EstadoCompra> {
  await requireSession();
  const valores: Record<string, string> = {};
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === "string") valores[clave] = valor;
  }
  const fallo = (error: string, campo: string | null): EstadoCompra => ({ ok: false, error, campo, valores });

  const base = esquemaFormularioCompra.safeParse({
    insumoId: texto(formData, "insumoId"),
    cantidad: texto(formData, "cantidad"),
    precioTotal: texto(formData, "precioTotal"),
  });
  if (!base.success) {
    const problema = base.error.issues[0];
    return fallo(problema?.message ?? "Revisa los datos.", String(problema?.path[0] ?? "") || null);
  }

  try {
    const insumos = await inventarioConEstado(hoyLocal());
    const elegido = insumos.find((i) => i.id === base.data.insumoId);
    if (!elegido) return fallo("El insumo no existe.", "insumoId");

    let varianteId: number | undefined;
    if (elegido.tipoVariante === "color") {
      const colorId = texto(formData, "colorId");
      if (colorId === "") return fallo("Elige el color.", "colorId");
      if (colorId === "nuevo") {
        const color = esquemaColor.safeParse({ nombre: texto(formData, "colorNombre"), colorHex: texto(formData, "colorHex") });
        if (!color.success) return fallo(color.error.issues[0]?.message ?? "Revisa el color.", "colorNombre");
        varianteId = await obtenerOCrearColor(elegido.id, color.data);
      } else {
        const id = z.coerce.number().int().positive().safeParse(colorId);
        if (!id.success || !elegido.variantes.some((v) => v.id === id.data)) return fallo("Elige el color.", "colorId");
        varianteId = id.data;
      }
    } else if (elegido.tipoVariante === "diente") {
      if (texto(formData, "dienteFdi") === "") return fallo("Elige el diente.", "dienteFdi");
      const bracket = esquemaBracket.safeParse({
        dienteFdi: texto(formData, "dienteFdi"),
        sistema: texto(formData, "sistema"),
        slot: texto(formData, "slot"),
      });
      if (!bracket.success) {
        const problema = bracket.error.issues[0];
        const campo = String(problema?.path[0] ?? "dienteFdi");
        return fallo(campo === "dienteFdi" ? "Elige el diente." : (problema?.message ?? "Revisa el bracket."), campo);
      }
      varianteId = await obtenerOCrearBracket(elegido.id, bracket.data);
    }

    await registrarCompra({
      insumoId: elegido.id,
      cantidad: base.data.cantidad,
      precioTotal: base.data.precioTotal,
      fechaCompra: vacioAUndefined(texto(formData, "fechaCompra")),
      fechaCaducidad: elegido.usaCaducidad ? vacioAUndefined(texto(formData, "fechaCaducidad")) : undefined,
      varianteId,
      proveedor: vacioAUndefined(texto(formData, "proveedor")),
      presentacion: vacioAUndefined(texto(formData, "presentacion")),
      contenidoPorUnidad: vacioAUndefined(texto(formData, "contenidoPorUnidad")),
    });
  } catch (error) {
    if (error instanceof CompraInvalida) return fallo(error.message, campoDelError(error.message));
    throw error;
  }
  revalidar();
  return { ok: true, error: null, campo: null, valores: {} };
}

const esquemaConsumoAccion = z.object({
  insumoId: z.number().int().positive(),
  cantidad: z
    .number({ error: "Escribe una cantidad." })
    .int({ error: "Usa un número entero." })
    .min(1, { error: "La cantidad debe ser mayor que cero." })
    .max(100000),
  varianteId: z.number().int().positive().nullish(),
});

export async function descontarAccion(datos: { insumoId: number; cantidad: number; varianteId?: number | null }): Promise<ResultadoConsumoAccion> {
  await requireSession();
  const valido = esquemaConsumoAccion.safeParse(datos);
  if (!valido.success) return { ok: false, error: valido.error.issues[0]?.message ?? "Datos inválidos." };
  try {
    const { grupoId, existenciaRestante } = await registrarConsumo(valido.data);
    revalidar();
    return { ok: true, grupoId, existenciaRestante };
  } catch (error) {
    if (error instanceof ExistenciaInsuficiente || error instanceof ConsumoInvalido) return { ok: false, error: error.message };
    throw error;
  }
}

export async function deshacerConsumoAccion(grupoId: string): Promise<Resultado> {
  await requireSession();
  const valido = z.uuid().safeParse(grupoId);
  if (!valido.success) return { ok: false, error: "No se pudo deshacer." };
  const deshecho = await deshacerConsumo(valido.data);
  revalidar();
  return deshecho ? { ok: true } : { ok: false, error: "Ya no se puede deshacer." };
}

const esquemaId = z.coerce.number().int().positive();

export async function guardarReglasAccion(_previo: EstadoSimple, formData: FormData): Promise<EstadoSimple> {
  await requireSession();
  const id = esquemaId.safeParse(texto(formData, "insumoId"));
  if (!id.success) return { ok: false, error: "El insumo no existe." };
  try {
    await actualizarReglasInsumo(id.data, {
      unidad: texto(formData, "unidad"),
      minimoReserva: texto(formData, "minimoReserva"),
      diasAvisoCaducidad: texto(formData, "diasAvisoCaducidad"),
      vidaUtilDias: texto(formData, "vidaUtilDias"),
    });
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Revisa los valores." };
    if (error instanceof Error && error.message === "El insumo no existe.") return { ok: false, error: error.message };
    throw error;
  }
  revalidar();
  return { ok: true, error: null };
}

export async function darDeBajaAccion(_previo: EstadoSimple, formData: FormData): Promise<EstadoSimple> {
  await requireSession();
  const id = esquemaId.safeParse(texto(formData, "loteId"));
  if (!id.success) return { ok: false, error: "El lote no existe." };
  try {
    await darDeBajaLote(id.data, "Baja por caducidad o vencimiento");
  } catch (error) {
    if (error instanceof Error && error.message === "El lote no existe.") return { ok: false, error: error.message };
    throw error;
  }
  revalidar();
  return { ok: true, error: null };
}
