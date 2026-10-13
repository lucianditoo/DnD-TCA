import { test, expect } from "@playwright/test";

test.describe("Editor Táctico de Mapa (D-5 MVP)", () => {
  test("el GM puede abrir el editor de mapa, seleccionar pinceles, redimensionar y guardar", async ({ page }) => {
    // 1. Acceder a la app
    await page.goto("/");

    // 2. Crear una sala como GM
    await page.getByLabel("Nombre").fill("Master Táctico");
    await page.getByRole("button", { name: /Crear sala/i }).click();

    // 3. Esperar que cargue la interfaz principal de combate
    await expect(page.getByRole("heading", { name: "Preparacion" })).toBeVisible();
    const openEditorBtn = page.getByTestId("map-editor-open-btn");
    await expect(openEditorBtn).toBeVisible();

    // 4. Abrir el editor de mapa
    await openEditorBtn.click();
    const toolbar = page.getByTestId("map-editor-toolbar");
    await expect(toolbar).toBeVisible();
    await expect(page.getByText("Editor Táctico de Mapa (D-5 MVP)")).toBeVisible();

    // 5. Verificar pinceles disponibles
    const wallBrush = page.getByTestId("brush-wall");
    const pillarBrush = page.getByTestId("brush-pillar");
    const rubbleBrush = page.getByTestId("brush-rubble");
    const clearBrush = page.getByTestId("brush-clear");

    await expect(wallBrush).toHaveClass(/active/);
    await pillarBrush.click();
    await expect(pillarBrush).toHaveClass(/active/);
    await rubbleBrush.click();
    await expect(rubbleBrush).toHaveClass(/active/);
    await clearBrush.click();
    await expect(clearBrush).toHaveClass(/active/);
    await wallBrush.click();
    await expect(wallBrush).toHaveClass(/active/);

    // 6. Redimensionar el mapa (ej. 14x12)
    const widthInput = page.getByTestId("map-editor-width");
    const heightInput = page.getByTestId("map-editor-height");
    await widthInput.fill("14");
    await heightInput.fill("12");
    await page.getByTestId("map-editor-apply-dims").click();
    await expect(page.getByText("Dimensiones: 14×12")).toBeVisible();

    // 7. Click en botón Guardar y Aplicar
    await page.getByTestId("map-editor-save").click();

    // 8. El toolbar debe cerrarse al confirmarse la actualización
    await expect(toolbar).not.toBeVisible({ timeout: 5000 });

    // 9. El log de combate debe reflejar la actualización por el GM
    await expect(page.getByText(/El GM actualizó el mapa táctico \(14x12/)).toBeVisible();
  });
});
