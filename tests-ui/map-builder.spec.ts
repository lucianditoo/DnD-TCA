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

  test("el botón Cancelar descarta cambios y cierra el editor sin alterar el tablero", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Nombre").fill("Master Cancel");
    await page.getByRole("button", { name: /Crear sala/i }).click();

    await expect(page.getByRole("heading", { name: "Preparacion" })).toBeVisible();
    await page.getByTestId("map-editor-open-btn").click();

    const toolbar = page.getByTestId("map-editor-toolbar");
    await expect(toolbar).toBeVisible();

    // Redimensionar borrador
    await page.getByTestId("map-editor-width").fill("16");
    await page.getByTestId("map-editor-height").fill("16");
    await page.getByTestId("map-editor-apply-dims").click();
    await expect(page.getByText("Dimensiones: 16×16")).toBeVisible();

    // Cancelar
    await page.getByTestId("map-editor-cancel").click();
    await expect(toolbar).not.toBeVisible();

    // Al reabrir, debe conservar las dimensiones originales del servidor (16x8), no el borrador descartado
    await page.getByTestId("map-editor-open-btn").click();
    await expect(page.getByText("Dimensiones: 16×8")).toBeVisible();
    await page.getByTestId("map-editor-cancel").click();
  });

  test("un rechazo del servidor mantiene el editor abierto con el borrador intacto y muestra el error de forma determinista", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Nombre").fill("Master Bounds");
    await page.getByRole("button", { name: /Crear sala/i }).click();

    await expect(page.getByRole("heading", { name: "Preparacion" })).toBeVisible();

    // 1. Agregar un enemigo (Canocrock, que se ubica en (8, 4))
    const addEnemyBtn = page.getByRole("button", { name: /Agregar enemigo/i });
    await expect(addEnemyBtn).toBeVisible();
    await addEnemyBtn.click();
    await expect(page.locator(".combatant-row")).toHaveCount(1);

    // Cambiar a vista 2D para interactuar con los botones de celda directamente
    await page.getByTestId("view-mode-2d").click();

    // 2. Abrir el editor de mapa
    await page.getByTestId("map-editor-open-btn").click();
    const toolbar = page.getByTestId("map-editor-toolbar");
    await expect(toolbar).toBeVisible();

    // 3. Pintar un muro en (1, 1) en el borrador
    await page.getByTestId("brush-wall").click();
    await page.getByTestId("cell-1-1").click();
    await expect(page.getByText(/Muros: 1/)).toBeVisible();

    // 4. Intentar reducir a 6x6 (Canocrock está en x=8, y=4, fuera de 6x6)
    await page.getByTestId("map-editor-width").fill("6");
    await page.getByTestId("map-editor-height").fill("6");
    await page.getByTestId("map-editor-apply-dims").click();
    await expect(page.getByText("Dimensiones: 6×6")).toBeVisible();

    await page.getByTestId("map-editor-save").click();

    // 5. El toolbar DEBE permanecer visible y mostrar el error de límites
    await expect(toolbar).toBeVisible();
    const errorAlert = page.getByTestId("map-editor-error");
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/No se puede reducir el mapa a 6x6: Canocrock quedaría fuera de los límites/);

    // 6. El borrador permanece intacto con sus cambios (6x6 y 1 muro)
    await expect(page.getByText("Dimensiones: 6×6")).toBeVisible();
    await expect(page.getByText(/Muros: 1/)).toBeVisible();

    // 7. MAJOR 2 (Retry after rejection): Corregir dimensiones a un tamaño válido (10x10) que contenga a Canocrock (8, 4)
    await page.getByTestId("map-editor-width").fill("10");
    await page.getByTestId("map-editor-height").fill("10");
    await page.getByTestId("map-editor-apply-dims").click();
    await expect(page.getByText("Dimensiones: 10×10")).toBeVisible();

    // 8. Volver a guardar: no debe fallar por el error anterior stale
    await page.getByTestId("map-editor-save").click();

    // 9. Debe completarse con éxito: editor se cierra y tablero refleja la corrección
    await expect(toolbar).not.toBeVisible();
    await expect(page.getByText(/El GM actualizó el mapa táctico \(10x10/)).toBeVisible();
  });

  test("un room-update ajeno (ej. segundo jugador se une) no elimina un borrador de edición abierto", async ({ browser }) => {
    // Contexto del GM
    const gmContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    await gmPage.goto("/");
    await gmPage.getByLabel("Nombre").fill("GM Multi");
    await gmPage.getByRole("button", { name: /Crear sala/i }).click();

    await expect(gmPage.getByRole("heading", { name: "Preparacion" })).toBeVisible();

    // Extraer código de sala
    const roomHeader = await gmPage.locator("header, h1, p").filter({ hasText: /Sala/ }).first().textContent();
    const roomCodeMatch = roomHeader?.match(/Sala\s+([A-Z0-9]+)/i);
    const roomCode = roomCodeMatch ? roomCodeMatch[1] : "";

    // Abrir editor y modificar borrador (ej. 14x12 y 1 muro)
    await gmPage.getByTestId("view-mode-2d").click();
    await gmPage.getByTestId("map-editor-open-btn").click();
    const toolbar = gmPage.getByTestId("map-editor-toolbar");
    await expect(toolbar).toBeVisible();

    await gmPage.getByTestId("map-editor-width").fill("14");
    await gmPage.getByTestId("map-editor-height").fill("12");
    await gmPage.getByTestId("map-editor-apply-dims").click();
    await expect(gmPage.getByText("Dimensiones: 14×12")).toBeVisible();

    await gmPage.getByTestId("brush-wall").click();
    await gmPage.getByTestId("cell-2-2").click();
    await expect(gmPage.getByText(/Muros: 1/)).toBeVisible();

    // Segundo cliente (Jugador se une a la sala generando un broadcast de room-update)
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await playerPage.goto("/");
    await playerPage.getByRole("button", { name: /Jugador/i }).click();
    await playerPage.getByLabel("Codigo de sala").fill(roomCode);
    await playerPage.getByLabel("Nombre").fill("Player Intruder");
    await playerPage.getByRole("button", { name: /Unirse/i }).click();
    await expect(playerPage.getByRole("heading", { name: "Preparacion" })).toBeVisible();

    // En el GM, verificar que el toolbar sigue visible y el borrador intacto (14x12 y 1 muro)
    await expect(toolbar).toBeVisible();
    await expect(gmPage.getByText("Dimensiones: 14×12")).toBeVisible();
    await expect(gmPage.getByText(/Muros: 1/)).toBeVisible();

    await gmContext.close();
    await playerContext.close();
  });

  test("semántica visual distingue Wall (impassable + LoE) de Pillar (LoE only) sin revertirse", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Nombre").fill("Master Semantics");
    await page.getByRole("button", { name: /Crear sala/i }).click();

    await expect(page.getByRole("heading", { name: "Preparacion" })).toBeVisible();

    // Cambiar a vista 2D para interactuar con las celdas
    await page.getByTestId("view-mode-2d").click();

    await page.getByTestId("map-editor-open-btn").click();
    const toolbar = page.getByTestId("map-editor-toolbar");
    await expect(toolbar).toBeVisible();

    // Pintar Wall en (3, 3) y Pillar en (4, 4)
    await page.getByTestId("brush-wall").click();
    await page.getByTestId("cell-3-3").click();

    await page.getByTestId("brush-pillar").click();
    await page.getByTestId("cell-4-4").click();

    // Verificar data-scenic-prop en vista 2D
    await expect(page.getByTestId("cell-3-3")).toHaveAttribute("data-scenic-prop", "barrier-block");
    await expect(page.getByTestId("cell-4-4")).toHaveAttribute("data-scenic-prop", "loe-pillar");

    // Guardar
    await page.getByTestId("map-editor-save").click();
    await expect(toolbar).not.toBeVisible();

    // Tras guardar, verificar que la semántica visual persiste: Wall es barrier-block, Pillar es loe-pillar
    await expect(page.getByTestId("cell-3-3")).toHaveAttribute("data-scenic-prop", "barrier-block");
    await expect(page.getByTestId("cell-4-4")).toHaveAttribute("data-scenic-prop", "loe-pillar");
  });

  test("bloqueo completo de interacción de combate durante la edición del mapa", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Nombre").fill("Master Lock");
    await page.getByRole("button", { name: /Crear sala/i }).click();

    await expect(page.getByRole("heading", { name: "Preparacion" })).toBeVisible();

    // En estado normal, Agregar héroe está habilitado
    const addHeroBtn = page.getByRole("button", { name: /Agregar heroe/i });
    await expect(addHeroBtn).toBeEnabled();

    // Abrir la sección de Iniciativa manual para que Iniciar combate sea visible
    await page.getByText("Iniciativa manual").click();
    const startCombatBtn = page.getByRole("button", { name: /Iniciar combate/i });
    await expect(startCombatBtn).toBeVisible();

    // Abrir editor
    await page.getByTestId("map-editor-open-btn").click();
    const toolbar = page.getByTestId("map-editor-toolbar");
    await expect(toolbar).toBeVisible();

    // Mientras el editor está abierto, Agregar heroe, Agregar enemigo, e Iniciar combate deben estar deshabilitados
    await expect(addHeroBtn).toBeDisabled();
    await expect(page.getByRole("button", { name: /Agregar enemigo/i })).toBeDisabled();
    await expect(startCombatBtn).toBeDisabled();

    // Cerrar editor con cancelar
    await page.getByTestId("map-editor-cancel").click();
    await expect(toolbar).not.toBeVisible();

    // Vuelven a estar habilitados (o disponibles según las reglas normales)
    await expect(addHeroBtn).toBeEnabled();
    await expect(page.getByRole("button", { name: /Agregar enemigo/i })).toBeEnabled();
  });
});
