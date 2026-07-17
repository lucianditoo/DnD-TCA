import crypto from "crypto";
import { currentCombatant, lifeStatus, makeLog, type ClientCommand, type CombatRoom, effectsTickListener, EffectManager } from "@dnd-tactical/shared";
import { requireGM, requireInitiativeControl, requireTurnControl } from "../auth/control.js";
import { expireStartOfTurnBuffs } from "../combat/buffRules.js";
import { advanceTurn, emptyTurn, emitCombatEvent } from "../combat/turnManager.js";
import { findCombatant } from "../room/roomState.js";
import { broadcast } from "../room/roomStore.js";

export function handleSetInitiative(room: CombatRoom, command: Extract<ClientCommand, { type: "set-initiative" }>): void {
  if (room.phase !== "preparation") throw new Error("La iniciativa se carga durante la preparacion.");
  const combatant = findCombatant(room, command.combatantId);
  requireInitiativeControl(command.actorId, combatant);
  combatant.initiative = command.initiative;
  room.log.unshift(makeLog("initiative", combatant.name + " registra iniciativa " + command.initiative + "."));
  broadcast(room);
}

export function handleSortInitiative(room: CombatRoom, command: Extract<ClientCommand, { type: "sort-initiative" }>): void {
  requireGM(command.actorId);
  if (room.phase !== "preparation") throw new Error("El combate ya fue iniciado.");
  const missingInitiative = room.combatants.find((combatant) => combatant.initiative === null && lifeStatus(combatant) !== "dead");
  if (missingInitiative) throw new Error("Falta iniciativa de " + missingInitiative.name + ".");
  const hasPlayers = room.combatants.some((combatant) => combatant.type === "player" && lifeStatus(combatant) !== "dead");
  const hasEnemies = room.combatants.some((combatant) => combatant.type === "enemy" && lifeStatus(combatant) !== "dead");
  if (!hasPlayers || !hasEnemies) throw new Error("Agrega al menos un heroe y un enemigo antes de iniciar el combate.");
  room.turnOrder = [...room.combatants]
    .filter((combatant) => combatant.initiative !== null && lifeStatus(combatant) !== "dead")
    .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
    .map((combatant) => combatant.id);
  room.activeTurnIndex = 0;
  const active = currentCombatant(room);
  room.phase = "active";
  room.outcome = "ongoing";
  room.currentTurn = emptyTurn(active?.id ?? null);

  // Inyectar Flat-Footed a todos los combatientes activos
  const flatFootedInstances = room.turnOrder.map((id) => ({
    instanceId: crypto.randomUUID(),
    effectId: "srd_flat_footed" as const,
    source: { type: "system" as const },
    targets: [id],
    appliedAtEvent: { type: "CombatStarted" as const, round: room.round },
    duration: {
      type: "until_turn" as const,
      anchorCombatantId: id,
      phase: "start" as const,
      appliedAtSequence: room.eventSequence,
    },
  }));
  let updatedRoom = room;
  for (const instance of flatFootedInstances) {
    updatedRoom = EffectManager.add(updatedRoom, instance) as CombatRoom;
  }
  Object.assign(room, updatedRoom);

  if (active) {
    expireStartOfTurnBuffs(room, active);
    const afterStart = emitCombatEvent(
      room,
      { type: "TurnStarted", combatantId: active.id, round: room.round },
      [effectsTickListener]
    );
    Object.assign(room, afterStart);
  }

  room.log.unshift(makeLog("turn", active ? "Combate en curso. Ronda " + room.round + ". Turno de " + active.name + "." : "No hay iniciativas cargadas."));
  broadcast(room);
}

export function handleEndTurn(room: CombatRoom, command: Extract<ClientCommand, { type: "end-turn" }>): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  if (room.turnOrder.length === 0) throw new Error("Primero hay que ordenar iniciativas.");
  const outgoing = currentCombatant(room);
  if (outgoing) requireTurnControl(command.actorId, outgoing);
  advanceTurn(room);
  const active = currentCombatant(room);
  room.currentTurn = emptyTurn(active?.id ?? null);
  room.log.unshift(makeLog("turn", (outgoing?.name ?? "Combatiente") + " termina turno. Ahora actua " + (active?.name ?? "nadie") + ". Ronda " + room.round + "."));
  broadcast(room);
}
