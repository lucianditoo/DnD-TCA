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

/** Proyeccion pura del coste y del contexto diagonal posterior a una Route. */
export interface MovementCostAssessment {
  readonly totalCostFeet: number;
  readonly resultingContext: Readonly<MovementContext>;
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

  for (const step of route.steps) {
    const diagonal = isDiagonalStep(step);

    if (step.isDifficultTerrain) {
      totalCostFeet += diagonal ? 15 : 10;
      continue;
    }

    if (!diagonal) {
      totalCostFeet += 5;
      continue;
    }

    normalDiagonalStepsThisTurn += 1;
    totalCostFeet += normalDiagonalStepsThisTurn % 2 === 1 ? 5 : 10;
  }

  return {
    totalCostFeet,
    resultingContext: { normalDiagonalStepsThisTurn }
  };
}
