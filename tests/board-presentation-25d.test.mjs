import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  INTERNAL_ICON_IDENTIFIERS,
  isInternalIconIdentifier,
  resolveCombatantSprite
} from "../apps/web/src/components/Board/sprites.tsx";
import {
  CAMERA_ANGLE_OPTIONS,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  DEFAULT_CAMERA_STATE,
  buildBoardPresentationModel,
  clampCameraZoom,
  projectCellToCameraGrid,
  projectFootprintToCameraGrid
} from "../apps/web/src/components/Board/presentationModel.ts";
import {
  SCRIPTED_TACTICAL_DEMO_ID,
  createCombatRulesSnapshot,
  gameCatalog
} from "@dnd-tactical/shared";
import { executeNextDemoStep, startNewDemoSession } from "../apps/server/src/demo/runner.ts";
import { destroyDemoSession } from "../apps/server/src/demo/sessionStore.ts";
import { rooms } from "../apps/server/src/room/roomStore.ts";

const ANGLES = CAMERA_ANGLE_OPTIONS.map((option) => option.id);

describe("2.5D Tactical Presentation Model & Sprite Resolution", () => {
  test("1. identifica todos los icon IDs internos y nunca los trata como etiquetas visibles", () => {
    for (const rawId of ["shield", "swords", "sparkles", "skull", "crosshair", "footprints", "compass"]) {
      assert.equal(INTERNAL_ICON_IDENTIFIERS.has(rawId), true);
      assert.equal(isInternalIconIdentifier(rawId), true);
      assert.equal(isInternalIconIdentifier(`  ${rawId.toUpperCase()} `), true);
    }
    assert.equal(isInternalIconIdentifier("Cedrick"), false);
    assert.equal(isInternalIconIdentifier("Alaric el Mago"), false);
  });

  test("2. resuelve arquetipos gráficos diferenciados para todos los actores de la demo y catálogo, con fallback seguro", () => {
    const expectedActors = [
      { id: "cedrick-1", name: "Cedrick", type: "player", icon: "shield", archetype: "cedrick" },
      { id: "bane-1", name: "Bane", type: "player", icon: "swords", archetype: "bane" },
      { id: "elaen-1", name: "Elaen", type: "player", icon: "sparkles", archetype: "elaen" },
      { id: "alaric-1", name: "Alaric el Mago", type: "player", icon: "sparkles", archetype: "alaric" },
      { id: "orc-leader-1", name: "Jefe Orco", type: "enemy", icon: "skull", archetype: "orc_leader" },
      { id: "orc-duelist-1", name: "Duelista Orco", type: "enemy", icon: "swords", archetype: "orc_duelist" },
      { id: "spear-guard-1", name: "Guardia de Lanza", type: "enemy", icon: "swords", archetype: "spear_guard" },
      { id: "guardian-1", name: "Guardián Coloso", type: "player", icon: "shield", sizeCategory: "large", archetype: "guardian_large" },
      { id: "canocrock-1", name: "Canocrock", type: "enemy", icon: "skull", archetype: "canocrock" }
    ];

    for (const actor of expectedActors) {
      const descriptor = resolveCombatantSprite(actor);
      assert.equal(descriptor.archetypeId, actor.archetype, `Actor ${actor.name} debe resolver a ${actor.archetype}`);
      assert.equal(descriptor.isFallback, false);
    }

    const fallbackPlayer = resolveCombatantSprite({
      id: "custom-hero-99",
      name: "Aventurero Desconocido",
      type: "player",
      icon: "shield"
    });
    assert.equal(fallbackPlayer.archetypeId, "fallback_player");
    assert.equal(fallbackPlayer.isFallback, true);

    const fallbackEnemy = resolveCombatantSprite({
      id: "custom-monster-99",
      name: "Aberración Desconocida",
      type: "enemy",
      icon: "skull"
    });
    assert.equal(fallbackEnemy.archetypeId, "fallback_enemy");
    assert.equal(fallbackEnemy.isFallback, true);
  });

  test("3. proyecta celdas biyectivamente en los 4 ángulos de cámara sin colisiones ni pérdida de coordenadas autoritativas", () => {
    const width = 10;
    const height = 8;

    for (const angle of ANGLES) {
      const seenSlots = new Set();
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const slot = projectCellToCameraGrid(x, y, width, height, angle);
          assert.ok(slot.gridColumn >= 1 && slot.gridColumn <= width);
          assert.ok(slot.gridRow >= 1 && slot.gridRow <= height);
          const key = `${slot.gridColumn},${slot.gridRow}`;
          assert.equal(seenSlots.has(key), false, `Colisión en ángulo ${angle} para slot ${key}`);
          seenSlots.add(key);
        }
      }
      assert.equal(seenSlots.size, width * height);
    }
  });

  test("4. proyecta huellas 1x1 y Large 2x2 manteniendo exactamente el mismo conjunto de celdas ocupadas en los 4 ángulos", () => {
    const width = 10;
    const height = 8;
    const largeCells = [
      { x: 5, y: 1, zFeet: 0 },
      { x: 6, y: 1, zFeet: 0 },
      { x: 5, y: 2, zFeet: 0 },
      { x: 6, y: 2, zFeet: 0 }
    ];

    for (const angle of ANGLES) {
      const projectedFootprint = projectFootprintToCameraGrid(largeCells, width, height, angle);
      assert.equal(projectedFootprint.columns, 2);
      assert.equal(projectedFootprint.rows, 2);

      const individualSlots = largeCells.map((cell) => projectCellToCameraGrid(cell.x, cell.y, width, height, angle));
      const minCol = Math.min(...individualSlots.map((slot) => slot.gridColumn));
      const maxCol = Math.max(...individualSlots.map((slot) => slot.gridColumn));
      const minRow = Math.min(...individualSlots.map((slot) => slot.gridRow));
      const maxRow = Math.max(...individualSlots.map((slot) => slot.gridRow));

      assert.equal(projectedFootprint.colStart, minCol);
      assert.equal(projectedFootprint.rowStart, minRow);
      assert.equal(maxCol - minCol + 1, 2);
      assert.equal(maxRow - minRow + 1, 2);
    }
  });

  test("5. construye el modelo de presentación para las 3 escenas de la demo sin mutar CombatRoom ni exponer icon IDs", () => {
    const socket = {
      OPEN: 1,
      readyState: 1,
      send() {}
    };
    const record = startNewDemoSession(socket, SCRIPTED_TACTICAL_DEMO_ID, "Tester25D", { autoPlay: false });

    try {
      const visitedScenes = new Set();
      while (record.status !== "completed" && record.status !== "failed") {
        visitedScenes.add(record.currentSceneIndex);
        const room = rooms.get(record.roomCode);
        assert.ok(room, `Debe existir sala activa para ${record.roomCode}`);
        const snapshotBefore = structuredClone(room);
        const snapshot = createCombatRulesSnapshot(room, gameCatalog);
        const selected = room.combatants.find((c) => c.id === room.activeCombatantId) ?? room.combatants[0] ?? null;
        const target = room.combatants.find((c) => c.type === "enemy") ?? null;

        for (const angle of ANGLES) {
          const model = buildBoardPresentationModel({
            room,
            snapshot,
            selected,
            targetId: target?.id ?? "",
            displayedPath: [{ x: 1, y: 2, zFeet: 0 }, { x: 2, y: 2, zFeet: 0 }],
            displayedPathCosts: [5, 10],
            highlightedCells: new Map([["2,2", "move-highlight"]]),
            chargePreviewPath: null,
            camera: {
              ...DEFAULT_CAMERA_STATE,
              angle
            }
          });

          assert.equal(model.cells.length, room.board.width * room.board.height);
          assert.equal(model.tokens.length, room.combatants.length);

          for (const token of model.tokens) {
            assert.equal(isInternalIconIdentifier(token.name), false);
            assert.ok(token.name.length > 0);
            for (const badge of token.badges) {
              assert.equal(isInternalIconIdentifier(badge.code), false);
            }
          }
        }

        // Garantía de inmutabilidad: rotar la cámara o construir el modelo nunca altera room ni posiciones
        assert.deepEqual(room, snapshotBefore);

        const ok = executeNextDemoStep(record);
        assert.equal(ok, true);
      }

      assert.deepEqual([...visitedScenes].sort(), [0, 1, 2]);
    } finally {
      destroyDemoSession(record.sessionId);
    }
  });

  test("6. acota el zoom de cámara dentro de los límites permitidos", () => {
    assert.equal(clampCameraZoom(0.1), CAMERA_ZOOM_MIN);
    assert.equal(clampCameraZoom(99), CAMERA_ZOOM_MAX);
    assert.equal(clampCameraZoom(1.1), 1.1);
  });
});
