import test from "node:test";
import assert from "node:assert/strict";
import { handleGmApplyEffect, handleGmRemoveEffect } from "../apps/server/src/commands/gmCommands.js";
import { validateClientCommand } from "../apps/server/src/validation/validateClientCommand.ts";
import { emptyTurn } from "../apps/server/src/combat/turnManager.js";
import { clients } from "../apps/server/src/room/roomStore.js";

function makeMockRoom() {
  return {
    code: "TEST",
    combatants: [{ id: "hero-1", name: "Bane", type: "hero" }],
    effectInstances: [],
    eventSequence: 0,
    round: 1,
    phase: "active",
    outcome: "ongoing",
    currentTurn: emptyTurn("hero-1"),
    log: []
  };
}

function registerClients() {
  clients.clear();
  const gmSocket = { readyState: 1, send: () => {} };
  const playerSocket = { readyState: 1, send: () => {} };
  clients.set(gmSocket, { id: "gm-id", role: "gm", name: "GM", roomCode: "TEST" });
  clients.set(playerSocket, { id: "player-id", role: "player", name: "Player", roomCode: "TEST" });
}

test("gm-remove-effect: handler", async (t) => {
  await t.test("Rechaza si no es GM y no muta la sala", () => {
    const room = makeMockRoom();
    registerClients();
    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_stunned" });
    const before = JSON.stringify(room.effectInstances);

    assert.throws(() => {
      handleGmRemoveEffect(room, { type: "gm-remove-effect", roomCode: "TEST", actorId: "player-id", instanceId: room.effectInstances[0].instanceId });
    }, /solo el GM/i);
    assert.equal(JSON.stringify(room.effectInstances), before, "El intento rechazado no debe mutar la sala.");
  });

  await t.test("Rechaza instanceId inexistente sin mutar la sala", () => {
    const room = makeMockRoom();
    registerClients();
    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_stunned" });
    const before = JSON.stringify(room.effectInstances);

    assert.throws(() => {
      handleGmRemoveEffect(room, { type: "gm-remove-effect", roomCode: "TEST", actorId: "gm-id", instanceId: "no-existe" });
    }, /no existe un efecto activo/i);
    assert.equal(JSON.stringify(room.effectInstances), before);
  });

  await t.test("GM remueve una instancia válida por instanceId", () => {
    const room = makeMockRoom();
    registerClients();
    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_stunned" });
    const instanceId = room.effectInstances[0].instanceId;
    const logLengthBefore = room.log.length;

    handleGmRemoveEffect(room, { type: "gm-remove-effect", roomCode: "TEST", actorId: "gm-id", instanceId });

    assert.equal(room.effectInstances.length, 0);
    assert.equal(room.log.length - logLengthBefore, 1, "Debe agregar exactamente un log administrativo, sin duplicados.");
    assert.match(room.log[0].message, /Bane/);
    assert.match(room.log[0].message, /anulación administrativa/i);
  });

  await t.test("Remover una instancia no remueve otras (incluso del mismo effectId)", () => {
    const room = makeMockRoom();
    registerClients();
    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_flat_footed" });
    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_dazed" });
    assert.equal(room.effectInstances.length, 2);
    const [first, second] = room.effectInstances;

    handleGmRemoveEffect(room, { type: "gm-remove-effect", roomCode: "TEST", actorId: "gm-id", instanceId: first.instanceId });

    assert.equal(room.effectInstances.length, 1);
    assert.equal(room.effectInstances[0].instanceId, second.instanceId);
  });
});

test("onStack end-to-end vía los handlers administrativos (el panel no implementa reglas)", async (t) => {
  await t.test("Reaplicar Fatigued produce Exhausted vía EffectManager, no vía el handler", () => {
    const room = makeMockRoom();
    registerClients();
    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_fatigued" });
    assert.equal(room.effectInstances[0].effectId, "srd_fatigued");

    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_fatigued" });

    assert.equal(room.effectInstances.length, 1, "La instancia vieja de Fatigued se reemplaza, no se suma.");
    assert.equal(room.effectInstances[0].effectId, "srd_exhausted", "EffectManager.add resolvió la escalada; el handler solo reenvió el effectId solicitado.");
  });

  await t.test("Prone duplicado continúa ignorándose (onStack:'ignore', DT-022)", () => {
    const room = makeMockRoom();
    registerClients();
    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_prone" });
    const firstInstanceId = room.effectInstances[0].instanceId;

    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_prone" });

    assert.equal(room.effectInstances.length, 1, "onStack:'ignore' descarta la segunda instancia.");
    assert.equal(room.effectInstances[0].instanceId, firstInstanceId);
  });

  await t.test("Una tercera fatiga contra un objetivo ya Exhausted sigue sin revertirlo", () => {
    const room = makeMockRoom();
    registerClients();
    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_fatigued" });
    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_fatigued" });
    assert.equal(room.effectInstances[0].effectId, "srd_exhausted");

    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_fatigued" });

    assert.equal(room.effectInstances.length, 1);
    assert.equal(room.effectInstances[0].effectId, "srd_exhausted", "El objetivo ya está en el techo de severidad: la fatiga adicional es redundante.");
  });

  await t.test("GM puede remover un efecto que el motor generó automáticamente (la escalada a Exhausted)", () => {
    const room = makeMockRoom();
    registerClients();
    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_fatigued" });
    handleGmApplyEffect(room, { type: "gm-apply-effect", roomCode: "TEST", actorId: "gm-id", targetId: "hero-1", effectId: "srd_fatigued" });
    const exhaustedInstanceId = room.effectInstances[0].instanceId;

    handleGmRemoveEffect(room, { type: "gm-remove-effect", roomCode: "TEST", actorId: "gm-id", instanceId: exhaustedInstanceId });

    assert.equal(room.effectInstances.length, 0, "La remoción administrativa es una anulación deliberada, sin restaurar Fatigued.");
  });
});

test("gm-remove-effect: schema y registro", () => {
  const valid = validateClientCommand({ type: "gm-remove-effect", roomCode: "TEST", actorId: "gm-id", instanceId: "effect-abc" });
  assert.equal(valid.success, true);
  assert.equal(valid.data.instanceId, "effect-abc");

  const missingInstanceId = validateClientCommand({ type: "gm-remove-effect", roomCode: "TEST", actorId: "gm-id" });
  assert.equal(missingInstanceId.success, false);
  assert.match(missingInstanceId.error, /instanceId: Required/i);

  const withInjectedField = validateClientCommand({ type: "gm-remove-effect", roomCode: "TEST", actorId: "gm-id", instanceId: "effect-abc", effectId: "srd_fatigued" });
  assert.equal(withInjectedField.success, true, "Igual que gm-apply-effect, el schema no es .strict(): campos ajenos se descartan, no rechazan.");
  assert.equal(withInjectedField.data.effectId, undefined, "effectId nunca debe ser autoridad de remoción, aunque se envíe.");
});
