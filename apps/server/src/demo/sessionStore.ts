import type { WebSocket } from "ws";
import {
  createEmptyRoom,
  type Board,
  type CombatRoom,
  type DemoScriptDefinition,
  type DemoSessionState,
  type DemoSpeedMultiplier,
  type Participant
} from "@dnd-tactical/shared";
import { clients, rooms } from "../room/roomStore.js";

export interface DemoSessionRecord {
  readonly sessionId: string;
  readonly demoId: string;
  readonly script: DemoScriptDefinition;
  readonly socket: WebSocket;
  roomCode: string;
  participant: Participant;
  status: DemoSessionState["status"];
  currentSceneIndex: number;
  currentStepIndex: number;
  activeActorName: string | null;
  actionSummary: string;
  ruleExplanation: string;
  speedMultiplier: DemoSpeedMultiplier;
  errorMessage: string | null;
  commandInFlight: boolean;
  timerHandle: ReturnType<typeof setTimeout> | null;
}

export const sessionsById = new Map<string, DemoSessionRecord>();
export const sessionBySocket = new Map<WebSocket, DemoSessionRecord>();
export const sessionByRoomCode = new Map<string, DemoSessionRecord>();

export function isDemoRoom(roomCode: string | undefined): boolean {
  if (!roomCode) return false;
  return sessionByRoomCode.has(roomCode.toUpperCase());
}

export function getDemoSessionById(sessionId: string): DemoSessionRecord | undefined {
  return sessionsById.get(sessionId);
}

export function getDemoSessionBySocket(socket: WebSocket): DemoSessionRecord | undefined {
  return sessionBySocket.get(socket);
}

export function getDemoSessionByRoomCode(roomCode: string): DemoSessionRecord | undefined {
  return sessionByRoomCode.get(roomCode.toUpperCase());
}

export function cloneBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    cellSizeFeet: board.cellSizeFeet,
    ...(board.difficultTerrainCells ? { difficultTerrainCells: [...board.difficultTerrainCells] } : {}),
    ...(board.impassableCells ? { impassableCells: [...board.impassableCells] } : {}),
    ...(board.narrowCells ? { narrowCells: [...board.narrowCells] } : {}),
    ...(board.lineOfEffectBlockingCells ? { lineOfEffectBlockingCells: [...board.lineOfEffectBlockingCells] } : {}),
    ...(board.dimLightCells ? { dimLightCells: [...board.dimLightCells] } : {}),
    ...(board.darknessCells ? { darknessCells: [...board.darknessCells] } : {})
  };
}

export function createDemoRoomWithBoard(roomCode: string, board: Board): CombatRoom {
  const room = createEmptyRoom(roomCode);
  room.board = cloneBoard(board);
  return room;
}

export function generateUniqueDemoRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let suffix = "";
    for (let index = 0; index < 4; index += 1) {
      suffix += chars[Math.floor(Math.random() * chars.length)];
    }
    const candidate = `DM${suffix}`;
    if (!rooms.has(candidate) && !sessionByRoomCode.has(candidate)) {
      return candidate;
    }
  }
  return `DM${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export function clearDemoSessionTimer(record: DemoSessionRecord): void {
  if (record.timerHandle !== null) {
    clearTimeout(record.timerHandle);
    record.timerHandle = null;
  }
}

export function registerDemoSession(record: DemoSessionRecord, room: CombatRoom): void {
  const existingForSocket = sessionBySocket.get(record.socket);
  if (existingForSocket && existingForSocket.sessionId !== record.sessionId) {
    destroyDemoSession(existingForSocket.sessionId);
  }
  const code = record.roomCode.toUpperCase();
  record.roomCode = code;
  rooms.set(code, room);
  clients.set(record.socket, record.participant);
  sessionsById.set(record.sessionId, record);
  sessionBySocket.set(record.socket, record);
  sessionByRoomCode.set(code, record);
}

export function replaceDemoSessionRoom(record: DemoSessionRecord, newRoom: CombatRoom, newParticipant: Participant): void {
  clearDemoSessionTimer(record);
  const oldCode = record.roomCode.toUpperCase();
  sessionByRoomCode.delete(oldCode);
  rooms.delete(oldCode);

  const newCode = newRoom.code.toUpperCase();
  record.roomCode = newCode;
  record.participant = newParticipant;
  rooms.set(newCode, newRoom);
  clients.set(record.socket, newParticipant);
  sessionByRoomCode.set(newCode, record);
}

export function destroyDemoSession(sessionId: string): DemoSessionRecord | undefined {
  const record = sessionsById.get(sessionId);
  if (!record) return undefined;
  clearDemoSessionTimer(record);
  const code = record.roomCode.toUpperCase();
  sessionByRoomCode.delete(code);
  rooms.delete(code);
  sessionsById.delete(sessionId);
  if (sessionBySocket.get(record.socket)?.sessionId === sessionId) {
    sessionBySocket.delete(record.socket);
  }
  if (clients.get(record.socket)?.id === record.participant.id) {
    clients.delete(record.socket);
  }
  return record;
}

export function destroyDemoSessionBySocket(socket: WebSocket): DemoSessionRecord | undefined {
  const record = sessionBySocket.get(socket);
  if (!record) return undefined;
  return destroyDemoSession(record.sessionId);
}

export function toDemoSessionState(record: DemoSessionRecord): DemoSessionState {
  const scene = record.script.scenes[record.currentSceneIndex];
  return {
    sessionId: record.sessionId,
    demoId: record.demoId,
    roomCode: record.roomCode,
    status: record.status,
    currentSceneIndex: record.currentSceneIndex,
    totalScenes: record.script.scenes.length,
    currentSceneTitle: scene?.title ?? "",
    currentStepIndex: record.currentStepIndex,
    totalStepsInScene: scene?.steps.length ?? 0,
    activeActorName: record.activeActorName,
    actionSummary: record.actionSummary,
    ruleExplanation: record.ruleExplanation,
    speedMultiplier: record.speedMultiplier,
    errorMessage: record.errorMessage
  };
}
