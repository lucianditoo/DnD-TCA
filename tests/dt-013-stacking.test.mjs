import test from "node:test";
import assert from "node:assert/strict";
import { Rules, createRuleEvaluator, EffectReducer, createCombatRulesSnapshot, getEffectiveAttackRoutine, resolveMeleeTouchManeuver } from "../packages/shared/src/index.ts";
import { buffSchema } from "../packages/shared/src/schemas/commands/base.ts";
import { resolveAbility } from "../apps/server/src/combat/abilityResolver.ts";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

test("DT-013: dos aplicaciones reales de Haste no duplican ataque ni velocidad", () => {
  const target = makeTestCombatant();
  const room = makeTestRoom({ combatants: [target] });
  const ability = { name: "Haste", resolution: { kind: "effect", effectId: "srd_haste" } };
  const before = createCombatRulesSnapshot(room);
  const baseAttack = Rules.totalAttackBonus(before, before.combatants[0]).total;
  const baseSpeed = Rules.totalSpeedFeet(before, before.combatants[0]);
  resolveAbility(room, target, target, ability, null);
  const once = createCombatRulesSnapshot(room);
  assert.equal(Rules.totalAttackBonus(once, once.combatants[0]).total, baseAttack + 1);
  assert.equal(Rules.totalSpeedFeet(once, once.combatants[0]), baseSpeed + 10);
  resolveAbility(room, target, target, ability, null);
  const twice = createCombatRulesSnapshot(room);
  assert.equal(Rules.totalAttackBonus(twice, twice.combatants[0]).total, baseAttack + 1);
  assert.equal(Rules.totalSpeedFeet(twice, twice.combatants[0]), baseSpeed + 10);
  assert.equal(target.buffs.length, 2, "las duraciones independientes se conservan");
});

const instance = (id, effectId, targetId = "hero-test") => ({
  instanceId: id, effectId, source: { type: "creature", id: "same-caster" },
  targets: [targetId], appliedAtEvent: { type: "SystemInjected", round: 1 }
});
const definition = (modifiers = [], conditionalModifiers = []) => ({
  name: "Test", description: "fixture", traits: [], ruleOverrides: [], onStack: "ignore", modifiers, conditionalModifiers
});
const numeric = (id, stat, value, bonusType, mechanicalSource = id) => ({
  type: "numeric", id, stat, value, bonusType, mechanicalSource, stackingGroup: bonusType, stackingPolicy: "sum"
});

test("DT-013: legacy tipado, ActiveEffects y condicionales se reducen juntos; expirar el mayor revela el menor", () => {
  const actor = makeTestCombatant({ buffs: [{ id: "buff", name: "Arbitrary", source: "Display", stackingSource: "morale-a", attackBonusType: "morale", attackBonus: 2, remainingTurns: 1 }] });
  const catalog = {
    medium: definition([numeric("morale-b", "ATTACK", 3, "morale")]),
    large: definition([], [{ id: "morale-c", stat: "ATTACK", value: 5, bonusType: "morale", mechanicalSource: "morale-c", condition: { type: "attack_type", value: "melee" } }])
  };
  const evaluator = createRuleEvaluator(catalog);
  const room = makeTestRoom({ combatants: [actor], effectInstances: [instance("medium", "medium"), instance("large", "large")] });
  assert.equal(evaluator.totalAttackBonus(room, actor, { attackType: "melee" }).total, actor.baseAttackBonus + 5);
  assert.equal(evaluator.totalAttackBonus(room, actor, { attackType: "ranged" }).total, actor.baseAttackBonus + 3);
  room.effectInstances.pop();
  assert.equal(evaluator.totalAttackBonus(room, actor).total, actor.baseAttackBonus + 3);
  room.effectInstances.pop();
  assert.equal(evaluator.totalAttackBonus(room, actor).total, actor.baseAttackBonus + 2);
});

test("DT-013: excepciones suman fuentes mecánicas distintas, no aplicaciones repetidas ni causantes", () => {
  for (const type of ["dodge", "circumstance", "racial", "untyped"]) {
    const catalog = { a: definition([numeric("a", "AC", 2, type)]), b: definition([numeric("b", "AC", 3, type)]) };
    const instances = [instance("a1", "a"), { ...instance("a2", "a"), source: { type: "creature", id: "other-caster" } }, instance("b", "b")];
    const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-test", catalog });
    assert.equal(result.numericModifiers.AC.total, 5, type);
    assert.equal(result.numericModifiers.AC.bonuses.filter(t => t.status === "suppressed").length, 1);
    assert.deepEqual(result, EffectReducer.reduceEffectsForTarget({ effectInstances: instances.reverse(), targetId: "hero-test", catalog }));
  }
});

test("DT-013: tipos distintos acumulan y penalizadores tipados conservan el peor sin cancelar el bono", () => {
  const catalog = { a: definition([
    numeric("positive", "ATTACK", 3, "morale"), numeric("negative-a", "ATTACK", -2, "morale"),
    numeric("negative-b", "ATTACK", -4, "morale"), numeric("luck", "ATTACK", 2, "luck")
  ]) };
  const reduced = EffectReducer.reduceEffectsForTarget({ effectInstances: [instance("a", "a")], targetId: "hero-test", catalog });
  assert.equal(reduced.numericModifiers.ATTACK.total, 1);
});

test("DT-013: CA combina base/equipo y efectos por tipo; toque y pérdida de esquiva filtran antes de reducir", () => {
  const actor = makeTestCombatant({ intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 1, deflectionBonus: 3, miscArmorClassBonus: 0 } });
  const catalog = { a: definition([numeric("deflection", "AC", 2, "deflection"), numeric("armor", "AC", 4, "armor"), numeric("dodge", "AC", 2, "dodge")]) };
  const room = makeTestRoom({ combatants: [actor], effectInstances: [instance("a", "a")] });
  const evaluator = createRuleEvaluator(catalog);
  assert.equal(evaluator.totalArmorClass(room, actor).total, 20);
  assert.equal(evaluator.totalArmorClass(room, actor, { targetAcType: "touch" }).total, 16);
  assert.equal(evaluator.totalArmorClass(room, actor, { targetAcType: "touch", isFlatFootedOverride: true }).total, 13);
});

test("DT-013: buffs opacos no se reclasifican por nombre; schema y snapshot preservan metadatos nuevos", () => {
  const opaque = { id: "old", name: "Haste", source: "Display", attackBonus: 1, remainingTurns: 2 };
  const actor = makeTestCombatant({ buffs: [opaque, { ...opaque, id: "old2" }] });
  assert.equal(Rules.totalAttackBonus(makeTestRoom({ combatants: [actor] }), actor).total, actor.baseAttackBonus + 2);
  const typed = buffSchema.parse({ ...opaque, stackingSource: "known", attackBonusType: "morale" });
  actor.buffs = [typed];
  const snapshot = createCombatRulesSnapshot(makeTestRoom({ combatants: [actor] }));
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)).combatants[0].buffs, [typed]);
  actor.buffs[0].stackingSource = "changed";
  assert.equal(snapshot.combatants[0].buffs[0].stackingSource, "known");
  assert.equal(buffSchema.safeParse({ ...opaque, attackBonusType: "invented" }).success, false);
  assert.equal(buffSchema.safeParse({ ...opaque, attackBonusType: "morale" }).success, false);
});

test("DT-013: la mejora de un arma compite con las demás mejoras y no modifica el toque corporal", () => {
  const actor = makeTestCombatant({ buffs: [{ id: "other", name: "Mejora", source: "Display", stackingSource: "other", attackBonusType: "enhancement", attackBonus: 2, remainingTurns: 2 }] });
  const weapon = { ...instance("weapon", "srd_magic_weapon"), targets: undefined,
    targetItem: { combatantId: actor.id, itemId: actor.equipmentSlots.mainHandItemId } };
  const room = makeTestRoom({ combatants: [actor], effectInstances: [weapon] });
  assert.equal(getEffectiveAttackRoutine(room, actor)[0].effectiveAttackBonus, actor.baseAttackBonus + 2);
  actor.buffs = [];
  assert.equal(getEffectiveAttackRoutine(room, actor)[0].effectiveAttackBonus, actor.baseAttackBonus + 1);
  const touch = resolveMeleeTouchManeuver(room, actor, { flankingBonus: 0, touchArmorClass: 13 }, 10);
  assert.equal(touch.attackBonus, actor.baseAttackBonus);
  assert.equal(touch.hits, false);
});
