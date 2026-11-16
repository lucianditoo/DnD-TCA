import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { hashRoom, MAX_HISTORY_DEPTH, roomHistory, type TurnCheckpoint } from "./roomHistory.js";
import type { WebSocket } from "ws";
import type { CombatRoom, Participant, RoomInterruption, ServerEvent } from "@dnd-tactical/shared";

export const rooms = new Map<string, CombatRoom>();
export const clients = new Map<WebSocket, Participant>();

export const internalParticipants = new Map<string, Participant>();

export function findParticipant(actorId: string): Participant | undefined {
  return [...clients.values()].find((item) => item.id === actorId) ?? internalParticipants.get(actorId);
}

export function register(socket: WebSocket, roomCode: string, name: string, role: Participant["role"]): Participant {
  if (clients.has(socket)) throw new Error("La conexion ya pertenece a una sala.");
  const participant: Participant = { id: randomUUID(), role, name, roomCode };
  clients.set(socket, participant);
  return participant;
}

const GM_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const gmSessions = new Map<string, { participant: Participant; digest: Buffer; expiresAt: number }>();

const codeSchema = z.string().regex(/^[A-Z0-9]{5}$/);
const roomSchema = z.object({
  code: codeSchema,
  stateVersion: z.number().int().nonnegative(),
  board: z.object({ width: z.number().int().positive(), height: z.number().int().positive(), cellSizeFeet: z.literal(5) }).passthrough(),
  combatants: z.array(z.object({ id: z.string(), hpCurrent: z.number(), position: z.object({
    x: z.number(), y: z.number(), zFeet: z.number()
  }), controlledBy: z.object({ type: z.enum(["gm", "player"]) }).passthrough() }).passthrough()),
  turnOrder: z.array(z.string()),
  activeTurnIndex: z.number().int().nonnegative(),
  round: z.number().int().positive(),
  phase: z.enum(["preparation", "active", "opportunity-resolution", "critical-confirmation", "finished"]),
  outcome: z.enum(["ongoing", "victory", "tpk"]),
  completedAt: z.string().nullable(),
  currentTurn: z.object({ combatantId: z.string().nullable(), movementUsedFeet: z.number().nonnegative() }).passthrough(),
  pendingOpportunityAttacks: z.array(z.object({ id: z.string(), attackerId: z.string(), targetId: z.string() }).passthrough()),
  activeAttackThreat: z.object({ attackerId: z.string(), targetId: z.string() }).passthrough().nullable(),
  pendingCoupDeGrace: z.object({}).passthrough().nullable(),
  effectInstances: z.array(z.object({ instanceId: z.string(), effectId: z.string() }).passthrough()),
  log: z.array(z.object({ id: z.string(), message: z.string() }).passthrough()),
  eventSequence: z.number().int().nonnegative(),
}).passthrough();

const checkpointSchema = z.object({
  room: roomSchema, turnNumber: z.number().int().positive(), round: z.number().int().positive(),
  activeTurnIndex: z.number().int().nonnegative(), stateHash: z.string().regex(/^[0-9a-f]{64}$/),
  timestamp: z.number().int().nonnegative(), stateVersion: z.number().int().nonnegative(),
}).strict();
const diskSchema = z.object({
  version: z.literal(1),
  rooms: z.record(codeSchema, z.object({
    room: roomSchema,
    roomHash: z.string().regex(/^[0-9a-f]{64}$/),
    participant: z.object({ id: z.string().uuid(), name: z.string(), role: z.literal("gm"), roomCode: codeSchema }).strict(),
    tokenHash: z.string().regex(/^[0-9a-f]{64}$/),
    expiresAt: z.number().int().nonnegative(),
    history: z.object({
      checkpoints: z.array(checkpointSchema).max(MAX_HISTORY_DEPTH),
      turnCounter: z.number().int().nonnegative(),
    }).strict()
  }).strict()),
}).strict();

let activePersistencePath: string | undefined;

export function saveToDisk(): void {
  const path = activePersistencePath;
  if (!path) return;
  try {
    const now = Date.now();
    const entries = [...gmSessions].flatMap(([code, session]) => {
      const room = rooms.get(code);
      if (!room || room.stateVersion === undefined || session.expiresAt <= now) return [];
      return [[code, { room, roomHash: hashRoom(room), participant: session.participant,
        tokenHash: session.digest.toString("hex"), expiresAt: session.expiresAt, history: roomHistory.exportRoom(code) }]];
    });
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = path + ".tmp";
    const file = openSync(temporary, "w", 0o600);
    try {
      writeFileSync(file, JSON.stringify({ version: 1, rooms: Object.fromEntries(entries) }), "utf8");
      fsyncSync(file);
    } finally {
      closeSync(file);
    }
    renameSync(temporary, path);
  } catch (error) {
    console.error("No se pudo guardar el estado de las salas:", error instanceof Error ? error.name : "error");
  }
}

export function loadFromDisk(): void {
  const configured = process.env.DND_ROOM_STORE_PATH;
  if (!configured && process.env.TEST_MODE === "true") return;
  const path = resolve(configured ?? ".data/room-history.json");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      activePersistencePath = path;
      return;
    }
    throw new Error("No se pudo leer el estado de las salas.", { cause: error });
  }
  const disk = diskSchema.parse(JSON.parse(raw));
  const now = Date.now();
  const restored = Object.entries(disk.rooms).filter(([, saved]) => saved.expiresAt > now);
  for (const [code, saved] of restored) {
    if (saved.room.code !== code || saved.participant.roomCode !== code ||
        hashRoom(saved.room as unknown as CombatRoom) !== saved.roomHash ||
        saved.history.checkpoints.some((checkpoint, index, list) =>
          checkpoint.room.code !== code || checkpoint.room.phase !== "active" ||
          checkpoint.round !== checkpoint.room.round || checkpoint.activeTurnIndex !== checkpoint.room.activeTurnIndex ||
          checkpoint.turnNumber > saved.history.turnCounter ||
          (index > 0 && checkpoint.turnNumber <= list[index - 1]!.turnNumber) ||
          checkpoint.stateVersion !== checkpoint.room.stateVersion || checkpoint.stateVersion > saved.room.stateVersion ||
          hashRoom(checkpoint.room as unknown as CombatRoom) !== checkpoint.stateHash)) {
      throw new Error("Estado de sala o historial incoherente para " + code + ".");
    }
  }
  for (const [code, saved] of restored) {
    rooms.set(code, saved.room as unknown as CombatRoom);
    gmSessions.set(code, { participant: saved.participant, digest: Buffer.from(saved.tokenHash, "hex"), expiresAt: saved.expiresAt });
    roomHistory.importRoom(code, saved.history.checkpoints as unknown as TurnCheckpoint[], saved.history.turnCounter);
  }
  activePersistencePath = path;
}

export function issueGmResumeToken(participant: Participant): string {
  const token = randomBytes(32).toString("base64url");
  gmSessions.set(participant.roomCode, { participant, digest: hashToken(token), expiresAt: Date.now() + GM_SESSION_TTL_MS });
  saveToDisk();
  return token;
}

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export function resumeGmSession(socket: WebSocket, roomCode: string, token: string) {
  const code = roomCode.toUpperCase();
  const session = gmSessions.get(code);
  const room = rooms.get(code);
  if (!room || !session || session.expiresAt <= Date.now() || clients.has(socket) || !timingSafeEqual(session.digest, hashToken(token))) {
    return { kind: "unavailable" } as const;
  }
  if (findParticipant(session.participant.id)) return { kind: "active" } as const;

  clients.set(socket, session.participant);
  return { kind: "resumed", participant: session.participant, room } as const;
}

export function broadcast(room: CombatRoom): void {
  // Publish the room and its history in one disk replacement after the command commits.
  if (gmSessions.has(room.code) && rooms.get(room.code) === room) saveToDisk();
  for (const [socket, participant] of clients) {
    if (participant.roomCode === room.code && socket.readyState === socket.OPEN) send(socket, { type: "room-update", room });
  }
}

export function send(socket: WebSocket, event: ServerEvent): void {
  if (event.type === "hello" || event.type === "room-update") {
    const { pendingStationaryAction: _pending, pendingMovement: _movement, ...room } = event.room;
    const participant = clients.get(socket);
    let interruption: RoomInterruption | undefined;
    if (participant?.role === "gm" && participant.roomCode === room.code &&
        room.outcome === "ongoing" && (room.phase === "opportunity-resolution" || room.phase === "critical-confirmation")) {
      if (_movement) interruption = { kind: _movement.kind };
      else if (_pending) {
        const type = _pending.command.type;
        interruption = { kind: type === "use-tactical-action" ? "stand-up" : type };
      }
    }
    socket.send(JSON.stringify({ ...event, room, interruption }));
    return;
  }
  socket.send(JSON.stringify(event));
}

export function createRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 5; index += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(code) ? createRoomCode() : code;
}

export function resetAllRoomsForTest(): void {
  rooms.clear();
  gmSessions.clear();
  for (const socket of clients.keys()) {
    if (socket.readyState === socket.OPEN) send(socket, { type: "system-reset" } as any);
  }
}
