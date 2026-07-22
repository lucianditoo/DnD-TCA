import test from "node:test";
import assert from "node:assert/strict";
import { Rules, createCombatRulesSnapshot, EffectReducer, effectsCatalog, getConcealmentAssessment, canApplySneakAttack } from "../packages/shared/dist/index.js";
import { setStructuredDexterity, structuredSnapshotFields } from "./test-utils.mjs";

function makeCombatant(id, overrides = {}) {
  return {
    id,
    name: id,
    type: "player", controller: "player",
    hpCurrent: 10, hpMax: 10,
    position: { x: 0, y: 0, zFeet: 0 },
    icon: "H", isStable: false,
    ...structuredSnapshotFields(13, 16),
    baseAttackBonus: 3, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    buffs: [], abilities: [],
    stats: { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, kills: 0, timesDroppedToZero: 0, healingReceived: 0 },
    ...overrides
  };
}

function makeSnapshot(effectIds, attackerOverrides = {}, effectOverrides = null) {
  const attacker = makeCombatant("c_attacker", attackerOverrides);
  const target = makeCombatant("c_target", { position: { x: 0, y: 1, zFeet: 0 } });
  
  const room = {
    id: "test",
    board: { width: 10, height: 10, cellSizeFeet: 5 },
    combatants: [attacker, target], turnOrder: [attacker.id, target.id], activeTurnIndex: 0, round: 1,
    phase: "active", outcome: "ongoing", completedAt: null,
    currentTurn: {
      combatantId: attacker.id, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false,
      usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false,
      usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false
    },
    pendingOpportunityAttacks: [], log: [], activeAttackThreat: null,
    effectInstances: effectOverrides || effectIds.map(id => ({ effectId: id, targets: [attacker.id], source: { type: "system" }, isEnvironmental: false, instanceId: Math.random().toString(), appliedAtEvent: { type: "SystemInjected", round: 1 } })),
    environmentalHazards: [],
    logs: [],
    eventSequence: 0
  };

  return createCombatRulesSnapshot(room);
}

test("Sprint 047 - EFFECT-BLINDED (Blinded Core)", async (t) => {
  await t.test("1. srd_blinded emite total concealment a los ataques del portador y NO a los ataques CONTRA él", () => {
    const snapshot = makeSnapshot(["srd_blinded"]);
    const blindedAttacker = snapshot.combatants.find(c => c.id === "c_attacker");
    const normalTarget = snapshot.combatants.find(c => c.id === "c_target");

    // Ataque BY the blinded attacker
    const assessmentByBlinded = getConcealmentAssessment(snapshot, blindedAttacker, normalTarget);
    assert.equal(assessmentByBlinded.applies, true);
    assert.equal(assessmentByBlinded.kind, "total");
    assert.equal(assessmentByBlinded.missChancePercent, 50);

    // Ataque AGAINST the blinded target
    const assessmentAgainstBlinded = getConcealmentAssessment(snapshot, normalTarget, blindedAttacker);
    assert.equal(assessmentAgainstBlinded.applies, false);
    assert.equal(assessmentAgainstBlinded.kind, "none");
  });

  await t.test("2. La CA baja -2 y la destreza no aplica", () => {
    const snapshotNormal = makeSnapshot([]);
    const snapshotBlinded = makeSnapshot(["srd_blinded"]);

    const attackerNormal = snapshotNormal.combatants.find(c => c.id === "c_attacker");
    const attackerBlinded = snapshotBlinded.combatants.find(c => c.id === "c_attacker");

    // Normal: base 10 + dex 3 = 13
    const acNormal = Rules.totalArmorClass(snapshotNormal, attackerNormal);
    assert.equal(acNormal.total, 13);

    // Blinded: base 10 + dex 0 (NO_DEX_TO_AC) - 2 (AC penalty) = 8
    const acBlinded = Rules.totalArmorClass(snapshotBlinded, attackerBlinded);
    assert.equal(acBlinded.total, 8);
    assert.ok(acBlinded.parts.some(p => p.includes("-2")), "Debe incluir el penalizador -2");
  });

  await t.test("3. El movimiento se reduce a la mitad", () => {
    const snapshotBlinded = makeSnapshot(["srd_blinded"]);
    const attackerBlinded = snapshotBlinded.combatants.find(c => c.id === "c_attacker");

    // Base speed = 30. Half = 15.
    const speed = Rules.totalSpeedFeet(snapshotBlinded, attackerBlinded);
    assert.equal(speed, 15);
  });

  await t.test("4. No puede correr ni cargar y no puede hacer ataques de oportunidad", () => {
    const snapshotBlinded = makeSnapshot(["srd_blinded"]);
    const attackerBlinded = snapshotBlinded.combatants.find(c => c.id === "c_attacker");

    const reduced = EffectReducer.reduceEffectsForTarget({
      effectInstances: snapshotBlinded.effectInstances,
      targetId: attackerBlinded.id,
      catalog: effectsCatalog
    });

    assert.equal(reduced.ruleOverrides.includes("FORBID_RUN"), true);
    assert.equal(reduced.ruleOverrides.includes("FORBID_CHARGE"), true);
    assert.equal(reduced.traits.includes("CANNOT_MAKE_AOO"), true);
    assert.equal(reduced.traits.includes("NO_THREAT"), false); // Según la auditoría, NO_THREAT se elimina.
  });

  await t.test("5. Sneak Attack se inactiva para los ataques producidos por el ciego", () => {
    // Le damos sneak attack base al atacante ciego a través del catálogo de features
    const snapshotBlinded = makeSnapshot(["srd_blinded"], { featureIds: ["srd_sneak_attack_2d6"], sneakAttackDice: 2 });
    const blindedAttacker = snapshotBlinded.combatants.find(c => c.id === "c_attacker");
    const normalTarget = snapshotBlinded.combatants.find(c => c.id === "c_target");
    
    // Y le damos la ventaja: hacemos al target FLAT FOOTED.
    const customEffects = [
      { effectId: "srd_blinded", targets: ["c_attacker"], source: { type: "system" }, isEnvironmental: false, instanceId: "1", appliedAtEvent: { type: "SystemInjected", round: 1 } },
      { effectId: "srd_flat_footed", targets: ["c_target"], source: { type: "system" }, isEnvironmental: false, instanceId: "2", appliedAtEvent: { type: "SystemInjected", round: 1 } }
    ];
    const snapshotWithFlatFooted = makeSnapshot([], { featureIds: ["srd_sneak_attack_2d6"], sneakAttackDice: 2 }, customEffects);
    const attacker = snapshotWithFlatFooted.combatants.find(c => c.id === "c_attacker");
    const target = snapshotWithFlatFooted.combatants.find(c => c.id === "c_target");

    const delivery = { attackType: "melee", distanceFeet: 5, requiresAttackRoll: true, dealsDamage: true };

    // A pesar del flat-footed del target, el sneak attack del atacante falla por su propia ceguera (genera concealment)
    const canSneak = canApplySneakAttack(snapshotWithFlatFooted, attacker, target, delivery);
    assert.equal(canSneak, false);
  });

  await t.test("6. Stacking seguro con Entangled", () => {
    const snapshotBoth = makeSnapshot(["srd_blinded", "srd_entangled"]);
    const attackerBoth = snapshotBoth.combatants.find(c => c.id === "c_attacker");

    // Math: base 30. Blinded x1/2 = 15. Entangled x1/2 = 7.5 => Math.floor = 7
    const speed = Rules.totalSpeedFeet(snapshotBoth, attackerBoth);
    assert.equal(speed, 7);
  });
});
