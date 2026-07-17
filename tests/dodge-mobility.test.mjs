import test from "node:test";
import assert from "node:assert/strict";
import { Rules } from "../packages/shared/src/index.ts";
import { handleDeclareDodgeTarget } from "../apps/server/src/commands/tacticalCommands.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { inventoryEquipment } from "./test-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 035 — Defensas Contextuales (Dodge & Mobility)
// Reglas derivadas de combatant.featIds, evaluadas en caliente dentro de
// Rules.totalArmorClass. Sin EffectInstance/ConditionalModifier (ver NDD).
// ─────────────────────────────────────────────────────────────────────────────

function makeCombatant(overrides = {}) {
  return {
    id: "defender", name: "Defensor", type: "player", controller: "player",
    controlledBy: { type: "player", participantId: "player-1" }, hpCurrent: 30, hpMax: 30,
    baseAttackBonus: 0, baseFortitude: 0, baseReflex: 0, baseWill: 0, baseSpeedFeet: 30,
    abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium", creatureTypeId: "humanoid", featureIds: [], sneakAttackDice: 0, ruleTraits: [],
    ...inventoryEquipment(null),
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
    featIds: [], dodgeTargetId: null, initiative: 10, isStable: false, buffs: [], abilities: [],
    position: { x: 1, y: 0, zFeet: 0 }, icon: "D",
    stats: { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, kills: 0, timesDroppedToZero: 0, healingReceived: 0 },
    ...overrides
  };
}

function makeContext(combatants, effectInstances = []) {
  return {
    board: { width: 10, height: 10, cellSizeFeet: 5 }, combatants,
    currentTurn: { combatantId: combatants[0]?.id ?? null, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false },
    phase: "active", pendingOpportunityAttacks: [], activeAttackThreat: null, effectInstances
  };
}

function makeRoom(combatants, overrides = {}) {
  return {
    code: "TEST", board: { width: 10, height: 10, cellSizeFeet: 5 }, combatants,
    turnOrder: combatants.map((c) => c.id), activeTurnIndex: 0, round: 1,
    phase: "active", outcome: "ongoing", completedAt: null,
    currentTurn: { combatantId: combatants[0]?.id ?? null, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false },
    pendingOpportunityAttacks: [], log: [], activeAttackThreat: null, effectInstances: [], eventSequence: 0,
    ...overrides
  };
}

const mockSocketPlayer1 = { readyState: 1, OPEN: 1, send: () => {} };
const mockSocketPlayer2 = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(mockSocketPlayer1, { id: "player-1", role: "player", name: "Jugador 1", roomCode: "TEST" });
clients.set(mockSocketPlayer2, { id: "player-2", role: "player", name: "Jugador 2", roomCode: "TEST" });

test("Sprint 035 - Defensas Contextuales (Dodge & Mobility)", async (t) => {
  await t.test("Esquiva (Dodge): +1 CA solo contra el objetivo designado, +0 contra cualquier otro", () => {
    const defender = makeCombatant({ featIds: ["srd_dodge"], dodgeTargetId: "attacker-A" });
    const context = makeContext([defender]);

    const base = Rules.totalArmorClass(context, defender, { targetAcType: "normal" });
    const vsDesignated = Rules.totalArmorClass(context, defender, { targetAcType: "normal", attackerId: "attacker-A" });
    const vsOther = Rules.totalArmorClass(context, defender, { targetAcType: "normal", attackerId: "attacker-B" });

    assert.equal(vsDesignated.total, base.total + 1, "Contra el objetivo designado debe sumar exactamente +1.");
    assert.ok(vsDesignated.parts.includes("esquiva +1"), "La etiqueta debe ser exactamente 'esquiva +1'.");
    assert.equal(vsOther.total, base.total, "Contra un atacante distinto al designado no debe haber bono.");
    assert.ok(!vsOther.parts.includes("esquiva +1"));
  });

  await t.test("Esquiva (Dodge): redeclarar el objetivo cambia el foco dinámicamente", () => {
    const defender = makeCombatant({ featIds: ["srd_dodge"], dodgeTargetId: "attacker-A" });
    const context = makeContext([defender]);

    const vsA = Rules.totalArmorClass(context, defender, { targetAcType: "normal", attackerId: "attacker-A" });
    defender.dodgeTargetId = "attacker-B";
    const vsANowStale = Rules.totalArmorClass(context, defender, { targetAcType: "normal", attackerId: "attacker-A" });
    const vsBNew = Rules.totalArmorClass(context, defender, { targetAcType: "normal", attackerId: "attacker-B" });

    assert.ok(vsA.parts.includes("esquiva +1"));
    assert.ok(!vsANowStale.parts.includes("esquiva +1"), "Tras redeclarar, el antiguo objetivo ya no recibe el bono.");
    assert.ok(vsBNew.parts.includes("esquiva +1"), "El nuevo objetivo designado sí recibe el bono.");
  });

  await t.test("Movilidad (Mobility): +4 CA únicamente en un AdO provocado por movimiento", () => {
    const defender = makeCombatant({ featIds: ["srd_mobility"] });
    const context = makeContext([defender]);

    const base = Rules.totalArmorClass(context, defender, { targetAcType: "normal", attackerId: "attacker-A" });
    const movementAoO = Rules.totalArmorClass(context, defender, { targetAcType: "normal", attackerId: "attacker-A", isOpportunityAttack: true, isMovementProvoked: true });
    const nonMovementAoO = Rules.totalArmorClass(context, defender, { targetAcType: "normal", attackerId: "attacker-A", isOpportunityAttack: true, isMovementProvoked: false });
    const flagWithoutAoO = Rules.totalArmorClass(context, defender, { targetAcType: "normal", attackerId: "attacker-A", isOpportunityAttack: false, isMovementProvoked: true });

    assert.equal(movementAoO.total, base.total + 4, "El AdO provocado por movimiento debe sumar exactamente +4.");
    assert.ok(movementAoO.parts.includes("movilidad +4"), "La etiqueta debe ser exactamente 'movilidad +4'.");
    assert.equal(nonMovementAoO.total, base.total, "Un AdO no provocado por movimiento no otorga el bono (fuga evitada).");
    assert.ok(!nonMovementAoO.parts.includes("movilidad +4"));
    assert.equal(flagWithoutAoO.total, base.total, "isMovementProvoked sin isOpportunityAttack no otorga el bono.");
  });

  await t.test("Anulación por Sorpresa: srd_flat_footed anula por completo Esquiva y Movilidad", () => {
    const defender = makeCombatant({ featIds: ["srd_dodge", "srd_mobility"], dodgeTargetId: "attacker-A" });
    const context = makeContext([defender], [
      { instanceId: "flat-1", effectId: "srd_flat_footed", source: { type: "system" }, targets: [defender.id], appliedAtEvent: { type: "CombatStarted", round: 1 } }
    ]);

    const withoutFeatContext = Rules.totalArmorClass(context, defender, { targetAcType: "normal" });
    const withBothFeatTriggers = Rules.totalArmorClass(context, defender, { targetAcType: "normal", attackerId: "attacker-A", isOpportunityAttack: true, isMovementProvoked: true });

    assert.equal(withBothFeatTriggers.total, withoutFeatContext.total, "Ningún bono de dote debe filtrarse bajo Flat-Footed.");
    assert.ok(!withBothFeatTriggers.parts.includes("esquiva +1"));
    assert.ok(!withBothFeatTriggers.parts.includes("movilidad +4"));
  });

  await t.test("Sin la dote correspondiente, ninguno de los dos bonos se activa aunque el contexto lo cumpla", () => {
    const defender = makeCombatant({ featIds: [], dodgeTargetId: "attacker-A" });
    const context = makeContext([defender]);

    const base = Rules.totalArmorClass(context, defender, { targetAcType: "normal" });
    const withContext = Rules.totalArmorClass(context, defender, { targetAcType: "normal", attackerId: "attacker-A", isOpportunityAttack: true, isMovementProvoked: true });

    assert.equal(withContext.total, base.total);
    assert.ok(!withContext.parts.includes("esquiva +1"));
    assert.ok(!withContext.parts.includes("movilidad +4"));
  });

  await t.test("declare-dodge-target: designa un objetivo válido y luego limpia la designación con targetId null", () => {
    const dodger = makeCombatant({ id: "dodger", featIds: ["srd_dodge"] });
    const target = makeCombatant({ id: "target-1", controlledBy: { type: "player", participantId: "player-2" } });
    const room = makeRoom([dodger, target]);

    handleDeclareDodgeTarget(room, { type: "declare-dodge-target", roomCode: "TEST", actorId: "player-1", combatantId: "dodger", targetId: "target-1" });
    assert.equal(room.combatants.find((c) => c.id === "dodger").dodgeTargetId, "target-1");
    assert.ok(room.log.some((entry) => entry.message.includes("designa a")));

    handleDeclareDodgeTarget(room, { type: "declare-dodge-target", roomCode: "TEST", actorId: "player-1", combatantId: "dodger", targetId: null });
    assert.equal(room.combatants.find((c) => c.id === "dodger").dodgeTargetId, null);
    assert.ok(room.log.some((entry) => entry.message.includes("retira su designación")));
  });

  await t.test("declare-dodge-target: rechazado si el combatiente no posee srd_dodge", () => {
    const noFeat = makeCombatant({ id: "no-feat", featIds: [] });
    const target = makeCombatant({ id: "target-2", controlledBy: { type: "player", participantId: "player-2" } });
    const room = makeRoom([noFeat, target]);

    assert.throws(
      () => handleDeclareDodgeTarget(room, { type: "declare-dodge-target", roomCode: "TEST", actorId: "player-1", combatantId: "no-feat", targetId: "target-2" }),
      /no posee la dote Esquiva/
    );
  });

  await t.test("declare-dodge-target: rechazado si el actor no controla al combatiente", () => {
    const dodger = makeCombatant({ id: "dodger-2", featIds: ["srd_dodge"] });
    const room = makeRoom([dodger]);

    assert.throws(
      () => handleDeclareDodgeTarget(room, { type: "declare-dodge-target", roomCode: "TEST", actorId: "player-2", combatantId: "dodger-2", targetId: null })
    );
  });

  await t.test("declare-dodge-target: rechazado fuera de turno", () => {
    const dodger = makeCombatant({ id: "dodger-3", featIds: ["srd_dodge"] });
    const other = makeCombatant({ id: "other-3", controlledBy: { type: "player", participantId: "player-2" } });
    const room = makeRoom([other, dodger]); // currentTurn.combatantId = other.id, no dodger-3

    assert.throws(
      () => handleDeclareDodgeTarget(room, { type: "declare-dodge-target", roomCode: "TEST", actorId: "player-1", combatantId: "dodger-3", targetId: null }),
      /Solo puede actuar el combatiente del turno actual/
    );
  });

  await t.test("declare-dodge-target: rechazado si el objetivo designado ya está muerto", () => {
    const dodger = makeCombatant({ id: "dodger-4", featIds: ["srd_dodge"] });
    const deadTarget = makeCombatant({ id: "dead-target", hpCurrent: -10, controlledBy: { type: "player", participantId: "player-2" } });
    const room = makeRoom([dodger, deadTarget]);

    assert.throws(
      () => handleDeclareDodgeTarget(room, { type: "declare-dodge-target", roomCode: "TEST", actorId: "player-1", combatantId: "dodger-4", targetId: "dead-target" }),
      /ya esta muerto/
    );
  });
});
