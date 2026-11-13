import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { WebSocket } from "ws";
import type { CombatRoom, Participant, RoomInterruption, ServerEvent } from "@dnd-tactical/shared";

export const rooms = new Map<string, CombatRoom>();
export const clients = new Map<WebSocket, Participant>();

export function findParticipant(actorId: string): Participant | undefined {
  return [...clients.values()].find((item) => item.id === actorId);
}

export function register(socket: WebSocket, roomCode: string, name: string, role: Participant["role"]): Participant {
  if (clients.has(socket)) throw new Error("La conexion ya pertenece a una sala.");
  const participant: Participant = { id: randomUUID(), role, name, roomCode };
  clients.set(socket, participant);
  return participant;
}

const gmSessions = new Map<string, { participant: Participant; digest: Buffer }>();

export function issueGmResumeToken(participant: Participant): string {
  const token = randomBytes(32).toString("base64url");
  gmSessions.set(participant.roomCode, { participant, digest: hashToken(token) });
  return token;
}

function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}

export function resumeGmSession(socket: WebSocket, roomCode: string, token: string) {
  const code = roomCode.toUpperCase();
  const session = gmSessions.get(code);
  const room = rooms.get(code);
  if (!room || !session || clients.has(socket) || !timingSafeEqual(session.digest, hashToken(token))) {
    return { kind: "unavailable" } as const;
  }
  if (findParticipant(session.participant.id)) return { kind: "active" } as const;

  clients.set(socket, session.participant);
  return { kind: "resumed", participant: session.participant, room } as const;
}

export function broadcast(room: CombatRoom): void {
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
