import type { CombatRoom } from "../types.js";
import type { EffectInstance } from "./types.js";
import { effectsCatalog, type ProductionEffectId } from "./catalog.js";

/**
 * Effect Manager (Mutation Layer)
 * Única entidad autorizada para modificar la colección global de efectos.
 * Sus funciones son estrictamente puras (no modifican la instancia pasada).
 * No contiene lógica de juego ni evaluación de reglas.
 */
export const EffectManager = {
  /**
   * Añade una instancia de efecto al estado global.
   * La generación del instanceId debe proveerse desde fuera (para determinismo y tests).
   * Comportamiento ante Unknown Effect: Lanza excepción para proteger la inmutabilidad
   * y evitar estados corruptos por referencias inválidas.
   */
  add(room: CombatRoom, instance: EffectInstance<ProductionEffectId>): CombatRoom {
    if (!(instance.effectId in effectsCatalog)) {
      throw new Error(`[EffectManager] Unknown Effect: ${String(instance.effectId)} no existe en el catálogo.`);
    }

    // Copia defensiva profunda para garantizar que referencias externas no puedan mutar el estado almacenado
    const safeInstance: EffectInstance<ProductionEffectId> = {
      instanceId: instance.instanceId,
      effectId: instance.effectId,
      source: { ...instance.source },
      appliedAtEvent: { ...instance.appliedAtEvent },
      ...(instance.targets ? { targets: [...instance.targets] } : {}),
      ...(instance.targetCells ? { targetCells: [...instance.targetCells] } : {}),
      ...(instance.duration ? { duration: { ...instance.duration } } : {}),
      ...(instance.stacks !== undefined ? { stacks: instance.stacks } : {})
    };

    return {
      ...room,
      effectInstances: [...room.effectInstances, safeInstance]
    };
  },

  /**
   * Remueve una instancia de efecto basándose en su ID único.
   * Si el efecto no existe, devuelve el estado sin modificar.
   */
  remove(room: CombatRoom, instanceId: string): CombatRoom {
    return EffectManager.removeMany(room, [instanceId]);
  },

  /**
   * Remueve múltiples instancias de efecto a la vez, garantizando una única
   * copia del CombatRoom (inmutabilidad de alto nivel sin copias redundantes).
   */
  removeMany(room: CombatRoom, instanceIds: string[]): CombatRoom {
    if (!instanceIds || instanceIds.length === 0) {
      return room; // Ninguna mutación
    }

    const setToRemove = new Set(instanceIds);
    const originalLength = room.effectInstances.length;
    
    const nextInstances = room.effectInstances.filter(
      (inst) => !setToRemove.has(inst.instanceId)
    );

    if (nextInstances.length === originalLength) {
      return room; // Nada cambió estructuralmente
    }

    return {
      ...room,
      effectInstances: nextInstances
    };
  }
};
