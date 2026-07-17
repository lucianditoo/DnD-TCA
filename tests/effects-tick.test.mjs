import test from "node:test";
import assert from "node:assert/strict";
import { effectsTickListener } from "@dnd-tactical/shared";

test("TickLayer (EFFECTS-SYS-TICK)", async (t) => {
  const baseRoom = {
    round: 1,
    eventSequence: 10,
    effectInstances: []
  };

  await t.test("Efecto 'until_turn' end expira correctamente con evento TurnEnded", () => {
    const instance = {
      instanceId: "inst-1",
      duration: { type: "until_turn", anchorCombatantId: "c1", phase: "end", appliedAtSequence: 10 }
    };
    // @ts-ignore
    const room = { ...baseRoom, effectInstances: [instance] };

    // Mismo sequence => ignorado (ej: se aplico como reacción a este mismo evento)
    const nextRoom0 = effectsTickListener(room, { type: "TurnEnded", combatantId: "c1", round: 1, sequence: 10 });
    assert.strictEqual(nextRoom0, room);

    // TurnStarted no lo quita
    const nextRoom1 = effectsTickListener(room, { type: "TurnStarted", combatantId: "c1", round: 1, sequence: 11 });
    assert.strictEqual(nextRoom1, room); // Inmutable

    // TurnEnded de otro no lo quita
    const nextRoom2 = effectsTickListener(room, { type: "TurnEnded", combatantId: "c2", round: 1, sequence: 12 });
    assert.strictEqual(nextRoom2, room);

    // TurnEnded del ancla sí lo quita (sequence > 10)
    const nextRoom3 = effectsTickListener(room, { type: "TurnEnded", combatantId: "c1", round: 1, sequence: 13 });
    assert.equal(nextRoom3.effectInstances.length, 0);
    assert.notStrictEqual(nextRoom3, room);
  });

  await t.test("Efecto 'rounds' expira al cumplirse el ancla después de count (Aplicado ANTES del ancla en la misma ronda)", () => {
    // Aplicado en seq 10, el ancla es el start de c1.
    const instance = {
      instanceId: "inst-2",
      duration: { type: "rounds", count: 1, anchorCombatantId: "c1", anchorPhase: "start", appliedRound: 1, appliedAtSequence: 10 }
    };
    // @ts-ignore
    const room = { ...baseRoom, effectInstances: [instance] };

    // TurnStarted de c1 ocurre en la misma ronda 1 pero sequence 11.
    // round (1) - appliedRound (1) = 0. No es >= 1. NO expira.
    const nextRoom1 = effectsTickListener(room, { type: "TurnStarted", combatantId: "c1", round: 1, sequence: 11 });
    assert.strictEqual(nextRoom1, room);

    // En la ronda 2, TurnStarted de c1 ocurre (sequence 20).
    // round (2) - appliedRound (1) = 1 >= 1. SÍ expira.
    const nextRoom2 = effectsTickListener(room, { type: "TurnStarted", combatantId: "c1", round: 2, sequence: 20 });
    assert.equal(nextRoom2.effectInstances.length, 0);
  });

  await t.test("Efecto 'rounds' expira al cumplirse el ancla (Aplicado DESPUES del ancla en la misma ronda)", () => {
    // Aplicado en seq 10, DESPUÉS del start de c1. (El start de c1 ya pasó en la ronda 1).
    const instance = {
      instanceId: "inst-2",
      duration: { type: "rounds", count: 1, anchorCombatantId: "c1", anchorPhase: "start", appliedRound: 1, appliedAtSequence: 10 }
    };
    // @ts-ignore
    const room = { ...baseRoom, effectInstances: [instance] };

    // En la ronda 2, TurnStarted de c1 ocurre (sequence 20).
    // round (2) - appliedRound (1) = 1 >= 1. SÍ expira.
    const nextRoom = effectsTickListener(room, { type: "TurnStarted", combatantId: "c1", round: 2, sequence: 20 });
    assert.equal(nextRoom.effectInstances.length, 0);
  });

  await t.test("Efecto 'rounds' con count > 1", () => {
    const instance = {
      instanceId: "inst-2",
      duration: { type: "rounds", count: 2, anchorCombatantId: "c1", anchorPhase: "start", appliedRound: 1, appliedAtSequence: 10 }
    };
    // @ts-ignore
    const room = { ...baseRoom, effectInstances: [instance] };

    // Ronda 2: 2 - 1 = 1 < 2. No expira.
    const nextRoom1 = effectsTickListener(room, { type: "TurnStarted", combatantId: "c1", round: 2, sequence: 20 });
    assert.strictEqual(nextRoom1, room);

    // Ronda 3: 3 - 1 = 2 >= 2. Sí expira.
    const nextRoom2 = effectsTickListener(room, { type: "TurnStarted", combatantId: "c1", round: 3, sequence: 30 });
    assert.equal(nextRoom2.effectInstances.length, 0);
  });

  await t.test("Dos efectos expirando simultáneamente", () => {
    const instance1 = {
      instanceId: "inst-1",
      duration: { type: "until_turn", anchorCombatantId: "c1", phase: "start", appliedAtSequence: 10 }
    };
    const instance2 = {
      instanceId: "inst-2",
      duration: { type: "rounds", count: 1, anchorCombatantId: "c1", anchorPhase: "start", appliedRound: 1, appliedAtSequence: 10 }
    };
    // @ts-ignore
    const room = { ...baseRoom, effectInstances: [instance1, instance2], round: 2 };

    // Ambos expiran con el TurnStarted de C1 en la ronda 2
    const nextRoom = effectsTickListener(room, { type: "TurnStarted", combatantId: "c1", round: 2, sequence: 20 });
    assert.equal(nextRoom.effectInstances.length, 0);
    assert.notStrictEqual(nextRoom, room);
  });

  await t.test("Efectos permanentes y sin expiración automática no expiran", () => {
    const instance1 = { instanceId: "inst-p", duration: { type: "permanent" } };
    const instance2 = { instanceId: "inst-r", duration: { type: "until_rest" } };
    const instance3 = { instanceId: "inst-d", duration: { type: "until_dispelled" } };

    // @ts-ignore
    const room = { ...baseRoom, effectInstances: [instance1, instance2, instance3] };

    const nextRoom = effectsTickListener(room, { type: "TurnStarted", combatantId: "c1", round: 10, sequence: 100 });
    assert.strictEqual(nextRoom, room);
  });
});
