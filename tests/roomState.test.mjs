import { test, describe } from "node:test";
import assert from "node:assert";
import { ensureLegacyRoomShape } from "../apps/server/src/room/roomState.js";

describe("roomState - ensureLegacyRoomShape", () => {
  function makeRoom(overrides = {}) {
    return {
      combatants: [],
      turnOrder: ["id-1", "id-2"],
      pendingOpportunityAttacks: [],
      activeAttackThreat: null,
      outcome: "ongoing",
      board: { width: 10, height: 10, cellSizeFeet: 5 },
      ...overrides
    };
  }

  test("Caso sala normal activa", () => {
    const room = makeRoom();
    ensureLegacyRoomShape(room);
    assert.strictEqual(room.phase, "active");
  });

  test("Caso amenaza critica pendiente", () => {
    const room = makeRoom({ activeAttackThreat: { attackerId: "id-1", targetId: "id-2" } });
    ensureLegacyRoomShape(room);
    assert.strictEqual(room.phase, "critical-confirmation");
  });

  test("Caso ataque de oportunidad pendiente", () => {
    const room = makeRoom({ pendingOpportunityAttacks: [{ id: "opp-1" }] });
    ensureLegacyRoomShape(room);
    assert.strictEqual(room.phase, "opportunity-resolution");
  });

  test("Conflicto entre estados pendientes (prioridad: amenaza)", () => {
    const room = makeRoom({
      activeAttackThreat: { attackerId: "id-1", targetId: "id-2" },
      pendingOpportunityAttacks: [{ id: "opp-1" }]
    });
    ensureLegacyRoomShape(room);
    assert.strictEqual(room.phase, "critical-confirmation");
  });

  test("Si el combate termina, la fase es finished", () => {
    const room = makeRoom({
      outcome: "victory",
      activeAttackThreat: { attackerId: "id-1", targetId: "id-2" } // Aunque haya amenaza
    });
    ensureLegacyRoomShape(room);
    assert.strictEqual(room.phase, "finished");
  });

  test("Si no hay turnos activos, la fase es preparation", () => {
    const room = makeRoom({ turnOrder: [] });
    ensureLegacyRoomShape(room);
    assert.strictEqual(room.phase, "preparation");
  });

  test("Una sala legacy sin effectInstances recibe []", () => {
    const legacyRoom = makeRoom(); // sin effectInstances
    delete legacyRoom.effectInstances;
    ensureLegacyRoomShape(legacyRoom);
    assert.deepEqual(legacyRoom.effectInstances, []);
  });

  test("Una sala legacy recibe eventSequence: 0", () => {
    const legacyRoom = makeRoom();
    delete legacyRoom.eventSequence;
    ensureLegacyRoomShape(legacyRoom);
    assert.strictEqual(legacyRoom.eventSequence, 0);
  });

  test("Una sala legacy conserva su eventSequence existente", () => {
    const room = makeRoom({ eventSequence: 42 });
    ensureLegacyRoomShape(room);
    assert.strictEqual(room.eventSequence, 42);
  });

  test("Una sala ya válida conserva su array y su referencia", () => {
    const validRoom = makeRoom();
    const existingInstances = [{ instanceId: "test", effectId: "__INFRASTRUCTURE_SAMPLE__", source: { type: "system" }, appliedAtEvent: { type: "SystemInjected", round: 1 } }];
    validRoom.effectInstances = existingInstances;
    
    ensureLegacyRoomShape(validRoom);
    assert.strictEqual(validRoom.effectInstances, existingInstances);
  });

  test("La migración es idempotente", () => {
    const legacyRoom = makeRoom();
    delete legacyRoom.effectInstances;
    
    ensureLegacyRoomShape(legacyRoom);
    const firstPass = legacyRoom.effectInstances;
    
    ensureLegacyRoomShape(legacyRoom);
    assert.strictEqual(legacyRoom.effectInstances, firstPass);
  });
});
