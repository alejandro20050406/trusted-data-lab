import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepararDb } from "./ayuda-db";
import { avisosPendientes, cerrarAvisosPorClave, crearAviso, marcarAvisoAtendido } from "@/lib/avisos";

let cerrar: () => Promise<void>;
beforeAll(async () => ({ cerrar } = await prepararDb()));
afterAll(async () => cerrar());

describe("crearAviso (contrato con Adrián)", () => {
  it("crea avisos de cualquier origen y los ordena por prioridad", async () => {
    await crearAviso({ tipo: "recordatorio", titulo: "Recolección de residuos", prioridad: "media", origen: "residuos", fechaVencimiento: "2026-12-01" });
    await crearAviso({ tipo: "recordatorio", titulo: "Esterilizar", prioridad: "alta", origen: "esterilizacion" });
    await crearAviso({ tipo: "info", titulo: "Baja", prioridad: "baja", origen: "inventario" });
    const titulos = (await avisosPendientes()).map((a) => a.titulo);
    expect(titulos).toEqual(["Esterilizar", "Recolección de residuos", "Baja"]);
  });

  it("con la misma clave actualiza el aviso abierto en lugar de duplicarlo", async () => {
    const a = await crearAviso({ tipo: "reserva_baja", titulo: "Quedan 2", prioridad: "media", origen: "inventario", clave: "inv:1" });
    const b = await crearAviso({ tipo: "reserva_baja", titulo: "Queda 1", prioridad: "alta", origen: "inventario", clave: "inv:1" });
    expect(b.id).toBe(a.id);
    expect(b).toMatchObject({ titulo: "Queda 1", prioridad: "alta" });
    expect((await avisosPendientes()).filter((x) => x.clave === "inv:1")).toHaveLength(1);
  });

  it("después de atenderlo, la misma clave abre un aviso nuevo", async () => {
    const a = await crearAviso({ tipo: "t", titulo: "x", prioridad: "baja", origen: "inventario", clave: "inv:2" });
    expect(await marcarAvisoAtendido(a.id)).toBe(true);
    expect(await marcarAvisoAtendido(a.id)).toBe(false);
    const b = await crearAviso({ tipo: "t", titulo: "x", prioridad: "baja", origen: "inventario", clave: "inv:2" });
    expect(b.id).not.toBe(a.id);
    expect(await cerrarAvisosPorClave(["inv:2"])).toBe(1);
  });

  it("rechaza urlAccion externas", async () => {
    await expect(
      crearAviso({ tipo: "t", titulo: "x", prioridad: "baja", origen: "inventario", urlAccion: "https://ejemplo.com" }),
    ).rejects.toThrow();
    await expect(crearAviso({ tipo: "t", titulo: "x", prioridad: "baja", origen: "inventario", urlAccion: "//ejemplo.com" })).rejects.toThrow();
  });
});
