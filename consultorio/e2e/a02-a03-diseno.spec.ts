import { expect, test } from "@playwright/test";
import { entrar, revisarTamanoToque } from "./ayuda";

const esCelular = () => test.info().project.name === "celular-360";

async function sinDesbordeHorizontal(page: import("@playwright/test").Page) {
  const { ancho, visible } = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    visible: window.innerWidth,
  }));
  expect(ancho).toBeLessThanOrEqual(visible);
}

test.describe("/estilo (pública)", () => {
  test("carga sin sesión y todos los contrastes cumplen", async ({ page }) => {
    await page.goto("/estilo");
    await expect(page.getByRole("heading", { name: "Guía de estilo", level: 1 })).toBeVisible();
    const tabla = page.getByRole("main").getByRole("table");
    await expect(tabla).toBeVisible();
    await expect(tabla.getByRole("cell", { name: "Cumple", exact: true }).first()).toBeVisible();
    await expect(tabla.getByRole("cell", { name: "No cumple" })).toHaveCount(0);
  });

  test("botones de 44 px y sin scroll horizontal", async ({ page }) => {
    await page.goto("/estilo");
    await revisarTamanoToque(page);
    await sinDesbordeHorizontal(page);
  });

  test("la confirmación muestra Deshacer y luego Se deshizo", async ({ page }) => {
    await page.goto("/estilo");
    await page.getByRole("button", { name: "Probar confirmación con Deshacer" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Se registró" })).toBeVisible();
    await page.getByRole("button", { name: "Deshacer", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Se deshizo" })).toBeVisible();
  });
});

test.describe("app con sesión", () => {
  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  test("navegación inferior en celular, lateral en escritorio", async ({ page }) => {
    const inferior = page.getByRole("navigation", { name: "Navegación principal" });
    const lateral = page.getByRole("navigation", { name: "Navegación lateral" });
    if (esCelular()) {
      await expect(inferior).toBeVisible();
      await expect(inferior.getByRole("link")).toHaveCount(4);
      await expect(lateral).toBeHidden();
    } else {
      await expect(lateral).toBeVisible();
      await expect(lateral.getByRole("link")).toHaveCount(4);
      await expect(inferior).toBeHidden();
      await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    }
  });

  test("tamaño de toque, sin scroll horizontal y texto de 16 px", async ({ page }) => {
    await revisarTamanoToque(page);
    await sinDesbordeHorizontal(page);
    const tamano = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    expect(tamano).toBeGreaterThanOrEqual(16);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("en /inventario el enlace activo tiene aria-current", async ({ page }) => {
    await page.goto("/inventario");
    await expect(page.getByRole("main").getByRole("heading", { name: "Inventario", level: 1 })).toBeVisible();
    const nav = page.getByRole("navigation", { name: esCelular() ? "Navegación principal" : "Navegación lateral" });
    await expect(nav.getByRole("link", { name: "Inventario" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current", "page");
    await revisarTamanoToque(page);
  });
});
