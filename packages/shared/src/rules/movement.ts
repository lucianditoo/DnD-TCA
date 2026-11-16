import { effectsCatalog, type ProductionEffectId } from "../effects/catalog.js";
import { type EffectDefinition } from "../effects/contracts.js";
import { EffectReducer } from "../effects/reducer.js";
import { type CatalogEffectId } from "../effects/types.js";
import { getEquippedArmorEntry } from "../equipmentStats.js";
import { lifeStatus } from "../lifeStatus.js";
import { createFootprintOccupancyIndex, getCombatantOccupiedCellsAt, getCombatantsIntersectingCells, isImpassable, isPositionInsideBoard, projectMovementFootprint, type SpatialMode, type SqueezingAxis } from "../movementGeometry.js";
import { validateRouteLegality } from "../routeValidation.js";
import { type Combatant, type CombatRulesSnapshot, type Position } from "../types.js";
import { canFullAttack, hasActiveTrait } from "./attack.js";
import { canDisabledCombatantTakeAction, canTakeTurn } from "./life.js";
import { type RuleResult, Rules } from "./utils.js";

export { getCombatantOccupiedCells, footprintCellKey, type SpatialMode, type SqueezingAxis } from "../movementGeometry.js";
export { validateRouteLegality } from "../routeValidation.js";
export { assessMovementCost } from "../movementCost.js";
export { resolveMovementPipeline } from "../movementResolution.js";
export { commitMovementResolution } from "../movementCommit.js";

export function distanceFeet(from: Position, to: Position, cellSizeFeet: number): number {
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  const diagonals = Math.min(dx, dy);
  const straight = Math.max(dx, dy) - diagonals;
  return Math.floor(diagonals / 2) * cellSizeFeet * 3 + (diagonals % 2) * cellSizeFeet + straight * cellSizeFeet;
}

export function isAdjacent(a: Position, b: Position): boolean { const dx = Math.abs(a.x - b.x); const dy = Math.abs(a.y - b.y); return dx <= 1 && dy <= 1 && dx + dy > 0; }

export function validateMove<TCatalog extends Record<string, EffectDefinition>>(room: CombatRulesSnapshot<CatalogEffectId<TCatalog>>, combatant: Combatant, to: Position, totalSpeedFeet: number): RuleResult<number> {
  const result = validateMovePath(room, combatant, [to], totalSpeedFeet);
  if (!result.ok || result.value === undefined) return { ok: false, error: result.error };
  return { ok: true, value: result.value.distanceFeet };
}

export function validateMovePath<TCatalog extends Record<string, EffectDefinition>>(
  context: CombatRulesSnapshot<CatalogEffectId<TCatalog>>,
  combatant: Combatant,
  path: Position[],
  totalSpeedFeet: number,
  isFiveFootStep: boolean = false,
  isAcrobatic: boolean = false
): RuleResult<{
  distanceFeet: number;
  path: Position[];
  steps: MovementStepProjection[];
  finalSpatialMode: SpatialMode;
}> {
  if (context.activeAttackThreat) return { ok: false, error: "Hay una amenaza de critico pendiente. Resolvela antes de continuar." };
  const turnCheck = canTakeTurn(combatant);
  if (!turnCheck.ok) return { ok: false, error: turnCheck.error };

  // Reglas específicas de la acción (5-foot step) previas al movimiento
  if (isFiveFootStep && getCombatantOccupiedCellsAt(combatant, context, combatant.position).some((cell) => isDifficultTerrain(context, cell.x, cell.y))) {
    return { ok: false, error: "No puedes dar un paso de 5 pies desde terreno dificil." };
  }

  // Delegación a la autoridad normativa
  const legality = validateRouteLegality(context, combatant, path, isAcrobatic);
  if (!legality.isLegal) {
    return { ok: false, error: legality.error };
  }

  // Reglas específicas de la acción (5-foot step) durante el movimiento
  if (isFiveFootStep) {
    for (const step of legality.steps) {
      if (step.occupiedCells.some((cell) => isDifficultTerrain(context, cell.x, cell.y))) {
        return { ok: false, error: "No puedes dar un paso de 5 pies hacia terreno dificil." };
      }
    }
  }

  // Coste y Presupuesto
  const cumulativeCosts = calculatePathStepCostsFeet(combatant.position, path, context, isAcrobatic);
  const steps: MovementStepProjection[] = legality.steps.map((s, index) => ({
    position: s.position,
    occupiedCells: [...s.occupiedCells],
    spatialMode: s.spatialMode,
    ...(s.squeezingAxis ? { squeezingAxis: s.squeezingAxis } : {}),
    cumulativeCostFeet: cumulativeCosts[index] ?? 0
  }));

  const distance = cumulativeCosts[cumulativeCosts.length - 1] ?? 0;
  const available = totalSpeedFeet - context.currentTurn.movementUsedFeet;
  if (distance > available) return { ok: false, error: combatant.name + " intenta mover " + distance + " pies, pero solo tiene " + available + " pies disponibles." };
  if (!isFiveFootStep && context.currentTurn.usedFiveFootStep && distance > 0) return { ok: false, error: "Ya uso paso de 5 pies este turno." };

  return {
    ok: true,
    value: {
      distanceFeet: distance,
      path,
      steps,
      finalSpatialMode: steps[steps.length - 1]?.spatialMode ?? "natural"
    }
  };
}

export function canUseMoveAction(room: CombatRulesSnapshot<ProductionEffectId>, actor: Combatant): RuleResult<true> {
  if (room.activeAttackThreat) return { ok: false, error: "Hay una amenaza de critico pendiente. Resolvela antes de continuar." };
  const turnCheck = canTakeTurn(actor);
  if (!turnCheck.ok) return turnCheck;
  if (hasActiveTrait(room, actor, "CANNOT_MOVE")) return { ok: false, error: actor.name + " no puede moverse voluntariamente mientras esté paralizado o en presa." };
  if (room.currentTurn.usedTotalDefense) return { ok: false, error: actor.name + " ya uso Defensa total y renuncio al resto de acciones del turno." };

  const disabledCheck = canDisabledCombatantTakeAction(room, actor, "move");
  if (!disabledCheck.ok) return disabledCheck;

  if (room.currentTurn.usedFullAttack || room.currentTurn.attacksMade > 1) return { ok: false, error: "Ya uso una accion de asalto completo." };
  if (room.currentTurn.usedMoveAction) return { ok: false, error: "Ya uso su accion de movimiento." };
  return { ok: true, value: true };
}

/**
 * Sprint 041 (MOVE-RUN): gate puro de la accion de asalto completo "Correr", analogo a
 * `canCharge` (chargeResolver.ts). Vive en el Rule Engine (no en el servidor) por el
 * principio de arquitectura del proyecto: toda la logica de reglas permanece en funciones
 * puras aqui, el servidor solo orquesta. Reutiliza `canFullAttack` (economia de turno +
 * gate de Disabled para acciones de asalto completo) y consume el override declarativo
 * `FORBID_RUN` (ya declarado en `srd_fatigued` desde antes de este sprint, sin consumidor
 * hasta ahora), exactamente como `FORBID_CHARGE` ya es consumido por Carga.
 */
export function canRun(room: CombatRulesSnapshot<ProductionEffectId>, combatant: Combatant): RuleResult<true> {
  const turnCheck = canFullAttack(room, combatant);
  if (!turnCheck.ok) return turnCheck;
  if (room.currentTurn.movementUsedFeet > 0 || room.currentTurn.usedMoveAction || room.currentTurn.usedFiveFootStep) {
    return { ok: false, error: combatant.name + " ya se movio este turno; Correr exige el turno completo sin movimiento previo." };
  }
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: combatant.id,
    catalog: effectsCatalog
  });
  if (reduced.ruleOverrides.includes("FORBID_RUN")) {
    return { ok: false, error: combatant.name + " no puede correr en su estado actual." };
  }
  return { ok: true, value: true };
}

/**
 * Sprint 041 (MOVE-RUN): multiplicador RAW de Correr segun categoria de armadura equipada
 * (pag. 148 del corpus): x4 sin armadura o con armadura ligera/media, x3 con armadura pesada.
 * Reutiliza la categoria ya expuesta por `getEquippedArmorEntry` (EquipmentCatalog) — sin
 * nueva data.
 */
export function runSpeedMultiplier(combatant: Combatant): 3 | 4 {
  return getEquippedArmorEntry(combatant)?.category === "heavy" ? 3 : 4;
}

/**
 * Sprint 041 (MOVE-RUN): presupuesto de movimiento de Correr, calculado SIEMPRE sobre la
 * velocidad efectiva ya resuelta (`Rules.totalSpeedFeet`, que ya incorpora Prisa/Haste,
 * penalizador de velocidad por armadura, etc.) y nunca sobre la velocidad base cruda —
 * riesgo explicito registrado en el NDD (docs/designs/run-design.md §4).
 */
export function runSpeedBudgetFeet(room: CombatRulesSnapshot<ProductionEffectId>, combatant: Combatant): number {
  return Rules.totalSpeedFeet(room, combatant) * runSpeedMultiplier(combatant);
}

/**
 * Sprint 041 (MOVE-RUN): geometria de linea recta, consolidada aqui como unica fuente de
 * verdad (antes vivia privada y duplicada en `chargeResolver.ts`). Carga la reutiliza sin
 * cambio de comportamiento; Correr la usa para derivar el camino canonico desde la posicion
 * actual del combatiente hasta el destino solicitado por el cliente, sin confiar en ningun
 * camino intermedio enviado por el cliente (evita una segunda implementacion de geometria).
 * Devuelve null si el destino no es alcanzable en linea recta (ni ortogonal ni diagonal de 45°).
 */
export function buildStraightPath(origin: Position, destination: Position): Position[] | null {
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return null;
  const path: Position[] = [];
  for (let index = 1; index <= steps; index += 1) path.push({ x: origin.x + stepX * index, y: origin.y + stepY * index, zFeet: origin.zFeet });
  return path;
}

export function isDifficultTerrain(context: CombatRulesSnapshot<any>, x: number, y: number): boolean {
  if (!context.board.difficultTerrainCells) return false;
  return context.board.difficultTerrainCells.includes(`${x},${y}`);
}

export function calculatePathStepCostsFeet(origin: Position, path: Position[], context: CombatRulesSnapshot<any>, isAcrobatic: boolean = false): number[] {
  let current = origin;
  let distance = 0;
  let diagonals = 0;
  const costs: number[] = [];
  const cellSizeFeet = context.board.cellSizeFeet;

  for (const step of path) {
    const dx = Math.abs(current.x - step.x);
    const dy = Math.abs(current.y - step.y);
    const isDT = isDifficultTerrain(context, step.x, step.y);
    const isNarrow = context.board.narrowCells?.includes(`${step.x},${step.y}`);

    let stepCost = 0;
    if (dx === 1 && dy === 1) {
      diagonals += 1;
      const isFirstOfPair = (diagonals % 2 === 1);
      if (isDT) {
        stepCost = isFirstOfPair ? 15 : 20;
      } else {
        stepCost = isFirstOfPair ? cellSizeFeet : cellSizeFeet * 2;
      }
    } else if (dx + dy > 0) {
      stepCost = isDT ? cellSizeFeet * 2 : cellSizeFeet;
    }

    if (isAcrobatic) stepCost *= 2;
    if (isNarrow) stepCost *= 2;

    distance += stepCost;
    costs.push(distance);
    current = step;
  }
  return costs;
}

export function calculatePathCostFeet(origin: Position, path: Position[], context: CombatRulesSnapshot<any>, isAcrobatic: boolean = false): number {
  if (path.length === 0) return 0;
  const costs = calculatePathStepCostsFeet(origin, path, context, isAcrobatic);
  return costs[costs.length - 1] ?? 0;
}

export interface MovementStepProjection {
  readonly position: Position;
  readonly occupiedCells: readonly Position[];
  readonly spatialMode: SpatialMode;
  readonly squeezingAxis?: SqueezingAxis;
  readonly cumulativeCostFeet: number;
}

export interface ForcedMovementDirection {
  readonly dx: -1 | 0 | 1;
  readonly dy: -1 | 0 | 1;
}

export interface ForcedMovementProjection {
  readonly path: readonly Position[];
  readonly finalPosition: Position;
  readonly distanceFeet: number;
  readonly blocked: boolean;
  readonly blockedAt: Position | null;
  readonly blockedReason: "impassable_cell" | "occupied_by_combatant" | null;
}

/**
 * Proyecta desplazamiento forzado sin mutar la sala. No dispara AdO ni consume
 * movimiento voluntario; devuelve siempre la ultima ancla completamente legal.
 */
export function projectForcedMovement(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  target: Combatant,
  direction: ForcedMovementDirection,
  maxDistanceFeet: number
): ForcedMovementProjection {
  if ((direction.dx === 0 && direction.dy === 0) || Math.abs(direction.dx) > 1 || Math.abs(direction.dy) > 1) {
    throw new Error("La direccion de desplazamiento forzado debe ser un vector unitario no nulo.");
  }
  if (!Number.isFinite(maxDistanceFeet) || maxDistanceFeet < 0) {
    throw new Error("La distancia maxima de desplazamiento forzado debe ser finita y no negativa.");
  }

  const maximumSteps = Math.floor(maxDistanceFeet / snapshot.board.cellSizeFeet);
  const occupancyIndex = createFootprintOccupancyIndex(snapshot);
  const path: Position[] = [];
  let finalPosition = { ...target.position };
  let blockedAt: Position | null = null;
  let blockedReason: ForcedMovementProjection["blockedReason"] = null;

  for (let step = 1; step <= maximumSteps; step++) {
    const candidate: Position = {
      x: target.position.x + direction.dx * step,
      y: target.position.y + direction.dy * step,
      zFeet: target.position.zFeet ?? 0
    };

    const proj = projectMovementFootprint(snapshot, target, candidate, direction);
    if (!proj) {
       blockedAt = candidate;
       blockedReason = "impassable_cell";
       break;
    }
    const cells = proj.occupiedCells;

    if (cells.some((cell) => !isPositionInsideBoard(snapshot, cell))) {
      blockedAt = candidate;
      blockedReason = "impassable_cell";
      break;
    }
    if (cells.some((cell) => isImpassable(snapshot, cell.x, cell.y))) {
      blockedAt = candidate;
      blockedReason = "impassable_cell";
      break;
    }
    const blockingCombatant = getCombatantsIntersectingCells(occupancyIndex, cells, target.id).some((other) => {
      const status = lifeStatus(other);
      return status === "active" || status === "disabled";
    });
    if (blockingCombatant) {
      blockedAt = candidate;
      blockedReason = "occupied_by_combatant";
      break;
    }
    path.push(candidate);
    finalPosition = candidate;
  }

  return {
    path,
    finalPosition,
    distanceFeet: path.length * snapshot.board.cellSizeFeet,
    blocked: blockedAt !== null,
    blockedAt,
    blockedReason
  };
}

export function canUseFiveFootStep(
  room: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant
): RuleResult<true> {
  if (room.activeAttackThreat) return { ok: false, error: "Hay una amenaza de critico pendiente. Resolvela antes de continuar." };
  if (room.pendingOpportunityAttacks && room.pendingOpportunityAttacks.length > 0) {
    return { ok: false, error: "Hay ataques de oportunidad pendientes. Resuelvelos antes de continuar." };
  }
  const turnCheck = canTakeTurn(combatant);
  if (!turnCheck.ok) return turnCheck;
  if (hasActiveTrait(room, combatant, "CANNOT_MOVE")) {
    return { ok: false, error: combatant.name + " no puede dar un paso de 5 pies mientras esté paralizado o en presa." };
  }
  if (Rules.totalSpeedFeet(room, combatant) <= room.board.cellSizeFeet) {
    return { ok: false, error: combatant.name + " no puede dar un paso de 5 pies porque su velocidad efectiva no supera una casilla." };
  }
  if (room.currentTurn.usedTotalDefense) {
    return { ok: false, error: combatant.name + " ya uso Defensa total y renuncio al resto de acciones del turno." };
  }
  const disabledCheck = canDisabledCombatantTakeAction(room, combatant, "non-action");
  if (!disabledCheck.ok) return disabledCheck;
  if (room.currentTurn.usedFiveFootStep) return { ok: false, error: "Ya uso paso de 5 pies este turno." };
  if (room.currentTurn.movementUsedFeet > 0) return { ok: false, error: "Ya uso movimiento este turno; no puede dar un paso de 5 pies." };
  if (room.currentTurn.usedMoveAction) return { ok: false, error: "Ya uso la accion de movimiento este turno." };
  return { ok: true, value: true };
}
