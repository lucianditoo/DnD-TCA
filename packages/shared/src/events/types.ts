import type { CombatRoom } from "../types.js";

/**
 * Eventos puros de combate (Event Bus).
 * Solo se despachan transiciones operativas explícitas.
 */
export type CombatEvent =
  | { type: "TurnStarted"; combatantId: string; round: number; sequence: number }
  | { type: "TurnEnded"; combatantId: string; round: number; sequence: number }
  | { type: "RoundEnded"; round: number; sequence: number }
  | { type: "RoundStarted"; round: number; sequence: number };

/**
 * Listener sincrónico y puro de dominio.
 * Recibe el estado actual y el evento, y devuelve un nuevo estado (o la misma referencia si no hay mutación).
 */
export type CombatEventListener = (room: CombatRoom, event: CombatEvent) => CombatRoom;

export type EventData<T> = T extends any ? Omit<T, "sequence"> : never;
export type CombatEventData = EventData<CombatEvent>;
