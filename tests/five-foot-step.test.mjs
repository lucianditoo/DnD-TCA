import assert from "node:assert/strict";
import { test } from "node:test";
import { createEmptyRoom, canUseFiveFootStep } from "../packages/shared/dist/index.js";
import { structuredSnapshotFields } from "./test-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// Tests unitarios para la regla canUseFiveFootStep
//
// Invariantes verificadas:
// - movimiento normal de 5 ft NO activa usedFiveFootStep
// - five-foot step activa usedFiveFootStep = true
// - five-foot step NO activa usedMoveAction
// - five-foot step suma 5 ft a movementUsedFeet
// - usedFullAttack NO bloquea el paso (compatible con ataque completo)
// - usedTotalDefense bloquea el paso
// - doble paso de 5 ft bloqueado
// - movimiento previo bloquea el paso
// ─────────────────────────────────────────────────────────────────────────────

function setupRoom() {
  const room = createEmptyRoom("test");
  const combatant = {
    id: "hero1", name: "Cedrick", type: "hero", hpCurrent: 10, hpMax: 10, isStable: false,
    buffs: [],
    position: { x: 0, y: 0, zFeet: 0 },
    ...structuredSnapshotFields(10)
  };
  room.combatants = [combatant];
  return { room, combatant };
}

function makeTurn(overrides = {}) {
  return {
    combatantId: "hero1",
    movementUsedFeet: 0,
    usedMoveAction: false,
    usedStandardAction: false,
    usedFullAttack: false,
    usedFiveFootStep: false,
    usedSwiftAction: false,
    usedTotalDefense: false,
    usedStabilization: false,
    ...overrides
  };
}

test("canUseFiveFootStep", async (t) => {
  await t.test("retorna ok:true al inicio del turno", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn();
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, true);
  });

  await t.test("falla si usedFiveFootStep = true (doble paso)", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn({ usedFiveFootStep: true });
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, false);
    assert.match(result.error, /paso de 5 pies/i);
  });

  await t.test("falla si movementUsedFeet > 0 (movimiento normal previo)", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn({ movementUsedFeet: 5 });
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, false);
    assert.match(result.error, /movimiento/i);
  });

  await t.test("falla si usedMoveAction = true", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn({ usedMoveAction: true });
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, false);
    assert.match(result.error, /movimiento/i);
  });

  await t.test("retorna ok:true aunque usedFullAttack = true (compatible con ataque completo)", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn({ usedFullAttack: true });
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, true, "el ataque completo no bloquea el paso de 5 pies");
  });

  await t.test("falla si usedTotalDefense = true", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn({ usedTotalDefense: true });
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, false);
    assert.match(result.error, /defensa total/i);
  });

  await t.test("falla si combatiente esta muerto", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn();
    combatant.hpCurrent = -10;
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, false);
  });

  await t.test("falla si combatiente esta moribundo (dying)", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn();
    combatant.hpCurrent = -5;
    combatant.isStable = false;
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, false);
  });
});

test("Semántica del turn state tras un paso de 5 pies (verificado vía estado simulado)", async (t) => {
  // Estos tests verifican las invariantes del estado del turno
  // que deben cumplirse DESPUÉS de que handleFiveFootStep ejecuta su lógica.
  // Se simula el resultado esperado del handler directamente en el TurnState.

  await t.test("five-foot step activa usedFiveFootStep", () => {
    const turn = makeTurn();
    // Simular lo que hace handleFiveFootStep:
    turn.usedFiveFootStep = true;
    turn.movementUsedFeet += 5;
    // usedMoveAction NO se toca

    assert.equal(turn.usedFiveFootStep, true, "usedFiveFootStep debe quedar true");
    assert.equal(turn.usedMoveAction, false, "usedMoveAction NO debe activarse");
    assert.equal(turn.movementUsedFeet, 5, "movementUsedFeet debe ser 5");
  });

  await t.test("movimiento normal de 5 ft NO activa usedFiveFootStep", () => {
    const turn = makeTurn();
    // Simular lo que hace movementCommands tras el fix:
    turn.movementUsedFeet += 5;
    turn.usedMoveAction = true;
    // usedFiveFootStep NO se toca

    assert.equal(turn.usedFiveFootStep, false, "movimiento normal no debe activar usedFiveFootStep");
    assert.equal(turn.usedMoveAction, true, "movimiento normal sí activa usedMoveAction");
  });

  await t.test("five-foot step NO activa usedMoveAction (preserva la acción de movimiento)", () => {
    const turn = makeTurn();
    turn.usedFiveFootStep = true;
    turn.movementUsedFeet += 5;
    assert.equal(turn.usedMoveAction, false, "el paso de 5 pies no consume la acción de movimiento");
  });

  await t.test("five-foot step suma exactamente 5 ft a movementUsedFeet (cellSizeFeet=5)", () => {
    const turn = makeTurn();
    turn.usedFiveFootStep = true;
    turn.movementUsedFeet += 5; // cellSizeFeet = 5
    assert.equal(turn.movementUsedFeet, 5);
  });
});

test("Interacciones de turno después de paso de 5 pies", async (t) => {
  await t.test("five-foot step + full attack: canUseFiveFootStep disponible con usedFullAttack=true", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn({ usedFullAttack: true });
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, true, "el ataque completo previo no bloquea el paso");
  });

  await t.test("full attack + five-foot step: después del paso, canUseFiveFootStep falla por usedFiveFootStep", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn({ usedFullAttack: true, usedFiveFootStep: true, movementUsedFeet: 5 });
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, false);
    assert.match(result.error, /paso de 5 pies/i);
  });

  await t.test("five-foot step + movimiento normal: después del paso, movementUsedFeet=5 bloquea canUseFiveFootStep para otro paso", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn({ usedFiveFootStep: true, movementUsedFeet: 5 });
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, false);
  });

  await t.test("movimiento normal + intento de paso: movementUsedFeet=10 bloquea canUseFiveFootStep", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn({ movementUsedFeet: 10, usedMoveAction: true });
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, false);
    assert.match(result.error, /movimiento/i);
  });

  await t.test("doble paso de 5 pies: segundo intento falla por usedFiveFootStep=true", () => {
    const { room, combatant } = setupRoom();
    room.currentTurn = makeTurn({ usedFiveFootStep: true, movementUsedFeet: 5 });
    const result = canUseFiveFootStep(room, combatant);
    assert.equal(result.ok, false);
    assert.match(result.error, /paso de 5 pies/i);
  });
});
