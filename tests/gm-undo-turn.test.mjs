import test from "node:test";
import assert from "node:assert/strict";
import { makeTestRoom, makeTestCombatant } from "./test-utils.mjs";
import { createEmptyRoom } from "@dnd-tactical/shared";
import { hashRoom, HISTORY_TTL_MS, RoomHistory, roomHistory } from "../apps/server/src/room/roomHistory.ts";
import { checkCombatOutcome } from "../apps/server/src/room/roomState.ts";
import { clients, rooms } from "../apps/server/src/room/roomStore.ts";
import { dispatchCommand } from "../apps/server/src/commands/dispatcher.ts";
import { validateClientCommand } from "../apps/server/src/validation/validateClientCommand.ts";

test("hashRoom es determinista independientemente del orden de claves", () => {
  const roomA = { code: "ROOM1", round: 1, stateVersion: 0, phase: "active" };
  const roomB = { phase: "active", stateVersion: 0, round: 1, code: "ROOM1" };
  assert.equal(hashRoom(roomA), hashRoom(roomB));
});

test("hashRoom detecta mutaciones en el snapshot", () => {
  const room = { code: "ROOM1", round: 1, stateVersion: 0, phase: "active" };
  const before = hashRoom(room);
  room.round = 2;
  const after = hashRoom(room);
  assert.notEqual(before, after);
});

test("solo una sala ordinaria participa de Undo, independientemente del código", () => {
  const history = new RoomHistory();
  for (const code of ["DM4D5Q", "7H2EX"]) {
    const tutorial = { ...createEmptyRoom(code), phase: "active" };
    history.pushTurnCheckpoint(code, tutorial);
    history.pushTurnCheckpoint(code, tutorial);
    assert.equal(history.canUndo(code), false);
  }
  const room = { ...createEmptyRoom("ROOM1"), phase: "active", stateVersion: 0 };
  history.pushTurnCheckpoint(room.code, room);
  history.pushTurnCheckpoint(room.code, room);
  assert.equal(history.canUndo(room.code), true);
});

test("stateVersion atraviesa los schemas estrictos sin admitir otros campos", () => {
  const action = { type: "cast-spell", roomCode: "ROOM1", actorId: "gm", casterId: "hero", slotId: "slot", d20Roll: null, amount: null };
  assert.deepEqual(validateClientCommand({ ...action, stateVersion: 2 }), { success: true, data: { ...action, stateVersion: 2 } });
  for (const stateVersion of [-1, 1.5, "2", null]) assert.equal(validateClientCommand({ ...action, stateVersion }).success, false);
  assert.equal(validateClientCommand({ ...action, stateVersion: 2, extra: true }).success, false);
  assert.deepEqual(validateClientCommand({ type: "create-room", name: "GM", stateVersion: 2 }), { success: true, data: { type: "create-room", name: "GM" } });
});

test("dispatcher rechaza estado viejo, ausente o futuro en sala versionada y excluye Undo en sala tutorial", (t) => {
  const events = [];
  const socket = { readyState: 1, OPEN: 1, send: value => events.push(JSON.parse(value)) };
  dispatchCommand(socket, { type: "create-room", name: "GM" });
  const hello = events[0];
  const room = rooms.get(hello.room.code);
  const actorId = hello.participant.id;
  t.after(() => { clients.delete(socket); rooms.delete(room.code); });
  assert.equal(hello.room.stateVersion, 0);
  room.stateVersion = 2;
  const command = { type: "gm-add-log", actorId, roomCode: room.code, message: "vigente" };
  const before = structuredClone(room);
  for (const version of [1, 3, undefined]) {
    assert.throws(() => dispatchCommand(socket, { ...command, stateVersion: version }), /Estado desactualizado/);
  }
  assert.deepEqual(room, before);
  dispatchCommand(socket, { ...command, stateVersion: 2 });
  assert.notDeepEqual(room.log, before.log);
  delete room.stateVersion;
  room.phase = "active";
  assert.throws(() => dispatchCommand(socket, { type: "gm-undo-turn", actorId, roomCode: room.code }), /no esta disponible en Academia o Demo/);
});

test("Undo conserva el punto restaurado y descarta la rama futura", () => {
  const history = new RoomHistory();
  const room = { ...createEmptyRoom("UNDO1"), phase: "active", stateVersion: 0 };
  for (const round of [1, 2, 3, 4]) history.pushTurnCheckpoint(room.code, { ...room, round });

  assert.equal(history.popTurnCheckpoints(room.code, 2)?.round, 2);
  assert.equal(history.canUndo(room.code, 2), false);
  history.pushTurnCheckpoint(room.code, { ...room, round: 3, stateVersion: 1 });
  assert.equal(history.popTurnCheckpoints(room.code, 1)?.round, 2);
  assert.equal(history.popTurnCheckpoints(room.code, 1)?.round, 1);
  assert.equal(history.canUndo(room.code), false);
});

test("Un checkpoint corrupto rechaza Undo sin descartar el historial", () => {
  const history = new RoomHistory();
  const room = { ...createEmptyRoom("UNDO1"), phase: "active", stateVersion: 0 };
  history.pushTurnCheckpoint(room.code, room);
  history.pushTurnCheckpoint(room.code, { ...room, round: 2 });
  history.history.get(room.code)[0].room.round = 99;

  assert.throws(() => history.popTurnCheckpoints(room.code, 1), /Checkpoint corrupto/);
  assert.equal(history.canUndo(room.code), true);
});

test("hashRoom incluye la versión y conserva el orden significativo de los turnos", () => {
  const room = { ...createEmptyRoom("UNDO1"), turnOrder: ["a", "b"], stateVersion: 0 };
  assert.notEqual(hashRoom(room), hashRoom({ ...room, stateVersion: 1 }));
  assert.notEqual(hashRoom(room), hashRoom({ ...room, turnOrder: ["b", "a"] }));
});

test("la poda global elimina un historial inactivo sin consultar su sala", () => {
  const history = new RoomHistory();
  const room = { ...createEmptyRoom("IDLE1"), phase: "active", stateVersion: 0 };
  history.pushTurnCheckpoint(room.code, room);
  history.history.get(room.code)[0].timestamp = Date.now() - HISTORY_TTL_MS - 1_000;
  history.pruneAll();
  assert.equal(history.history.has(room.code), false);
});

test("el cierre natural descarta checkpoints antes de una eventual reapertura", (t) => {
  const room = makeTestRoom({ code: "END01", stateVersion: 0, combatants: [
    makeTestCombatant({ id: "hero", type: "player" }),
    makeTestCombatant({ id: "enemy", type: "enemy", hpCurrent: -10 }),
  ] });
  t.after(() => roomHistory.clear(room.code));
  roomHistory.pushTurnCheckpoint(room.code, room);
  roomHistory.pushTurnCheckpoint(room.code, room);
  assert.equal(roomHistory.canUndo(room.code), true);
  checkCombatOutcome(room);
  assert.equal(room.phase, "finished");
  assert.equal(roomHistory.canUndo(room.code), false);
});

test("Undo restaura el índice y el actor del mismo turno", (t) => {
  const code = "UNDO2";
  const actorId = "gm-undo";
  const socket = { readyState: 1, OPEN: 1, send: () => {} };
  rooms.set(code, makeTestRoom({ code, stateVersion: 0, phase: "preparation", combatants: [
    makeTestCombatant({ id: "hero", initiative: 20 }),
    makeTestCombatant({ id: "enemy", initiative: 10, type: "enemy" })
  ] }));
  clients.set(socket, { id: actorId, role: "gm", name: "GM", roomCode: code });
  t.after(() => { clients.delete(socket); rooms.delete(code); });
  const send = type => dispatchCommand(socket, { type, roomCode: code, actorId });
  send("sort-initiative");
  send("end-turn");
  send("end-turn");
  assert.equal(rooms.get(code).stateVersion, 0, "Los checkpoints no avanzan la versión");
  send("gm-undo-turn");
  const restored = rooms.get(code);
  assert.equal(restored.turnOrder[restored.activeTurnIndex], "enemy");
  assert.equal(restored.currentTurn.combatantId, "enemy");
  assert.equal(restored.stateVersion, 1);
});
