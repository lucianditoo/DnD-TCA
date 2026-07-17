import test from "node:test";
import assert from "node:assert/strict";
import {
  Rules,
  SizeRulesCatalog,
  createCatalogCombatant,
  createCombatRulesSnapshot,
  createEmptyRoom,
  creatureCatalog
} from "../packages/shared/dist/index.js";
import { handleResolveAbilityAttack } from "../apps/server/src/commands/abilityCommands.ts";
import { validateClientCommand } from "../apps/server/src/validation/validateClientCommand.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";

const touchSocket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(touchSocket, { id: "player-touch", role: "player", name: "Touch Tester", roomCode: "TOUCH" });

test("Sprint 010: todas las criaturas catalogadas producen CA normal, touch y flat-footed exactas", () => {
  const expectations = {
    bane: { normal: 19, touch: 14, flatFooted: 15 },
    cedrick: { normal: 19, touch: 11, flatFooted: 18 },
    elaen: { normal: 17, touch: 14, flatFooted: 13 },
    canocrock: { normal: 22, touch: 11, flatFooted: 21 }
  };
  const templates = [...creatureCatalog.heroes, ...creatureCatalog.enemies];
  for (const template of templates) {
    const category = template.type === "enemy" ? "enemies" : "heroes";
    const combatant = createCatalogCombatant(template.id, category, 1, { type: "gm" });
    const room = createEmptyRoom("ACV2");
    room.combatants.push(combatant);
    const snapshot = createCombatRulesSnapshot(room);
    const expected = expectations[template.id];
    assert.ok(expected, `Falta expectativa para ${template.id}`);
    assert.equal(Rules.totalArmorClass(snapshot, combatant, { targetAcType: "normal" }).total, expected.normal);
    assert.equal(Rules.totalArmorClass(snapshot, combatant, { targetAcType: "touch" }).total, expected.touch);
    assert.equal(Rules.totalArmorClass(snapshot, combatant, { targetAcType: "normal", isFlatFootedOverride: true }).total, expected.flatFooted);
  }
});

test("Sprint 010: el catálogo de tamaño separa modificadores de ataque/CA y Presa", () => {
  assert.deepEqual(SizeRulesCatalog.small, { attackAndAcModifier: 1, grappleModifier: -4, spaceFeet: 5, defaultReachFeet: 5 });
  assert.deepEqual(SizeRulesCatalog.medium, { attackAndAcModifier: 0, grappleModifier: 0, spaceFeet: 5, defaultReachFeet: 5 });
  assert.deepEqual(SizeRulesCatalog.large, { attackAndAcModifier: -1, grappleModifier: 4, spaceFeet: 10, defaultReachFeet: 10 });
  assert.equal(Object.keys(SizeRulesCatalog).length, 9);
});

test("Sprint 010: Ray of Frost selecciona Touch AC desde el catálogo del servidor", () => {
  const room = createEmptyRoom("TOUCH");
  const caster = createCatalogCombatant("bane", "heroes", 1, { type: "player", participantId: "player-touch" });
  const target = createCatalogCombatant("canocrock", "enemies", 1, { type: "gm" });
  target.intrinsicDefense.deflectionBonus = 2;
  room.combatants.push(caster, target);
  room.turnOrder.push(caster.id, target.id);
  room.activeTurnIndex = 0;
  room.currentTurn.combatantId = caster.id;
  room.phase = "active";

  const before = createCombatRulesSnapshot(room);
  assert.equal(Rules.totalArmorClass(before, target, { targetAcType: "normal" }).total, 24);
  assert.equal(Rules.totalArmorClass(before, target, { targetAcType: "touch" }).total, 13, "Touch conserva DEX +1 y desvío +2");

  handleResolveAbilityAttack(room, {
    type: "resolve-ability-attack",
    roomCode: room.code,
    actorId: "player-touch",
    casterId: caster.id,
    targetId: target.id,
    abilityId: "ray-of-frost",
    d20Roll: 3,
    damage: 2
  });

  assert.equal(target.hpCurrent, 57, "d20 3 + BAB 6 + DEX 4 = 13: impacta Touch 13 y habría fallado contra CA normal 24");
  assert.equal(room.currentTurn.usedStandardAction, true);
  assert.ok(room.log.some((entry) => entry.message.includes("contra CA 13")));
});

test("Sprint 010: la red rechaza cualquier intento del cliente de forzar targetAcType", () => {
  const result = validateClientCommand({
    type: "resolve-ability-attack",
    roomCode: "TOUCH",
    actorId: "player-touch",
    casterId: "caster",
    targetId: "target",
    abilityId: "ray-of-frost",
    d20Roll: 10,
    damage: 2,
    targetAcType: "normal"
  });
  assert.equal(result.success, false);
  assert.match(result.error, /Unrecognized key.*targetAcType/i);
});

test("Sprint 010: Magic Missile permanece fuera del pipeline de tiradas de ataque", () => {
  const bane = createCatalogCombatant("bane", "heroes", 1, { type: "gm" });
  const missile = bane.abilities.find((ability) => ability.id === "magic-missile");
  assert.equal(missile.resolution.kind, "automatic-damage");
});
