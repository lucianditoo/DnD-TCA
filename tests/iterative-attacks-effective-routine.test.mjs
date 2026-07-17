import test from "node:test";
import assert from "node:assert/strict";
import { Rules, getAttackRoutine, getEffectiveAttackRoutine } from "../packages/shared/dist/index.js";
import { inventoryEquipment } from "./test-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 036 — Consolidación de la Rutina de Ataques Iterativos (Read-Model Unificado)
// getEffectiveAttackRoutine compone getAttackRoutine + Rules.totalAttackBonus.
// No debe duplicar ni recalcular ninguno de los dos; no debe incluir flanqueo ni
// ningún modificador dependiente de un objetivo específico (no recibe target).
// ─────────────────────────────────────────────────────────────────────────────

function makeCombatant(overrides = {}) {
  return {
    id: "attacker", name: "Atacante", type: "player", controller: "player",
    controlledBy: { type: "player", participantId: "player-1" }, hpCurrent: 30, hpMax: 30,
    baseAttackBonus: 0, baseFortitude: 0, baseReflex: 0, baseWill: 0, baseSpeedFeet: 30,
    abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium", creatureTypeId: "humanoid", featureIds: [], sneakAttackDice: 0, ruleTraits: [],
    ...inventoryEquipment(null),
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
    featIds: [], initiative: 10, isStable: false, buffs: [], abilities: [],
    position: { x: 1, y: 0, zFeet: 0 }, icon: "A",
    stats: { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, kills: 0, timesDroppedToZero: 0, healingReceived: 0 },
    ...overrides
  };
}

function makeContext(combatants, effectInstances = []) {
  return {
    board: { width: 10, height: 10, cellSizeFeet: 5 }, combatants,
    currentTurn: { combatantId: combatants[0]?.id ?? null, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "full", defensiveFightingDeclared: false },
    phase: "active", pendingOpportunityAttacks: [], activeAttackThreat: null, effectInstances
  };
}

test("Sprint 036 - getEffectiveAttackRoutine: consistencia de longitud por umbral de BAB", () => {
  const thresholds = [
    { bab: 4, expectedLength: 1 },
    { bab: 6, expectedLength: 2 },
    { bab: 11, expectedLength: 3 },
    { bab: 16, expectedLength: 4 }
  ];

  for (const { bab, expectedLength } of thresholds) {
    const attacker = makeCombatant({ baseAttackBonus: bab });
    const context = makeContext([attacker]);
    const legacyRoutine = getAttackRoutine(attacker);
    const effectiveRoutine = getEffectiveAttackRoutine(context, attacker);

    assert.equal(effectiveRoutine.length, expectedLength, `BAB ${bab} debe proyectar ${expectedLength} ataque(s).`);
    assert.equal(effectiveRoutine.length, legacyRoutine.length, "La longitud debe coincidir exactamente con getAttackRoutine.");

    effectiveRoutine.forEach((entry, index) => {
      assert.equal(entry.ordinal, index + 1);
      assert.equal(entry.type, legacyRoutine[index].type);
      assert.equal(entry.routinePenalty, legacyRoutine[index].penalty);
    });
  }
});

test("Sprint 036 - getEffectiveAttackRoutine: equivalencia exacta con Rules.totalAttackBonus", () => {
  const attacker = makeCombatant({
    baseAttackBonus: 16,
    abilityScores: { strength: 18, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "large"
  });
  const context = makeContext([attacker]);

  const baseAttack = Rules.totalAttackBonus(context, attacker);
  const routine = getEffectiveAttackRoutine(context, attacker);

  assert.equal(routine.length, 4);
  const expectedPenalties = [0, -5, -10, -15];
  routine.forEach((entry, index) => {
    assert.equal(entry.effectiveAttackBonus, baseAttack.total + expectedPenalties[index], `El ataque ordinal ${index + 1} debe ser exactamente el bono base + su penalizador de rutina.`);
  });
});

test("Sprint 036 - getEffectiveAttackRoutine: propaga attackType a los modificadores condicionales del atacante (ej. Apretujarse), sin depender de un objetivo", () => {
  const attacker = makeCombatant({ baseAttackBonus: 6 });
  const squeezingInstance = { instanceId: "squeeze-1", effectId: "srd_squeezing", source: { type: "system" }, targets: [attacker.id], appliedAtEvent: { type: "SystemInjected", round: 1 } };
  const context = makeContext([attacker], [squeezingInstance]);

  const withoutAttackType = getEffectiveAttackRoutine(context, attacker);
  const asMelee = getEffectiveAttackRoutine(context, attacker, { attackType: "melee" });
  const asRanged = getEffectiveAttackRoutine(context, attacker, { attackType: "ranged" });

  assert.equal(asMelee[0].effectiveAttackBonus, withoutAttackType[0].effectiveAttackBonus - 4, "Apretujarse resta -4 al ataque cuerpo a cuerpo cuando se declara attackType melee.");
  assert.equal(asRanged[0].effectiveAttackBonus, withoutAttackType[0].effectiveAttackBonus, "Apretujarse no afecta ataques a distancia.");
});

test("Sprint 036 - getEffectiveAttackRoutine: no incluye flanqueo ni ningún modificador dependiente de un objetivo específico", () => {
  const attacker = makeCombatant({ baseAttackBonus: 11 });
  const isolatedContext = makeContext([attacker]);
  const crowdedContext = makeContext([
    attacker,
    makeCombatant({ id: "ally", name: "Aliado", position: { x: 2, y: 0, zFeet: 0 } }),
    makeCombatant({ id: "enemy", name: "Enemigo", type: "enemy", position: { x: 1, y: 1, zFeet: 0 } })
  ]);

  const routineIsolated = getEffectiveAttackRoutine(isolatedContext, attacker);
  const routineCrowded = getEffectiveAttackRoutine(crowdedContext, attacker);

  assert.deepEqual(
    routineCrowded.map((entry) => entry.effectiveAttackBonus),
    routineIsolated.map((entry) => entry.effectiveAttackBonus),
    "La rutina no debe variar por la sola presencia de otros combatientes en posiciones de flanqueo; la función no recibe un target."
  );
});

test("Sprint 036 - getEffectiveAttackRoutine: el array y cada entrada quedan congelados", () => {
  const attacker = makeCombatant({ baseAttackBonus: 16 });
  const routine = getEffectiveAttackRoutine(makeContext([attacker]), attacker);

  assert.ok(Object.isFrozen(routine), "El array de la rutina debe estar congelado.");
  for (const entry of routine) {
    assert.ok(Object.isFrozen(entry), "Cada entrada individual debe estar congelada.");
  }
});
