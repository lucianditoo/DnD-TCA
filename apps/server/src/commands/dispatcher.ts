import type { WebSocket } from "ws";
import type { ClientCommand } from "@dnd-tactical/shared";
import { handleResolveAttack, handleResolveOpportunityAttack, handleResolveAttackConfirmation, handleCancelAttackThreat } from "./attackCommands.js";
import { handleResolveAbilityAttack, handleRollStabilization, handleUseAbility, handleCastSpell } from "./abilityCommands.js";
import { handleAddCatalogCombatant, handleAddDemoCombatant, handleAddProfileCombatant } from "./combatantCommands.js";
import { handleGmAddLog, handleGmApplyEffect, handleGmApplyEnvironmentalHazard, handleGmRemoveEffect, handleGmClearOpportunities, handleGmForceOutcome, handleGmMoveCombatant, handleGmSetHp, handleGmSetStatus, handleHealCombatant } from "./gmCommands.js";
import { handleEndTurn, handleSetInitiative, handleSortInitiative } from "./initiativeCommands.js";
import { handleMoveCombatant } from "./movementCommands.js";
import { handleCreateRoom, handleJoinRoom } from "./roomCommands.js";
import { handleChooseAidBonus, handleUseTacticalAction, handleDeclareAttackMode, handleCancelAttackMode, handleResolveSavingThrow, handleDeclareDodgeTarget, handleResumeCoupDeGrace } from "./tacticalCommands.js";
import { handleResolveGrappleEscape, handleResolveSpecialManeuver, type ManeuverDiceSource } from "./specialManeuverCommands.js";
import { handleEquipItem, handleUnequipItem } from "./equipmentCommands.js";
import { ensureLegacyRoomShape } from "../room/roomState.js";
import { rooms, send } from "../room/roomStore.js";
import { validateClientCommand } from "../validation/validateClientCommand.js";
import { isDemoRoom } from "../demo/sessionStore.js";

export interface InternalExecutionContext {
  readonly source: "demo-runner";
  readonly diceRoller?: (sides: number) => number;
  readonly maneuverDiceSource?: ManeuverDiceSource;
}

function dispatchCommandCore(
  socket: WebSocket | null,
  command: ClientCommand,
  context?: InternalExecutionContext
): void {
  if (command.type === "create-room") {
    if (!socket) throw new Error("create-room requiere socket activo.");
    handleCreateRoom(socket, command);
    return;
  }
  if (command.type === "join-room") {
    if (!socket) throw new Error("join-room requiere socket activo.");
    handleJoinRoom(socket, command);
    return;
  }

  const room = rooms.get(command.roomCode.toUpperCase());
  if (!room) {
    if (context?.source === "demo-runner") {
      throw new Error("Sala de demostracion no encontrada.");
    }
    if (socket) send(socket, { type: "error", message: "Sala no encontrada." });
    return;
  }
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
    case "resolve-attack": handleResolveAttack(room, command, { diceRoller: context?.diceRoller }); return;
    case "resolve-attack-confirmation": handleResolveAttackConfirmation(room, command, { diceRoller: context?.diceRoller }); return;
    case "cancel-attack-threat": handleCancelAttackThreat(room, command); return;
    case "use-tactical-action": handleUseTacticalAction(room, command); return;
    case "resume-coup-de-grace": handleResumeCoupDeGrace(room, command); return;
    case "choose-aid-bonus": handleChooseAidBonus(room, command); return;
    case "declare-attack-mode": handleDeclareAttackMode(room, command); return;
    case "cancel-attack-mode": handleCancelAttackMode(room, command); return;
    case "resolve-saving-throw": handleResolveSavingThrow(room, command); return;
    case "declare-dodge-target": handleDeclareDodgeTarget(room, command); return;
    case "use-ability": handleUseAbility(room, command); return;
    case "cast-spell": handleCastSpell(room, command, { diceRoller: context?.diceRoller }); return;
    case "resolve-ability-attack": handleResolveAbilityAttack(room, command); return;
    case "roll-stabilization": handleRollStabilization(room, command); return;
    case "resolve-opportunity-attack": handleResolveOpportunityAttack(room, command, { diceRoller: context?.diceRoller }); return;
    case "resolve-special-maneuver": handleResolveSpecialManeuver(room, command, context?.maneuverDiceSource); return;
    case "resolve-grapple-escape": handleResolveGrappleEscape(room, command, context?.maneuverDiceSource); return;
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
    case "gm-remove-effect": handleGmRemoveEffect(room, command); return;
    case "gm-force-outcome": handleGmForceOutcome(room, command); return;
    case "end-turn": handleEndTurn(room, command); return;
  }
}

export function dispatchCommand(socket: WebSocket, command: ClientCommand): void {
  if (command.type === "create-room") {
    dispatchCommandCore(socket, command);
    return;
  }
  if (command.type === "join-room") {
    if (isDemoRoom(command.roomCode)) {
      throw new Error("No se permite unirse manualmente a una sala de demostracion.");
    }
    dispatchCommandCore(socket, command);
    return;
  }
  if (isDemoRoom(command.roomCode)) {
    throw new Error("Las salas de demostracion son de solo lectura y no admiten comandos manuales de combate.");
  }
  dispatchCommandCore(socket, command);
}

export function dispatchInternalDemoCommand(
  socket: WebSocket | null,
  rawCommand: unknown,
  context: InternalExecutionContext
): void {
  const validation = validateClientCommand(rawCommand);
  if (!validation.success) {
    throw new Error(`Error de contrato en guion de demo: ${validation.error}`);
  }
  dispatchCommandCore(socket, validation.data, context);
}
