import test from "node:test";
import assert from "node:assert/strict";
import {
  SCRIPTED_TACTICAL_DEMO_ID,
  demoBoard
} from "@dnd-tactical/shared";
import { dispatchCommand } from "../apps/server/src/commands/dispatcher.ts";
import { handleDemoCommand } from "../apps/server/src/demo/demoCommands.ts";
import { startNewDemoSession } from "../apps/server/src/demo/runner.ts";
import {
  destroyDemoSession,
  destroyDemoSessionBySocket,
  getDemoSessionById
} from "../apps/server/src/demo/sessionStore.ts";
import { clients, rooms } from "../apps/server/src/room/roomStore.ts";

function createMockSocket() {
  const messages = [];
  return {
    OPEN: 1,
    readyState: 1,
    messages,
    send(payload) {
      messages.push(JSON.parse(payload));
    }
  };
}

test("Demo isolation: demo rooms block external manual combat commands and join-room", () => {
  const demoSocket = createMockSocket();
  const intruderSocket = createMockSocket();
  const record = startNewDemoSession(demoSocket, SCRIPTED_TACTICAL_DEMO_ID, "DemoOwner", { autoPlay: false });

  try {
    // External client cannot join demo room
    assert.throws(
      () =>
        dispatchCommand(intruderSocket, {
          type: "join-room",
          roomCode: record.roomCode,
          name: "Intruso",
          role: "player"
        }),
      /sala de demostracion/i
    );

    // Even the owner socket cannot send manual combat commands via dispatchCommand
    assert.throws(
      () =>
        dispatchCommand(demoSocket, {
          type: "sort-initiative",
          roomCode: record.roomCode,
          actorId: record.participant.id
        }),
      /solo lectura/i
    );

    // Another socket cannot control the demo session even with a valid sequence
    assert.throws(
      () =>
        handleDemoCommand(intruderSocket, {
          type: "pause-demo",
          sessionId: record.sessionId,
          sequence: record.sequence
        }),
      /permisos/i
    );
  } finally {
    destroyDemoSession(record.sessionId);
  }
});

test("Demo isolation: normal rooms and shared demoBoard remain untouched during demo lifecycle and disconnect cleanup", () => {
  const originalBoardSnapshot = JSON.stringify(demoBoard);
  const normalSocket = createMockSocket();
  dispatchCommand(normalSocket, { type: "create-room", name: "NormalGM" });
  const normalHello = normalSocket.messages.find((m) => m.type === "hello");
  assert.ok(normalHello);
  const normalRoomCode = normalHello.room.code;

  const demoSocket = createMockSocket();
  const record = startNewDemoSession(demoSocket, SCRIPTED_TACTICAL_DEMO_ID, "DemoGM", { autoPlay: true });
  const demoRoomCode = record.roomCode;

  try {
    assert.notEqual(demoRoomCode, normalRoomCode);
    assert.equal(rooms.has(normalRoomCode), true);
    assert.equal(rooms.has(demoRoomCode), true);

    // Disconnect demo socket
    destroyDemoSessionBySocket(demoSocket);

    // Demo room and session are gone, normal room and client remain intact
    assert.equal(getDemoSessionById(record.sessionId), undefined);
    assert.equal(rooms.has(demoRoomCode), false);
    assert.equal(rooms.has(normalRoomCode), true);
    assert.equal(clients.has(normalSocket), true);
    assert.equal(JSON.stringify(demoBoard), originalBoardSnapshot);
  } finally {
    destroyDemoSession(record.sessionId);
    rooms.delete(normalRoomCode);
    clients.delete(normalSocket);
  }
});
