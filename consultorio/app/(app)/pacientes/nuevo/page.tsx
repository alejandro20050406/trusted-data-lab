import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { FormularioPaciente } from "../formulario-paciente";

export const metadata = { title: "Nuevo paciente · Consultorio" };

export default async function NuevoPaciente() {
  await requireSession();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/pacientes" className="inline-flex min-h-11 items-center gap-2 text-primary underline underline-offset-4">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Pacientes
      </Link>
      <h1 className="text-2xl font-semibold">Nuevo paciente</h1>
      <p className="text-muted-foreground">Solo el nombre es obligatorio. Usa pacientes ficticios hasta aprobar el aviso de privacidad.</p>
      <FormularioPaciente />
    </div>
  );
}
