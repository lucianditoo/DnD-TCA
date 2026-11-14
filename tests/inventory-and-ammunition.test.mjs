import test from "node:test";
import assert from "node:assert/strict";
import {
  Rules,
  createCombatRulesSnapshot,
  EffectManager,
  effectsTickListener,
  projectWeaponDamage,
  getAmmunitionState,
  validateAttackAmmunition
} from "../packages/shared/src/index.ts";
import { handleResolveAttack, handleResolveAttackConfirmation, handleResolveOpportunityAttack } from "../apps/server/src/commands/attackCommands.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { inventoryEquipment, makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

const actorId = "inventory-player";
const socket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(socket, { id: actorId, role: "player", name: "Inventory tester", roomCode: "INV26" });

test("fatiga modifica el daño automático con arma a dos manos, sin tocar el daño manual", () => {
  for (const [fatigued, manualDamage, expected] of [[true, null, 5], [false, null, 7], [true, 9, 9]]) {
    const { room, attacker, target } = setupBowRoom();
    Object.assign(attacker, inventoryEquipment("greatsword"));
    attacker.abilityScores.strength = 14;
    target.position.x = 1;
    if (fatigued) room.effectInstances.push({
      instanceId: "fatigue", effectId: "srd_fatigued", source: { type: "system" },
      targets: [attacker.id], appliedAtEvent: { type: "SystemInjected", round: 1 }
    });
    const hpBefore = target.hpCurrent;
    handleResolveAttack(room, {
      type: "resolve-attack", roomCode: room.code, actorId, attackerId: attacker.id, targetId: target.id,
      d20Roll: manualDamage === null ? null : 15, damage: manualDamage, isAutoRoll: manualDamage === null
    }, { diceRoller: (sides) => sides === 20 ? 15 : 2 });
    assert.equal(hpBefore - target.hpCurrent, expected);
    assert.equal(attacker.abilityScores.strength, 14);
  }
});

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

test("mejora temporal pertenece al portador y arma concretos y no se acumula", () => {
  const { room, attacker, target } = setupBowRoom();
  Object.assign(attacker, inventoryEquipment("greatsword"));
  Object.assign(target, inventoryEquipment("greatsword"));
  const itemId = attacker.equipmentSlots.mainHandItemId;
  assert.equal(target.equipmentSlots.mainHandItemId, itemId);
  attacker.inventory.push({ itemId: "second", catalogId: "greatsword" });
  const ref = { combatantId: attacker.id, itemId };
  const instance = {
    instanceId: "first", effectId: "srd_magic_weapon", source: { type: "system" },
    targetItem: ref, appliedAtEvent: { type: "SystemInjected", round: 1 },
    duration: { type: "until_turn", anchorCombatantId: attacker.id, phase: "end", appliedAtSequence: 0 },
  };
  assert.throws(() => EffectManager.add(room, { ...instance, duration: undefined }));
  assert.throws(() => EffectManager.add(room, { ...instance, targets: [target.id] }));
  assert.throws(() => EffectManager.add(room, { ...instance, targetItem: { ...ref, itemId: "missing" } }));
  assert.deepEqual(room.effectInstances, []);
  let enhanced = EffectManager.add(room, instance);
  enhanced = EffectManager.add(enhanced, { ...instance, instanceId: "second", duration: { ...instance.duration, appliedAtSequence: 1 } });
  const snapshot = createCombatRulesSnapshot(enhanced);
  ref.itemId = "changed";
  assert.equal(JSON.parse(JSON.stringify(snapshot)).effectInstances[0].targetItem.itemId, itemId);
  assert.equal(projectWeaponDamage(snapshot, attacker).enhancement, 1);
  assert.equal(projectWeaponDamage(snapshot, target).enhancement, 0);
  const otherWeapon = { ...attacker, equipmentSlots: { ...attacker.equipmentSlots, mainHandItemId: "second" } };
  assert.equal(projectWeaponDamage(snapshot, otherWeapon).enhancement, 0);
  const turnEnd = { type: "TurnEnded", combatantId: attacker.id, round: 1, sequence: 1 };
  enhanced = effectsTickListener(enhanced, turnEnd);
  assert.deepEqual(enhanced.effectInstances.map(effect => effect.instanceId), ["second"]);
  assert.equal(projectWeaponDamage(createCombatRulesSnapshot(enhanced), attacker).enhancement, 1);
  enhanced = effectsTickListener(enhanced, { ...turnEnd, sequence: 2, round: 2 });
  assert.equal(projectWeaponDamage(createCombatRulesSnapshot(enhanced), attacker).enhancement, 0);
});

test("un crítico de AdO conserva la mejora y el daño efectivo capturados aunque se retiren los efectos", () => {
  const { room, attacker, target } = setupBowRoom();
  Object.assign(attacker, inventoryEquipment("greatsword"));
  attacker.abilityScores.strength = 14;
  target.position.x = 1;
  room.effectInstances.push({
    instanceId: "fatigue", effectId: "srd_fatigued", source: { type: "system" },
    targets: [attacker.id], appliedAtEvent: { type: "SystemInjected", round: 1 }
  });
  Object.assign(room, EffectManager.add(room, {
    instanceId: "weapon", effectId: "srd_magic_weapon", source: { type: "system" },
    targetItem: { combatantId: attacker.id, itemId: attacker.equipmentSlots.mainHandItemId },
    appliedAtEvent: { type: "SystemInjected", round: 1 },
    duration: { type: "until_turn", anchorCombatantId: attacker.id, phase: "end", appliedAtSequence: 0 },
  }));
  room.pendingOpportunityAttacks.push({
    id: "reaction", attackerId: attacker.id, targetId: target.id,
    origin: { ...target.position }, destination: { x: 2, y: 0, zFeet: 0 },
    reason: "reacción de prueba", createdAt: "2026-01-01T00:00:00Z"
  });
  room.phase = "opportunity-resolution";
  const hpBefore = target.hpCurrent;
  handleResolveOpportunityAttack(room, {
    type: "resolve-opportunity-attack", roomCode: room.code, actorId,
    opportunityId: "reaction", d20Roll: null, damage: null, isAutoRoll: true
  }, { diceRoller: (sides) => sides === 20 ? 20 : 2 });
  assert.equal(room.activeAttackThreat.normalDamageBundle.total, 6);
  assert.equal(target.hpCurrent, hpBefore);
  room.effectInstances = [];
  handleResolveAttackConfirmation(room, {
    type: "resolve-attack-confirmation", roomCode: room.code, actorId, d20Roll: 20, damage: null
  });
  assert.equal(hpBefore - target.hpCurrent, 12);
  assert.equal(room.activeAttackThreat, null);
  assert.equal(room.pendingOpportunityAttacks.length, 0);
});

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
