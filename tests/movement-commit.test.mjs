import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveMovementPipeline,
  commitMovementResolution
} from "../packages/shared/dist/index.js";
import { structuredSnapshotFields } from "./test-utils.mjs";

function setupRoom(width, height) {
  return {
    round: 1,
    board: { width, height, cellSizeFeet: 5, impassableCells: [], difficultTerrainCells: [] },
    combatants: [],
    effectInstances: [],
    currentTurn: {
      combatantId: null,
      movementUsedFeet: 0,
      normalDiagonalStepsThisTurn: 0,
      usedMoveAction: false
    }
  };
}

function createCombatant(id, x, y, size = "medium", type = "player") {
  return {
    id,
    name: id,
    type,
    position: { x, y, zFeet: 0 },
    hpCurrent: 10,
    hpMax: 20,
    size,
    isStable: false,
    ...structuredSnapshotFields(10),
    sizeCategory: size,
    stats: { distanceMovedFeet: 0 },
    abilities: [],
    buffs: []
  };
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function preconditionsFor(room, combatant) {
  return {
    expectedOrigin: { ...combatant.position },
    expectedMovementUsedFeet: room.currentTurn.movementUsedFeet,
    expectedDiagonalContext: { normalDiagonalStepsThisTurn: room.currentTurn.normalDiagonalStepsThisTurn }
  };
}

function resolveReady(room, mover, path, budget = 100, initialContext) {
  const result = resolveMovementPipeline({
    context: room,
    combatant: mover,
    path,
    availableBudgetFeet: budget,
    initialContext: initialContext ?? { normalDiagonalStepsThisTurn: room.currentTurn.normalDiagonalStepsThisTurn }
  });
  assert.equal(result.kind, "ready", "fixture debe producir un resultado ready");
  return result;
}

// --- 1-8: Commit exitoso y evidencia observable ---

test("Movement Commit: Resolution valida produce kind 'committed'", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "committed");
});

test("Movement Commit: actualiza correctamente la posicion", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }, { x: 3, y: 1, zFeet: 0 }]);

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.deepEqual(mover.position, { x: 3, y: 1, zFeet: 0 });
  assert.deepEqual(result.finalPosition, { x: 3, y: 1, zFeet: 0 });
});

test("Movement Commit: actualiza correctamente movementUsedFeet", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }, { x: 3, y: 1, zFeet: 0 }]);

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(room.currentTurn.movementUsedFeet, 10);
  assert.equal(result.movementUsedFeetAfter, 10);
});

test("Movement Commit: actualiza correctamente distanceMovedFeet", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }, { x: 3, y: 1, zFeet: 0 }]);

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(mover.stats.distanceMovedFeet, 10);
  assert.equal(result.distanceMovedFeet, 10);
});

test("Movement Commit: persiste correctamente resultingDiagonalCount (recibido de Resolution, no recalculado)", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 0, 0);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 1, y: 1, zFeet: 0 }, { x: 2, y: 2, zFeet: 0 }]);

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(resolution.projectedContext.normalDiagonalStepsThisTurn, 2);
  assert.equal(result.resultingDiagonalCount, 2);
  assert.equal(room.currentTurn.normalDiagonalStepsThisTurn, 2);
});

test("Movement Commit: consume el spatialMode final del ultimo Step", () => {
  const room = setupRoom(6, 2);
  room.board.narrowCells = ["1,0", "2,0"];
  room.board.impassableCells = ["1,1", "2,1"];
  const large = createCombatant("large1", 0, 0, "large");
  room.combatants.push(large);
  const preconditions = preconditionsFor(room, large);
  const resolution = resolveReady(room, large, [{ x: 1, y: 0, zFeet: 0 }]);

  const result = commitMovementResolution({ room, combatant: large, resolution, preconditions });

  assert.equal(resolution.steps[0].spatialMode, "squeezing");
  assert.equal(result.finalSpatialMode, "squeezing");
  assert.equal(room.effectInstances.some((i) => i.effectId === "srd_squeezing" && i.targets.includes("large1")), true);
});

test("Movement Commit: consume squeezingAxis desde el ultimo Step sin recalcularlo", () => {
  const room = setupRoom(6, 2);
  room.board.narrowCells = ["1,0", "2,0"];
  room.board.impassableCells = ["1,1", "2,1"];
  const large = createCombatant("large1", 0, 0, "large");
  room.combatants.push(large);
  const preconditions = preconditionsFor(room, large);
  const resolution = resolveReady(room, large, [{ x: 1, y: 0, zFeet: 0 }]);

  const result = commitMovementResolution({ room, combatant: large, resolution, preconditions });

  assert.equal(resolution.steps[0].squeezingAxis, "horizontal");
  assert.equal(result.squeezingAxis, "horizontal");
});

test("Movement Commit: ruta con multiples Steps se aplica completa", () => {
  const room = setupRoom(6, 6);
  const mover = createCombatant("c1", 0, 0);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [
    { x: 1, y: 0, zFeet: 0 },
    { x: 2, y: 1, zFeet: 0 },
    { x: 3, y: 2, zFeet: 0 }
  ]);

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "committed");
  assert.deepEqual(mover.position, { x: 3, y: 2, zFeet: 0 });
  assert.equal(room.currentTurn.movementUsedFeet, resolution.totalCostFeet);
});

// --- 9: Double Move / movimiento segmentado ---

test("Movement Commit: Double Move / movimiento segmentado no reinicia ni recalcula el contador diagonal", () => {
  const room = setupRoom(8, 8);
  const mover = createCombatant("c1", 0, 0);
  room.combatants.push(mover);

  // Primer segmento: una diagonal normal (contador 0 -> 1, 5 ft).
  const preconditions1 = preconditionsFor(room, mover);
  const resolution1 = resolveReady(room, mover, [{ x: 1, y: 1, zFeet: 0 }]);
  const result1 = commitMovementResolution({ room, combatant: mover, resolution: resolution1, preconditions: preconditions1 });
  assert.equal(result1.kind, "committed");
  assert.equal(room.currentTurn.normalDiagonalStepsThisTurn, 1);

  // Segundo segmento (ej. tras un ataque intercalado, mismo turno): otra diagonal normal.
  // Debe continuar la paridad del turno (1 -> 2, 10 ft), no reiniciar en 0.
  const preconditions2 = preconditionsFor(room, mover);
  const resolution2 = resolveReady(room, mover, [{ x: 2, y: 2, zFeet: 0 }]);
  const result2 = commitMovementResolution({ room, combatant: mover, resolution: resolution2, preconditions: preconditions2 });

  assert.equal(result2.kind, "committed");
  assert.equal(resolution2.steps[0].stepCostFeet, 10, "la paridad del turno continua: segunda diagonal normal cuesta 10 ft, no 5");
  assert.equal(room.currentTurn.normalDiagonalStepsThisTurn, 2);
  assert.equal(room.currentTurn.movementUsedFeet, 15);
});

// --- 10-14: Precondiciones autoritativas y atomicidad ---

test("Movement Commit: rechazado por posicion inicial obsoleta", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);

  // El estado autoritativo cambia DESPUES de calcular la Resolution (ej. otra accion movio
  // al combatiente entre la Resolution y el intento de Commit).
  mover.position = { x: 4, y: 4, zFeet: 0 };

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "rejected");
  assert.equal(result.rejectionCode, "stale-origin");
});

test("Movement Commit: rechazado por presupuesto (movementUsedFeet) obsoleto", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);

  room.currentTurn.movementUsedFeet = 25; // otra operacion consumio presupuesto mientras tanto

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "rejected");
  assert.equal(result.rejectionCode, "stale-movement-used");
});

test("Movement Commit: rechazado por contexto diagonal obsoleto", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 0, 0);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 1, y: 1, zFeet: 0 }]);

  room.currentTurn.normalDiagonalStepsThisTurn = 3; // otra ruta diagonal se aplico mientras tanto

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "rejected");
  assert.equal(result.rejectionCode, "stale-diagonal-context");
});

test("Movement Commit: ninguna mutacion ocurre cuando falla una precondicion", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);

  mover.position = { x: 4, y: 4, zFeet: 0 };
  const positionBefore = { ...mover.position };
  const movementUsedBefore = room.currentTurn.movementUsedFeet;
  const diagonalBefore = room.currentTurn.normalDiagonalStepsThisTurn;
  const distanceMovedBefore = mover.stats.distanceMovedFeet;
  const effectCountBefore = room.effectInstances.length;

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "rejected");
  assert.deepEqual(mover.position, positionBefore);
  assert.equal(room.currentTurn.movementUsedFeet, movementUsedBefore);
  assert.equal(room.currentTurn.normalDiagonalStepsThisTurn, diagonalBefore);
  assert.equal(mover.stats.distanceMovedFeet, distanceMovedBefore);
  assert.equal(room.effectInstances.length, effectCountBefore);
});

test("Movement Commit: no publica nada cuando falla una precondicion (no hay canal de publicacion en este modulo)", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);
  mover.position = { x: 4, y: 4, zFeet: 0 };

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "rejected");
  assert.equal("finalPosition" in result, false);
  assert.deepEqual(Object.keys(result).sort(), ["kind", "reason", "rejectionCode"]);
});

// --- 15-16: no recalcula Route Validation ni Movement Cost ---

test("Movement Commit: no vuelve a ejecutar Route Validation (confia en los Steps de la Resolution)", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  room.board.impassableCells = ["2,1"]; // la celda del Step esta bloqueada AHORA

  const fabricatedResolution = {
    kind: "ready",
    steps: [{
      stepIndex: 0,
      position: { x: 2, y: 1, zFeet: 0 },
      occupiedCells: [{ x: 2, y: 1, zFeet: 0 }],
      spatialMode: "natural",
      isDifficultTerrain: false,
      stepCostFeet: 5,
      cumulativeCostFeet: 5,
      resultingContext: { normalDiagonalStepsThisTurn: 0 }
    }],
    costAssessment: { totalCostFeet: 5, resultingContext: { normalDiagonalStepsThisTurn: 0 }, steps: [] },
    totalCostFeet: 5,
    initialContext: { normalDiagonalStepsThisTurn: 0 },
    projectedContext: { normalDiagonalStepsThisTurn: 0 },
    finalPosition: { x: 2, y: 1, zFeet: 0 },
    availableBudgetFeet: 100,
    remainingBudgetFeet: 95
  };

  const result = commitMovementResolution({
    room,
    combatant: mover,
    resolution: fabricatedResolution,
    preconditions: preconditionsFor(room, mover)
  });

  assert.equal(result.kind, "committed", "el Commit no revalida geometria: acepta una Resolution fabricada aunque el tablero actual bloquee esa celda");
  assert.deepEqual(mover.position, { x: 2, y: 1, zFeet: 0 });
});

test("Movement Commit: no vuelve a ejecutar Movement Cost (aplica totalCostFeet de la Resolution tal cual)", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 0, 0);
  room.combatants.push(mover);

  const fabricatedResolution = {
    kind: "ready",
    steps: [{
      stepIndex: 0,
      position: { x: 1, y: 0, zFeet: 0 },
      occupiedCells: [{ x: 1, y: 0, zFeet: 0 }],
      spatialMode: "natural",
      isDifficultTerrain: false,
      stepCostFeet: 999,
      cumulativeCostFeet: 999,
      resultingContext: { normalDiagonalStepsThisTurn: 0 }
    }],
    costAssessment: { totalCostFeet: 999, resultingContext: { normalDiagonalStepsThisTurn: 0 }, steps: [] },
    totalCostFeet: 999,
    initialContext: { normalDiagonalStepsThisTurn: 0 },
    projectedContext: { normalDiagonalStepsThisTurn: 0 },
    finalPosition: { x: 1, y: 0, zFeet: 0 },
    availableBudgetFeet: 1000,
    remainingBudgetFeet: 1
  };

  const result = commitMovementResolution({
    room,
    combatant: mover,
    resolution: fabricatedResolution,
    preconditions: preconditionsFor(room, mover)
  });

  assert.equal(result.kind, "committed");
  assert.equal(result.distanceMovedFeet, 999, "un Step ortogonal real costaria 5 ft; 999 confirma que el Commit no recalcula el coste");
  assert.equal(room.currentTurn.movementUsedFeet, 999);
  assert.equal(mover.stats.distanceMovedFeet, 999);
});

// --- 17: pureza de inputs no mutados fuera de lo autorizado ---

test("Movement Commit: deep-freeze de resolution/preconditions detecta que no se mutan esos inputs", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  const preconditions = deepFreeze(preconditionsFor(room, mover));
  const resolution = deepFreeze(resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]));

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "committed");
  assert.deepEqual(preconditions, { expectedOrigin: { x: 1, y: 1, zFeet: 0 }, expectedMovementUsedFeet: 0, expectedDiagonalContext: { normalDiagonalStepsThisTurn: 0 } });
  assert.equal(resolution.totalCostFeet, 5);
});
