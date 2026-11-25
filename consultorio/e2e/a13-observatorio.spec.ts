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

test.describe("A-13 precios de referencia", () => {
  test("la página de correspondencias se ve y explica que la revisión es manual", async ({ page }) => {
    await page.goto("/mas");
    await principal(page).getByRole("link", { name: "Precios de referencia" }).click();
    await expect(page).toHaveURL(/\/mas\/observatorio$/);
    const main = principal(page);
    await expect(main.getByRole("heading", { name: "Precios de referencia", level: 1 })).toBeVisible();
    await expect(main.getByText("la correspondencia se hace a mano")).toBeVisible();
    await expect(main.getByRole("heading", { name: "Vinculados" })).toBeVisible();
    await revisarTamanoToque(page);
    await sinDesbordeHorizontal(page);
  });
});
