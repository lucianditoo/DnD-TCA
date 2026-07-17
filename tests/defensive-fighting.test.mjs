import test from "node:test";
import assert from "node:assert/strict";
import { 
  createEmptyRoom,
  Rules,
  createCombatRulesSnapshot
} from "../packages/shared/dist/index.js";
import { handleDeclareAttackMode, handleCancelAttackMode } from "../apps/server/src/commands/tacticalCommands.ts";
import { handleResolveAttack } from "../apps/server/src/commands/attackCommands.ts";
import { expireStartOfTurnBuffs } from "../apps/server/src/combat/buffRules.ts";
import { findCombatant } from "../apps/server/src/room/roomState.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { structuredSnapshotFields } from "./test-utils.mjs";

const mockSocketSystem = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(mockSocketSystem, { id: "system", role: "gm", name: "System", roomCode: "TEST" });

function setupRoom() {
  const room = createEmptyRoom("TEST");
  const hero = {
    id: "hero", name: "Hero", type: "hero", hpCurrent: 10, hpMax: 10, isStable: false,
    position: { x: 0, y: 0, zFeet: 0 },
    ...structuredSnapshotFields(15),
    abilityScores: { strength: 16, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    baseAttackBonus: 5, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    buffs: [],
    abilities: [],
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, kills: 0, timesDroppedToZero: 0, opportunityAttacksMade: 0, distanceMovedFeet: 0 },
    controlledBy: { type: "gm" }
  };
  const enemy = {
    id: "enemy", name: "Enemy", type: "enemy", hpCurrent: 10, hpMax: 10, isStable: false,
    position: { x: 1, y: 0, zFeet: 0 },
    ...structuredSnapshotFields(10),
    baseAttackBonus: 1, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    buffs: [],
    abilities: [],
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, kills: 0, timesDroppedToZero: 0, opportunityAttacksMade: 0, distanceMovedFeet: 0 },
    controlledBy: { type: "gm" }
  };
  room.combatants = [hero, enemy];
  room.turnOrder = ["hero", "enemy"];
  room.activeTurnIndex = 0;
  room.phase = "active";
  room.currentTurn.combatantId = "hero";
  return { room, hero, enemy };
}

test("Luchar a la Defensiva", async (t) => {
  await t.test("declarar defensivo no aplica el bono antes del primer ataque", () => {
    const { room, hero } = setupRoom();
    handleDeclareAttackMode(room, { type: "declare-attack-mode", roomCode: "TEST", actorId: "system", combatantId: "hero", mode: "standard", defensive: true });
    
    assert.equal(room.currentTurn.attackMode, "standard");
    assert.equal(room.currentTurn.defensiveFightingDeclared, true);
    assert.equal(Rules.totalArmorClass(createCombatRulesSnapshot(room), hero).total, 15, "El CA no sube inmediatamente");
    assert.equal(hero.buffs.length, 0);
  });

  await t.test("cancelar el modo antes de atacar no deja buff", () => {
    const { room, hero } = setupRoom();
    handleDeclareAttackMode(room, { type: "declare-attack-mode", roomCode: "TEST", actorId: "system", combatantId: "hero", mode: "standard", defensive: true });
    handleCancelAttackMode(room, { type: "cancel-attack-mode", roomCode: "TEST", actorId: "system", combatantId: "hero" });
    
    assert.equal(room.currentTurn.defensiveFightingDeclared, false);
    assert.equal(Rules.totalArmorClass(createCombatRulesSnapshot(room), hero).total, 15);
  });

  await t.test("el primer ataque valido aplica el -4 y luego suma el +2 a la CA", () => {
    const { room, hero } = setupRoom();
    handleDeclareAttackMode(room, { type: "declare-attack-mode", roomCode: "TEST", actorId: "system", combatantId: "hero", mode: "standard", defensive: true });
    
    handleResolveAttack(room, { type: "resolve-attack", roomCode: "TEST", actorId: "system", attackerId: "hero", targetId: "enemy", d20Roll: 10, damage: 5 });
    
    // Verificamos que aplique CA
    assert.equal(Rules.totalArmorClass(createCombatRulesSnapshot(room), hero).total, 17);
    assert.ok(hero.buffs.some(b => b.name === "Luchar a la defensiva"));
    
    // Verificamos el -4 numérico en el log
    const attackLog = room.log.find(l => l.kind === "attack");
    const match = attackLog.message.match(/\+ ataque (-?\d+)/);
    assert.ok(match, "Debe contener el modificador de ataque numérico en el log");
    const attackMod = parseInt(match[1], 10);
    assert.equal(attackMod, 4, "El modificador final de ataque debe ser 4 (8 base - 4 por defensiva)");
  });

  await t.test("el bono expira al inicio del siguiente turno del combatiente", () => {
    const { room, hero } = setupRoom();
    handleDeclareAttackMode(room, { type: "declare-attack-mode", roomCode: "TEST", actorId: "system", combatantId: "hero", mode: "standard", defensive: true });
    handleResolveAttack(room, { type: "resolve-attack", roomCode: "TEST", actorId: "system", attackerId: "hero", targetId: "enemy", d20Roll: 10, damage: 5 });
    
    assert.equal(Rules.totalArmorClass(createCombatRulesSnapshot(room), hero).total, 17);
    
    // Avanzamos turnos (simulando que termina el hero y pasa al enemy)
    // El buff dice: expiresAtStartOfTurnOf: "hero"
    
    // Si inicia el turno del enemigo, el buff NO DEBE expirar.
    expireStartOfTurnBuffs(room, findCombatant(room, "enemy"));
    assert.equal(Rules.totalArmorClass(createCombatRulesSnapshot(room), hero).total, 17, "El buff permanece durante el turno del enemigo");
    
    // Si inicia el turno del heroe de nuevo
    expireStartOfTurnBuffs(room, hero);
    assert.equal(Rules.totalArmorClass(createCombatRulesSnapshot(room), hero).total, 15, "El buff expira al iniciar su propio turno de nuevo");
  });
});
