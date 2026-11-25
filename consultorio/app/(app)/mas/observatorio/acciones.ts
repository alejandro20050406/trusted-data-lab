"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/sesion";
import { desvincularProducto, vincularProducto } from "@/lib/observatorio/correspondencias";

export async function vincular(formData: FormData): Promise<void> {
  await requireSession();
  const datos = z
    .object({ insumoId: z.coerce.number().int().positive(), url: z.url(), nota: z.string().max(200).optional() })
    .safeParse({ insumoId: formData.get("insumoId"), url: formData.get("url"), nota: formData.get("nota") ?? undefined });
  if (!datos.success) return;
  await vincularProducto(datos.data);
  revalidatePath("/mas/observatorio");
}

export async function desvincular(formData: FormData): Promise<void> {
  await requireSession();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return;
  await desvincularProducto(id.data);
  revalidatePath("/mas/observatorio");
}
