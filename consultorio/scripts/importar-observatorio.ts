/**
 * Uso: npm run observatorio:importar -- <ruta a oro_inventario.csv>
 * La ruta es la salida de `python -m src.e1 --salida <dir>` (ver docs/E1/ENTREGA.md).
 */
import { readFile } from "node:fs/promises";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const ruta = process.argv[2];
  if (!ruta) throw new Error("Indica la ruta de oro_inventario.csv.");
  const { getDb } = await import("../lib/db");
  const { importarPrecios, leerOroInventario } = await import("../lib/observatorio/importar");
  getDb();
  const { precios, descartados } = leerOroInventario(await readFile(ruta, "utf8"));
  const r = await importarPrecios(precios);
  console.log(`Leídos: ${precios.length}. Insertados: ${r.insertados}. Ya existían: ${r.omitidos}. Descartados: ${descartados.length}.`);
  for (const d of descartados.slice(0, 20)) console.log(`  línea ${d.linea}: ${d.motivo}`);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
