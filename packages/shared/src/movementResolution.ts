import type { CombatRulesSnapshot, Combatant, MovementContext, Position } from "./types.js";
import { EffectReducer, effectsCatalog } from "./effects/index.js";
import { validateRouteLegality } from "./routeValidation.js";
import type { SpatialMode, SqueezingAxis } from "./movementGeometry.js";
import { isDifficultTerrain, Rules } from "./rules.js";
import { getCombatantOccupiedCells } from "./movementGeometry.js";
import { lifeStatus } from "./lifeStatus.js";
import {
  assessMovementCost,
  type MovementCostAssessment,
  type MovementCostRoute,
  type MovementCostStep,
} from "./movementCost.js";

/**
 * Movement Resolution Pipeline (Sprint D-1B-I4/I5R1).
 *
 * Compone, sin recalcular ni duplicar geometría, el ciclo normativo descrito en
 * `docs/designs/normative-movement-design.md` Capítulo 5 hasta Budget Verification:
 *
 *   validateRouteLegality → (input de coste) → assessMovementCost → Budget Verification
 *
 * Aislado deliberadamente del flujo productivo legacy (`validateMovePath`,
 * `calculatePathStepCostsFeet`) y de Commit/Publication — ningún comando ni
 * `commitSpatialTransition` consume este módulo todavía.
 */

/**
 * Genera una representacion canonica y determinista del estado normativo relevante para
 * movimiento dentro de un CombatRulesSnapshot (Sprint D-1B-I5R2).
 *
 * Es 100% portable para `packages/shared` (cero dependencias nativas como node:crypto).
 * Incluye las dependencias de Route Validation, Movement Cost y las fuentes de Budget:
 * - Tablero: width, height, cellSizeFeet, impassableCells, difficultTerrainCells, narrowCells.
 * - Combatientes: id, position (x, y, zFeet), sizeCategory, type, y lifeStatus.
 * - Huellas efectivas derivadas por la autoridad geométrica (incluye Squeezing).
 * - Speed efectiva y sus componentes numéricos, CANNOT_MOVE y presupuesto gastado.
 * No serializa trazas cosméticas ni implementa fórmulas de Speed o de acciones.
 * Ordena canonicamente todos los arrays para garantizar determinismo semantico.
 */
export function createMovementStateFingerprint(
  context: CombatRulesSnapshot<any>,
  actor: Combatant
): string {
  const board = {
    width: context.board.width,
    height: context.board.height,
    cellSizeFeet: context.board.cellSizeFeet,
    impassableCells: [...new Set(context.board.impassableCells ?? [])].sort(),
    difficultTerrainCells: [...new Set(context.board.difficultTerrainCells ?? [])].sort(),
    narrowCells: [...new Set(context.board.narrowCells ?? [])].sort()
  };

  const combatants = (context.combatants ?? [])
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => ({
      id: c.id,
      position: { x: c.position.x, y: c.position.y, zFeet: c.position.zFeet ?? 0 },
      sizeCategory: c.sizeCategory ?? "medium",
      type: c.type,
      lifeStatus: lifeStatus(c as Combatant),
      occupiedCells: getCombatantOccupiedCells(c, context)
        .map(cell => [cell.x, cell.y, cell.zFeet ?? 0])
        .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
    }));

  const speed = Rules.getMovementSpeedProjection(context, actor);
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: context.effectInstances,
    targetId: actor.id,
    catalog: effectsCatalog
  });
  const mobility = {
    combatantId: actor.id,
    total: speed.total,
    beforeRate: speed.beforeRate,
    rateNumerator: speed.rateNumerator,
    rateDenominator: speed.rateDenominator,
    cannotMove: actor.ruleTraits.includes("CANNOT_MOVE") || reduced.traits.includes("CANNOT_MOVE"),
    movementUsedFeet: context.currentTurn?.movementUsedFeet ?? 0
  };

  return JSON.stringify({ board, combatants, mobility });
}

/** Un Step de resolución combina, sin inventar datos, la evidencia de Route Validation y
 * de Movement Cost para el mismo Step. */
export interface MovementResolutionStep {
  readonly stepIndex: number;
  readonly position: Readonly<Position>;
  readonly occupiedCells: ReadonlyArray<Readonly<Position>>;
  readonly spatialMode: SpatialMode;
  readonly squeezingAxis?: SqueezingAxis;
  readonly isDifficultTerrain: boolean;
  readonly stepCostFeet: number;
  readonly stepBaseRouteCostFeet: number;
  readonly cumulativeCostFeet: number;
  readonly cumulativeBaseRouteCostFeet: number;
  readonly resultingContext: Readonly<MovementContext>;
}

export interface MovementResolutionInput {
  readonly context: CombatRulesSnapshot<any>;
  readonly combatant: Combatant;
  /** Destinos ordenados de la Route candidata, igual que `validateRouteLegality`. */
  readonly path: Position[];
  /** Movement Budget disponible para este intento, en pies. No se deriva aquí. */
  readonly availableBudgetFeet: number;
  /** Contexto diagonal inicial del turno (`normalDiagonalStepsThisTurn`), sin mutar. */
  readonly initialContext: Readonly<MovementContext>;
  /** Capacidad de tránsito estrictamente necesaria por Route Validation (ver
   * `routeValidation.ts`: no es la lógica de ninguna acción concreta). */
  readonly isAcrobatic?: boolean;
}

export type MovementResolutionResult =
  | {
      readonly kind: "illegal-route";
      readonly reason: string;
      readonly failedStepIndex: number;
    }
  | {
      readonly kind: "unsupported-cost-combination";
      readonly reason: string;
      readonly failedStepIndex: number;
    }
  | {
      readonly kind: "insufficient-budget";
      readonly combatantId: string;
      readonly steps: ReadonlyArray<MovementResolutionStep>;
      readonly costAssessment: MovementCostAssessment;
      readonly requiredCostFeet: number;
      readonly totalBaseRouteCostFeet: number;
      readonly availableBudgetFeet: number;
      readonly initialContext: Readonly<MovementContext>;
      readonly projectedContext: Readonly<MovementContext>;
      readonly finalPosition: Readonly<Position>;
      readonly rulesStateFingerprint: string;
    }
  | {
      readonly kind: "ready";
      readonly combatantId: string;
      readonly steps: ReadonlyArray<MovementResolutionStep>;
      readonly costAssessment: MovementCostAssessment;
      readonly totalCostFeet: number;
      readonly totalBaseRouteCostFeet: number;
      readonly initialContext: Readonly<MovementContext>;
      readonly projectedContext: Readonly<MovementContext>;
      readonly finalPosition: Readonly<Position>;
      readonly availableBudgetFeet: number;
      readonly remainingBudgetFeet: number;
      readonly rulesStateFingerprint: string;
    };

/**
 * Resolver puro: lee `context`/`combatant`/`path`/`initialContext` y produce objetos nuevos.
 * No muta el snapshot, el combatiente, la Route ni el contexto diagonal recibidos; no mueve
 * tokens, no ejecuta comandos, no publica eventos, no reserva presupuesto. Fuera de alcance
 * de este sprint: Commit, Publication y cualquier mutación autoritativa.
 */
export function resolveMovementPipeline(input: MovementResolutionInput): MovementResolutionResult {
  const { context, combatant, path, availableBudgetFeet, initialContext, isAcrobatic = false } = input;

  const legality = validateRouteLegality(context, combatant, path, isAcrobatic);
  if (!legality.isLegal) {
    return {
      kind: "illegal-route",
      reason: legality.error,
      failedStepIndex: legality.failedStepIndex
    };
  }

  // Construye el input normativo de Movement Cost a partir del footprint efectivo YA
  // producido por Route Validation (occupiedCells y spatialMode) — nunca reproyecta geometría
  // ni vuelve a determinar el modo espacial.
  let origin = combatant.position;
  const costRouteSteps: MovementCostStep[] = legality.steps.map((step) => {
    const stepIsDifficultTerrain = step.occupiedCells.some(
      (cell) => isDifficultTerrain(context, cell.x, cell.y)
    );
    const costStep: MovementCostStep = {
      origin: { ...origin },
      destination: { ...step.position },
      isDifficultTerrain: stepIsDifficultTerrain,
      spatialMode: step.spatialMode
    };
    origin = step.position;
    return costStep;
  });

  const lastStep = legality.steps[legality.steps.length - 1];
  const costRoute: MovementCostRoute = {
    origin: { ...combatant.position },
    steps: costRouteSteps,
    destination: { ...lastStep.position }
  };

  const costAssessment = assessMovementCost(costRoute, initialContext);

  if ("kind" in costAssessment && costAssessment.kind === "unsupported-cost-combination") {
    return {
      kind: "unsupported-cost-combination",
      reason: costAssessment.reason,
      failedStepIndex: costAssessment.failedStepIndex
    };
  }

  const rulesStateFingerprint = createMovementStateFingerprint(context, combatant);

  const resolutionSteps: MovementResolutionStep[] = legality.steps.map((step, index) => {
    const stepCost = costAssessment.steps[index];
    return {
      stepIndex: step.stepIndex,
      position: { ...step.position },
      occupiedCells: step.occupiedCells.map((cell) => ({ ...cell })),
      spatialMode: step.spatialMode,
      ...(step.squeezingAxis ? { squeezingAxis: step.squeezingAxis } : {}),
      isDifficultTerrain: costRouteSteps[index].isDifficultTerrain,
      stepCostFeet: stepCost.stepCostFeet,
      stepBaseRouteCostFeet: stepCost.stepBaseRouteCostFeet,
      cumulativeCostFeet: stepCost.cumulativeCostFeet,
      cumulativeBaseRouteCostFeet: stepCost.cumulativeBaseRouteCostFeet,
      resultingContext: stepCost.resultingContext
    };
  });

  const requiredCostFeet = costAssessment.totalCostFeet;
  const totalBaseRouteCostFeet = costAssessment.totalBaseRouteCostFeet;
  const finalPosition: Position = { ...lastStep.position };

  // Budget Verification: se limita a comparar totalCostFeet <= availableBudgetFeet. No
  // descuenta ni reserva presupuesto; la insuficiencia nunca vuelve ilegal la Route.
  if (requiredCostFeet > availableBudgetFeet) {
    return {
      kind: "insufficient-budget",
      combatantId: combatant.id,
      steps: resolutionSteps,
      costAssessment,
      requiredCostFeet,
      totalBaseRouteCostFeet,
      availableBudgetFeet,
      initialContext: { ...initialContext },
      projectedContext: costAssessment.resultingContext,
      finalPosition,
      rulesStateFingerprint
    };
  }

  return {
    kind: "ready",
    combatantId: combatant.id,
    steps: resolutionSteps,
    costAssessment,
    totalCostFeet: requiredCostFeet,
    totalBaseRouteCostFeet,
    initialContext: { ...initialContext },
    projectedContext: costAssessment.resultingContext,
    finalPosition,
    availableBudgetFeet,
    remainingBudgetFeet: availableBudgetFeet - requiredCostFeet,
    rulesStateFingerprint
  };
}
