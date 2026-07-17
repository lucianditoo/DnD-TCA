/**
 * tests/effects-reducer.test.mjs
 *
 * Test suite para el EffectReducer del Sprint 005.
 * Usa un catálogo de prueba local para no depender del catálogo productivo.
 * Cubre todos los casos requeridos en el plan de implementación aprobado.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { EffectReducer } from "../packages/shared/dist/effects/reducer.js";

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo de prueba (completamente local, nunca toca effectsCatalog)
// ─────────────────────────────────────────────────────────────────────────────
const testCatalog = {
  "bonus-morale-attack": {
    name: "Moral de combate", description: "Bonus de moral al ataque",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-morale-attack", stat: "ATTACK", stackingGroup: "morale", stackingPolicy: "highest_value", value: 2 }]
  },
  "bonus-morale-attack-alt": {
    name: "Moral alternativa", description: "Otro bonus de moral al ataque (mayor)",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-morale-attack-alt", stat: "ATTACK", stackingGroup: "morale", stackingPolicy: "highest_value", value: 4 }]
  },
  "bonus-circumstance-attack": {
    name: "Circunstancia al ataque", description: "Bonus circunstancial al ataque",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-circ-attack", stat: "ATTACK", stackingGroup: "circumstance", stackingPolicy: "highest_value", value: 1 }]
  },
  "bonus-ac-sum": {
    name: "Defensa en suma", description: "Bonus de CA que se apila",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-ac-sum", stat: "AC", stackingGroup: "deflection", stackingPolicy: "sum", value: 2 }]
  },
  "bonus-ac-sum-2": {
    name: "Defensa en suma 2", description: "Segundo bonus sumable a la CA",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-ac-sum-2", stat: "AC", stackingGroup: "deflection", stackingPolicy: "sum", value: 3 }]
  },
  "penalty-attack-lowest": {
    name: "Herida grave", description: "Penalizador de ataque por herida",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-penalty-atk-1", stat: "ATTACK", stackingGroup: "penalty", stackingPolicy: "lowest_value", value: -1 }]
  },
  "penalty-attack-more": {
    name: "Herida muy grave", description: "Penalizador más severo",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-penalty-atk-4", stat: "ATTACK", stackingGroup: "penalty", stackingPolicy: "lowest_value", value: -4 }]
  },
  "unique-source-dodge": {
    name: "Esquiva única", description: "Un sólo bonus por fuente",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-dodge", stat: "AC", stackingGroup: "dodge", stackingPolicy: "unique_by_source", value: 1 }]
  },
  "speed-bonus": {
    name: "Haste", description: "Bonus de velocidad",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-speed", stat: "SPEED", stackingGroup: "haste", stackingPolicy: "highest_value", value: 30 }]
  },
  "trait-effect": {
    name: "Ceguera", description: "Ciega al objetivo",
    traits: ["BLIND"], ruleOverrides: ["FORBID_CHARGE"], onStack: "accumulate",
    modifiers: []
  },
  "zero-value": {
    name: "Efecto cero", description: "Modificador de valor cero",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-zero", stat: "ATTACK", stackingGroup: "misc", stackingPolicy: "sum", value: 0 }]
  },
  "conflicting-policy-a": {
    name: "Política A", description: "Primera política del conflicto",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-conflict-a", stat: "ATTACK", stackingGroup: "conflict-group", stackingPolicy: "highest_value", value: 2 }]
  },
  "conflicting-policy-b": {
    name: "Política B", description: "Segunda política conflictiva",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [{ type: "numeric", id: "mod-conflict-b", stat: "ATTACK", stackingGroup: "conflict-group", stackingPolicy: "sum", value: 3 }]
  },
  "two-modifiers-same-instance": {
    name: "Doble modificador", description: "Un efecto con dos modificadores distintos",
    traits: [], ruleOverrides: [], onStack: "accumulate",
    modifiers: [
      { type: "numeric", id: "mod-dual-ac", stat: "AC", stackingGroup: "insight", stackingPolicy: "sum", value: 1 },
      { type: "numeric", id: "mod-dual-speed", stat: "SPEED", stackingGroup: "competence", stackingPolicy: "sum", value: 5 }
    ]
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function makeInstance(instanceId, effectId, targetId, source) {
  return {
    instanceId,
    effectId,
    source: source ?? { type: "creature", id: instanceId + "-src" },
    targets: [targetId],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Reducer: sin efectos aplicables devuelve ReducedEffects vacío", () => {
  const result = EffectReducer.reduceEffectsForTarget({
    effectInstances: [],
    targetId: "hero-1",
    catalog: testCatalog
  });
  assert.deepEqual(result.numericModifiers, {});
  assert.deepEqual(result.traits, []);
  assert.deepEqual(result.ruleOverrides, []);
});

test("Reducer: solo aplica efectos que incluyan el targetId", () => {
  const instances = [
    makeInstance("inst-a", "bonus-morale-attack", "hero-1"),
    makeInstance("inst-b", "bonus-morale-attack", "hero-2") // otro objetivo
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  // Solo inst-a aplica a hero-1, inst-b no
  assert.ok(result.numericModifiers["ATTACK"], "ATTACK debe existir");
  const applied = result.numericModifiers["ATTACK"].bonuses.filter(t => t.status === "applied");
  assert.equal(applied.length, 1);
  assert.equal(applied[0].effectInstanceId, "inst-a");
});

test("Reducer (highest_value): stacking de morale — el mayor bono de morale gana, el menor queda suppressed", () => {
  const instances = [
    makeInstance("inst-1", "bonus-morale-attack", "hero-1"),      // +2
    makeInstance("inst-2", "bonus-morale-attack-alt", "hero-1")   // +4
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  const atk = result.numericModifiers["ATTACK"];
  assert.ok(atk, "ATTACK debe existir");
  assert.equal(atk.total, 4, "Solo el bono mayor (+4) contribuye al total");
  const applied = atk.bonuses.filter(t => t.status === "applied");
  const suppressed = atk.bonuses.filter(t => t.status === "suppressed");
  assert.equal(applied.length, 1);
  assert.equal(suppressed.length, 1);
  assert.equal(suppressed[0].reason, "stacking");
  assert.equal(applied[0].value, 4);
});

test("Reducer (sum): dos bonos de deflección distintos se suman", () => {
  const instances = [
    makeInstance("inst-def-1", "bonus-ac-sum", "hero-1"),   // +2
    makeInstance("inst-def-2", "bonus-ac-sum-2", "hero-1")  // +3
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  const ac = result.numericModifiers["AC"];
  assert.ok(ac);
  assert.equal(ac.total, 5, "Sum debe sumar +2 + +3 = +5");
  assert.equal(ac.bonuses.filter(t => t.status === "applied").length, 2);
});

test("Reducer (lowest_value): penalizadores — lowest_value selecciona el más negativo algebraicamente", () => {
  const instances = [
    makeInstance("inst-pen-1", "penalty-attack-lowest", "hero-1"),  // -1
    makeInstance("inst-pen-4", "penalty-attack-more", "hero-1")     // -4
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  const atk = result.numericModifiers["ATTACK"];
  assert.ok(atk);
  assert.equal(atk.total, -4, "lowest_value selecciona el mínimo algebraico (-4), no el menos severo (-1)");
  const applied = atk.penalties.filter(t => t.status === "applied");
  assert.equal(applied.length, 1);
  assert.equal(applied[0].value, -4);
});

test("Reducer: bonos y penalizadores del mismo grupo no se mezclan entre sí", () => {
  // Aquí usamos dos grupos distintos para ATTACK: morale (bonus) y penalty (penalty)
  const instances = [
    makeInstance("inst-bonus", "bonus-morale-attack", "hero-1"),    // +2 morale
    makeInstance("inst-pen", "penalty-attack-lowest", "hero-1")     // -1 penalty
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  const atk = result.numericModifiers["ATTACK"];
  assert.ok(atk);
  // Total = +2 + (-1) = +1 (se aplican ambos desde grupos distintos)
  assert.equal(atk.total, 1);
  assert.equal(atk.bonuses.filter(t => t.status === "applied").length, 1);
  assert.equal(atk.penalties.filter(t => t.status === "applied").length, 1);
});

test("Reducer: grupos distintos de la misma stat no se mezclan (morale vs circumstance)", () => {
  const instances = [
    makeInstance("inst-mor", "bonus-morale-attack", "hero-1"),          // +2 morale
    makeInstance("inst-circ", "bonus-circumstance-attack", "hero-1")    // +1 circumstance
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  const atk = result.numericModifiers["ATTACK"];
  // Distintos grupos: ambos se aplican independientemente
  assert.equal(atk.total, 3, "Morale +2 y circumstance +1 son grupos distintos, ambos aplican: total +3");
});

test("Reducer: mismo grupo en distintas stats no se mezcla", () => {
  // bonus-ac-sum tiene 'deflection', bonus-morale-attack tiene 'morale' — distintos
  const instances = [
    makeInstance("inst-ac", "bonus-ac-sum", "hero-1"),   // AC +2 deflection
    makeInstance("inst-atk", "bonus-morale-attack", "hero-1") // ATTACK +2 morale
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  assert.equal(result.numericModifiers["AC"].total, 2, "AC debe ser +2");
  assert.equal(result.numericModifiers["ATTACK"].total, 2, "ATTACK debe ser +2");
});

test("Reducer (unique_by_source): una sola entrada por fuente sobrevive — elige la de mayor |value|", () => {
  const instances = [
    { instanceId: "inst-a", effectId: "unique-source-dodge", source: { type: "creature", id: "caster-1" }, targets: ["hero-1"], appliedAtEvent: { type: "SystemInjected", round: 1 } },
    { instanceId: "inst-b", effectId: "unique-source-dodge", source: { type: "creature", id: "caster-1" }, targets: ["hero-1"], appliedAtEvent: { type: "SystemInjected", round: 1 } },
    { instanceId: "inst-c", effectId: "unique-source-dodge", source: { type: "creature", id: "caster-2" }, targets: ["hero-1"], appliedAtEvent: { type: "SystemInjected", round: 1 } }
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  // caster-1 aparece en inst-a e inst-b (misma fuente → solo uno sobrevive)
  // caster-2 aparece en inst-c (fuente distinta → sobrevive)
  // Resultado: 2 aplicados (uno de caster-1, uno de caster-2)
  const ac = result.numericModifiers["AC"];
  assert.ok(ac);
  const applied = ac.bonuses.filter(t => t.status === "applied");
  const suppressed = ac.bonuses.filter(t => t.status === "suppressed");
  assert.equal(applied.length, 2, "Deben sobrevivir 2 entradas (una por fuente)");
  assert.equal(suppressed.length, 1, "Un duplicado de caster-1 debe quedar suprimido");
});

test("Reducer (unique_by_source): fuente sin id explícito lanza error", () => {
  const instances = [
    { instanceId: "inst-bad", effectId: "unique-source-dodge", source: { type: "creature" }, targets: ["hero-1"], appliedAtEvent: { type: "SystemInjected", round: 1 } }
  ];
  assert.throws(() => {
    EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  }, /unique_by_source/, "Debe rechazar fuente sin id en política unique_by_source");
});

test("Reducer (unique_by_source): fuente system:global explícita es aceptada", () => {
  const instances = [
    { instanceId: "inst-global", effectId: "unique-source-dodge", source: { type: "system" }, targets: ["hero-1"], appliedAtEvent: { type: "SystemInjected", round: 1 } }
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  assert.ok(result.numericModifiers["AC"]);
});

test("Reducer: políticas contradictorias en el mismo grupo lanza error explícito", () => {
  const instances = [
    makeInstance("inst-pol-a", "conflicting-policy-a", "hero-1"),
    makeInstance("inst-pol-b", "conflicting-policy-b", "hero-1")
  ];
  assert.throws(() => {
    EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  }, /Pol[ií]ticas contradictorias|contradicting|policy/, "Debe rechazar políticas distintas en el mismo grupo");
});

test("Reducer: modificadores de valor cero son omitidos y no afectan el stacking", () => {
  const instances = [
    makeInstance("inst-zero", "zero-value", "hero-1")
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  // No debe haber delta para ATTACK porque el value es 0
  assert.equal(result.numericModifiers["ATTACK"], undefined, "Un modificador de value=0 no debe aparecer en el resultado");
});

test("Reducer: una misma instancia puede aportar múltiples modificadores a distintas stats", () => {
  const instances = [
    makeInstance("inst-dual", "two-modifiers-same-instance", "hero-1")
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  assert.ok(result.numericModifiers["AC"], "Debe haber delta AC");
  assert.ok(result.numericModifiers["SPEED"], "Debe haber delta SPEED");
  assert.equal(result.numericModifiers["AC"].total, 1);
  assert.equal(result.numericModifiers["SPEED"].total, 5);
});

test("Reducer: traits y ruleOverrides se extraen y ordenan determinísticamente", () => {
  const instances = [
    makeInstance("inst-trait", "trait-effect", "hero-1")
  ];
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  assert.deepEqual(result.traits, ["BLIND"]);
  assert.deepEqual(result.ruleOverrides, ["FORBID_CHARGE"]);
});

test("Reducer: orden inverso de instancias produce el mismo resultado reducido (determinismo total)", () => {
  const instancesForward = [
    makeInstance("inst-a", "bonus-morale-attack", "hero-1"),
    makeInstance("inst-b", "bonus-morale-attack-alt", "hero-1")
  ];
  const instancesReversed = [
    makeInstance("inst-b", "bonus-morale-attack-alt", "hero-1"),
    makeInstance("inst-a", "bonus-morale-attack", "hero-1")
  ];
  const forward = EffectReducer.reduceEffectsForTarget({ effectInstances: instancesForward, targetId: "hero-1", catalog: testCatalog });
  const reversed = EffectReducer.reduceEffectsForTarget({ effectInstances: instancesReversed, targetId: "hero-1", catalog: testCatalog });
  
  assert.equal(forward.numericModifiers["ATTACK"].total, reversed.numericModifiers["ATTACK"].total, "Total debe ser igual en ambos ordenes");
  assert.equal(forward.numericModifiers["ATTACK"].bonuses[0].modifierId, reversed.numericModifiers["ATTACK"].bonuses[0].modifierId, "Primer traza debe ser la misma independientemente del orden de entrada");
});

test("Reducer: efectos de un targetId distinto no contaminan el cálculo", () => {
  const instances = [
    makeInstance("inst-hero", "speed-bonus", "hero-1"),
    makeInstance("inst-enemy", "speed-bonus", "enemy-1")
  ];
  const resultHero = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  const resultEnemy = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "enemy-1", catalog: testCatalog });
  
  assert.equal(resultHero.numericModifiers["SPEED"].total, 30);
  assert.equal(resultEnemy.numericModifiers["SPEED"].total, 30);
  // Cada resultado solo tiene 1 traza aplicada (la que corresponde a su target)
  assert.equal(resultHero.numericModifiers["SPEED"].bonuses.length, 1);
  assert.equal(resultEnemy.numericModifiers["SPEED"].bonuses.length, 1);
});

test("Reducer: lanza error si un ID de efecto aplicable no existe en el catálogo", () => {
  const instances = [
    makeInstance("inst-unknown", "effect-does-not-exist", "hero-1")
  ];
  assert.throws(() => {
    EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  }, /Unknown ActiveEffect: effectId="effect-does-not-exist", instanceId="inst-unknown", targetId="hero-1"/);
});

test("Reducer: NO lanza error si un ID de efecto desconocido no aplica al target actual", () => {
  const instances = [
    makeInstance("inst-unknown", "effect-does-not-exist", "hero-2"),
    makeInstance("inst-known", "speed-bonus", "hero-1")
  ];
  // No debería fallar porque hero-2 no está siendo evaluado
  const result = EffectReducer.reduceEffectsForTarget({ effectInstances: instances, targetId: "hero-1", catalog: testCatalog });
  assert.equal(result.numericModifiers["SPEED"].total, 30);
});
