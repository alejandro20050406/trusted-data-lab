import { expect, type Page } from "@playwright/test";
import { E2E_DENTISTA } from "../playwright.config";

export async function entrar(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo").fill(E2E_DENTISTA.email);
  await page.getByLabel("Contraseña").fill(E2E_DENTISTA.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Verifica que cada botón y enlace visible mida al menos 44×44 px. */
export async function revisarTamanoToque(page: Page) {
  const pequenos = await page.evaluate(() => {
    const elementos = Array.from(document.querySelectorAll<HTMLElement>("button, a[href], [role=button], input[type=checkbox], select"));
    return elementos
      .filter((el) => el.offsetParent !== null && !el.closest("[data-sin-toque]"))
      .map((el) => ({ texto: (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40), ...el.getBoundingClientRect().toJSON() }))
      .filter((r) => r.width < 44 || r.height < 44)
      .map((r) => `${r.texto} (${Math.round(r.width)}×${Math.round(r.height)})`);
  });
  expect(pequenos, "botones menores de 44×44 px").toEqual([]);
}
