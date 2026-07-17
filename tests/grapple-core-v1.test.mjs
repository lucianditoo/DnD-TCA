import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Rules,
  canUseFiveFootStep,
  canUseMoveAction,
  createCombatRulesSnapshot,
  resolveGrappleOpposedCheck,
  resolveOpposedCheck,
  validateSpecialManeuver
} from "../packages/shared/src/index.ts";
import { resolveSpecialManeuverSchema } from "../packages/shared/src/schemas/commands/specialManeuverCommands.ts";
import { handleResolveSpecialManeuver } from "../apps/server/src/commands/specialManeuverCommands.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { inventoryEquipment, makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

const actorId = "grapple-player";
const mockSocket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(mockSocket, { id: actorId, role: "player", name: "Grapple tester", roomCode: "GRAPPLE" });

function combatant(id, type, position, overrides = {}) {
  return makeTestCombatant({
    id,
    name: id,
    type,
    hpCurrent: 40,
    hpMax: 40,
    baseAttackBonus: type === "player" ? 4 : 2,
    abilityScores: type === "player"
      ? { strength: 18, dexterity: 12, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
      : { strength: 14, dexterity: 18, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium",
    position,
    controller: type === "player" ? "player" : "gm",
    controlledBy: type === "player" ? { type: "player", participantId: actorId } : { type: "gm" },
    ...inventoryEquipment("longsword"),
    ...overrides
  });
}

function setup(overrides = {}) {
  const attacker = combatant("grappler", "player", { x: 1, y: 2, zFeet: 0 }, overrides.attacker);
  const target = combatant("target", "enemy", { x: 2, y: 2, zFeet: 0 }, overrides.target);
  const room = makeTestRoom({
    code: "GRAPPLE",
    combatants: [attacker, target],
    turnOrder: [attacker.id, target.id],
    currentTurn: { ...makeTestRoom().currentTurn, combatantId: attacker.id }
  });
  return { room, attacker, target };
}

function command(overrides = {}) {
  return {
    type: "resolve-special-maneuver",
    roomCode: "GRAPPLE",
    actorId,
    maneuver: {
      type: "grapple",
      attackerId: "grappler",
      targetId: "target",
      d20TouchRoll: 20,
      d20OpposedRoll: 20,
      ...overrides
    }
  };
}

function fixedDice(values, purposes = []) {
  let index = 0;
  return {
    d20(purpose) {
      purposes.push(purpose);
      const value = values[index++];
      assert.notEqual(value, undefined, `Falta un d20 determinista para ${purpose}.`);
      return value;
    }
  };
}

function addGrappleEffect(room, attacker, target) {
  room.effectInstances.push({
    instanceId: "grapple-link",
    effectId: "srd_grappling",
    source: { type: "creature", id: attacker.id },
    targets: [attacker.id, target.id],
    appliedAtEvent: { type: "ActionResolved", combatantId: attacker.id, round: room.round },
    duration: { type: "permanent" }
  });
}

test("Sprint 029 - Grapple Core V1", async (t) => {
  await t.test("la oposición usa BAB + Fuerza efectiva + grappleModifier y conserva el oráculo de empate", () => {
    const { room, attacker, target } = setup({ target: { sizeCategory: "large" } });
    room.effectInstances.push({
      instanceId: "fatigued-grappler",
      effectId: "srd_fatigued",
      source: { type: "system" },
      targets: [attacker.id],
      appliedAtEvent: { type: "SystemInjected", round: room.round },
      duration: { type: "permanent" }
    });
    const snapshot = createCombatRulesSnapshot(room);
    const preview = validateSpecialManeuver(snapshot, attacker, target, "grapple");
    assert.equal(preview.ok, true, preview.error);
    assert.equal(preview.value.maneuverId, "grapple");
    assert.equal(preview.value.attackerGrappleModifier, 7, "BAB 4 + FUE efectiva 3 + tamaño 0");
    assert.equal(preview.value.defenderGrappleModifier, 8, "BAB 2 + FUE 2 + tamaño Large 4");

    const result = resolveGrappleOpposedCheck(snapshot, attacker, target, 12, 10);
    assert.equal(result.attackerTotal, 19);
    assert.equal(result.defenderTotal, 18);
    assert.equal(result.attackerWins, true);
    const exactTie = resolveOpposedCheck(10, 10, 8, 8);
    assert.equal(exactTie.attackerWins, false);
    assert.equal(exactTie.requiresReroll, true);
    const modifierTieBreak = resolveOpposedCheck(9, 10, 9, 8);
    assert.equal(modifierTieBreak.attackerTotal, modifierTieBreak.defenderTotal);
    assert.equal(modifierTieBreak.attackerWins, true);
    assert.equal(modifierTieBreak.requiresReroll, false);
  });

  await t.test("la CA conserva Destreza contra el compañero y la niega frente a un tercero", () => {
    const { room, attacker, target } = setup();
    const external = combatant("external", "player", { x: 3, y: 2, zFeet: 0 });
    room.combatants.push(external);
    addGrappleEffect(room, attacker, target);
    const snapshot = createCombatRulesSnapshot(room);
    const generic = Rules.totalArmorClass(snapshot, target).total;
    const partner = Rules.totalArmorClass(snapshot, target, { attackType: "melee", attackerId: attacker.id }).total;
    const outsider = Rules.totalArmorClass(snapshot, target, { attackType: "melee", attackerId: external.id }).total;
    assert.equal(partner, generic, "el compañero pertenece a targets y no niega Destreza");
    assert.equal(outsider, generic - 4, "DEX 18 aporta +4 y se suprime ante terceros");
  });

  await t.test("CANNOT_MOVE reduce velocidad a cero y bloquea movimiento y paso de 5 pies", () => {
    const { room, attacker, target } = setup();
    addGrappleEffect(room, attacker, target);
    const snapshot = createCombatRulesSnapshot(room);
    assert.equal(Rules.totalSpeedFeet(snapshot, attacker), 0);
    const move = canUseMoveAction(snapshot, attacker);
    assert.equal(move.ok, false);
    assert.match(move.error, /no puede moverse.*presa/i);
    const step = canUseFiveFootStep(snapshot, attacker);
    assert.equal(step.ok, false);
    assert.match(step.error, /no puede dar un paso.*presa/i);
  });

  await t.test("un AdO con daño aborta antes del toque, oposición y vínculo", () => {
    const { room, attacker } = setup();
    const purposes = [];
    handleResolveSpecialManeuver(room, command(), fixedDice([15], purposes));
    assert.deepEqual(purposes, ["opportunity-attack"]);
    assert.ok(attacker.hpCurrent < attacker.hpMax);
    assert.equal(room.effectInstances.some((effect) => effect.effectId === "srd_grappling"), false);
    assert.equal(room.currentTurn.usedStandardAction, true);
  });

  await t.test("una victoria crea una sola instancia inmutable con ambos participantes", () => {
    const { room, attacker, target } = setup();
    room.effectInstances.push({
      instanceId: "target-no-aoo",
      effectId: "srd_flat_footed",
      source: { type: "system" },
      targets: [target.id],
      appliedAtEvent: { type: "SystemInjected", round: room.round },
      duration: { type: "permanent" }
    });
    const purposes = [];
    handleResolveSpecialManeuver(room, command(), fixedDice([1], purposes));
    assert.deepEqual(purposes, ["opposed-defender"]);
    const links = room.effectInstances.filter((effect) => effect.effectId === "srd_grappling");
    assert.equal(links.length, 1);
    assert.deepEqual(links[0].targets, [attacker.id, target.id]);
    assert.equal(links[0].source.id, attacker.id);
    assert.equal(room.currentTurn.usedStandardAction, true);
    assert.equal(validateSpecialManeuver(createCombatRulesSnapshot(room), attacker, target, "grapple").ok, false);
  });

  await t.test("el schema estricto acepta intención y rechaza matemática manipulada", () => {
    assert.equal(resolveSpecialManeuverSchema.safeParse(command()).success, true);
    const malicious = command({ defenderRoll: 1, grappleModifier: 99, targetAcType: "normal" });
    assert.equal(resolveSpecialManeuverSchema.safeParse(malicious).success, false);
  });
});
