import test from "node:test";
import assert from "node:assert/strict";
import {
  DemoCatalog,
  SCRIPTED_TACTICAL_DEMO_ID,
  assertValidProfileSources,
  validateDemoCommand,
  validateDemoServerEvent
} from "@dnd-tactical/shared";

test("Demo contracts: accepts all valid DemoClientCommand payloads", () => {
  const validPayloads = [
    { type: "start-demo", demoId: SCRIPTED_TACTICAL_DEMO_ID },
    { type: "start-demo", demoId: SCRIPTED_TACTICAL_DEMO_ID, name: "Observador" },
    { type: "pause-demo", sessionId: "demo-123" },
    { type: "resume-demo", sessionId: "demo-123" },
    { type: "step-demo", sessionId: "demo-123" },
    { type: "set-demo-speed", sessionId: "demo-123", speedMultiplier: 0.5 },
    { type: "set-demo-speed", sessionId: "demo-123", speedMultiplier: 1 },
    { type: "set-demo-speed", sessionId: "demo-123", speedMultiplier: 2 },
    { type: "restart-demo", sessionId: "demo-123", scope: "scene" },
    { type: "restart-demo", sessionId: "demo-123", scope: "all" },
    { type: "exit-demo", sessionId: "demo-123" }
  ];

  for (const payload of validPayloads) {
    const result = validateDemoCommand(payload);
    assert.equal(result.ok, true, `Expected ${JSON.stringify(payload)} to be valid`);
  }
});

test("Demo contracts: rejects unknown fields (.strict()) and invalid speed multipliers", () => {
  const withExtraField = validateDemoCommand({
    type: "start-demo",
    demoId: SCRIPTED_TACTICAL_DEMO_ID,
    diceRoller: "hack"
  });
  assert.equal(withExtraField.ok, false);

  const invalidSpeed = validateDemoCommand({
    type: "set-demo-speed",
    sessionId: "demo-123",
    speedMultiplier: 3
  });
  assert.equal(invalidSpeed.ok, false);

  const invalidScope = validateDemoCommand({
    type: "restart-demo",
    sessionId: "demo-123",
    scope: "step"
  });
  assert.equal(invalidScope.ok, false);

  const emptySession = validateDemoCommand({
    type: "pause-demo",
    sessionId: ""
  });
  assert.equal(emptySession.ok, false);
});

test("Demo contracts: validates DemoServerEvent payloads strictly", () => {
  const validState = validateDemoServerEvent({
    type: "demo-session-state",
    state: {
      sessionId: "demo-123",
      demoId: SCRIPTED_TACTICAL_DEMO_ID,
      roomCode: "DEMO01",
      status: "playing",
      currentSceneIndex: 0,
      totalScenes: 3,
      currentSceneTitle: "Escena A — La Emboscada",
      currentStepIndex: 1,
      totalStepsInScene: 13,
      activeActorName: "Cedrick",
      actionSummary: "Ataque",
      ruleExplanation: "Explicacion",
      speedMultiplier: 1,
      errorMessage: null
    }
  });
  assert.equal(validState.ok, true);

  const validExited = validateDemoServerEvent({
    type: "demo-exited",
    sessionId: "demo-123"
  });
  assert.equal(validExited.ok, true);

  const invalidEvent = validateDemoServerEvent({
    type: "demo-session-state",
    state: {
      sessionId: "demo-123"
    }
  });
  assert.equal(invalidEvent.ok, false);
});

test("DemoCatalog: scripted_tactical_demo_v1 defines 3 complete scenes with source-first valid profiles", () => {
  const demo = DemoCatalog.get(SCRIPTED_TACTICAL_DEMO_ID);
  assert.ok(demo, "scripted_tactical_demo_v1 must exist in DemoCatalog");
  assert.equal(demo.scenes.length, 3);

  for (const scene of demo.scenes) {
    assert.ok(scene.combatants.length >= 4, `Scene ${scene.id} should have at least 4 combatants`);
    assert.ok(scene.steps.length >= 10, `Scene ${scene.id} should have steps`);
    assert.equal(scene.initiatives.length, scene.combatants.length, `Scene ${scene.id} initiatives must match combatants`);
    for (const profile of scene.combatants) {
      assert.doesNotThrow(() => assertValidProfileSources(profile), `Profile ${profile.id} in ${scene.id} must be source-first valid`);
    }
  }
});
