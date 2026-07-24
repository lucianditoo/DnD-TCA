import test from "node:test";
import assert from "node:assert/strict";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { handleResolveAttack } from "../apps/server/src/commands/attackCommands.ts";
import { createEmptyRoom } from "../packages/shared/src/index.ts";
import { structuredSnapshotFields } from "./test-utils.mjs";

// ---------------------------------------------------------------------------
// Sprint 052B: integracion de Target Legality (DEFENSE-LINE-OF-EFFECT) en el
// camino real de resolucion de ataque ordinario (handleResolveAttack). No existe
// comando/editor para fijar board.lineOfEffectBlockingCells vía WebSocket en una
// sala viva (ver scripts/e2e-websocket.mjs), así que esta cobertura se hace por
// integración directa de servidor, igual que tests/gm-apply-effect.test.mjs y
// tests/attack-rules.test.mjs.
// ---------------------------------------------------------------------------

const mockSocketGM = { readyState: 1, OPEN: 1, send: () => {} };
const mockSocketPlayer = { readyState: 1, OPEN: 1, send: () => {} };
const mockSocketOtherPlayer = { readyState: 1, OPEN: 1, send: () => {} };

clients.set(mockSocketGM, { id: "gm-loe-actor", role: "gm", name: "GM", roomCode: "LOE01" });
clients.set(mockSocketPlayer, { id: "player-loe-actor", role: "player", name: "Player", roomCode: "LOE01" });
clients.set(mockSocketOtherPlayer, { id: "other-player-loe-actor", role: "player", name: "OtherPlayer", roomCode: "LOE01" });

function makeRoom({ lineOfEffectBlockingCells, targetPosition = { x: 1, y: 0, zFeet: 0 } } = {}) {
  const room = createEmptyRoom("LOE01");
  room.phase = "active";
  if (lineOfEffectBlockingCells) {
    room.board = { ...room.board, lineOfEffectBlockingCells };
  }

  const attacker = {
    id: "loe-attacker",
    name: "Atacante",
    type: "player",
    hpCurrent: 20,
    hpMax: 20,
    baseAttackBonus: 5, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(15),
    abilityScores: { strength: 16, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    position: { x: 0, y: 0, zFeet: 0 },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0, healingReceived: 0 },
    controlledBy: { type: "player", participantId: "player-loe-actor" },
    buffs: [],
    abilities: []
  };

  const target = {
    id: "loe-target",
    name: "Objetivo",
    type: "enemy",
    hpCurrent: 100,
    hpMax: 100,
    baseAttackBonus: 0, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(10),
    baseSpeedFeet: 20,
    position: targetPosition,
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0, healingReceived: 0 },
    controlledBy: { type: "gm" },
    buffs: [],
    abilities: []
  };

  room.combatants.push(attacker, target);
  room.turnOrder.push(attacker.id, target.id);
  room.activeTurnIndex = 0;
  room.currentTurn.combatantId = attacker.id;
  room.currentTurn.attackMode = "standard";

  return { room, attacker, target };
}

function attack(room, actorId, options = {}) {
  handleResolveAttack(room, {
    type: "resolve-attack",
    roomCode: "LOE01",
    actorId,
    attackerId: "loe-attacker",
    targetId: "loe-target",
    d20Roll: 15,
    damage: 9
  }, options);
}

test("ataque con Line of Effect presente se resuelve normalmente (sin obstaculos)", () => {
  const { room, target } = makeRoom();
  attack(room, "player-loe-actor");
  assert.equal(target.hpCurrent, 100 - 9, "d20=15 total 20 vs CA 10 debe impactar y aplicar dano.");
  assert.equal(room.currentTurn.attacksMade, 1);
});

test("ataque rechazado por Cobertura Total (sin Line of Effect) antes de cualquier tirada o mutacion", () => {
  // Objetivo a 2 celdas (10 ft) con un bloqueador exactamente interior al segmento.
  // A 5 ft (celdas adyacentes) no existe punto interior posible, por lo que la
  // Cobertura Total solo es representable con al menos una celda de separacion.
  const { room, target } = makeRoom({ lineOfEffectBlockingCells: ["1,0"], targetPosition: { x: 2, y: 0, zFeet: 0 } });
  const refusingRoller = () => { throw new Error("REGRESION: no debe consumirse RNG si no hay Line of Effect."); };

  assert.throws(
    () => attack(room, "player-loe-actor", { diceRoller: refusingRoller }),
    /Cobertura Total/,
    "debe rechazarse explicitamente por Cobertura Total, no por fallo de RNG ni de otra validacion."
  );

  assert.equal(target.hpCurrent, 100, "el objetivo no debe recibir dano.");
  assert.equal(room.currentTurn.attacksMade, 0, "no debe consumirse el ataque de la rutina.");
  assert.equal(room.activeAttackThreat, null, "no debe quedar amenaza de critico pendiente.");
  assert.equal(room.log.length, 1, "no debe agregarse ninguna entrada nueva al log (solo el log de creacion de sala).");
});

test("Cobertura Total no oculta ni reemplaza el control de turno/autorizacion existente", () => {
  const { room, target } = makeRoom({ lineOfEffectBlockingCells: ["1,0"], targetPosition: { x: 2, y: 0, zFeet: 0 } });

  assert.throws(
    () => attack(room, "other-player-loe-actor"),
    /Los jugadores solo pueden controlar sus propios heroes|Los jugadores solo pueden controlar/i,
    "la autorizacion de control debe evaluarse antes (y en vez) que la Cobertura Total para un actor no autorizado."
  );
  assert.equal(target.hpCurrent, 100, "un rechazo por autorizacion tampoco debe mutar el estado.");
});

test("sin bloqueadores de Line of Effect, un actor no autorizado sigue siendo rechazado por control (regresion de orden)", () => {
  const { room } = makeRoom();
  assert.throws(
    () => attack(room, "other-player-loe-actor"),
    /Los jugadores solo pueden controlar sus propios heroes|Los jugadores solo pueden controlar/i
  );
});
