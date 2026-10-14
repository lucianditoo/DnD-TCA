import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveMovementPipeline,
  commitMovementResolution,
  createMovementStateFingerprint
} from "../packages/shared/dist/index.js";
import { structuredSnapshotFields } from "./test-utils.mjs";

function condition(effectId, targetId = "c1") {
  return {
    instanceId: effectId + "-instance", effectId, targets: [targetId],
    source: { type: "system" }, duration: { type: "permanent" },
    appliedAtEvent: { type: "ActionResolved", combatantId: targetId, round: 1 }
  };
}

function assertRejectedWithoutMutation(room, combatant, resolution, preconditions, code) {
  const before = structuredClone(room);
  const actorBefore = structuredClone(combatant);
  const result = commitMovementResolution({ room, combatant, resolution, preconditions });
  assert.equal(result.kind, "rejected");
  assert.equal(result.rejectionCode, code);
  assert.deepEqual(room, before);
  assert.deepEqual(combatant, actorBefore);
}

test("I5R2: actor provenance rejects A resolution on B despite coherent B preconditions", () => {
  const room = setupRoom(5, 5);
  const a = createCombatant("a", 1, 1);
  const b = createCombatant("b", 1, 1);
  room.combatants.push(a, b);
  preconditionsFor(room, a);
  const resolution = resolveReady(room, a, [{ x: 2, y: 1, zFeet: 0 }]);
  const preconditions = preconditionsFor(room, b);
  assert.equal(resolution.combatantId, "a");
  assertRejectedWithoutMutation(room, b, resolution, preconditions, "invalid-actor");
});

test("I5R2: detached clone with identical ID cannot receive a commit", () => {
  const room = setupRoom(5, 5);
  const a = createCombatant("c1", 1, 1);
  room.combatants.push(a);
  const preconditions = preconditionsFor(room, a);
  const resolution = resolveReady(room, a, [{ x: 2, y: 1, zFeet: 0 }]);
  assertRejectedWithoutMutation(room, structuredClone(a), resolution, preconditions, "invalid-actor");
});

test("I5R2: removed actor cannot receive a commit", () => {
  const room = setupRoom(5, 5);
  const a = createCombatant("c1", 1, 1);
  room.combatants.push(a);
  const preconditions = preconditionsFor(room, a);
  const resolution = resolveReady(room, a, [{ x: 2, y: 1, zFeet: 0 }]);
  room.combatants = [];
  assertRejectedWithoutMutation(room, a, resolution, preconditions, "invalid-actor");
});

for (const effectId of ["srd_entangled", "srd_exhausted", "srd_blinded", "srd_paralyzed", "srd_grappling"]) {
  for (const removing of [false, true]) {
    test("I5R2: stale mobility on " + (removing ? "removing " : "applying ") + effectId, () => {
      const room = setupRoom(5, 5);
      const mover = createCombatant("c1", 1, 1);
      room.combatants.push(mover);
      if (removing) room.effectInstances.push(condition(effectId));
      const preconditions = preconditionsFor(room, mover);
      // Budget remains externally supplied; I5R2 verifies source freshness,
      // not action eligibility or a new production movement policy.
      const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);
      room.effectInstances = removing ? [] : [condition(effectId)];
      assertRejectedWithoutMutation(room, mover, resolution, preconditions, "stale-rules-state");
    });
  }
}

for (const [name, mutate] of [
  ["base speed", (c) => { c.baseSpeedFeet = 20; }],
  ["armor", (c) => {
    c.inventory.push({ itemId: "armor", catalogId: "full_plate" });
    c.equipmentSlots.armorItemId = "armor";
  }],
  ["buff speed", (c) => { c.buffs.push({ id: "speed", speedBonusFeet: 10 }); }],
  ["intrinsic prohibition", (c) => { c.ruleTraits.push("CANNOT_MOVE"); }]
]) {
  test("I5R2: stale movement source " + name, () => {
    const room = setupRoom(5, 5);
    const mover = createCombatant("c1", 1, 1);
    room.combatants.push(mover);
    const preconditions = preconditionsFor(room, mover);
    const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);
    mutate(mover);
    assertRejectedWithoutMutation(room, mover, resolution, preconditions, "stale-rules-state");
  });
}

test("I5R2: equivalent unordered effects/targets/equipment/buffs produce the same fingerprint", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover, createCombatant("other", 4, 4));
  room.effectInstances = [condition("srd_entangled"), condition("srd_exhausted")];
  room.effectInstances[0].targets.push("other");
  mover.buffs = [{ speedBonusFeet: 5 }, { speedBonusFeet: 10 }];
  const copy = structuredClone(room);
  copy.combatants.reverse();
  copy.effectInstances.reverse();
  copy.effectInstances.forEach(e => e.targets.reverse());
  const actor = copy.combatants.find(c => c.id === mover.id);
  actor.inventory.reverse();
  actor.buffs.reverse();
  deepFreeze(room);
  deepFreeze(copy);
  assert.equal(createMovementStateFingerprint(room, mover), createMovementStateFingerprint(copy, actor));
});

test("I5R2: cosmetics and unrelated effects do not stale a valid commit", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);
  mover.name = "new label";
  mover.icon = "new icon";
  room.effectInstances.push(condition("srd_prone"));
  room.log = [{ message: "cosmetic log" }];
  assert.equal(commitMovementResolution({ room, combatant: mover, resolution, preconditions }).kind, "committed");
});

test("I5R2: insufficient-budget preserves actor and detached initial diagonal evidence", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  const initialContext = { normalDiagonalStepsThisTurn: 0 };
  const result = resolveMovementPipeline({
    context: room, combatant: mover, path: [{ x: 2, y: 1, zFeet: 0 }],
    availableBudgetFeet: 0, initialContext
  });
  assert.equal(result.kind, "insufficient-budget");
  assert.equal(result.combatantId, mover.id);
  initialContext.normalDiagonalStepsThisTurn = 9;
  assert.equal(result.initialContext.normalDiagonalStepsThisTurn, 0);
});

function setupRoom(width, height) {
  return {
    round: 1,
    board: { width, height, cellSizeFeet: 5, impassableCells: [], difficultTerrainCells: [] },
    combatants: [],
    effectInstances: [],
    currentTurn: {
      combatantId: "c1",
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
  room.currentTurn.combatantId = combatant.id;
  return {
    expectedTurnCombatantId: combatant.id,
    expectedRound: room.round,
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
  const fingerprint = createMovementStateFingerprint(room, mover);

  // La celda (3,3) no es adyacente a (1,1); Route Validation la rechazaria, pero Commit confia en la Resolution
  const fabricatedResolution = {
    kind: "ready",
    combatantId: mover.id,
    steps: [{
      stepIndex: 0,
      position: { x: 3, y: 3, zFeet: 0 },
      occupiedCells: [{ x: 3, y: 3, zFeet: 0 }],
      spatialMode: "natural",
      isDifficultTerrain: false,
      stepCostFeet: 5,
      stepBaseRouteCostFeet: 5,
      cumulativeCostFeet: 5,
      cumulativeBaseRouteCostFeet: 5,
      resultingContext: { normalDiagonalStepsThisTurn: 0 }
    }],
    costAssessment: { totalCostFeet: 5, totalBaseRouteCostFeet: 5, resultingContext: { normalDiagonalStepsThisTurn: 0 }, steps: [] },
    totalCostFeet: 5,
    totalBaseRouteCostFeet: 5,
    initialContext: { normalDiagonalStepsThisTurn: 0 },
    projectedContext: { normalDiagonalStepsThisTurn: 0 },
    finalPosition: { x: 3, y: 3, zFeet: 0 },
    availableBudgetFeet: 100,
    remainingBudgetFeet: 95,
    rulesStateFingerprint: fingerprint
  };

  const result = commitMovementResolution({
    room,
    combatant: mover,
    resolution: fabricatedResolution,
    preconditions: preconditionsFor(room, mover)
  });

  assert.equal(result.kind, "committed", "el Commit no revalida geometria: acepta una Resolution fabricada sin re-ejecutar Route Validation");
  assert.deepEqual(mover.position, { x: 3, y: 3, zFeet: 0 });
});

test("Movement Commit: no vuelve a ejecutar Movement Cost (aplica totalCostFeet de la Resolution tal cual)", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 0, 0);
  room.combatants.push(mover);
  const fingerprint = createMovementStateFingerprint(room, mover);

  const fabricatedResolution = {
    kind: "ready",
    combatantId: mover.id,
    steps: [{
      stepIndex: 0,
      position: { x: 1, y: 0, zFeet: 0 },
      occupiedCells: [{ x: 1, y: 0, zFeet: 0 }],
      spatialMode: "natural",
      isDifficultTerrain: false,
      stepCostFeet: 999,
      stepBaseRouteCostFeet: 999,
      cumulativeCostFeet: 999,
      cumulativeBaseRouteCostFeet: 999,
      resultingContext: { normalDiagonalStepsThisTurn: 0 }
    }],
    costAssessment: { totalCostFeet: 999, totalBaseRouteCostFeet: 999, resultingContext: { normalDiagonalStepsThisTurn: 0 }, steps: [] },
    totalCostFeet: 999,
    totalBaseRouteCostFeet: 999,
    initialContext: { normalDiagonalStepsThisTurn: 0 },
    projectedContext: { normalDiagonalStepsThisTurn: 0 },
    finalPosition: { x: 1, y: 0, zFeet: 0 },
    availableBudgetFeet: 1000,
    remainingBudgetFeet: 1,
    rulesStateFingerprint: fingerprint
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
  assert.deepEqual(preconditions, {
    expectedTurnCombatantId: "c1",
    expectedRound: 1,
    expectedOrigin: { x: 1, y: 1, zFeet: 0 },
    expectedMovementUsedFeet: 0,
    expectedDiagonalContext: { normalDiagonalStepsThisTurn: 0 }
  });
  assert.equal(resolution.totalCostFeet, 5);
});

// --- Sprint D-1B-I5R1: Stale Resolution, Identidad de Turno, Ronda y Fingerprinting ---

test("Movement Commit (I5R1): rechazado por stale-turn si cambio el turno a otro combatiente", () => {
  const room = setupRoom(5, 5);
  const moverA = createCombatant("c1", 1, 1);
  const moverB = createCombatant("c2", 3, 3);
  room.combatants.push(moverA, moverB);
  room.currentTurn.combatantId = "c1";

  const preconditions = preconditionsFor(room, moverA);
  const resolution = resolveReady(room, moverA, [{ x: 2, y: 1, zFeet: 0 }]);

  // Cambia el turno activo a c2
  room.currentTurn.combatantId = "c2";

  const result = commitMovementResolution({ room, combatant: moverA, resolution, preconditions });

  assert.equal(result.kind, "rejected");
  assert.equal(result.rejectionCode, "stale-turn");
});

test("Movement Commit (I5R1): rechazado por invalid-actor si se intenta commitear un combatiente ajeno al turno", () => {
  const room = setupRoom(5, 5);
  const moverA = createCombatant("c1", 1, 1);
  const moverB = createCombatant("c2", 1, 1);
  room.combatants.push(moverA, moverB);
  room.currentTurn.combatantId = "c1";

  const preconditions = preconditionsFor(room, moverA);
  const resolution = resolveReady(room, moverA, [{ x: 2, y: 1, zFeet: 0 }]);

  // Se pasa moverB en lugar de moverA
  const result = commitMovementResolution({ room, combatant: moverB, resolution, preconditions });

  assert.equal(result.kind, "rejected");
  assert.equal(result.rejectionCode, "invalid-actor");
});

test("Movement Commit (I5R1): rechazado por stale-round si el combate avanzo de ronda (ciclo de ronda)", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);
  room.round = 1;

  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);

  // Avanza la ronda y vuelve a ser el turno de c1 con posicion y contadores en 0
  room.round = 2;

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "rejected");
  assert.equal(result.rejectionCode, "stale-round");
});

test("Movement Commit (I5R1): rechazado por stale-rules-state si cambio el tablero entre resolucion y commit", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);

  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);

  // Aparece un obstaculo en el tablero
  room.board.impassableCells = ["3,3"];

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "rejected");
  assert.equal(result.rejectionCode, "stale-rules-state");
});

test("Movement Commit (I5R1): rechazado por stale-rules-state si otro combatiente se movio", () => {
  const room = setupRoom(5, 5);
  const mover = createCombatant("c1", 1, 1);
  const other = createCombatant("c2", 4, 4);
  room.combatants.push(mover, other);

  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);

  // Otro combatiente cambia de posicion
  other.position = { x: 4, y: 3, zFeet: 0 };

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "rejected");
  assert.equal(result.rejectionCode, "stale-rules-state");
});

test("Movement Commit (I5R1): separa totalCostFeet (movementUsedFeet) de totalBaseRouteCostFeet (distanceMovedFeet)", () => {
  const room = setupRoom(5, 5);
  room.board.difficultTerrainCells = ["2,1"];
  const mover = createCombatant("c1", 1, 1);
  room.combatants.push(mover);

  const preconditions = preconditionsFor(room, mover);
  const resolution = resolveReady(room, mover, [{ x: 2, y: 1, zFeet: 0 }]); // ortogonal DT: base 5, cost 10

  assert.equal(resolution.totalCostFeet, 10);
  assert.equal(resolution.totalBaseRouteCostFeet, 5);

  const result = commitMovementResolution({ room, combatant: mover, resolution, preconditions });

  assert.equal(result.kind, "committed");
  assert.equal(room.currentTurn.movementUsedFeet, 10, "presupuesto consumido se incrementa en totalCostFeet (10)");
  assert.equal(mover.stats.distanceMovedFeet, 5, "recorrido fisico se incrementa en totalBaseRouteCostFeet (5)");
  assert.equal(result.distanceMovedFeet, 5);
});

test("Movement Commit (I5R1): createMovementStateFingerprint es canonico, determinista y portable", () => {
  const roomA = setupRoom(5, 5);
  roomA.board.impassableCells = ["2,1", "1,2"];
  roomA.combatants.push(createCombatant("b", 1, 1), createCombatant("a", 2, 2));

  const roomB = setupRoom(5, 5);
  // Mismo estado con arrays en orden inverso
  roomB.board.impassableCells = ["1,2", "2,1"];
  roomB.combatants.push(createCombatant("a", 2, 2), createCombatant("b", 1, 1));

  const fpA = createMovementStateFingerprint(roomA, roomA.combatants.find(c => c.id === "a"));
  const fpB = createMovementStateFingerprint(roomB, roomB.combatants.find(c => c.id === "a"));

  assert.equal(fpA, fpB, "snapshots semanticamente equivalentes producen identico fingerprint");
});
