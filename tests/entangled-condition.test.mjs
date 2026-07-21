import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EffectReducer,
  Rules,
  canRun,
  canUseFiveFootStep,
  createCombatRulesSnapshot,
  createRuleEvaluator,
  effectsCatalog,
  getEffectiveAbilityScore,
  validateMovePath
} from "@dnd-tactical/shared";
import { canCharge } from "../apps/server/src/combat/chargeResolver.js";
import { inventoryEquipment, makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

function effect(instanceId, effectId, targetId) {
  return {
    instanceId,
    effectId,
    source: { type: "system" },
    targets: [targetId],
    duration: { type: "permanent" },
    appliedAtEvent: 1
  };
}

function entangledRoom(combatant, extraEffects = [], roomOverrides = {}) {
  return makeTestRoom({
    combatants: [combatant],
    effectInstances: [effect("entangled-1", "srd_entangled", combatant.id), ...extraEffects],
    ...roomOverrides
  });
}

describe("Sprint 045 - Entangled Core", () => {
  it("proyecta ataque -2, DEX -4, CA y Reflejos derivados", () => {
    const combatant = makeTestCombatant({
      abilityScores: { strength: 14, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
      baseReflex: 1
    });
    const room = entangledRoom(combatant);

    assert.equal(Rules.totalAttackBonus(room, combatant, { abilityForAttack: "strength", attackType: "melee" }).total, 2);
    assert.equal(getEffectiveAbilityScore(room, combatant, "dexterity"), 10);
    assert.equal(Rules.totalArmorClass(room, combatant).total, 10);
    assert.equal(Rules.totalSavingThrow(room, combatant, "reflex").total, 1);
  });

  it("reduce velocidades 30→15, 20→10 y 15→7 con redondeo al final", () => {
    for (const [baseSpeedFeet, expected] of [[30, 15], [20, 10], [15, 7]]) {
      const combatant = makeTestCombatant({ baseSpeedFeet });
      const projection = Rules.getMovementSpeedProjection(entangledRoom(combatant), combatant);
      assert.equal(projection.total, expected);
      assert.equal(projection.beforeRate, baseSpeedFeet);
      assert.deepEqual([projection.rateNumerator, projection.rateDenominator], [1, 2]);
      assert.ok(projection.parts.includes("Entangled ×1/2"));
    }
  });

  it("deduplica instancias por stackingKey y conserva trazabilidad determinista", () => {
    const combatant = makeTestCombatant();
    const room = entangledRoom(combatant, [effect("entangled-2", "srd_entangled", combatant.id)]);
    const projection = Rules.getMovementSpeedProjection(room, combatant);
    const reduced = EffectReducer.reduceEffectsForTarget({ effectInstances: room.effectInstances, targetId: combatant.id, catalog: effectsCatalog });

    assert.equal(projection.total, 15);
    assert.equal(projection.rateTraces.filter((trace) => trace.status === "applied").length, 1);
    assert.equal(projection.rateTraces.filter((trace) => trace.status === "suppressed" && trace.reason === "stacking").length, 1);
    assert.equal(reduced.numericModifiers.ATTACK.total, -2);
    assert.equal(reduced.numericModifiers.DEXTERITY.total, -4);
    assert.equal(room.effectInstances.length, 2, "la deduplicación es una proyección y no altera el ciclo de vida");
  });

  it("compone tasas con stackingKey distintos y rechaza razones contradictorias", () => {
    const otherRate = {
      name: "Test rate",
      description: "Solo para comprobar composición del contrato.",
      traits: [],
      modifiers: [],
      movementRateContributions: [{ id: "other_rate", label: "Otra tasa ×2/3", stackingKey: "test:other-rate", numerator: 2, denominator: 3 }],
      ruleOverrides: [],
      onStack: "ignore"
    };
    const evaluator = createRuleEvaluator({ entangled: effectsCatalog.srd_entangled, other: otherRate });
    const combatant = makeTestCombatant();
    const room = makeTestRoom({
      combatants: [combatant],
      effectInstances: [effect("rate-a", "entangled", combatant.id), effect("rate-b", "other", combatant.id)]
    });
    assert.equal(evaluator.totalSpeedFeet(room, combatant), 10);

    const contradictoryCatalog = {
      a: { ...otherRate, movementRateContributions: [{ ...otherRate.movementRateContributions[0], stackingKey: "same", numerator: 1, denominator: 2 }] },
      b: { ...otherRate, movementRateContributions: [{ ...otherRate.movementRateContributions[0], id: "conflict", stackingKey: "same", numerator: 2, denominator: 3 }] }
    };
    assert.throws(() => EffectReducer.reduceMovementRateContributions({
      effectInstances: [effect("conflict-a", "a", combatant.id), effect("conflict-b", "b", combatant.id)],
      targetId: combatant.id,
      catalog: contradictoryCatalog
    }), /Razones de velocidad contradictorias/);
  });

  it("apila con Fatigued y Prone sin alterar sus reglas", () => {
    const combatant = makeTestCombatant({
      abilityScores: { strength: 14, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
    });
    const fatiguedRoom = entangledRoom(combatant, [effect("fatigued-1", "srd_fatigued", combatant.id)]);
    assert.equal(getEffectiveAbilityScore(fatiguedRoom, combatant, "dexterity"), 8);
    assert.equal(Rules.totalSpeedFeet(fatiguedRoom, combatant), 15);
    assert.equal(Rules.totalAttackBonus(fatiguedRoom, combatant, { abilityForAttack: "strength", attackType: "melee" }).total, 1);

    const proneRoom = entangledRoom(combatant, [effect("prone-1", "srd_prone", combatant.id)]);
    assert.equal(Rules.totalAttackBonus(proneRoom, combatant, { abilityForAttack: "strength", attackType: "melee" }).total, -2);
  });

  it("aplica la tasa después de la velocidad reducida por armadura", () => {
    const combatant = makeTestCombatant({ baseSpeedFeet: 30, ...inventoryEquipment("longsword", { armorCatalogId: "banded_mail" }) });
    const projection = Rules.getMovementSpeedProjection(entangledRoom(combatant), combatant);
    assert.equal(projection.beforeRate, 20);
    assert.equal(projection.total, 10);
  });

  it("mantiene terreno difícil como coste de ruta independiente", () => {
    const combatant = makeTestCombatant();
    const room = entangledRoom(combatant, [], {
      board: { width: 10, height: 10, cellSizeFeet: 5, difficultTerrainCells: ["1,0", "2,0"] }
    });
    const result = validateMovePath(room, combatant, [{ x: 1, y: 0 }, { x: 2, y: 0 }], Rules.totalSpeedFeet(room, combatant));
    assert.equal(result.ok, false);
    assert.match(result.error, /solo tiene 15 pies disponibles/);
  });

  it("FORBID_RUN y FORBID_CHARGE bloquean por contratos existentes", () => {
    const combatant = makeTestCombatant();
    const room = entangledRoom(combatant);
    assert.equal(canRun(room, combatant).ok, false);
    assert.match(canRun(room, combatant).error, /no puede correr/);
    assert.equal(canCharge(room, combatant).ok, false);
    assert.match(canCharge(room, combatant).error, /no puede cargar/);
  });

  it("el paso de 5 pies usa velocidad efectiva y terreno, sin rama por condición", () => {
    const normal = makeTestCombatant({ baseSpeedFeet: 30 });
    const normalRoom = entangledRoom(normal);
    assert.equal(canUseFiveFootStep(normalRoom, normal).ok, true);

    const slow = makeTestCombatant({ baseSpeedFeet: 10 });
    const slowRoom = entangledRoom(slow);
    assert.equal(Rules.totalSpeedFeet(slowRoom, slow), 5);
    assert.equal(canUseFiveFootStep(slowRoom, slow).ok, false);
    assert.match(canUseFiveFootStep(slowRoom, slow).error, /velocidad efectiva/);

    const terrainRoom = entangledRoom(normal, [], { board: { width: 10, height: 10, cellSizeFeet: 5, difficultTerrainCells: ["1,0"] } });
    assert.equal(validateMovePath(terrainRoom, normal, [{ x: 1, y: 0 }], 15, true).ok, false);
  });

  it("el snapshot conserva solo fuentes y efectos, nunca velocidad derivada", () => {
    const combatant = makeTestCombatant();
    const room = entangledRoom(combatant);
    const snapshot = createCombatRulesSnapshot(room);
    assert.equal(snapshot.effectInstances[0].effectId, "srd_entangled");
    assert.equal(Object.hasOwn(snapshot.combatants[0], "speedFeet"), false);
    assert.equal(Object.hasOwn(snapshot.combatants[0], "movementSpeedProjection"), false);
    assert.equal(Rules.totalSpeedFeet(snapshot, snapshot.combatants[0]), 15);
  });
});
