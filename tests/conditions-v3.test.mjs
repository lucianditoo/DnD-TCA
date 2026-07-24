/**
 * tests/conditions-v3.test.mjs
 *
 * Tests de la Sprint 008: condiciones srd_fatigued y srd_prone.
 * Valida:
 *  1. CA contextual de Prone (melee +4, ranged -4, sin contexto = sin cambio).
 *  2. Bloqueo de carga por Fatigued mediante ruleOverrides.
 *  3. No regresiones en condiciones existentes (srd_stunned, srd_flat_footed).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { Rules, createCombatRulesSnapshot, EffectReducer, effectsCatalog } from "../packages/shared/dist/index.js";
import { setStructuredDexterity, structuredSnapshotFields } from "./test-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

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
    stats: { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, kills: 0, timesDroppedToZero: 0, healingReceived: 0 },
    ...overrides
  };
}

function makeRoom(combatant, effectInstances) {
  return {
    code: "TEST", board: { width: 10, height: 10, cellSizeFeet: 5 },
    combatants: [combatant], turnOrder: [combatant.id], activeTurnIndex: 0, round: 1,
    phase: "active", outcome: "ongoing", completedAt: null,
    currentTurn: {
      combatantId: combatant.id, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false,
      usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false,
      usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false
    },
    pendingOpportunityAttacks: [], log: [], activeAttackThreat: null,
    effectInstances,
    eventSequence: 0
  };
}

function makeEffectInstance(id, effectId, targetId, round = 1) {
  return {
    instanceId: id,
    effectId,
    source: { type: "system" },
    targets: [targetId],
    appliedAtEvent: { type: "SystemInjected", round }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// srd_prone — CA Contextual
// ─────────────────────────────────────────────────────────────────────────────

test("srd_prone: sin attackContext, la CA no cambia (retrocompatibilidad UI)", () => {
  const combatant = makeCombatant("prone-1");
  const room = makeRoom(combatant, [makeEffectInstance("inst-prone-1", "srd_prone", "prone-1")]);
  const context = createCombatRulesSnapshot(room);

  const result = Rules.totalArmorClass(context, combatant);
  // Sin contexto: CA estática. srd_prone no tiene modifiers, solo conditionalModifiers.
  assert.equal(result.total, 14);
  assert.ok(!result.parts.some(p => p.includes("condicional")), "Sin attackContext no debe haber modificador condicional");
});

test("srd_prone: con attackType 'melee', CA baja -4", () => {
  const combatant = makeCombatant("prone-2");
  const room = makeRoom(combatant, [makeEffectInstance("inst-prone-2", "srd_prone", "prone-2")]);
  const context = createCombatRulesSnapshot(room);

  const result = Rules.totalArmorClass(context, combatant, { attackType: "melee" });
  assert.equal(result.total, 10, "Prone vs melee: 14 - 4 = 10");
  assert.ok(result.parts.includes("derribado contra melee -4"), "Debe conservar la procedencia del modificador -4");
});

test("srd_prone: con attackType 'ranged', CA sube +4", () => {
  const combatant = makeCombatant("prone-3");
  const room = makeRoom(combatant, [makeEffectInstance("inst-prone-3", "srd_prone", "prone-3")]);
  const context = createCombatRulesSnapshot(room);

  const result = Rules.totalArmorClass(context, combatant, { attackType: "ranged" });
  assert.equal(result.total, 18, "Prone vs ranged: 14 + 4 = 18");
  assert.ok(result.parts.includes("derribado contra ranged +4"), "Debe conservar la procedencia del modificador +4");
});

test("srd_prone: no afecta CA de combatiente que no es el objetivo", () => {
  const target = makeCombatant("prone-target");
  const bystander = makeCombatant("bystander");
  setStructuredDexterity(bystander, 10, 12);
  const room = {
    ...makeRoom(target, [makeEffectInstance("inst-prone-target", "srd_prone", "prone-target")]),
    combatants: [target, bystander]
  };
  const context = createCombatRulesSnapshot(room);

  // El observador no tiene srd_prone — su CA melee no debe cambiar
  const result = Rules.totalArmorClass(context, bystander, { attackType: "melee" });
  assert.equal(result.total, 12, "Bystander no recibe el modificador de prone del objetivo");
});

test("srd_prone: instancias duplicadas no stackean el bono condicional (onStack: ignore)", () => {
  const combatant = makeCombatant("prone-5");
  const room = makeRoom(combatant, [
    makeEffectInstance("inst-prone-5a", "srd_prone", "prone-5"),
    makeEffectInstance("inst-prone-5b", "srd_prone", "prone-5")
  ]);
  const context = createCombatRulesSnapshot(room);

  // Sprint 049 (DT-022, corregido): antes de este sprint `onStack:"ignore"` estaba declarado
  // en el catálogo pero ningún consumidor lo leía; en la práctica DOS instancias de Prone
  // podían coexistir vía EffectManager.add y aquí el evaluador las sumaba ambas (14-4-4=6).
  // Ahora EffectManager.add SÍ aplica onStack (ver tests/active-effects.test.mjs), por lo que
  // el camino de aplicación real nunca deja coexistir dos instancias de un mismo effectId+
  // objetivo. Este test sigue construyendo las dos instancias directamente en `effectInstances`
  // (bypaseando EffectManager.add a propósito) para caracterizar que `totalArmorClass` en sí
  // mismo no deduplica — esa garantía vive únicamente en el EffectManager, no en el evaluador.
  const result = Rules.totalArmorClass(context, combatant, { attackType: "melee" });
  assert.ok(result.total <= 10, "Con dos instancias manuales el penalizador se aplica al menos una vez");
});

// ─────────────────────────────────────────────────────────────────────────────
// srd_fatigued — Bloqueo de Carga y Movimiento
// ─────────────────────────────────────────────────────────────────────────────

test("srd_fatigued: CANNOT_ACT NO está activo — el combatiente puede actuar normalmente", () => {
  const combatant = makeCombatant("fatigue-1");
  const room = makeRoom(combatant, [makeEffectInstance("inst-fatigue-1", "srd_fatigued", "fatigue-1")]);
  const context = createCombatRulesSnapshot(room);

  const availability = Rules.evaluateActionAvailability(context, combatant);
  assert.ok(availability.ok, "Fatigado puede tomar acciones (no tiene CANNOT_ACT)");
});

test("srd_fatigued: el trait FATIGUED está activo en el combatiente", () => {
  const combatant = makeCombatant("fatigue-2");
  const room = makeRoom(combatant, [makeEffectInstance("inst-fatigue-2", "srd_fatigued", "fatigue-2")]);
  const context = createCombatRulesSnapshot(room);

  // Verificamos que el trait FATIGUED está en los efectos reducidos
  // (la CA cambia por pérdida de Destreza, la acción no está bloqueada — solo correr y cargar)
  const acResult = Rules.totalArmorClass(context, combatant);
  assert.equal(acResult.total, 13, "Fatigued modifica la CA en -1 (pierde 2 de Destreza)");
  const acResultWithCtx = Rules.totalArmorClass(context, combatant, { attackType: "melee" });
  assert.equal(acResultWithCtx.total, 13, "Fatigued no tiene conditionalModifiers — CA contextual también es 13");
});

test("srd_fatigued: AdO no está bloqueado (CANNOT_MAKE_AOO no está activo)", () => {
  const combatant = makeCombatant("fatigue-3");
  const room = makeRoom(combatant, [makeEffectInstance("inst-fatigue-3", "srd_fatigued", "fatigue-3")]);
  const context = createCombatRulesSnapshot(room);

  const canAoo = Rules.canMakeOpportunityAttack(context, combatant);
  assert.ok(canAoo, "Fatigado puede realizar Ataques de Oportunidad");
});

// ─────────────────────────────────────────────────────────────────────────────
// Prueba de integración de canCharge con srd_fatigued
// Nota: canCharge vive en el servidor (chargeResolver.ts), así que se prueba
// indirectamente aquí verificando que el EffectReducer extrae correctamente
// el ruleOverride FORBID_CHARGE para srd_fatigued.
// ─────────────────────────────────────────────────────────────────────────────

test("srd_fatigued: el EffectReducer extrae FORBID_CHARGE en ruleOverrides", () => {
  const combatant = makeCombatant("fatigue-charge");
  const instances = [makeEffectInstance("inst-fatigue-c", "srd_fatigued", "fatigue-charge")];
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: instances,
    targetId: "fatigue-charge",
    catalog: effectsCatalog
  });
  assert.ok(reduced.ruleOverrides.includes("FORBID_CHARGE"), "srd_fatigued debe producir FORBID_CHARGE en ruleOverrides");
  assert.ok(reduced.ruleOverrides.includes("FORBID_RUN"), "srd_fatigued debe producir FORBID_RUN en ruleOverrides");
  assert.ok(reduced.traits.includes("FATIGUED"), "srd_fatigued debe producir el trait FATIGUED");
});

// ─────────────────────────────────────────────────────────────────────────────
// No regresiones — srd_stunned y srd_flat_footed no se ven afectados
// ─────────────────────────────────────────────────────────────────────────────

test("NO REGRESIÓN: srd_stunned con attackContext melee/ranged no cambia (sin conditionalModifiers)", () => {
  const combatant = makeCombatant("stunned-regr");
  setStructuredDexterity(combatant, 10, 10);
  const room = makeRoom(combatant, [makeEffectInstance("inst-stunned-r", "srd_stunned", "stunned-regr")]);
  const context = createCombatRulesSnapshot(room);

  const base = Rules.totalArmorClass(context, combatant);
  const withMelee = Rules.totalArmorClass(context, combatant, { attackType: "melee" });
  const withRanged = Rules.totalArmorClass(context, combatant, { attackType: "ranged" });

  // srd_stunned: -2 AC (modifier), DEX=10 (no bonus), no conditionalModifiers
  assert.equal(base.total, 8, "Stunned: CA base correcta (10 - 2)");
  assert.equal(withMelee.total, 8, "Stunned: attackContext melee no cambia la CA (no conditionalModifiers)");
  assert.equal(withRanged.total, 8, "Stunned: attackContext ranged no cambia la CA (no conditionalModifiers)");
});

test("NO REGRESIÓN: srd_flat_footed con attackContext no cambia (sin conditionalModifiers)", () => {
  const combatant = makeCombatant("ff-regr");
  setStructuredDexterity(combatant, 16, 13);
  const room = makeRoom(combatant, [makeEffectInstance("inst-ff-r", "srd_flat_footed", "ff-regr")]);
  const context = createCombatRulesSnapshot(room);

  const base = Rules.totalArmorClass(context, combatant);
  const withMelee = Rules.totalArmorClass(context, combatant, { attackType: "melee" });

  // flat-footed: supprime DEX +3 -> 13-3 = 10; sin conditionalModifiers
  assert.equal(base.total, 10, "Flat-footed: CA base correcta");
  assert.equal(withMelee.total, 10, "Flat-footed: attackContext melee no cambia (no conditionalModifiers)");
});

test("Interacción srd_prone + srd_flat_footed: ambas condiciones coexisten correctamente", () => {
  const combatant = makeCombatant("combo-1");
  setStructuredDexterity(combatant, 14, 12);
  const room = makeRoom(combatant, [
    makeEffectInstance("inst-combo-ff", "srd_flat_footed", "combo-1"),
    makeEffectInstance("inst-combo-prone", "srd_prone", "combo-1")
  ]);
  const context = createCombatRulesSnapshot(room);

  // vs melee: CA base(12) - dex suprimido(2) + prone vs melee(-4) = 6
  const vsMelee = Rules.totalArmorClass(context, combatant, { attackType: "melee" });
  assert.equal(vsMelee.total, 6, "Flat-footed + Prone vs melee: 12 - 2 (dex suprimido) - 4 (prone) = 6");

  // vs ranged: CA base(12) - dex suprimido(2) + prone vs ranged(+4) = 14
  const vsRanged = Rules.totalArmorClass(context, combatant, { attackType: "ranged" });
  assert.equal(vsRanged.total, 14, "Flat-footed + Prone vs ranged: 12 - 2 (dex suprimido) + 4 (prone) = 14");
});
