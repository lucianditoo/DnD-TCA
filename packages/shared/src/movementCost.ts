import type { MovementContext, Position } from "./types.js";

/** Un Step ya declarado legal, enriquecido solo con el hecho de coste del terreno. */
export interface MovementCostStep {
  readonly origin: Readonly<Position>;
  readonly destination: Readonly<Position>;
  readonly isDifficultTerrain: boolean;
}

/** Secuencia ordenada de Steps consumida por el assessment de coste. */
export interface MovementCostRoute {
  readonly origin: Readonly<Position>;
  readonly steps: ReadonlyArray<MovementCostStep>;
  readonly destination: Readonly<Position>;
}

/** Evidencia inmutable de un Step ya evaluado por `assessMovementCost` (Sprint D-1B-I4). */
export interface MovementCostStepAssessment {
  readonly stepIndex: number;
  readonly stepCostFeet: number;
  readonly cumulativeCostFeet: number;
  readonly resultingContext: Readonly<MovementContext>;
}

/** Proyeccion pura del coste y del contexto diagonal posterior a una Route. */
export interface MovementCostAssessment {
  readonly totalCostFeet: number;
  readonly resultingContext: Readonly<MovementContext>;
  readonly steps: ReadonlyArray<MovementCostStepAssessment>;
}

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
 */
export function assessMovementCost(
  route: MovementCostRoute,
  initialContext: Readonly<MovementContext>
): MovementCostAssessment {
  let normalDiagonalStepsThisTurn = initialContext.normalDiagonalStepsThisTurn;
  let totalCostFeet = 0;
  const steps: MovementCostStepAssessment[] = [];

  for (let index = 0; index < route.steps.length; index++) {
    const step = route.steps[index];
    const diagonal = isDiagonalStep(step);
    let stepCostFeet: number;

    if (step.isDifficultTerrain) {
      stepCostFeet = diagonal ? 15 : 10;
    } else if (!diagonal) {
      stepCostFeet = 5;
    } else {
      normalDiagonalStepsThisTurn += 1;
      stepCostFeet = normalDiagonalStepsThisTurn % 2 === 1 ? 5 : 10;
    }

    totalCostFeet += stepCostFeet;
    steps.push({
      stepIndex: index,
      stepCostFeet,
      cumulativeCostFeet: totalCostFeet,
      resultingContext: { normalDiagonalStepsThisTurn }
    });
  }

  return {
    totalCostFeet,
    resultingContext: { normalDiagonalStepsThisTurn },
    steps
  };
}
