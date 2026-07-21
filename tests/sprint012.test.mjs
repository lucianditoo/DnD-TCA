import assert from "node:assert/strict";
import test from "node:test";
import {
  CreatureTypeCatalog,
  canApplySneakAttack,
  createCatalogCombatant,
  createCombatRulesSnapshot,
  createEmptyRoom,
  getAttackContextModifiers
} from "../packages/shared/dist/index.js";
import {
  resolveAttack,
  resolveCriticalConfirmation,
  resolveWeaponAttackSource
} from "../apps/server/src/combat/attackResolver.ts";

function createPrecisionRoom(code = "SNEAK12") {
  const room = createEmptyRoom(code);
  const attacker = createCatalogCombatant("bane", "heroes", 1, { type: "gm" });
  const target = createCatalogCombatant("canocrock", "enemies", 1, { type: "gm" });
  attacker.position = { x: 0, y: 0, zFeet: 0 };
  target.position = { x: 1, y: 0, zFeet: 0 };
  room.combatants.push(attacker, target);
  room.effectInstances.push({
    instanceId: "flat-footed-sneak",
    effectId: "srd_flat_footed",
    source: { type: "system" },
    targets: [target.id],
    appliedAtEvent: { type: "CombatStarted", round: 1 }
  });
  return { room, attacker, target };
}

test("Sprint 012: el crítico multiplica el arma pero nunca los dados de Ataque Furtivo", () => {
  const { room, attacker, target } = createPrecisionRoom();
  const snapshot = createCombatRulesSnapshot(room);
  const attack = resolveAttack(
    snapshot,
    attacker,
    target,
    20,
    5,
    "ataque furtivo crítico",
    0,
    { source: resolveWeaponAttackSource(attacker, "melee"), diceRoller: () => 6, concealment: getAttackContextModifiers(snapshot, attacker, target).byAttackType.melee.concealment }
  );

  assert.equal(attack.threatened, true);
  assert.deepEqual(attack.damageBundle.components.map((component) => ({ category: component.category, amount: component.amount, neverMultiply: component.neverMultiply })), [
    { category: "base", amount: 5, neverMultiply: false },
    { category: "precision", amount: 6, neverMultiply: true }
  ]);

  const confirmed = resolveCriticalConfirmation(snapshot, attacker, target, {
    attackerId: attacker.id,
    targetId: target.id,
    initialD20Roll: 20,
    attackBonusTotal: attack.attackBonusTotal,
    targetArmorClass: attack.targetArmorClass,
    normalDamageBundle: attack.damageBundle,
    criticalThreatFrom: attack.threatFrom,
    criticalMultiplier: 2,
    weaponName: attack.weaponName,
    isFullAttack: false,
    label: "ataque furtivo crítico"
  }, 20, null);

  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.damage, 16, "5 × 2 de arma + 6 de precisión");
  assert.equal(confirmed.damageBundle.components.find((component) => component.category === "base").amount, 10);
  assert.equal(confirmed.damageBundle.components.find((component) => component.category === "precision").amount, 6);
});

test("Sprint 012: undead y construct reciben inmunidades raciales inmutables a precisión", () => {
  assert.deepEqual(CreatureTypeCatalog.traitsFor("undead"), ["IMMUNE_TO_CRITICAL_HITS", "IMMUNE_TO_PRECISION_DAMAGE"]);
  assert.deepEqual(CreatureTypeCatalog.traitsFor("construct"), ["IMMUNE_TO_CRITICAL_HITS", "IMMUNE_TO_PRECISION_DAMAGE"]);

  const { room, attacker, target } = createPrecisionRoom("IMMUNE12");
  target.creatureTypeId = "undead";
  target.ruleTraits = CreatureTypeCatalog.traitsFor("undead");
  const snapshot = createCombatRulesSnapshot(room);
  const attack = resolveAttack(snapshot, attacker, target, 20, 5, "ataque contra undead", 0, {
    source: resolveWeaponAttackSource(attacker, "melee"),
    diceRoller: () => 6,
    concealment: getAttackContextModifiers(snapshot, attacker, target).byAttackType.melee.concealment
  });

  assert.equal(canApplySneakAttack(snapshot, attacker, target), false);
  assert.equal(attack.damageBundle.total, 5);
  assert.equal(attack.damageBundle.components.some((component) => component.category === "precision"), false);
  assert.equal(attack.threatened, false, "la inmunidad racial también impide abrir confirmación crítica");
});

test("Sprint 012: la precisión ranged se limita autoritativamente a 30 pies", () => {
  const { room, attacker, target } = createPrecisionRoom("RANGE12");
  target.position = { x: 6, y: 0, zFeet: 0 };
  const atThirtyFeet = createCombatRulesSnapshot(room);
  assert.equal(canApplySneakAttack(atThirtyFeet, attacker, target, {
    attackType: "ranged", distanceFeet: 30, requiresAttackRoll: true, dealsDamage: true
  }), true);
  assert.equal(canApplySneakAttack(atThirtyFeet, attacker, target, {
    attackType: "ranged", distanceFeet: 35, requiresAttackRoll: true, dealsDamage: true
  }), false);
});

test("Sprint 012: el inicializador rechaza snapshots que pierden sus fuentes V3", () => {
  const { room, attacker } = createPrecisionRoom("INVARIANT12");
  attacker.inventory = undefined;
  attacker.equipmentSlots = undefined;
  assert.throws(() => createCombatRulesSnapshot(room), /inventory|equipmentSlots/i);
});
