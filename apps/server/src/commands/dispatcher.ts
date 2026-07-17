import type { WebSocket } from "ws";
import type { ClientCommand, CombatRoom } from "@dnd-tactical/shared";
import { handleResolveAttack, handleResolveOpportunityAttack, handleResolveAttackConfirmation, handleCancelAttackThreat } from "./attackCommands.js";
import { handleResolveAbilityAttack, handleRollStabilization, handleUseAbility, handleCastSpell } from "./abilityCommands.js";
import { handleAddCatalogCombatant, handleAddDemoCombatant, handleAddProfileCombatant } from "./combatantCommands.js";
import { handleGmAddLog, handleGmApplyEffect, handleGmApplyEnvironmentalHazard, handleGmClearOpportunities, handleGmForceOutcome, handleGmMoveCombatant, handleGmSetHp, handleGmSetStatus, handleHealCombatant } from "./gmCommands.js";
import { handleEndTurn, handleSetInitiative, handleSortInitiative } from "./initiativeCommands.js";
import { handleMoveCombatant } from "./movementCommands.js";
import { handleCreateRoom, handleJoinRoom } from "./roomCommands.js";
import { handleChooseAidBonus, handleUseTacticalAction, handleDeclareAttackMode, handleCancelAttackMode, handleResolveSavingThrow, handleDeclareDodgeTarget } from "./tacticalCommands.js";
import { handleResolveGrappleEscape, handleResolveSpecialManeuver } from "./specialManeuverCommands.js";
import { handleEquipItem, handleUnequipItem } from "./equipmentCommands.js";
import { ensureLegacyRoomShape } from "../room/roomState.js";
import { rooms, send } from "../room/roomStore.js";


export function dispatchCommand(socket: WebSocket, command: ClientCommand): void {
  if (command.type === "create-room") { handleCreateRoom(socket, command); return; }
  if (command.type === "join-room") { handleJoinRoom(socket, command); return; }

  const room = rooms.get(command.roomCode.toUpperCase());
  if (!room) { send(socket, { type: "error", message: "Sala no encontrada." }); return; }
  ensureLegacyRoomShape(room);
  
  if (room.phase === "finished" && !command.type.startsWith("gm-")) {
    throw new Error("El combate ya termino. Revisa la pantalla de resultados.");
  }
  
  if (room.phase === "opportunity-resolution") {
    if (command.type !== "resolve-opportunity-attack" && !command.type.startsWith("gm-")) {
      throw new Error("Hay ataques de oportunidad pendientes. Resuelvelos o limpialos como GM antes de continuar el combate.");
    }
  }

  if (room.phase === "critical-confirmation") {
    if (command.type !== "resolve-attack-confirmation" && command.type !== "cancel-attack-threat" && !command.type.startsWith("gm-")) {
      throw new Error("Hay una amenaza de critico pendiente. Resolvela antes de continuar.");
    }
  }

  switch (command.type) {
    case "add-demo-combatant": handleAddDemoCombatant(room, command); return;
    case "add-catalog-combatant": handleAddCatalogCombatant(room, command); return;
    case "add-profile-combatant": handleAddProfileCombatant(room, command); return;
    case "set-initiative": handleSetInitiative(room, command); return;
    case "sort-initiative": handleSortInitiative(room, command); return;
    case "move-combatant": handleMoveCombatant(room, command); return;
    case "resolve-attack": handleResolveAttack(room, command); return;
    case "resolve-attack-confirmation": handleResolveAttackConfirmation(room, command); return;
    case "cancel-attack-threat": handleCancelAttackThreat(room, command); return;
    case "use-tactical-action": handleUseTacticalAction(room, command); return;
    case "choose-aid-bonus": handleChooseAidBonus(room, command); return;
    case "declare-attack-mode": handleDeclareAttackMode(room, command); return;
    case "cancel-attack-mode": handleCancelAttackMode(room, command); return;
    case "resolve-saving-throw": handleResolveSavingThrow(room, command); return;
    case "declare-dodge-target": handleDeclareDodgeTarget(room, command); return;
    case "use-ability": handleUseAbility(room, command); return;
    case "cast-spell": handleCastSpell(room, command); return;
    case "resolve-ability-attack": handleResolveAbilityAttack(room, command); return;
    case "roll-stabilization": handleRollStabilization(room, command); return;
    case "resolve-opportunity-attack": handleResolveOpportunityAttack(room, command); return;
    case "resolve-special-maneuver": handleResolveSpecialManeuver(room, command); return;
    case "resolve-grapple-escape": handleResolveGrappleEscape(room, command); return;
    case "equip-item": handleEquipItem(room, command); return;
    case "unequip-item": handleUnequipItem(room, command); return;
    case "heal-combatant": handleHealCombatant(room, command); return;
    case "gm-move-combatant": handleGmMoveCombatant(room, command); return;
    case "gm-set-hp": handleGmSetHp(room, command); return;
    case "gm-set-status": handleGmSetStatus(room, command); return;
    case "gm-clear-opportunities": handleGmClearOpportunities(room, command); return;
    case "gm-add-log": handleGmAddLog(room, command); return;
    case "gm-apply-effect": handleGmApplyEffect(room, command); return;
    case "gm-apply-environmental-hazard": handleGmApplyEnvironmentalHazard(room, command); return;
    case "gm-force-outcome": handleGmForceOutcome(room, command); return;
    case "end-turn": handleEndTurn(room, command); return;
  }
}
