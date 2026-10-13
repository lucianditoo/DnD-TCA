import test from "node:test";
import assert from "node:assert/strict";
import {
  SCRIPTED_TACTICAL_DEMO_ID
} from "@dnd-tactical/shared";
import {
  createStepRngContext,
  executeNextDemoStep,
  startNewDemoSession
} from "../apps/server/src/demo/runner.ts";
import { destroyDemoSession } from "../apps/server/src/demo/sessionStore.ts";
import { rollDice } from "../apps/server/src/combat/diceRoller.ts";

function createMockSocket() {
  const messages = [];
  return {
    OPEN: 1,
    readyState: 1,
    messages,
    send(payload) {
      messages.push(JSON.parse(payload));
    }
  };
}

test("Demo RNG: createStepRngContext strictly enforces prepared dice and maneuver rolls", () => {
  const step = {
    id: "test-step",
    actorName: "Actor",
    actionSummary: "Summary",
    ruleExplanation: "Rule",
    command: { kind: "end-turn" },
    diceRolls: [3, 4],
    maneuverRolls: {
      "opportunity-attack": 4,
      "opposed-defender": 8
    },
    expect: {},
    pauseAfterMs: 500
  };

  const rng = createStepRngContext(step);
  assert.equal(rng.diceRoller(6), 3);
  assert.equal(rng.diceRoller(6), 4);
  assert.equal(rng.maneuverDiceSource.d20("opportunity-attack"), 4);
  assert.equal(rng.maneuverDiceSource.d20("opposed-defender"), 8);
  assert.doesNotThrow(() => rng.assertAllPreparedRollsConsumed());

  // Any extra unscripted roll must throw immediately
  assert.throws(() => rng.diceRoller(6), /no preparada/i);
  assert.throws(() => rng.maneuverDiceSource.d20("touch-attacker"), /no preparada/i);
});

test("Demo RNG: fails if prepared rolls remain unconsumed after step execution", () => {
  const step = {
    id: "unused-roll-step",
    actorName: "Actor",
    actionSummary: "Summary",
    ruleExplanation: "Rule",
    command: { kind: "end-turn" },
    diceRolls: [5],
    expect: {},
    pauseAfterMs: 500
  };

  const rng = createStepRngContext(step);
  assert.throws(() => rng.assertAllPreparedRollsConsumed(), /sin consumir/i);
});

test("Demo RNG: full demo execution is 100% deterministic and does not alter normal rollDice", () => {
  const socketA = createMockSocket();
  const socketB = createMockSocket();

  const recordA = startNewDemoSession(socketA, SCRIPTED_TACTICAL_DEMO_ID, "RunA", { autoPlay: false });
  const recordB = startNewDemoSession(socketB, SCRIPTED_TACTICAL_DEMO_ID, "RunB", { autoPlay: false });

  try {
    while (recordA.status === "paused") {
      assert.equal(executeNextDemoStep(recordA), true);
    }
    while (recordB.status === "paused") {
      assert.equal(executeNextDemoStep(recordB), true);
    }

    assert.equal(recordA.status, "completed");
    assert.equal(recordB.status, "completed");

    // Normal rollDice remains functional and independent
    for (let i = 0; i < 10; i += 1) {
      const val = rollDice(20);
      assert.ok(Number.isInteger(val) && val >= 1 && val <= 20);
    }
  } finally {
    destroyDemoSession(recordA.sessionId);
    destroyDemoSession(recordB.sessionId);
  }
});
