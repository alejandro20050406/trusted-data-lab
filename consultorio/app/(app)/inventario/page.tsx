import { requireSession } from "@/lib/sesion";

export default async function Inventario() {
  await requireSession();
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Inventario</h1>
      <p className="text-muted-foreground">Próximamente</p>
    </>
  );
}
