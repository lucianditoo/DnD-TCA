import test from "node:test";
import assert from "node:assert/strict";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { handleMoveCombatant } from "../apps/server/src/commands/movementCommands.ts";
import { handleResolveAttack } from "../apps/server/src/commands/attackCommands.ts";
import { handleUseTacticalAction } from "../apps/server/src/commands/tacticalCommands.ts";
import { handleGmClearOpportunities } from "../apps/server/src/commands/gmCommands.ts";
import { createEmptyRoom } from "../packages/shared/src/index.ts";
import { inventoryEquipment, structuredSnapshotFields } from "./test-utils.mjs";

const mockSocketGM = { readyState: 1, OPEN: 1, send: () => {} };
const mockSocketPlayer = { readyState: 1, OPEN: 1, send: () => {} };

clients.set(mockSocketGM, { id: "gm-actor", role: "gm", name: "GM", roomCode: "TEST" });
clients.set(mockSocketPlayer, { id: "player-actor", role: "player", name: "Player", roomCode: "TEST" });

function createTestRoom() {
  const room = createEmptyRoom("TEST");
  room.phase = "active";
  
  const attacker = {
    id: "hero-1",
    name: "Hero",
    type: "player",
    hpCurrent: 20,
    hpMax: 20,
    baseAttackBonus: 5, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(15),
    ...inventoryEquipment("longbow", { extraItems: [{ catalogId: "arrows_20", quantity: 20 }] }),
    abilityScores: { strength: 10, dexterity: 16, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    position: { x: 1, y: 1, zFeet: 0 },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0 },
    controlledBy: { type: "player", participantId: "player-actor" },
    buffs: [],
    abilities: [],
  };
  
  const enemy = {
    id: "enemy-1",
    name: "Orco",
    type: "enemy",
    hpCurrent: 15,
    hpMax: 15,
    baseAttackBonus: 2, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(12),
    ...inventoryEquipment("club"),
    abilityScores: { strength: 12, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    position: { x: 2, y: 1, zFeet: 0 },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0 },
    controlledBy: { type: "gm" },
    buffs: [],
    abilities: [],
  };
  
  room.combatants.push(attacker, enemy);
  room.turnOrder.push(attacker.id, enemy.id);
  room.activeTurnIndex = 0;
  room.currentTurn.combatantId = attacker.id;
  
  return { room, attacker, enemy };
}

test("movimiento que genera AdO deja room.phase === 'opportunity-resolution'", () => {
  const { room, attacker } = createTestRoom();
  
  // Hero is at (1,1), Enemy is at (2,1) with meleeReach=5. Moving to (1, 3) provokes AdO (10 ft).
  handleMoveCombatant(room, {
    type: "move-combatant",
    roomCode: "TEST",
    actorId: "player-actor",
    combatantId: "hero-1",
    to: { x: 1, y: 3, zFeet: 0 },
    path: [{ x: 1, y: 2, zFeet: 0 }, { x: 1, y: 3, zFeet: 0 }]
  });
  
  assert.equal(room.pendingOpportunityAttacks.length, 1);
  assert.equal(room.phase, "opportunity-resolution");
});

test("ataque a distancia que genera AdO deja room.phase === 'opportunity-resolution' si no hay critico", () => {
  const { room } = createTestRoom();
  
  // Hero has a bow (reach=0). Firing adjacent to Enemy (meleeReach=5) provokes AdO.
  room.currentTurn.attackMode = "standard";
  handleResolveAttack(room, {
    type: "resolve-attack",
    roomCode: "TEST",
    actorId: "player-actor",
    attackerId: "hero-1",
    targetId: "enemy-1",
    d20Roll: 10, // Not a critical
    damage: null
  });
  
  assert.equal(room.pendingOpportunityAttacks.length, 1);
  assert.equal(room.phase, "opportunity-resolution");
});

test("carga que genera AdO deja room.phase === 'opportunity-resolution' si no hay critico", () => {
  const { room, attacker, enemy } = createTestRoom();
  
  Object.assign(attacker, inventoryEquipment("longsword"));
  attacker.position = { x: 0, y: 1, zFeet: 0 };
  enemy.position = { x: 5, y: 1, zFeet: 0 };
  
  // Add another enemy to threaten the charge path
  const guard = {
    id: "guard-1",
    name: "Guardia",
    type: "enemy",
    hpCurrent: 15,
    hpMax: 15,
    baseAttackBonus: 2, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(12),
    ...inventoryEquipment("spear"),
    abilityScores: { strength: 12, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    position: { x: 3, y: 2, zFeet: 0 }, // Adjacent to path (x=3, y=1)
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0 },
    controlledBy: { type: "gm" },
    buffs: [],
    abilities: [],
  };
  room.combatants.push(guard);
  
  handleUseTacticalAction(room, {
    type: "use-tactical-action",
    action: "charge",
    roomCode: "TEST",
    actorId: "player-actor",
    combatantId: "hero-1",
    targetId: "enemy-1",
    d20Roll: 10, // Not critical
    damage: null
  });
  
  assert.equal(room.pendingOpportunityAttacks.length, 1);
  assert.equal(room.phase, "opportunity-resolution");
});

test("gm-clear-opportunities restaura fase correcta desde opportunity-resolution", () => {
  const { room } = createTestRoom();
  room.pendingOpportunityAttacks.push({
    id: "aoo-1", attackerId: "enemy-1", targetId: "hero-1", attackerPosition: null, origin: { x: 1, y: 1, zFeet: 0 }, destination: { x: 0, y: 1, zFeet: 0 }, reason: "Abandona casilla", createdAt: new Date().toISOString(), movementCostFeet: 10
  });
  room.phase = "opportunity-resolution";
  
  handleGmClearOpportunities(room, {
    type: "gm-clear-opportunities",
    roomCode: "TEST",
    actorId: "gm-actor"
  });
  
  assert.equal(room.pendingOpportunityAttacks.length, 0);
  assert.equal(room.phase, "active");
});



test("gm-clear-opportunities respeta critical-confirmation si hay amenaza", () => {
  const { room } = createTestRoom();
  room.pendingOpportunityAttacks.push({
    id: "aoo-1", attackerId: "enemy-1", targetId: "hero-1", attackerPosition: null, origin: { x: 1, y: 1, zFeet: 0 }, destination: { x: 0, y: 1, zFeet: 0 }, reason: "Abandona casilla", createdAt: new Date().toISOString(), movementCostFeet: 10
  });
  room.activeAttackThreat = {
    attackerId: "hero-1", targetId: "enemy-1", initialD20Roll: 20, attackBonusTotal: 0, targetArmorClass: 10,
    normalDamageBundle: { components: [{ sourceId: "weapon", label: "arma", category: "base", amount: 5, neverMultiply: false }], total: 5 },
    criticalThreatFrom: 20, criticalMultiplier: 2, weaponName: "arma", isFullAttack: false, label: "ataque"
  };
  room.phase = "critical-confirmation";
  
  handleGmClearOpportunities(room, {
    type: "gm-clear-opportunities",
    roomCode: "TEST",
    actorId: "gm-actor"
  });
  
  assert.equal(room.pendingOpportunityAttacks.length, 0);
  assert.equal(room.phase, "critical-confirmation");
});

test("un disparo suspendido continúa una sola vez tras un AdO fallido", async () => {
  const { dispatchCommand } = await import("../apps/server/src/commands/dispatcher.ts");
  const { rooms } = await import("../apps/server/src/room/roomStore.ts");
  const { room, attacker, enemy } = createTestRoom();
  rooms.set(room.code, room);
  try {
    room.currentTurn.attackMode = "standard";
    dispatchCommand(mockSocketPlayer, { type: "resolve-attack", roomCode: room.code, actorId: "player-actor", attackerId: attacker.id, targetId: enemy.id, d20Roll: 15, damage: 3 });
    assert.equal(room.currentTurn.attacksMade, 0);
    const [opportunity] = room.pendingOpportunityAttacks;
    const response = { type: "resolve-opportunity-attack", roomCode: room.code, actorId: "gm-actor", opportunityId: opportunity.id, d20Roll: 1, damage: 1 };
    dispatchCommand(mockSocketGM, response);
    assert.equal(room.currentTurn.attacksMade, 1);
    assert.equal(room.pendingStationaryAction, undefined);
    assert.throws(() => dispatchCommand(mockSocketGM, response), /no encontrado/i);
    assert.equal(room.currentTurn.attacksMade, 1);
  } finally {
    rooms.delete(room.code);
  }
});
for (const [damage, stops] of [[2, false], [21, true]]) {
  test("movimiento tras AdO con daño " + damage, async () => {
    const { dispatchCommand } = await import("../apps/server/src/commands/dispatcher.ts");
    const { rooms } = await import("../apps/server/src/room/roomStore.ts");
    const { room, attacker } = createTestRoom();
    rooms.set(room.code, room);
    try {
      const origin = { ...attacker.position };
      const to = { x: 1, y: 3, zFeet: 0 };
      dispatchCommand(mockSocketPlayer, {
        type: "move-combatant", roomCode: room.code, actorId: "player-actor", combatantId: attacker.id,
        to, path: [{ x: 1, y: 2, zFeet: 0 }, to]
      });
      const [opportunity] = room.pendingOpportunityAttacks;
      dispatchCommand(mockSocketGM, {
        type: "resolve-opportunity-attack", roomCode: room.code, actorId: "gm-actor",
        opportunityId: opportunity.id, d20Roll: 18, damage
      });
      assert.equal(attacker.hpCurrent, 20 - damage);
      assert.deepEqual(attacker.position, stops ? origin : to);
      assert.equal(room.currentTurn.movementUsedFeet, stops ? 0 : 10);
      assert.equal(attacker.stats.distanceMovedFeet, stops ? 0 : 10);
      assert.equal(room.currentTurn.usedMoveAction, true);
    } finally {
      rooms.delete(room.code);
    }
  });
}
for (const [ranks, castSucceeds] of [[0, false], [20, true]]) {
  test("Concentración tras AdO con " + ranks + " rangos", async (t) => {
    const { dispatchCommand } = await import("../apps/server/src/commands/dispatcher.ts");
    const { rooms } = await import("../apps/server/src/room/roomStore.ts");
    const { room, attacker, enemy } = createTestRoom();
    attacker.skillRanks = { ...attacker.skillRanks, concentration: ranks };
    attacker.preparedSpells = [{ slotId: "cure", spellId: "srd_cure_light_wounds", isExpended: false }];
    t.mock.method(Math, "random", () => 0);
    rooms.set(room.code, room);
    try {
      dispatchCommand(mockSocketPlayer, { type: "cast-spell", roomCode: room.code, actorId: "player-actor",
        casterId: attacker.id, targetId: attacker.id, slotId: "cure", amount: 3, d20Roll: null });
      assert.equal(attacker.preparedSpells[0].isExpended, false);
      const [opportunity] = room.pendingOpportunityAttacks;
      assert.equal(opportunity.attackerId, enemy.id);
      dispatchCommand(mockSocketGM, { type: "resolve-opportunity-attack", roomCode: room.code, actorId: "gm-actor",
        opportunityId: opportunity.id, d20Roll: 18, damage: 5 });
      assert.equal(attacker.hpCurrent, castSucceeds ? 18 : 15);
      assert.equal(attacker.preparedSpells[0].isExpended, true);
      assert.equal(room.currentTurn.usedStandardAction, true);
      assert.equal(room.pendingStationaryAction, undefined);
    } finally {
      rooms.delete(room.code);
    }
  });
}
for (const [action, damage, stop] of [
  ["run", 2, false], ["run", 21, true],
  ["withdraw", 2, false], ["withdraw", 21, true],
  ["charge", 2, false], ["charge", 21, true]
]) {
  test(action + ": publica el prefijo y " + (stop ? "se detiene" : "continúa"), async () => {
    const { dispatchCommand } = await import("../apps/server/src/commands/dispatcher.ts");
    const { rooms } = await import("../apps/server/src/room/roomStore.ts");
    const { room, attacker, enemy } = createTestRoom();
    Object.assign(attacker, inventoryEquipment("longsword"));
    enemy.position = { x: action === "withdraw" ? 3 : 2, y: action === "withdraw" ? 2 : 1, zFeet: 0 };
    const defender = { ...enemy, id: "charge-target", position: { x: 1, y: 6, zFeet: 0 } };
    if (action === "charge") room.combatants.push(defender);
    if (action === "run" && !stop) room.combatants.push({ ...attacker, id: "ally-on-route", position: { x: 1, y: 3, zFeet: 0 } });
    const to = { x: 1, y: 5, zFeet: 0 };
    const path = [2, 3, 4, 5].map(y => ({ ...to, y }));
    if (action === "withdraw") enemy.position = { x: 2, y: 3, zFeet: 0 };
    rooms.set(room.code, room);
    try {
      dispatchCommand(mockSocketPlayer, { type: "use-tactical-action", roomCode: room.code,
        actorId: "player-actor", combatantId: attacker.id, action, to, path, targetId: defender.id, d20Roll: 18, damage: 2 });
      const [offer] = room.pendingOpportunityAttacks;
      assert.ok(offer);
      assert.deepEqual(attacker.position, offer.origin);
      const spent = room.currentTurn.movementUsedFeet;
      assert.ok(spent < 20);
      assert.equal(room.currentTurn.usedFullAttack, true);
      assert.equal(defender.hpCurrent, 15);
      dispatchCommand(mockSocketGM, { type: "resolve-opportunity-attack", roomCode: room.code,
        actorId: "gm-actor", opportunityId: offer.id, d20Roll: 18, damage });
      assert.deepEqual(attacker.position, stop ? offer.origin : to);
      assert.equal(room.currentTurn.movementUsedFeet, stop ? spent : 20);
      assert.equal(attacker.stats.distanceMovedFeet, stop ? spent : 20);
      assert.equal(room.currentTurn.usedFullAttack, true);
      assert.equal(defender.hpCurrent, action === "charge" && !stop ? 13 : 15);
    } finally {
      rooms.delete(room.code);
    }
  });
}