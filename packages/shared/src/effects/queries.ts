import type { CombatRoom } from "../types.js";
import type { EffectInstance } from "./types.js";

/**
 * Query Layer
 * Esta capa es la única vía autorizada para extraer efectos del estado global.
 * Aisla la lógica de filtrado para que el Rule Engine y el Snapshot Generator
 * no dependan de la estructura interna del CombatState.
 */
export const EffectQueries = {
  /**
   * Obtiene todos los efectos activos sobre un objetivo biológico.
   */
  getByTarget(room: CombatRoom, targetId: string): EffectInstance[] {
    return room.effectInstances.filter(
      (effect) => effect.targets && effect.targets.includes(targetId)
    );
  }
};
