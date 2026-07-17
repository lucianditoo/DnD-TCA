import test from "node:test";
import assert from "node:assert";
import { handleGmApplyEffect } from "../apps/server/src/commands/gmCommands.js";
import { emptyTurn } from "../apps/server/src/combat/turnManager.js";
import { clients } from "../apps/server/src/room/roomStore.js";

test("gm-apply-effect validation", async (t) => {
  const mockRoom = {
    code: "TEST",
    participants: [
      { id: "gm-id", name: "GM", isGM: true },
      { id: "player-id", name: "Player", isGM: false }
    ],
    combatants: [
      { id: "hero-1", name: "Bane", type: "hero" }
    ],
    effectInstances: [],
    eventSequence: 0,
    round: 1,
    phase: "active",
    outcome: "ongoing",
    currentTurn: emptyTurn("hero-1"),
    log: []
  };

  clients.clear();
  const gmSocket = { readyState: 1, send: () => {} };
  const playerSocket = { readyState: 1, send: () => {} };
  clients.set(gmSocket, { id: "gm-id", role: "gm", name: "GM", roomCode: "TEST" });
  clients.set(playerSocket, { id: "player-id", role: "player", name: "Player", roomCode: "TEST" });

  await t.test("Rechaza si no es GM", () => {
    assert.throws(() => {
      handleGmApplyEffect(mockRoom, {
        type: "gm-apply-effect",
        roomCode: "TEST",
        actorId: "player-id",
        targetId: "hero-1",
        effectId: "srd_stunned"
      });
    }, /solo el GM/i);
    assert.strictEqual(mockRoom.effectInstances.length, 0);
  });

  await t.test("Rechaza si ID es desconocido y no muta la sala", () => {
    assert.throws(() => {
      handleGmApplyEffect(mockRoom, {
        type: "gm-apply-effect",
        roomCode: "TEST",
        actorId: "gm-id",
        targetId: "hero-1",
        effectId: "unknown_effect"
      });
    }, /Efecto desconocido 'unknown_effect'/);
    assert.strictEqual(mockRoom.effectInstances.length, 0);
  });

  await t.test("Acepta srd_stunned con GM autorizado", () => {
    handleGmApplyEffect(mockRoom, {
      type: "gm-apply-effect",
      roomCode: "TEST",
      actorId: "gm-id",
      targetId: "hero-1",
      effectId: "srd_stunned",
      durationPreset: "until_target_turn_end"
    });
    assert.strictEqual(mockRoom.effectInstances.length, 1);
    const instance = mockRoom.effectInstances[0];
    assert.strictEqual(instance.effectId, "srd_stunned");
    assert.deepStrictEqual(instance.duration, {
      type: "until_turn",
      anchorCombatantId: "hero-1",
      phase: "end",
      appliedAtSequence: 0
    });
  });
});
