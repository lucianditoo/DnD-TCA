import test from "node:test";
import assert from "node:assert/strict";
import { EffectManager, EffectQueries, effectsCatalog } from "@dnd-tactical/shared";

test("ActiveEffects Infrastructure Core", async (t) => {
  const baseRoom = {
    code: "TEST-ROOM",
    board: { width: 10, height: 10, cellSizeFeet: 5 },
    combatants: [],
    turnOrder: [],
    activeTurnIndex: 0,
    round: 1,
    phase: "active",
    outcome: "ongoing",
    completedAt: null,
    currentTurn: {
      combatantId: null, movementUsedFeet: 0, usedMoveAction: false,
      usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false,
      usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false,
      attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false
    },
    pendingOpportunityAttacks: [],
    log: [],
    activeAttackThreat: null,
    effectInstances: []
  };

  await t.test("Equality Test - Inmutabilidad estricta y reversibilidad", () => {
    const newEffect = {
      instanceId: "inst-1",
      effectId: "__INFRASTRUCTURE_SAMPLE__",
      source: { type: "system" },
      targets: ["target-A"],
      appliedAtEvent: { type: "SystemInjected", round: 1 }
    };
    
    // @ts-ignore - Ignoramos tipado de room parcial solo para el test
    const roomWithEffect = EffectManager.add(baseRoom, newEffect);
    assert.equal(roomWithEffect.effectInstances.length, 1);
    
    // @ts-ignore
    const roomReverted = EffectManager.remove(roomWithEffect, "inst-1");
    assert.equal(roomReverted.effectInstances.length, 0);
    
    // Validar inmutabilidad de la base
    assert.equal(baseRoom.effectInstances.length, 0);

    // Validar reversibilidad e inmutabilidad estructural
    assert.deepEqual(roomReverted, baseRoom);
    assert.notStrictEqual(roomWithEffect, baseRoom);
    assert.notStrictEqual(roomWithEffect.effectInstances, baseRoom.effectInstances);
  });

  await t.test("Unknown Effect Test - Lanza error si no existe en el catálogo", () => {
    const unknownEffect = {
      instanceId: "inst-2",
      effectId: "THIS_EFFECT_DOES_NOT_EXIST",
      source: { type: "system" },
      targets: ["target-A"],
      appliedAtEvent: { type: "SystemInjected", round: 1 }
    };

    // @ts-ignore
    assert.throws(() => EffectManager.add(baseRoom, unknownEffect), {
      message: /Unknown Effect: THIS_EFFECT_DOES_NOT_EXIST no existe en el catálogo/
    });
  });

  await t.test("Multiple Targets y removeMany", () => {
    const nextRoom = EffectManager.add(baseRoom, {
      instanceId: "inst-mult-1",
      effectId: "__INFRASTRUCTURE_SAMPLE__",
      source: { type: "system" },
      targets: ["target-A", "target-B"],
      appliedAtEvent: { type: "SystemInjected", round: 1 }
    });

    const room2 = EffectManager.add(nextRoom, {
      instanceId: "inst-mult-2",
      effectId: "__INFRASTRUCTURE_SAMPLE__",
      source: { type: "system" },
      targets: ["target-C"],
      appliedAtEvent: { type: "SystemInjected", round: 1 }
    });

    const targetAEffects = EffectQueries.getByTarget(room2, "target-A");
    assert.equal(targetAEffects.length, 1);
    assert.equal(targetAEffects[0].instanceId, "inst-mult-1");

    const targetCEffects = EffectQueries.getByTarget(room2, "target-C");
    assert.equal(targetCEffects.length, 1);

    // removeMany
    const room3 = EffectManager.removeMany(room2, ["inst-mult-1", "inst-mult-2", "no-existe"]);
    assert.equal(room3.effectInstances.length, 0);

    const room4 = EffectManager.removeMany(room2, []);
    assert.strictEqual(room4, room2); // Misma referencia
  });

  await t.test("Structural Immutability - Defensa contra mutaciones por referencia", () => {
    const targets = ["target-A"];
    const source = { type: "system" };
    const appliedEvent = { type: "SystemInjected", round: 1 };

    const instance = {
      instanceId: "inst-immutable",
      effectId: "__INFRASTRUCTURE_SAMPLE__",
      source,
      targets,
      appliedAtEvent: appliedEvent
    };

    // @ts-ignore
    const nextRoom = EffectManager.add(baseRoom, instance);

    // Mutar los originales
    targets.push("target-B");
    // @ts-ignore
    source.id = "changed";
    appliedEvent.round = 99;

    const storedInstance = nextRoom.effectInstances[0];

    assert.deepEqual(storedInstance.targets, ["target-A"]);
    assert.equal(storedInstance.source.id, undefined);
    assert.equal(storedInstance.appliedAtEvent.round, 1);
  });

  await t.test("Catalog is Structurally Inert and Neutral", () => {
    // 1. Verificamos que no contiene Traits mecánicos
    assert.deepEqual(
      effectsCatalog.__INFRASTRUCTURE_SAMPLE__.traits,
      []
    );
    assert.deepEqual(
      effectsCatalog.__INFRASTRUCTURE_SAMPLE__.modifiers,
      []
    );
    assert.deepEqual(
      effectsCatalog.__INFRASTRUCTURE_SAMPLE__.ruleOverrides,
      []
    );

    // 2. Verificación recursiva para descartar comportamiento inyectado (callbacks/functions)
    function assertNoFunctions(value, path = "effectsCatalog") {
      if (typeof value === "function") {
        assert.fail(`Se encontró una función en ${path}`);
      }
    
      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          assertNoFunctions(child, `${path}.${key}`);
        }
      }
    }

    assertNoFunctions(effectsCatalog);
  });

  await t.test("Serialización JSON determinista", () => {
    const effect = {
      instanceId: "inst-4",
      effectId: "__INFRASTRUCTURE_SAMPLE__",
      source: { type: "system" },
      targets: ["target-A"],
      appliedAtEvent: { type: "SystemInjected", round: 1 }
    };

    // @ts-ignore
    const room = EffectManager.add(baseRoom, effect);
    
    const stringified = JSON.stringify(room);
    const parsed = JSON.parse(stringified);
    
    assert.deepEqual(room, parsed);
  });
});
