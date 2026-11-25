import { expect, test } from "@playwright/test";
import { entrar } from "./ayuda";

test("sin sesión, el inicio redirige a /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("contraseña incorrecta muestra un error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo").fill("dentista@consultorio.test");
  await page.getByLabel("Contraseña").fill("incorrecta");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("El correo o la contraseña no coinciden.");
});

test("la dentista inicia sesión y la cierra", async ({ page }) => {
  await entrar(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/mas");
  await page.getByRole("main").getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
