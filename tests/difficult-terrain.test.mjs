import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePathCostFeet, validateMovePath } from "../packages/shared/dist/rules.js";

test("Sprint 015: Difficult Terrain and Corners", async (t) => {
  await t.test("calculatePathCostFeet calcula correctamente el coste iterativo (normal y diagonal)", () => {
    const snapshot = {
      board: {
        width: 10,
        height: 10,
        cellSizeFeet: 5,
        difficultTerrainCells: ["2,0", "3,1", "4,2", "9,9"]
      }
    };
    
    // Movimiento recto: 0,0 -> 1,0 (normal, 5) -> 2,0 (dificil, 10) = 15 ft
    const pathStraight = [{x: 1, y: 0}, {x: 2, y: 0}];
    const costStraight = calculatePathCostFeet({x: 0, y: 0}, pathStraight, snapshot);
    assert.equal(costStraight, 15, "Movimiento recto mixto deberia costar 15 pies");

    // Movimiento diagonal: 0,0 -> 1,1 (normal, 5) -> 2,2 (normal, 10) -> 3,1 (dificil 1ra diagonal del par? no, es la 3ra, o sea isFirstOfPair = true, entonces 15 ft) -> 4,2 (dificil 2da diagonal del par, 20 ft)
    const pathDiagonal = [{x: 1, y: 1}, {x: 2, y: 2}, {x: 3, y: 1}, {x: 4, y: 2}];
    const costsDiagonal = calculatePathCostFeet({x: 0, y: 0}, pathDiagonal, snapshot);
    // Paso 1 (diag 1, normal): 5
    // Paso 2 (diag 2, normal): 10, total 15
    // Paso 3 (diag 3, dificil): 15, total 30
    // Paso 4 (diag 4, dificil): 20, total 50
    assert.equal(costsDiagonal, 50, "Movimiento diagonal mixto con terreno dificil deberia alternar 15/20 ft apropiadamente");
  });

  await t.test("validateMovePath bloquea el paso de 5 pies hacia terreno dificil", () => {
    const snapshot = {
      board: { width: 10, height: 10, cellSizeFeet: 5, difficultTerrainCells: ["1,0"] },
      combatants: [],
      currentTurn: { movementUsedFeet: 0, usedFiveFootStep: false }
    };
    const combatant = { id: "c1", position: {x: 0, y: 0}, name: "Heroe" };
    
    // Paso normal es valido
    const normalStep = validateMovePath(snapshot, combatant, [{x: 0, y: 1}], 5, true);
    assert.equal(normalStep.ok, true, "Paso de 5 pies a terreno normal debe ser valido");

    // Paso a terreno dificil es invalido
    const difficultStep = validateMovePath(snapshot, combatant, [{x: 1, y: 0}], 5, true);
    assert.equal(difficultStep.ok, false, "Paso de 5 pies a terreno dificil debe fallar");
    if (!difficultStep.ok) {
      assert.match(difficultStep.error, /No puedes dar un paso de 5 pies/);
    }
  });

  await t.test("validateMovePath bloquea diagonales cruzando esquinas con impassableCells (obstaculo solido)", () => {
    const snapshot = {
      board: { width: 10, height: 10, cellSizeFeet: 5, impassableCells: ["1,0"] },
      combatants: [],
      currentTurn: { movementUsedFeet: 0, usedFiveFootStep: false }
    };
    const combatant = { id: "c1", type: "pc", position: {x: 0, y: 0}, name: "Heroe", stats: { hp: 10 } };

    // Intentar mover diagonal de 0,0 a 1,1. Esquina adyacente 1,0 es impassable: debe fallar.
    const path = [{x: 1, y: 1}];
    const validation = validateMovePath(snapshot, combatant, path, 30);
    assert.equal(validation.ok, false, "Debe fallar al cruzar una esquina bloqueada por un obstaculo solido");
    if (!validation.ok) {
      assert.match(validation.error, /esquina bloqueada por un obstaculo solido/);
    }
  });

  await t.test("Sprint 037: validateMovePath PERMITE el corte diagonal junto a un enemigo en la celda ancla (MOVE-05, corrige Sprint 015)", () => {
    const snapshot = {
      board: { width: 10, height: 10, cellSizeFeet: 5 }, // sin impassableCells
      combatants: [
        { id: "e1", type: "npc", position: {x: 0, y: 1}, hp: 10, stats: { hp: 10 } } // Enemigo en la celda ancla 0,1
      ],
      currentTurn: { movementUsedFeet: 0, usedFiveFootStep: false }
    };
    const combatant = { id: "c1", type: "pc", position: {x: 0, y: 0}, name: "Heroe", stats: { hp: 10 } };

    // Intentar mover diagonal de 0,0 a 1,1. La unica esquina ocupada (0,1) tiene un enemigo, no un muro.
    // Per RAW (Cap. 8, pag. 147), una criatura nunca bloquea el vertice diagonal: debe ser exitoso.
    const path = [{x: 1, y: 1}];
    const validation = validateMovePath(snapshot, combatant, path, 30);
    assert.equal(validation.ok, true, "Una criatura en la celda ancla no debe bloquear el corte de esquina diagonal");
  });
});
