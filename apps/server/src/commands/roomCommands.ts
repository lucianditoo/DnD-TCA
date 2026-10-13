import type { WebSocket } from "ws";
import {
  createEmptyRoom,
  gameCatalog,
  getCombatantOccupiedCells,
  lifeStatus,
  makeLog,
  type Board,
  type ClientCommand,
  type CombatRoom
} from "@dnd-tactical/shared";
import { requireGM } from "../auth/control.js";
import { broadcast, createRoomCode, findParticipant, register, rooms, send } from "../room/roomStore.js";

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

export function handleUpdateBoard(room: CombatRoom, command: Extract<ClientCommand, { type: "update-board" }>): void {
  requireGM(command.actorId);
  const participant = findParticipant(command.actorId);
  if (participant && participant.roomCode !== room.code) {
    throw new Error("Solo el GM de esta sala puede usar este control.");
  }

  const { width, height } = command.board;
  if (!Number.isInteger(width) || width < 6 || width > 40) {
    throw new Error("El ancho del tablero debe ser un entero entre 6 y 40.");
  }
  if (!Number.isInteger(height) || height < 6 || height > 40) {
    throw new Error("El alto del tablero debe ser un entero entre 6 y 40.");
  }

  const isValidCoord = (key: string) => {
    const parts = key.split(",");
    if (parts.length !== 2) return false;
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < width && y >= 0 && y < height;
  };

  const rawImpassable = new Set((command.board.impassableCells ?? []).filter(isValidCoord));
  const rawLoe = new Set((command.board.lineOfEffectBlockingCells ?? []).filter(isValidCoord));
  const rawDifficult = new Set((command.board.difficultTerrainCells ?? []).filter(isValidCoord));
  const rawNarrow = new Set((command.board.narrowCells ?? []).filter(isValidCoord));

  // cellSizeFeet se normaliza siempre a 5 (no es editable por el cliente)
  const candidateBoard: Board = {
    width,
    height,
    cellSizeFeet: 5,
    impassableCells: Array.from(rawImpassable),
    lineOfEffectBlockingCells: Array.from(rawLoe),
    difficultTerrainCells: Array.from(rawDifficult),
    narrowCells: Array.from(rawNarrow),
    dimLightCells: (command.board.dimLightCells ?? []).filter(isValidCoord),
    darknessCells: (command.board.darknessCells ?? []).filter(isValidCoord)
  };

  // Construir una vista / snapshot candidato no mutante para validar el estado RESULTANTE
  const candidateRoom: CombatRoom = {
    ...room,
    board: candidateBoard
  };

  // Validación de invariantes espaciales usando candidateRoom
  for (const combatant of room.combatants) {
    const occupiedCurrent = getCombatantOccupiedCells(combatant, room);

    if (lifeStatus(combatant) !== "dead") {
      for (const cell of occupiedCurrent) {
        const key = `${cell.x},${cell.y}`;
        if (rawImpassable.has(key)) {
          throw new Error(`No se puede colocar un muro en la casilla (${cell.x}, ${cell.y}) ocupada por ${combatant.name}.`);
        }
      }
    }

    const isSqueezing = room.effectInstances?.some(
      (instance) => instance.effectId === "srd_squeezing" && instance.targets?.includes(combatant.id)
    );

    // Derivar huella sobre el candidateRoom
    const occupiedCandidate = getCombatantOccupiedCells(combatant, candidateRoom);

    if (isSqueezing) {
      if (occupiedCandidate.length !== 2) {
        throw new Error(
          `No se puede actualizar el mapa: el nuevo tablero invalida la compresión (srd_squeezing) de ${combatant.name}. Reubícalo o restaura el corredor antes de editar.`
        );
      }

      // Comparar ambos como conjuntos canónicos de celdas (x, y, zFeet), sin depender del orden
      const currentKeys = new Set(occupiedCurrent.map((c) => `${c.x},${c.y},${c.zFeet ?? 0}`));
      const candidateKeys = new Set(occupiedCandidate.map((c) => `${c.x},${c.y},${c.zFeet ?? 0}`));
      const isExactlySameFootprint =
        currentKeys.size === candidateKeys.size &&
        [...currentKeys].every((k) => candidateKeys.has(k));

      if (!isExactlySameFootprint) {
        throw new Error(
          `No se puede actualizar el mapa: el cambio alteraría la huella comprimida actual de ${combatant.name}. Reubícalo o resuelve Squeezing antes de editar el corredor.`
        );
      }
    }

    // 1. Huella íntegramente dentro de los límites candidatos
    for (const cell of occupiedCandidate) {
      if (cell.x < 0 || cell.x >= width || cell.y < 0 || cell.y >= height) {
        throw new Error(
          `No se puede reducir el mapa a ${width}x${height}: ${combatant.name} quedaría fuera de los límites. Reubícalo antes de redimensionar.`
        );
      }
    }

    // 2. Ningún combatiente vivo sobre una celda impassable candidata
    if (lifeStatus(combatant) !== "dead") {
      for (const cell of occupiedCandidate) {
        const key = `${cell.x},${cell.y}`;
        if (rawImpassable.has(key)) {
          throw new Error(`No se puede colocar un muro en la casilla (${cell.x}, ${cell.y}) ocupada por ${combatant.name}.`);
        }
      }
    }
  }

  // Commit atómico del nuevo tablero
  room.board = candidateBoard;
  const purePillarCount = [...rawLoe].filter((k) => !rawImpassable.has(k)).length;
  room.log.unshift(
    makeLog(
      "system",
      `El GM actualizó el mapa táctico (${width}x${height}, ${rawImpassable.size} muros, ${purePillarCount} pilares, ${rawDifficult.size} escombros).`
    )
  );
  broadcast(room);
}
