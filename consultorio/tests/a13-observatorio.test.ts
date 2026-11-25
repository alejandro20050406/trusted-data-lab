import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepararDb } from "./ayuda-db";
import { sembrarCatalogos } from "@/lib/db/seed";
import { contarPreciosReferencia, importarPrecios, leerOroInventario, parsearCsv } from "@/lib/observatorio/importar";

// Archivo de prueba con tiendas y precios ficticios (dominios .test), no datos del observatorio.
const CSV = readFileSync(new URL("./fixtures/oro_inventario_prueba.csv", import.meta.url), "utf8");

describe("A-13 lectura de oro_inventario.csv", () => {
  it("parsea comillas, comas y comillas escapadas", () => {
    expect(parsearCsv('a,"b,c","d ""e"""\r\n1,2,3\n')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });

  it("toma solo ofertas comerciales válidas y conserva tienda, URL, fecha y sha256", () => {
    const { precios, descartados } = leerOroInventario(CSV);
    expect(precios).toHaveLength(2);
    expect(precios[0]).toMatchObject({
      producto: "Ligas de prueba, azules 1/4",
      tienda: "Tienda A",
      fuente: "fuente_prueba",
      precio: 85.5,
      url: "https://tienda-a.test/ligas-azules",
      sha256: "697815ef245732b5c46657155e2c2ba4664d1e0fbe07b64015fb861ea8b57fa2",
    });
    expect(precios[0].fechaCaptura.toISOString()).toBe("2026-11-13T02:24:54.027Z");
    expect(precios[1]).toMatchObject({ producto: 'Guantes "de prueba" caja', tienda: "deposito-prueba", presentacion: "Caja 100" });
    expect(descartados.map((d) => d.motivo)).toEqual(["precio inválido", "sin sha256 del archivo Bronce", "sin fecha de captura"]);
  });

  it("rechaza un archivo que no es oro_inventario.csv", () => {
    expect(() => leerOroInventario("a,b\n1,2\n")).toThrow("faltan columnas");
  });
});

describe("A-13 importación idempotente", () => {
  let cerrar: () => Promise<void>;
  beforeAll(async () => {
    const p = await prepararDb();
    cerrar = p.cerrar;
    await sembrarCatalogos(p.db);
  });
  afterAll(async () => cerrar());

  it("importar dos veces el mismo archivo no duplica registros", async () => {
    const { precios } = leerOroInventario(CSV);
    expect(await importarPrecios(precios)).toEqual({ insertados: 2, omitidos: 0 });
    expect(await importarPrecios(precios)).toEqual({ insertados: 0, omitidos: 2 });
    expect(await contarPreciosReferencia()).toBe(2);
  });

  it("una captura nueva del mismo producto sí se agrega como otro registro con su fecha", async () => {
    const otraCaptura = CSV.replace("2026-11-13T02:24:54.027797+00:00", "2026-11-20T02:00:00+00:00");
    const r = await importarPrecios(leerOroInventario(otraCaptura).precios);
    expect(r).toEqual({ insertados: 1, omitidos: 1 });
    expect(await contarPreciosReferencia()).toBe(3);
  });
});

describe("A-13 correspondencias revisadas a mano", () => {
  let cerrar: () => Promise<void>;
  let ligas: number;
  beforeAll(async () => {
    const p = await prepararDb();
    cerrar = p.cerrar;
    await sembrarCatalogos(p.db);
    const { insumo } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    [{ id: ligas }] = await p.db.select({ id: insumo.id }).from(insumo).where(eq(insumo.nombre, "Ligas"));
    await importarPrecios(leerOroInventario(CSV).precios);
  });
  afterAll(async () => cerrar());

  it("no hay correspondencias hasta que alguien las captura", async () => {
    const { totalVinculos, referenciaMasBarata } = await import("@/lib/observatorio/correspondencias");
    expect(await totalVinculos()).toBe(0);
    expect(await referenciaMasBarata(ligas)).toBeNull();
  });

  it("busca productos por palabras y vincula uno al insumo", async () => {
    const { buscarProductos, vincularProducto, vinculos, referenciaMasBarata, desvincularProducto } = await import(
      "@/lib/observatorio/correspondencias"
    );
    const encontrados = await buscarProductos("ligas azules");
    expect(encontrados.map((p) => p.producto)).toEqual(["Ligas de prueba, azules 1/4"]);
    expect(await buscarProductos("100%")).toEqual([]);

    await vincularProducto({ insumoId: ligas, url: encontrados[0].url, nota: "Mismo calibre" });
    await vincularProducto({ insumoId: ligas, url: encontrados[0].url, nota: "Revisado" }); // no duplica
    const lista = await vinculos(ligas);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ tienda: "Tienda A", precio: 85.5, nota: "Revisado" });
    expect((await referenciaMasBarata(ligas))?.sha256).toHaveLength(64);

    await desvincularProducto(lista[0].id);
    expect(await vinculos(ligas)).toEqual([]);
  });

  it("no permite vincular una URL que no está importada", async () => {
    const { vincularProducto } = await import("@/lib/observatorio/correspondencias");
    await expect(vincularProducto({ insumoId: ligas, url: "https://otra.test/x" })).rejects.toThrow();
  });
});
