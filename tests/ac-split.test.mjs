import test from "node:test";
import assert from "node:assert/strict";
import { Rules, createRuleEvaluator } from "../packages/shared/src/index.ts";
import { resolveAttack } from "../apps/server/src/combat/attackResolver.ts";
import { inventoryEquipment } from "./test-utils.mjs";

function makeCombatant(overrides = {}) {
  return {
    id: "defender", name: "Defensor", type: "player", controller: "player",
    controlledBy: { type: "player", participantId: "player-1" }, hpCurrent: 30, hpMax: 30,
    baseAttackBonus: 0, baseFortitude: 0, baseReflex: 0, baseWill: 0, baseSpeedFeet: 30,
    abilityScores: { strength: 10, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium", creatureTypeId: "humanoid", featureIds: [], sneakAttackDice: 0, ruleTraits: [],
    ...inventoryEquipment(null, { offHandCatalogId: "heavy_steel_shield", armorCatalogId: "chainmail" }),
    intrinsicDefense: { naturalArmorBonus: 3, dodgeBonus: 1, deflectionBonus: 0, miscArmorClassBonus: 0 },
    featIds: [], initiative: 10, isStable: false, buffs: [], abilities: [],
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

test("AC Split deriva CA normal, Touch y Flat-Footed desde fuentes V5", () => {
  const defender = makeCombatant();
  const context = makeContext([defender]);
  assert.equal(Rules.totalArmorClass(context, defender, { targetAcType: "normal" }).total, 23);
  assert.equal(Rules.totalArmorClass(context, defender, { targetAcType: "touch" }).total, 13);
  assert.equal(Rules.totalArmorClass(context, defender, { targetAcType: "normal", isFlatFootedOverride: true }).total, 20);
});

test("AC Split conserva un modificador negativo de Destreza al estar Flat-Footed", () => {
  const defender = makeCombatant({
    abilityScores: { strength: 10, dexterity: 6, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    ...inventoryEquipment(null), intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 }
  });
  assert.equal(Rules.totalArmorClass(makeContext([defender]), defender, { isFlatFootedOverride: true }).total, 8);
});

test("Touch + Flat-Footed conserva base, desvío, tamaño y misc", () => {
  const defender = makeCombatant({
    sizeCategory: "small",
    ...inventoryEquipment(null, { offHandCatalogId: "heavy_steel_shield", armorCatalogId: "full_plate" }),
    intrinsicDefense: { naturalArmorBonus: 3, dodgeBonus: 1, deflectionBonus: 2, miscArmorClassBonus: -2 }
  });
  assert.equal(Rules.totalArmorClass(makeContext([defender]), defender, { targetAcType: "touch", isFlatFootedOverride: true }).total, 11);
});

test("srd_flat_footed activa la supresión de Destreza sin override del caller", () => {
  const defender = makeCombatant();
  const context = makeContext([defender], [{ instanceId: "flat-1", effectId: "srd_flat_footed", source: { type: "system" }, targets: [defender.id], appliedAtEvent: { type: "CombatStarted", round: 1 } }]);
  assert.equal(Rules.totalArmorClass(context, defender, { targetAcType: "normal" }).total, 20);
  assert.equal(Rules.totalArmorClass(context, defender, { targetAcType: "touch" }).total, 10);
});

test("AC Split filtra bonus tipados después del stacking", () => {
  const catalog = {
    natural: { name: "Piel férrea", description: "", traits: [], ruleOverrides: [], onStack: "ignore", modifiers: [{ type: "numeric", id: "natural-ac", stat: "AC", stackingGroup: "natural_armor", stackingPolicy: "highest_value", value: 4 }] },
    dodge: { name: "Esquiva", description: "", traits: [], ruleOverrides: [], onStack: "ignore", modifiers: [{ type: "numeric", id: "dodge-ac", stat: "AC", stackingGroup: "dodge", stackingPolicy: "sum", value: 1 }] }
  };
  const defender = makeCombatant({ ...inventoryEquipment(null), abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }, intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 } });
  const context = makeContext([defender], [
    { instanceId: "natural-1", effectId: "natural", source: { type: "spell", id: "spell-1" }, targets: [defender.id], appliedAtEvent: { type: "SystemInjected", round: 1 } },
    { instanceId: "dodge-1", effectId: "dodge", source: { type: "spell", id: "spell-2" }, targets: [defender.id], appliedAtEvent: { type: "SystemInjected", round: 1 } }
  ]);
  const evaluator = createRuleEvaluator(catalog);
  assert.equal(evaluator.totalArmorClass(context, defender, { targetAcType: "normal" }).total, 15);
  assert.equal(evaluator.totalArmorClass(context, defender, { targetAcType: "touch" }).total, 11);
  assert.equal(evaluator.totalArmorClass(context, defender, { isFlatFootedOverride: true }).total, 14);
  assert.equal(evaluator.totalArmorClass(context, defender, { targetAcType: "touch", isFlatFootedOverride: true }).total, 10);
});

test("un combatiente sin fuentes V5 falla explícitamente", () => {
  const invalid = makeCombatant({ inventory: undefined, equipmentSlots: undefined });
  assert.throws(() => Rules.totalArmorClass(makeContext([invalid]), invalid), /inventory\/equipmentSlots V5/);
});

test("resolveAttack usa Touch AC solo cuando el servidor la selecciona", () => {
  const attacker = makeCombatant({ id: "caster", name: "Lanzador", ...inventoryEquipment("quarterstaff"), baseAttackBonus: 2, abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 14, wisdom: 10, charisma: 10 }, position: { x: 0, y: 0, zFeet: 0 } });
  const defender = makeCombatant();
  const context = makeContext([attacker, defender]);
  const normal = resolveAttack(context, attacker, defender, 11, 4, "ataque normal");
  const touch = resolveAttack(context, attacker, defender, 11, 4, "conjuro de toque", 0, { source: { name: "Ray of Frost", attackType: "ranged", targetAcType: "touch", abilityForAttack: "dexterity", maxRangeFeet: 30, criticalThreatFrom: 20, criticalMultiplier: 2, defaultDamage: 1, damageDice: "1d3" } });
  assert.equal(normal.targetArmorClass, 23);
  assert.equal(normal.hits, false);
  assert.equal(touch.targetArmorClass, 13);
  assert.equal(touch.hits, true);
});
