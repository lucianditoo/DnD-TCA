import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EffectReducer,
  canApplySneakAttack,
  composeConcealmentAssessment,
  createCatalogCombatant,
  createCombatRulesSnapshot,
  createEmptyRoom,
  getAttackContextModifiers
} from "../packages/shared/dist/index.js";
import {
  resolveAttack,
  resolveConcealment,
  resolveWeaponAttackSource
} from "../apps/server/src/combat/attackResolver.ts";
import { applyAttackMutations } from "../apps/server/src/commands/attackCommands.ts";

function definition(contribution) {
  return {
    name: contribution.label,
    description: "Fixture local de DEFENSE-CONCEALMENT",
    traits: [],
    modifiers: [],
    concealmentContributions: [contribution],
    ruleOverrides: [],
    onStack: "ignore"
  };
}

const PARTIAL_TARGET = {
  id: "partial-target",
  label: "niebla de prueba",
  stackingKey: "test-mist",
  perspective: "attacks_against_target",
  kind: "partial",
  missChancePercent: 20
};

const PARTIAL_ATTACKER = {
  id: "partial-attacker",
  label: "vision alterada de prueba",
  stackingKey: "test-vision",
  perspective: "attacks_by_target",
  kind: "partial",
  missChancePercent: 20
};

const TOTAL_TARGET = {
  id: "total-target",
  label: "oscuridad total de prueba",
  stackingKey: "test-darkness",
  perspective: "attacks_against_target",
  kind: "total",
  missChancePercent: 50
};

function instance(instanceId, effectId, targetId, sourceId = instanceId) {
  return {
    instanceId,
    effectId,
    source: { type: "environment", id: sourceId },
    targets: [targetId],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  };
}

function reduce(catalog, effectInstances, targets = [{ targetId: "target", perspective: "attacks_against_target" }]) {
  return EffectReducer.reduceConcealmentContributions({ catalog, effectInstances, targets });
}

function setupAttackRoom() {
  const room = createEmptyRoom("CONCEALMENT_UNIT");
  const attacker = createCatalogCombatant("bane", "heroes", 1, { type: "gm" });
  const target = createCatalogCombatant("canocrock", "enemies", 1, { type: "gm" });
  attacker.position = { x: 0, y: 0, zFeet: 0 };
  target.position = { x: 1, y: 0, zFeet: 0 };
  room.combatants.push(attacker, target);
  return { room, attacker, target };
}

test("DEFENSE-CONCEALMENT: none produce un assessment neutro y efimero", () => {
  const assessment = composeConcealmentAssessment(reduce({}, []));
  assert.deepEqual(assessment, {
    applies: false,
    kind: "none",
    missChancePercent: 0,
    directTargetingAllowed: true,
    requiresTargetSquare: false,
    opportunityAttackAllowed: true,
    labelParts: [],
    traces: [],
    visionTraces: []
  });
});

test("DEFENSE-CONCEALMENT: recoge perspectivas del defensor y del atacante", () => {
  const catalog = {
    partial_target: definition(PARTIAL_TARGET),
    partial_attacker: definition(PARTIAL_ATTACKER)
  };
  const reduced = reduce(
    catalog,
    [instance("z-target", "partial_target", "target"), instance("a-attacker", "partial_attacker", "attacker")],
    [
      { targetId: "target", perspective: "attacks_against_target" },
      { targetId: "attacker", perspective: "attacks_by_target" }
    ]
  );
  assert.equal(reduced.kind, "partial");
  assert.equal(reduced.missChancePercent, 20);
  assert.equal(reduced.traces.filter((trace) => trace.status === "applied").length, 1);
  assert.equal(reduced.traces.filter((trace) => trace.reason === "lower_precedence").length, 1);
});

test("DEFENSE-CONCEALMENT: deduplica por stackingKey, usa maximo y conserva trazas deterministas", () => {
  const duplicate = { ...PARTIAL_TARGET, id: "partial-duplicate" };
  const catalog = {
    total: definition(TOTAL_TARGET),
    partial: definition(PARTIAL_TARGET),
    duplicate: definition(duplicate)
  };
  const forward = reduce(catalog, [
    instance("partial-b", "duplicate", "target"),
    instance("total-a", "total", "target"),
    instance("partial-a", "partial", "target")
  ]);
  const reverse = reduce(catalog, [
    instance("partial-a", "partial", "target"),
    instance("total-a", "total", "target"),
    instance("partial-b", "duplicate", "target")
  ]);
  assert.deepEqual(reverse, forward);
  assert.equal(forward.kind, "total");
  assert.equal(forward.missChancePercent, 50);
  assert.equal(forward.traces.filter((trace) => trace.reason === "duplicate").length, 1);
  assert.equal(forward.traces.filter((trace) => trace.reason === "lower_precedence").length, 1);
  assert.equal(forward.traces.find((trace) => trace.effectInstanceId === "total-a")?.status, "applied");
});

test("DEFENSE-CONCEALMENT: total vence a partial en empate de porcentaje", () => {
  const partialFifty = { ...PARTIAL_TARGET, id: "partial-fifty", stackingKey: "test-smoke", missChancePercent: 50 };
  const reduced = reduce(
    { partial: definition(partialFifty), total: definition(TOTAL_TARGET) },
    [instance("partial", "partial", "target"), instance("total", "total", "target")]
  );
  assert.equal(reduced.kind, "total");
  assert.equal(reduced.traces.find((trace) => trace.effectInstanceId === "partial")?.reason, "lower_precedence");
});

test("DEFENSE-CONCEALMENT: rechaza porcentajes invalidos y semanticas contradictorias", () => {
  const invalid = { ...PARTIAL_TARGET, missChancePercent: 0 };
  assert.throws(() => reduce({ invalid: definition(invalid) }, [instance("invalid", "invalid", "target")]), /entre 1 y 100/i);
  const contradictory = { ...PARTIAL_TARGET, id: "contradictory", kind: "total", missChancePercent: 50 };
  assert.throws(
    () => reduce(
      { partial: definition(PARTIAL_TARGET), contradictory: definition(contradictory) },
      [instance("partial", "partial", "target"), instance("contradictory", "contradictory", "target")]
    ),
    /contradictorias/i
  );
});

test("DEFENSE-CONCEALMENT: el contexto productivo permanece none sin fuentes productivas", () => {
  const { room, attacker, target } = setupAttackRoom();
  const snapshot = createCombatRulesSnapshot(room);
  const tactical = getAttackContextModifiers(snapshot, attacker, target);
  assert.equal(tactical.byAttackType.melee.concealment.kind, "none");
  assert.equal(tactical.byAttackType.ranged.concealment.kind, "none");
  assert.equal("concealment" in room, false);
  assert.equal("concealment" in snapshot, false);
});

test("DEFENSE-CONCEALMENT: el d100 se tira solo tras superar CA y natural 20 no lo evita", () => {
  const { room, attacker, target } = setupAttackRoom();
  const snapshot = createCombatRulesSnapshot(room);
  const assessment = composeConcealmentAssessment(reduce({ partial: definition(PARTIAL_TARGET) }, [instance("partial", "partial", "target")]));
  const source = resolveWeaponAttackSource(attacker, "melee");
  const rolledSides = [];
  const miss = resolveAttack(snapshot, attacker, target, 20, 5, "ataque ocultado", 0, {
    source,
    concealment: assessment,
    diceRoller: (sides) => { rolledSides.push(sides); return sides === 100 ? 20 : 3; }
  });
  assert.equal(miss.attackRollHits, true);
  assert.equal(miss.hits, false);
  assert.equal(miss.damage, 0);
  assert.equal(miss.threatened, false);
  assert.deepEqual(rolledSides, [100]);
  const hpBefore = target.hpCurrent;
  applyAttackMutations(room, attacker, target, 20, 5, "ataque ocultado", miss);
  assert.equal(target.hpCurrent, hpBefore);
  assert.equal(attacker.stats.misses, 1);
  assert.match(room.log[0].message, /ocultacion parcial \(20%; d100 20\)/i);

  rolledSides.length = 0;
  const armorClass = getAttackContextModifiers(snapshot, attacker, target).byAttackType.melee;
  const acMiss = resolveAttack(snapshot, attacker, target, 1, 5, "fallo contra CA", 0, {
    source,
    concealment: assessment,
    cover: armorClass.cover,
    diceRoller: (sides) => { rolledSides.push(sides); return 100; }
  });
  assert.equal(acMiss.attackRollHits, false);
  assert.equal(acMiss.concealment.d100Roll, null);
  assert.deepEqual(rolledSides, []);
});

test("DEFENSE-CONCEALMENT: un d100 exitoso permite impacto pero nunca Ataque Furtivo", () => {
  const { room, attacker, target } = setupAttackRoom();
  attacker.featureIds = ["srd_sneak_attack_2d6"];
  attacker.sneakAttackDice = 2;
  room.effectInstances.push(instance("flat", "srd_flat_footed", target.id));
  const snapshot = createCombatRulesSnapshot(room);
  const assessment = composeConcealmentAssessment(reduce({ partial: definition(PARTIAL_TARGET) }, [instance("partial", "partial", "target")]));
  assert.equal(canApplySneakAttack(snapshot, attacker, target, undefined, assessment), false);
  const result = resolveAttack(snapshot, attacker, target, 20, 5, "ataque ocultado", 0, {
    source: resolveWeaponAttackSource(attacker, "melee"),
    concealment: assessment,
    diceRoller: (sides) => sides === 100 ? 21 : 6
  });
  assert.equal(result.hits, true);
  assert.equal(result.damage, 5);
  assert.equal(result.damageBundle.components.some((component) => component.category === "precision"), false);
});

test("DEFENSE-CONCEALMENT: la resolucion valida estrictamente el oraculo porcentual", () => {
  const assessment = composeConcealmentAssessment(reduce({ partial: definition(PARTIAL_TARGET) }, [instance("partial", "partial", "target")]));
  assert.throws(() => resolveConcealment(true, assessment, () => 0), /invalida/i);
  assert.equal(resolveConcealment(true, assessment, () => 20).missed, true);
  assert.equal(resolveConcealment(true, assessment, () => 21).missed, false);
});
