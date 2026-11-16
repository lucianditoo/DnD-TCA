import { createHash } from "node:crypto";
import type { CombatRoom } from "@dnd-tactical/shared";

export const MAX_HISTORY_DEPTH = 10;
export const MAX_UNDO_STEPS = 3;
export const HISTORY_TTL_MS = 30 * 60 * 1000;

export interface TurnCheckpoint {
  readonly room: CombatRoom;
  readonly turnNumber: number;
  readonly round: number;
  readonly activeTurnIndex: number;
  readonly stateHash: string;
  readonly timestamp: number;
  readonly stateVersion: number;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const v = (value as Record<string, unknown>)[key];
        if (typeof v !== "function" && typeof v !== "symbol" && v !== undefined) {
          acc[key] = canonicalize(v);
        }
        return acc;
      }, {});
  }
  return value;
}

export function hashRoom(room: CombatRoom): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(room))).digest("hex");
}

export function isExcludedFromHistory(room: CombatRoom): boolean {
  // Only ordinary rooms opt in, when the server creates them.
  return room.stateVersion === undefined;
}

export class RoomHistory {
  private readonly history = new Map<string, TurnCheckpoint[]>();
  private readonly turnCounters = new Map<string, number>();

  pushTurnCheckpoint(roomCode: string, room: CombatRoom): void {
    if (isExcludedFromHistory(room) || room.phase !== "active") return;
    this.prune(roomCode);

    const cloned = structuredClone(room);
    const nextTurnNumber = (this.turnCounters.get(roomCode) ?? 0) + 1;
    this.turnCounters.set(roomCode, nextTurnNumber);

    const checkpoint: TurnCheckpoint = {
      room: cloned,
      turnNumber: nextTurnNumber,
      round: cloned.round,
      activeTurnIndex: cloned.activeTurnIndex,
      stateHash: hashRoom(cloned),
      timestamp: Date.now(),
      stateVersion: cloned.stateVersion ?? 0
    };

    const stack = this.history.get(roomCode) ?? [];
    stack.push(checkpoint);
    while (stack.length > MAX_HISTORY_DEPTH) {
      stack.shift();
    }
    this.history.set(roomCode, stack);
  }

  popTurnCheckpoints(roomCode: string, steps: number): TurnCheckpoint | null {
    if (steps < 1) return null;
    this.prune(roomCode);

    const stack = this.history.get(roomCode);
    if (!stack || stack.length < steps + 1) return null;

    const target = stack[stack.length - steps - 1]!;
    if (hashRoom(target.room) !== target.stateHash) {
      throw new Error("Checkpoint corrupto: el hash de integridad no coincide.");
    }
    stack.splice(stack.length - steps, steps);
    return target;
  }

  canUndo(roomCode: string, steps = 1): boolean {
    if (steps < 1) return false;
    this.prune(roomCode);
    const stack = this.history.get(roomCode);
    return Boolean(stack && stack.length >= steps + 1);
  }

  prune(roomCode: string): void {
    const stack = this.history.get(roomCode);
    if (!stack) return;
    const cutoff = Date.now() - HISTORY_TTL_MS;
    const filtered = stack.filter((cp) => cp.timestamp >= cutoff);
    if (filtered.length === 0) {
      this.history.delete(roomCode);
      this.turnCounters.delete(roomCode);
    } else if (filtered.length !== stack.length) {
      this.history.set(roomCode, filtered);
    }
  }

  clear(roomCode: string): void {
    this.history.delete(roomCode);
    this.turnCounters.delete(roomCode);
  }

  pruneAll(): void {
    for (const roomCode of this.history.keys()) this.prune(roomCode);
  }

  clearAll(): void {
    this.history.clear();
    this.turnCounters.clear();
  }
}

export const roomHistory = new RoomHistory();
