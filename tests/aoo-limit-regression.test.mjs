import test from "node:test";
import assert from "node:assert/strict";
import { Rules } from "../packages/shared/dist/index.js";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// AOO-03 (blindaje de regresión) — El límite de AdO por ronda ya está implementado
// desde el Sprint 032 (`rules.ts` canMakeOpportunityAttack + contadores del servidor).
// Este test NO añade comportamiento: fija el invariante para cerrar la deuda residual
// documentada en combat-rules-deviations.md (Apéndice A).
// ─────────────────────────────────────────────────────────────────────────────

function makeRoom(combatant) {
  return makeTestRoom({ combatants: [combatant] });
}

test("AOO-03 (a): sin Reflejos de Combate, el limite es 1 AdO por ronda", () => {
  const fresh = makeTestCombatant({ stats: { ...makeTestCombatant().stats, opportunityAttacksThisRound: 0 } });
  assert.equal(Rules.canMakeOpportunityAttack(makeRoom(fresh), fresh), true, "Con 0 AdO usados, puede reaccionar.");

  const spent = makeTestCombatant({ stats: { ...makeTestCombatant().stats, opportunityAttacksThisRound: 1 } });
  assert.equal(Rules.canMakeOpportunityAttack(makeRoom(spent), spent), false, "Con 1 AdO usado y sin dote, no puede reaccionar de nuevo.");
});

test("AOO-03 (b): con srd_combat_reflexes el limite es 1 + mod(Des)", () => {
  const base = makeTestCombatant();
  const withFeat = makeTestCombatant({
    featIds: ["srd_combat_reflexes"],
    abilityScores: { ...base.abilityScores, dexterity: 14 }, // mod +2 -> limite 3
    stats: { ...base.stats, opportunityAttacksThisRound: 2 }
  });
  assert.equal(Rules.canMakeOpportunityAttack(makeRoom(withFeat), withFeat), true, "2 usados < limite 3: aun puede.");

  const exhausted = makeTestCombatant({
    featIds: ["srd_combat_reflexes"],
    abilityScores: { ...base.abilityScores, dexterity: 14 },
    stats: { ...base.stats, opportunityAttacksThisRound: 3 }
  });
  assert.equal(Rules.canMakeOpportunityAttack(makeRoom(exhausted), exhausted), false, "3 usados = limite 3: agotado.");

  const negativeDex = makeTestCombatant({
    featIds: ["srd_combat_reflexes"],
    abilityScores: { ...base.abilityScores, dexterity: 6 }, // mod -2 -> max(0, -2) => limite 1
    stats: { ...base.stats, opportunityAttacksThisRound: 1 }
  });
  assert.equal(Rules.canMakeOpportunityAttack(makeRoom(negativeDex), negativeDex), false, "Des negativa no reduce el limite por debajo de 1.");
});

test("AOO-03 (c): el reinicio del contador por ronda restaura la reaccion (contrato del roundTickListener)", () => {
  const base = makeTestCombatant();
  const spent = makeTestCombatant({ stats: { ...base.stats, opportunityAttacksThisRound: 1 } });
  assert.equal(Rules.canMakeOpportunityAttack(makeRoom(spent), spent), false);

  // El servidor (roundTickListener, Sprint 032) pone el contador a 0 al cambiar de ronda;
  // este test fija que el oráculo puro responde al contador reiniciado.
  const reset = { ...spent, stats: { ...spent.stats, opportunityAttacksThisRound: 0, targetsAttackedThisRoundViaAoO: [] } };
  assert.equal(Rules.canMakeOpportunityAttack(makeRoom(reset), reset), true, "Contador reiniciado: puede reaccionar de nuevo.");
});

test("AOO-03 (d): restriccion DT-007 de objetivo unico por ronda", () => {
  const base = makeTestCombatant();
  const combatant = makeTestCombatant({
    featIds: ["srd_combat_reflexes"],
    abilityScores: { ...base.abilityScores, dexterity: 18 },
    stats: { ...base.stats, opportunityAttacksThisRound: 1, targetsAttackedThisRoundViaAoO: ["enemy-1"] }
  });
  const room = makeRoom(combatant);
  assert.equal(Rules.canMakeOpportunityAttack(room, combatant, "enemy-1"), false, "Mismo objetivo ya golpeado esta ronda: bloqueado.");
  assert.equal(Rules.canMakeOpportunityAttack(room, combatant, "enemy-2"), true, "Objetivo distinto dentro del limite: permitido.");
});
