import type { CombatRoom } from "../types.js";
import type { CombatEvent, CombatEventListener } from "./types.js";

/**
 * Event Bus sincrónico.
 * Compone un pipeline funcional de reducers puros.
 * Si algún listener arroja una excepción, la propagación es inmediata y
 * se detiene la ejecución del pipeline. No hay recuperación silenciosa.
 * 
 * @param room El estado inmutable actual
 * @param event El evento a despachar
 * @param listeners Lista de listeners a ejecutar en orden
 * @returns El nuevo estado de la sala tras aplicar los listeners
 */
export function dispatchCombatEvent(
  room: CombatRoom,
  event: CombatEvent,
  listeners: readonly CombatEventListener[]
): CombatRoom {
  let currentRoom = room;

  for (const listener of listeners) {
    currentRoom = listener(currentRoom, event);
  }

  return currentRoom;
}
