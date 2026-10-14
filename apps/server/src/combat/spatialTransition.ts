import {
  EffectManager,
  cryptoId,
  type CombatRoom,
  type Combatant,
  type EffectInstance,
  type Position,
  type ProductionEffectId,
  type ConfirmedSpatialTransition,
  type SpatialMode
} from "@dnd-tactical/shared";

export interface SpatialTransitionResult {
  readonly previousMode: SpatialMode;
  readonly currentMode: SpatialMode;
}

/** Frontera unica de commit para posicion y estado derivado de compresion. */
export function commitSpatialTransition(
  room: CombatRoom,
  combatant: Combatant,
  position: Position,
  transition: ConfirmedSpatialTransition
): SpatialTransitionResult {
  if (transition.spatialMode !== "natural" && transition.spatialMode !== "squeezing") {
    throw new Error("Modo espacial confirmado invalido.");
  }
  if (transition.spatialMode === "natural" && transition.squeezingAxis !== undefined) {
    throw new Error("La evidencia natural no puede contener squeezingAxis.");
  }
  if (transition.spatialMode === "squeezing" &&
      transition.squeezingAxis !== "horizontal" && transition.squeezingAxis !== "vertical") {
    throw new Error("Falta evidencia confirmada de squeezingAxis.");
  }
  const currentMode = transition.spatialMode;
  const squeezingInstances = room.effectInstances.filter((instance) =>
    instance.effectId === "srd_squeezing" && instance.targets?.includes(combatant.id)
  );
  const previousMode: SpatialMode = squeezingInstances.length > 0 ? "squeezing" : "natural";
  
  if (currentMode === "natural" || squeezingInstances.length !== 1 ||
      squeezingInstances[0].squeezingAxis !== transition.squeezingAxis) {
    let nextRoom = EffectManager.removeMany(room, squeezingInstances.map((instance) => instance.instanceId));

    if (currentMode === "squeezing") {
      const instance: EffectInstance<ProductionEffectId> = {
        instanceId: cryptoId("effect"),
        effectId: "srd_squeezing",
        squeezingAxis: transition.squeezingAxis,
        source: { type: "system" },
        targets: [combatant.id],
        appliedAtEvent: { type: "ActionResolved", combatantId: combatant.id, round: room.round },
        duration: { type: "permanent" }
      };
      nextRoom = EffectManager.add(nextRoom, instance);
    }
    Object.assign(room, nextRoom);
  }

  combatant.position = { ...position };
  return { previousMode, currentMode };
}
