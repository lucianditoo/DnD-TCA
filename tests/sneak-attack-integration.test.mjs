import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyRoom,
  createCombatRulesSnapshot,
  canApplySneakAttack,
  getEffectiveSneakAttackDice,
  getAttackContextModifiers,
  effectsCatalog,
  CreatureTypeCatalog
} from "../packages/shared/dist/index.js";
import { resolveAttack } from "../apps/server/src/combat/attackResolver.ts";
import { structuredSnapshotFields } from "./test-utils.mjs";

function makeCombatant(id, overrides = {}) {
  return {
    id,
    name: "Test " + id,
    type: "player", controller: "player",
    hpCurrent: 20, hpMax: 20,
    ...structuredSnapshotFields(14),
    baseAttackBonus: 3, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    buffs: [],
    abilities: [],
    position: { x: 0, y: 0, zFeet: 0 },
    icon: "H", isStable: false,
    ruleTraits: overrides.creatureTypeId ? CreatureTypeCatalog.traitsFor(overrides.creatureTypeId) : [],
    ...overrides
  };
}

test("Sprint 016 - Sneak Attack Integration", async (t) => {
  await t.test("1. Base rogue against a flat-footed target receives +Nd6", () => {
    const room = createEmptyRoom();
    const rogue = makeCombatant("rogue", { featureIds: ["srd_sneak_attack_2d6"], sneakAttackDice: 2 });
    const flatFootedEnemy = makeCombatant("enemy", { type: "enemy", position: { x: 1, y: 0, zFeet: 0 } });
    
    // We add the srd_flat_footed effect to enemy
    room.effectInstances.push({
      instanceId: "flat-footed-1",
      effectId: "srd_flat_footed",
      source: { type: "system" },
      targets: ["enemy"],
      duration: { type: "permanent" }
    });
    
    room.combatants.push(rogue, flatFootedEnemy);
    const snapshot = createCombatRulesSnapshot(room);
    
    // Validate effective sneak attack dice
    assert.equal(getEffectiveSneakAttackDice(snapshot, rogue), 2);
    
    // Validate canApplySneakAttack
    assert.equal(canApplySneakAttack(snapshot, rogue, flatFootedEnemy, { attackType: "melee", distanceFeet: 5, requiresAttackRoll: true, dealsDamage: true }), true);
    
    // Validate resolveAttack injection (with constant dice roller for testing)
    const options = {
      source: {
        name: "Daga",
        attackType: "melee",
        targetAcType: "normal",
        abilityForAttack: "strength",
        maxRangeFeet: 5,
        criticalThreatFrom: 19,
        criticalMultiplier: 2,
        defaultDamage: 4
      },
      diceRoller: () => 3, // constant 3 per die
      concealment: getAttackContextModifiers(snapshot, rogue, flatFootedEnemy).byAttackType.melee.concealment
    };
    const attack = resolveAttack(snapshot, rogue, flatFootedEnemy, 20, 4, "Ataque Base", 0, options);
    assert.equal(attack.hits, true);
    
    // Base damage = 4. Precision damage = 2d6 = 2 * 3 = 6. Total = 10
    const precisionComponent = attack.damageBundle.components.find(c => c.category === "precision");
    assert.ok(precisionComponent, "Should have precision damage component");
    assert.equal(precisionComponent.amount, 6);
    assert.equal(precisionComponent.neverMultiply, true);
    assert.equal(attack.damage, 10);
  });

  await t.test("2. Base rogue against a flanked target receives +Nd6", () => {
    const room = createEmptyRoom();
    const rogue = makeCombatant("rogue", { featureIds: ["srd_sneak_attack_1d6"], sneakAttackDice: 1, position: { x: 0, y: 0, zFeet: 0 } });
    const ally = makeCombatant("ally", { position: { x: 2, y: 0, zFeet: 0 } });
    const enemy = makeCombatant("enemy", { type: "enemy", position: { x: 1, y: 0, zFeet: 0 } }); // between rogue and ally
    
    room.combatants.push(rogue, ally, enemy);
    const snapshot = createCombatRulesSnapshot(room);
    
    assert.equal(canApplySneakAttack(snapshot, rogue, enemy, { attackType: "melee", distanceFeet: 5, requiresAttackRoll: true, dealsDamage: true }), true);
  });

  await t.test("3. Rogue attempting precision at 35 ft fails (range > 30ft)", () => {
    const room = createEmptyRoom();
    const rogue = makeCombatant("rogue", { featureIds: ["srd_sneak_attack_1d6"], sneakAttackDice: 1, position: { x: 0, y: 0, zFeet: 0 } });
    const flatFootedEnemy = makeCombatant("enemy", { type: "enemy", position: { x: 7, y: 0, zFeet: 0 } }); // 35 ft distance (7 * 5)
    
    room.effectInstances.push({
      instanceId: "flat-footed-1",
      effectId: "srd_flat_footed",
      source: { type: "system" },
      targets: ["enemy"],
      duration: { type: "permanent" }
    });
    
    room.combatants.push(rogue, flatFootedEnemy);
    const snapshot = createCombatRulesSnapshot(room);
    
    assert.equal(canApplySneakAttack(snapshot, rogue, flatFootedEnemy, { attackType: "ranged", distanceFeet: 35, requiresAttackRoll: true, dealsDamage: true }), false, "Should fail > 30ft");
  });

  await t.test("4. Rogue attacking a Construct deals NO extra damage", () => {
    const room = createEmptyRoom();
    const rogue = makeCombatant("rogue", { featureIds: ["srd_sneak_attack_1d6"], sneakAttackDice: 1, position: { x: 0, y: 0, zFeet: 0 } });
    const constructEnemy = makeCombatant("enemy", { type: "enemy", creatureTypeId: "construct", position: { x: 1, y: 0, zFeet: 0 } });
    
    room.effectInstances.push({
      instanceId: "flat-footed-1",
      effectId: "srd_flat_footed",
      source: { type: "system" },
      targets: ["enemy"],
      duration: { type: "permanent" }
    });
    
    room.combatants.push(rogue, constructEnemy);
    const snapshot = createCombatRulesSnapshot(room);
    
    assert.equal(canApplySneakAttack(snapshot, rogue, constructEnemy, { attackType: "melee", distanceFeet: 5, requiresAttackRoll: true, dealsDamage: true }), false);
  });

  await t.test("5. Rule Engine correctly stacks base sneakAttackDice with an active effect", () => {
    const room = createEmptyRoom();
    const rogue = makeCombatant("rogue", { featureIds: ["srd_sneak_attack_1d6"], sneakAttackDice: 1 });
    
    // Inject mock effect in catalog
    effectsCatalog["mock_assassin_stance"] = {
      id: "mock_assassin_stance",
      name: "Assassin Stance",
      type: "buff",
      isStackable: true,
      traits: [],
      ruleOverrides: [],
      modifiers: [
        { type: "numeric", id: "mock_assassin_stance_mod", stat: "SNEAK_ATTACK_DICE", stackingGroup: "competence", stackingPolicy: "sum", value: 2 }
      ]
    };

    room.effectInstances.push({
      instanceId: "stance-1",
      effectId: "mock_assassin_stance",
      source: { type: "system" },
      targets: ["rogue"],
      duration: { type: "permanent" }
    });

    room.combatants.push(rogue);
    const snapshot = createCombatRulesSnapshot(room);
    
    assert.equal(getEffectiveSneakAttackDice(snapshot, rogue), 3); // 1 base + 2 stance
    
    // Clean up
    delete effectsCatalog["mock_assassin_stance"];
  });
});
