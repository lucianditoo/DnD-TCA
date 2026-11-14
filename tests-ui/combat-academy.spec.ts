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
  for (const cell of ["2-2", "3-2", "4-2", "4-3", "4-4"]) await page.getByTestId("cell-" + cell).click();
  await page.getByRole("button", { name: "Confirmar movimiento" }).click();
  await expect(page.getByRole("heading", { name: "Objetivo completado" })).toBeVisible();
  await expect(page.getByText("Daño total")).toBeVisible();
  await page.getByRole("button", { name: "Volver al menú" }).click();
  await expect(page.getByRole("button", { name: "Tutoriales" })).toBeVisible();
});

test("Academia: Fireball desde una casilla vacía detrás del muro", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tutoriales" }).click();
  await page.getByRole("button", { name: "Academia de Combate" }).click();
  await page.getByRole("button", { name: "Fireball", exact: true }).click();
  await page.getByTestId("view-mode-2d").click();
  await page.getByRole("button", { name: "Habilidad", exact: true }).click();
  await page.getByRole("button", { name: "Fireball", exact: true }).click();
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
});
