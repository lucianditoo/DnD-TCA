import test from "node:test";
import assert from "node:assert/strict";
import { validateRouteLegality } from "../packages/shared/dist/index.js";
import { structuredSnapshotFields } from "./test-utils.mjs";

function setupBoard(width, height) {
  return {
    board: { width, height, cellSizeFeet: 5, impassableCells: [] },
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
    stats: {},
    abilities: [],
    buffs: []
  };
}

test("validateRouteLegality: ruta valida (1 paso)", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);
  
  const result = validateRouteLegality(context, mover, [{ x: 2, y: 1, zFeet: 0 }]);
  
  assert.equal(result.isLegal, true);
  if (result.isLegal) {
    assert.equal(result.steps.length, 1);
    assert.deepEqual(result.steps[0].position, { x: 2, y: 1, zFeet: 0 });
    assert.equal(result.steps[0].spatialMode, "natural");
  }
});

test("validateRouteLegality: ruta valida (varios pasos)", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);
  
  const result = validateRouteLegality(context, mover, [
    { x: 2, y: 1, zFeet: 0 },
    { x: 2, y: 2, zFeet: 0 },
    { x: 3, y: 3, zFeet: 0 }
  ]);
  
  assert.equal(result.isLegal, true);
  if (result.isLegal) {
    assert.equal(result.steps.length, 3);
  }
});

test("validateRouteLegality: discontinuidad en la ruta (salto)", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);
  
  const result = validateRouteLegality(context, mover, [
    { x: 3, y: 1, zFeet: 0 } // Salto de 2 casillas
  ]);
  
  assert.equal(result.isLegal, false);
  if (!result.isLegal) {
    assert.equal(result.failedStepIndex, 0);
    assert.match(result.error, /ruta debe avanzar de a una casilla adyacente/);
  }
});

test("validateRouteLegality: paso nulo (permanecer en la misma casilla)", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);
  
  const result = validateRouteLegality(context, mover, [
    { x: 1, y: 1, zFeet: 0 }
  ]);
  
  assert.equal(result.isLegal, false);
  if (!result.isLegal) {
    assert.match(result.error, /ruta debe avanzar de a una casilla adyacente/);
  }
});

test("validateRouteLegality: fuera del tablero", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 4, 4);
  context.combatants.push(mover);
  
  const result = validateRouteLegality(context, mover, [
    { x: 5, y: 4, zFeet: 0 }
  ]);
  
  assert.equal(result.isLegal, false);
  if (!result.isLegal) {
    assert.match(result.error, /ruta sale del tablero/);
  }
});

test("validateRouteLegality: impassableCells bloquea movimiento", () => {
  const context = setupBoard(5, 5);
  context.board.impassableCells = ["2,1"];
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);
  
  const result = validateRouteLegality(context, mover, [
    { x: 2, y: 1, zFeet: 0 }
  ]);
  
  assert.equal(result.isLegal, false);
  if (!result.isLegal) {
    assert.match(result.error, /intransitable/);
  }
});

test("validateRouteLegality: aliado consciente (puede atravesar pero no terminar)", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1, "medium", "player");
  const ally = createCombatant("ally", 2, 1, "medium", "player"); // Aliado consciente
  context.combatants.push(mover, ally);
  
  // Tratar de terminar sobre el aliado
  const resultEnd = validateRouteLegality(context, mover, [
    { x: 2, y: 1, zFeet: 0 }
  ]);
  assert.equal(resultEnd.isLegal, false, "No puede terminar sobre un aliado consciente");
  
  // Tratar de atravesar al aliado
  const resultPass = validateRouteLegality(context, mover, [
    { x: 2, y: 1, zFeet: 0 },
    { x: 3, y: 1, zFeet: 0 }
  ]);
  assert.equal(resultPass.isLegal, true, "Puede atravesar a un aliado consciente");
});

test("validateRouteLegality: enemigo consciente (no puede atravesar ni terminar sin acrobacia)", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1, "medium", "player");
  const enemy = createCombatant("enemy", 2, 1, "medium", "monster"); // Enemigo consciente
  context.combatants.push(mover, enemy);
  
  // Atraviesa sin acrobacia
  const resultPass = validateRouteLegality(context, mover, [
    { x: 2, y: 1, zFeet: 0 },
    { x: 3, y: 1, zFeet: 0 }
  ]);
  assert.equal(resultPass.isLegal, false);
  if (!resultPass.isLegal) assert.match(resultPass.error, /enemigo/);
  
  // Atraviesa con acrobacia
  const resultAcro = validateRouteLegality(context, mover, [
    { x: 2, y: 1, zFeet: 0 },
    { x: 3, y: 1, zFeet: 0 }
  ], true);
  assert.equal(resultAcro.isLegal, true);
});

test("validateRouteLegality: helpless (dying/stable) (puede atravesar y terminar)", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1, "medium", "player");
  const helplessEnemy = createCombatant("enemy", 2, 1, "medium", "monster", "dying");
  context.combatants.push(mover, helplessEnemy);
  
  // Terminar sobre
  const resultEnd = validateRouteLegality(context, mover, [
    { x: 2, y: 1, zFeet: 0 }
  ]);
  assert.equal(resultEnd.isLegal, true);
});

test("validateRouteLegality: esquinas prohibidas", () => {
  const context = setupBoard(5, 5);
  // Bloquea {2, 1}
  context.board.impassableCells = ["2,1"];
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);
  
  // Diagonal de {1,1} a {2,2} pasando cerca del muro {2,1}
  // En isCornerAnchorBlockedByTerrain, las anclas son {2,1} y {1,2}
  const result = validateRouteLegality(context, mover, [
    { x: 2, y: 2, zFeet: 0 }
  ]);
  
  assert.equal(result.isLegal, false);
  if (!result.isLegal) {
    assert.match(result.error, /esquina bloqueada/);
  }
});
