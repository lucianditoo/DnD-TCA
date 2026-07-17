import test from "node:test";
import assert from "node:assert";
import { resolveSavingThrow } from "../apps/server/src/combat/savingThrowResolver.js";
import { Rules, EffectReducer } from "@dnd-tactical/shared";
import { inventoryEquipment } from "./test-utils.mjs";

// Mock minimal combatant and context
function createMockCombatant() {
  return {
    id: "target1",
    name: "Goblin",
    type: "enemy",
    controller: "gm",
    hpMax: 10,
    hpCurrent: 10,
    baseAttackBonus: 1, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    baseFortitude: 2,
    baseReflex: 1,
    baseWill: 0,
    baseSpeedFeet: 30,
    abilityScores: { strength: 10, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium",
    creatureTypeId: "humanoid",
    featureIds: [],
    ruleTraits: [],
    ...inventoryEquipment(null),
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
    featIds: [],
    position: { x: 0, y: 0, zFeet: 0 },
    buffs: [],
    abilities: [],
    stats: { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, kills: 0, timesDroppedToZero: 0, healingReceived: 0 }
  };
}

function createMockContext(effectInstances = []) {
  return {
    board: { width: 10, height: 10, cellSizeFeet: 5 },
    combatants: [],
    currentTurn: { combatantId: "target1", turnNumber: 1, movementUsedFeet: 0, attacksMade: 0 },
    phase: "active",
    pendingOpportunityAttacks: [],
    activeAttackThreat: null,
    effectInstances
  };
}

import { createRuleEvaluator } from "../packages/shared/src/rules.js";

test("Matemática del Bono Total: base + mod + buff", () => {
  const combatant = createMockCombatant();
  
  // Buff activo: +1 Fortaleza
  const effectInstances = [{
    instanceId: "eff1",
    effectId: "test-fortitude-buff",
    source: { sourceId: "caster1" },
    targets: ["target1"],
    appliedAtEvent: { turnNumber: 1 }
  }];

  const context = createMockContext(effectInstances);

  // Mock catalog for tests
  const catalog = {
    "test-fortitude-buff": {
      name: "Fortitude Buff",
      description: "Buff",
      onStack: "ignore",
      traits: [], ruleOverrides: [],
      modifiers: [
        { type: "numeric", id: "mod1", stat: "FORTITUDE", value: 1, stackingGroup: "misc", stackingPolicy: "sum" }
      ]
    }
  };

  const evaluator = createRuleEvaluator(catalog);
  
  // baseFortitude: 2
  // Constitution 14: +2 mod
  // Buff: +1
  // Total: 5
  const result = evaluator.totalSavingThrow(context, combatant, "fortitude");
  assert.strictEqual(result.total, 5);
  assert.ok(result.parts.includes("Base +2"));
  assert.ok(result.parts.includes("CON +2"));
  assert.ok(result.parts.includes("efectos +1"));
});

test("Invariantes Críticas: 1 es Fallo Automático contra CD 5", () => {
  const combatant = createMockCombatant();
  const context = createMockContext();
  
  // Tirada de 1, total: 1 + 4 = 5. CD es 5. Debería ser éxito, pero es 1 natural.
  const result = resolveSavingThrow(context, combatant, "fortitude", 5, 1);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.isNatural1, true);
});

test("Invariantes Críticas: 20 es Éxito Automático contra CD 40", () => {
  const combatant = createMockCombatant();
  const context = createMockContext();
  
  // Tirada de 20, total: 20 + 4 = 24. CD es 40. Debería ser fallo, pero es 20 natural.
  const result = resolveSavingThrow(context, combatant, "fortitude", 40, 20);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.isNatural20, true);
});

test("Resolución normal", () => {
  const combatant = createMockCombatant();
  const context = createMockContext();
  
  // Tirada 10 + 4 (2 base + 2 con) = 14
  const result1 = resolveSavingThrow(context, combatant, "fortitude", 15, 10);
  assert.strictEqual(result1.success, false);

  const result2 = resolveSavingThrow(context, combatant, "fortitude", 14, 10);
  assert.strictEqual(result2.success, true);
});
