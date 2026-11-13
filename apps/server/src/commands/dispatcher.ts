import { rollDice } from "../combat/diceRoller.js";
import type { WebSocket } from "ws";
import { createCombatRulesSnapshot, getEffectiveAbilityModifier, lifeStatus, makeLog, Rules, SpellsCatalog, type CombatRoom, type ClientCommand } from "@dnd-tactical/shared";
import { handleResolveAttack, handleResolveOpportunityAttack, handleResolveAttackConfirmation, handleCancelAttackThreat } from "./attackCommands.js";
import { handleResolveAbilityAttack, handleRollStabilization, handleUseAbility, handleCastSpell } from "./abilityCommands.js";
import { handleAddCatalogCombatant, handleAddDemoCombatant, handleAddProfileCombatant } from "./combatantCommands.js";
import { handleGmAddLog, handleGmApplyEffect, handleGmApplyEnvironmentalHazard, handleGmRemoveEffect, handleGmClearOpportunities, handleGmForceOutcome, handleGmMoveCombatant, handleGmSetHp, handleGmSetStatus, handleHealCombatant } from "./gmCommands.js";
import { handleEndTurn, handleSetInitiative, handleSortInitiative } from "./initiativeCommands.js";
import { handleMoveCombatant, resumeMovement } from "./movementCommands.js";
import { handleCreateRoom, handleJoinRoom, handleUpdateBoard } from "./roomCommands.js";
import { handleChooseAidBonus, handleUseTacticalAction, completeCharge, handleDeclareAttackMode, handleCancelAttackMode, handleResolveSavingThrow, handleDeclareDodgeTarget, handleResumeCoupDeGrace } from "./tacticalCommands.js";
import { handleResolveGrappleEscape, handleResolveSpecialManeuver, type ManeuverDiceSource } from "./specialManeuverCommands.js";
import { handleEquipItem, handleUnequipItem } from "./equipmentCommands.js";
import { broadcast, clients, rooms, send } from "../room/roomStore.js";
import { validateClientCommand } from "../validation/validateClientCommand.js";
import { getDemoSessionBySocket, isDemoRoom } from "../demo/sessionStore.js";

export interface InternalExecutionContext {
  readonly source: "demo-runner";
  readonly diceRoller?: (sides: number) => number;
  readonly maneuverDiceSource?: ManeuverDiceSource;
}

function dispatchCommandCore(
  socket: WebSocket | null,
  command: Exclude<ClientCommand, { type: "create-room" | "join-room" }>,
  context?: InternalExecutionContext
): void {
  const room = rooms.get(command.roomCode.toUpperCase());
  if (!room) {
    if (context?.source === "demo-runner") {
      throw new Error("Sala de demostracion no encontrada.");
    }
    if (socket) send(socket, { type: "error", message: "Sala no encontrada." });
    return;
  }

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

  const pending = room.pendingStationaryAction;
  const provokingActor = pending && room.combatants.find(actor => actor.id === room.currentTurn.combatantId);
  const hpBefore = provokingActor?.hpCurrent;
  executeCommand(room, command, context);
  if (pending && provokingActor && hpBefore !== undefined && provokingActor.hpCurrent < hpBefore &&
      (command.type === "resolve-opportunity-attack" || command.type === "resolve-attack-confirmation" || command.type === "cancel-attack-threat")) {
    pending.damageTaken.push(hpBefore - provokingActor.hpCurrent);
  }
  resumeStationaryAction(room, context);
  if (!room.activeAttackThreat && !room.pendingOpportunityAttacks.length) {
    const charge = resumeMovement(room);
    if (charge) completeCharge(room, charge);
  }
}

function executeCommand(room: CombatRoom, command: Exclude<ClientCommand, { type: "create-room" | "join-room" }>, context?: InternalExecutionContext): void {
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
    case "update-board": handleUpdateBoard(room, command); return;
    case "end-turn": handleEndTurn(room, command); return;
  }
}

function resumeStationaryAction(room: CombatRoom, context?: InternalExecutionContext): void {
  const pending = room.pendingStationaryAction;
  if (!pending || room.activeAttackThreat || room.pendingOpportunityAttacks.length) return;
  delete room.pendingStationaryAction;
  const { command, damageTaken } = pending;
  const combatantId = command.type === "cast-spell" ? command.casterId :
    command.type === "resolve-attack" ? command.attackerId : command.combatantId;
  const actor = room.combatants.find(combatant => combatant.id === combatantId);
  const control = actor?.controlledBy ?? (actor ? { type: actor.controller } : undefined);
  const canResume = control?.type === "gm" ? pending.actorRole === "gm" :
    control?.type === "player" && "participantId" in control && control.participantId === command.actorId;
  try {
    if (!canResume) throw new Error("El control de la accion interrumpida cambio.");
    if (!actor || !["active", "finished"].includes(room.phase) || room.currentTurn.combatantId !== actor.id) {
      throw new Error("La accion interrumpida ya no puede continuar.");
    }
    const snapshot = createCombatRulesSnapshot(room);
    const available = room.phase === "active" && Rules.evaluateActionAvailability(snapshot, actor).ok &&
      ["active", "disabled"].includes(lifeStatus(actor));
    if (command.type === "cast-spell") {
      const slot = actor.preparedSpells.find(slot => slot.slotId === command.slotId);
      if (!slot || slot.isExpended) throw new Error("El slot del lanzamiento interrumpido ya no esta disponible.");
      const spell = SpellsCatalog.require(slot.spellId);
      const modifier = getEffectiveAbilityModifier(snapshot, actor, "constitution") + (actor.skillRanks.concentration ?? 0);
      const roller = context?.diceRoller ?? rollDice;
      let lost = !available;
      for (const damage of damageTaken) {
        if (lost) break;
        const dc = 10 + damage + spell.level;
        const total = roller(20) + modifier;
        lost = total < dc;
        room.log.unshift(makeLog("skill", actor.name + " prueba Concentracion: " + total + " contra CD " + dc + "."));
      }
      if (lost) {
        actor.preparedSpells = actor.preparedSpells.map(item => item.slotId === slot.slotId ? { ...item, isExpended: true } : item);
        room.currentTurn.usedStandardAction = true;
        room.log.unshift(makeLog("attack", actor.name + " pierde el conjuro interrumpido."));
      } else {
        handleCastSpell(room, command, { resumed: true, diceRoller: roller });
      }
    } else if (!available) {
      throw new Error("El combatiente ya no puede completar la accion interrumpida.");
    } else if (command.type === "resolve-attack") {
      handleResolveAttack(room, command, { resumed: true, diceRoller: context?.diceRoller });
    } else {
      handleUseTacticalAction(room, command, true);
    }
  } catch (error) {
    room.log.unshift(makeLog("system", error instanceof Error ? error.message : "Se cancela la accion interrumpida."));
  }
  broadcast(room);
}

export function dispatchCommand(socket: WebSocket, command: ClientCommand, allowGmResume = false): void {
  if (command.type === "create-room") {
    handleCreateRoom(socket, command, allowGmResume);
    return;
  }
  if (command.type === "join-room") {
    if (isDemoRoom(command.roomCode)) {
      throw new Error("No se permite unirse manualmente a una sala de demostracion.");
    }
    handleJoinRoom(socket, command);
    return;
  }
  if (isDemoRoom(command.roomCode)) {
    throw new Error("Las salas de demostracion son de solo lectura y no admiten comandos manuales de combate.");
  }
  const participant = clients.get(socket);
  if (!participant || participant.id !== command.actorId || participant.roomCode !== command.roomCode.toUpperCase()) {
    throw new Error("La conexion no esta autorizada para este participante y sala.");
  }
  dispatchCommandCore(socket, { ...command, actorId: participant.id, roomCode: participant.roomCode });
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
  const command = validation.data;
  const session = socket && getDemoSessionBySocket(socket);
  if (
    !session || command.type === "create-room" || command.type === "join-room" ||
    command.roomCode !== session.roomCode || command.actorId !== session.participant.id
  ) {
    throw new Error("El comando interno no pertenece a la sesion de demostracion.");
  }
  dispatchCommandCore(socket, command, context);
}
