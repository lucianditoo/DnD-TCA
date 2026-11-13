import test from "node:test";
import assert from "node:assert/strict";
import { dispatchCommand } from "../apps/server/src/commands/dispatcher.ts";
import { clients, resumeGmSession, rooms, send, resetAllRoomsForTest } from "../apps/server/src/room/roomStore.ts";

test("GM resume claims only its own room and preserves state across connection handoffs", () => {
  const connection = () => {
    const events = [];
    return { events, send: (data) => events.push(JSON.parse(data)) };
  };
  const original = connection();
  const next = connection();
  const concurrent = connection();
  const other = connection();
  dispatchCommand(original, { type: "create-room", name: "GM" }, true);
  dispatchCommand(other, { type: "create-room", name: "Otro" }, true);
  const { room, participant, gmResumeToken } = original.events[0];
  const before = structuredClone(rooms.get(room.code));

  try {
    assert.equal(resumeGmSession(next, room.code, other.events[0].gmResumeToken).kind, "unavailable");
    assert.equal(resumeGmSession(next, room.code, gmResumeToken).kind, "active");
    assert.equal(clients.has(next), false);

    clients.delete(original);
    const resumed = resumeGmSession(next, room.code, gmResumeToken);
    assert.equal(resumed.kind, "resumed");
    assert.deepEqual(resumed.participant, participant);
    assert.equal(resumed.room, rooms.get(room.code));
    assert.deepEqual(resumed.room, before);
    assert.equal(resumeGmSession(concurrent, room.code, gmResumeToken).kind, "active");

    clients.delete(original);
    assert.equal(clients.get(next).id, participant.id);
    clients.delete(next);
    assert.equal(resumeGmSession(concurrent, room.code, gmResumeToken).kind, "resumed");

    resetAllRoomsForTest();
    assert.equal(resumeGmSession(next, room.code, gmResumeToken).kind, "unavailable");
  } finally {
    for (const socket of [original, next, concurrent, other]) clients.delete(socket);
  }
});

test("El GM recupera el resultado final sin reabrir el encuentro", () => {
  const original = { events: [], send(data) { this.events.push(JSON.parse(data)); } };
  const next = {};
  dispatchCommand(original, { type: "create-room", name: "GM" }, true);
  const { room, participant, gmResumeToken } = original.events[0];
  try {
    dispatchCommand(original, { type: "gm-force-outcome", roomCode: room.code, actorId: participant.id, outcome: "victory" });
    clients.delete(original);
    const result = resumeGmSession(next, room.code, gmResumeToken);
    assert.equal(result.kind, "resumed");
    assert.equal(result.room.phase, "finished");
    assert.equal(result.room.outcome, "victory");
    assert.throws(() => dispatchCommand(next, { type: "end-turn", roomCode: room.code, actorId: participant.id }), /combate ya termino/);
    assert.equal(result.room.phase, "finished");
  } finally {
    clients.delete(original);
    clients.delete(next);
  }
});

test("Hello y actualizaciones proyectan solo el resumen de la interrupcion al GM de la sala", () => {
  const connection = () => ({ events: [], send(data) { this.events.push(JSON.parse(data)); } });
  const original = connection(), next = connection(), player = connection();
  dispatchCommand(original, { type: "create-room", name: "GM" }, true);
  const { room: { code }, gmResumeToken } = original.events[0];
  const room = rooms.get(code);
  try {
    room.phase = "opportunity-resolution";
    room.pendingMovement = { kind: "charge", actorId: "actor", remainingBudget: 30, path: [{ x: 2, y: 1, zFeet: 0 }] };
    room.pendingOpportunityAttacks = [{ id: "ado" }];
    dispatchCommand(player, { type: "join-room", roomCode: code, role: "player", name: "Jugador" });
    clients.delete(original);
    const result = resumeGmSession(next, code, gmResumeToken);
    assert.equal(result.kind, "resumed");
    send(next, { type: "hello", participant: result.participant, room, catalog: original.events[0].catalog });
    assert.deepEqual(next.events[0].interruption, { kind: "charge" });
    assert.deepEqual(next.events[0].room.pendingOpportunityAttacks, [{ id: "ado" }]);
    assert.equal(next.events[0].room.pendingMovement, undefined);
    delete room.pendingMovement;
    room.pendingStationaryAction = { command: { type: "cast-spell", slotId: "internal" }, damageTaken: [4] };
    send(next, { type: "room-update", room });
    assert.deepEqual(next.events.at(-1).interruption, { kind: "cast-spell" });
    assert.equal(next.events.at(-1).room.pendingStationaryAction, undefined);
    send(player, { type: "room-update", room });
    assert.equal(player.events.at(-1).interruption, undefined);
    room.phase = "finished";
    send(next, { type: "room-update", room });
    assert.equal(next.events.at(-1).interruption, undefined);
  } finally {
    for (const socket of [original, next, player]) clients.delete(socket);
  }
});
