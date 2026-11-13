import test from "node:test";
import assert from "node:assert/strict";
import { dispatchCommand } from "../apps/server/src/commands/dispatcher.ts";
import { clients, rooms } from "../apps/server/src/room/roomStore.ts";

test("room membership is checked before changes to state or subscriptions", (t) => {
  function connect() {
    const events = [];
    const socket = { OPEN: 1, readyState: 1, send: (data) => events.push(JSON.parse(data)) };
    t.after(() => clients.delete(socket));
    return { socket, events };
  }

  function createRoom() {
    const gm = connect();
    dispatchCommand(gm.socket, { type: "create-room", name: "GM" });
    const { participant, room } = gm.events[0];
    t.after(() => rooms.delete(room.code));
    assert.equal(participant.role, "gm");
    return { ...gm, participant, room };
  }

  const first = createRoom();
  const second = createRoom();
  const player = connect();
  const guest = connect();
  const join = { type: "join-room", roomCode: first.room.code, name: "Jugador", role: "player" };
  assert.throws(() => dispatchCommand(guest.socket, { ...join, role: "gm" }), /rol de GM/);
  assert.equal(clients.has(guest.socket), false);
  dispatchCommand(player.socket, join);
  const membership = clients.get(player.socket);
  assert.equal(membership.role, "player");
  assert.equal(membership.roomCode, first.room.code);

  const command = { type: "gm-add-log", roomCode: first.room.code, actorId: membership.id, message: "Nota" };
  const before = structuredClone([...rooms]);
  const eventCounts = [first, second, player, guest].map(({ events }) => events.length);

  assert.throws(() => dispatchCommand(guest.socket, command), /no esta autorizada/);
  assert.throws(() => dispatchCommand(player.socket, { ...command, actorId: first.participant.id }), /no esta autorizada/);
  assert.throws(() => dispatchCommand(player.socket, { ...command, roomCode: second.room.code }), /no esta autorizada/);
  assert.throws(() => dispatchCommand(player.socket, command), /Solo el GM/);
  assert.throws(() => dispatchCommand(player.socket, { ...join, roomCode: second.room.code }), /ya pertenece/);
  assert.throws(() => dispatchCommand(player.socket, { type: "create-room", name: "Otra" }), /ya pertenece/);
  assert.equal(clients.get(player.socket), membership);
  assert.deepEqual([...rooms], before);
  assert.deepEqual([first, second, player, guest].map(({ events }) => events.length), eventCounts);

  dispatchCommand(first.socket, { ...command, actorId: first.participant.id, roomCode: first.room.code.toLowerCase() });
  assert.equal(first.events.at(-1).type, "room-update");
  assert.equal(player.events.at(-1).room.code, first.room.code);
  assert.equal(second.events.length, eventCounts[1]);
  const liveRoom = rooms.get(first.room.code);
  liveRoom.activeAttackThreat = { attackerId: "pending" };
  liveRoom.outcome = "victory";
  liveRoom.phase = "finished";
  dispatchCommand(first.socket, {
    type: "gm-force-outcome", roomCode: first.room.code, actorId: first.participant.id, outcome: "ongoing"
  });
  assert.equal(liveRoom.phase, "critical-confirmation");
  assert.equal(first.events.at(-1).room.phase, "critical-confirmation");

  clients.delete(first.socket);
  assert.throws(() => dispatchCommand(first.socket, { ...command, actorId: first.participant.id }), /no esta autorizada/);
});
