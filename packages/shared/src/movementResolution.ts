import type { CombatRulesSnapshot, Combatant, MovementContext, Position } from "./types.js";
import { validateRouteLegality } from "./routeValidation.js";
import type { SpatialMode, SqueezingAxis } from "./movementGeometry.js";
import { isDifficultTerrain } from "./rules.js";
import {
  assessMovementCost,
  type MovementCostAssessment,
  type MovementCostRoute,
  type MovementCostStep,
} from "./movementCost.js";

/**
 * Movement Resolution Pipeline (Sprint D-1B-I4).
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
  readonly cumulativeCostFeet: number;
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
      readonly kind: "insufficient-budget";
      readonly steps: ReadonlyArray<MovementResolutionStep>;
      readonly costAssessment: MovementCostAssessment;
      readonly requiredCostFeet: number;
      readonly availableBudgetFeet: number;
      readonly initialContext: Readonly<MovementContext>;
      readonly projectedContext: Readonly<MovementContext>;
      readonly finalPosition: Readonly<Position>;
    }
  | {
      readonly kind: "ready";
      readonly steps: ReadonlyArray<MovementResolutionStep>;
      readonly costAssessment: MovementCostAssessment;
      readonly totalCostFeet: number;
      readonly initialContext: Readonly<MovementContext>;
      readonly projectedContext: Readonly<MovementContext>;
      readonly finalPosition: Readonly<Position>;
      readonly availableBudgetFeet: number;
      readonly remainingBudgetFeet: number;
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
  // producido por Route Validation (occupiedCells) — nunca reproyecta geometría ni vuelve
  // a determinar el modo espacial. Si cualquier celda ocupada por el Step es terreno
  // difícil, el Step completo se trata como afectado (Capítulo 3.9: el Step adopta el
  // coste de terreno más alto entre las celdas de su footprint efectivo).
  let origin = combatant.position;
  const costRouteSteps: MovementCostStep[] = legality.steps.map((step) => {
    const stepIsDifficultTerrain = step.occupiedCells.some(
      (cell) => isDifficultTerrain(context, cell.x, cell.y)
    );
    const costStep: MovementCostStep = {
      origin: { ...origin },
      destination: { ...step.position },
      isDifficultTerrain: stepIsDifficultTerrain
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
      cumulativeCostFeet: stepCost.cumulativeCostFeet,
      resultingContext: stepCost.resultingContext
    };
  });

  const requiredCostFeet = costAssessment.totalCostFeet;
  const finalPosition: Position = { ...lastStep.position };

  // Budget Verification: se limita a comparar totalCostFeet <= availableBudgetFeet. No
  // descuenta ni reserva presupuesto; la insuficiencia nunca vuelve ilegal la Route.
  if (requiredCostFeet > availableBudgetFeet) {
    return {
      kind: "insufficient-budget",
      steps: resolutionSteps,
      costAssessment,
      requiredCostFeet,
      availableBudgetFeet,
      initialContext,
      projectedContext: costAssessment.resultingContext,
      finalPosition
    };
  }

  return {
    kind: "ready",
    steps: resolutionSteps,
    costAssessment,
    totalCostFeet: requiredCostFeet,
    initialContext,
    projectedContext: costAssessment.resultingContext,
    finalPosition,
    availableBudgetFeet,
    remainingBudgetFeet: availableBudgetFeet - requiredCostFeet
  };
}
