import test from "node:test";
import assert from "node:assert/strict";
import { validateRouteLegality, validateMovePath } from "../packages/shared/dist/index.js";
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
    sizeCategory: size,
    stats: {},
    abilities: [],
    buffs: []
  };
}

/** Contexto extendido con `currentTurn`/`activeAttackThreat`, necesario únicamente para
 * `validateMovePath` (el orquestador legacy). `validateRouteLegality` nunca los lee. */
function setupMoveContext(width, height) {
  return {
    ...setupBoard(width, height),
    activeAttackThreat: null,
    currentTurn: {
      combatantId: "c1",
      movementUsedFeet: 0,
      usedFiveFootStep: false
    }
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

// --- Sprint D-1B-I3R1: cobertura directa de validateRouteLegality ---

test("validateRouteLegality: footprint Large (2x2) - ruta legal", () => {
  const context = setupBoard(6, 6);
  const large = createCombatant("large1", 1, 1, "large");
  context.combatants.push(large);

  const result = validateRouteLegality(context, large, [{ x: 2, y: 1, zFeet: 0 }]);

  assert.equal(result.isLegal, true, !result.isLegal ? result.error : undefined);
  if (result.isLegal) {
    assert.deepEqual(result.steps[0].occupiedCells, [
      { x: 2, y: 1, zFeet: 0 },
      { x: 3, y: 1, zFeet: 0 },
      { x: 2, y: 2, zFeet: 0 },
      { x: 3, y: 2, zFeet: 0 }
    ]);
    assert.equal(result.steps[0].spatialMode, "natural");
  }
});

test("validateRouteLegality: footprint Large (2x2) - una celda de la huella colisiona con obstaculo", () => {
  const context = setupBoard(6, 6);
  // Solo una de las cuatro celdas del footprint destino (3,2) es impasable.
  context.board.impassableCells = ["3,2"];
  const large = createCombatant("large1", 1, 1, "large");
  context.combatants.push(large);

  const result = validateRouteLegality(context, large, [{ x: 2, y: 1, zFeet: 0 }]);

  assert.equal(result.isLegal, false);
  if (!result.isLegal) {
    assert.match(result.error, /intransitable/);
  }
});

test("validateRouteLegality: footprint Large (2x2) - no puede terminar sobre huella ocupada por completo", () => {
  const context = setupBoard(6, 6);
  const large = createCombatant("large1", 1, 1, "large");
  // Un enemigo ocupa solo UNA de las cuatro celdas del footprint destino (2,1)-(3,2).
  const enemy = createCombatant("enemy1", 3, 2, "medium", "monster");
  context.combatants.push(large, enemy);

  const result = validateRouteLegality(context, large, [{ x: 2, y: 1, zFeet: 0 }]);

  assert.equal(result.isLegal, false, "La huella completa debe considerarse ocupada aunque el enemigo solo toque una celda.");
  if (!result.isLegal) {
    assert.match(result.error, /enemy1/);
  }
});

test("validateRouteLegality: Squeezing - proyecta spatialMode 'squeezing' y conserva squeezingAxis", () => {
  const context = setupBoard(6, 2);
  context.board.narrowCells = ["1,0", "2,0"];
  context.board.impassableCells = ["1,1", "2,1"];
  const large = createCombatant("large1", 0, 0, "large");
  context.combatants.push(large);

  const result = validateRouteLegality(context, large, [{ x: 1, y: 0, zFeet: 0 }]);

  assert.equal(result.isLegal, true, !result.isLegal ? result.error : undefined);
  if (result.isLegal) {
    assert.equal(result.steps[0].spatialMode, "squeezing");
    assert.equal(result.steps[0].squeezingAxis, "horizontal");
    assert.deepEqual(result.steps[0].occupiedCells, [
      { x: 1, y: 0, zFeet: 0 },
      { x: 2, y: 0, zFeet: 0 }
    ]);
  }
});

test("validateRouteLegality: Squeezing - rechaza cuando ninguna proyeccion (natural ni squeezing) es valida", () => {
  const context = setupBoard(6, 2);
  context.board.narrowCells = ["1,0", "2,0"];
  // Bloquea TAMBIEN la celda estrecha candidata (2,0): ni el 2x2 natural ni el pasillo
  // estrecho quedan disponibles.
  context.board.impassableCells = ["1,1", "2,1", "2,0"];
  const large = createCombatant("large1", 0, 0, "large");
  context.combatants.push(large);

  const result = validateRouteLegality(context, large, [{ x: 1, y: 0, zFeet: 0 }]);

  assert.equal(result.isLegal, false);
  if (!result.isLegal) {
    assert.match(result.error, /intransitable/);
  }
});

test("validateRouteLegality: repeticion de casilla - rechaza y reporta el Step fallido correcto", () => {
  const context = setupBoard(5, 5);
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);

  const result = validateRouteLegality(context, mover, [
    { x: 2, y: 1, zFeet: 0 },
    { x: 2, y: 2, zFeet: 0 },
    { x: 2, y: 1, zFeet: 0 } // revisita la primera casilla
  ]);

  assert.equal(result.isLegal, false);
  if (!result.isLegal) {
    assert.equal(result.failedStepIndex, 2);
    assert.match(result.error, /no puede pasar dos veces por la misma casilla/);
  }
});

// --- Bridge legacy: equivalencia observable validateRouteLegality <-> validateMovePath ---

test("Bridge legacy: ruta legal - ambos coinciden", () => {
  const context = setupMoveContext(5, 5);
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);
  const path = [{ x: 2, y: 1, zFeet: 0 }];

  const direct = validateRouteLegality(context, mover, path);
  const legacy = validateMovePath(context, mover, path, 30);

  assert.equal(direct.isLegal, true);
  assert.equal(legacy.ok, true, legacy.error);
  assert.deepEqual(legacy.value.steps[0].position, direct.steps[0].position);
  assert.deepEqual(legacy.value.steps[0].occupiedCells, direct.steps[0].occupiedCells);
  assert.equal(legacy.value.steps[0].spatialMode, direct.steps[0].spatialMode);
});

test("Bridge legacy: ruta bloqueada por obstaculo - ambos coinciden", () => {
  const context = setupMoveContext(5, 5);
  context.board.impassableCells = ["2,1"];
  const mover = createCombatant("c1", 1, 1);
  context.combatants.push(mover);
  const path = [{ x: 2, y: 1, zFeet: 0 }];

  const direct = validateRouteLegality(context, mover, path);
  const legacy = validateMovePath(context, mover, path, 30);

  assert.equal(direct.isLegal, false);
  assert.equal(legacy.ok, false);
  assert.match(legacy.error, /intransitable/);
});

test("Bridge legacy: ocupacion por enemigo consciente - ambos coinciden", () => {
  const context = setupMoveContext(5, 5);
  const mover = createCombatant("c1", 1, 1);
  const enemy = createCombatant("enemy1", 2, 1, "medium", "monster");
  context.combatants.push(mover, enemy);
  const path = [{ x: 2, y: 1, zFeet: 0 }];

  const direct = validateRouteLegality(context, mover, path);
  const legacy = validateMovePath(context, mover, path, 30);

  assert.equal(direct.isLegal, false);
  assert.equal(legacy.ok, false);
});

test("Bridge legacy: footprint Large efectivo - ambos coinciden", () => {
  const context = setupMoveContext(6, 6);
  context.board.impassableCells = ["3,2"];
  const large = createCombatant("large1", 1, 1, "large");
  context.combatants.push(large);
  const path = [{ x: 2, y: 1, zFeet: 0 }];

  const direct = validateRouteLegality(context, large, path);
  const legacy = validateMovePath(context, large, path, 30);

  assert.equal(direct.isLegal, false);
  assert.equal(legacy.ok, false);
  assert.match(legacy.error, /intransitable/);
});
