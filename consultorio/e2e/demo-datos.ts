/**
 * Llena la app local (http://localhost:3000, base en memoria) con datos
 * FICTICIOS para revisar la interfaz. No es una prueba: se corre a mano con
 *   npx tsx e2e/demo-datos.ts
 */
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.DEMO_URL ?? "http://localhost:3000";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const main = (p: Page) => p.getByRole("main");
const dia = (hoy: string, n: number) => new Date(Date.parse(`${hoy}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

async function paciente(p: Page, nombre: string, telefono = "") {
  await p.goto(`${BASE}/pacientes/nuevo`);
  await main(p).getByLabel("Nombre").fill(nombre);
  if (telefono) await main(p).getByLabel("Teléfono (opcional)").fill(telefono);
  await main(p).getByRole("button", { name: "Guardar paciente" }).click();
  await p.waitForURL(/\/pacientes\/\d+$/);
  return p.url();
}

async function programar(p: Page, fecha: string, hora: string) {
  await main(p).getByLabel("Fecha", { exact: true }).fill(fecha);
  await main(p).getByLabel("Hora", { exact: true }).fill(hora);
  await main(p).getByRole("button", { name: "Programar cita" }).click();
  await main(p).getByRole("button", { name: "Atendida" }).waitFor();
}

async function reagendar(p: Page, fecha: string) {
  await main(p).getByRole("button", { name: "Reagendar" }).click();
  await main(p).getByLabel("Nueva fecha").fill(fecha);
  await main(p).getByRole("button", { name: "Guardar nueva fecha" }).click();
  await p.getByRole("status").getByText("Cita reagendada").waitFor();
}

async function idInsumo(p: Page, nombre: string) {
  await p.goto(`${BASE}/inventario`);
  const href = await main(p).getByRole("link", { name: nombre, exact: true }).getAttribute("href");
  return Number(href!.split("/").pop());
}

async function compra(p: Page, insumo: number, cantidad: string, precio: string, fecha: string, proveedor: string, color?: { nombre: string; hex: string; nuevo: boolean }) {
  await p.goto(`${BASE}/inventario/compra?insumo=${insumo}`);
  const m = main(p);
  if (color?.nuevo) {
    await m.locator("label", { hasText: "Nuevo color" }).click();
    await m.getByLabel("Nombre del color").fill(color.nombre);
    await m.getByLabel("Tono").fill(color.hex);
  } else if (color) {
    await m.locator("label", { hasText: color.nombre }).first().click();
  }
  await m.getByLabel("Cantidad", { exact: true }).fill(cantidad);
  await m.getByLabel("Precio total (MXN)").fill(precio);
  await m.getByText("Más datos").click();
  await m.getByLabel("Fecha de compra").fill(fecha);
  await m.getByLabel("Proveedor").fill(proveedor);
  await m.getByRole("button", { name: "Guardar" }).click();
  await p.waitForURL(/\/inventario$/);
}

async function main_() {
  const navegador = await chromium.launch();
  const p = await navegador.newPage();
  await p.goto(`${BASE}/login`);
  await p.getByLabel("Correo").fill("dentista@consultorio.test");
  await p.getByLabel("Contraseña").fill("clave-e2e-solo-pruebas");
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));

  // Pacientes y citas
  await paciente(p, "Ana Ficticia López", "312 555 0101");
  const hoy = (await main(p).getByLabel("Fecha", { exact: true }).getAttribute("min"))!;
  await programar(p, hoy, "09:00");
  await main(p).getByRole("button", { name: "Atendida" }).click();
  await p.getByRole("status").getByText("atendida").waitFor();
  await programar(p, dia(hoy, 21), "09:00");
  await main(p).getByText("Receta", { exact: true }).click();
  const selector = p.waitForEvent("filechooser");
  await main(p).getByRole("button", { name: "Escanear" }).click();
  await (await selector).setFiles([
    { name: "receta.jpg", mimeType: "image/jpeg", buffer: JPEG },
    { name: "hoja2.jpg", mimeType: "image/jpeg", buffer: JPEG },
  ]);
  await main(p).getByText("Guardado: Receta").last().waitFor();

  await paciente(p, "Beto Ficticio Ramírez", "312 555 0102");
  await programar(p, dia(hoy, 2), "16:30");
  for (const n of [1, 2, 3]) await reagendar(p, dia(hoy, 2 + n * 7));

  const carlos = await paciente(p, "Carla Ficticia Núñez");
  await programar(p, dia(hoy, 5), "11:00");

  // Brackets caídos
  await p.goto(`${carlos}/brackets`);
  for (const fdi of [21, 36, 21]) {
    await main(p).locator(`[data-fdi="${fdi}"]`).click();
    await main(p).getByText(`Registrado hoy: diente ${fdi}`).waitFor();
  }
  const foto = p.waitForEvent("filechooser");
  await main(p).getByRole("button", { name: "Agregar foto" }).click();
  await (await foto).setFiles({ name: "bracket.jpg", mimeType: "image/jpeg", buffer: JPEG });
  await main(p).getByText("Foto de evidencia guardada").waitFor();

  // Compras con precio (gráfica de variación)
  const guantes = await idInsumo(p, "Guantes");
  await compra(p, guantes, "2", "360", dia(hoy, -120), "Depósito Dental Centro");
  await compra(p, guantes, "2", "380", dia(hoy, -75), "Depósito Dental Centro");
  await compra(p, guantes, "1", "175", dia(hoy, -40), "Mercado en línea");
  await compra(p, guantes, "3", "600", dia(hoy, -5), "Depósito Dental Centro");

  // Ligas por color y consumo (reporte de colores)
  const ligas = await idInsumo(p, "Ligas");
  await compra(p, ligas, "40", "200", dia(hoy, -20), "Ortho Proveedor", { nombre: "Azul", hex: "#1d4ed8", nuevo: true });
  await compra(p, ligas, "30", "150", dia(hoy, -20), "Ortho Proveedor", { nombre: "Rosa", hex: "#ec4899", nuevo: true });
  await compra(p, ligas, "20", "100", dia(hoy, -20), "Ortho Proveedor", { nombre: "Gris", hex: "#9ca3af", nuevo: true });
  await p.goto(`${BASE}/inventario`);
  const fila = main(p).locator("li").filter({ has: p.getByRole("link", { name: "Ligas", exact: true }) });
  for (const [color, veces] of [["Azul", 9], ["Rosa", 5], ["Gris", 2]] as const) {
    for (let i = 0; i < veces; i++) {
      await fila.getByRole("button", { name: "Descontar 1 de Ligas" }).click();
      await fila.getByRole("button", { name: `Descontar 1 liga ${color}` }).click();
      await p.waitForTimeout(250);
    }
  }

  // Esterilización con periodicidad para que aparezca su recordatorio
  await p.goto(`${BASE}/tareas`);
  await main(p).getByRole("link", { name: /Esterilización de piezas/ }).click();
  await main(p).getByLabel("Cada cuántos días").fill("7");
  await main(p).getByLabel("Avisar con días de anticipación").fill("2");
  await main(p).getByRole("button", { name: "Guardar periodicidad" }).click();
  await p.getByRole("status").getByText("Periodicidad guardada").waitFor();
  await main(p).getByText("Registrar con detalle u otra fecha").click();
  await p.locator("#realizacion-fecha").fill(dia(hoy, -6));
  await p.locator("#realizacion-detalle").fill("2 paquetes de instrumental");
  await main(p).getByRole("button", { name: "Guardar registro" }).click();
  await p.getByRole("status").getByText("Próxima").waitFor();

  await navegador.close();
  console.log("Datos ficticios cargados.");
}

main_().catch((e) => {
  console.error(e);
  process.exit(1);
});
