import { applyHealing, lifeStatus, lifeStatusLabel, makeLog, normalizeLifeStateAfterHpChange, type ClientCommand, type CombatRoom, EffectManager, isProductionEffectId, effectsCatalog, cryptoId, type EffectInstance, type EffectDefinition, type ProductionEffectId } from "@dnd-tactical/shared";
import { requireGM } from "../auth/control.js";
import { applyGMStatus } from "../gm/gmState.js";
import { checkCombatOutcome, findCombatant, formatCell, isCombatantInsideBoard, isCellOccupied, logStatusChange, syncEncounterPhase } from "../room/roomState.js";
import { broadcast } from "../room/roomStore.js";
import { commitSpatialTransition } from "../combat/spatialTransition.js";

export function handleHealCombatant(room: CombatRoom, command: Extract<ClientCommand, { type: "heal-combatant" }>): void {
  requireGM(command.actorId);
  const combatant = findCombatant(room, command.combatantId);
  const result = applyHealing(combatant, command.amount);
  combatant.stats.healingReceived += result.appliedHealing;
  room.log.unshift(makeLog("status", combatant.name + " recibe " + result.appliedHealing + " HP de curacion" + (command.source ? " (" + command.source + ")" : "") + ". HP: " + combatant.hpCurrent + "/" + combatant.hpMax + "."));
  logStatusChange(room, combatant, result.statusBefore, result.statusAfter);
  broadcast(room);
}

export function handleGmMoveCombatant(room: CombatRoom, command: Extract<ClientCommand, { type: "gm-move-combatant" }>): void {
  requireGM(command.actorId);
  const combatant = findCombatant(room, command.combatantId);
  if (!isCombatantInsideBoard(room, combatant, command.to)) throw new Error("La huella elegida esta fuera del tablero.");
  if (isCellOccupied(room, command.to, combatant.id)) throw new Error("Esa casilla esta ocupada.");
  commitSpatialTransition(room, combatant, command.to, "natural");
  room.log.unshift(makeLog("movement", "GM reposiciona a " + combatant.name + " en " + formatCell(command.to) + "."));
  broadcast(room);
}

export function handleGmSetHp(room: CombatRoom, command: Extract<ClientCommand, { type: "gm-set-hp" }>): void {
  requireGM(command.actorId);
  const combatant = findCombatant(room, command.combatantId);
  const before = lifeStatus(combatant);
  if (command.hpMax !== undefined) combatant.hpMax = Math.max(1, command.hpMax);
  combatant.hpCurrent = Math.max(-10, Math.min(command.hpCurrent, combatant.hpMax));
  if (combatant.hpCurrent >= 0 || combatant.hpCurrent <= -10) combatant.isStable = false;
  normalizeLifeStateAfterHpChange(combatant);
  room.log.unshift(makeLog("status", "GM ajusta HP de " + combatant.name + " a " + combatant.hpCurrent + "/" + combatant.hpMax + "."));
  logStatusChange(room, combatant, before, lifeStatus(combatant));
  checkCombatOutcome(room);
  broadcast(room);
}

export function handleGmSetStatus(room: CombatRoom, command: Extract<ClientCommand, { type: "gm-set-status" }>): void {
  requireGM(command.actorId);
  const combatant = findCombatant(room, command.combatantId);
  const before = lifeStatus(combatant);
  applyGMStatus(combatant, command.status);
  room.log.unshift(makeLog("status", "GM cambia estado de " + combatant.name + " a " + lifeStatusLabel(command.status) + "."));
  logStatusChange(room, combatant, before, lifeStatus(combatant));
  checkCombatOutcome(room);
  broadcast(room);
}

export function handleGmClearOpportunities(room: CombatRoom, command: Extract<ClientCommand, { type: "gm-clear-opportunities" }>): void {
  requireGM(command.actorId);
  const count = room.pendingOpportunityAttacks.length;
  room.pendingOpportunityAttacks = [];
  syncEncounterPhase(room);
  room.log.unshift(makeLog("opportunity", "GM limpia " + count + " ataque(s) de oportunidad pendiente(s)."));
  broadcast(room);
}

export function handleGmAddLog(room: CombatRoom, command: Extract<ClientCommand, { type: "gm-add-log" }>): void {
  requireGM(command.actorId);
  const message = command.message.trim();
  if (message) room.log.unshift(makeLog("system", "Nota GM: " + message));
  broadcast(room);
}

export function handleGmForceOutcome(room: CombatRoom, command: Extract<ClientCommand, { type: "gm-force-outcome" }>): void {
  requireGM(command.actorId);
  room.outcome = command.outcome;
  room.phase = command.outcome === "ongoing" ? "active" : "finished";
  room.completedAt = command.outcome === "ongoing" ? null : new Date().toISOString();
  if (command.outcome !== "ongoing") room.pendingOpportunityAttacks = [];
  room.log.unshift(makeLog("system", "GM fuerza resultado: " + command.outcome + "."));
  broadcast(room);
}

export function handleGmApplyEffect(room: CombatRoom, command: Extract<ClientCommand, { type: "gm-apply-effect" }>): void {
  requireGM(command.actorId);
  const target = findCombatant(room, command.targetId);
  
  if (!isProductionEffectId(command.effectId)) {
    throw new Error(`Validación de comando fallida: Efecto desconocido '${command.effectId}'.`);
  }
  
  const duration = command.durationPreset === "until_target_turn_end" ? {
    type: "until_turn" as const,
    anchorCombatantId: target.id,
    phase: "end" as const,
    appliedAtSequence: room.eventSequence
  } : undefined;

  const instance: EffectInstance<ProductionEffectId> = {
    instanceId: cryptoId("effect"),
    effectId: command.effectId,
    source: { type: "system" },
    targets: [target.id],
    appliedAtEvent: { type: "SystemInjected", round: room.round },
    ...(duration ? { duration } : {})
  };
  
  const nextRoom = EffectManager.add(room, instance);
  Object.assign(room, nextRoom);

  room.log.unshift(makeLog("status", "GM inyecta efecto " + command.effectId + " a " + target.name + "."));
  checkCombatOutcome(room);
  broadcast(room);
}

export function handleGmRemoveEffect(room: CombatRoom, command: Extract<ClientCommand, { type: "gm-remove-effect" }>): void {
  requireGM(command.actorId);

  const instance = room.effectInstances.find((effect) => effect.instanceId === command.instanceId);
  if (!instance) {
    throw new Error(`Validación de comando fallida: no existe un efecto activo con instanceId '${command.instanceId}'.`);
  }

  const definitionName = effectsCatalog[instance.effectId].name;
  const targetNames = (instance.targets ?? [])
    .map((id) => room.combatants.find((combatant) => combatant.id === id)?.name ?? id)
    .join(", ");
  const targetDescription = targetNames || (instance.targetCells ? instance.targetCells.length + " celda(s)" : "objetivo desconocido");

  const nextRoom = EffectManager.removeMany(room, [command.instanceId]);
  Object.assign(room, nextRoom);

  room.log.unshift(makeLog("status", "GM remueve el efecto " + definitionName + " de " + targetDescription + " (anulación administrativa)."));
  broadcast(room);
}

export function handleGmApplyEnvironmentalHazard(room: CombatRoom, command: Extract<ClientCommand, { type: "gm-apply-environmental-hazard" }>): void {
  requireGM(command.actorId);

  if (!isProductionEffectId(command.effectId)) {
    throw new Error(`Validación de comando fallida: Efecto desconocido '${command.effectId}'.`);
  }
  const definition: EffectDefinition = effectsCatalog[command.effectId];
  if (!definition.hazard) {
    throw new Error(`Validación de comando fallida: '${command.effectId}' no declara un bloque 'hazard' en el catálogo.`);
  }

  const instance: EffectInstance<ProductionEffectId> = {
    instanceId: cryptoId("effect"),
    effectId: command.effectId,
    source: { type: "environment" },
    targetCells: command.targetCells,
    appliedAtEvent: { type: "SystemInjected", round: room.round }
  };

  const nextRoom = EffectManager.add(room, instance);
  Object.assign(room, nextRoom);

  room.log.unshift(makeLog("status", "GM ancla el peligro ambiental " + command.effectId + " sobre " + command.targetCells.length + " celda(s)."));
  checkCombatOutcome(room);
  broadcast(room);
}
