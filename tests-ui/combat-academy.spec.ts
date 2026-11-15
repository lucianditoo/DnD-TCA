import { test, expect } from "@playwright/test";

test("Academia: derrota, reinicio, victoria y vuelta al menú", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tutoriales" }).click();
  await page.getByRole("button", { name: "Academia de Combate" }).click();
  await page.getByRole("button", { name: "Cámara y oclusión" }).click();
  await expect(page.getByRole("heading", { name: "Cámara y oclusión" })).toBeVisible();
  await page.getByRole("button", { name: "Finalizar turno del tutorial" }).click();
  await expect(page.getByRole("heading", { name: "YOU FAILED" })).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar" }).click();
  await expect(page.getByTestId("board-stage")).toHaveAttribute("data-view-mode", "2.5d");
  await expect(page.locator('[data-scene-combatant="Canocrock"]')).toHaveAttribute("data-sprite-depth-policy", "foreground");
  await page.getByTestId("camera-angle-se").click();
  await expect(page.getByTestId("board-stage")).toHaveAttribute("data-camera-angle", "se");
  await expect(page.locator('[data-scene-combatant="Bane"]')).toHaveAttribute("data-selected", "true");
  await page.getByTestId("view-mode-2d").click();
  await expect(page.getByTestId("cell-4-4")).toHaveClass(/move-highlight/);
  await page.getByRole("button", { name: "Mover", exact: true }).click();
  await page.getByTestId("cell-2-2").click();
  await expect(page.getByText(/gastarás tu única acción/)).toBeVisible();
  for (const id of ["withdraw-mode", "run-mode", "movement-five-foot-mode"]) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agregar heroe" })).toHaveCount(0);
  await page.locator(".combatant-row").filter({ hasText: "Canocrock" }).click();
  await expect(page.getByText(/Inspeccionando a Canocrock/)).toBeVisible();
  await expect(page.getByText(/gastarás tu única acción/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar movimiento" }).click();
  await expect(page.getByText(/Ya gastaste la acción de movimiento/)).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar" }).click();
  await page.getByTestId("view-mode-2d").click();
  await page.getByRole("button", { name: "Mover", exact: true }).click();
  for (const cell of ["2-2", "3-2", "4-2", "4-3", "4-4"]) await page.getByTestId("cell-" + cell).click();
  await page.getByRole("button", { name: "Confirmar movimiento" }).click();
  await expect(page.getByRole("heading", { name: "Objetivo completado" })).toBeVisible();
  await expect(page.getByText("Daño total")).toBeVisible();
  await page.getByRole("button", { name: "Volver al menú" }).click();
  await expect(page.getByRole("button", { name: "Tutoriales" })).toBeVisible();
});

test("Academia: Fireball conserva puntería ante rechazo y la limpia al reiniciar", async ({ page }) => {
  let rejectFirstCast = true;
  await page.routeWebSocket(/^ws/, socket => {
    const server = socket.connectToServer();
    socket.onMessage(message => {
      if (rejectFirstCast && JSON.parse(message.toString()).type === "cast-spell") {
        rejectFirstCast = false;
        socket.send(JSON.stringify({ type: "error", message: "Lanzamiento rechazado para probar el reintento." }));
      } else server.send(message);
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Tutoriales" }).click();
  await page.getByRole("button", { name: "Academia de Combate" }).click();
  await page.getByRole("button", { name: "Fireball", exact: true }).click();
  await page.getByTestId("view-mode-2d").click();
  await page.getByRole("button", { name: "Habilidad", exact: true }).click();
  await page.getByRole("button", { name: "Fireball", exact: true }).click();
  await page.getByTestId("cell-9-2").click();
  await page.getByRole("button", { name: "Lanzar Fireball" }).click();
  await expect(page.getByText("Lanzamiento rechazado para probar el reintento.")).toBeVisible();
  await expect(page.getByText(/Casilla elegida:.*9, 2/)).toBeVisible();
  await expect(page.locator(".ability-panel").getByLabel("Objetivo", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Reiniciar" }).click();
  await page.getByTestId("view-mode-2d").click();
  await page.getByRole("button", { name: "Habilidad", exact: true }).click();
  await expect(page.getByRole("button", { name: "Lanzar Fireball" })).toHaveCount(0);
  await page.getByRole("button", { name: "Fireball", exact: true }).click();
  await expect(page.getByRole("button", { name: "Lanzar Fireball" })).toBeDisabled();
  await page.getByTestId("cell-9-2").click();
  await expect(page.getByTestId("cell-4-2")).toHaveClass(/aoe-affected/);
  await page.getByRole("button", { name: "Lanzar Fireball" }).click();
  await expect(page.getByRole("heading", { name: "Objetivo completado" })).toBeVisible();
});

test("Academia: el adversario resuelve el AdO y el aprendiz alcanza la meta", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tutoriales" }).click();
  await page.getByRole("button", { name: "Academia de Combate" }).click();
  await page.getByRole("button", { name: "Ataques de oportunidad", exact: true }).click();
  await page.getByTestId("view-mode-2d").click();
  await page.getByRole("button", { name: "Mover", exact: true }).click();
  for (const cell of ["2-2", "3-2", "4-2", "5-2"]) await page.getByTestId("cell-" + cell).click();
  await page.getByRole("button", { name: "Confirmar movimiento" }).click();
  await expect(page.getByRole("heading", { name: "Objetivo completado" })).toBeVisible();
  await expect(page.getByText(/el movimiento se interrumpió.*su AdO.*continuó hasta/)).toBeVisible();
});
