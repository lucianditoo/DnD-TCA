import type { MovementContext, Position } from "./types.js";
import type { SpatialMode } from "./movementGeometry.js";

/** Un Step ya declarado legal, enriquecido solo con el hecho de coste del terreno y modo espacial. */
export interface MovementCostStep {
  readonly origin: Readonly<Position>;
  readonly destination: Readonly<Position>;
  readonly isDifficultTerrain: boolean;
  readonly spatialMode?: SpatialMode;
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

/** Resultado tipado para combinaciones normativas cuya composicion permanece abierta en ODR D-1B-C3-01. */
export interface UnsupportedCostCombination {
  readonly kind: "unsupported-cost-combination";
  readonly reason: string;
  readonly failedStepIndex: number;
}

export type MovementCostAssessment = MovementCostAssessmentSuccess;
export type MovementCostAssessmentResult = MovementCostAssessmentSuccess | UnsupportedCostCombination;

function isDiagonalStep(step: MovementCostStep): boolean {
  const changedAxes =
    Number(step.origin.x !== step.destination.x) +
    Number(step.origin.y !== step.destination.y) +
    Number(step.origin.zFeet !== step.destination.zFeet);

  return changedAxes > 1;
}

/**
 * Calcula el coste normativo de una Route sin validar, ejecutar ni mutar estado.
 * La entrada se presupone legal conforme al contrato separado de Route Validation.
 *
 * Reglas de coste aplicadas:
 * - Ortogonal normal: base 5 ft, coste 5 ft, contador diagonal sin cambio.
 * - Diagonal normal: base 5/10 ft (alternado), coste 5/10 ft, incrementa contador en 1.
 * - Squeezing ortogonal (sin DT): base 5 ft, coste 10 ft (duplicado), contador sin cambio.
 * - Squeezing diagonal (sin DT): base 5/10 ft (paridad normal), coste 10/20 ft (duplicado), incrementa contador en 1.
 * - DT ortogonal (sin Squeezing): base 5 ft, coste 10 ft, contador sin cambio.
 * - DT diagonal (sin Squeezing): base 5 ft, coste fijo 15 ft, contador sin cambio ni alteracion de paridad posterior.
 * - Squeezing + DT: retorna UnsupportedCostCombination (ODR D-1B-C3-01 abierta).
 */
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

    if (isSqueezing && isDT) {
      return {
        kind: "unsupported-cost-combination",
        reason: "Squeezing + Difficult Terrain combination is pending normative resolution (ODR-D1B-C3-01).",
        failedStepIndex: index
      };
    }

    let stepCostFeet: number;
    let stepBaseRouteCostFeet: number;

    if (isSqueezing) {
      if (!diagonal) {
        stepBaseRouteCostFeet = 5;
        stepCostFeet = 10;
      } else {
        normalDiagonalStepsThisTurn += 1;
        stepBaseRouteCostFeet = normalDiagonalStepsThisTurn % 2 === 1 ? 5 : 10;
        stepCostFeet = stepBaseRouteCostFeet * 2;
      }
    } else if (isDT) {
      if (!diagonal) {
        stepBaseRouteCostFeet = 5;
        stepCostFeet = 10;
      } else {
        stepBaseRouteCostFeet = 5;
        stepCostFeet = 15;
      }
    } else {
      if (!diagonal) {
        stepBaseRouteCostFeet = 5;
        stepCostFeet = 5;
      } else {
        normalDiagonalStepsThisTurn += 1;
        stepBaseRouteCostFeet = normalDiagonalStepsThisTurn % 2 === 1 ? 5 : 10;
        stepCostFeet = stepBaseRouteCostFeet;
      }
    }

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
