import type { CombatRulesSnapshot, Combatant, CombatantSnapshot, MovementContext, Position } from "./types.js";
import type { EffectInstance } from "./effects/index.js";
import { validateRouteLegality } from "./routeValidation.js";
import type { SpatialMode, SqueezingAxis } from "./movementGeometry.js";
import { isDifficultTerrain } from "./rules.js";
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
 * movimiento dentro de un CombatRulesSnapshot (Sprint D-1B-I5R1).
 *
 * Es 100% portable para `packages/shared` (cero dependencias nativas como node:crypto).
 * Incluye estrictamente las dependencias reales consumidas por Route Validation y Movement Cost:
 * - Tablero: width, height, cellSizeFeet, impassableCells, difficultTerrainCells, narrowCells.
 * - Combatientes: id, position (x, y, zFeet), sizeCategory, type, y lifeStatus.
 * - Efectos espaciales relevantes: instancias de `srd_squeezing` y sus targets.
 * Ordena canonicamente todos los arrays para garantizar determinismo semantico.
 */
export function createMovementStateFingerprint(context: {
  readonly board: {
    readonly width: number;
    readonly height: number;
    readonly cellSizeFeet: number;
    readonly impassableCells?: readonly string[];
    readonly difficultTerrainCells?: readonly string[];
    readonly narrowCells?: readonly string[];
  };
  readonly combatants: readonly (Combatant | CombatantSnapshot)[];
  readonly effectInstances?: readonly EffectInstance<any>[];
}): string {
  const board = {
    width: context.board.width,
    height: context.board.height,
    cellSizeFeet: context.board.cellSizeFeet,
    impassableCells: (context.board.impassableCells ?? []).slice().sort(),
    difficultTerrainCells: (context.board.difficultTerrainCells ?? []).slice().sort(),
    narrowCells: (context.board.narrowCells ?? []).slice().sort()
  };

  const combatants = (context.combatants ?? [])
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => ({
      id: c.id,
      position: { x: c.position.x, y: c.position.y, zFeet: c.position.zFeet ?? 0 },
      sizeCategory: c.sizeCategory ?? "medium",
      type: c.type,
      lifeStatus: lifeStatus(c as Combatant)
    }));

  const squeezingEffects = (context.effectInstances ?? [])
    .filter((i) => i.effectId === "srd_squeezing")
    .map((i) => ({
      instanceId: i.instanceId,
      effectId: i.effectId,
      targets: (i.targets ?? []).slice().sort()
    }))
    .sort((a, b) => a.instanceId.localeCompare(b.instanceId));

  return JSON.stringify({ board, combatants, squeezingEffects });
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

  const rulesStateFingerprint = createMovementStateFingerprint(context);

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
      steps: resolutionSteps,
      costAssessment,
      requiredCostFeet,
      totalBaseRouteCostFeet,
      availableBudgetFeet,
      initialContext,
      projectedContext: costAssessment.resultingContext,
      finalPosition,
      rulesStateFingerprint
    };
  }

  return {
    kind: "ready",
    steps: resolutionSteps,
    costAssessment,
    totalCostFeet: requiredCostFeet,
    totalBaseRouteCostFeet,
    initialContext,
    projectedContext: costAssessment.resultingContext,
    finalPosition,
    availableBudgetFeet,
    remainingBudgetFeet: availableBudgetFeet - requiredCostFeet,
    rulesStateFingerprint
  };
}
