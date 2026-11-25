import { expect, test, type Locator, type Page } from "@playwright/test";
import { entrar, revisarTamanoToque } from "./ayuda";

/**
 * Cuenta lo que hace la persona: cada click/tap y cada elección en un select
 * es un toque; cada campo escrito es un campo. Todo el flujo medido pasa por
 * este objeto, así el número sale de lo que realmente se hizo.
 */
class Conteo {
  toques = 0;
  campos = 0;
  async tocar(destino: Locator) {
    this.toques += 1;
    await destino.click();
  }
  async elegir(select: Locator, opcion: string) {
    this.toques += 1;
    await select.selectOption({ label: opcion });
  }
  async escribir(campo: Locator, texto: string) {
    this.campos += 1;
    await campo.fill(texto);
  }
}

const principal = (page: Page) => page.getByRole("main");
const fila = (page: Page, nombre: string) =>
  principal(page)
    .locator("li")
    .filter({ has: page.getByRole("link", { name: nombre, exact: true }) });

async function cantidadDe(page: Page, nombre: string): Promise<number> {
  return Number(await fila(page, nombre).getAttribute("data-cantidad"));
}

async function idDe(page: Page, nombre: string): Promise<number> {
  const href = await fila(page, nombre).getByRole("link", { name: nombre, exact: true }).getAttribute("href");
  return Number(href?.split("/").pop());
}

/** Compra directa (sin contar toques) para preparar datos. */
async function comprar(page: Page, nombre: string, cantidad: number, precio = 100) {
  await page.goto("/inventario");
  const id = await idDe(page, nombre);
  await page.goto(`/inventario/compra?insumo=${id}`);
  await principal(page).getByLabel("Cantidad", { exact: true }).fill(String(cantidad));
  await principal(page).getByLabel("Precio total (MXN)").fill(String(precio));
  await principal(page).getByRole("button", { name: "Guardar" }).click();
  await expect(page).toHaveURL(/\/inventario$/);
  await expect(fila(page, nombre)).toBeVisible();
}

async function sinDesbordeHorizontal(page: Page) {
  const { ancho, visible } = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    visible: window.innerWidth,
  }));
  expect(ancho).toBeLessThanOrEqual(visible);
}

function fechaEn(dias: number): string {
  const f = new Date();
  f.setDate(f.getDate() + dias);
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

test.describe("A-05 lista de inventario", () => {
  test("la fila muestra nombre y cantidad, sin marca, proveedor ni precio; el detalle sí", async ({ page }) => {
    const proveedor = "Depósito Prueba";
    await page.goto("/inventario");
    const antes = await cantidadDe(page, "Jeringas");
    const id = await idDe(page, "Jeringas");

    await page.goto(`/inventario/compra?insumo=${id}`);
    await principal(page).getByLabel("Cantidad", { exact: true }).fill("4");
    await principal(page).getByLabel("Precio total (MXN)").fill("88.5");
    await principal(page).getByText("Más datos").click();
    await principal(page).getByLabel("Proveedor").fill(proveedor);
    await principal(page).getByLabel("Presentación").fill("Caja con 50");
    await principal(page).getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/inventario$/);
    await expect(page.getByRole("status").filter({ hasText: "Compra registrada" })).toBeVisible();

    await expect(fila(page, "Jeringas")).toHaveAttribute("data-cantidad", String(antes + 4));
    await expect(principal(page).getByText(proveedor)).toHaveCount(0);
    await expect(principal(page).getByText("Caja con 50")).toHaveCount(0);
    await expect(principal(page).getByText("88.50")).toHaveCount(0);
    // Cada fila lleva un estado con texto.
    await expect(fila(page, "Jeringas").locator("[data-slot=estado]")).toHaveCount(1);
    await sinDesbordeHorizontal(page);
    await revisarTamanoToque(page);

    await fila(page, "Jeringas").getByRole("link", { name: "Jeringas", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/inventario/${id}$`));
    await expect(principal(page).getByRole("heading", { name: "Jeringas", level: 1 })).toBeVisible();
    await expect(principal(page).getByText(proveedor).first()).toBeVisible();
    await expect(principal(page).getByText("Caja con 50").first()).toBeVisible();
    await expect(principal(page).getByText("$88.50").first()).toBeVisible();
    await expect(principal(page).getByText("Reserva mínima").first()).toBeVisible();
    await sinDesbordeHorizontal(page);
    await revisarTamanoToque(page);
  });

  test("unidad sin definir se muestra discreta; Guantes usa su unidad", async ({ page }) => {
    await comprar(page, "Guantes", 2);
    const guantes = await cantidadDe(page, "Guantes");
    await expect(fila(page, "Guantes")).toContainText(`· ${guantes} ${guantes === 1 ? "caja" : "cajas"}`);
    await expect(fila(page, "Pasantes para resina")).toContainText("unidad sin definir");
  });

  test("la búsqueda filtra al escribir, sin acentos ni mayúsculas, y rápido", async ({ page }) => {
    await page.goto("/inventario");
    const buscador = page.getByRole("searchbox", { name: "Buscar insumo" });

    const inicio = Date.now();
    await buscador.fill("resina");
    await expect(fila(page, "Resina")).toBeVisible();
    await expect(fila(page, "Pasantes para resina")).toBeVisible();
    await expect(fila(page, "Guantes")).toHaveCount(0);
    expect(Date.now() - inicio).toBeLessThan(5000);

    await buscador.fill("ANESTESIA");
    await expect(fila(page, "Anestesia")).toBeVisible();
    await expect(fila(page, "Resina")).toHaveCount(0);

    await buscador.fill("zzzz");
    await expect(principal(page).getByText("No hay insumos con ese nombre")).toBeVisible();

    await buscador.fill("");
    await expect(fila(page, "Guantes")).toBeVisible();
  });

  test("detalle: editar reglas y volver a dejarlas sin definir", async ({ page }) => {
    await page.goto("/inventario");
    const id = await idDe(page, "Fresas para limpieza");
    await page.goto(`/inventario/${id}`);
    const m = principal(page);
    await m.getByLabel("Unidad", { exact: true }).fill("paquete");
    await m.getByLabel("Reserva mínima").fill("2");
    await m.getByRole("button", { name: "Guardar reglas" }).click();
    await expect(m.getByText("Reglas guardadas")).toBeVisible();
    await expect(m.getByRole("term").filter({ hasText: "Unidad" }).locator("xpath=following-sibling::dd[1]")).toHaveText("paquete");

    await m.getByLabel("Unidad", { exact: true }).fill("");
    await m.getByLabel("Reserva mínima").fill("");
    await m.getByRole("button", { name: "Guardar reglas" }).click();
    await expect(m.getByRole("term").filter({ hasText: "Unidad" }).locator("xpath=following-sibling::dd[1]")).toHaveText("Sin definir");
    await expect(m.getByRole("term").filter({ hasText: "Reserva mínima" }).locator("xpath=following-sibling::dd[1]")).toHaveText("Sin definir");
  });

  test("detalle: lote caducado muestra alerta y se da de baja; por caducar avisa los días", async ({ page }) => {
    await page.goto("/inventario");
    const id = await idDe(page, "Resina");
    const m = principal(page);

    await page.goto(`/inventario/compra?insumo=${id}`);
    await m.getByLabel("Cantidad", { exact: true }).fill("3");
    await m.getByLabel("Precio total (MXN)").fill("300");
    await m.getByLabel("Fecha de caducidad").fill("2020-06-01");
    await m.getByText("Más datos").click();
    await m.getByLabel("Fecha de compra").fill("2020-01-01");
    await m.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/inventario$/);

    await page.goto(`/inventario/compra?insumo=${id}`);
    await m.getByLabel("Cantidad", { exact: true }).fill("2");
    await m.getByLabel("Precio total (MXN)").fill("200");
    await m.getByLabel("Fecha de caducidad").fill(fechaEn(10));
    await m.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/inventario$/);

    await page.goto(`/inventario/${id}`);
    await expect(m.locator("[data-slot=estado]").filter({ hasText: "Caducado" })).toBeVisible();
    await expect(m.locator("[data-slot=estado]").filter({ hasText: /Caduca en \d+ días?/ }).first()).toBeVisible();
    await revisarTamanoToque(page);

    await m.getByRole("button", { name: "Dar de baja" }).click();
    await expect(m.locator("[data-slot=estado]").filter({ hasText: "Caducado" })).toHaveCount(0);
    await expect(m.getByRole("button", { name: "Dar de baja" })).toHaveCount(0);
  });
});

test.describe("A-07 registro de compra", () => {
  test("desde la lista: 3 toques y 2 campos escritos", async ({ page }) => {
    await page.goto("/inventario");
    const antes = await cantidadDe(page, "Jeringas");
    const conteo = new Conteo();

    await conteo.tocar(principal(page).getByRole("link", { name: "Registrar compra" })); // 1
    await expect(page).toHaveURL(/\/inventario\/compra$/);
    await conteo.elegir(principal(page).getByLabel("Insumo"), "Jeringas"); // 2
    // Al elegir el insumo el cursor ya queda en la cantidad: no hace falta otro toque.
    await expect(principal(page).getByLabel("Cantidad", { exact: true })).toBeFocused();
    await conteo.escribir(principal(page).getByLabel("Cantidad", { exact: true }), "7");
    await conteo.escribir(principal(page).getByLabel("Precio total (MXN)"), "140");
    await conteo.tocar(principal(page).getByRole("button", { name: "Guardar" })); // 3

    await expect(page).toHaveURL(/\/inventario$/);
    await expect(fila(page, "Jeringas")).toHaveAttribute("data-cantidad", String(antes + 7));
    expect(conteo.toques).toBe(3);
    expect(conteo.campos).toBe(2);
  });

  test("con el insumo preseleccionado: cantidad enfocada y 1 toque", async ({ page }) => {
    await page.goto("/inventario");
    const id = await idDe(page, "Jeringas");
    const antes = await cantidadDe(page, "Jeringas");
    const conteo = new Conteo();

    await page.goto(`/inventario/compra?insumo=${id}`);
    await expect(principal(page).getByLabel("Insumo")).toHaveValue(String(id));
    await expect(principal(page).getByLabel("Cantidad", { exact: true })).toBeFocused();
    await conteo.escribir(principal(page).getByLabel("Cantidad", { exact: true }), "2");
    await conteo.escribir(principal(page).getByLabel("Precio total (MXN)"), "30");
    await conteo.tocar(principal(page).getByRole("button", { name: "Guardar" }));

    await expect(page).toHaveURL(/\/inventario$/);
    await expect(fila(page, "Jeringas")).toHaveAttribute("data-cantidad", String(antes + 2));
    expect(conteo.toques).toBe(1);
  });

  test("se recuerda el último proveedor y los errores salen junto al campo", async ({ page }) => {
    await page.goto("/inventario");
    const id = await idDe(page, "Jeringas");
    const m = principal(page);
    await page.goto(`/inventario/compra?insumo=${id}`);
    await m.getByLabel("Cantidad", { exact: true }).fill("1");
    await m.getByLabel("Precio total (MXN)").fill("10");
    await m.getByText("Más datos").click();
    await m.getByLabel("Proveedor").fill("Proveedor Recordado");
    await m.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/inventario$/);

    await page.goto(`/inventario/compra?insumo=${id}`);
    await m.getByText("Más datos").click();
    await expect(m.getByLabel("Proveedor")).toHaveValue("Proveedor Recordado");
    await expect(m.getByLabel("Fecha de compra")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);

    await m.getByRole("button", { name: "Guardar" }).click();
    await expect(m.getByText("Escribe la cantidad.")).toBeVisible();
    await expect(page).toHaveURL(/\/inventario\/compra/);
    await revisarTamanoToque(page);
    await sinDesbordeHorizontal(page);
  });

  test("los campos de color y de diente aparecen según el insumo, sin recargar", async ({ page }) => {
    await page.goto("/inventario/compra");
    const m = principal(page);
    await expect(m.getByText("Nuevo color")).toHaveCount(0);

    await m.getByLabel("Insumo").selectOption({ label: "Ligas" });
    await expect(m.getByText("Nuevo color")).toBeVisible();
    await expect(m.getByLabel("Diente")).toHaveCount(0);
    await expect(m.getByLabel("Fecha de caducidad")).toHaveCount(0);

    await m.getByLabel("Insumo").selectOption({ label: "Brackets" });
    await expect(m.getByLabel("Diente")).toBeVisible();
    await expect(m.getByLabel("Sistema")).toBeVisible();
    await expect(m.getByLabel("Slot")).toBeVisible();
    await expect(m.getByText("Nuevo color")).toHaveCount(0);
    await expect(m.getByLabel("Diente").locator("option")).toHaveCount(33);

    await m.getByLabel("Insumo").selectOption({ label: "Anestesia" });
    await expect(m.getByLabel("Fecha de caducidad")).toBeVisible();
    await expect(m.getByLabel("Diente")).toHaveCount(0);
  });

  test("brackets: compra con diente, sistema y slot crea la variante", async ({ page }) => {
    await page.goto("/inventario");
    const id = await idDe(page, "Brackets");
    const m = principal(page);
    await page.goto(`/inventario/compra?insumo=${id}`);
    await m.getByLabel("Cantidad", { exact: true }).fill("5");
    await m.getByLabel("Precio total (MXN)").fill("500");
    await m.getByRole("button", { name: "Guardar" }).click();
    await expect(m.getByText("Elige el diente.")).toBeVisible();
    await m.getByLabel("Diente").selectOption("11");
    await m.getByLabel("Sistema").selectOption("estetico");
    await m.getByLabel("Slot").fill("022");
    await m.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/inventario$/);

    await fila(page, "Brackets").getByRole("button", { name: "Descontar 1 de Brackets" }).click();
    await expect(page.getByRole("button", { name: "Descontar 1 bracket 11 estético 022" })).toBeVisible();
  });
});

test.describe("A-08 consumo de un toque", () => {
  test("−1 descuenta con 1 toque y Deshacer restaura la cantidad", async ({ page }) => {
    await comprar(page, "Guantes", 5);
    const antes = await cantidadDe(page, "Guantes");
    const conteo = new Conteo();

    await conteo.tocar(fila(page, "Guantes").getByRole("button", { name: "Descontar 1 de Guantes" }));
    await expect(fila(page, "Guantes")).toHaveAttribute("data-cantidad", String(antes - 1));
    const aviso = page.getByRole("status").filter({ hasText: "Se descontó 1 de Guantes" });
    await expect(aviso).toBeVisible();
    expect(conteo.toques).toBe(1);

    await aviso.getByRole("button", { name: "Deshacer" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Se deshizo" })).toBeVisible();
    await expect(fila(page, "Guantes")).toHaveAttribute("data-cantidad", String(antes));
    // La cantidad también quedó restaurada en el servidor.
    await page.reload();
    expect(await cantidadDe(page, "Guantes")).toBe(antes);
  });

  test("−N descuenta varias y avisa si no alcanza", async ({ page }) => {
    await comprar(page, "Guantes", 5);
    const antes = await cantidadDe(page, "Guantes");
    const f = fila(page, "Guantes");

    await f.getByRole("button", { name: "Descontar varios de Guantes" }).click();
    await f.getByLabel("Cantidad a descontar de Guantes").fill("3");
    await f.getByRole("button", { name: "Descontar cantidad de Guantes" }).click();
    await expect(f).toHaveAttribute("data-cantidad", String(antes - 3));

    await f.getByRole("button", { name: "Descontar varios de Guantes" }).click();
    await f.getByLabel("Cantidad a descontar de Guantes").fill("99999");
    await f.getByRole("button", { name: "Descontar cantidad de Guantes" }).click();
    await expect(principal(page).getByRole("alert").getByText(/Guantes: Solo quedan/)).toBeVisible();
    await expect(f).toHaveAttribute("data-cantidad", String(antes - 3));
    await revisarTamanoToque(page);
  });

  test("ligas: color nuevo en la compra y descuento de ese color en 2 toques", async ({ page }) => {
    const color = `Rosa ${Date.now()}`;
    await page.goto("/inventario");
    const id = await idDe(page, "Ligas");
    const m = principal(page);

    await page.goto(`/inventario/compra?insumo=${id}`);
    await m.locator("label", { hasText: "Nuevo color" }).click();
    await m.getByLabel("Nombre del color").fill(color);
    await m.getByLabel("Tono").fill("#ff69b4");
    await m.getByLabel("Cantidad", { exact: true }).fill("6");
    await m.getByLabel("Precio total (MXN)").fill("60");
    await m.getByRole("button", { name: "Guardar" }).click();
    await expect(page).toHaveURL(/\/inventario$/);

    const antes = await cantidadDe(page, "Ligas");
    const conteo = new Conteo();
    await conteo.tocar(fila(page, "Ligas").getByRole("button", { name: "Descontar 1 de Ligas" })); // 1
    const botonColor = fila(page, "Ligas").getByRole("button", { name: `Descontar 1 liga ${color}` });
    await expect(botonColor).toContainText(color);
    const caja = await botonColor.boundingBox();
    expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(caja?.width ?? 0).toBeGreaterThanOrEqual(44);
    await conteo.tocar(botonColor); // 2
    await expect(fila(page, "Ligas")).toHaveAttribute("data-cantidad", String(antes - 1));
    expect(conteo.toques).toBe(2);

    // Al deshacer vuelve la liga de ese color.
    await page.getByRole("status").getByRole("button", { name: "Deshacer" }).click();
    await expect(fila(page, "Ligas")).toHaveAttribute("data-cantidad", String(antes));
  });

  test("sin existencia el −1 queda deshabilitado; lista sin scroll horizontal y con toques de 44 px", async ({ page }) => {
    await page.goto("/inventario");
    const sinExistencia = fila(page, "Ligas intermaxilares");
    // Sin compras no hay existencia y el botón está deshabilitado.
    if ((await cantidadDe(page, "Ligas intermaxilares")) === 0) {
      await expect(sinExistencia.getByRole("button", { name: "Descontar 1 de Ligas intermaxilares" })).toBeDisabled();
    }
    await revisarTamanoToque(page);
    await sinDesbordeHorizontal(page);
  });
});
