import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Rules,
  createCombatRulesSnapshot,
  getGrappleAttackEligibility,
  getGrappleEscapePreview,
  getGrappleLink,
  resolveGrappleEscapeSchema
} from "../packages/shared/src/index.ts";
import { handleResolveAttack } from "../apps/server/src/commands/attackCommands.ts";
import { handleResolveGrappleEscape } from "../apps/server/src/commands/specialManeuverCommands.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { inventoryEquipment, makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

const actorId = "grapple-v2-player";
const mockSocket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(mockSocket, { id: actorId, role: "player", name: "Grapple V2 tester", roomCode: "GRAPPLE2" });

function combatant(id, type, overrides = {}) {
  return makeTestCombatant({
    id,
    name: id,
    type,
    hpCurrent: 30,
    hpMax: 30,
    baseAttackBonus: type === "player" ? 4 : 3,
    abilityScores: type === "player"
      ? { strength: 16, dexterity: 18, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
      : { strength: 14, dexterity: 12, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    skillRanks: { escape_artist: type === "player" ? 5 : 0 },
    controller: type === "player" ? "player" : "gm",
    controlledBy: type === "player" ? { type: "player", participantId: actorId } : { type: "gm" },
    position: type === "player" ? { x: 1, y: 1, zFeet: 0 } : { x: 2, y: 1, zFeet: 0 },
    ...inventoryEquipment("dagger"),
    ...overrides
  });
}

function setup(overrides = {}) {
  const escapee = combatant("escapee", "player", overrides.escapee);
  const holder = combatant("holder", "enemy", overrides.holder);
  const room = makeTestRoom({
    code: "GRAPPLE2",
    combatants: [escapee, holder],
    turnOrder: [escapee.id, holder.id],
    currentTurn: { ...makeTestRoom().currentTurn, combatantId: escapee.id },
    effectInstances: [{
      instanceId: "grapple-v2-link",
      effectId: "srd_grappling",
      source: { type: "creature", id: holder.id },
      targets: [holder.id, escapee.id],
      appliedAtEvent: { type: "ActionResolved", combatantId: holder.id, round: 1 },
      duration: { type: "permanent" }
    }]
  });
  return { room, escapee, holder };
}

function command(overrides = {}) {
  return {
    type: "resolve-grapple-escape",
    roomCode: "GRAPPLE2",
    actorId,
    combatantId: "escapee",
    escapeType: "grapple_check",
    d20Roll: 20,
    ...overrides
  };
}

function fixedDice(values, purposes = []) {
  let index = 0;
  return { d20(purpose) {
    purposes.push(purpose);
    const value = values[index++];
    assert.notEqual(value, undefined, `Falta un d20 para ${purpose}.`);
    return value;
  } };
}

test("Sprint 030 - Grapple Core V2", async (t) => {
  await t.test("localiza el vínculo y Escapismo proyecta DES efectiva más rangos", () => {
    const { room, escapee, holder } = setup();
    const snapshot = createCombatRulesSnapshot(room);
    const link = getGrappleLink(snapshot, escapee.id);
    assert.equal(link.ok, true, link.error);
    assert.equal(link.value.opponentId, holder.id);
    const preview = getGrappleEscapePreview(snapshot, escapee, "escape_artist");
    assert.equal(preview.ok, true, preview.error);
    assert.equal(preview.value.escapeModifier, 9, "DES +4 y 5 rangos");
    assert.equal(preview.value.defenderModifier, 5, "BAB 3 + FUE 2 + tamaño 0");
  });

  await t.test("un escape exitoso elimina exactamente el vínculo", () => {
    const { room } = setup();
    const purposes = [];
    handleResolveGrappleEscape(room, command(), fixedDice([1], purposes));
    assert.deepEqual(purposes, ["opposed-defender"]);
    assert.equal(room.effectInstances.some((effect) => effect.effectId === "srd_grappling"), false);
    assert.equal(room.currentTurn.usedStandardAction, true);
  });

  await t.test("fallar conserva la Presa y consume la acción estándar", () => {
    const { room } = setup();
    handleResolveGrappleEscape(room, command({ d20Roll: 1 }), fixedDice([20]));
    assert.equal(room.effectInstances.filter((effect) => effect.effectId === "srd_grappling").length, 1);
    assert.equal(room.currentTurn.usedStandardAction, true);
  });

  await t.test("daga ligera se permite y recibe el breakdown exacto de -4", () => {
    const { room, escapee } = setup();
    const snapshot = createCombatRulesSnapshot(room);
    const eligibility = getGrappleAttackEligibility(snapshot, escapee);
    assert.equal(eligibility.ok, true, eligibility.error);
    assert.equal(eligibility.value.sourceKind, "light_weapon");
    const attack = Rules.totalAttackBonus(snapshot, escapee, { abilityForAttack: "strength", attackType: "melee" });
    assert.ok(attack.parts.includes("forcejeo en presa -4"));
    assert.equal(attack.parts.filter((part) => part === "forcejeo en presa -4").length, 1);
  });

  await t.test("espada a dos manos se rechaza antes de consumir acción", () => {
    const { room, escapee, holder } = setup({ escapee: inventoryEquipment("greatsword") });
    room.currentTurn.attackMode = "standard";
    const snapshot = createCombatRulesSnapshot(room);
    const eligibility = getGrappleAttackEligibility(snapshot, escapee);
    assert.equal(eligibility.ok, false);
    assert.match(eligibility.error, /solo se permiten armas ligeras/i);
    assert.throws(() => handleResolveAttack(room, {
      type: "resolve-attack", roomCode: room.code, actorId, attackerId: escapee.id, targetId: holder.id,
      d20Roll: 20, damage: 5
    }), /solo se permiten armas ligeras/i);
    assert.equal(room.currentTurn.usedStandardAction, false);
    assert.equal(escapee.stats.attacksMade, 0);
  });

  await t.test("schema estricto acepta intención y rechaza captor o modificadores manipulados", () => {
    assert.equal(resolveGrappleEscapeSchema.safeParse(command()).success, true);
    assert.equal(resolveGrappleEscapeSchema.safeParse(command({ opponentId: "holder", defenderRoll: 1, escapeModifier: 99 })).success, false);
  });
});
