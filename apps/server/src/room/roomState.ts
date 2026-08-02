import { getCombatantOccupiedCells, lifeStatus, lifeStatusLabel, makeLog, type CombatRoom, type Combatant, type EffectInstance, type Position, type TurnState } from "@dnd-tactical/shared";

export function findCombatant(room: CombatRoom, id: string): Combatant {
  const combatant = room.combatants.find((item) => item.id === id);
  if (!combatant) throw new Error("Combatiente no encontrado.");
  return combatant;
}

export function checkCombatOutcome(room: CombatRoom): void {
  if (room.outcome !== "ongoing") return;
  const players = room.combatants.filter((combatant) => combatant.type === "player");
  const enemies = room.combatants.filter((combatant) => combatant.type === "enemy");
  if (players.length === 0 || enemies.length === 0) return;
  const allPlayersDead = players.every((combatant) => lifeStatus(combatant) === "dead");
  const allEnemiesDead = enemies.every((combatant) => lifeStatus(combatant) === "dead");
  if (allEnemiesDead) {
    room.outcome = "victory";
    room.phase = "finished";
    room.completedAt = new Date().toISOString();
    room.pendingOpportunityAttacks = [];
    room.log.unshift(makeLog("system", "Victoria! Todos los enemigos han sido derrotados."));
  } else if (allPlayersDead) {
    room.outcome = "tpk";
    room.phase = "finished";
    room.completedAt = new Date().toISOString();
    room.pendingOpportunityAttacks = [];
    room.log.unshift(makeLog("system", "TPK! Todos los heroes han muerto."));
  }
  syncEncounterPhase(room);
}

export function syncEncounterPhase(room: CombatRoom): void {
  if (room.outcome !== "ongoing") {
    room.phase = "finished";
  } else if (room.activeAttackThreat) {
    room.phase = "critical-confirmation";
  } else if (room.pendingOpportunityAttacks && room.pendingOpportunityAttacks.length > 0) {
    room.phase = "opportunity-resolution";
  } else if (room.turnOrder && room.turnOrder.length > 0) {
    room.phase = "active";
  } else {
    room.phase = "preparation";
  }
}

/**
 * Omitimos temporariamente effectInstances para representar la frontera de deserialización
 * de un objeto guardado antiguamente que puede no contener las propiedades modernas.
 */
type LegacyTurnState = Omit<TurnState, "normalDiagonalStepsThisTurn"> &
  Partial<Pick<TurnState, "normalDiagonalStepsThisTurn">>;

export type LegacyCombatRoom = Omit<CombatRoom, "effectInstances" | "currentTurn"> & {
  effectInstances?: EffectInstance[];
  currentTurn: LegacyTurnState;
};

/**
 * Corrige y rellena un estado legacy (o parcial persistido) mutándolo
 * in situ para garantizar que el resto del motor opere sobre un CombatRoom válido.
 * 
 * Es la ÚNICA frontera donde está permitido tolerar que falten campos
 * como `effectInstances`.
 */
export function ensureLegacyRoomShape(legacyRoom: LegacyCombatRoom): asserts legacyRoom is CombatRoom {
  const room = legacyRoom as CombatRoom;
  if (!room.outcome) room.outcome = "ongoing";
  if (room.completedAt === undefined) room.completedAt = null;
  if (!room.effectInstances) room.effectInstances = [];
  if (typeof room.eventSequence !== "number") room.eventSequence = 0;

  syncEncounterPhase(room);

  if (room.currentTurn) {
    if (room.currentTurn.normalDiagonalStepsThisTurn === undefined) room.currentTurn.normalDiagonalStepsThisTurn = 0;
    if (room.currentTurn.usedTotalDefense === undefined) room.currentTurn.usedTotalDefense = false;
    if (room.currentTurn.usedStabilization === undefined) room.currentTurn.usedStabilization = false;
  }
  
  for (const combatant of room.combatants) {
    ensureCombatantStats(combatant);
    combatant.controlledBy ??= { type: combatant.controller };
  }
  ensureUniqueCombatantPositions(room);
}

export function placeCombatantInFreeCell(room: CombatRoom, combatant: Combatant): void {
  if (isFootprintPlaceable(room, combatant, combatant.position)) return;
  combatant.position = findNearestFreeCell(room, combatant, combatant.position);
}

export function isCellInsideBoard(room: CombatRoom, position: { x: number; y: number }): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < room.board.width && position.y < room.board.height;
}

export function isCellOccupied(room: CombatRoom, position: { x: number; y: number }, exceptId?: string): boolean {
  const movingCombatant = exceptId ? room.combatants.find((combatant) => combatant.id === exceptId) : undefined;
  const candidateCells = movingCombatant
    ? getCombatantOccupiedCells({ ...movingCombatant, position: { ...position, zFeet: movingCombatant.position.zFeet } }, room)
    : [{ ...position, zFeet: 0 }];
  const candidateKeys = new Set(candidateCells.map(cellKey));
  return room.combatants.some((combatant) =>
    combatant.id !== exceptId &&
    getCombatantOccupiedCells(combatant, room).some((cell) => candidateKeys.has(cellKey(cell)))
  );
}

export function isCombatantInsideBoard(room: CombatRoom, combatant: Combatant, position: Position): boolean {
  return getCombatantOccupiedCells({ ...combatant, position: { ...position } }, room)
    .every((cell) => isCellInsideBoard(room, cell));
}

export function sameCell(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return a.x === b.x && a.y === b.y;
}

export function formatCell(position: { x: number; y: number }): string {
  return "(" + position.x + ", " + position.y + ")";
}

export function movementDistanceFeet(origin: { x: number; y: number }, destination: { x: number; y: number }, cellSizeFeet: number): number {
  const dx = Math.abs(origin.x - destination.x);
  const dy = Math.abs(origin.y - destination.y);
  const diagonals = Math.min(dx, dy);
  const straight = Math.max(dx, dy) - diagonals;
  const diagonalFeet = Math.floor(diagonals / 2) * cellSizeFeet * 3 + (diagonals % 2) * cellSizeFeet;
  return diagonalFeet + straight * cellSizeFeet;
}

export function logStatusChange(room: CombatRoom, combatant: Combatant, before: ReturnType<typeof lifeStatus>, after: ReturnType<typeof lifeStatus>): void {
  if (before === after) return;
  room.log.unshift(makeLog("status", combatant.name + " pasa de " + lifeStatusLabel(before) + " a " + lifeStatusLabel(after) + "."));
}

function ensureUniqueCombatantPositions(room: CombatRoom): void {
  const occupied = new Set<string>();
  for (const combatant of room.combatants) {
    const currentCells = getCombatantOccupiedCells(combatant, room);
    if (!isFootprintPlaceable(room, combatant, combatant.position, occupied, true)) {
      combatant.position = findNearestFreeCell(room, combatant, combatant.position, occupied, true);
    }
    for (const cell of getCombatantOccupiedCells(combatant, room)) occupied.add(cellKey(cell));
  }
}

function findNearestFreeCell(
  room: CombatRoom,
  combatant: Combatant,
  origin: { x: number; y: number; zFeet: number },
  reserved = new Set<string>(),
  ignoreRoomCombatants = false
): { x: number; y: number; zFeet: number } {
  const candidates: Array<{ x: number; y: number; distance: number }> = [];
  for (let y = 0; y < room.board.height; y += 1) {
    for (let x = 0; x < room.board.width; x += 1) {
      const position = { x, y, zFeet: origin.zFeet ?? 0 };
      if (!isFootprintPlaceable(room, combatant, position, reserved, ignoreRoomCombatants)) continue;
      candidates.push({ x, y, distance: Math.abs(origin.x - x) + Math.abs(origin.y - y) });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  const chosen = candidates[0];
  if (!chosen) throw new Error("No hay casillas libres para agregar otro combatiente.");
  return { x: chosen.x, y: chosen.y, zFeet: origin.zFeet ?? 0 };
}

function isFootprintPlaceable(
  room: CombatRoom,
  combatant: Combatant,
  position: Position,
  reserved = new Set<string>(),
  ignoreRoomCombatants = false
): boolean {
  const cells = getCombatantOccupiedCells({ ...combatant, position: { ...position } }, room);
  if (cells.some((cell) => !isCellInsideBoard(room, cell))) return false;
  if (cells.some((cell) => room.board.impassableCells?.includes(`${cell.x},${cell.y}`))) return false;
  if (cells.some((cell) => reserved.has(cellKey(cell)))) return false;
  if (ignoreRoomCombatants) return true;
  const keys = new Set(cells.map(cellKey));
  return !room.combatants.some((other) =>
    other.id !== combatant.id &&
    getCombatantOccupiedCells(other, room).some((cell) => keys.has(cellKey(cell)))
  );
}

function cellKey(position: { x: number; y: number; zFeet?: number }): string {
  return position.x + "," + position.y + "," + (position.zFeet ?? 0);
}

function ensureCombatantStats(combatant: Combatant): void {
  combatant.stats ??= { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, kills: 0, timesDroppedToZero: 0, healingReceived: 0, opportunityAttacksThisRound: 0, targetsAttackedThisRoundViaAoO: [] };
}
