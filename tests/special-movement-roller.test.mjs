import { describe, it } from "node:test";
import assert from "node:assert";
import { handleUseTacticalAction } from "../apps/server/src/commands/tacticalCommands.js";
import { applyDamage, canDisabledCombatantTakeAction, createCombatRulesSnapshot, effectsCatalog, getLifeStateProjection, getStandUpActionProfile, normalizeLifeStateAfterHpChange, roundTickListener } from "@dnd-tactical/shared";
import { rollDice } from "../apps/server/src/combat/diceRoller.js";
import { applyDisabledExertion } from "../apps/server/src/combat/lifeStatusEffects.js";
import { clients } from "../apps/server/src/room/roomStore.js";
import { structuredSnapshotFields } from "./test-utils.mjs";

describe("Sprint 022 - Stand Up & Percentile Roller", () => {
  it("rollDice(100) simula 2d10 (unidades y decenas)", () => {
    // Mock Math.random
    const originalRandom = Math.random;
    
    // Test 00 = 100
    Math.random = () => 0.05; // 0.05 * 10 = 0 (tens = 0) and units = 0
    let result = rollDice(100);
    assert.strictEqual(result, 100, "00 is 100 in physical d100");

    // Test 20 and 5
    let callCount = 0;
    Math.random = () => {
      callCount++;
      return callCount === 1 ? 0.25 : 0.55; // tens = 2, units = 5 => 25
    };
    result = rollDice(100);
    assert.strictEqual(result, 25, "2 and 5 should be 25");

    Math.random = originalRandom;
  });

  const mockSocket = { readyState: 1, OPEN: 1, send: () => {} };
  clients.set(mockSocket, { id: "actor1", name: "Actor", role: "player", roomCode: "room1" });

  it("stand-up consume la mitad de la velocidad", () => {
    const room = {
      id: "room1",
      phase: "active",
      board: { width: 10, height: 10, cellSizeFeet: 5 },
      combatants: [
        {
          id: "c1",
          name: "Hero",
          type: "player",
          position: { x: 0, y: 0, zFeet: 0 },
          baseSpeedFeet: 30,
          hp: 10,
          hpMax: 10,
          abilities: [],
          buffs: [],
          stats: { distanceMovedFeet: 0 },
          controlledBy: { type: "player", participantId: "actor1" },
          ...structuredSnapshotFields(10)
        }
      ],
      turnOrder: ["c1"],
      activeTurnIndex: 0,
      currentTurn: { combatantId: "c1", attacksMade: 0, movementUsedFeet: 0, attackMode: "none" },
      effectInstances: [
        { id: "e123", effectId: "srd_prone", targets: ["c1"], sourceId: "c1", roundsRemaining: 10 }
      ],
      pendingOpportunityAttacks: [],
      participants: [{ id: "actor1", name: "Player 1", role: "player" }],
      log: []
    };

    handleUseTacticalAction(room, {
      type: "use-tactical-action",
      action: "stand-up",
      combatantId: "c1",
      actorId: "actor1"
    });

    assert.strictEqual(room.currentTurn.movementUsedFeet, 15, "Debe consumir 15 pies (30 / 2)");
    assert.strictEqual(room.effectInstances.length, 0, "Debe remover srd_prone");
  });

  it("stand-up genera AdO obligatoriamente de los enemigos que amenazan", () => {
    const room = {
      id: "room1",
      phase: "active",
      board: { width: 10, height: 10, cellSizeFeet: 5 },
      combatants: [
        {
          id: "c1",
          name: "Hero",
          type: "player",
          position: { x: 0, y: 0, zFeet: 0 },
          baseSpeedFeet: 30,
          hp: 10,
          hpMax: 10,
          abilities: [],
          buffs: [],
          stats: { distanceMovedFeet: 0 },
          controlledBy: { type: "player", participantId: "actor1" },
          ...structuredSnapshotFields(10)
        },
        {
          id: "e1",
          name: "Enemy",
          type: "enemy",
          position: { x: 1, y: 0, zFeet: 0 },
          baseSpeedFeet: 30,
          hp: 10,
          hpMax: 10,
          abilities: [],
          buffs: [],
          baseAttackBonus: 0,
          stats: { distanceMovedFeet: 0 },
          ...structuredSnapshotFields(10)
        }
      ],
      turnOrder: ["c1", "e1"],
      activeTurnIndex: 0,
      currentTurn: { combatantId: "c1", attacksMade: 0, movementUsedFeet: 0, attackMode: "none" },
      effectInstances: [
        { id: "e123", effectId: "srd_prone", targets: ["c1"], sourceId: "c1", roundsRemaining: 10 }
      ],
      pendingOpportunityAttacks: [],
      participants: [{ id: "actor1", name: "Player 1", role: "player" }],
      log: []
    };

    handleUseTacticalAction(room, {
      type: "use-tactical-action",
      action: "stand-up",
      combatantId: "c1",
      actorId: "actor1"
    });

    assert.strictEqual(room.pendingOpportunityAttacks.length, 1, "Debe generar 1 AdO");
    assert.strictEqual(room.pendingOpportunityAttacks[0].attackerId, "e1");
  });

  it("Diehard estabiliza inmediatamente en la frontera negativa y conserva consciencia Disabled", () => {
    const combatant = {
      id: "diehard-hero",
      name: "Diehard Hero",
      type: "player",
      hpCurrent: -5,
      hpMax: 20,
      isStable: false,
      ...structuredSnapshotFields(10),
      featIds: ["srd_diehard"]
    };

    normalizeLifeStateAfterHpChange(combatant);
    assert.strictEqual(combatant.isStable, true);

    const projection = getLifeStateProjection(combatant);
    assert.strictEqual(projection.conscious, true);
    assert.strictEqual(projection.canAct, true);
    assert.strictEqual(projection.usesDisabledActionEconomy, true);
    assert.strictEqual(projection.bleedsAtRoundStart, false);
  });

  it("roundTickListener no aplica sangrado a Diehard en HP negativos", () => {
    const combatant = {
      id: "diehard-hero",
      name: "Diehard Hero",
      type: "player",
      hpCurrent: -5,
      hpMax: 20,
      isStable: false,
      stats: { opportunityAttacksThisRound: 0, targetsAttackedThisRoundViaAoO: [] },
      ...structuredSnapshotFields(10),
      featIds: ["srd_diehard"]
    };
    normalizeLifeStateAfterHpChange(combatant);
    const room = {
      code: "room-diehard",
      combatants: [combatant],
      log: []
    };

    const nextRoom = roundTickListener(room, { type: "RoundStarted", round: 2, sequence: 1 });
    assert.strictEqual(nextRoom.combatants[0].hpCurrent, -5);
    assert.strictEqual(nextRoom.combatants[0].isStable, true);
  });

  it("Diehard usa una sola acción Disabled y el esfuerzo estándar respeta el umbral fatal", () => {
    const combatant = {
      id: "diehard-action",
      name: "Diehard Action",
      type: "player",
      hpCurrent: 1,
      hpMax: 20,
      isStable: false,
      stats: { distanceMovedFeet: 0 },
      ...structuredSnapshotFields(10),
      featIds: ["srd_diehard"]
    };
    applyDamage(combatant, 10);
    assert.strictEqual(combatant.hpCurrent, -9);
    assert.strictEqual(combatant.isStable, true);

    const room = {
      board: { width: 10, height: 10, cellSizeFeet: 5 },
      combatants: [combatant],
      currentTurn: { combatantId: combatant.id, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedTotalDefense: false, attacksMade: 0 },
      effectInstances: [],
      pendingOpportunityAttacks: [],
      activeAttackThreat: null
    };
    assert.strictEqual(canDisabledCombatantTakeAction(room, combatant, "standard").ok, true);
    room.currentTurn.usedStandardAction = true;
    assert.strictEqual(canDisabledCombatantTakeAction(room, combatant, "move").ok, false);

    const exertion = applyDisabledExertion(combatant, { wasDisabledAtActionStart: true, actionKind: "standard", actionWasExerting: true });
    assert.strictEqual(exertion.applied, true);
    assert.strictEqual(combatant.hpCurrent, -10);
    assert.strictEqual(combatant.isStable, false);

    const mover = { ...combatant, hpCurrent: -5, isStable: true };
    const movementExertion = applyDisabledExertion(mover, { wasDisabledAtActionStart: true, actionKind: "move", actionWasExerting: true });
    assert.strictEqual(movementExertion.applied, false);
    assert.strictEqual(mover.hpCurrent, -5);
  });

  it("Prone Eschewal levanta por 0 pies, consume move action y no provoca AdO", () => {
    const hero = {
      id: "c1",
      name: "Hero",
      type: "player",
      position: { x: 1, y: 1, zFeet: 0 },
      hpCurrent: 10,
      hpMax: 10,
      baseAttackBonus: 0,
      abilities: [],
      buffs: [],
      stats: { distanceMovedFeet: 0 },
      controlledBy: { type: "player", participantId: "actor1" },
      ...structuredSnapshotFields(10),
      featIds: ["srd_prone_eschewal"]
    };
    const enemy = (id, x, y) => ({
      id,
      name: id,
      type: "enemy",
      position: { x, y, zFeet: 0 },
      hpCurrent: 10,
      hpMax: 10,
      baseAttackBonus: 0,
      abilities: [],
      buffs: [],
      stats: { distanceMovedFeet: 0 },
      ...structuredSnapshotFields(10),
    });
    const room = {
      id: "room1",
      code: "room1",
      phase: "active",
      board: { width: 10, height: 10, cellSizeFeet: 5 },
      combatants: [hero, enemy("enemy-west", 0, 1), enemy("enemy-east", 2, 1)],
      turnOrder: ["c1", "enemy-west", "enemy-east"],
      activeTurnIndex: 0,
      currentTurn: { combatantId: "c1", attacksMade: 0, movementUsedFeet: 0, usedMoveAction: false, attackMode: "none" },
      effectInstances: [{ id: "prone-1", effectId: "srd_prone", targets: ["c1"], sourceId: "enemy-west", roundsRemaining: 10 }],
      pendingOpportunityAttacks: [],
      participants: [{ id: "actor1", name: "Player 1", role: "player" }],
      log: []
    };
    const profile = getStandUpActionProfile(createCombatRulesSnapshot(room), hero);
    assert.strictEqual(profile.costFeet, 0);
    assert.strictEqual(profile.provokesOpportunityAttacks, false);

    handleUseTacticalAction(room, {
      type: "use-tactical-action",
      action: "stand-up",
      combatantId: "c1",
      actorId: "actor1"
    });

    assert.strictEqual(room.currentTurn.movementUsedFeet, 0);
    assert.strictEqual(room.currentTurn.usedMoveAction, true);
    assert.strictEqual(room.pendingOpportunityAttacks.length, 0);
    assert.strictEqual(room.effectInstances.some((instance) => instance.effectId === "srd_prone"), false);
  });

});
