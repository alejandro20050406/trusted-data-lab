import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepararDb } from "./ayuda-db";
import { AlmacenMemoria, JPEG } from "./ayuda-almacen";
import type { Db } from "@/lib/db";
import { insumo } from "@/lib/db/schema";
import { sembrarCatalogos } from "@/lib/db/seed";
import { usarAlmacen } from "@/lib/archivos/almacen";
import { prepararSubida } from "@/lib/archivos/archivos";
import { leerBoleto } from "@/lib/archivos/validacion";
import {
  adjuntarFotoBracket,
  contarPorDiente,
  contarPorPaciente,
  descontarReposicion,
  deshacerBracketCaido,
  enUltimosDias,
  listarCaidas,
  registrarBracketCaido,
  reposicionesParaDiente,
  type RegistroCaida,
} from "@/lib/clinica/brackets";
import { crearPaciente } from "@/lib/clinica/pacientes";
import { registrarCompra } from "@/lib/inventario/compras";
import { inventarioConEstado } from "@/lib/inventario/consultas";
import { hoyLocal } from "@/lib/inventario/estado";
import { obtenerOCrearBracket } from "@/lib/inventario/variantes";

process.env.BETTER_AUTH_SECRET ??= "secreto-de-pruebas-0123456789abcdef0123456789";

const r = (id: number, pacienteId: number, pacienteNombre: string, dienteFdi: number, fecha: string): RegistroCaida => ({
  id,
  pacienteId,
  pacienteNombre,
  dienteFdi,
  dienteNombre: `Diente ${dienteFdi}`,
  fecha,
  fotoArchivoId: null,
  nota: null,
  repuesto: false,
});

describe("D-08 conteos puros", () => {
  const registros = [
    r(1, 1, "Ana", 11, "2026-11-20"),
    r(2, 1, "Ana", 11, "2026-11-01"),
    r(3, 2, "Beto", 36, "2026-10-15"),
    r(4, 2, "Beto", 11, "2026-07-01"),
    r(5, 3, "Caro", 46, "2026-11-26"),
  ];

  it("ordena dientes y pacientes por número de caídas", () => {
    expect(contarPorDiente(registros).map((c) => [c.clave, c.caidas])).toEqual([
      [11, 3],
      [36, 1],
      [46, 1],
    ]);
    expect(contarPorPaciente(registros).map((c) => [c.nombre, c.caidas])).toEqual([
      ["Ana", 2],
      ["Beto", 2],
      ["Caro", 1],
    ]);
  });

  it("filtra los últimos 90 días incluyendo hoy y el primer día", () => {
    const hoy = "2026-11-27";
    const ultimos = enUltimosDias(registros, hoy, 90);
    expect(ultimos.map((x) => x.id)).toEqual([1, 2, 3, 5]);
    expect(enUltimosDias([r(9, 1, "Ana", 11, "2026-08-30")], hoy, 90)).toHaveLength(1);
    expect(enUltimosDias([r(9, 1, "Ana", 11, "2026-08-29")], hoy, 90)).toHaveLength(0);
  });
});

describe("D-07 registro con base de datos", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let ana: number;
  let beto: number;
  let bracketsId: number;
  let variante11: number;
  const almacen = new AlmacenMemoria();

  beforeAll(async () => {
    ({ db, cerrar } = await prepararDb());
    usarAlmacen(almacen);
    await sembrarCatalogos(db);
    bracketsId = (await db.select().from(insumo)).find((i) => i.tipoVariante === "diente")!.id;
    variante11 = await obtenerOCrearBracket(bracketsId, { dienteFdi: 11, sistema: "metalico", slot: "0.022" });
    await registrarCompra({ insumoId: bracketsId, cantidad: 2, varianteId: variante11, fechaCompra: "2026-11-01" });
    ana = await crearPaciente({ nombre: "Ana Ficticia" });
    beto = await crearPaciente({ nombre: "Beto Ficticio" });
  });
  afterAll(async () => {
    usarAlmacen(undefined);
    await cerrar();
  });

  it("un toque registra la caída con la fecha de hoy", async () => {
    const id = await registrarBracketCaido({ pacienteId: ana, dienteFdi: 11 });
    const [caida] = await listarCaidas({ pacienteId: ana });
    expect(caida).toMatchObject({ id, dienteFdi: 11, fecha: hoyLocal(), fotoArchivoId: null, repuesto: false });
    await expect(registrarBracketCaido({ pacienteId: ana, dienteFdi: 19 })).rejects.toThrow("diente no existe");
  });

  it("ofrece solo los brackets de ese diente con existencia y descuenta uno con registrarConsumo()", async () => {
    const id = await registrarBracketCaido({ pacienteId: ana, dienteFdi: 11, fecha: "2026-11-20" });
    const repos = await reposicionesParaDiente(11);
    expect(repos?.opciones).toEqual([{ varianteId: variante11, nombre: "11 metálico 0.022", existencia: 2 }]);
    expect((await reposicionesParaDiente(36))?.opciones).toEqual([]);

    await descontarReposicion(id, variante11);
    const inventario = await inventarioConEstado(hoyLocal());
    expect(inventario.find((i) => i.id === bracketsId)?.variantes.find((v) => v.id === variante11)?.existencia).toBe(1);
    await expect(descontarReposicion(id, variante11)).rejects.toThrow("Ya se descontó");
    expect((await listarCaidas({ pacienteId: ana })).find((c) => c.id === id)?.repuesto).toBe(true);
    expect(await deshacerBracketCaido(id)).toBe(false);
  });

  it("guarda la foto de evidencia como archivo del paciente", async () => {
    const id = await registrarBracketCaido({ pacienteId: beto, dienteFdi: 36, fecha: "2026-11-10" });
    const prep = await prepararSubida(beto, "image/jpeg", JPEG.length);
    almacen.poner(leerBoleto(prep.boleto).llave, JPEG);
    const archivoId = await adjuntarFotoBracket(id, prep.boleto, null);
    const [caida] = await listarCaidas({ pacienteId: beto, soloConFoto: true });
    expect(caida).toMatchObject({ id, fotoArchivoId: archivoId });

    const otra = await prepararSubida(ana, "image/jpeg", JPEG.length);
    almacen.poner(leerBoleto(otra.boleto).llave, JPEG);
    await expect(adjuntarFotoBracket(id, otra.boleto, null)).rejects.toThrow("no corresponde");
  });

  it("deshacer borra una caída recién registrada sin foto ni reposición", async () => {
    const id = await registrarBracketCaido({ pacienteId: beto, dienteFdi: 21 });
    expect(await deshacerBracketCaido(id)).toBe(true);
    expect((await listarCaidas({ pacienteId: beto })).some((c) => c.id === id)).toBe(false);
  });

  it("los conteos del reporte coinciden con los registros", async () => {
    const todas = await listarCaidas();
    expect(todas).toHaveLength(3);
    const porDiente = new Map(contarPorDiente(todas).map((c) => [c.clave, c.caidas]));
    expect(porDiente.get(11)).toBe(2);
    expect(porDiente.get(36)).toBe(1);
    const porPaciente = new Map(contarPorPaciente(todas).map((c) => [c.clave, c.caidas]));
    expect(porPaciente.get(ana)).toBe(2);
    expect(porPaciente.get(beto)).toBe(1);
    expect(await listarCaidas({ desde: "2026-11-15" })).toHaveLength(2);
  });
});
