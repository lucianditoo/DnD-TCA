import test from "node:test";
import assert from "node:assert/strict";
import { handleResolveSavingThrow } from "../apps/server/src/commands/tacticalCommands.ts";
import { dispatchCommand } from "../apps/server/src/commands/dispatcher.ts";
import { validateClientCommand } from "../apps/server/src/validation/validateClientCommand.ts";
import { clients, rooms } from "../apps/server/src/room/roomStore.ts";
import { ensureLegacyRoomShape } from "../apps/server/src/room/roomState.ts";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

test("salvación manual: contrato y permisos antes de mutar o emitir", async (t) => {
  const roomCode = "SAVEPERM";
  const messages = [];
  const participants = [
    { id: "save-owner", role: "player" },
    { id: "save-other", role: "player" },
    { id: "save-gm", role: "gm" }
  ];
  const sockets = participants.map((participant) => {
    const socket = { readyState: 1, OPEN: 1, send: (message) => messages.push(JSON.parse(message)) };
    clients.set(socket, { ...participant, name: participant.id, roomCode });
    return socket;
  });
  t.after(() => {
    for (const socket of sockets) clients.delete(socket);
    rooms.delete(roomCode);
  });

  function fixture(targetOverrides = {}) {
    messages.length = 0;
    const target = makeTestCombatant({
      id: "save-target",
      controlledBy: { type: "player", participantId: "save-owner" },
      baseFortitude: 3,
      ...targetOverrides
    });
    const room = makeTestRoom({ code: roomCode, combatants: [target], turnOrder: [target.id] });
    ensureLegacyRoomShape(room);
    rooms.set(roomCode, room);
    return room;
  }

  function command(actorId = "save-owner") {
    return { type: "resolve-saving-throw", roomCode, actorId, targetId: "save-target", saveType: "fortitude", dc: 15, d20Roll: 12 };
  }

  function dispatchValidated(rawCommand) {
    const validation = validateClientCommand(rawCommand);
    assert.equal(validation.success, true);
    const actorIndex = participants.findIndex((participant) => participant.id === rawCommand.actorId);
    dispatchCommand(sockets[actorIndex < 0 ? 0 : actorIndex], validation.data);
  }

  await t.test("el esquema conserva actorId y rechaza identidad ausente o vacía", () => {
    const valid = validateClientCommand(command());
    assert.equal(valid.success, true);
    assert.equal(valid.data.actorId, "save-owner");
    const { actorId, ...withoutActor } = command();
    for (const raw of [withoutActor, command("")]) {
      const validation = validateClientCommand(raw);
      assert.equal(validation.success, false);
      assert.match(validation.error, /actorId/);
    }
  });

  await t.test("el dueño puede resolver a través de validación y dispatcher", () => {
    const room = fixture();
    dispatchValidated(command());
    assert.equal(room.log.length, 1);
    assert.match(room.log[0].message, /12 \(d20\) \+ 3 = 15.*éxito/);
    assert.equal(messages.length, sockets.length);
    assert.ok(messages.every((message) => message.type === "room-update"));
  });

  await t.test("el GM puede resolver un combatiente de control GM", () => {
    const room = fixture({ type: "enemy", controller: "gm", controlledBy: { type: "gm" } });
    dispatchValidated(command("save-gm"));
    assert.equal(room.log.length, 1);
    assert.equal(messages.length, sockets.length);
  });

  const rejectedCases = [
    ["jugador ajeno sobre héroe", "save-other", {}, /solo pueden controlar sus propios heroes/],
    ["jugador sobre enemigo", "save-owner", { type: "enemy", controller: "gm", controlledBy: { type: "gm" } }, /no pueden controlar enemigos/],
    ["GM sobre héroe ajeno según control normal", "save-gm", {}, /GM no puede controlar heroes/],
    ["participante inexistente", "save-unknown", {}, /Participante no encontrado/]
  ];
  for (const [name, actorId, overrides, error] of rejectedCases) {
    await t.test(`${name}: rechazo sin mutación ni broadcast`, () => {
      const room = fixture(overrides);
      const before = structuredClone(room);
      assert.throws(() => dispatchValidated(command(actorId)), error);
      assert.deepEqual(room, before);
      assert.deepEqual(messages, []);
    });
  }

  await t.test("el handler también rechaza identidad omitida antes de mutar", () => {
    const room = fixture();
    const before = structuredClone(room);
    const { actorId, ...withoutActor } = command();
    assert.throws(() => handleResolveSavingThrow(room, withoutActor), /Participante no encontrado/);
    assert.deepEqual(room, before);
    assert.deepEqual(messages, []);
  });
});
