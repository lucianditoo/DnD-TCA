import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  Rules,
  canRun,
  createCombatRulesSnapshot,
  getEffectiveAbilityScore
} from "@dnd-tactical/shared";
import { canCharge } from "../apps/server/src/combat/chargeResolver.js";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

function effect(instanceId, effectId, targetId) {
  return {
    instanceId,
    effectId,
    source: { type: "system" },
    targets: [targetId],
    duration: { type: "permanent" },
    appliedAtEvent: 1
  };
}

function exhaustedRoom(combatant, extraEffects = [], roomOverrides = {}) {
  return makeTestRoom({
    combatants: [combatant],
    effectInstances: [effect("exhausted-1", "srd_exhausted", combatant.id), ...extraEffects],
    ...roomOverrides
  });
}

describe("Sprint 049 - Exhausted Core", () => {
  it("penaliza Fuerza y Destreza en -6 (el doble que Fatigued)", () => {
    const combatant = makeTestCombatant({
      abilityScores: { strength: 14, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
    });
    const room = exhaustedRoom(combatant);

    assert.equal(getEffectiveAbilityScore(room, combatant, "strength"), 8);
    assert.equal(getEffectiveAbilityScore(room, combatant, "dexterity"), 8);
    // BAB(2) + modificador de Fuerza efectiva (8 -> -1) = 1, sin fuentes adicionales de ataque.
    assert.equal(Rules.totalAttackBonus(room, combatant, { abilityForAttack: "strength", attackType: "melee" }).total, 1);
  });

  it("reduce la velocidad a la mitad, igual que Entangled/Blinded", () => {
    for (const [baseSpeedFeet, expected] of [[30, 15], [20, 10]]) {
      const combatant = makeTestCombatant({ baseSpeedFeet });
      const projection = Rules.getMovementSpeedProjection(exhaustedRoom(combatant), combatant);
      assert.equal(projection.total, expected);
      assert.deepEqual([projection.rateNumerator, projection.rateDenominator], [1, 2]);
      assert.ok(projection.parts.includes("Exhausted ×1/2"));
    }
  });

  it("FORBID_RUN y FORBID_CHARGE bloquean por los contratos ya existentes", () => {
    const combatant = makeTestCombatant();
    const room = exhaustedRoom(combatant);
    assert.equal(canRun(room, combatant).ok, false);
    assert.match(canRun(room, combatant).error, /no puede correr/);
    assert.equal(canCharge(room, combatant).ok, false);
    assert.match(canCharge(room, combatant).error, /no puede cargar/);
  });

  it("el snapshot conserva solo la fuente declarativa, nunca velocidad derivada", () => {
    const combatant = makeTestCombatant();
    const room = exhaustedRoom(combatant);
    const snapshot = createCombatRulesSnapshot(room);
    assert.equal(snapshot.effectInstances[0].effectId, "srd_exhausted");
    assert.equal(Object.hasOwn(snapshot.combatants[0], "speedFeet"), false);
    assert.equal(Rules.totalSpeedFeet(snapshot, snapshot.combatants[0]), 15);
  });

});
