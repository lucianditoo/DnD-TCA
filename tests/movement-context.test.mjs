import test from "node:test";
import assert from "node:assert/strict";
import { createCombatRulesSnapshot, createEmptyRoom } from "@dnd-tactical/shared";
import { advanceTurn, emptyTurn } from "@dnd-tactical/server/src/combat/turnManager.js";
import { ensureLegacyRoomShape } from "@dnd-tactical/server/src/room/roomState.js";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

test("D-1B-I1: las fabricas de turno crean el Movement Context autoritativo en cero", () => {
  assert.equal(emptyTurn("hero-1").normalDiagonalStepsThisTurn, 0);
  assert.equal(createEmptyRoom("CTX").currentTurn.normalDiagonalStepsThisTurn, 0);
});

test("D-1B-I1: el snapshot preserva el Movement Context sin mutarlo ni reiniciarlo", () => {
  const room = makeTestRoom();
  room.currentTurn.normalDiagonalStepsThisTurn = 3;

  const snapshot = createCombatRulesSnapshot(room);

  assert.equal(snapshot.currentTurn.normalDiagonalStepsThisTurn, 3);
  assert.equal(room.currentTurn.normalDiagonalStepsThisTurn, 3);
});

test("D-1B-I1: comenzar un turno nuevo reinicia el contador diagonal", () => {
  const first = makeTestCombatant({ id: "hero-1" });
  const second = makeTestCombatant({ id: "enemy-1", type: "enemy" });
  const room = makeTestRoom({
    combatants: [first, second],
    turnOrder: [first.id, second.id],
    activeTurnIndex: 0,
    currentTurn: { ...emptyTurn(first.id), normalDiagonalStepsThisTurn: 4 }
  });

  advanceTurn(room);

  assert.equal(room.activeTurnIndex, 1);
  assert.equal(room.currentTurn.normalDiagonalStepsThisTurn, 0);
});

test("D-1B-I1: la frontera legacy inicializa el contexto ausente sin alterar el turno", () => {
  const room = makeTestRoom();
  const legacyTurn = { ...room.currentTurn };
  delete legacyTurn.normalDiagonalStepsThisTurn;
  room.currentTurn = legacyTurn;

  ensureLegacyRoomShape(room);

  assert.equal(room.currentTurn.normalDiagonalStepsThisTurn, 0);
  assert.equal(room.currentTurn.combatantId, "hero-test");
});
