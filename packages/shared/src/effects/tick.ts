import type { CombatRoom } from "../types.js";
import type { CombatEvent } from "../events/types.js";
import { EffectManager } from "./manager.js";

/**
 * Listener del EventBus para ActiveEffects (TickLayer).
 * Evalúa las instancias activas y remueve en bloque las expiradas.
 */
export function effectsTickListener(room: CombatRoom, event: CombatEvent): CombatRoom {
  const expiredIds: string[] = [];

  for (const instance of room.effectInstances) {
    if (!instance.duration) continue;
    const policy = instance.duration;

    if (event.type !== "TurnStarted" && event.type !== "TurnEnded") {
      continue;
    }

    if (policy.type === "until_turn") {
      if (
        event.sequence > policy.appliedAtSequence &&
        event.combatantId === policy.anchorCombatantId &&
        ((policy.phase === "start" && event.type === "TurnStarted") ||
         (policy.phase === "end" && event.type === "TurnEnded"))
      ) {
        expiredIds.push(instance.instanceId);
      }
    } else if (policy.type === "rounds") {
      if (
        event.sequence > policy.appliedAtSequence &&
        event.combatantId === policy.anchorCombatantId &&
        ((policy.anchorPhase === "start" && event.type === "TurnStarted") ||
         (policy.anchorPhase === "end" && event.type === "TurnEnded"))
      ) {
        if (event.round - policy.appliedRound >= policy.count) {
          expiredIds.push(instance.instanceId);
        }
      }
    }
    // "permanent", "until_rest", "until_dispelled" no expiran automáticamente por el paso de turnos.
  }

  // EffectManager.removeMany es inmutable. Si expiredIds está vacío, devuelve la misma referencia de room.
  return EffectManager.removeMany(room, expiredIds);
}
