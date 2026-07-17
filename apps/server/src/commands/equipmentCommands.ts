import { EquipmentCatalog, canUseMoveAction, createCombatRulesSnapshot, makeLog, type ClientCommand, type CombatRoom, type EquipmentSlots } from "@dnd-tactical/shared";
import { requireCombatantControl } from "../auth/control.js";
import { ensureActiveTurn } from "../combat/turnManager.js";
import { findCombatant, syncEncounterPhase } from "../room/roomState.js";
import { broadcast } from "../room/roomStore.js";

type EquipmentCommandSlot = "mainHand" | "offHand" | "armor";

function slotKey(slot: EquipmentCommandSlot): keyof EquipmentSlots {
  if (slot === "mainHand") return "mainHandItemId";
  if (slot === "offHand") return "offHandItemId";
  return "armorItemId";
}

function validateCompatibility(room: CombatRoom, combatantId: string, itemId: string, slot: EquipmentCommandSlot): void {
  const combatant = findCombatant(room, combatantId);
  const inventoryItem = combatant.inventory.find((item) => item.itemId === itemId);
  if (!inventoryItem) throw new Error(`${combatant.name} no posee el objeto ${itemId}.`);
  const catalogItem = EquipmentCatalog.requireItem(inventoryItem.catalogId);
  if (catalogItem.kind === "weapon" && catalogItem.entry.isAmmunition) throw new Error("La munición no puede equiparse en una ranura activa.");
  if (slot === "mainHand" && catalogItem.kind !== "weapon") throw new Error("La mano principal solo admite armas.");
  if (slot === "offHand" && catalogItem.kind !== "weapon" && catalogItem.kind !== "shield") throw new Error("La mano secundaria solo admite armas o escudos.");
  if (slot === "armor" && catalogItem.kind !== "armor") throw new Error("La ranura de armadura solo admite armaduras.");
  if (slot === "mainHand" && catalogItem.kind === "weapon" && catalogItem.entry.handedness === "two-handed" && combatant.equipmentSlots.offHandItemId) {
    throw new Error("Debe liberar la mano secundaria antes de equipar un arma a dos manos.");
  }
  if (slot === "offHand") {
    const mainItem = combatant.inventory.find((item) => item.itemId === combatant.equipmentSlots.mainHandItemId);
    const mainWeapon = mainItem ? EquipmentCatalog.getWeapon(mainItem.catalogId) : undefined;
    if (mainWeapon?.handedness === "two-handed") throw new Error("La mano secundaria está ocupada por el arma a dos manos.");
  }
  const otherSlots = Object.entries(combatant.equipmentSlots).filter(([key]) => key !== slotKey(slot));
  if (otherSlots.some(([, equippedId]) => equippedId === itemId)) throw new Error("La misma instancia no puede ocupar dos ranuras.");
}

function consumeEquipmentChangeAction(room: CombatRoom, combatantId: string, slot: EquipmentCommandSlot): void {
  if (room.phase !== "active") return;
  if (slot === "armor") throw new Error("No se puede poner o quitar armadura durante un combate activo.");
  const combatant = findCombatant(room, combatantId);
  ensureActiveTurn(room, combatant.id);
  const availability = canUseMoveAction(createCombatRulesSnapshot(room), combatant);
  if (!availability.ok) throw new Error(availability.error);
  room.currentTurn.usedMoveAction = true;
}

export function handleEquipItem(room: CombatRoom, command: Extract<ClientCommand, { type: "equip-item" }>): void {
  const combatant = findCombatant(room, command.combatantId);
  requireCombatantControl(command.actorId, combatant);
  validateCompatibility(room, combatant.id, command.itemId, command.slot);
  consumeEquipmentChangeAction(room, combatant.id, command.slot);
  combatant.equipmentSlots = { ...combatant.equipmentSlots, [slotKey(command.slot)]: command.itemId };
  const item = combatant.inventory.find((candidate) => candidate.itemId === command.itemId)!;
  room.log.unshift(makeLog("system", `${combatant.name} equipa ${EquipmentCatalog.requireItem(item.catalogId).entry.name} en ${command.slot}.`));
  syncEncounterPhase(room);
  broadcast(room);
}

export function handleUnequipItem(room: CombatRoom, command: Extract<ClientCommand, { type: "unequip-item" }>): void {
  const combatant = findCombatant(room, command.combatantId);
  requireCombatantControl(command.actorId, combatant);
  const key = slotKey(command.slot);
  if (!combatant.equipmentSlots[key]) throw new Error(`La ranura ${command.slot} ya está vacía.`);
  consumeEquipmentChangeAction(room, combatant.id, command.slot);
  combatant.equipmentSlots = { ...combatant.equipmentSlots, [key]: null };
  room.log.unshift(makeLog("system", `${combatant.name} libera la ranura ${command.slot}.`));
  syncEncounterPhase(room);
  broadcast(room);
}
