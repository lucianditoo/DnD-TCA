import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Rules,
  createCombatRulesSnapshot,
  getSpecialManeuverSizeModifier,
  resolveTripOpposedCheck,
  validateSpecialManeuver
} from "../packages/shared/src/index.ts";
import { handleResolveSpecialManeuver } from "../apps/server/src/commands/specialManeuverCommands.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { inventoryEquipment, makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

const actorId = "trip-player-actor";
const mockSocket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(mockSocket, { id: actorId, role: "player", name: "Trip tester", roomCode: "TRIP" });

function stats() {
  return {
    attacksMade: 0,
    opportunityAttacksMade: 0,
    hits: 0,
    misses: 0,
    damageDealt: 0,
    damageTaken: 0,
    timesDroppedToZero: 0,
    kills: 0,
    distanceMovedFeet: 0
  };
}

function combatant(id, type, position, overrides = {}) {
  const weaponId = overrides.weaponId ?? "longsword";
  const sizeCategory = overrides.sizeCategory ?? "medium";
  const abilityScores = overrides.abilityScores ?? {
    strength: type === "player" ? 18 : 14,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  };
  return makeTestCombatant({
    id,
    name: id,
    type,
    hpCurrent: 30,
    hpMax: 30,
    baseAttackBonus: type === "player" ? 4 : 2,
    abilityScores,
    sizeCategory,
    position,
    controller: type === "player" ? "player" : "gm",
    controlledBy: type === "player" ? { type: "player", participantId: actorId } : { type: "gm" },
    ...inventoryEquipment(weaponId),
    featIds: overrides.featIds ?? [],
    stats: stats(),
    ...overrides,
    weaponId: undefined,
    reachFeet: undefined,
    minReachFeet: undefined
  });
}

function setup(overrides = {}) {
  const attacker = combatant(
    "tripper",
    "player",
    overrides.attackerPosition ?? { x: 1, y: 1, zFeet: 0 },
    overrides.attacker ?? {}
  );
  const target = combatant(
    "target",
    "enemy",
    overrides.targetPosition ?? { x: 2, y: 1, zFeet: 0 },
    overrides.target ?? {}
  );
  const room = makeTestRoom({
    code: "TRIP",
    combatants: [attacker, target],
    turnOrder: [attacker.id, target.id],
    currentTurn: {
      ...makeTestRoom().currentTurn,
      combatantId: attacker.id
    }
  });
  return { room, attacker, target };
}

function command(overrides = {}) {
  return {
    type: "resolve-special-maneuver",
    roomCode: "TRIP",
    actorId,
    maneuver: {
      type: "trip",
      attackerId: "tripper",
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

test("srd_prone aplica la matriz normativa de CA y penaliza el ataque melee", () => {
  const { room, target } = setup();
  room.effectInstances.push({
    instanceId: "prone-existing",
    effectId: "srd_prone",
    source: { type: "system" },
    targets: [target.id],
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  });
  const snapshot = createCombatRulesSnapshot(room);
  const normal = Rules.totalArmorClass(snapshot, target).total;
  assert.equal(Rules.totalArmorClass(snapshot, target, { attackType: "melee" }).total, normal - 4);
  assert.equal(Rules.totalArmorClass(snapshot, target, { attackType: "ranged" }).total, normal + 4);
  const baseAttack = Rules.totalAttackBonus(snapshot, target, { abilityForAttack: "strength" }).total;
  assert.equal(Rules.totalAttackBonus(snapshot, target, { abilityForAttack: "strength", attackType: "melee" }).total, baseAttack - 4);
});

test("el modificador de Derribo reutiliza exactamente grappleModifier", () => {
  assert.equal(getSpecialManeuverSizeModifier("small"), -4);
  assert.equal(getSpecialManeuverSizeModifier("medium"), 0);
  assert.equal(getSpecialManeuverSizeModifier("large"), 4);
  assert.equal(getSpecialManeuverSizeModifier("huge"), 8);
});

test("la validacion rechaza objetivos de mas de una categoria mayor sin mutar la sala", () => {
  const { room, attacker, target } = setup({ target: { sizeCategory: "huge" } });
  const result = validateSpecialManeuver(createCombatRulesSnapshot(room), attacker, target, "trip");
  assert.equal(result.ok, false);
  assert.match(result.error, /mas de una categoria/i);
  assert.throws(() => handleResolveSpecialManeuver(room, command(), fixedDice([])), /mas de una categoria/i);
  assert.equal(room.currentTurn.usedStandardAction, false);
  assert.equal(room.effectInstances.length, 0);
  assert.equal(room.log.length, 0);
});

test("la prueba opuesta usa Fuerza del atacante, la mejor defensa fisica y tamaño", () => {
  const { room, attacker, target } = setup({
    attackerPosition: { x: 0, y: 1, zFeet: 0 },
    targetPosition: { x: 2, y: 1, zFeet: 0 },
    attacker: {
      sizeCategory: "large",
      abilityScores: { strength: 14, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
    },
    target: {
      abilityScores: { strength: 10, dexterity: 18, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
    }
  });
  const result = resolveTripOpposedCheck(createCombatRulesSnapshot(room), attacker, target, 10, 10);
  assert.equal(result.attackerModifier, 6, "+2 FUE y +4 Large");
  assert.equal(result.defenderAbility, "dexterity");
  assert.equal(result.defenderModifier, 4);
  assert.equal(result.attackerWins, true);
});

test("un AdO que inflige daño aborta toda fase posterior y no persiste estados intermedios", () => {
  const { room, attacker, target } = setup();
  const purposes = [];
  handleResolveSpecialManeuver(room, command(), fixedDice([15], purposes));
  assert.deepEqual(purposes, ["opportunity-attack"]);
  assert.ok(attacker.hpCurrent < attacker.hpMax, "El AdO debe aplicar daño antes de abortar.");
  assert.equal(room.effectInstances.some((effect) => effect.effectId === "srd_prone"), false);
  assert.equal(room.currentTurn.usedStandardAction, true);
  assert.equal(target.stats.opportunityAttacksMade, 1);
  assert.equal(room.pendingOpportunityAttacks.length, 0);
  assert.equal(room.activeAttackThreat, null);
  assert.equal(room.phase, "active");
  assert.match(room.log.map((entry) => entry.message).join("\n"), /aborta la maniobra/i);
});

test("Improved Trip evita el AdO y el servidor resuelve toque, oposicion y prone en un commit", () => {
  const { room, target } = setup({ attacker: { featIds: ["srd_improved_trip"] } });
  const purposes = [];
  handleResolveSpecialManeuver(room, command(), fixedDice([1], purposes));
  assert.deepEqual(purposes, ["opposed-defender"], "El cliente no controla el d20 del defensor y no existe AdO.");
  const prone = room.effectInstances.find((effect) => effect.effectId === "srd_prone" && effect.targets.includes(target.id));
  assert.ok(prone, "El resultado ganador debe aplicar srd_prone mediante EffectManager.");
  assert.equal(prone.duration.type, "permanent");
  assert.equal(room.currentTurn.usedStandardAction, true);
  assert.equal(room.pendingOpportunityAttacks.length, 0);
  assert.equal(room.activeAttackThreat, null);
});

test("un empate exacto en la oposicion se deshace con nuevas tiradas autoritativas", () => {
  const equalAbilities = { strength: 14, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 };
  const { room, target } = setup({
    attacker: { featIds: ["srd_improved_trip"], abilityScores: equalAbilities },
    target: { abilityScores: equalAbilities }
  });
  const purposes = [];
  handleResolveSpecialManeuver(
    room,
    command({ d20OpposedRoll: 10 }),
    fixedDice([10, 20, 1], purposes)
  );
  assert.deepEqual(purposes, ["opposed-defender", "opposed-reroll-attacker", "opposed-reroll-defender"]);
  assert.equal(room.effectInstances.some((effect) => effect.effectId === "srd_prone" && effect.targets.includes(target.id)), true);
});

test("un arma catalogada para Derribo suprime el AdO sin inferirlo por alcance", () => {
  const { room, attacker, target } = setup({ attacker: { weaponId: "flail" } });
  const preview = validateSpecialManeuver(createCombatRulesSnapshot(room), attacker, target, "trip");
  assert.equal(preview.ok, true);
  assert.equal(preview.value.armedTrip, true);
  assert.equal(preview.value.provokesOpportunityAttack, false);

  const purposes = [];
  handleResolveSpecialManeuver(room, command(), fixedDice([1], purposes));
  assert.deepEqual(purposes, ["opposed-defender"]);
});

test("si el toque melee falla, no se tira la oposicion ni se aplica prone", () => {
  const { room } = setup({ attacker: { featIds: ["srd_improved_trip"] } });
  handleResolveSpecialManeuver(room, command({ d20TouchRoll: 1 }), fixedDice([]));
  assert.equal(room.effectInstances.some((effect) => effect.effectId === "srd_prone"), false);
  assert.equal(room.currentTurn.usedStandardAction, true);
  assert.match(room.log.map((entry) => entry.message).join("\n"), /toque melee.*falla/i);
});
