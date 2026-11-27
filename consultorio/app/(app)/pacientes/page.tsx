import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSession } from "@/lib/sesion";
import { listarPacientes, reagendaFrecuente } from "@/lib/clinica/pacientes";
import { fechaHoraLegible, haceTiempo } from "@/lib/clinica/fechas";
import { hoyLocal } from "@/lib/inventario/estado";
import { BotonPrimario } from "@/components/ui/boton-primario";
import { Estado } from "@/components/ui/estado";
import { ListaPacientes, type PacienteFila } from "./lista-pacientes";

export const metadata = { title: "Pacientes · Consultorio" };

export default async function Pacientes() {
  await requireSession();
  const hoy = hoyLocal();
  const pacientes = await listarPacientes();
  const filas: PacienteFila[] = pacientes.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    ultimaVisita: p.ultimaVisita ? `Última visita: ${haceTiempo(p.ultimaVisita, hoy)}` : "Sin visitas registradas",
    proximaCita: p.proximaCita ? `Próxima cita: ${fechaHoraLegible(p.proximaCita)}` : null,
    vecesReagendada: p.vecesReagendada,
    reagendaSeguido: reagendaFrecuente(p.vecesReagendada),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pacientes</h1>
        <BotonPrimario asChild>
          <Link href="/pacientes/nuevo">
            <Plus aria-hidden="true" />
            Nuevo paciente
          </Link>
        </BotonPrimario>
      </div>
      {filas.length === 0 ? (
        <Estado tipo="neutro" texto="Todavía no hay pacientes. Agrega el primero con “Nuevo paciente”." />
      ) : (
        <ListaPacientes pacientes={filas} />
      )}
    </div>
  );
}
