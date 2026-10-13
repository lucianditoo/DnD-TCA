import type { WebSocket } from "ws";
import type { DemoClientCommand } from "@dnd-tactical/shared";
import { send } from "../room/roomStore.js";
import {
  clearDemoSessionTimer,
  destroyDemoSession,
  getDemoSessionById,
  type DemoSessionRecord
} from "./sessionStore.js";
import {
  emitDemoSessionState,
  executeNextDemoStep,
  prepareSceneInRoom,
  scheduleNextAutoStep,
  startNewDemoSession
} from "./runner.js";

export function requireOwnedDemoSession(socket: WebSocket, sessionId: string): DemoSessionRecord {
  const record = getDemoSessionById(sessionId);
  if (!record) {
    throw new Error("Sesion de demostracion no encontrada.");
  }
  if (record.socket !== socket) {
    throw new Error("No tienes permisos para controlar esta sesion de demostracion.");
  }
  return record;
}

export function handleDemoCommand(socket: WebSocket, command: DemoClientCommand): void {
  switch (command.type) {
    case "start-demo": {
      startNewDemoSession(socket, command.demoId, command.name);
      return;
    }
    case "pause-demo": {
      const record = requireOwnedDemoSession(socket, command.sessionId);
      if (record.status === "playing") {
        clearDemoSessionTimer(record);
        record.status = "paused";
      }
      emitDemoSessionState(record);
      return;
    }
    case "resume-demo": {
      const record = requireOwnedDemoSession(socket, command.sessionId);
      if (record.status === "paused") {
        record.status = "playing";
        emitDemoSessionState(record);
        scheduleNextAutoStep(record, 200);
      } else {
        emitDemoSessionState(record);
      }
      return;
    }
    case "step-demo": {
      const record = requireOwnedDemoSession(socket, command.sessionId);
      if (record.status !== "paused") {
        throw new Error("Solo se puede avanzar paso a paso cuando la demostracion esta en pausa.");
      }
      executeNextDemoStep(record);
      return;
    }
    case "set-demo-speed": {
      const record = requireOwnedDemoSession(socket, command.sessionId);
      record.speedMultiplier = command.speedMultiplier;
      emitDemoSessionState(record);
      if (record.status === "playing") {
        scheduleNextAutoStep(record);
      }
      return;
    }
    case "restart-demo": {
      const record = requireOwnedDemoSession(socket, command.sessionId);
      clearDemoSessionTimer(record);
      const targetSceneIndex = command.scope === "all" ? 0 : record.currentSceneIndex;
      prepareSceneInRoom(record, targetSceneIndex, { newRoomCode: true });
      record.status = "playing";
      emitDemoSessionState(record);
      scheduleNextAutoStep(record, 250);
      return;
    }
    case "exit-demo": {
      const record = requireOwnedDemoSession(socket, command.sessionId);
      destroyDemoSession(record.sessionId);
      send(socket, { type: "demo-exited", sessionId: record.sessionId });
      return;
    }
  }
}
