import test from "node:test";
import assert from "node:assert/strict";
import { dispatchCombatEvent } from "@dnd-tactical/shared";

test("EventBus - Módulo Eventos", async (t) => {
  const baseRoom = { round: 1, log: [] };

  await t.test("Orden determinista y encadenamiento", () => {
    const order = [];

    const listenerA = (room, event) => {
      order.push("A");
      return { ...room, log: [...room.log, "A-" + event.type] };
    };

    const listenerB = (room, event) => {
      order.push("B");
      return { ...room, log: [...room.log, "B-" + event.type] };
    };

    const nextRoom = dispatchCombatEvent(
      // @ts-ignore
      baseRoom,
      { type: "TurnStarted", combatantId: "c1", round: 1, sequence: 1 },
      [listenerA, listenerB]
    );

    assert.deepEqual(order, ["A", "B"]);
    assert.deepEqual(nextRoom.log, ["A-TurnStarted", "B-TurnStarted"]);
  });

  await t.test("Inmutabilidad estructural por omisión", () => {
    const listenerInert = (room, event) => room;
    
    // @ts-ignore
    const nextRoom = dispatchCombatEvent(baseRoom, { type: "TurnEnded", combatantId: "c1", round: 1, sequence: 2 }, [listenerInert]);

    assert.strictEqual(nextRoom, baseRoom);
  });

  await t.test("Detención y propagación por excepción", () => {
    const order = [];
    const listenerA = (room, event) => {
      order.push("A");
      return room;
    };
    const listenerError = (room, event) => {
      order.push("Error");
      throw new Error("Fallo forzado");
    };
    const listenerB = (room, event) => {
      order.push("B"); // No debería ejecutarse
      return room;
    };

    assert.throws(() => {
      dispatchCombatEvent(
        // @ts-ignore
        baseRoom,
        { type: "TurnStarted", combatantId: "c1", round: 1, sequence: 3 },
        [listenerA, listenerError, listenerB]
      );
    }, /Fallo forzado/);

    assert.deepEqual(order, ["A", "Error"]);
  });
});
