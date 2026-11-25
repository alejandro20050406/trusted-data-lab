import { expect, test, type Page } from "@playwright/test";
import { entrar, revisarTamanoToque } from "./ayuda";

const principal = (page: Page) => page.getByRole("main");

async function sinDesbordeHorizontal(page: Page) {
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

/**
 * Deja un insumo por debajo de su reserva para tener un aviso de prioridad
 * alta. Cada proyecto usa otro insumo porque la base se comparte y un aviso
 * marcado como hecho no se reabre mientras siga la condición.
 */
async function prepararAvisoAlto(page: Page): Promise<string> {
  const nombre = test.info().project.name.startsWith("celular") ? "Ligas intermaxilares" : "Anestesia";
  await page.goto("/inventario");
  await principal(page).getByRole("link", { name: nombre, exact: true }).click();
  await principal(page).getByLabel("Reserva mínima").fill("999");
  await principal(page).getByRole("button", { name: "Guardar reglas" }).click();
  await expect(principal(page).getByText("999").first()).toBeVisible();
  return nombre;
}

test.describe("A-09 panel de inicio", () => {
  test("muestra avisos, insumos por reponer y caducidades, con botones de acción", async ({ page }) => {
    await page.goto("/");
    const main = principal(page);
    await expect(main.getByRole("heading", { name: /Avisos pendientes/ })).toBeVisible();
    await expect(main.getByRole("heading", { name: "En reserva o agotados" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Por caducar" })).toBeVisible();
    await revisarTamanoToque(page);
    await sinDesbordeHorizontal(page);
  });

  test("los avisos de prioridad alta van primero y se ven sin desplazarse", async ({ page }) => {
    await prepararAvisoAlto(page);
    await page.goto("/");
    const tarjetas = principal(page).locator("[data-prioridad]");
    await expect(tarjetas.first()).toBeVisible();
    const prioridades = await tarjetas.evaluateAll((els) => els.map((e) => e.getAttribute("data-prioridad")));
    const orden = { alta: 0, media: 1, baja: 2 } as Record<string, number>;
    expect(prioridades.map((p) => orden[p!])).toEqual([...prioridades.map((p) => orden[p!])].sort((a, b) => a - b));
    expect(prioridades[0]).toBe("alta");
    const caja = await principal(page).locator('[data-prioridad="alta"]').first().boundingBox();
    expect(caja!.y + caja!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });

  test("Registrar compra abre el formulario con el insumo elegido y Marcar como hecho quita el aviso", async ({ page }) => {
    const nombre = await prepararAvisoAlto(page);
    await page.goto("/");
    const aviso = principal(page).locator("[data-prioridad]").filter({ hasText: nombre }).first();
    await expect(aviso).toBeVisible();
    const titulo = (await aviso.locator('[data-slot="estado"]').innerText()).trim();

    await aviso.getByRole("link", { name: "Registrar compra" }).click();
    await expect(page).toHaveURL(/\/inventario\/compra\?insumo=\d+/);
    await expect(principal(page).getByLabel("Insumo")).not.toHaveValue("");

    await page.goto("/");
    const mismo = principal(page).locator("[data-prioridad]").filter({ hasText: titulo }).first();
    await mismo.getByRole("button", { name: "Marcar como hecho" }).click();
    await expect(principal(page).locator("[data-prioridad]").filter({ hasText: titulo })).toHaveCount(0);
  });
});
