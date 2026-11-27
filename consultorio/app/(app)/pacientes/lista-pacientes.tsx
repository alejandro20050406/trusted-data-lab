"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Repeat } from "lucide-react";
import { Input } from "@/components/ui/input";

export interface PacienteFila {
  id: number;
  nombre: string;
  ultimaVisita: string;
  proximaCita: string | null;
  vecesReagendada: number;
  reagendaSeguido: boolean;
}

const normalizar = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

export function ListaPacientes({ pacientes }: { pacientes: PacienteFila[] }) {
  const [busqueda, setBusqueda] = useState("");
  const q = normalizar(busqueda);
  const visibles = q === "" ? pacientes : pacientes.filter((p) => normalizar(p.nombre).includes(q));

  return (
    <>
      <Input
        type="search"
        aria-label="Buscar paciente"
        placeholder="Buscar paciente"
        autoComplete="off"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />
      {visibles.length === 0 ? <p className="text-muted-foreground">Ningún paciente coincide con la búsqueda.</p> : null}
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {visibles.map((p) => (
          <li key={p.id} data-paciente={p.id}>
            <Link href={`/pacientes/${p.id}`} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="flex flex-col gap-1">
                <span className="text-lg font-medium">{p.nombre}</span>
                <span className="text-muted-foreground">{p.ultimaVisita}</span>
                {p.proximaCita ? <span className="text-muted-foreground">{p.proximaCita}</span> : null}
                {p.reagendaSeguido ? (
                  <span className="inline-flex w-fit items-center gap-1 rounded-md bg-advertencia-fondo px-2 py-0.5 font-medium text-advertencia" data-insignia="reagenda">
                    <Repeat aria-hidden="true" className="size-4" />
                    Reagenda seguido ({p.vecesReagendada} veces)
                  </span>
                ) : null}
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
