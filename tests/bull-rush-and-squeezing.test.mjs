import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Rules,
  createCombatRulesSnapshot,
  createEmptyRoom,
  getCombatantOccupiedCells,
  projectForcedMovement,
  validateMovePath,
  getAttackContextModifiers
} from "../packages/shared/src/index.ts";
import { handleResolveSpecialManeuver } from "../apps/server/src/commands/specialManeuverCommands.ts";
import { commitSpatialTransition } from "../apps/server/src/combat/spatialTransition.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { inventoryEquipment, makeTestCombatant, makeTestRoom, structuredSnapshotFields } from "./test-utils.mjs";

const actorId = "bull-rush-player";
const mockSocket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(mockSocket, { id: actorId, role: "player", name: "Bull Rush tester", roomCode: "BULL" });

function lightweightCombatant(id, type, position, overrides = {}) {
  return {
    id,
    name: id,
    type,
    controller: type === "enemy" ? "gm" : "player",
    hpCurrent: 30,
    hpMax: 30,
    isStable: false,
    ...structuredSnapshotFields(10),
    sizeCategory: "medium",
    position: { ...position, zFeet: position.zFeet ?? 0 },
    buffs: [],
    ...overrides
  };
}

function maneuverCombatant(id, type, position, overrides = {}) {
  return makeTestCombatant({
    id,
    name: id,
    type,
    hpCurrent: 40,
    hpMax: 40,
    baseAttackBonus: 4,
    abilityScores: type === "player"
      ? { strength: 18, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
      : { strength: 14, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium",
    position,
    controller: type === "player" ? "player" : "gm",
    controlledBy: type === "player" ? { type: "player", participantId: actorId } : { type: "gm" },
    ...inventoryEquipment("longsword"),
    ...overrides
  });
}

function bullRushRoom(overrides = {}) {
  const attacker = maneuverCombatant("bull", "player", { x: 1, y: 2, zFeet: 0 }, overrides.attacker);
  const target = maneuverCombatant("target", "enemy", { x: 2, y: 2, zFeet: 0 }, overrides.target);
  const room = makeTestRoom({
    code: "BULL",
    combatants: [attacker, target],
    turnOrder: [attacker.id, target.id],
    currentTurn: { ...makeTestRoom().currentTurn, combatantId: attacker.id }
  });
  return { room, attacker, target };
}

function command(d20OpposedRoll = 20) {
  return {
    type: "resolve-special-maneuver",
    roomCode: "BULL",
    actorId,
    maneuver: { type: "bull_rush", attackerId: "bull", targetId: "target", d20OpposedRoll }
  };
}

function fixedDice(values, purposes = []) {
  let index = 0;
  return {
    d20(purpose) {
      purposes.push(purpose);
      const value = values[index++];
      assert.notEqual(value, undefined, `Falta un d20 determinista para ${purpose}.`);
      return value;
    }
  };
}

test("Sprint 028 - Bull Rush & Dynamic Squeezing", async (t) => {
  await t.test("Large entra en franja 2x1, paga coste doble y recibe -4 solo al ataque melee", () => {
    const room = createEmptyRoom("SQUEEZE");
    room.board.narrowCells = ["1,0", "2,0"];
    room.board.impassableCells = ["1,1", "2,1"];
    const large = maneuverCombatant("large", "player", { x: 0, y: 0, zFeet: 0 }, { sizeCategory: "large" });
    room.combatants = [large];

    const validation = validateMovePath(room, large, [{ x: 1, y: 0, zFeet: 0 }], 30);
    assert.equal(validation.ok, true, validation.error);
    assert.equal(validation.value.distanceFeet, 10);
    assert.equal(validation.value.finalSpatialMode, "squeezing");
    assert.deepEqual(validation.value.steps[0].occupiedCells, [
      { x: 1, y: 0, zFeet: 0 },
      { x: 2, y: 0, zFeet: 0 }
    ]);

    commitSpatialTransition(room, large, { x: 1, y: 0, zFeet: 0 }, "squeezing");
    const snapshot = createCombatRulesSnapshot(room);
    assert.deepEqual(getCombatantOccupiedCells(large, snapshot), validation.value.steps[0].occupiedCells);
    assert.equal(room.effectInstances.filter((effect) => effect.effectId === "srd_squeezing").length, 1);
    const baseRoom = createEmptyRoom("SQUEEZE-BASE");
    baseRoom.combatants = [{ ...large, position: { x: 0, y: 0, zFeet: 0 } }];
    const base = createCombatRulesSnapshot(baseRoom);
    assert.equal(Rules.totalAttackBonus(snapshot, large, { abilityForAttack: "strength", attackType: "melee" }).total,
      Rules.totalAttackBonus(base, large, { abilityForAttack: "strength", attackType: "melee" }).total - 4);
    assert.equal(Rules.totalAttackBonus(snapshot, large, { abilityForAttack: "dexterity", attackType: "ranged" }).total,
      Rules.totalAttackBonus(base, large, { abilityForAttack: "dexterity", attackType: "ranged" }).total);
  });

  await t.test("movimiento forzado Large se trunca antes de una colision parcial", () => {
    const room = createEmptyRoom("FORCED-WALL");
    room.board.impassableCells = ["5,2"];
    const target = lightweightCombatant("large-target", "enemy", { x: 2, y: 2 }, { sizeCategory: "large" });
    room.combatants = [target];
    const projection = projectForcedMovement(room, target, { dx: 1, dy: 0 }, 20);
    assert.equal(projection.blocked, true);
    assert.equal(projection.blockedReason, "impassable_cell");
    assert.equal(projection.distanceFeet, 5);
    assert.deepEqual(projection.finalPosition, { x: 3, y: 2, zFeet: 0 });
  });

  await t.test("un AdO que inflige dano aborta la Embestida antes de la oposicion", () => {
    const { room, attacker, target } = bullRushRoom();
    const purposes = [];
    handleResolveSpecialManeuver(room, command(), fixedDice([15], purposes));
    assert.deepEqual(purposes, ["opportunity-attack"]);
    assert.ok(attacker.hpCurrent < attacker.hpMax);
    assert.deepEqual(target.position, { x: 2, y: 2, zFeet: 0 });
    assert.equal(room.currentTurn.usedStandardAction, true);
    assert.match(room.log.map((entry) => entry.message).join("\n"), /aborta la maniobra/i);
  });

  await t.test("la Embestida ganada usa el proyector y confirma el empuje truncado", () => {
    const { room, target } = bullRushRoom({ target: { sizeCategory: "large" } });
    room.board.impassableCells = ["5,2"];
    room.effectInstances.push({
      instanceId: "no-aoo",
      effectId: "srd_flat_footed",
      source: { type: "system" },
      targets: [target.id],
      appliedAtEvent: { type: "SystemInjected", round: room.round },
      duration: { type: "permanent" }
    });
    const purposes = [];
    handleResolveSpecialManeuver(room, command(20), fixedDice([1], purposes));
    assert.deepEqual(purposes, ["opposed-defender"]);
    assert.deepEqual(target.position, { x: 3, y: 2, zFeet: 0 });
    assert.equal(room.currentTurn.usedStandardAction, true);
    assert.match(room.log.map((entry) => entry.message).join("\n"), /desplaza.*5 pies/i);
  });
  
  await t.test("Verificacion de Etiqueta y Filtro Ranged para srd_squeezing", () => {
    const { room, attacker, target } = bullRushRoom();
    
    // Add squeezing effect manually to the attacker
    room.effectInstances.push({
      instanceId: "squeezing-test",
      effectId: "srd_squeezing",
      source: { type: "system" },
      targets: [attacker.id],
      appliedAtEvent: { type: "SystemInjected", round: room.round },
      duration: { type: "permanent" }
    });

    const snapshot = createCombatRulesSnapshot(room);
    const meleeAttack = Rules.totalAttackBonus(snapshot, attacker, { attackType: "melee", abilityForAttack: "strength" });
    const rangedAttack = Rules.totalAttackBonus(snapshot, attacker, { attackType: "ranged", abilityForAttack: "dexterity" });

    // It should have 'squeezing -4' for melee, but not for ranged
    assert.ok(meleeAttack.parts.includes("squeezing -4"));
    
    // For ranged, it shouldn't apply squeezing attack penalty
    assert.ok(!rangedAttack.parts.includes("squeezing -4"));
  });

  await t.test("Idempotencia del Efecto commitSpatialTransition", () => {
    const { room, attacker } = bullRushRoom();
    
    // Initial commit to squeezing
    commitSpatialTransition(room, attacker, { x: 1, y: 1, zFeet: 0 }, "squeezing");
    const squeezingCount1 = room.effectInstances.filter((instance) => instance.effectId === "srd_squeezing").length;
    assert.equal(squeezingCount1, 1);
    
    // Second commit to squeezing should be idempotent (it doesn't duplicate the effect)
    commitSpatialTransition(room, attacker, { x: 2, y: 2, zFeet: 0 }, "squeezing");
    const squeezingCount2 = room.effectInstances.filter((instance) => instance.effectId === "srd_squeezing").length;
    assert.equal(squeezingCount2, 1);
    
    // Third commit back to natural should remove the effect
    commitSpatialTransition(room, attacker, { x: 3, y: 3, zFeet: 0 }, "natural");
    const squeezingCount3 = room.effectInstances.filter((instance) => instance.effectId === "srd_squeezing").length;
    assert.equal(squeezingCount3, 0);
  });
});