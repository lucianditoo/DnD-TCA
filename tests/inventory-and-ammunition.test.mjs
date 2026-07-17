import test from "node:test";
import assert from "node:assert/strict";
import {
  Rules,
  createCombatRulesSnapshot,
  getAmmunitionState,
  validateAttackAmmunition
} from "../packages/shared/src/index.ts";
import { handleResolveAttack, handleResolveAttackConfirmation } from "../apps/server/src/commands/attackCommands.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { inventoryEquipment, makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

const actorId = "inventory-player";
const socket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(socket, { id: actorId, role: "player", name: "Inventory tester", roomCode: "INV26" });

function setupBowRoom(quantity = 1) {
  const attacker = makeTestCombatant({
    id: "archer", name: "Arquero", controlledBy: { type: "player", participantId: actorId },
    abilityScores: { strength: 10, dexterity: 18, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    ...inventoryEquipment("longbow", { extraItems: [{ itemId: "arrow-stack", catalogId: "arrows_20", quantity }] }),
    position: { x: 0, y: 0, zFeet: 0 }
  });
  const target = makeTestCombatant({
    id: "target", name: "Objetivo", type: "enemy", controlledBy: { type: "gm" },
    ...inventoryEquipment("club"),
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
    position: { x: 4, y: 0, zFeet: 0 }
  });
  const room = makeTestRoom({
    code: "INV26", combatants: [attacker, target], turnOrder: [attacker.id, target.id],
    currentTurn: { ...makeTestRoom().currentTurn, combatantId: attacker.id, attackMode: "standard" }
  });
  return { room, attacker, target };
}

test("un disparo AUTO consume exactamente una flecha y el stock cero bloquea el siguiente", () => {
  const { room, attacker } = setupBowRoom(1);
  const rolledSides = [];
  handleResolveAttack(room, {
    type: "resolve-attack", roomCode: room.code, actorId, attackerId: attacker.id, targetId: "target",
    d20Roll: null, damage: null, isAutoRoll: true
  }, { diceRoller: (sides) => { rolledSides.push(sides); return sides === 20 ? 10 : 4; } });

  assert.deepEqual(rolledSides, [20, 8]);
  assert.equal(attacker.inventory.find((item) => item.itemId === "arrow-stack").quantity, 0);
  assert.equal(getAmmunitionState(attacker).availableQuantity, 0);
  assert.equal(validateAttackAmmunition(attacker).ok, false);

  room.currentTurn.usedStandardAction = false;
  room.currentTurn.attacksMade = 0;
  room.currentTurn.attackMode = "standard";
  const before = structuredClone(room);
  assert.throws(() => handleResolveAttack(room, {
    type: "resolve-attack", roomCode: room.code, actorId, attackerId: attacker.id, targetId: "target",
    d20Roll: 10, damage: 4
  }), /munición|municion|proyectil/i);
  assert.deepEqual(room, before, "el preflight fallido no debe consumir acciones, HP ni inventario");
});

test("confirmar un crítico no vuelve a consumir munición", () => {
  const { room, attacker } = setupBowRoom(2);
  handleResolveAttack(room, {
    type: "resolve-attack", roomCode: room.code, actorId, attackerId: attacker.id, targetId: "target",
    d20Roll: 20, damage: 4
  });
  assert.equal(attacker.inventory.find((item) => item.itemId === "arrow-stack").quantity, 1);
  assert.ok(room.activeAttackThreat);
  assert.equal(room.activeAttackThreat.normalDamageBundle.total, 4);
  handleResolveAttackConfirmation(room, {
    type: "resolve-attack-confirmation", roomCode: room.code, actorId,
    d20Roll: 1, damage: null
  });
  assert.equal(attacker.inventory.find((item) => item.itemId === "arrow-stack").quantity, 1);
});

test("alterar ranuras inmutables recalcula ataque, CA y velocidad sin caches huérfanos", () => {
  const combatant = makeTestCombatant({
    abilityScores: { strength: 10, dexterity: 18, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    ...inventoryEquipment("longbow", { armorCatalogId: "chainmail", extraItems: [{ catalogId: "arrows_20", quantity: 20 }] }),
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 }
  });
  const room = makeTestRoom({ combatants: [combatant] });
  const equipped = createCombatRulesSnapshot(room);
  assert.equal(Rules.totalAttackBonus(equipped, combatant).total, combatant.baseAttackBonus + 4);
  assert.equal(Rules.totalArmorClass(equipped, combatant).total, 17);
  assert.equal(Rules.totalSpeedFeet(equipped, combatant), 20);

  const unequipped = {
    ...combatant,
    equipmentSlots: { ...combatant.equipmentSlots, mainHandItemId: null, armorItemId: null }
  };
  room.combatants = [unequipped];
  const projected = createCombatRulesSnapshot(room);
  assert.equal(Rules.totalAttackBonus(projected, unequipped).total, unequipped.baseAttackBonus);
  assert.equal(Rules.totalArmorClass(projected, unequipped).total, 14);
  assert.equal(Rules.totalSpeedFeet(projected, unequipped), 30);
  assert.equal("weapon" in unequipped, false);
  assert.equal("armorClassBreakdown" in unequipped, false);
  assert.equal("threatProfile" in unequipped, false);
});
