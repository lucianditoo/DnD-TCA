import { test, expect, type Page } from "@playwright/test";

const ARTIFACTS_DIR = "C:/Users/lucia/.gemini/antigravity/brain/5b3491cf-aed1-4825-84f4-051a7ba987a9";
const RAW_ICON_IDS = ["shield", "swords", "sparkles", "skull", "crosshair", "footprints", "compass"];

async function stepDemoOnce(page: Page) {
  const demoPanel = page.getByTestId("demo-panel");
  const stepButton = page.getByTestId("demo-step-btn");
  const previousStepIndex = await demoPanel.getAttribute("data-current-step-index");

  // Windows CI can render the paused state while the final WebSocket messages
  // from a multipart action (for example, spell -> AoO -> spell) are still
  // settling. A bounded retry is safe because the authoritative sequence
  // rejects duplicate or stale control commands.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await expect(stepButton).toBeEnabled();
    await stepButton.click();
    try {
      await expect
        .poll(async () => await demoPanel.getAttribute("data-current-step-index"), { timeout: 5_000 })
        .not.toBe(previousStepIndex);
      return;
    } catch {
      // Retry with the latest DemoSessionState sequence held by the client.
    }
  }

  await expect
    .poll(async () => await demoPanel.getAttribute("data-current-step-index"))
    .not.toBe(previousStepIndex);
}

async function stepDemoUntil(page: Page, predicate: () => Promise<boolean>, maxSteps = 50) {
  for (let i = 0; i < maxSteps; i += 1) {
    if (await predicate()) return;
    await stepDemoOnce(page);
  }
  expect(await predicate()).toBe(true);
}

test.describe("Demostración Táctica Automática y Presentación 2.5D", () => {
  test("1. corrige fichas sin icon IDs crudos, muestra sprites y nombres legibles, soporta 4 ángulos de cámara, zoom, vista 2D y controles de transporte", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto("/");

    const startDemoBtn = page.getByTestId("start-demo-btn");
    await expect(startDemoBtn).toBeVisible();
    await startDemoBtn.click();

    const demoPanel = page.getByTestId("demo-panel");
    await expect(demoPanel).toBeVisible();
    await expect(page.getByTestId("demo-scene-title")).toContainText("Escena A");

    // Pausar la demostración para inspeccionar fichas y cámara
    const pauseBtn = page.getByTestId("demo-pause-btn");
    await pauseBtn.click();
    const statusBadge = page.getByTestId("demo-status-badge");
    await expect(statusBadge).toContainText("En pausa");

    // 1. Ninguna ficha ni fila lateral muestra los strings internos shield/swords/sparkles/skull
    const canvas = page.getByTestId("tactical-scene-canvas");
    await expect(canvas).toBeVisible();
    const tokenTexts = await page.locator("[data-scene-combatant]").allInnerTexts();
    expect(tokenTexts.length).toBeGreaterThanOrEqual(4);
    for (const rawText of tokenTexts) {
      const normalized = rawText.trim().toLowerCase();
      for (const rawIcon of RAW_ICON_IDS) {
        expect(normalized).not.toBe(rawIcon);
        expect(normalized.split(/\s+/)).not.toContain(rawIcon);
      }
    }

    const rosterTexts = await page.locator(".combatant-row").allInnerTexts();
    for (const rawText of rosterTexts) {
      const tokens = rawText.trim().toLowerCase().split(/\s+/);
      for (const rawIcon of RAW_ICON_IDS) {
        expect(tokens).not.toContain(rawIcon);
      }
    }

    // 2. Cada combatiente de la Escena A tiene identidad y familia raster diferenciada en la escena
    const expectedSceneAActors = [
      { name: "Cedrick", archetype: "cedrick" },
      { name: "Jefe Orco", archetype: "orc_leader" },
      { name: "Bane", archetype: "bane" },
      { name: "Elaen", archetype: "elaen" }
    ];

    for (const actor of expectedSceneAActors) {
      const sceneToken = page.locator(`[data-scene-combatant="${actor.name}"]`);
      await expect(sceneToken).toHaveAttribute("data-sprite-archetype", actor.archetype);
      await expect(sceneToken).toHaveAttribute("data-sprite-family", /knight|mage|ranger|orc/);
    }

    // 3. Seleccionar a Cedrick haciendo click en su celda (3,3) y verificar que rotar los 4 ángulos preserva la selección y no altera la sala
    const cedrickToken = page.locator('[data-scene-combatant="Cedrick"]');
    await page.locator(".combatant-row").filter({ hasText: "Cedrick" }).click();
    await expect(cedrickToken).toHaveAttribute("data-selected", "true");

    const statusBeforeCamera = await statusBadge.textContent();
    const seqBeforeCamera = await demoPanel.getAttribute("data-sequence");
    const boardStage = page.getByTestId("board-stage");
    await expect(boardStage).toHaveAttribute("data-view-mode", "2.5d");
    await expect(boardStage).toHaveAttribute("data-camera-angle", "nw");

    await page.screenshot({ path: `${ARTIFACTS_DIR}/demo_25d_angle_nw.png` });

    for (const angle of ["ne", "se", "sw", "nw"] as const) {
      await page.getByTestId(`camera-angle-${angle}`).click();
      await expect(boardStage).toHaveAttribute("data-camera-angle", angle);
      await expect(cedrickToken).toHaveAttribute("data-selected", "true");
      await expect(statusBadge).toHaveText(statusBeforeCamera ?? "");
      await expect(demoPanel).toHaveAttribute("data-sequence", seqBeforeCamera ?? "");
      if (angle !== "nw") {
        await page.screenshot({ path: `${ARTIFACTS_DIR}/demo_25d_angle_${angle}.png` });
      }
    }

    // Arrastrar rota/inclina la cámara real sin modificar el estado de la sala.
    const cameraBox = await canvas.boundingBox();
    expect(cameraBox).not.toBeNull();
    const azimuthBeforeDrag = await boardStage.getAttribute("data-camera-azimuth");
    const elevationBeforeDrag = await boardStage.getAttribute("data-camera-elevation");
    await page.mouse.move(cameraBox!.x + cameraBox!.width * 0.5, cameraBox!.y + cameraBox!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(cameraBox!.x + cameraBox!.width * 0.68, cameraBox!.y + cameraBox!.height * 0.34, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => boardStage.getAttribute("data-camera-azimuth")).not.toBe(azimuthBeforeDrag);
    await expect.poll(() => boardStage.getAttribute("data-camera-elevation")).not.toBe(elevationBeforeDrag);
    await expect(statusBadge).toHaveText(statusBeforeCamera ?? "");
    await expect(demoPanel).toHaveAttribute("data-sequence", seqBeforeCamera ?? "");

    // 4. Zoom +/- y Restablecer no envían comandos ni alteran la sala
    await page.getByTestId("camera-zoom-in").click();
    await expect(boardStage).toHaveAttribute("data-camera-zoom", "1.125");
    await page.getByTestId("camera-zoom-out").click();
    await expect(boardStage).toHaveAttribute("data-camera-zoom", "1");
    await page.getByTestId("camera-zoom-out").click();
    await expect(boardStage).toHaveAttribute("data-camera-zoom", "0.875");
    await page.getByTestId("camera-reset").click();
    await expect(boardStage).toHaveAttribute("data-camera-zoom", "1");
    await expect(boardStage).toHaveAttribute("data-camera-angle", "nw");

    // 5. Toggle a vista 2D de respaldo y regreso a 2.5D
    await page.getByTestId("view-mode-2d").click();
    await expect(boardStage).toHaveAttribute("data-view-mode", "2d");
    await expect(page.locator('[data-combatant-name="Cedrick"] .combatant-sprite-svg')).toBeVisible();
    await page.screenshot({ path: `${ARTIFACTS_DIR}/demo_2d_fallback.png` });

    await page.getByTestId("view-mode-25d").click();
    await expect(boardStage).toHaveAttribute("data-view-mode", "2.5d");

    // 6. Controles de transporte de la demo: avanzar un paso, cambiar velocidad, reiniciar y salir
    const badgeBeforeStep = await statusBadge.textContent();
    await stepDemoOnce(page);
    await expect(statusBadge).toContainText("En pausa");
    await expect(statusBadge).not.toHaveText(badgeBeforeStep ?? "");

    await page.getByTestId("demo-speed-2x").click();

    const urlBeforeRestart = page.url();
    await page.getByTestId("demo-restart-scene-btn").click();
    await expect(demoPanel).toBeVisible();
    await expect.poll(() => page.url()).not.toBe(urlBeforeRestart);
    expect(page.url()).toMatch(/\/combat\/DM/);

    await page.getByTestId("demo-exit-btn").click();
    await expect(demoPanel).toHaveCount(0);
    await expect(page.getByTestId("start-demo-btn")).toBeVisible();

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("2. ejecuta las 3 escenas completas en vista 2.5D validando criatura Large 2x2, Squeezing, Cobertura, Prone y Hold Person", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto("/");
    await page.getByTestId("start-demo-btn").click();
    await expect(page.getByTestId("demo-panel")).toBeVisible();

    const pauseBtn = page.getByTestId("demo-pause-btn");
    await pauseBtn.click();
    const statusBadge = page.getByTestId("demo-status-badge");
    await expect(statusBadge).toContainText("En pausa");

    // Avanzar paso a paso hasta llegar a la Escena B y que Elaen esté activa con cobertura interpuesta
    await stepDemoUntil(page, async () => {
      const title = (await page.getByTestId("demo-scene-title").textContent()) ?? "";
      if (!title.includes("Escena B")) return false;
      const count = await page.locator('[data-scene-combatant="Arquero Orco"]').count();
      if (count === 0) return false;
      const badges = (await page.locator('[data-scene-combatant="Arquero Orco"]').getAttribute("data-badges")) ?? "";
      return badges.includes("COV +4");
    });

    // Validar indicadores de cobertura en 2.5D (COV +4 sobre Arquero Orco e INTERP sobre Guardia Aliado)
    await expect(page.locator('[data-scene-combatant="Arquero Orco"]')).toHaveAttribute("data-badges", /COV \+4/);
    await expect(page.locator('[data-scene-combatant="Guardia Aliado"]')).toHaveAttribute("data-badges", /INTERP/);

    // Validar criatura Large (Guardián Coloso) con huella 2x2 e interacción en cualquiera de sus 4 celdas
    const largeToken = page.locator('[data-scene-combatant="Guardián Coloso"]');
    await expect(largeToken).toHaveAttribute("data-footprint-columns", "2");
    await expect(largeToken).toHaveAttribute("data-footprint-rows", "2");

    await page.getByTestId("view-mode-2d").click();
    for (const [cx, cy] of [[0, 5], [1, 5], [0, 6], [1, 6]] as const) {
      await page.getByTestId(`cell-${cx}-${cy}`).click();
      await expect(page.locator('[data-combatant-name="Guardián Coloso"]')).toHaveClass(/selected-token/);
    }
    await page.getByTestId("view-mode-25d").click();

    await page.screenshot({ path: `${ARTIFACTS_DIR}/demo_25d_scene_b_cover_and_large.png` });

    // Avanzar hasta que Guardián Coloso entre en Squeezing (SQZ)
    await stepDemoUntil(page, async () => {
      const badges = page.locator('[data-scene-combatant="Guardián Coloso"]');
      if ((await badges.count()) === 0) return false;
      return ((await badges.getAttribute("data-badges")) ?? "").includes("SQZ");
    });

    await expect(page.locator('[data-scene-combatant="Guardián Coloso"]')).toHaveAttribute("data-badges", /SQZ/);
    await expect(largeToken).toHaveAttribute("data-footprint-columns", "2");
    await expect(largeToken).toHaveAttribute("data-footprint-rows", "1");
    await page.screenshot({ path: `${ARTIFACTS_DIR}/demo_25d_large_squeezing.png` });

    // Avanzar hasta la Escena C y observar el Derribo (Prone) sobre el Duelista Orco
    await stepDemoUntil(page, async () => {
      const title = (await page.getByTestId("demo-scene-title").textContent()) ?? "";
      if (!title.includes("Escena C")) return false;
      const badges = page.locator('[data-scene-combatant="Duelista Orco"]');
      if ((await badges.count()) === 0) return false;
      return ((await badges.getAttribute("data-badges")) ?? "").includes("PRN");
    });

    const defensorToken = page.locator('[data-scene-combatant="Duelista Orco"]');
    await expect(defensorToken).toHaveAttribute("data-pose", "prone");
    await expect(defensorToken).toHaveAttribute("data-badges", /PRN/);
    await page.screenshot({ path: `${ARTIFACTS_DIR}/demo_25d_prone_condition.png` });

    // Avanzar hasta c-16-mago-hold-person-resolves para observar Hold Person (PAR) sobre Guardia de Lanza
    await stepDemoUntil(page, async () => {
      const badges = page.locator('[data-scene-combatant="Guardia de Lanza"]');
      if ((await badges.count()) === 0) return false;
      return ((await badges.getAttribute("data-badges")) ?? "").includes("PAR");
    });

    const guardiaLanzaToken = page.locator('[data-scene-combatant="Guardia de Lanza"]');
    await expect(guardiaLanzaToken).toHaveAttribute("data-pose", "paralyzed");
    await expect(guardiaLanzaToken).toHaveAttribute("data-badges", /PAR/);
    await page.screenshot({ path: `${ARTIFACTS_DIR}/demo_25d_hold_person_condition.png` });

    // Avanzar hasta completar la demostración
    await stepDemoUntil(page, async () => {
      const statusText = (await statusBadge.textContent()) ?? "";
      return statusText.includes("Completada");
    });

    await expect(statusBadge).toContainText("Completada");

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("3. preserva overlays tácticos de movimiento (celdas alcanzables, ruta y costo por paso) y fallback gráfico de sprite en 2.5D", async ({ page }) => {
    const customProfile = {
      id: "profile-custom-fallback",
      name: "Aventurero Astral",
      type: "player",
      controller: "player",
      icon: "shield",
      hpMax: 24,
      baseAttackBonus: 3,
      baseFortitude: 2,
      baseReflex: 3,
      baseWill: 2,
      baseSpeedFeet: 30,
      abilityScores: { strength: 14, dexterity: 16, constitution: 12, intelligence: 12, wisdom: 12, charisma: 10 },
      sizeCategory: "medium",
      creatureTypeId: "humanoid",
      featureIds: [],
      skillRanks: { escape_artist: 0 },
      inventory: [
        { itemId: "custom-sword", catalogId: "longsword" },
        { itemId: "custom-armor", catalogId: "chain_shirt" }
      ],
      equipmentSlots: { mainHandItemId: "custom-sword", offHandItemId: null, armorItemId: "custom-armor" },
      featIds: [],
      intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
      abilities: [],
      buffs: [],
      position: { x: 2, y: 2, zFeet: 0 },
      updatedAt: new Date(0).toISOString()
    };

    await page.goto("/");
    await page.evaluate(
      (profile) => localStorage.setItem("dnd-tactical.profiles.v6", JSON.stringify({ version: 6, profiles: [profile] })),
      customProfile
    );
    await page.reload();

    await page.locator('input[type="text"], input:not([type])').first().fill("OverlayGM");
    await page.getByRole("button", { name: "Crear sala" }).click();
    await page.getByTestId("view-mode-2d").click();

    await page.locator("label").filter({ hasText: "Perfiles guardados" }).locator("select").selectOption({ label: "Aventurero Astral" });
    await page.getByRole("button", { name: "Agregar perfil" }).click();

    await page.locator("label").filter({ hasText: "Enemigos" }).locator("select").selectOption({ label: "Canocrock" });
    await page.getByRole("button", { name: "Agregar enemigo" }).click();

    // Posicionar en preparación
    await page.locator(".combatant-list button").nth(0).click();
    await page.getByRole("button", { name: "Mover" }).click();
    await page.getByTestId("cell-2-3").click();

    await page.locator(".combatant-list button").nth(1).click();
    await page.getByRole("button", { name: "Mover" }).click();
    await page.getByTestId("cell-7-3").click();

    // Verificar fallback gráfico para perfil personalizado desconocido
    const customToken = page.locator('[data-sprite-archetype="fallback_player"]').first();
    await expect(customToken).toBeVisible();
    await expect(customToken.locator(".combatant-sprite-svg")).toHaveAttribute("data-sprite-fallback", "true");

    // Iniciar combate y trazar una ruta de movimiento en 2.5D
    await page.getByText("Iniciativa manual").click();
    await page.locator(".initiative-list input").nth(0).fill("20");
    await page.locator(".initiative-list input").nth(1).fill("10");
    await page.locator(".initiative-list input").nth(1).press("Tab");
    await page.getByRole("button", { name: "Iniciar combate" }).click();

    await page.getByTestId("cell-2-3").click();
    await page.getByRole("button", { name: "Mover" }).click();

    // Verificar celdas alcanzables (.move-highlight) y trazar ruta de 3 pasos
    await expect(page.locator(".cell.move-highlight").first()).toBeVisible();
    await page.getByTestId("cell-3-3").click();
    await page.getByTestId("cell-4-3").click();
    await page.getByTestId("cell-5-3").click();

    await expect(page.locator(".cell.route-cell")).toHaveCount(3);
    await expect(page.getByTestId("cell-5-3").locator(".route-step")).toContainText("15");

    await page.getByTestId("view-mode-25d").click();
    await expect(page.getByTestId("tactical-scene-canvas")).toBeVisible();
    await page.screenshot({ path: `${ARTIFACTS_DIR}/demo_25d_movement_overlay.png` });
  });
});
