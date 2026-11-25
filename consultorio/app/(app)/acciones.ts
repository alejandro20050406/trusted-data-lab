"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/sesion";
import { marcarAvisoAtendido } from "@/lib/avisos";

/** Botón "Marcar como hecho" del panel de inicio. */
export async function marcarAvisoHecho(formData: FormData): Promise<void> {
  await requireSession();
  const id = z.coerce.number().int().positive().safeParse(formData.get("id"));
  if (!id.success) return;
  await marcarAvisoAtendido(id.data);
  revalidatePath("/");
}
