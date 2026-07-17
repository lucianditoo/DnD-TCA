import test from "node:test";
import assert from "node:assert/strict";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";
import { handleCastSpell } from "../apps/server/src/commands/abilityCommands.js";
import { clients } from "../apps/server/src/room/roomStore.js";

const actorId = "player-1";
const socket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(socket, { id: actorId, role: "player", name: "Tester", roomCode: "TEST" });

test("Spellcasting Transactional Handler", async (t) => {
  await t.test("Consumo Irreversible: un lanzamiento exitoso transiciona el slot a isExpended y consume la accion estandar", () => {
    const caster = makeTestCombatant({
      id: "caster-1",
      hpCurrent: 10,
      controlledBy: { type: "player", participantId: "player-1" },
      preparedSpells: [{ slotId: "slot-1", spellId: "srd_cure_light_wounds", isExpended: false }]
    });
    const target = makeTestCombatant({ id: "target-1", type: "player", hpCurrent: 5 });
    
    const room = makeTestRoom({
      combatants: [caster, target],
      currentTurn: { combatantId: caster.id, usedStandardAction: false }
    });

    handleCastSpell(room, {
      type: "cast-spell",
      roomCode: "TEST",
      actorId: "player-1",
      casterId: "caster-1",
      targetId: "target-1",
      slotId: "slot-1",
      amount: 5,
      d20Roll: null
    });

    assert.equal(room.currentTurn.usedStandardAction, true, "Debe consumir la accion estandar");
    assert.equal(target.hpCurrent, 10, "Debe aplicar curacion (5 + 5)");
    
    const updatedCaster = room.combatants.find(c => c.id === "caster-1");
    assert.equal(updatedCaster.preparedSpells[0].isExpended, true, "El slot debe quedar consumido");
  });

  await t.test("Preflight Rechazado: un segundo comando consecutivo con el mismo slotId es rechazado y no consume accion", () => {
    const caster = makeTestCombatant({
      id: "caster-1",
      controlledBy: { type: "player", participantId: "player-1" },
      preparedSpells: [{ slotId: "slot-1", spellId: "srd_cure_light_wounds", isExpended: true }]
    });
    const target = makeTestCombatant({ id: "target-1", type: "player", hpCurrent: 5 });
    
    const room = makeTestRoom({
      combatants: [caster, target],
      currentTurn: { combatantId: caster.id, usedStandardAction: false }
    });

    assert.throws(
      () => {
        handleCastSpell(room, {
          type: "cast-spell",
          roomCode: "TEST",
          actorId: "player-1",
          casterId: "caster-1",
          targetId: "target-1",
          slotId: "slot-1",
          amount: 5,
          d20Roll: null
        });
      },
      /El slot de conjuro solicitado ya ha sido consumido/,
      "Debe lanzar excepcion de preflight"
    );

    assert.equal(room.currentTurn.usedStandardAction, false, "NO debe consumir accion estandar en preflight rechazado");
    assert.equal(target.hpCurrent, 5, "NO debe alterar los HP de la sala");
  });

  await t.test("Preflight Rechazado por falta de slot: no consume accion", () => {
    const caster = makeTestCombatant({
      id: "caster-1",
      controlledBy: { type: "player", participantId: "player-1" },
      preparedSpells: []
    });
    const target = makeTestCombatant({ id: "target-1" });
    
    const room = makeTestRoom({
      combatants: [caster, target],
      currentTurn: { combatantId: caster.id, usedStandardAction: false }
    });

    assert.throws(
      () => {
        handleCastSpell(room, {
          type: "cast-spell",
          roomCode: "TEST",
          actorId: "player-1",
          casterId: "caster-1",
          targetId: "target-1",
          slotId: "slot-invalid",
          amount: 5,
          d20Roll: null
        });
      },
      /no tiene el slot de conjuro solicitado/,
      "Debe lanzar excepcion de preflight"
    );

    assert.equal(room.currentTurn.usedStandardAction, false, "NO debe consumir accion");
  });
});
