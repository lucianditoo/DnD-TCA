import test from "node:test";
import assert from "node:assert/strict";
import { closeAcademy, handleAcademyCommand } from "../apps/server/src/academy/session.ts";
import { dispatchCommand } from "../apps/server/src/commands/dispatcher.ts";
import { rooms } from "../apps/server/src/room/roomStore.ts";

function connect(scenarioId) {
  const events = [];
  const socket = { readyState: 1, OPEN: 1, send: data => events.push(JSON.parse(data)) };
  handleAcademyCommand(socket, { type: "start-academy", scenarioId });
  const hello = events[0];
  const dispatch = command => dispatchCommand(socket, { ...command, actorId: hello.participant.id, roomCode: hello.room.code });
  return { socket, events, hello, dispatch, hero: hello.room.combatants[0] };
}

for (const [scenarioId, coordinates] of [
  ["camera", [[2, 2], [3, 2], [4, 2], [4, 3], [4, 4]]],
  ["opportunity", [[2, 2], [3, 2], [4, 2], [5, 2]]]
]) {
  test("Academia completa " + scenarioId + " con movimiento real", t => {
    const { socket, hero, dispatch, events } = connect(scenarioId);
    t.after(() => closeAcademy(socket));
    const path = coordinates.map(([x, y]) => ({ x, y, zFeet: 0 }));
    dispatch({ type: "move-combatant", combatantId: hero.id, path, to: path.at(-1) });
    assert.equal(events.at(-1).state.status, "victory");
    if (scenarioId === "opportunity") {
      assert.ok(events.some(event => event.room?.pendingOpportunityAttacks.length));
      assert.equal(events.filter(event => event.room).at(-1).room.pendingOpportunityAttacks.length, 0);
    }
  });
}
test("Fireball real detona y protege al objetivo detrás del muro", t => {
  const { socket, hero, dispatch, events } = connect("fireball");
  t.after(() => closeAcademy(socket));
  dispatch({ type: "cast-spell", casterId: hero.id, slotId: hero.preparedSpells[0].slotId,
    targetPosition: { x: 9, y: 2, zFeet: 0 }, d20Roll: null, amount: 999 });
  assert.equal(events.at(-1).state.status, "victory");
  const room = events.filter(event => event.room).at(-1).room;
  assert.ok(room.combatants[1].hpCurrent < room.combatants[1].hpMax);
  assert.ok(room.combatants[1].hpCurrent > 0);
  assert.equal(room.combatants[2].hpCurrent, room.combatants[2].hpMax);
});
test("Academia aísla salas, cierra el intento y rechaza mensajes viejos", t => {
  const a = connect("camera");
  const b = connect("camera");
  t.after(() => { closeAcademy(a.socket); closeAcademy(b.socket); });
  const code = a.hello.room.code;
  const before = structuredClone(rooms.get(code));
  assert.throws(() => dispatchCommand(b.socket, { type: "join-room", roomCode: code, name: "Visitante", role: "player" }));
  assert.throws(() => a.dispatch({ type: "gm-force-outcome", outcome: "victory" }));
  assert.deepEqual(rooms.get(code), before);
  a.dispatch({ type: "end-turn" });
  assert.equal(a.events.at(-1).state.status, "failed");
  handleAcademyCommand(a.socket, { type: "restart-academy", attemptId: a.hello.academy.attemptId });
  const next = a.events.at(-1);
  assert.notEqual(next.room.code, code);
  assert.notEqual(next.academy.attemptId, a.hello.academy.attemptId);
  assert.ok(!rooms.has(code));
  assert.throws(() => a.dispatch({ type: "end-turn" }));
  assert.throws(() => handleAcademyCommand(a.socket, { type: "exit-academy", attemptId: a.hello.academy.attemptId }));
  handleAcademyCommand(a.socket, { type: "exit-academy", attemptId: next.academy.attemptId });
  assert.equal(a.events.at(-1).type, "academy-exited");
  assert.ok(!rooms.has(next.room.code));
  assert.ok(rooms.has(b.hello.room.code));
});
