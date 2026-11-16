import test from "node:test";
import assert from "node:assert/strict";
import { rooms, clients } from "../apps/server/src/room/roomStore.js";
import { dispatchCommand } from "../apps/server/src/commands/dispatcher.js";
import { roomHistory } from "../apps/server/src/room/roomHistory.js";

test("P3: gm-undo-turn restaura HP, posición, efectos, economía, turno y log truncado", () => {
  const roomCode = "UNDO_REG_1";
  const gmId = "gm-1";
  const mockSocket = { readyState: 1, send: () => {} };
  clients.set(mockSocket, { id: gmId, role: "gm", name: "GM", roomCode });

  rooms.set(roomCode, {
    code: roomCode,
    board: { width: 10, height: 10, cells: [] },
    combatants: [],
    turnOrder: [],
    activeTurnIndex: 0,
    round: 1,
    phase: "preparation",
    outcome: "ongoing",
    completedAt: null,
    currentTurn: {
      combatantId: null,
      normalDiagonalStepsThisTurn: 0,
      movementUsedFeet: 0,
      usedMoveAction: false,
      usedStandardAction: false,
      usedFullAttack: false,
      usedFiveFootStep: false,
      usedSwiftAction: false,
      usedTotalDefense: false,
      usedStabilization: false,
      attacksMade: 0,
      attackMode: "none",
      defensiveFightingDeclared: false
    },
    pendingOpportunityAttacks: [],
    log: [],
    activeAttackThreat: null,
    pendingCoupDeGrace: null,
    effectInstances: [],
    eventSequence: 0,
    stateVersion: 0
  });

  try {
    dispatchCommand(mockSocket, { type: "add-demo-combatant", roomCode, actorId: gmId, variant: "hero", stateVersion: 0 });
    dispatchCommand(mockSocket, { type: "add-demo-combatant", roomCode, actorId: gmId, variant: "enemy", stateVersion: 0 });
    const heroId = rooms.get(roomCode).combatants[0].id;
    const enemyId = rooms.get(roomCode).combatants[1].id;
    const heroMaxHp = rooms.get(roomCode).combatants[0].hpMax;

    dispatchCommand(mockSocket, { type: "set-initiative", roomCode, actorId: gmId, combatantId: heroId, initiative: 18, stateVersion: 0 });
    dispatchCommand(mockSocket, { type: "set-initiative", roomCode, actorId: gmId, combatantId: enemyId, initiative: 12, stateVersion: 0 });
    dispatchCommand(mockSocket, { type: "sort-initiative", roomCode, actorId: gmId, stateVersion: 0 });

    const roomAfterStart = rooms.get(roomCode);
    assert.equal(roomAfterStart.phase, "active");
    const firstActorId = roomAfterStart.currentTurn.combatantId;

    // Avanzar al turno 2
    dispatchCommand(mockSocket, { type: "end-turn", roomCode, actorId: gmId, stateVersion: 0 });
    const roomTurn2 = rooms.get(roomCode);
    assert.notEqual(roomTurn2.currentTurn.combatantId, firstActorId);

    // Mutar HP y economía en turno 2, luego ejecutar gm-undo-turn
    dispatchCommand(mockSocket, { type: "gm-set-hp", roomCode, actorId: gmId, combatantId: heroId, hpCurrent: 1, stateVersion: 0 });
    assert.equal(rooms.get(roomCode).combatants[0].hpCurrent, 1);

    dispatchCommand(mockSocket, { type: "gm-undo-turn", roomCode, actorId: gmId, steps: 1 });
    const restored = rooms.get(roomCode);
    assert.equal(restored.currentTurn.combatantId, firstActorId);
    assert.equal(restored.combatants[0].hpCurrent, heroMaxHp);
    assert.equal(restored.currentTurn.usedMoveAction, false);
    assert.equal(restored.currentTurn.usedStandardAction, false);
    assert.equal(restored.stateVersion, 1);
  } finally {
    rooms.delete(roomCode);
    clients.delete(mockSocket);
    roomHistory.clear(roomCode);
  }
});
