import { expect, test } from "@playwright/test";
import { entrar } from "../ayuda";

/**
 * A-09: el panel carga en menos de 2 s en un celular de gama media con 4G y
 * los avisos de prioridad alta se ven sin desplazarse. Se simula la red
 * "4G lenta" de Lighthouse (150 ms de latencia, 1.6 Mbps de bajada,
 * 750 kbps de subida) y CPU 4 veces más lenta.
 */
test("el panel carga en menos de 2 s con 4G y CPU de gama media", async ({ page }) => {
  await entrar(page); // el seed deja los guantes en 0 con reserva 1: hay un aviso de prioridad alta

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const tiempos: number[] = [];
  for (let i = 0; i < 3; i++) {
    const inicio = Date.now();
    await page.goto("/", { waitUntil: "commit" });
    const alta = page.locator('[data-prioridad="alta"]').first();
    await expect(alta).toBeVisible();
    tiempos.push(Date.now() - inicio);

    const caja = await alta.boundingBox();
    const alto = page.viewportSize()!.height;
    expect(caja, "el primer aviso de prioridad alta está en pantalla").not.toBeNull();
    expect(caja!.y + caja!.height, "el aviso de prioridad alta se ve sin desplazarse").toBeLessThanOrEqual(alto);
  }
  test.info().annotations.push({ type: "tiempos-ms", description: tiempos.join(", ") });
  console.log(`Carga del panel (ms): ${tiempos.join(", ")}`);
  expect(Math.max(...tiempos)).toBeLessThan(2000);
});
