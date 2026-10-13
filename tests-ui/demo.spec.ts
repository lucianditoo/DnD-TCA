import { test, expect } from "@playwright/test";

test.describe("Demostración Táctica Automática y Guionada", () => {
  test("inicia automáticamente al pulsar 'Empezar demo', muestra explicaciones pedagógicas y soporta controles de transporte", async ({ page }) => {
    await page.goto("/");

    const startDemoBtn = page.getByTestId("start-demo-btn");
    await expect(startDemoBtn).toBeVisible();
    await expect(startDemoBtn).toContainText("Empezar demo");

    await startDemoBtn.click();

    const demoPanel = page.getByTestId("demo-panel");
    await expect(demoPanel).toBeVisible();
    await expect(page.getByTestId("demo-scene-title")).toContainText("Escena A");

    // Pausar la demostración
    const pauseBtn = page.getByTestId("demo-pause-btn");
    await expect(pauseBtn).toBeVisible();
    await pauseBtn.click();

    const statusBadge = page.getByTestId("demo-status-badge");
    await expect(statusBadge).toContainText("En pausa");

    // Verificar que el botón 'Siguiente paso' avanza exactamente un paso manteniendo la pausa
    const badgeBeforeStep = await statusBadge.textContent();
    const stepBtn = page.getByTestId("demo-step-btn");
    await expect(stepBtn).toBeEnabled();
    await stepBtn.click();

    await expect(statusBadge).toContainText("En pausa");
    await expect(statusBadge).not.toHaveText(badgeBeforeStep ?? "");

    // Cambiar velocidad a 2x
    const speed2xBtn = page.getByTestId("demo-speed-2x");
    await speed2xBtn.click();

    // Reiniciar escena crea una nueva sala efímera DM*
    const urlBeforeRestart = page.url();
    await page.getByTestId("demo-restart-scene-btn").click();
    await expect(demoPanel).toBeVisible();
    await expect.poll(() => page.url()).not.toBe(urlBeforeRestart);
    expect(page.url()).toMatch(/\/combat\/DM/);

    // Salir de la demo limpia el estado cliente y vuelve a la pantalla de conexión
    await page.getByTestId("demo-exit-btn").click();
    await expect(demoPanel).toHaveCount(0);
    await expect(page.getByTestId("start-demo-btn")).toBeVisible();
  });
});
