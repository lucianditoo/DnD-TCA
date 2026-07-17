import test from "node:test";
import assert from "node:assert/strict";
import { Rules, createCombatRulesSnapshot } from "@dnd-tactical/shared";
import { makeTestRoom, makeTestCombatant } from "./test-utils.mjs";

test("actionProvokesOpportunityAttack returns true if spell provokes", () => {
  const room = makeTestRoom();
  const caster = makeTestCombatant({ id: "caster", type: "pc", position: { x: 0, y: 0, zFeet: 0 } });
  const enemy = makeTestCombatant({ id: "enemy", type: "enemy", position: { x: 1, y: 0, zFeet: 0 } });
  room.combatants = [caster, enemy];
  
  const snapshot = createCombatRulesSnapshot(room);
  assert.equal(Rules.actionProvokesOpportunityAttack(snapshot, caster, "cast-spell"), true);
});

test("actionProvokesOpportunityAttack returns true if ranged attack provokes", () => {
  const room = makeTestRoom();
  const archer = makeTestCombatant({ id: "archer", type: "pc", position: { x: 0, y: 0, zFeet: 0 } });
  const enemy = makeTestCombatant({ id: "enemy", type: "enemy", position: { x: 1, y: 0, zFeet: 0 } });
  room.combatants = [archer, enemy];
  
  const snapshot = createCombatRulesSnapshot(room);
  assert.equal(Rules.actionProvokesOpportunityAttack(snapshot, archer, "ranged-attack"), true);
});

test("actionProvokesOpportunityAttack returns false if enemy is not threatening", () => {
  const room = makeTestRoom();
  const caster = makeTestCombatant({ id: "caster", type: "pc", position: { x: 0, y: 0, zFeet: 0 } });
  const enemy = makeTestCombatant({ id: "enemy", type: "enemy", position: { x: 5, y: 0, zFeet: 0 } });
  room.combatants = [caster, enemy];
  
  const snapshot = createCombatRulesSnapshot(room);
  assert.equal(Rules.actionProvokesOpportunityAttack(snapshot, caster, "cast-spell"), false);
});

test("canMakeOpportunityAttack accounts for Combat Reflexes feat", () => {
  const room = makeTestRoom();
  const enemy = makeTestCombatant({ 
    id: "enemy", 
    type: "enemy",
    position: { x: 0, y: 0, zFeet: 0 },
    featIds: ["srd_combat_reflexes"],
    abilityScores: { strength: 10, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    stats: {
      opportunityAttacksThisRound: 1,
      opportunityAttacksMade: 0,
      damageDealt: 0,
      damageTaken: 0,
      distanceMovedFeet: 0,
      attacksMade: 0,
      hits: 0,
      misses: 0,
      kills: 0,
      timesDroppedToZero: 0,
      healingReceived: 0,
      targetsAttackedThisRoundViaAoO: []
    }
  });
  room.combatants = [enemy];

  const snapshot = createCombatRulesSnapshot(room);
  assert.equal(Rules.canMakeOpportunityAttack(snapshot, enemy, "target1"), true);
  
  enemy.stats.opportunityAttacksThisRound = 3;
  const snapshot2 = createCombatRulesSnapshot(room);
  assert.equal(Rules.canMakeOpportunityAttack(snapshot2, enemy, "target1"), false);
});

test("canMakeOpportunityAttack blocks same target multiple times", () => {
  const room = makeTestRoom();
  const enemy = makeTestCombatant({ 
    id: "enemy", 
    type: "enemy",
    position: { x: 0, y: 0, zFeet: 0 },
    featIds: ["srd_combat_reflexes"],
    abilityScores: { strength: 10, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    stats: {
      opportunityAttacksThisRound: 1,
      opportunityAttacksMade: 1,
      damageDealt: 0,
      damageTaken: 0,
      distanceMovedFeet: 0,
      attacksMade: 0,
      hits: 0,
      misses: 0,
      kills: 0,
      timesDroppedToZero: 0,
      healingReceived: 0,
      targetsAttackedThisRoundViaAoO: ["target1"]
    }
  });
  room.combatants = [enemy];

  const snapshot = createCombatRulesSnapshot(room);
  assert.equal(Rules.canMakeOpportunityAttack(snapshot, enemy, "target1"), false);
  assert.equal(Rules.canMakeOpportunityAttack(snapshot, enemy, "target2"), true);
});
