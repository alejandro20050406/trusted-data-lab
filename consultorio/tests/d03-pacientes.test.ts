import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepararDb } from "./ayuda-db";
import type { Db } from "@/lib/db";
import {
  calcularUltimaVisita,
  calcularVecesReagendada,
  crearPaciente,
  deshacerMarcaCita,
  fichaPaciente,
  listarPacientes,
  marcarCita,
  programarCita,
  reagendaFrecuente,
  reagendarCita,
} from "@/lib/clinica/pacientes";
import { fechaHoraLegible, fechaHoraLocal, fechaHoraLocalAUtc, haceTiempo } from "@/lib/clinica/fechas";

const d = (iso: string) => new Date(iso);

describe("D-03 cálculos puros", () => {
  it("la última visita es la última cita atendida, no la última cita", () => {
    const citas = [
      { fechaHora: d("2026-09-01T16:00:00Z"), estado: "atendida" as const },
      { fechaHora: d("2026-10-15T16:00:00Z"), estado: "atendida" as const },
      { fechaHora: d("2026-11-01T16:00:00Z"), estado: "reagendada" as const },
      { fechaHora: d("2026-11-20T16:00:00Z"), estado: "programada" as const },
    ];
    expect(calcularUltimaVisita(citas)).toEqual(d("2026-10-15T16:00:00Z"));
    expect(calcularUltimaVisita([{ fechaHora: d("2026-11-01T16:00:00Z"), estado: "cancelada" }])).toBeNull();
  });

  it("cuenta las citas reagendadas", () => {
    expect(calcularVecesReagendada([{ estado: "reagendada" }, { estado: "reagendada" }, { estado: "programada" }])).toBe(2);
    expect(calcularVecesReagendada([])).toBe(0);
  });

  it("la insignia aparece desde el umbral", () => {
    expect(reagendaFrecuente(2, 3)).toBe(false);
    expect(reagendaFrecuente(3, 3)).toBe(true);
  });

  it("formatea el tiempo desde la última visita", () => {
    expect(haceTiempo("2026-11-27", "2026-11-27")).toBe("hoy");
    expect(haceTiempo("2026-11-26", "2026-11-27")).toBe("ayer");
    expect(haceTiempo("2026-11-22", "2026-11-27")).toBe("hace 5 días");
    expect(haceTiempo("2026-11-06", "2026-11-27")).toBe("hace 3 semanas");
    expect(haceTiempo("2026-09-01", "2026-11-27")).toBe("hace 2 meses");
    expect(haceTiempo("2025-10-01", "2026-11-27")).toBe("hace 1 año");
  });

  it("convierte la hora local del consultorio a UTC y de regreso", () => {
    const instante = fechaHoraLocalAUtc("2026-12-01", "10:30", "America/Mexico_City");
    expect(instante.toISOString()).toBe("2026-12-01T16:30:00.000Z");
    expect(fechaHoraLocal(instante, "America/Mexico_City")).toEqual({ fecha: "2026-12-01", hora: "10:30" });
    expect(fechaHoraLegible(instante, "America/Mexico_City")).toBe("mar 1 dic 2026, 10:30");
    expect(() => fechaHoraLocalAUtc("2026-02-31", "10:00")).toThrow(RangeError);
    expect(() => fechaHoraLocalAUtc("2026-12-01", "25:00")).toThrow(RangeError);
  });
});

describe("D-03 con base de datos", () => {
  let cerrar: () => Promise<void>;
  let db: Db;
  beforeAll(async () => {
    ({ db, cerrar } = await prepararDb());
    void db;
  });
  afterAll(async () => cerrar());

  it("una cita reagendada dos veces cuenta 2 y queda enlazada en cadena", async () => {
    const id = await crearPaciente({ nombre: "Paciente Ficticio Uno", telefono: "312 000 0000" });
    const c1 = await programarCita(id, d("2026-11-03T16:00:00Z"));
    const c2 = await reagendarCita(c1, d("2026-11-10T16:00:00Z"));
    const c3 = await reagendarCita(c2, d("2026-11-17T16:00:00Z"));
    await marcarCita(c3, "atendida");

    const ficha = await fichaPaciente(id);
    expect(ficha?.vecesReagendada).toBe(2);
    expect(ficha?.ultimaVisita).toEqual(d("2026-11-17T16:00:00Z"));
    const porId = new Map(ficha!.citas.map((c) => [c.id, c]));
    expect(porId.get(c2)?.citaOriginalId).toBe(c1);
    expect(porId.get(c3)?.citaOriginalId).toBe(c2);
    expect(porId.get(c1)?.estado).toBe("reagendada");
    expect(porId.get(c2)?.estado).toBe("reagendada");
    expect(ficha?.citaPendiente).toBeNull();

    const lista = await listarPacientes(d("2026-11-27T12:00:00Z"));
    const fila = lista.find((p) => p.id === id);
    expect(fila).toMatchObject({ vecesReagendada: 2, ultimaVisita: "2026-11-17", proximaCita: null });
  });

  it("no se reagenda dos veces la misma cita ni una atendida", async () => {
    const id = await crearPaciente({ nombre: "Paciente Ficticio Dos" });
    const c1 = await programarCita(id, d("2026-12-01T16:00:00Z"));
    await reagendarCita(c1, d("2026-12-08T16:00:00Z"));
    await expect(reagendarCita(c1, d("2026-12-09T16:00:00Z"))).rejects.toThrow("Solo se reagenda");
    const ficha = await fichaPaciente(id);
    await marcarCita(ficha!.citaPendiente!.id, "atendida");
    await expect(reagendarCita(ficha!.citaPendiente!.id, d("2026-12-10T16:00:00Z"))).rejects.toThrow();
    await expect(marcarCita(ficha!.citaPendiente!.id, "atendida")).rejects.toThrow("ya no está programada");
  });

  it("deshacer regresa la cita a programada dentro de la ventana", async () => {
    const id = await crearPaciente({ nombre: "Paciente Ficticio Tres" });
    const c = await programarCita(id, d("2026-12-02T16:00:00Z"));
    await marcarCita(c, "atendida");
    expect(await deshacerMarcaCita(c)).toBe(true);
    expect((await fichaPaciente(id))?.citaPendiente?.id).toBe(c);
    await marcarCita(c, "atendida");
    expect(await deshacerMarcaCita(c, new Date(Date.now() + 120_000))).toBe(false);
  });

  it("valida nombre y teléfono", async () => {
    await expect(crearPaciente({ nombre: "A" })).rejects.toThrow();
    await expect(crearPaciente({ nombre: "Paciente Ficticio", telefono: "abc" })).rejects.toThrow();
  });

  it("la próxima cita de la lista es la programada futura más cercana", async () => {
    const id = await crearPaciente({ nombre: "Paciente Ficticio Cuatro" });
    await programarCita(id, d("2026-12-20T16:00:00Z"));
    await programarCita(id, d("2026-12-05T16:00:00Z"));
    const fila = (await listarPacientes(d("2026-11-27T12:00:00Z"))).find((p) => p.id === id);
    expect(fila?.proximaCita).toEqual(d("2026-12-05T16:00:00Z"));
    expect(fila?.ultimaVisita).toBeNull();
  });
});
