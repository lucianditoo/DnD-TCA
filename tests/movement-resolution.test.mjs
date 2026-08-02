import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveMovementPipeline,
  calculatePathStepCostsFeet
} from "../packages/shared/dist/index.js";
import { structuredSnapshotFields } from "./test-utils.mjs";

function setupBoard(width, height) {
  return {
    board: { width, height, cellSizeFeet: 5, impassableCells: [], difficultTerrainCells: [] },
    combatants: [],
    effectInstances: []
  };
}

function createCombatant(id, x, y, size = "medium", type = "player", lifeStatus = "conscious") {
  return {
    id,
    name: id,
    type,
    position: { x, y, zFeet: 0 },
    hpCurrent: lifeStatus === "dead" ? -20 : lifeStatus === "dying" ? -1 : 10,
    hpMax: 20,
    size,
    isStable: lifeStatus === "stable",
    ...structuredSnapshotFields(10),
    sizeCategory: size,
    stats: {},
    abilities: [],
    buffs: []
  };
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const zeroContext = () => ({ normalDiagonalStepsThisTurn: 0 });

test("Movement Resolution: ruta legal con presupuesto exacto -> ready", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);

  const result = resolveMovementPipeline({
    context,
    combatant: mover,
    path: [{ x: 2, y: 1, zFeet: 0 }, { x: 3, y: 1, zFeet: 0 }],
    availableBudgetFeet: 10,
    initialContext: zeroContext()
  });

  assert.equal(result.kind, "ready");
  assert.equal(result.totalCostFeet, 10);
  assert.equal(result.remainingBudgetFeet, 0);
  assert.deepEqual(result.finalPosition, { x: 3, y: 1, zFeet: 0 });
  assert.equal(result.steps.length, 2);
});

test("Movement Resolution: ruta ilegal corta el pipeline sin assessment ejecutable", () => {
  const context = setupBoard(5, 5);
  context.board.impassableCells = ["2,1"];
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);

  const result = resolveMovementPipeline({
    context,
    combatant: mover,
    path: [{ x: 2, y: 1, zFeet: 0 }],
    availableBudgetFeet: 100,
    initialContext: zeroContext()
  });

  assert.equal(result.kind, "illegal-route");
  assert.equal(result.failedStepIndex, 0);
  assert.match(result.reason, /intransitable/);
  assert.equal("steps" in result, false);
  assert.equal("costAssessment" in result, false);
});

test("Movement Resolution: ruta legal con presupuesto insuficiente conserva evidencia sin ejecutar", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);

  const result = resolveMovementPipeline({
    context,
    combatant: mover,
    path: [{ x: 2, y: 1, zFeet: 0 }, { x: 3, y: 1, zFeet: 0 }],
    availableBudgetFeet: 5,
    initialContext: zeroContext()
  });

  assert.equal(result.kind, "insufficient-budget");
  assert.equal(result.requiredCostFeet, 10);
  assert.equal(result.availableBudgetFeet, 5);
  assert.equal(result.steps.length, 2);
  assert.equal(result.costAssessment.totalCostFeet, 10);
  assert.deepEqual(result.finalPosition, { x: 3, y: 1, zFeet: 0 });
});

test("Movement Resolution: contexto diagonal inicial distinto de cero (contador 1 -> siguiente diagonal cuesta 10)", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);

  const result = resolveMovementPipeline({
    context,
    combatant: mover,
    path: [{ x: 2, y: 2, zFeet: 0 }],
    availableBudgetFeet: 100,
    initialContext: { normalDiagonalStepsThisTurn: 1 }
  });

  assert.equal(result.kind, "ready");
  assert.equal(result.totalCostFeet, 10);
  assert.equal(result.projectedContext.normalDiagonalStepsThisTurn, 2);
  assert.equal(result.steps[0].stepCostFeet, 10);
});

test("Movement Resolution: terreno dificil mixto - ortogonal 10, diagonal 15 sin alterar paridad, diagonal normal siguiente usa la paridad previa", () => {
  const context = setupBoard(6, 6);
  context.board.difficultTerrainCells = ["2,1", "3,2"];
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);

  const result = resolveMovementPipeline({
    context,
    combatant: mover,
    path: [
      { x: 2, y: 1, zFeet: 0 }, // ortogonal dificil: 10 ft
      { x: 3, y: 2, zFeet: 0 }, // diagonal dificil: 15 ft, no incrementa el contador
      { x: 4, y: 3, zFeet: 0 }  // diagonal normal: usa la paridad previa (0 -> 1, impar -> 5 ft)
    ],
    availableBudgetFeet: 100,
    initialContext: zeroContext()
  });

  assert.equal(result.kind, "ready");
  assert.equal(result.steps[0].isDifficultTerrain, true);
  assert.equal(result.steps[0].stepCostFeet, 10);
  assert.equal(result.steps[1].isDifficultTerrain, true);
  assert.equal(result.steps[1].stepCostFeet, 15);
  assert.equal(result.steps[1].resultingContext.normalDiagonalStepsThisTurn, 0);
  assert.equal(result.steps[2].isDifficultTerrain, false);
  assert.equal(result.steps[2].stepCostFeet, 5);
  assert.equal(result.steps[2].resultingContext.normalDiagonalStepsThisTurn, 1);
  assert.equal(result.totalCostFeet, 30);
});

test("Movement Resolution: footprint Large - una celda dificil bajo cualquier parte del footprint efectivo encarece el Step", () => {
  const context = setupBoard(6, 6);
  // Solo una de las cuatro celdas del footprint destino (3,2) es terreno dificil.
  context.board.difficultTerrainCells = ["3,2"];
  const large = createCombatant("large1", 1, 1, "large");
  context.combatants.push(large);

  const result = resolveMovementPipeline({
    context,
    combatant: large,
    path: [{ x: 2, y: 1, zFeet: 0 }],
    availableBudgetFeet: 100,
    initialContext: zeroContext()
  });

  assert.equal(result.kind, "ready");
  assert.equal(result.steps[0].isDifficultTerrain, true, "una sola celda dificil del footprint 2x2 basta para encarecer el Step completo");
  assert.equal(result.steps[0].stepCostFeet, 10);
  assert.deepEqual(result.steps[0].occupiedCells, [
    { x: 2, y: 1, zFeet: 0 },
    { x: 3, y: 1, zFeet: 0 },
    { x: 2, y: 2, zFeet: 0 },
    { x: 3, y: 2, zFeet: 0 }
  ]);
});

test("Movement Resolution: Squeezing - evalua terreno sobre el footprint efectivo proyectado y conserva spatialMode/squeezingAxis", () => {
  const context = setupBoard(6, 2);
  context.board.narrowCells = ["1,0", "2,0"];
  context.board.impassableCells = ["1,1", "2,1"];
  context.board.difficultTerrainCells = ["2,0"]; // solo una de las dos celdas del pasillo estrecho
  const large = createCombatant("large1", 0, 0, "large");
  context.combatants.push(large);

  const result = resolveMovementPipeline({
    context,
    combatant: large,
    path: [{ x: 1, y: 0, zFeet: 0 }],
    availableBudgetFeet: 100,
    initialContext: zeroContext()
  });

  assert.equal(result.kind, "ready");
  assert.equal(result.steps[0].spatialMode, "squeezing");
  assert.equal(result.steps[0].squeezingAxis, "horizontal");
  assert.deepEqual(result.steps[0].occupiedCells, [
    { x: 1, y: 0, zFeet: 0 },
    { x: 2, y: 0, zFeet: 0 }
  ]);
  assert.equal(result.steps[0].isDifficultTerrain, true, "el footprint efectivo de Squeezing (2 celdas), no el ancla, decide terreno dificil");
  assert.equal(result.steps[0].stepCostFeet, 10);
});

test("Movement Resolution: evidencia por Step coincide con coste individual, acumulado y total", () => {
  const context = setupBoard(6, 6);
  const mover = createCombatant("c1", 0, 0);
  context.combatants.push(mover);

  const result = resolveMovementPipeline({
    context,
    combatant: mover,
    path: [
      { x: 1, y: 1, zFeet: 0 },
      { x: 2, y: 2, zFeet: 0 },
      { x: 3, y: 2, zFeet: 0 }
    ],
    availableBudgetFeet: 100,
    initialContext: zeroContext()
  });

  assert.equal(result.kind, "ready");
  const sumOfStepCosts = result.steps.reduce((sum, s) => sum + s.stepCostFeet, 0);
  assert.equal(sumOfStepCosts, result.totalCostFeet);
  assert.equal(result.steps.at(-1).cumulativeCostFeet, result.totalCostFeet);
  assert.deepEqual(result.steps.at(-1).resultingContext, result.projectedContext);
});

test("Movement Resolution: pureza - no muta context/combatant/path/initialContext", () => {
  const context = setupBoard(5, 5);
  context.combatants.push(createCombatant("c1", 1, 1));
  const frozenContext = deepFreeze(context);
  const path = deepFreeze([{ x: 2, y: 1, zFeet: 0 }]);
  const initialContext = deepFreeze({ normalDiagonalStepsThisTurn: 0 });

  const result = resolveMovementPipeline({
    context: frozenContext,
    combatant: frozenContext.combatants[0],
    path,
    availableBudgetFeet: 100,
    initialContext
  });

  assert.equal(result.kind, "ready");
  assert.deepEqual(path, [{ x: 2, y: 1, zFeet: 0 }]);
  assert.deepEqual(initialContext, { normalDiagonalStepsThisTurn: 0 });
  assert.deepEqual(frozenContext.combatants[0].position, { x: 1, y: 1, zFeet: 0 });
});

// --- Equivalencias y divergencias frente al legacy (calculatePathStepCostsFeet) ---

test("Legacy bridge: equivalencia en ruta ortogonal simple", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);
  const path = [{ x: 2, y: 1, zFeet: 0 }, { x: 3, y: 1, zFeet: 0 }];

  const result = resolveMovementPipeline({
    context,
    combatant: mover,
    path,
    availableBudgetFeet: 100,
    initialContext: zeroContext()
  });
  const legacyCosts = calculatePathStepCostsFeet(mover.position, path, context);

  assert.equal(result.kind, "ready");
  assert.equal(result.totalCostFeet, legacyCosts.at(-1));
});

test("Legacy bridge: divergencia intencional conocida en diagonales dificiles consecutivas (15/15 normativo vs 15/20 legacy)", () => {
  const context = setupBoard(6, 6);
  context.board.difficultTerrainCells = ["2,2", "3,3"];
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);
  const path = [{ x: 2, y: 2, zFeet: 0 }, { x: 3, y: 3, zFeet: 0 }];

  const result = resolveMovementPipeline({
    context,
    combatant: mover,
    path,
    availableBudgetFeet: 100,
    initialContext: zeroContext()
  });
  const legacyCosts = calculatePathStepCostsFeet(mover.position, path, context);

  // Normativo (Capitulo 3.6 del NDD): cada diagonal dificil cuesta 15 ft constantes, sin
  // alternancia. 15 + 15 = 30.
  assert.equal(result.totalCostFeet, 30);
  // Legacy (calculatePathStepCostsFeet) conserva, sin corregir en este sprint, una
  // alternancia 15/20 para diagonales dificiles -- divergencia intencional y conocida,
  // documentada aqui, no corregida (fuera de alcance de D-1B-I4: "no modificar
  // validateMovePath").
  assert.equal(legacyCosts.at(-1), 35);
  assert.notEqual(result.totalCostFeet, legacyCosts.at(-1));
});

test("Legacy bridge: divergencia intencional por contexto diagonal acumulado del turno", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 0, 0);
  context.combatants.push(mover);
  const path = [{ x: 1, y: 1, zFeet: 0 }];

  // El resolver normativo recibe explicitamente el contador diagonal ya acumulado del
  // turno (ej. una porcion de movimiento previa ya ejecuto una diagonal normal).
  const result = resolveMovementPipeline({
    context,
    combatant: mover,
    path,
    availableBudgetFeet: 100,
    initialContext: { normalDiagonalStepsThisTurn: 1 }
  });
  // El calculador legacy no recibe ni acepta un contexto diagonal inicial: siempre
  // reinicia su contador local en 0 por invocacion, sin importar cuanto movimiento
  // diagonal ya ocurrio antes en el mismo turno -- divergencia intencional y conocida,
  // no corregida en este sprint.
  const legacyCosts = calculatePathStepCostsFeet(mover.position, path, context);

  assert.equal(result.totalCostFeet, 10, "normativo: contador 1 -> par -> 10 ft");
  assert.equal(legacyCosts.at(-1), 5, "legacy: siempre trata la primera diagonal de la llamada como impar -> 5 ft");
  assert.notEqual(result.totalCostFeet, legacyCosts.at(-1));
});
