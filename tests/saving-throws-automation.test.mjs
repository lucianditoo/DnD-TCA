import test from "node:test";
import assert from "node:assert/strict";
import { resolveSavingThrowCheck } from "@dnd-tactical/shared";
import { handleCastSpell } from "../apps/server/src/commands/abilityCommands.js";
import { clients } from "../apps/server/src/room/roomStore.js";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

const actorId = "save-automation-player";
const socket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(socket, { id: actorId, role: "player", name: "Save Tester", roomCode: "SAVE" });

function combatantStats() {
  return {
    damageDealt: 0,
    damageTaken: 0,
    distanceMovedFeet: 0,
    attacksMade: 0,
    hits: 0,
    misses: 0,
    opportunityAttacksMade: 0,
    opportunityAttacksThisRound: 0,
    targetsAttackedThisRoundViaAoO: [],
    kills: 0,
    timesDroppedToZero: 0,
    healingReceived: 0
  };
}

function makeCaster(spellId, slotId = "slot-1") {
  return makeTestCombatant({
    id: "caster",
    type: "player",
    controlledBy: { type: "player", participantId: actorId },
    preparedSpells: [{ slotId, spellId, isExpended: false }],
    stats: combatantStats(),
    position: { x: 0, y: 0, zFeet: 0 }
  });
}

function makeTarget(overrides = {}) {
  return makeTestCombatant({
    id: "target",
    type: "enemy",
    controller: "gm",
    controlledBy: { type: "gm" },
    hpMax: 20,
    hpCurrent: 20,
    stats: combatantStats(),
    position: { x: 3, y: 0, zFeet: 0 },
    ...overrides
  });
}

function castCommand(slotId = "slot-1", amount = null, d20Roll = null) {
  return {
    type: "cast-spell",
    roomCode: "SAVE",
    actorId,
    casterId: "caster",
    targetId: "target",
    slotId,
    d20Roll,
    amount
  };
}

test("Sprint 024 - salvaciones automáticas y commit transaccional", async (t) => {
  await t.test("Ray of Frost con salvación exitosa reduce 8 de daño exactamente a 4", () => {
    const caster = makeCaster("srd_ray_of_frost");
    const target = makeTarget();
    const room = makeTestRoom({ combatants: [caster, target], currentTurn: { ...makeTestRoom().currentTurn, combatantId: caster.id } });

    handleCastSpell(room, castCommand("slot-1", 8, 15), { diceRoller: () => 20 });

    assert.equal(room.combatants.find((item) => item.id === target.id).hpCurrent, 16);
    assert.equal(room.combatants.find((item) => item.id === caster.id).preparedSpells[0].isExpended, true);
    assert.equal(room.currentTurn.usedStandardAction, true);
    assert.ok(room.log.some((entry) => entry.message.includes("daño 8 → 4")));
  });

  await t.test("una salvación de Voluntad exitosa niega la condición catalogada", () => {
    const caster = makeCaster("srd_hold_person");
    const target = makeTarget();
    const room = makeTestRoom({ combatants: [caster, target], currentTurn: { ...makeTestRoom().currentTurn, combatantId: caster.id } });

    handleCastSpell(room, castCommand(), { diceRoller: () => 20 });

    assert.equal(room.effectInstances.some((effect) => effect.effectId === "srd_paralyzed" && effect.targets?.includes(target.id)), false);
    assert.equal(room.combatants.find((item) => item.id === caster.id).preparedSpells[0].isExpended, true);
    assert.ok(room.log.some((entry) => entry.message.includes("efecto negado")));
  });

  await t.test("una salvación fallida materializa el efecto en el mismo commit", () => {
    const caster = makeCaster("srd_hold_person");
    const target = makeTarget();
    const room = makeTestRoom({ combatants: [caster, target], currentTurn: { ...makeTestRoom().currentTurn, combatantId: caster.id } });

    handleCastSpell(room, castCommand(), { diceRoller: () => 1 });

    assert.equal(room.effectInstances.some((effect) => effect.effectId === "srd_paralyzed" && effect.targets?.includes(target.id)), true);
    assert.ok(room.log.some((entry) => entry.message.includes("fallo automático por 1 natural")));
  });

  await t.test("1 natural falla aunque el objetivo tenga un bono de Reflejos extremo", () => {
    const caster = makeCaster("srd_ray_of_frost");
    const target = makeTarget({ baseReflex: 100 });
    const room = makeTestRoom({ combatants: [caster, target], currentTurn: { ...makeTestRoom().currentTurn, combatantId: caster.id } });

    handleCastSpell(room, castCommand("slot-1", 8, 15), { diceRoller: () => 1 });

    assert.equal(room.combatants.find((item) => item.id === target.id).hpCurrent, 12);
    assert.ok(room.log.some((entry) => entry.message.includes("fallo automático por 1 natural")));
  });

  await t.test("20 natural supera una CD inalcanzable en el helper puro", () => {
    const result = resolveSavingThrowCheck(20, -50, 999);
    assert.equal(result.success, true);
    assert.equal(result.isNatural20, true);
  });

  await t.test("un fallo interno antes del commit no gasta slot, acción ni HP", () => {
    const caster = makeCaster("srd_ray_of_frost");
    const target = makeTarget();
    const room = makeTestRoom({ combatants: [caster, target], currentTurn: { ...makeTestRoom().currentTurn, combatantId: caster.id } });

    assert.throws(
      () => handleCastSpell(room, castCommand("slot-1", 8, 15), { diceRoller: () => { throw new Error("roller failure"); } }),
      /roller failure/
    );
    assert.equal(room.combatants.find((item) => item.id === target.id).hpCurrent, 20);
    assert.equal(room.combatants.find((item) => item.id === caster.id).preparedSpells[0].isExpended, false);
    assert.equal(room.currentTurn.usedStandardAction, false);
  });
});
