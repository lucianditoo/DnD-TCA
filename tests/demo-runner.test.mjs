import test from "node:test";
import assert from "node:assert/strict";
import {
  SCRIPTED_TACTICAL_DEMO_ID,
  scriptedTacticalDemoV1
} from "@dnd-tactical/shared";
import {
  executeNextDemoStep,
  startNewDemoSession
} from "../apps/server/src/demo/runner.ts";
import {
  handleDemoCommand
} from "../apps/server/src/demo/demoCommands.ts";
import {
  destroyDemoSession,
  getDemoSessionById
} from "../apps/server/src/demo/sessionStore.ts";
import { rooms } from "../apps/server/src/room/roomStore.ts";

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

test("Demo runner: executes all 3 scenes (A, B, C) of scripted_tactical_demo_v1 from start to completed", () => {
  const socket = createMockSocket();
  const record = startNewDemoSession(socket, SCRIPTED_TACTICAL_DEMO_ID, "Tester", { autoPlay: false });

  try {
    assert.equal(record.status, "paused");
    assert.equal(record.currentSceneIndex, 0);
    assert.equal(record.currentStepIndex, 0);

    let stepCount = 0;
    while (record.status !== "completed" && record.status !== "failed" && stepCount < 200) {
      const ok = executeNextDemoStep(record);
      assert.equal(
        ok,
        true,
        `Step failed at scene=${record.currentSceneIndex} step=${record.currentStepIndex}: ${record.errorMessage}`
      );
      stepCount += 1;
    }

    assert.equal(record.status, "completed", `Expected completed but got ${record.status} (${record.errorMessage})`);
    const totalExpectedSteps = scriptedTacticalDemoV1.scenes.reduce((sum, s) => sum + s.steps.length, 0);
    assert.equal(stepCount, totalExpectedSteps);
  } finally {
    destroyDemoSession(record.sessionId);
  }
});

test("Demo runner: supports pause, resume, step-demo, set-demo-speed, restart-demo, and exit-demo", () => {
  const socket = createMockSocket();
  const record = startNewDemoSession(socket, SCRIPTED_TACTICAL_DEMO_ID, "ControlTester", { autoPlay: true });

  try {
    assert.equal(record.status, "playing");
    assert.equal(record.sequence, 1);
    const initialRoomCode = record.roomCode;

    // Cannot step while playing
    assert.throws(
      () => handleDemoCommand(socket, { type: "step-demo", sessionId: record.sessionId, sequence: record.sequence }),
      /en pausa/i
    );

    // Pause
    handleDemoCommand(socket, { type: "pause-demo", sessionId: record.sessionId, sequence: record.sequence });
    assert.equal(record.status, "paused");
    assert.equal(record.timerHandle, null);
    assert.equal(record.sequence, 2);

    // Step 2 times while paused
    handleDemoCommand(socket, { type: "step-demo", sessionId: record.sessionId, sequence: record.sequence });
    assert.equal(record.currentStepIndex, 1);
    assert.equal(record.sequence, 3);
    handleDemoCommand(socket, { type: "step-demo", sessionId: record.sessionId, sequence: record.sequence });
    assert.equal(record.currentStepIndex, 2);
    assert.equal(record.sequence, 4);

    // Change speed
    handleDemoCommand(socket, {
      type: "set-demo-speed",
      sessionId: record.sessionId,
      sequence: record.sequence,
      speedMultiplier: 2
    });
    assert.equal(record.speedMultiplier, 2);
    assert.equal(record.sequence, 5);

    // Restart current scene -> creates a new ephemeral roomCode and sends hello
    handleDemoCommand(socket, {
      type: "restart-demo",
      sessionId: record.sessionId,
      sequence: record.sequence,
      scope: "scene"
    });
    assert.equal(record.currentSceneIndex, 0);
    assert.equal(record.currentStepIndex, 0);
    assert.equal(record.sequence, 6);
    assert.notEqual(record.roomCode, initialRoomCode);
    assert.equal(rooms.has(initialRoomCode), false);
    assert.equal(rooms.has(record.roomCode), true);

    // Exit demo
    const restartedRoomCode = record.roomCode;
    handleDemoCommand(socket, { type: "exit-demo", sessionId: record.sessionId, sequence: record.sequence });
    assert.equal(getDemoSessionById(record.sessionId), undefined);
    assert.equal(rooms.has(restartedRoomCode), false);
    assert.ok(socket.messages.some((m) => m.type === "demo-exited" && m.sessionId === record.sessionId));
  } finally {
    destroyDemoSession(record.sessionId);
  }
});

test("Demo runner: rejects duplicate control commands and delayed messages from before restart-demo", () => {
  const socket = createMockSocket();
  const record = startNewDemoSession(socket, SCRIPTED_TACTICAL_DEMO_ID, "SequenceTester", { autoPlay: false });

  try {
    assert.equal(record.sequence, 1);

    // First step-demo with sequence=1 succeeds and increments sequence to 2
    const seq1 = record.sequence;
    handleDemoCommand(socket, { type: "step-demo", sessionId: record.sessionId, sequence: seq1 });
    assert.equal(record.currentStepIndex, 1);
    assert.equal(record.sequence, 2);

    // Duplicate step-demo with old sequence=1 is rejected and does not advance step
    assert.throws(
      () => handleDemoCommand(socket, { type: "step-demo", sessionId: record.sessionId, sequence: seq1 }),
      /Secuencia de control de demostracion obsoleta o duplicada/i
    );
    assert.equal(record.currentStepIndex, 1);
    assert.equal(record.sequence, 2);

    // Capture sequence right before restart-demo
    const preRestartSequence = record.sequence;
    handleDemoCommand(socket, {
      type: "restart-demo",
      sessionId: record.sessionId,
      sequence: preRestartSequence,
      scope: "all"
    });
    assert.equal(record.status, "playing");
    assert.equal(record.currentStepIndex, 0);
    assert.ok(record.sequence > preRestartSequence);

    // A delayed command belonging to the previous run (preRestartSequence) cannot pause, step, or exit the restarted run
    assert.throws(
      () => handleDemoCommand(socket, { type: "pause-demo", sessionId: record.sessionId, sequence: preRestartSequence }),
      /Secuencia de control de demostracion obsoleta o duplicada/i
    );
    assert.equal(record.status, "playing");

    assert.throws(
      () => handleDemoCommand(socket, { type: "exit-demo", sessionId: record.sessionId, sequence: preRestartSequence }),
      /Secuencia de control de demostracion obsoleta o duplicada/i
    );
    assert.ok(getDemoSessionById(record.sessionId));
  } finally {
    destroyDemoSession(record.sessionId);
  }
});

test("Demo runner: transitions immediately to 'failed' if a checkpoint invariant is violated", () => {
  const socket = createMockSocket();
  const faultyScript = {
    ...scriptedTacticalDemoV1,
    id: "faulty_demo",
    scenes: [
      {
        ...scriptedTacticalDemoV1.scenes[0],
        steps: [
          {
            ...scriptedTacticalDemoV1.scenes[0].steps[0],
            expect: {
              phase: "active",
              round: 99 // deliberately wrong checkpoint
            }
          }
        ]
      }
    ]
  };

  const record = startNewDemoSession(socket, "faulty_demo", "FaultyTester", {
    autoPlay: false,
    customScript: faultyScript
  });

  try {
    const ok = executeNextDemoStep(record);
    assert.equal(ok, false);
    assert.equal(record.status, "failed");
    assert.match(record.errorMessage ?? "", /Checkpoint fallido/i);
  } finally {
    destroyDemoSession(record.sessionId);
  }
});

test("Demo runner: ignores duplicate step execution while commandInFlight is active", () => {
  const socket = createMockSocket();
  const record = startNewDemoSession(socket, SCRIPTED_TACTICAL_DEMO_ID, "InFlightTester", { autoPlay: false });

  try {
    record.commandInFlight = true;
    const ok = executeNextDemoStep(record);
    assert.equal(ok, false);
    assert.equal(record.currentStepIndex, 0);
  } finally {
    record.commandInFlight = false;
    destroyDemoSession(record.sessionId);
  }
});
