import test from "node:test";
import assert from "node:assert/strict";
import { dispatchCommand } from "../apps/server/src/commands/dispatcher.ts";
import { validateClientCommand } from "../apps/server/src/validation/validateClientCommand.ts";
import { clients, rooms } from "../apps/server/src/room/roomStore.ts";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

function setup(t) {
  const messages = [];
  const sockets = [];
  const room = makeTestRoom({ code: "IDENTITY", phase: "preparation", combatants: [
    makeTestCombatant({ id: "owned-hero", controlledBy: { type: "player", participantId: "identity-owner" } }),
    makeTestCombatant({ id: "gm-enemy", type: "enemy", controller: "gm", controlledBy: { type: "gm" }, position: { x: 5, y: 5, zFeet: 0 } })
  ] });
  rooms.set(room.code, room);
  function socket(id, role = "player", roomCode = room.code) {
    const connection = { OPEN: 1, readyState: 1, send: payload => messages.push(JSON.parse(payload)) };
    if (id) clients.set(connection, { id, role, roomCode, name: id });
    sockets.push(connection);
    return connection;
  }
  const owner = socket("identity-owner");
  const other = socket("identity-other");
  const gm = socket("identity-gm", "gm");
  t.after(() => {
    sockets.forEach(connection => clients.delete(connection));
    rooms.delete(room.code);
  });
  function dispatch(connection, command) {
    // Exercise the same schema validation and public dispatcher used by index.ts.
    const validation = validateClientCommand(command);
    assert.equal(validation.success, true);
    dispatchCommand(connection, validation.data);
  }
  const initiative = (actorId, combatantId = "owned-hero", roomCode = room.code) => ({
    type: "set-initiative", roomCode, actorId, combatantId, initiative: 17
  });
  return { room, messages, socket, owner, other, gm, dispatch, initiative };
}

test("WebSocket identity: another socket cannot impersonate the hero owner or GM", t => {
  const f = setup(t);
  for (const command of [
    f.initiative("identity-owner"),
    f.initiative("identity-gm", "gm-enemy")
  ]) {
    const before = structuredClone(f.room);
    assert.throws(() => f.dispatch(f.other, command), /Participante no encontrado/);
    assert.deepEqual(f.room, before);
    assert.deepEqual(f.messages, []);
  }
});

test("WebSocket identity: unregistered and disconnected sockets cannot borrow an active identity", t => {
  const f = setup(t);
  const disconnected = f.socket("identity-disconnected");
  clients.delete(disconnected);
  for (const connection of [f.socket(), disconnected]) {
    assert.throws(() => f.dispatch(connection, f.initiative("identity-owner")), /Participante no encontrado/);
    assert.equal(f.room.combatants[0].initiative, null);
    assert.deepEqual(f.messages, []);
  }
});

test("WebSocket identity: even a registered GM cannot target another room", t => {
  const f = setup(t);
  const outsider = f.socket("identity-outsider", "gm", "OTHER");
  const before = structuredClone(f.room);
  assert.throws(() => f.dispatch(outsider, f.initiative("identity-outsider")), /no pertenece a esta sala/);
  assert.deepEqual(f.room, before);
  assert.deepEqual(f.messages, []);
});

test("WebSocket identity: legitimate owner keeps initiative and movement control", t => {
  const f = setup(t);
  f.dispatch(f.owner, f.initiative("identity-owner", "owned-hero", "identity"));
  assert.equal(f.room.combatants[0].initiative, 17);
  f.dispatch(f.owner, { type: "move-combatant", roomCode: f.room.code, actorId: "identity-owner",
    combatantId: "owned-hero", to: { x: 1, y: 0, zFeet: 0 } });
  assert.deepEqual(f.room.combatants[0].position, { x: 1, y: 0, zFeet: 0 });
  assert.ok(f.messages.some(message => message.type === "room-update"));
});

test("WebSocket identity: authenticated players still cannot control other heroes or enemies", t => {
  const f = setup(t);
  const before = structuredClone(f.room);
  for (const combatantId of ["owned-hero", "gm-enemy"]) {
    assert.throws(() => f.dispatch(f.other, f.initiative("identity-other", combatantId)), /iniciativa de sus propios heroes/);
  }
  assert.deepEqual(f.room, before);
  assert.deepEqual(f.messages, []);
});

test("WebSocket identity: GM retains initiative override and GM-controlled movement, not normal player-hero control", t => {
  const f = setup(t);
  f.dispatch(f.gm, f.initiative("identity-gm"));
  assert.equal(f.room.combatants[0].initiative, 17);
  f.dispatch(f.gm, { type: "move-combatant", roomCode: f.room.code, actorId: "identity-gm",
    combatantId: "gm-enemy", to: { x: 6, y: 5, zFeet: 0 } });
  assert.deepEqual(f.room.combatants[1].position, { x: 6, y: 5, zFeet: 0 });
  const before = structuredClone(f.room);
  assert.throws(() => f.dispatch(f.gm, { type: "move-combatant", roomCode: f.room.code,
    actorId: "identity-gm", combatantId: "owned-hero", to: { x: 1, y: 0, zFeet: 0 } }), /GM no puede controlar heroes/);
  assert.deepEqual(f.room, before);
});

test("WebSocket identity: create-room and join-room still establish server identities", t => {
  const f = setup(t);
  const gmSocket = f.socket();
  f.dispatch(gmSocket, { type: "create-room", name: "Identity GM" });
  const participant = clients.get(gmSocket);
  assert.equal(participant.role, "gm");
  t.after(() => rooms.delete(participant.roomCode));
  const playerSocket = f.socket();
  f.dispatch(playerSocket, { type: "join-room", name: "Identity player", role: "player", roomCode: participant.roomCode });
  assert.equal(clients.get(playerSocket).role, "player");
  assert.equal(clients.get(playerSocket).roomCode, participant.roomCode);
  assert.notEqual(clients.get(playerSocket).id, participant.id);
});
