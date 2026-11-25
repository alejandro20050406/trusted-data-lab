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

test.describe("A-11 brackets por diente", () => {
  test("lista los 32 dientes por arcada con nombre y número FDI", async ({ page }) => {
    await page.goto("/inventario/brackets");
    const main = principal(page);
    await expect(main.getByRole("heading", { name: "Arcada superior" })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Arcada inferior" })).toBeVisible();
    await expect(main.locator("[data-fdi]")).toHaveCount(32);
    await expect(main.locator('[data-fdi="11"]')).toContainText("11 · Incisivo central superior derecho");
    await revisarTamanoToque(page);
    await sinDesbordeHorizontal(page);
  });

  test("registrar brackets de un diente desde la vista los suma a ese diente", async ({ page }) => {
    await page.goto("/inventario/brackets");
    const diente = principal(page).locator('[data-fdi="36"]');
    const antes = Number((await diente.getByLabel(/Quedan \d+ para el diente 36/).innerText()).trim());

    await diente.getByRole("link", { name: "Registrar brackets del diente 36" }).click();
    await expect(principal(page).getByLabel("Diente", { exact: true })).toHaveValue("36");
    await principal(page).getByLabel("Sistema").selectOption("metalico");
    await principal(page).getByLabel("Slot").fill("0.022");
    await principal(page).getByLabel("Cantidad", { exact: true }).fill("3");
    await principal(page).getByLabel("Precio total (MXN)").fill("90");
    await principal(page).getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/inventario$/);

    await page.goto("/inventario/brackets");
    const despues = principal(page).locator('[data-fdi="36"]');
    await expect(despues.getByLabel(`Quedan ${antes + 3} para el diente 36`)).toBeVisible();
    await expect(despues).toContainText("metálico slot 0.022");
  });
});
