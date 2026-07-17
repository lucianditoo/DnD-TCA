import type { WebSocket } from "ws";
import { createEmptyRoom, gameCatalog, type ClientCommand } from "@dnd-tactical/shared";
import { broadcast, createRoomCode, register, rooms, send } from "../room/roomStore.js";

export function handleCreateRoom(socket: WebSocket, command: Extract<ClientCommand, { type: "create-room" }>): void {
  const code = createRoomCode();
  const room = createEmptyRoom(code);
  rooms.set(code, room);
  const participant = register(socket, code, command.name || "GM", "gm");
  send(socket, { type: "hello", participant, room, catalog: gameCatalog });
}

export function handleJoinRoom(socket: WebSocket, command: Extract<ClientCommand, { type: "join-room" }>): void {
  const room = rooms.get(command.roomCode.toUpperCase());
  if (!room) { send(socket, { type: "error", message: "No existe una sala con ese codigo." }); return; }
  const participant = register(socket, room.code, command.name || "Jugador", command.role);
  send(socket, { type: "hello", participant, room, catalog: gameCatalog });
  broadcast(room);
}
