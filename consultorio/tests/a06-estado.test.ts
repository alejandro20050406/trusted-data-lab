import { describe, expect, it } from "vitest";
import { estadoInsumo, planConsumoFEFO, sumarDias, ExistenciaInsuficiente, type LoteEstado } from "@/lib/inventario/estado";

const HOY = "2026-11-25";

function lote(parcial: Partial<LoteEstado> & { id: number; restante: number }): LoteEstado {
  return { fechaCompra: "2026-11-01", fechaCaducidad: null, ...parcial };
}

const guantes = { minimoReserva: 1, diasAvisoCaducidad: null, vidaUtilDias: null };
const resina = { minimoReserva: 1, diasAvisoCaducidad: 30, vidaUtilDias: null };

describe("sumarDias", () => {
  it("suma días a una fecha AAAA-MM-DD sin depender de la zona horaria", () => {
    expect(sumarDias("2026-11-25", 30)).toBe("2026-12-25");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("A-06 estadoInsumo", () => {
  it("suficiente: la existencia supera la reserva", () => {
    const e = estadoInsumo(guantes, [lote({ id: 1, restante: 3 })], HOY);
    expect(e).toMatchObject({ existencia: 3, existenciaUtil: 3, nivel: "suficiente", reservaDefinida: true });
  });

  it("en reserva: la existencia es igual o menor que el mínimo", () => {
    expect(estadoInsumo(guantes, [lote({ id: 1, restante: 1 })], HOY).nivel).toBe("reserva");
    expect(estadoInsumo({ ...guantes, minimoReserva: 2 }, [lote({ id: 1, restante: 1 })], HOY).nivel).toBe("reserva");
  });

  it("agotado: no queda nada útil", () => {
    expect(estadoInsumo(guantes, [], HOY).nivel).toBe("agotado");
    expect(estadoInsumo(guantes, [lote({ id: 1, restante: 0 })], HOY).nivel).toBe("agotado");
  });

  it("sin reserva definida: no inventa un mínimo", () => {
    const e = estadoInsumo({ ...guantes, minimoReserva: null }, [lote({ id: 1, restante: 1 })], HOY);
    expect(e).toMatchObject({ nivel: "suficiente", reservaDefinida: false });
  });

  it("por caducar: un lote caduca dentro de diasAvisoCaducidad", () => {
    const e = estadoInsumo(
      resina,
      [lote({ id: 1, restante: 2, fechaCaducidad: "2026-12-20" }), lote({ id: 2, restante: 2, fechaCaducidad: "2027-06-01" })],
      HOY,
    );
    expect(e.lotesPorCaducar.map((l) => [l.id, l.diasRestantes])).toEqual([[1, 25]]);
    expect(e.lotesCaducados).toEqual([]);
    expect(e.existenciaUtil).toBe(4);
  });

  it("el día de la caducidad todavía cuenta como por caducar, con 0 días", () => {
    const e = estadoInsumo(resina, [lote({ id: 1, restante: 1, fechaCaducidad: HOY })], HOY);
    expect(e.lotesPorCaducar.map((l) => l.diasRestantes)).toEqual([0]);
  });

  it("caducado: no cuenta como existencia útil", () => {
    const e = estadoInsumo(
      resina,
      [lote({ id: 1, restante: 2, fechaCaducidad: "2026-11-24" }), lote({ id: 2, restante: 3, fechaCaducidad: "2027-06-01" })],
      HOY,
    );
    expect(e.lotesCaducados.map((l) => l.id)).toEqual([1]);
    expect(e).toMatchObject({ existencia: 5, existenciaUtil: 3, nivel: "suficiente" });
  });

  it("sin diasAvisoCaducidad no avisa antes, pero sí marca lo caducado", () => {
    const e = estadoInsumo(
      guantes,
      [lote({ id: 1, restante: 1, fechaCaducidad: "2026-11-26" }), lote({ id: 2, restante: 1, fechaCaducidad: "2026-11-01" })],
      HOY,
    );
    expect(e.lotesPorCaducar).toEqual([]);
    expect(e.lotesCaducados.map((l) => l.id)).toEqual([2]);
  });

  it("liga vencida por antigüedad: compra + vidaUtilDias ya pasó", () => {
    const ligas = { minimoReserva: null, diasAvisoCaducidad: null, vidaUtilDias: 90 };
    const e = estadoInsumo(
      ligas,
      [lote({ id: 1, restante: 4, fechaCompra: "2026-08-27" }), lote({ id: 2, restante: 5, fechaCompra: "2026-08-28" })],
      HOY,
    );
    // 2026-08-27 + 90 = 2026-11-25 (vence hoy); 2026-08-28 + 90 = 2026-11-26.
    expect(e.lotesVencidos.map((l) => [l.id, l.venceEl])).toEqual([[1, "2026-11-25"]]);
    expect(e).toMatchObject({ existenciaUtil: 5, vidaUtilDefinida: true });
  });

  it("sin vidaUtilDias no marca ligas vencidas e informa que falta definirla", () => {
    const ligas = { minimoReserva: null, diasAvisoCaducidad: null, vidaUtilDias: null };
    const e = estadoInsumo(ligas, [lote({ id: 1, restante: 4, fechaCompra: "2020-01-01" })], HOY);
    expect(e).toMatchObject({ lotesVencidos: [], vidaUtilDefinida: false, existenciaUtil: 4 });
  });

  it("los lotes vacíos no generan avisos de caducidad", () => {
    const e = estadoInsumo(resina, [lote({ id: 1, restante: 0, fechaCaducidad: "2026-11-01" })], HOY);
    expect(e.lotesCaducados).toEqual([]);
  });
});

describe("A-06 consumo FEFO", () => {
  it("descuenta primero el lote que caduca antes", () => {
    const lotes = [
      lote({ id: 1, restante: 2, fechaCaducidad: "2027-03-01", fechaCompra: "2026-10-01" }),
      lote({ id: 2, restante: 2, fechaCaducidad: "2027-01-01", fechaCompra: "2026-11-01" }),
    ];
    expect(planConsumoFEFO(lotes, 1, HOY)).toEqual([{ loteId: 2, cantidad: 1 }]);
    expect(planConsumoFEFO(lotes, 3, HOY)).toEqual([
      { loteId: 2, cantidad: 2 },
      { loteId: 1, cantidad: 1 },
    ]);
  });

  it("los lotes sin caducidad van después; entre ellos, el más antiguo primero", () => {
    const lotes = [
      lote({ id: 1, restante: 1, fechaCompra: "2026-11-10" }),
      lote({ id: 2, restante: 1, fechaCompra: "2026-10-10" }),
      lote({ id: 3, restante: 1, fechaCaducidad: "2028-01-01" }),
    ];
    expect(planConsumoFEFO(lotes, 3, HOY).map((p) => p.loteId)).toEqual([3, 2, 1]);
  });

  it("no consume lotes caducados ni vacíos", () => {
    const lotes = [
      lote({ id: 1, restante: 5, fechaCaducidad: "2026-11-01" }),
      lote({ id: 2, restante: 0, fechaCaducidad: "2026-12-01" }),
      lote({ id: 3, restante: 1, fechaCaducidad: "2027-01-01" }),
    ];
    expect(planConsumoFEFO(lotes, 1, HOY)).toEqual([{ loteId: 3, cantidad: 1 }]);
  });

  it("lanza ExistenciaInsuficiente si no alcanza", () => {
    expect(() => planConsumoFEFO([lote({ id: 1, restante: 1 })], 2, HOY)).toThrow(ExistenciaInsuficiente);
  });

  it("rechaza cantidades no enteras o menores que 1", () => {
    expect(() => planConsumoFEFO([lote({ id: 1, restante: 5 })], 0, HOY)).toThrow();
    expect(() => planConsumoFEFO([lote({ id: 1, restante: 5 })], 1.5, HOY)).toThrow();
  });
});
