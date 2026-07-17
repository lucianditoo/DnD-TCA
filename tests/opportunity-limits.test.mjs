import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { 
  Rules, 
  createCombatRulesSnapshot
} from "@dnd-tactical/shared";
import { makeTestRoom, makeTestCombatant } from "./test-utils.mjs";

describe("DT-007: Opportunity Attack Limits", () => {
  test("1. Limite Ordinario Estricto: 1 AdO por ronda si no tiene dotes", () => {
    const room = makeTestRoom({ combatants: [makeTestCombatant()] });
    const attacker = room.combatants[0]; // Heroe sin dotes especiales

    // Por defecto deberia estar en 0 (recien creado el mock y empezado el combate)
    assert.equal(attacker.stats.opportunityAttacksThisRound, 0, "Debe iniciar la ronda en 0.");

    let snapshot = createCombatRulesSnapshot(room);
    assert.equal(Rules.canMakeOpportunityAttack(snapshot, attacker), true, "Debe poder hacer el primer AdO.");

    // Simulamos que gasta su primer ataque de oportunidad
    attacker.stats.opportunityAttacksThisRound = 1;

    snapshot = createCombatRulesSnapshot(room);
    assert.equal(Rules.canMakeOpportunityAttack(snapshot, attacker), false, "Debe denegarle el segundo AdO en la misma ronda.");
  });

  test("2. Limite Elastico de Reflejos de Combate", () => {
    const room = makeTestRoom({ combatants: [makeTestCombatant()] });
    const attacker = room.combatants[0];
    
    // Le inyectamos la dote COMBAT_REFLEXES y DEX 14 (+2)
    attacker.abilityScores.dexterity = 14;
    attacker.featIds = ["srd_combat_reflexes"];
    
    // Limite esperado: 1 (base) + 2 (mod DEX) = 3 AdO por ronda.

    let snapshot = createCombatRulesSnapshot(room);
    assert.equal(Rules.canMakeOpportunityAttack(snapshot, attacker), true, "Puede hacer el 1er AdO");
    attacker.stats.opportunityAttacksThisRound = 1;

    snapshot = createCombatRulesSnapshot(room);
    assert.equal(Rules.canMakeOpportunityAttack(snapshot, attacker), true, "Puede hacer el 2do AdO");
    attacker.stats.opportunityAttacksThisRound = 2;

    snapshot = createCombatRulesSnapshot(room);
    assert.equal(Rules.canMakeOpportunityAttack(snapshot, attacker), true, "Puede hacer el 3er AdO");
    attacker.stats.opportunityAttacksThisRound = 3;

    // Al llegar al limite (3), el cuarto AdO es denegado
    snapshot = createCombatRulesSnapshot(room);
    assert.equal(Rules.canMakeOpportunityAttack(snapshot, attacker), false, "Debe denegarle el 4to AdO al superar su maximo.");
  });

  test("3. Restriccion Estricta de Objetivo Unico por Ronda", () => {
    const room = makeTestRoom({ combatants: [makeTestCombatant()] });
    const attacker = room.combatants[0];
    
    // Le inyectamos la dote COMBAT_REFLEXES y DEX 18 (+4)
    attacker.abilityScores.dexterity = 18;
    attacker.featIds = ["srd_combat_reflexes"];
    
    // Limite esperado: 1 (base) + 4 (mod DEX) = 5 AdO por ronda.
    let snapshot = createCombatRulesSnapshot(room);
    
    // Primer intento contra "Enemigo A" -> Valido
    assert.equal(Rules.canMakeOpportunityAttack(snapshot, attacker, "enemy-A"), true, "Puede hacer el 1er AdO contra Enemigo A");
    
    // Simulamos que el ataque ocurrio y mutamos los stats del atacante
    attacker.stats.opportunityAttacksThisRound = 1;
    attacker.stats.targetsAttackedThisRoundViaAoO = ["enemy-A"];
    
    // Segundo intento contra el MISMO "Enemigo A" -> Debe ser rechazado
    snapshot = createCombatRulesSnapshot(room);
    assert.equal(Rules.canMakeOpportunityAttack(snapshot, attacker, "enemy-A"), false, "Debe denegar un 2do AdO contra el MISMO enemigo en la misma ronda");
    
    // Tercer intento contra "Enemigo B" -> Valido
    assert.equal(Rules.canMakeOpportunityAttack(snapshot, attacker, "enemy-B"), true, "Puede hacer un 2do AdO contra un enemigo DIFERENTE");
  });
});
