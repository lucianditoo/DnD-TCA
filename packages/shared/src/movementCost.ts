import type { MovementContext, Position } from "./types.js";
import type { SpatialMode } from "./movementGeometry.js";

/** Un Step ya declarado legal, enriquecido solo con el hecho de coste del terreno y modo espacial. */
export interface MovementCostStep {
  readonly origin: Readonly<Position>;
  readonly destination: Readonly<Position>;
  readonly isDifficultTerrain: boolean;
  readonly spatialMode?: SpatialMode;
  readonly isAcrobatic?: boolean;
}

/** Secuencia ordenada de Steps consumida por el assessment de coste. */
export interface MovementCostRoute {
  readonly origin: Readonly<Position>;
  readonly steps: ReadonlyArray<MovementCostStep>;
  readonly destination: Readonly<Position>;
}

/** Evidencia inmutable de un Step ya evaluado por `assessMovementCost` (Sprint D-1B-I4/I5R1). */
export interface MovementCostStepAssessment {
  readonly stepIndex: number;
  readonly stepCostFeet: number;
  readonly stepBaseRouteCostFeet: number;
  readonly cumulativeCostFeet: number;
  readonly cumulativeBaseRouteCostFeet: number;
  readonly resultingContext: Readonly<MovementContext>;
}

/** Proyeccion pura del coste y del contexto diagonal posterior a una Route. */
export interface MovementCostAssessmentSuccess {
  readonly kind?: "success";
  readonly totalCostFeet: number;
  readonly totalBaseRouteCostFeet: number;
  readonly resultingContext: Readonly<MovementContext>;
  readonly steps: ReadonlyArray<MovementCostStepAssessment>;
}

export type MovementCostAssessment = MovementCostAssessmentSuccess;
export type MovementCostAssessmentResult = MovementCostAssessmentSuccess;

function isDiagonalStep(step: MovementCostStep): boolean {
  const changedAxes =
    Number(step.origin.x !== step.destination.x) +
    Number(step.origin.y !== step.destination.y) +
    Number(step.origin.zFeet !== step.destination.zFeet);

  return changedAxes > 1;
}

/** RAW cost stacking: true hampering diagonals are fixed and do not consume normal parity. */
export function assessMovementCost(
  route: MovementCostRoute,
  initialContext: Readonly<MovementContext>
): MovementCostAssessmentResult {
  let normalDiagonalStepsThisTurn = initialContext.normalDiagonalStepsThisTurn;
  let totalCostFeet = 0;
  let totalBaseRouteCostFeet = 0;
  const steps: MovementCostStepAssessment[] = [];

  for (let index = 0; index < route.steps.length; index++) {
    const step = route.steps[index];
    const diagonal = isDiagonalStep(step);
    const isSqueezing = step.spatialMode === "squeezing";
    const isDT = step.isDifficultTerrain;

    const hampered = isSqueezing || isDT;
    const doublings = Number(isSqueezing) + Number(isDT) + Number(!!step.isAcrobatic);
    let stepBaseRouteCostFeet = 5;
    if (diagonal && !hampered) {
      normalDiagonalStepsThisTurn += 1;
      stepBaseRouteCostFeet = normalDiagonalStepsThisTurn % 2 === 1 ? 5 : 10;
    }
    // A hampered diagonal costs 15 ft for its first doubling, then each
    // additional source doubles it again. Base-route accounting stays separate.
    const stepCostFeet = diagonal && hampered
      ? 15 * 2 ** (doublings - 1)
      : stepBaseRouteCostFeet * 2 ** doublings;

    totalCostFeet += stepCostFeet;
    totalBaseRouteCostFeet += stepBaseRouteCostFeet;
    steps.push({
      stepIndex: index,
      stepCostFeet,
      stepBaseRouteCostFeet,
      cumulativeCostFeet: totalCostFeet,
      cumulativeBaseRouteCostFeet: totalBaseRouteCostFeet,
      resultingContext: { normalDiagonalStepsThisTurn }
    });
  }

  return {
    totalCostFeet,
    totalBaseRouteCostFeet,
    resultingContext: { normalDiagonalStepsThisTurn },
    steps
  };
}
