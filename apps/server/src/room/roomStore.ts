import type { WebSocket } from "ws";
import type { CombatRoom, Participant, ServerEvent } from "@dnd-tactical/shared";

export const rooms = new Map<string, CombatRoom>();
export const clients = new Map<WebSocket, Participant>();

export function findParticipant(actorId: string): Participant | undefined {
  return [...clients.values()].find((item) => item.id === actorId);
}

export function register(socket: WebSocket, roomCode: string, name: string, role: Participant["role"]): Participant {
  const participant: Participant = { id: role + "-" + Math.random().toString(36).slice(2, 10), role, name, roomCode };
  clients.set(socket, participant);
  return participant;
}

export function broadcast(room: CombatRoom): void {
  for (const [socket, participant] of clients) {
    if (participant.roomCode === room.code && socket.readyState === socket.OPEN) send(socket, { type: "room-update", room });
  }
}

export function send(socket: WebSocket, event: ServerEvent): void {
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
  for (const socket of clients.keys()) {
    if (socket.readyState === socket.OPEN) send(socket, { type: "system-reset" } as any);
  }
}
