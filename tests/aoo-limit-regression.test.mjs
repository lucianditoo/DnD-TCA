import { advanceTurn } from "../apps/server/src/combat/turnManager.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { Rules } from "@dnd-tactical/shared";
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

  spent.stats.movementOpportunityTargetsThisRound = ["enemy"];
  const room = makeRoom(spent);
  room.turnOrder = [spent.id];
  room.activeTurnIndex = 0;
  const round = room.round;
  advanceTurn(room);
  assert.equal(room.round, round + 1);
  const reset = room.combatants[0];
  assert.equal(reset.stats.opportunityAttacksThisRound, 0);
  assert.deepEqual(reset.stats.movementOpportunityTargetsThisRound, []);
  assert.equal(Rules.canMakeOpportunityAttack(makeRoom(reset), reset), true);
});

test("AOO-03 (d): provocaciones independientes", () => {
  const base = makeTestCombatant();
  const combatant = makeTestCombatant({
    featIds: ["srd_combat_reflexes"],
    abilityScores: { ...base.abilityScores, dexterity: 18 },
    stats: { ...base.stats, opportunityAttacksThisRound: 1, targetsAttackedThisRoundViaAoO: ["enemy-1"] }
  });
  const room = makeRoom(combatant);
  assert.equal(Rules.canMakeOpportunityAttack(room, combatant, "enemy-1"), true, "Una provocación independiente puede gastar el cupo restante");
  assert.equal(Rules.canMakeOpportunityAttack(room, combatant, "enemy-2"), true, "Objetivo distinto dentro del limite: permitido.");
});
