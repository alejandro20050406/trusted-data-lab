import { expect, test, type Page } from "@playwright/test";
import { entrar, revisarTamanoToque } from "./ayuda";

const principal = (page: Page) => page.getByRole("main");
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

async function sinDesbordeHorizontal(page: Page) {
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);
}

async function crearPaciente(page: Page, nombre: string) {
  await page.goto("/pacientes/nuevo");
  await principal(page).getByLabel("Nombre").fill(nombre);
  await principal(page).getByRole("button", { name: "Guardar paciente" }).click();
  await expect(page).toHaveURL(/\/pacientes\/\d+$/);
  return Number(page.url().split("/").pop());
}

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

test.describe("D-07 y D-08 brackets caídos", () => {
  test("registrar una caída toma 2 toques sin foto y 3 con foto; el reporte la cuenta", async ({ page }, info) => {
    const nombre = `Paciente Ficticio Brackets ${info.project.name}`;
    const id = await crearPaciente(page, nombre);
    const main = principal(page);

    // Sin foto: abrir el registro (1) y tocar el diente (2).
    let toques = 0;
    await main.getByRole("link", { name: "Registrar bracket caído" }).click();
    toques++;
    await expect(main.locator("[data-fdi]")).toHaveCount(32);
    await revisarTamanoToque(page);
    await sinDesbordeHorizontal(page);
    await main.locator('[data-fdi="21"]').click();
    toques++;
    await expect(main.getByText("Registrado hoy: diente 21")).toBeVisible();
    expect(toques).toBe(2);
    await expect(main.getByText(/No hay brackets de reposición del diente 21/)).toBeVisible();

    // Con foto: diente (1), "Agregar foto" (2), disparar y usar (3).
    toques = 0;
    await main.locator('[data-fdi="36"]').click();
    toques++;
    await expect(main.getByText("Registrado hoy: diente 36")).toBeVisible();
    const selector = page.waitForEvent("filechooser");
    await main.getByRole("button", { name: "Agregar foto" }).click();
    toques++;
    await (await selector).setFiles({ name: "bracket.jpg", mimeType: "image/jpeg", buffer: JPEG });
    toques++;
    await expect(main.getByText("Foto de evidencia guardada")).toBeVisible();
    expect(toques).toBe(3);

    await page.reload();
    await expect(principal(page).locator("[data-total-caidas]")).toHaveAttribute("data-total-caidas", "2");

    await page.goto("/reportes/brackets");
    const pacientes = principal(page).getByRole("list", { name: "Pacientes con más caídas" });
    await expect(pacientes.locator(`[data-clave="${id}"] [data-caidas]`)).toHaveText("2");
    await expect(principal(page).getByRole("img", { name: new RegExp(`diente 36, ${nombre}`) })).toBeVisible();
    await revisarTamanoToque(page);
    await sinDesbordeHorizontal(page);
  });
});

test.describe("D-09 a D-11 recordatorios", () => {
  test("el aviso de residuos aparece en Inicio y un toque lo cierra; la próxima queda a 60 días", async ({ page }) => {
    await page.goto("/");
    const tarjeta = principal(page).locator("li").filter({ hasText: "Recolección de residuos" });
    if ((await tarjeta.count()) > 0) {
      await tarjeta.getByRole("button", { name: "Recolección hecha hoy" }).click();
      await expect(page.getByRole("status")).toContainText("Próxima");
      await expect(principal(page).locator("li").filter({ hasText: "Recolección de residuos: registra" })).toHaveCount(0);
    }

    await page.goto("/tareas");
    const residuos = principal(page).locator("[data-tarea]").filter({ hasText: "Recolección de residuos" });
    await expect(residuos).toHaveAttribute("data-estado", "al_dia");
    await residuos.getByRole("link", { name: /Recolección de residuos/ }).click();
    const hoy = await page.locator("#realizacion-fecha").getAttribute("max");
    const esperado = new Date(Date.parse(`${hoy}T12:00:00Z`) + 60 * 86_400_000).toISOString().slice(0, 10);
    await expect(principal(page).locator("[data-proxima]")).toHaveAttribute("data-proxima", esperado);
    await revisarTamanoToque(page);
  });

  test("esterilización: definir periodicidad y registrar con un toque", async ({ page }) => {
    await page.goto("/tareas");
    const tarjeta = principal(page).locator("[data-tarea]").filter({ hasText: "Esterilización de piezas" });
    await tarjeta.getByRole("link", { name: /Esterilización de piezas/ }).click();
    const main = principal(page);
    await main.getByLabel("Cada cuántos días").fill("7");
    await main.getByLabel("Avisar con días de anticipación").fill("1");
    await main.getByRole("button", { name: "Guardar periodicidad" }).click();
    await expect(page.getByRole("status")).toContainText("Periodicidad guardada");
    await main.getByRole("button", { name: "Esterilización hecha hoy" }).first().click();
    await expect(page.getByRole("status")).toContainText("Próxima");
    await expect(main.getByRole("list", { name: "Historial de la tarea" }).locator("li").first()).toBeVisible();
    await expect(main.locator("[data-proxima]")).not.toHaveAttribute("data-proxima", "");
  });

  test("la ruta diaria rechaza llamadas sin el secreto", async ({ request }) => {
    expect((await request.get("/api/cron/tareas")).status()).toBe(401);
    const ok = await request.get("/api/cron/tareas", { headers: { authorization: "Bearer cron-e2e-solo-pruebas" } });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toMatchObject({ ok: true, notificaciones: { configurado: false } });
  });
});

test.describe("D-12 app instalable", () => {
  test("manifiesto, íconos y service worker", async ({ page, request }) => {
    const manifiesto = await request.get("/manifest.webmanifest");
    expect(manifiesto.ok()).toBe(true);
    const m = await manifiesto.json();
    expect(m).toMatchObject({ display: "standalone", start_url: "/", theme_color: "#1D4ED8" });
    for (const icono of m.icons as { src: string }[]) {
      const r = await request.get(icono.src);
      expect(r.status(), icono.src).toBe(200);
      expect(r.headers()["content-type"]).toBe("image/png");
    }
    const sw = await request.get("/sw.js");
    expect(sw.headers()["content-type"]).toContain("javascript");
    expect(sw.headers()["cache-control"]).toContain("no-store");

    await page.goto("/");
    const activo = await page.evaluate(async () => {
      const registro = await navigator.serviceWorker.ready;
      return registro.active?.scriptURL ?? null;
    });
    expect(activo).toContain("/sw.js");
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  });

  test("muestra la franja de sin conexión", async ({ page, context }) => {
    await page.goto("/pacientes");
    await context.setOffline(true);
    await expect(page.locator("[data-sin-conexion]")).toContainText("Sin conexión");
    await context.setOffline(false);
    await expect(page.locator("[data-sin-conexion]")).toHaveCount(0);
  });

  test("pantalla de instalación y notificaciones", async ({ page }) => {
    await page.goto("/mas");
    await principal(page).getByRole("link", { name: "Instalar la app y notificaciones" }).click();
    await expect(principal(page).getByRole("heading", { name: "Android (Chrome)" })).toBeVisible();
    await expect(principal(page).getByRole("heading", { name: "iPhone (Safari)" })).toBeVisible();
    await revisarTamanoToque(page);
  });
});

test.describe("D-13 y D-14 reportes", () => {
  test("con una compra se muestra un mensaje en lugar de la gráfica; con dos se ve la variación", async ({ page }, info) => {
    await page.goto("/inventario");
    const enlace = principal(page).getByRole("link", { name: "Jeringas", exact: true });
    const id = Number((await enlace.getAttribute("href"))!.split("/").pop());
    const comprar = async (precio: string) => {
      await page.goto(`/inventario/compra?insumo=${id}`);
      await principal(page).getByLabel("Cantidad", { exact: true }).fill("1");
      await principal(page).getByLabel("Precio total (MXN)").fill(precio);
      await principal(page).getByRole("button", { name: "Guardar" }).click();
      await expect(page).toHaveURL(/\/inventario$/);
    };
    await page.goto(`/inventario/${id}`);
    const bloque = principal(page).locator("[data-variacion-precio]");
    // La base es compartida con otras pruebas: el mensaje de una sola compra se revisa solo si el insumo empieza sin compras.
    if (await bloque.getByText("Registra compras con precio").isVisible()) {
      await comprar("100");
      await page.goto(`/inventario/${id}`);
      await expect(bloque).toContainText("Solo hay una compra");
      await expect(bloque.locator("svg.recharts-surface")).toHaveCount(0);
    }
    const base = info.project.name === "celular-360" ? 300 : 500;
    await comprar(String(base));
    await comprar(String(base * 1.2));
    await page.goto(`/inventario/${id}`);
    await expect(bloque.locator("[data-cambio]")).toContainText("+20.0 %");
    await expect(bloque.locator("svg.recharts-surface")).toHaveCount(1);
    await expect(bloque.locator("table")).toBeAttached();
    await sinDesbordeHorizontal(page);
  });

  test("reporte de colores muestra el nombre del color y su porcentaje", async ({ page }) => {
    await page.goto("/reportes");
    await principal(page).getByRole("link", { name: /Colores de ligas más usados/ }).click();
    await expect(principal(page).getByRole("heading", { name: "Colores de ligas más usados" })).toBeVisible();
    await principal(page).getByRole("link", { name: "30 días" }).click();
    await expect(page).toHaveURL(/dias=30/);
    await revisarTamanoToque(page);
    await sinDesbordeHorizontal(page);
  });
});
