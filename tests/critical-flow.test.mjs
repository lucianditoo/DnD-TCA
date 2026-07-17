import test from "node:test";
import assert from "node:assert/strict";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { handleResolveAttack, handleResolveAttackConfirmation, handleCancelAttackThreat, handleResolveOpportunityAttack } from "../apps/server/src/commands/attackCommands.ts";
import { createEmptyRoom } from "../packages/shared/src/index.ts";
import { structuredSnapshotFields } from "./test-utils.mjs";

// Mock sockets
const mockSocketGM = { readyState: 1, OPEN: 1, send: () => {} };
const mockSocketPlayer = { readyState: 1, OPEN: 1, send: () => {} };
const mockSocketOther = { readyState: 1, OPEN: 1, send: () => {} };

clients.set(mockSocketGM, { id: "gm-actor", role: "gm", name: "GM", roomCode: "TEST" });
clients.set(mockSocketPlayer, { id: "player-actor", role: "player", name: "Player 1", roomCode: "TEST" });
clients.set(mockSocketOther, { id: "other-actor", role: "player", name: "Player 2", roomCode: "TEST" });

// Helper to create a test room
function createTestRoom() {
  const room = createEmptyRoom("TEST");
  room.phase = "active";
  
  // Add attacker (controlled by player)
  const attacker = {
    id: "attacker-1",
    name: "Elaen",
    type: "player",
    hpCurrent: 20,
    hpMax: 20,
    baseAttackBonus: 5, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(15),
    position: { x: 1, y: 1, zFeet: 0 },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0 },
    controlledBy: { type: "player", participantId: "player-actor" },
    buffs: [],
    abilities: [],
  };
  
  // Add target
  const target = {
    id: "target-1",
    name: "Orco",
    type: "enemy",
    hpCurrent: 15,
    hpMax: 15,
    baseAttackBonus: 2, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(12),
    position: { x: 2, y: 1, zFeet: 0 },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0 },
    controlledBy: { type: "gm" },
    buffs: [],
    abilities: [],
  };
  
  room.combatants.push(attacker, target);
  room.turnOrder.push(attacker.id, target.id);
  room.activeTurnIndex = 0;
  room.currentTurn.combatantId = attacker.id;
  
  return { room, attacker, target };
}

test("cancel-attack-threat aplica normalDamage y limpia activeAttackThreat", () => {
  const { room, target } = createTestRoom();
  
  // Elaen attacks Orco. Natural 19 threatens critical (d20=19 + modifier=8 = 27 vs CA 12).
  room.currentTurn.attackMode = "standard";
  handleResolveAttack(room, {
    type: "resolve-attack",
    roomCode: "TEST",
    actorId: "player-actor",
    attackerId: "attacker-1",
    targetId: "target-1",
    d20Roll: 19,
    damage: 8
  });
  
  // Elaen threatens a critical. HP of target should NOT be reduced yet.
  assert.ok(room.activeAttackThreat);
  assert.equal(target.hpCurrent, 15); 
  
  // Cancel threat
  handleCancelAttackThreat(room, {
    type: "cancel-attack-threat",
    roomCode: "TEST",
    actorId: "player-actor"
  });
  
  // Threat must be cleared and normalDamage (8) applied.
  assert.equal(room.activeAttackThreat, null);
  assert.equal(target.hpCurrent, 7); // 15 - 8 = 7
});

test("jugador ajeno no puede cancelar ni confirmar amenaza", () => {
  const { room } = createTestRoom();
  
  room.currentTurn.attackMode = "standard";
  handleResolveAttack(room, {
    type: "resolve-attack",
    roomCode: "TEST",
    actorId: "player-actor",
    attackerId: "attacker-1",
    targetId: "target-1",
    d20Roll: 19,
    damage: 8
  });
  
  // Other player tries to confirm
  assert.throws(() => {
    handleResolveAttackConfirmation(room, {
      type: "resolve-attack-confirmation",
      roomCode: "TEST",
      actorId: "other-actor",
      d20Roll: 15,
      damage: null
    });
  }, /Los jugadores solo pueden controlar sus propios heroes/);
  
  // Other player tries to cancel
  assert.throws(() => {
    handleCancelAttackThreat(room, {
      type: "cancel-attack-threat",
      roomCode: "TEST",
      actorId: "other-actor"
    });
  }, /Los jugadores solo pueden controlar sus propios heroes/);
});

test("Ataque de oportunidad que amenaza crítico no pierde daño y bloquea/resuelve movimiento", () => {
  const { room, attacker, target } = createTestRoom();
  
  // target (Orco) is at (2,1) moving to (0,1). It triggers opportunity attack.
  const aoo = {
    id: "aoo-test",
    attackerId: attacker.id,
    targetId: target.id,
    attackerPosition: { x: 1, y: 1, zFeet: 0 },
    origin: { x: 2, y: 1, zFeet: 0 },
    destination: { x: 0, y: 1, zFeet: 0 },
    movementCostFeet: 10,
    reason: "Orco abandona casilla",
    createdAt: new Date().toISOString()
  };
  room.pendingOpportunityAttacks.push(aoo);
  
  // Resolve opportunity attack with 19 (critical threat)
  handleResolveOpportunityAttack(room, {
    type: "resolve-opportunity-attack",
    roomCode: "TEST",
    actorId: "player-actor",
    opportunityId: "aoo-test",
    d20Roll: 19,
    damage: null
  });
  
  // Should create critical threat with opportunityAttackId
  assert.ok(room.activeAttackThreat);
  assert.equal(room.activeAttackThreat.opportunityAttackId, "aoo-test");
  
  // Target position and speed should NOT be modified yet (block movement resolution)
  assert.equal(target.hpCurrent, 15);
  assert.equal(target.position.x, 2); // target remains at origin of movement
  assert.equal(room.pendingOpportunityAttacks.length, 1); // still pending
  
  // Confirm critical (d20=15 + modifier=8 = 23 >= CA 12). confirmed!
  handleResolveAttackConfirmation(room, {
    type: "resolve-attack-confirmation",
    roomCode: "TEST",
    actorId: "player-actor",
    d20Roll: 15,
    damage: 16 // Critical damage
  });
  
  // Opportunity attack resolved, threat cleared, target takes 16 dmg, stopped at origin
  assert.equal(room.activeAttackThreat, null);
  assert.equal(room.pendingOpportunityAttacks.length, 0);
  assert.equal(target.hpCurrent, -1); // 15 - 16 = -1
  assert.equal(target.position.x, 2); // stopped at origin (2,1)
});

test("Iniciativa negativa no afecta ataque ni daño", () => {
  const { room, attacker, target } = createTestRoom();
  
  attacker.initiative = -5;
  target.initiative = -2;
  
  room.currentTurn.attackMode = "standard";
  handleResolveAttack(room, {
    type: "resolve-attack",
    roomCode: "TEST",
    actorId: "player-actor",
    attackerId: "attacker-1",
    targetId: "target-1",
    d20Roll: 15,
    damage: 8
  });
  
  assert.equal(target.hpCurrent, 7); // 15 - 8 = 7
});

test("Un ataque exitoso sin DR no aplica menos de 1 daño", () => {
  const { room, attacker, target } = createTestRoom();
  
  room.currentTurn.attackMode = "standard";
  handleResolveAttack(room, {
    type: "resolve-attack",
    roomCode: "TEST",
    actorId: "player-actor",
    attackerId: "attacker-1",
    targetId: "target-1",
    d20Roll: 15,
    damage: 0
  });
  
  assert.equal(target.hpCurrent, 14); // 15 - 1 = 14
});
