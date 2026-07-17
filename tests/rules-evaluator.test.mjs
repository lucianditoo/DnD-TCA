/**
 * tests/rules-evaluator.test.mjs
 *
 * Test de integración del createRuleEvaluator con un catálogo de prueba local.
 * Demuestra que las funciones de reglas pueden consumir efectos de un catálogo
 * inyectable y que el catálogo productivo (Rules) permanece neutro.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createRuleEvaluator, Rules, createCombatRulesSnapshot } from "../packages/shared/dist/index.js";
import { setStructuredDexterity, structuredSnapshotFields } from "./test-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de prueba con efectos que sí modifican stats
// ─────────────────────────────────────────────────────────────────────────────
const testCatalog = {
  "test-attack-bonus": {
    name: "Bendición de Prueba", description: "Bono de ataque de prueba",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "test-atk-mod", stat: "ATTACK", stackingGroup: "sacred", stackingPolicy: "highest_value", value: 3 }]
  },
  "test-ac-bonus": {
    name: "Armadura de Prueba", description: "Bono de CA de prueba",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "test-ac-mod", stat: "AC", stackingGroup: "natural", stackingPolicy: "highest_value", value: 2 }]
  },
  "test-speed-bonus": {
    name: "Velocidad de Prueba", description: "Bono de velocidad de prueba",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "test-speed-mod", stat: "SPEED", stackingGroup: "enhancement", stackingPolicy: "sum", value: 10 }]
  },
  "test-stunned": {
    name: "Aturdido de Prueba", description: "Aturdido",
    traits: ["CANNOT_ACT", "NO_DEX_TO_AC", "CANNOT_MAKE_AOO"], ruleOverrides: [], onStack: "ignore",
    modifiers: []
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Fixture de combatiente y room
// ─────────────────────────────────────────────────────────────────────────────
function makeCombatant(id) {
  return {
    id,
    name: "Hero " + id,
    type: "player", controller: "player",
    hpCurrent: 20, hpMax: 20,
    ...structuredSnapshotFields(14),
    abilityScores: { strength: 14, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    baseAttackBonus: 3, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    controlledBy: { type: "player" },
    initiative: null,
    buffs: [],
    abilities: [],
    position: { x: 0, y: 0, zFeet: 0 },
    icon: "H", isStable: false,
    stats: { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, kills: 0, timesDroppedToZero: 0, healingReceived: 0 }
  };
}

function makeRoom(combatant, effectInstances) {
  return {
    code: "TEST", board: { width: 10, height: 10, cellSizeFeet: 5 },
    combatants: [combatant], turnOrder: [combatant.id], activeTurnIndex: 0, round: 1,
    phase: "active", outcome: "ongoing", completedAt: null,
    currentTurn: { combatantId: combatant.id, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false },
    pendingOpportunityAttacks: [], log: [], activeAttackThreat: null,
    effectInstances: effectInstances,
    eventSequence: 0
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createRuleEvaluator(testCatalog): un bono de ataque del catálogo de prueba se suma al total", () => {
  const testRules = createRuleEvaluator(testCatalog);
  const combatant = makeCombatant("hero-1");
  const room = makeRoom(combatant, [{
    instanceId: "inst-attack",
    effectId: "test-attack-bonus",
    source: { type: "creature", id: "caster" },
    targets: ["hero-1"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);

  const context = createCombatRulesSnapshot(room);
  const result = testRules.totalAttackBonus(context, combatant);

  // BAB 3 + Fuerza 2 + buffs 0 + efectos 3 = 8
  assert.equal(result.total, 8, "Debe sumar el delta de ActiveEffects al total de ataque");
  assert.ok(result.parts.some(p => p.includes("efectos")), "Las parts deben incluir la contribución de efectos");
});

test("createRuleEvaluator(testCatalog): un bono de CA del catálogo de prueba se suma al total", () => {
  const testRules = createRuleEvaluator(testCatalog);
  const combatant = makeCombatant("hero-2");
  const room = makeRoom(combatant, [{
    instanceId: "inst-ac",
    effectId: "test-ac-bonus",
    source: { type: "creature", id: "caster" },
    targets: ["hero-2"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);

  const context = createCombatRulesSnapshot(room);
  const result = testRules.totalArmorClass(context, combatant);

  // CA estructurada 14 + buffs 0 + efectos 2 = 16
  assert.equal(result.total, 16);
});

test("createRuleEvaluator(testCatalog): un bono de velocidad del catálogo de prueba se suma al total", () => {
  const testRules = createRuleEvaluator(testCatalog);
  const combatant = makeCombatant("hero-3");
  const room = makeRoom(combatant, [{
    instanceId: "inst-speed",
    effectId: "test-speed-bonus",
    source: { type: "creature", id: "caster" },
    targets: ["hero-3"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);

  const context = createCombatRulesSnapshot(room);
  const result = testRules.totalSpeedFeet(context, combatant);

  // Velocidad derivada 30 + buffs 0 + efectos 10 = 40
  assert.equal(result, 40);
});

test("Rules (catálogo productivo neutro): totalAttackBonus conserva exactamente el valor anterior sin efectos activos", () => {
  const combatant = makeCombatant("hero-4");
  combatant.buffs = [{ id: "b1", name: "Bless", source: "spell", attackBonus: 1, remainingTurns: 1 }];
  const room = makeRoom(combatant, []); // Catálogo productivo neutro → sin instancias
  const context = createCombatRulesSnapshot(room);

  const result = Rules.totalAttackBonus(context, combatant);
  // BAB 3 + Fuerza 2 + buffs 1 = 6. Catálogo productivo sin efectos → total = 6
  assert.equal(result.total, 6, "Con catálogo productivo neutro, el total debe coincidir exactamente con el cálculo sin efectos");
});

test("Rules (catálogo productivo neutro): totalArmorClass conserva exactamente el valor anterior", () => {
  const combatant = makeCombatant("hero-5");
  const room = makeRoom(combatant, []);
  const context = createCombatRulesSnapshot(room);
  const result = Rules.totalArmorClass(context, combatant);
  assert.equal(result.total, 14, "CA base sin buffs ni efectos debe ser 14");
});

test("Rules (catálogo productivo neutro): totalSpeedFeet conserva exactamente el valor anterior", () => {
  const combatant = makeCombatant("hero-6");
  const room = makeRoom(combatant, []);
  const context = createCombatRulesSnapshot(room);
  const result = Rules.totalSpeedFeet(context, combatant);
  assert.equal(result, 30, "Velocidad sin efectos ni buffs debe ser 30");
});

test("createRuleEvaluator: testCatalog y Rules son evaluadores DISTINTOS — testCatalog no contamina producción", () => {
  const testRules = createRuleEvaluator(testCatalog);
  const combatant = makeCombatant("hero-7");
  
  // Crear una instancia que sí existe en testCatalog pero NO en el catálogo productivo
  const room = makeRoom(combatant, [{
    instanceId: "inst-isolated",
    effectId: "test-attack-bonus",
    source: { type: "creature", id: "caster" },
    targets: ["hero-7"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);
  const context = createCombatRulesSnapshot(room);

  // testRules ve el efecto y suma +3
  const testResult = testRules.totalAttackBonus(context, combatant);
  // Rules (producción) NO conoce "test-attack-bonus" → el efecto, al aplicar al objetivo, lanzará un error fail-fast.
  assert.throws(() => {
    Rules.totalAttackBonus(context, combatant);
  }, /\[EffectReducer\] Unknown ActiveEffect: effectId="test-attack-bonus"/, "Rules de producción debe arrojar error por efecto desconocido aplicable");
});

test("createRuleEvaluator(testCatalog): evaluateActionAvailability devuelve error si el combatiente tiene CANNOT_ACT", () => {
  const testRules = createRuleEvaluator(testCatalog);
  const combatant = makeCombatant("hero-stunned");
  const room = makeRoom(combatant, [{
    instanceId: "inst-stun", effectId: "test-stunned",
    source: { type: "creature", id: "caster" }, targets: ["hero-stunned"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);
  const context = createCombatRulesSnapshot(room);

  const result = testRules.evaluateActionAvailability(context, combatant);
  assert.equal(result.ok, false);
  assert.match(result.error, /esta incapacitado y no puede realizar acciones/);
});

test("createRuleEvaluator(testCatalog): totalArmorClass suprime el bono de Destreza positivo si el combatiente tiene NO_DEX_TO_AC", () => {
  const testRules = createRuleEvaluator(testCatalog);
  const combatant = makeCombatant("hero-dex");
  setStructuredDexterity(combatant, 14, 12); // +2 dex
  
  const room = makeRoom(combatant, [{
    instanceId: "inst-stun", effectId: "test-stunned",
    source: { type: "creature", id: "caster" }, targets: ["hero-dex"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);
  const context = createCombatRulesSnapshot(room);

  const result = testRules.totalArmorClass(context, combatant);
  
  // CA 12 - Destreza 2 = 10
  assert.equal(result.total, 10);
  assert.ok(result.parts.some(p => p.includes("DEX suprimido -2")));
});

test("createRuleEvaluator(testCatalog): totalArmorClass NO penaliza si el modificador de Destreza es negativo o nulo con NO_DEX_TO_AC", () => {
  const testRules = createRuleEvaluator(testCatalog);
  const combatant = makeCombatant("hero-clumsy");
  setStructuredDexterity(combatant, 8, 9); // -1 dex
  
  const room = makeRoom(combatant, [{
    instanceId: "inst-stun", effectId: "test-stunned",
    source: { type: "creature", id: "caster" }, targets: ["hero-clumsy"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);
  const context = createCombatRulesSnapshot(room);

  const result = testRules.totalArmorClass(context, combatant);
  
  // CA 9. Como Destreza es -1, no se suprime.
  assert.equal(result.total, 9);
});

test("createRuleEvaluator(testCatalog): canMakeOpportunityAttack devuelve false si el combatiente tiene CANNOT_MAKE_AOO", () => {
  const testRules = createRuleEvaluator(testCatalog);
  const combatant = makeCombatant("hero-no-aoo");
  const room = makeRoom(combatant, [{
    instanceId: "inst-stun", effectId: "test-stunned",
    source: { type: "creature", id: "caster" }, targets: ["hero-no-aoo"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);
  const context = createCombatRulesSnapshot(room);

  const canAoO = testRules.canMakeOpportunityAttack(context, combatant);
  assert.equal(canAoO, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests productivos con srd_stunned
// ─────────────────────────────────────────────────────────────────────────────

test("Rules (producción): srd_stunned suprime DEX 18 (+4) y aplica penalty -2 AC", () => {
  const combatant = makeCombatant("hero-prod-dex");
  setStructuredDexterity(combatant, 18, 14); // +4 dex
  
  const room = makeRoom(combatant, [{
    instanceId: "inst-prod-stun", effectId: "srd_stunned",
    source: { type: "system" }, targets: ["hero-prod-dex"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);
  const context = createCombatRulesSnapshot(room);

  const result = Rules.totalArmorClass(context, combatant);
  // CA 14 - Destreza 4 - penalizador 2 = 8
  assert.equal(result.total, 8);
  assert.ok(result.parts.some(p => p.includes("DEX suprimido -4")));
  assert.ok(result.parts.some(p => p.includes("efectos -2")));
});

test("Rules (producción): srd_stunned con DEX 10 (0) solo aplica penalty -2 AC", () => {
  const combatant = makeCombatant("hero-prod-nodex");
  setStructuredDexterity(combatant, 10, 10); // 0 dex
  
  const room = makeRoom(combatant, [{
    instanceId: "inst-prod-stun2", effectId: "srd_stunned",
    source: { type: "system" }, targets: ["hero-prod-nodex"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);
  const context = createCombatRulesSnapshot(room);

  const result = Rules.totalArmorClass(context, combatant);
  // CA 10 - penalizador 2 = 8
  assert.equal(result.total, 8);
  // no dex suprimido
  assert.equal(result.parts.some(p => p.includes("DEX suprimido")), false);
  assert.ok(result.parts.some(p => p.includes("efectos -2")));
});

test("Rules (producción): srd_stunned con DEX 8 (-1) no suprime el penalizador y aplica penalty -2 AC", () => {
  const combatant = makeCombatant("hero-prod-lowdex");
  setStructuredDexterity(combatant, 8, 9); // -1 dex
  
  const room = makeRoom(combatant, [{
    instanceId: "inst-prod-stun3", effectId: "srd_stunned",
    source: { type: "system" }, targets: ["hero-prod-lowdex"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);
  const context = createCombatRulesSnapshot(room);

  const result = Rules.totalArmorClass(context, combatant);
  // CA 9 - penalizador 2 = 7
  assert.equal(result.total, 7);
  assert.equal(result.parts.some(p => p.includes("DEX suprimido")), false);
  assert.ok(result.parts.some(p => p.includes("efectos -2")));
});

test("Rules (producción): srd_stunned interactúa correctamente con legacy buffs", () => {
  const combatant = makeCombatant("hero-prod-buffs");
  setStructuredDexterity(combatant, 14, 12); // +2 dex
  combatant.buffs.push({
    id: "legacy-buff", name: "Barkskin", type: "ac",
    acBonus: 2, acBonusType: "natural_armor", condition: "none", durationType: "encounter"
  }); // +2 AC (legacy buff, stackea con todo por ahora)
  
  const room = makeRoom(combatant, [{
    instanceId: "inst-prod-stun4", effectId: "srd_stunned",
    source: { type: "system" }, targets: ["hero-prod-buffs"],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  }]);
  const context = createCombatRulesSnapshot(room);

  const result = Rules.totalArmorClass(context, combatant);
  // CA 12 - Destreza 2 + buff 2 - penalizador 2 = 10
  assert.equal(result.total, 10);
  assert.ok(result.parts.some(p => p.includes("buffs +2")));
  assert.ok(result.parts.some(p => p.includes("efectos -2")));
});

test("Rules (producción): duplicación de instancias de srd_stunned no stackea el -2 AC", () => {
  const combatant = makeCombatant("hero-prod-stack");
  setStructuredDexterity(combatant, 10, 10); // 0 dex
  
  const room = makeRoom(combatant, [
    {
      instanceId: "inst-prod-stun5", effectId: "srd_stunned",
      source: { type: "system" }, targets: ["hero-prod-stack"],
      appliedAtEvent: { type: "SystemInjected", round: 1 }
    },
    {
      instanceId: "inst-prod-stun6", effectId: "srd_stunned",
      source: { type: "system" }, targets: ["hero-prod-stack"],
      appliedAtEvent: { type: "SystemInjected", round: 2 }
    }
  ]);
  const context = createCombatRulesSnapshot(room);

  const result = Rules.totalArmorClass(context, combatant);
  // CA 10 - penalizador 2 = 8 (se aplica una sola vez por la política de stacking).
  assert.equal(result.total, 8);
  const penaltyParts = result.parts.filter(p => p.includes("efectos -2"));
  assert.equal(penaltyParts.length, 1, "El penalizador debe aparecer una sola vez en el breakdown de CA");
});

test("Rules (producción): srd_flat_footed suprime DEX positivo a la CA y bloquea AdO", () => {
  const combatant = makeCombatant("hero-flat-footed");
  setStructuredDexterity(combatant, 16, 13); // +3 dex
  
  const room = makeRoom(combatant, [{
    instanceId: "inst-flat", effectId: "srd_flat_footed",
    source: { type: "system" }, targets: ["hero-flat-footed"],
    appliedAtEvent: { type: "CombatStarted", round: 1 }
  }]);
  const context = createCombatRulesSnapshot(room);

  // 1. Verificar CA
  const result = Rules.totalArmorClass(context, combatant);
  // CA 13 - Destreza 3 = 10
  assert.equal(result.total, 10);
  assert.ok(result.parts.some(p => p.includes("DEX suprimido -3")), "Debe suprimir el bono de DEX");

  // 2. Verificar AdO
  const canOa = Rules.canMakeOpportunityAttack(context, combatant);
  assert.equal(canOa, false, "Flat-footed no permite Ataques de Oportunidad");
});
