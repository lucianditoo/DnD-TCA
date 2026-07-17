import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMovePath } from "../packages/shared/dist/rules.js";

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 037 — Restricción de Esquinas y Obstáculos Diagonales (Rule ID: MOVE-05)
// El corte de esquina diagonal solo se bloquea por obstáculos sólidos
// (board.impassableCells) o límites del tablero — nunca por una criatura (aliada
// o enemiga), corrigiendo la divergencia deliberada de Sprint 015.
// ─────────────────────────────────────────────────────────────────────────────

function baseSnapshot(overrides = {}) {
  return {
    board: { width: 10, height: 10, cellSizeFeet: 5 },
    combatants: [],
    currentTurn: { movementUsedFeet: 0, usedFiveFootStep: false },
    ...overrides
  };
}

test("Sprint 037: Restricción de Esquinas y Obstáculos Diagonales (MOVE-05)", async (t) => {
  await t.test("bloqueo incondicional por muro en la ancla horizontal (x2,y1)", () => {
    const snapshot = baseSnapshot({ board: { width: 10, height: 10, cellSizeFeet: 5, impassableCells: ["1,0"] } });
    const combatant = { id: "c1", type: "pc", position: { x: 0, y: 0 }, name: "Heroe", stats: { hp: 10 } };

    const validation = validateMovePath(snapshot, combatant, [{ x: 1, y: 1 }], 30);
    assert.equal(validation.ok, false, "La ancla horizontal (1,0) es un muro: el corte diagonal debe fallar.");
  });

  await t.test("bloqueo incondicional por muro en la ancla vertical (x1,y2)", () => {
    const snapshot = baseSnapshot({ board: { width: 10, height: 10, cellSizeFeet: 5, impassableCells: ["0,1"] } });
    const combatant = { id: "c1", type: "pc", position: { x: 0, y: 0 }, name: "Heroe", stats: { hp: 10 } };

    const validation = validateMovePath(snapshot, combatant, [{ x: 1, y: 1 }], 30);
    assert.equal(validation.ok, false, "La ancla vertical (0,1) es un muro: el corte diagonal debe fallar.");
  });

  await t.test("permiso diagonal junto a un enemigo consciente y activo en la celda ancla", () => {
    const snapshot = baseSnapshot({
      combatants: [{ id: "e1", type: "npc", position: { x: 1, y: 0 }, hp: 10, stats: { hp: 10 } }]
    });
    const combatant = { id: "c1", type: "pc", position: { x: 0, y: 0 }, name: "Heroe", stats: { hp: 10 } };

    const validation = validateMovePath(snapshot, combatant, [{ x: 1, y: 1 }], 30);
    assert.equal(validation.ok, true, "Un enemigo activo en la celda ancla no debe bloquear el corte de esquina.");
  });

  await t.test("permiso diagonal junto a un aliado en la celda ancla", () => {
    const snapshot = baseSnapshot({
      combatants: [{ id: "ally1", type: "pc", position: { x: 0, y: 1 }, hp: 10, stats: { hp: 10 } }]
    });
    const combatant = { id: "c1", type: "pc", position: { x: 0, y: 0 }, name: "Heroe", stats: { hp: 10 } };

    const validation = validateMovePath(snapshot, combatant, [{ x: 1, y: 1 }], 30);
    assert.equal(validation.ok, true, "Un aliado en la celda ancla no debe bloquear el corte de esquina.");
  });

  await t.test("un token Large (2x2) es bloqueado si una sola de sus casillas corporales proyectadas en la esquina pisa un muro", () => {
    // Combatiente Large en (0,0) -> (1,1). Ancla horizontal = (1,0); footprint 2x2 proyectado en
    // esa ancla ocupa (1,0),(2,0),(1,1),(2,1). El muro esta en (2,0): NO es la celda de anclaje
    // exacta, pero SI es parte de la huella corporal completa que el Large proyectaria alli.
    const snapshot = baseSnapshot({ board: { width: 10, height: 10, cellSizeFeet: 5, impassableCells: ["2,0"] } });
    const combatant = { id: "big1", type: "pc", position: { x: 0, y: 0 }, name: "Gigante", sizeCategory: "large", stats: { hp: 40 } };

    const validation = validateMovePath(snapshot, combatant, [{ x: 1, y: 1 }], 30);
    assert.equal(validation.ok, false, "Una sola celda de la huella 2x2 pisando un muro en la ancla debe bastar para bloquear el corte de esquina.");
  });

  await t.test("un token Large (2x2) SÍ puede cortar la esquina si la huella proyectada no pisa ningún muro", () => {
    const snapshot = baseSnapshot(); // sin impassableCells
    const combatant = { id: "big2", type: "pc", position: { x: 0, y: 0 }, name: "Gigante", sizeCategory: "large", stats: { hp: 40 } };

    const validation = validateMovePath(snapshot, combatant, [{ x: 1, y: 1 }], 30);
    assert.equal(validation.ok, true, "Sin obstaculos solidos en la huella proyectada, el Large debe poder cortar la esquina.");
  });
});
