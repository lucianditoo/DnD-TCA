import test from "node:test";
import assert from "node:assert/strict";
import { dispatchCommand } from "../apps/server/src/commands/dispatcher.ts";
import { clients, rooms } from "../apps/server/src/room/roomStore.ts";
import { makeTestRoom, makeTestCombatant, inventoryEquipment } from "./test-utils.mjs";
import { commandSchemasMap } from "@dnd-tactical/shared";
import { authorizeRoomCommand, commandAuthorizationPolicies } from "../apps/server/src/auth/commandAuthorization.ts";
import { validateClientCommand } from "../apps/server/src/validation/validateClientCommand.ts";

function setup(t) {
  const room = makeTestRoom({ code: "AUTH", combatants: [makeTestCombatant({
    controlledBy: { type: "player", participantId: "owner" }
  })] });
  const messages = [];
  const socket = { OPEN: 1, readyState: 1, send: value => messages.push(value) };
  clients.set(socket, { id: "owner", role: "player", name: "Owner", roomCode: room.code });
  rooms.set(room.code, room);
  function participant(id, role = "player", roomCode = room.code) {
    const connection = { ...socket };
    clients.set(connection, { id, role, roomCode, name: id });
    t.after(() => clients.delete(connection));
    return connection;
  }
  t.after(() => { clients.delete(socket); rooms.delete(room.code); });
  return { room, socket, messages, participant };
}

// Defense in depth for typed/internal callers: adding a command without an
// explicit authorization policy must never silently execute or resume work.
test("authorization: unknown command fails closed before any side effect", t => {
  const { room, socket, messages } = setup(t);
  const before = structuredClone(room);
  assert.throws(() => dispatchCommand(socket, {
    type: "unreviewed-command", roomCode: room.code, actorId: "owner"
  }), /politica de autorizacion/);
  assert.deepEqual(room, before);
  assert.deepEqual(messages, []);
});

// These are authorization inputs, not full wire payloads. Domain validators
// are intentionally not involved in the role/ownership matrix.
const ownedCases = [
  ...["move-combatant", "use-tactical-action", "resume-coup-de-grace", "choose-aid-bonus",
    "declare-attack-mode", "cancel-attack-mode", "declare-dodge-target", "roll-stabilization",
    "resolve-grapple-escape", "equip-item", "unequip-item"].map(type => ({ type, combatantId: "hero-test" })),
  { type: "resolve-attack", attackerId: "hero-test" },
  ...["use-ability", "cast-spell", "resolve-ability-attack"].map(type => ({ type, casterId: "hero-test" })),
  { type: "resolve-special-maneuver", maneuver: { attackerId: "hero-test" } },
  { type: "resolve-attack-confirmation" }, { type: "cancel-attack-threat" }
];
const overrideCases = [
  { type: "set-initiative", combatantId: "hero-test" },
  { type: "resolve-saving-throw", targetId: "hero-test" },
  { type: "resolve-opportunity-attack", opportunityId: "reaction" }, { type: "end-turn" }
];
const gmCases = ["sort-initiative", "heal-combatant", "gm-move-combatant", "gm-set-hp", "gm-set-status",
  "gm-clear-opportunities", "gm-add-log", "gm-apply-effect", "gm-apply-environmental-hazard",
  "gm-remove-effect", "gm-force-outcome", "update-board"].map(type => ({ type }));
const creationCases = [
  { type: "add-demo-combatant", variant: "hero" },
  { type: "add-catalog-combatant", category: "heroes" },
  { type: "add-profile-combatant", profile: { type: "player" } }
];

test("authorization: policy and scenario coverage exactly match all room wire commands", () => {
  const expected = Object.keys(commandSchemasMap).filter(type => !["create-room", "join-room"].includes(type)).sort();
  assert.deepEqual(Object.keys(commandAuthorizationPolicies).sort(), expected);
  assert.deepEqual([...ownedCases, ...overrideCases, ...gmCases, ...creationCases].map(c => c.type).sort(), expected);
});

for (const command of [...ownedCases, ...overrideCases, ...gmCases, ...creationCases]) {
  test(`authorization: ${command.type} role, ownership and room isolation`, t => {
    const f = setup(t);
    f.participant("other");
    f.participant("gm", "gm");
    f.participant("foreign-gm", "gm", "ELSEWHERE");
    f.room.turnOrder = ["hero-test"];
    f.room.activeAttackThreat = { attackerId: "hero-test" };
    f.room.pendingOpportunityAttacks = [{ id: "reaction", attackerId: "hero-test" }];
    const before = structuredClone(f.room);
    const check = actorId => authorizeRoomCommand(f.room, { ...command, actorId, roomCode: f.room.code });
    assert.throws(() => check("missing"), /no pertenece/);
    assert.throws(() => check("foreign-gm"), /no pertenece/);
    assert.throws(() => authorizeRoomCommand(f.room, { ...command, actorId: "gm", roomCode: "OTHER" }), /no pertenece/);
    if (gmCases.includes(command)) {
      assert.throws(() => check("owner"), /Solo el GM/);
      assert.doesNotThrow(() => check("gm"));
    } else if (creationCases.includes(command)) {
      assert.doesNotThrow(() => check("owner"));
      assert.doesNotThrow(() => check("gm"));
    } else {
      assert.doesNotThrow(() => check("owner"));
      assert.throws(() => check("other"), /propios heroes/);
      if (overrideCases.includes(command)) assert.doesNotThrow(() => check("gm"));
      else assert.throws(() => check("gm"), /GM no puede controlar heroes/);
      f.room.combatants[0].controlledBy = { type: "gm" };
      assert.doesNotThrow(() => check("gm"));
      assert.throws(() => check("owner"), /propios heroes/);
      f.room.combatants[0].controlledBy = before.combatants[0].controlledBy;
    }
    assert.deepEqual(f.room, before);
    assert.deepEqual(f.messages, []);
  });
}

test("authorization: only GM can create enemies through any creation command", t => {
  const f = setup(t);
  f.participant("gm", "gm");
  for (const command of [
    { type: "add-demo-combatant", variant: "enemy" },
    { type: "add-catalog-combatant", category: "enemies" },
    { type: "add-profile-combatant", profile: { type: "enemy" } }
  ]) {
    assert.throws(() => authorizeRoomCommand(f.room, { ...command, actorId: "owner", roomCode: f.room.code }), /Solo el GM/);
    assert.doesNotThrow(() => authorizeRoomCommand(f.room, { ...command, actorId: "gm", roomCode: f.room.code }));
  }
});

test("audit VULN-003/006: forged GM, foreign target and other owner's saving throw are rejected without mutations", t => {
  const f = setup(t);
  const gm = f.participant("gm", "gm");
  const other = f.participant("other");
  const command = { type: "resolve-saving-throw", actorId: "owner", roomCode: f.room.code,
    targetId: "hero-test", saveType: "fortitude", dc: 10, d20Roll: 12 };
  const before = structuredClone(f.room);
  assert.throws(() => dispatchCommand(f.socket, { ...command, actorId: "gm" }), /no esta autorizada/);
  assert.throws(() => dispatchCommand(other, { ...command, actorId: "other" }), /propios heroes/);
  assert.throws(() => dispatchCommand(gm, { ...command, actorId: "gm", targetId: "foreign-target" }), /Combatiente no encontrado/);
  assert.deepEqual(f.room, before);
  assert.deepEqual(f.messages, []);
  dispatchCommand(f.socket, command);
  dispatchCommand(gm, { ...command, actorId: "gm" });
  assert.equal(f.room.log.length, 2);
});

test("audit VULN-002: wire resumed cannot bypass ownership", t => {
  const f = setup(t);
  const other = f.participant("other");
  const validation = validateClientCommand({ type: "use-tactical-action", action: "stand-up",
    actorId: "other", roomCode: f.room.code, combatantId: "hero-test", resumed: true });
  assert.equal(validation.success, true);
  assert.equal(validation.data.resumed, undefined);
  const before = structuredClone(f.room);
  assert.throws(() => dispatchCommand(other, validation.data), /propios heroes/);
  assert.deepEqual(f.room, before);
});

test("audit VULN-005: players may join an ongoing or finished room, but cannot become GM", t => {
  const f = setup(t);
  for (const phase of ["preparation", "active", "opportunity-resolution", "critical-confirmation", "finished"]) {
    f.room.phase = phase;
    const socket = { OPEN: 1, readyState: 1, send() {} };
    t.after(() => clients.delete(socket));
    assert.throws(() => dispatchCommand(socket, { type: "join-room", roomCode: f.room.code, name: "Intruder", role: "gm" }), /Solo quien crea/);
    dispatchCommand(socket, { type: "join-room", roomCode: f.room.code, name: "Player", role: "player" });
    assert.equal(clients.get(socket).role, "player");
  }
});

for (const change of ["none", "disconnected", "new-owner", "new-turn", "incapacitated"]) {
  test(`audit VULN-004/008: server continuation after reaction (${change})`, t => {
    const f = setup(t);
    const gm = f.participant("gm", "gm");
    Object.assign(f.room.combatants[0], inventoryEquipment("longbow", { extraItems: [{ catalogId: "arrows_20", quantity: 20 }] }));
    f.room.combatants.push(makeTestCombatant({ id: "enemy", type: "enemy", controller: "gm",
      controlledBy: { type: "gm" }, position: { x: 1, y: 0, zFeet: 0 }, ...inventoryEquipment("club") }));
    f.room.currentTurn.attackMode = "standard";
    f.room.turnOrder = ["hero-test", "enemy"];
    dispatchCommand(f.socket, { type: "resolve-attack", actorId: "owner", roomCode: f.room.code,
      attackerId: "hero-test", targetId: "enemy", d20Roll: 15, damage: 3 });
    assert.ok(f.room.pendingStationaryAction);
    assert.equal(f.room.currentTurn.attacksMade, 0);
    const opportunityId = f.room.pendingOpportunityAttacks[0].id;
    if (change === "disconnected") clients.delete(f.socket);
    if (change === "new-owner") f.room.combatants[0].controlledBy = { type: "player", participantId: "other" };
    if (change === "new-turn") f.room.currentTurn.combatantId = "enemy";
    if (change === "incapacitated") f.room.combatants[0].hpCurrent = -1;
    // The reacting GM is not the original actor. Authorization of this new
    // command must not replace the authorization of the stored continuation.
    const response = { type: "resolve-opportunity-attack", actorId: "gm", roomCode: f.room.code,
      opportunityId, decline: true };
    dispatchCommand(gm, response);
    const shouldResume = ["none", "disconnected"].includes(change);
    assert.equal(f.room.currentTurn.attacksMade, shouldResume ? 1 : 0);
    assert.equal(f.room.combatants[1].hpCurrent, shouldResume ? 17 : 20);
    assert.equal(f.room.pendingStationaryAction, undefined);
    const beforeReplay = structuredClone(f.room);
    assert.throws(() => dispatchCommand(gm, response), /no encontrado/);
    assert.deepEqual(f.room, beforeReplay);
  });
}
