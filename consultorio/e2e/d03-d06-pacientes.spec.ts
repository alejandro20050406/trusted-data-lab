import { expect, test, type Locator, type Page } from "@playwright/test";
import { entrar, revisarTamanoToque } from "./ayuda";

/** Cuenta los toques reales del flujo (cada click o elección cuenta uno). */
class Conteo {
  toques = 0;
  async tocar(destino: Locator) {
    this.toques += 1;
    await destino.click();
  }
  async elegirFecha(campo: Locator, fecha: string) {
    // Elegir un día en el selector nativo cuenta como un toque.
    this.toques += 1;
    await campo.fill(fecha);
  }
}

const principal = (page: Page) => page.getByRole("main");
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0, 0xb8, 0, 0, 0]);

function sumarDias(fecha: string, dias: number) {
  return new Date(Date.parse(`${fecha}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}

async function crearPaciente(page: Page, nombre: string) {
  await page.goto("/pacientes/nuevo");
  await principal(page).getByLabel("Nombre").fill(nombre);
  await principal(page).getByLabel("Teléfono (opcional)").fill("312 555 0000");
  await principal(page).getByRole("button", { name: "Guardar paciente" }).click();
  await expect(page).toHaveURL(/\/pacientes\/\d+$/);
  await expect(principal(page).getByRole("heading", { name: nombre })).toBeVisible();
  return Number(page.url().split("/").pop());
}

async function programar(page: Page, fecha: string, hora = "10:00") {
  const main = principal(page);
  await main.getByLabel("Fecha", { exact: true }).fill(fecha);
  await main.getByLabel("Hora", { exact: true }).fill(hora);
  await main.getByRole("button", { name: "Programar cita" }).click();
  await expect(main.getByRole("button", { name: "Atendida" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

test.describe("D-03 y D-04 pacientes y citas", () => {
  test("marcar atendida toma 1 toque y la lista muestra la última visita", async ({ page }, info) => {
    const nombre = `Paciente Ficticio Atendida ${info.project.name}`;
    await crearPaciente(page, nombre);
    const hoy = (await principal(page).getByLabel("Fecha", { exact: true }).getAttribute("min"))!;
    await programar(page, hoy, "09:00");

    const conteo = new Conteo();
    await conteo.tocar(principal(page).getByRole("button", { name: "Atendida" }));
    await expect(page.getByRole("status")).toContainText("Cita marcada como atendida");
    await expect(principal(page).locator("[data-ultima-visita]")).toContainText("hoy");
    expect(conteo.toques).toBe(1);

    await page.goto("/pacientes");
    await principal(page).getByLabel("Buscar paciente").fill("Atendida " + info.project.name);
    await expect(principal(page).getByRole("link", { name: new RegExp(nombre) })).toContainText("Última visita: hoy");
    await revisarTamanoToque(page);
  });

  test("reagendar toma 3 toques o menos, enlaza la nueva cita y la insignia aparece a las 3", async ({ page }, info) => {
    const nombre = `Paciente Ficticio Reagenda ${info.project.name}`;
    const id = await crearPaciente(page, nombre);
    const hoy = (await principal(page).getByLabel("Fecha", { exact: true }).getAttribute("min"))!;
    await programar(page, sumarDias(hoy, 1), "11:30");

    for (let vez = 1; vez <= 3; vez++) {
      const conteo = new Conteo();
      const main = principal(page);
      await conteo.tocar(main.getByRole("button", { name: "Reagendar" }));
      await conteo.elegirFecha(main.getByLabel("Nueva fecha"), sumarDias(hoy, 1 + vez * 7));
      await conteo.tocar(main.getByRole("button", { name: "Guardar nueva fecha" }));
      await expect(page.getByRole("status")).toContainText("Cita reagendada");
      await expect(main.locator("[data-veces-reagendada]")).toContainText(String(vez));
      expect(conteo.toques).toBeLessThanOrEqual(3);
    }
    // Conserva la hora original.
    await expect(principal(page).locator("[data-cita]")).toContainText("11:30");
    await expect(principal(page).locator('[data-estado="reagendada"]')).toHaveCount(3);
    await expect(principal(page).getByText("Reagenda seguido: 3 veces")).toBeVisible();

    await page.goto("/pacientes");
    await expect(principal(page).locator(`[data-paciente="${id}"] [data-insignia="reagenda"]`)).toContainText("3 veces");
  });
});

test.describe("D-05 y D-06 escaneo de archivos", () => {
  test("escanear y guardar una hoja toma 3 toques; sin sesión el archivo no se abre", async ({ page, browser }, info) => {
    await crearPaciente(page, `Paciente Ficticio Escaneo ${info.project.name}`);
    const main = principal(page);
    await main.getByText("Receta", { exact: true }).click();

    const conteo = new Conteo();
    const selector = page.waitForEvent("filechooser");
    await conteo.tocar(main.getByRole("button", { name: "Escanear" }));
    // En el celular: disparar la cámara y "Usar foto" son los toques 2 y 3.
    conteo.toques += 2;
    await (await selector).setFiles({ name: "hoja.jpg", mimeType: "image/jpeg", buffer: JPEG });
    await expect(main.getByText(/Guardado: Receta/)).toBeVisible();
    expect(conteo.toques).toBe(3);

    const enlace = main.locator("[data-archivo] a").first();
    await expect(enlace).toContainText("Receta");
    const href = (await enlace.getAttribute("href"))!;

    const conSesion = await page.request.get(href);
    expect(conSesion.status()).toBe(200);
    expect(conSesion.headers()["content-type"]).toBe("image/jpeg");

    const anonimo = await browser.newContext();
    const sinSesion = await anonimo.request.get(new URL(href, page.url()).href, { maxRedirects: 0 });
    expect(sinSesion.status()).toBe(401);
    await anonimo.close();
  });

  test("rechaza un archivo con extensión falsa", async ({ page }, info) => {
    await crearPaciente(page, `Paciente Ficticio Falso ${info.project.name}`);
    const main = principal(page);
    const selector = page.waitForEvent("filechooser");
    await main.getByRole("button", { name: "Elegir archivos", exact: true }).click();
    await (await selector).setFiles({ name: "radiografia.pdf", mimeType: "application/pdf", buffer: EXE });
    await expect(main.getByText(/no es una foto ni un PDF válido/)).toBeVisible();
    await expect(main.locator("[data-archivo]")).toHaveCount(0);
  });
});
