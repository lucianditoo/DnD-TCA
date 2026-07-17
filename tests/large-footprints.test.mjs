import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createEmptyRoom,
  distanceBetweenFootprintsFeet,
  distanceFeet,
  findTriggeredOpportunityAttacksForPath,
  getAttackContextModifiers,
  getCombatantOccupiedCells,
  isFlanking,
  validateMovePath
} from "../packages/shared/dist/index.js";
import { structuredSnapshotFields } from "./test-utils.mjs";

function combatant(id, type, position, overrides = {}) {
  return {
    id,
    name: id,
    type,
    controller: type === "enemy" ? "gm" : "player",
    hpCurrent: 20,
    hpMax: 20,
    isStable: false,
    ...structuredSnapshotFields(10),
    sizeCategory: "medium",
    position: { ...position, zFeet: position.zFeet ?? 0 },
    buffs: [],
    ...overrides
  };
}

test("Sprint 025 - Large Footprints V1", async (t) => {
  await t.test("Medium preserva una huella ordinaria de una casilla", () => {
    const room = createEmptyRoom("MEDIUM-CELLS");
    const medium = combatant("medium", "player", { x: 4, y: 5 });
    assert.deepEqual(getCombatantOccupiedCells(medium, room), [
      { x: 4, y: 5, zFeet: 0 }
    ]);
  });

  await t.test("Colossal reutiliza el pipeline elastico como bloque 6x6", () => {
    const room = createEmptyRoom("COLOSSAL-CELLS");
    const colossal = combatant("colossal", "enemy", { x: 1, y: 2 }, { sizeCategory: "colossal" });
    const cells = getCombatantOccupiedCells(colossal, room);
    assert.equal(cells.length, 36);
    assert.deepEqual(cells[0], { x: 1, y: 2, zFeet: 0 });
    assert.deepEqual(cells.at(-1), { x: 6, y: 7, zFeet: 0 });
  });

  await t.test("la distancia O(1) equivale al oraculo exhaustivo multicelda", () => {
    const room = createEmptyRoom("FOOTPRINT-DISTANCE");
    const pairs = [
      [combatant("m1", "player", { x: 0, y: 0 }), combatant("m2", "enemy", { x: 5, y: 3 })],
      [combatant("m", "player", { x: 1, y: 1 }), combatant("l", "enemy", { x: 4, y: 2 }, { sizeCategory: "large" })],
      [combatant("l1", "player", { x: 0, y: 4 }, { sizeCategory: "large" }), combatant("l2", "enemy", { x: 5, y: 0 }, { sizeCategory: "large" })],
      [combatant("h", "player", { x: 2, y: 2 }, { sizeCategory: "huge" }), combatant("c", "enemy", { x: 8, y: 7 }, { sizeCategory: "colossal" })]
    ];

    for (const [attacker, target] of pairs) {
      const exhaustive = Math.min(
        ...getCombatantOccupiedCells(attacker, room).flatMap((attackerCell) =>
          getCombatantOccupiedCells(target, room).map((targetCell) =>
            distanceFeet(attackerCell, targetCell, room.board.cellSizeFeet)
          )
        )
      );
      assert.equal(distanceBetweenFootprintsFeet(room, attacker, target), exhaustive);
    }
  });

  await t.test("Large en (2,2) deriva cuatro celdas en orden determinista", () => {
    const room = createEmptyRoom("LARGE-CELLS");
    const large = combatant("large", "enemy", { x: 2, y: 2 }, { sizeCategory: "large" });
    assert.deepEqual(getCombatantOccupiedCells(large, room), [
      { x: 2, y: 2, zFeet: 0 },
      { x: 3, y: 2, zFeet: 0 },
      { x: 2, y: 3, zFeet: 0 },
      { x: 3, y: 3, zFeet: 0 }
    ]);
  });

  await t.test("Huge reutiliza la misma derivación como bloque 3x3", () => {
    const room = createEmptyRoom("HUGE-CELLS");
    const huge = combatant("huge", "enemy", { x: 1, y: 1 }, { sizeCategory: "huge" });
    const cells = getCombatantOccupiedCells(huge, room);
    assert.equal(cells.length, 9);
    assert.deepEqual(cells.at(-1), { x: 3, y: 3, zFeet: 0 });
  });

  await t.test("una colisión parcial con muro rechaza todo el movimiento Large", () => {
    const room = createEmptyRoom("LARGE-WALL");
    room.board.impassableCells = ["2,1"];
    const large = combatant("large", "player", { x: 0, y: 0 }, { sizeCategory: "large" });
    room.combatants = [large];
    const result = validateMovePath(room, large, [{ x: 1, y: 0, zFeet: 0 }], 30);
    assert.equal(result.ok, false);
    assert.match(result.error, /huella.*muro|obstaculo intransitable/i);
  });

  await t.test("dos héroes que amenazan caras opuestas flanquean a un Large", () => {
    const room = createEmptyRoom("LARGE-FLANK");
    const attacker = combatant("north", "player", { x: 2, y: 1 });
    const ally = combatant("south", "player", { x: 2, y: 4 });
    const target = combatant("large", "enemy", { x: 2, y: 2 }, { sizeCategory: "large" });
    room.combatants = [attacker, ally, target];

    assert.equal(isFlanking(room, attacker, target), true);
    const modifiers = getAttackContextModifiers(room, attacker, target);
    assert.equal(modifiers.flanking, true);
    assert.equal(modifiers.byAttackType.melee.attackBonus, 2);
    assert.deepEqual(modifiers.byAttackType.melee.labelParts, ["flanqueo +2"]);
  });

  await t.test("dos héroes sobre la misma cara no flanquean a un Large", () => {
    const room = createEmptyRoom("LARGE-NO-FLANK");
    const attacker = combatant("north-a", "player", { x: 2, y: 1 });
    const ally = combatant("north-b", "player", { x: 3, y: 1 });
    const target = combatant("large", "enemy", { x: 2, y: 2 }, { sizeCategory: "large" });
    room.combatants = [attacker, ally, target];
    assert.equal(isFlanking(room, attacker, target), false);
  });

  await t.test("AdO Large registra celdas abandonadas y nunca se dispara entre aliados", () => {
    const room = createEmptyRoom("LARGE-AOO");
    const mover = combatant("large-hero", "player", { x: 2, y: 2 }, { sizeCategory: "large" });
    const ally = combatant("ally", "player", { x: 1, y: 2 });
    const enemy = combatant("enemy", "enemy", { x: 1, y: 3 });
    room.combatants = [mover, ally, enemy];
    const opportunities = findTriggeredOpportunityAttacksForPath(
      room,
      mover,
      [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }],
      10,
      () => true
    );
    assert.deepEqual(opportunities.map((opportunity) => opportunity.attackerId), [enemy.id]);
    assert.deepEqual(opportunities[0].provokingCells, [
      { x: 2, y: 2, zFeet: 0 },
      { x: 2, y: 3, zFeet: 0 }
    ]);
  });

  await t.test("una colision parcial con enemigo consciente rechaza todo el movimiento Large", () => {
    const room = createEmptyRoom("LARGE-ENEMY-COLLISION");
    room.board.impassableCells = [];
    const large = combatant("large", "player", { x: 0, y: 0 }, { sizeCategory: "large" });
    const enemy = combatant("enemy", "enemy", { x: 2, y: 1 });
    room.combatants = [large, enemy];
    const result = validateMovePath(room, large, [{ x: 1, y: 0, zFeet: 0 }], 30);
    assert.equal(result.ok, false);
    assert.match(result.error, /ocupada por enemy/i);
  });
});
