import type {
  CombatRulesSnapshot,
  Combatant,
  Position,
} from "./types.js";
import {
  type SpatialMode,
  type SqueezingAxis,
  projectMovementFootprint,
  createFootprintOccupancyIndex,
  getCombatantsIntersectingCells,
  isCornerAnchorBlockedByTerrain,
  getNaturalCombatantOccupiedCellsAt,
  getCombatantOccupiedCellsAt,
  footprintCellKey,
  isPositionInsideBoard,
} from "./movementGeometry.js";
import { lifeStatus } from "./lifeStatus.js";
import { EffectReducer, effectsCatalog, type EffectDefinition } from "./effects/index.js";

function blocksChargeOccupancy(context: CombatRulesSnapshot, occupant: Combatant, isDestination: boolean): boolean {
  if (isDestination) return true;
  const status = lifeStatus(occupant);
  if (status === "dead") return true;
  if (status === "dying" || status === "stable") return false;
  return !EffectReducer.reduceEffectsForTarget<Record<string, EffectDefinition>>({
    effectInstances: context.effectInstances,
    targetId: occupant.id,
    catalog: effectsCatalog
  }).traits.includes("HELPLESS");
}

export function isChargeStepOccupied(context: CombatRulesSnapshot, actor: Combatant, position: Position, isDestination: boolean): boolean {
  const cells = new Set(getCombatantOccupiedCellsAt(actor, context, position).map(footprintCellKey));
  return context.combatants.some(occupant => occupant.id !== actor.id &&
    getCombatantOccupiedCellsAt(occupant, context, occupant.position).some(cell => cells.has(footprintCellKey(cell))) &&
    blocksChargeOccupancy(context, occupant, isDestination));
}

export interface ValidatedRouteStep {
  readonly stepIndex: number;
  readonly position: Position;
  readonly occupiedCells: readonly Position[];
  readonly spatialMode: SpatialMode;
  readonly squeezingAxis?: SqueezingAxis;
}

export type RouteLegalityResult =
  | {
      isLegal: true;
      steps: readonly ValidatedRouteStep[];
    }
  | {
      isLegal: false;
      error: string;
      failedStepIndex: number;
    };

/**
 * Validates a route incrementally step by step, following the normative rules (NDD Chapter 2).
 * It evaluates adjacency, continuity, obstacles, footprint, and occupancy.
 * It DOES NOT calculate movement costs, consume budgets, or apply action-specific rules.
 *
 * `isAcrobatic` represents a transit capability of the acting combatant (can it legally pass
 * through an occupied enemy square this route?) that Route Validation consumes as an opaque
 * boolean input — it is not itself the logic of any specific action (e.g. Tumble). The caller
 * (today, `validateMovePath`) is responsible for deciding whether that capability applies to
 * the current attempt; this module never branches on *why* the capability is true.
 */
export function validateRouteLegality(
  context: CombatRulesSnapshot<any>,
  combatant: Combatant,
  path: Position[],
  isAcrobatic: boolean = false,
  isCharge = false
): RouteLegalityResult {
  if (path.length === 0) {
    return { isLegal: false, error: "La ruta debe contener al menos un destino.", failedStepIndex: 0 };
  }

  let current = combatant.position;
  const visited = new Set<string>();
  const occupancyIndex = createFootprintOccupancyIndex(context);
  const steps: ValidatedRouteStep[] = [];

  for (let index = 0; index < path.length; index++) {
    const step = path[index];
    const dx = Math.abs(current.x - step.x);
    const dy = Math.abs(current.y - step.y);

    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
      return { isLegal: false, error: "La ruta debe avanzar de a una casilla adyacente.", failedStepIndex: index };
    }

    const projection = projectMovementFootprint(context, combatant, step, {
      dx: Math.sign(step.x - current.x),
      dy: Math.sign(step.y - current.y)
    });

    if (!projection) {
      const naturalCells = getNaturalCombatantOccupiedCellsAt(combatant, context, step);
      if (naturalCells.some((cell) => !isPositionInsideBoard(context, cell))) {
        return { isLegal: false, error: "La ruta sale del tablero.", failedStepIndex: index };
      }
      return { isLegal: false, error: "La huella del combatiente colisiona con un muro u obstaculo intransitable.", failedStepIndex: index };
    }

    const stepCells = projection.occupiedCells;

    const isLast = index === path.length - 1;
    const occupiedCombatants = getCombatantsIntersectingCells(occupancyIndex, stepCells, combatant.id)
      .filter(other => isCharge ? blocksChargeOccupancy(context, other, isLast) : lifeStatus(other) !== "dead");
    for (const occupied of occupiedCombatants) {
      const isAlly = occupied.type === combatant.type;
      const occupiedStatus = lifeStatus(occupied);
      const isHelpless = occupiedStatus === "dying" || occupiedStatus === "stable" || occupiedStatus === "dead";
      
      if (isLast && (isCharge || !isHelpless)) {
        return { isLegal: false, error: "La ruta no puede terminar en la casilla ocupada por " + occupied.name + ".", failedStepIndex: index };
      }
      if (!isLast && (isCharge || (!isAlly && !isHelpless && !isAcrobatic))) {
        return { isLegal: false, error: "La ruta no puede atravesar la casilla ocupada por " + (isCharge ? "" : "el enemigo ") + occupied.name + ".", failedStepIndex: index };
      }
    }

    if (dx === 1 && dy === 1) {
      const horizontalAnchor = { x: step.x, y: current.y, zFeet: step.zFeet ?? current.zFeet ?? 0 };
      const verticalAnchor = { x: current.x, y: step.y, zFeet: step.zFeet ?? current.zFeet ?? 0 };
      if (
        isCornerAnchorBlockedByTerrain(context, combatant, horizontalAnchor) ||
        isCornerAnchorBlockedByTerrain(context, combatant, verticalAnchor)
      ) {
        return { isLegal: false, error: "No puedes moverte en diagonal a traves de una esquina bloqueada por un obstaculo solido.", failedStepIndex: index };
      }
    }

    const key = step.x + "," + step.y;
    if (visited.has(key)) {
      return { isLegal: false, error: "La ruta no puede pasar dos veces por la misma casilla.", failedStepIndex: index };
    }
    visited.add(key);

    steps.push({
      stepIndex: index,
      position: { ...step },
      occupiedCells: stepCells.map((cell) => ({ ...cell })),
      spatialMode: projection.spatialMode,
      ...(projection.squeezingAxis ? { squeezingAxis: projection.squeezingAxis } : {})
    });
    
    current = step;
  }

  return { isLegal: true, steps };
}
