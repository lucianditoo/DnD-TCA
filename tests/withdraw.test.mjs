import test from "node:test";
import assert from "node:assert/strict";
import { findTriggeredOpportunityAttacksForPath, getCombatantOccupiedCells, footprintCellKey, Rules } from "../packages/shared/dist/index.js";
import { makeTestCombatant, makeTestRoom, inventoryEquipment } from "./test-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// MOVE-WITHDRAW — capa pura compartida (NDD Rev. 3 §5).
// Exención opcional de celdas de salida en findTriggeredOpportunityAttacksForPath:
// abandonar la huella inicial no provoca; posiciones posteriores provocan normal.
// Default neutro: los call sites existentes no cambian de comportamiento.
// ─────────────────────────────────────────────────────────────────────────────

function makeMover(overrides = {}) {
  return makeTestCombatant({
    id: "mover", name: "Retirante", type: "player",
    position: { x: 2, y: 2, zFeet: 0 },
    ...inventoryEquipment("longsword"),
    ...overrides
  });
}

function makeEnemy(overrides = {}) {
  return makeTestCombatant({
    id: "enemy-1", name: "Enemigo", type: "enemy", controller: "gm",
    position: { x: 1, y: 2, zFeet: 0 },
    ...inventoryEquipment("longsword"),
    ...overrides
  });
}

function initialFootprintKeys(room, combatant) {
  return new Set(getCombatantOccupiedCells(combatant, room).map(footprintCellKey));
}

const alwaysCanAoO = () => true;

test("W-S1: exencion de huella inicial — salir de la celda amenazada no provoca", () => {
  const mover = makeMover();
  const enemy = makeEnemy();
  const room = makeTestRoom({ combatants: [mover, enemy] });
  const path = [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }, { x: 5, y: 2, zFeet: 0 }];
  const exempt = initialFootprintKeys(room, mover);

  const withExemption = findTriggeredOpportunityAttacksForPath(room, mover, path, 15, alwaysCanAoO, false, exempt);
  assert.equal(withExemption.length, 0, "Solo la huella inicial estaba amenazada: con exencion, cero AdO.");
});

test("W-S2: paso posterior amenazado SI provoca (la exencion no es global)", () => {
  const mover = makeMover();
  // Enemigo adyacente a la CASILLA (4,2) del camino, lejos de la huella inicial (2,2).
  const enemy = makeEnemy({ position: { x: 4, y: 1, zFeet: 0 } });
  const room = makeTestRoom({ combatants: [mover, enemy] });
  const path = [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }, { x: 5, y: 2, zFeet: 0 }];
  const exempt = initialFootprintKeys(room, mover);

  const result = findTriggeredOpportunityAttacksForPath(room, mover, path, 15, alwaysCanAoO, false, exempt);
  assert.equal(result.length, 1, "Abandonar (4,2), amenazada y fuera de la huella inicial, provoca normal.");
  assert.equal(result[0].attackerId, "enemy-1");
});

test("W-S3: footprint Large — toda la huella inicial 2x2 queda exenta", () => {
  const mover = makeMover({ sizeCategory: "large", position: { x: 2, y: 2, zFeet: 0 } });
  // Enemigo adyacente a la celda (3,3) de la huella (no a la ancla).
  const enemy = makeEnemy({ position: { x: 4, y: 4, zFeet: 0 } });
  const room = makeTestRoom({ combatants: [mover, enemy] });
  const exempt = initialFootprintKeys(room, mover);
  assert.equal(exempt.size, 4, "La huella inicial Large debe tener 4 celdas.");
  // Se aleja del enemigo: solo abandona celdas de la huella inicial en el primer paso.
  const path = [{ x: 1, y: 1, zFeet: 0 }, { x: 0, y: 0, zFeet: 0 }];

  const result = findTriggeredOpportunityAttacksForPath(room, mover, path, 15, alwaysCanAoO, false, exempt);
  assert.equal(result.length, 0, "Abandonar cualquier celda de la huella inicial (no solo la ancla) esta exento.");
});

test("W-S4: multiples reactores amenazando la huella inicial — todos exentos del disparo inicial", () => {
  const mover = makeMover();
  const e1 = makeEnemy({ id: "e1", position: { x: 1, y: 2, zFeet: 0 } });
  const e2 = makeEnemy({ id: "e2", position: { x: 2, y: 1, zFeet: 0 } });
  const e3 = makeEnemy({ id: "e3", position: { x: 1, y: 1, zFeet: 0 } });
  const room = makeTestRoom({ combatants: [mover, e1, e2, e3] });
  const path = [{ x: 3, y: 3, zFeet: 0 }, { x: 4, y: 4, zFeet: 0 }, { x: 5, y: 5, zFeet: 0 }];
  const exempt = initialFootprintKeys(room, mover);

  const result = findTriggeredOpportunityAttacksForPath(room, mover, path, 20, alwaysCanAoO, false, exempt);
  assert.equal(result.length, 0, "Los tres enemigos amenazaban solo la huella inicial: todos exentos.");
});

test("W-S5: arma con alcance (longspear) — amenaza a 10 ft sobre celdas posteriores provoca", () => {
  const mover = makeMover();
  // Lanza larga amenaza a 10 ft (no 5): desde (6,2) amenaza (4,2) pero no (5,2).
  const enemy = makeEnemy({ ...inventoryEquipment("longspear"), position: { x: 6, y: 2, zFeet: 0 } });
  const room = makeTestRoom({ combatants: [mover, enemy] });
  const path = [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }, { x: 4, y: 0, zFeet: 0 }];
  const exempt = initialFootprintKeys(room, mover);

  const result = findTriggeredOpportunityAttacksForPath(room, mover, path, 20, alwaysCanAoO, false, exempt);
  assert.equal(result.length, 1, "Abandonar (4,2), amenazada por alcance 10 ft y fuera de la huella inicial, provoca.");
});

test("W-S6: default neutro — sin el parametro, el comportamiento es identico al vigente", () => {
  const mover = makeMover();
  const enemy = makeEnemy();
  const room = makeTestRoom({ combatants: [mover, enemy] });
  const path = [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }, { x: 5, y: 2, zFeet: 0 }];

  const withoutParam = findTriggeredOpportunityAttacksForPath(room, mover, path, 15, alwaysCanAoO);
  assert.equal(withoutParam.length, 1, "Sin exencion, abandonar la casilla inicial amenazada provoca (comportamiento vigente).");
  const withEmptySet = findTriggeredOpportunityAttacksForPath(room, mover, path, 15, alwaysCanAoO, false, new Set());
  assert.equal(withEmptySet.length, 1, "Conjunto vacio = mismo comportamiento que sin parametro.");
});

test("W-S7: independencia del orden del snapshot", () => {
  const mover = makeMover();
  const e1 = makeEnemy({ id: "e1", position: { x: 1, y: 2, zFeet: 0 } });
  const e2 = makeEnemy({ id: "e2", position: { x: 4, y: 1, zFeet: 0 } });
  const path = [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }, { x: 5, y: 2, zFeet: 0 }];

  const roomA = makeTestRoom({ combatants: [mover, e1, e2] });
  const roomB = makeTestRoom({ combatants: [e2, e1, mover] });
  const exemptA = initialFootprintKeys(roomA, mover);
  const exemptB = initialFootprintKeys(roomB, mover);

  const a = findTriggeredOpportunityAttacksForPath(roomA, mover, path, 15, alwaysCanAoO, false, exemptA);
  const b = findTriggeredOpportunityAttacksForPath(roomB, mover, path, 15, alwaysCanAoO, false, exemptB);
  assert.deepEqual(a.map((o) => o.attackerId).sort(), b.map((o) => o.attackerId).sort());
  assert.equal(a.length, 1, "Solo e2 (amenaza celda posterior) dispara; e1 (huella inicial) exento.");
});

test("W-S8/W-S9: AOO-03 y Reflejos de Combate intactos — el gate del reactor decide, la exencion no lo toca", () => {
  const mover = makeMover();
  const enemy = makeEnemy({ position: { x: 4, y: 1, zFeet: 0 } });
  const room = makeTestRoom({ combatants: [mover, enemy] });
  const path = [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }, { x: 5, y: 2, zFeet: 0 }];
  const exempt = initialFootprintKeys(room, mover);

  // Reactor sin AdO disponibles (gate AOO-03 rechaza): cero AdO aunque la celda posterior provoque.
  const gated = findTriggeredOpportunityAttacksForPath(room, mover, path, 15, () => false, false, exempt);
  assert.equal(gated.length, 0, "El gate del reactor (canMakeOpportunityAttack) sigue mandando.");

  // El gate real de Combat Reflexes sigue funcionando via Rules.canMakeOpportunityAttack.
  const spent = makeEnemy({ position: { x: 4, y: 1, zFeet: 0 }, stats: { ...makeEnemy().stats, opportunityAttacksThisRound: 1 } });
  const roomSpent = makeTestRoom({ combatants: [mover, spent] });
  const realGate = findTriggeredOpportunityAttacksForPath(
    roomSpent, mover, path, 15,
    (c) => Rules.canMakeOpportunityAttack(roomSpent, c, mover.id), false, initialFootprintKeys(roomSpent, mover)
  );
  assert.equal(realGate.length, 0, "Sin Reflejos de Combate y con 1 AdO gastado, no reacciona (AOO-03).");
});
