import test from "node:test";
import assert from "node:assert/strict";
import { assessMovementCost } from "../packages/shared/dist/index.js";

const position = (x, y, zFeet = 0) => ({ x, y, zFeet });

const step = (origin, destination, isDifficultTerrain = false) => ({
  origin,
  destination,
  isDifficultTerrain
});

const route = (...steps) => ({
  origin: steps[0].origin,
  steps,
  destination: steps.at(-1).destination
});

test("Movement Cost calcula uno y varios Steps ortogonales a 5 ft", () => {
  const single = assessMovementCost(
    route(step(position(0, 0), position(1, 0))),
    { normalDiagonalStepsThisTurn: 0 }
  );
  const multiple = assessMovementCost(
    route(
      step(position(0, 0), position(1, 0)),
      step(position(1, 0), position(2, 0)),
      step(position(2, 0), position(2, 0, 5))
    ),
    { normalDiagonalStepsThisTurn: 0 }
  );

  assert.equal(single.totalCostFeet, 5);
  assert.equal(multiple.totalCostFeet, 15);
  assert.equal(multiple.resultingContext.normalDiagonalStepsThisTurn, 0);
});

test("Movement Cost aplica 5/10/5/10 a diagonales normales", () => {
  const assessment = assessMovementCost(
    route(
      step(position(0, 0), position(1, 1)),
      step(position(1, 1), position(2, 2)),
      step(position(2, 2), position(3, 3)),
      step(position(3, 3), position(4, 4))
    ),
    { normalDiagonalStepsThisTurn: 0 }
  );

  assert.equal(assessment.totalCostFeet, 30);
  assert.equal(assessment.resultingContext.normalDiagonalStepsThisTurn, 4);
});

test("Movement Cost continua la paridad desde distintos contextos iniciales", () => {
  const diagonal = route(step(position(0, 0), position(1, 1)));
  const expected = [
    { initial: 0, cost: 5, resulting: 1 },
    { initial: 1, cost: 10, resulting: 2 },
    { initial: 2, cost: 5, resulting: 3 },
    { initial: 3, cost: 10, resulting: 4 }
  ];

  for (const example of expected) {
    const assessment = assessMovementCost(diagonal, {
      normalDiagonalStepsThisTurn: example.initial
    });
    assert.equal(assessment.totalCostFeet, example.cost);
    assert.equal(
      assessment.resultingContext.normalDiagonalStepsThisTurn,
      example.resulting
    );
  }
});

test("Movement Cost clasifica una diagonal XYZ como un unico Step diagonal", () => {
  const assessment = assessMovementCost(
    route(step(position(0, 0, 0), position(1, 1, 5))),
    { normalDiagonalStepsThisTurn: 0 }
  );

  assert.equal(assessment.totalCostFeet, 5);
  assert.equal(assessment.resultingContext.normalDiagonalStepsThisTurn, 1);
});

test("Movement Cost aplica 10 ft ortogonal y 15 ft diagonal en terreno dificil", () => {
  const assessment = assessMovementCost(
    route(
      step(position(0, 0), position(1, 0), true),
      step(position(1, 0), position(2, 1), true),
      step(position(2, 1), position(3, 2), true)
    ),
    { normalDiagonalStepsThisTurn: 2 }
  );

  assert.equal(assessment.totalCostFeet, 40);
  assert.equal(assessment.resultingContext.normalDiagonalStepsThisTurn, 2);
});

test("solo las diagonales normales alteran la paridad en una Route mixta", () => {
  const assessment = assessMovementCost(
    route(
      step(position(0, 0), position(1, 1)),
      step(position(1, 1), position(2, 2)),
      step(position(2, 2), position(3, 3), true),
      step(position(3, 3), position(4, 4)),
      step(position(4, 4), position(5, 5), true)
    ),
    { normalDiagonalStepsThisTurn: 0 }
  );

  assert.equal(assessment.totalCostFeet, 50);
  assert.equal(assessment.resultingContext.normalDiagonalStepsThisTurn, 3);
});

test("Movement Cost no muta la Route ni el contexto recibidos", () => {
  const initialContext = Object.freeze({ normalDiagonalStepsThisTurn: 1 });
  const inputRoute = Object.freeze({
    origin: Object.freeze(position(0, 0)),
    steps: Object.freeze([
      Object.freeze({
        origin: Object.freeze(position(0, 0)),
        destination: Object.freeze(position(1, 1)),
        isDifficultTerrain: false
      })
    ]),
    destination: Object.freeze(position(1, 1))
  });

  const assessment = assessMovementCost(inputRoute, initialContext);

  assert.deepEqual(initialContext, { normalDiagonalStepsThisTurn: 1 });
  assert.deepEqual(inputRoute, {
    origin: position(0, 0),
    steps: [
      {
        origin: position(0, 0),
        destination: position(1, 1),
        isDifficultTerrain: false
      }
    ],
    destination: position(1, 1)
  });
  assert.deepEqual(assessment, {
    totalCostFeet: 10,
    resultingContext: { normalDiagonalStepsThisTurn: 2 },
    steps: [
      { stepIndex: 0, stepCostFeet: 10, cumulativeCostFeet: 10, resultingContext: { normalDiagonalStepsThisTurn: 2 } }
    ]
  });
  assert.notEqual(assessment.resultingContext, initialContext);
});

// --- Sprint D-1B-I4: evidencia por Step (MovementCostStepAssessment) ---

test("Movement Cost conserva evidencia ordenada por Step: coste individual, acumulado y contexto resultante", () => {
  const assessment = assessMovementCost(
    route(
      step(position(0, 0), position(1, 1)),
      step(position(1, 1), position(2, 2)),
      step(position(2, 2), position(3, 2), true)
    ),
    { normalDiagonalStepsThisTurn: 0 }
  );

  assert.equal(assessment.steps.length, 3);
  assert.deepEqual(assessment.steps[0], { stepIndex: 0, stepCostFeet: 5, cumulativeCostFeet: 5, resultingContext: { normalDiagonalStepsThisTurn: 1 } });
  assert.deepEqual(assessment.steps[1], { stepIndex: 1, stepCostFeet: 10, cumulativeCostFeet: 15, resultingContext: { normalDiagonalStepsThisTurn: 2 } });
  assert.deepEqual(assessment.steps[2], { stepIndex: 2, stepCostFeet: 10, cumulativeCostFeet: 25, resultingContext: { normalDiagonalStepsThisTurn: 2 } });

  const sumOfStepCosts = assessment.steps.reduce((sum, s) => sum + s.stepCostFeet, 0);
  assert.equal(sumOfStepCosts, assessment.totalCostFeet);
  assert.equal(assessment.steps.at(-1).cumulativeCostFeet, assessment.totalCostFeet);
});
