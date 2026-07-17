import type { Combatant } from "@dnd-tactical/shared";
import { findParticipant } from "../room/roomStore.js";

export function requireGM(actorId: string): void {
  const participant = findParticipant(actorId);
  if (!participant || participant.role !== "gm") throw new Error("Solo el GM puede usar este control.");
}

export function requireCombatantControl(actorId: string, combatant: Combatant): void {
  const participant = findParticipant(actorId);
  if (!participant) throw new Error("Participante no encontrado.");
  const control = combatant.controlledBy ?? { type: combatant.controller };
  if (participant.role === "gm") {
    if (control.type === "gm") return;
    throw new Error("El GM no puede controlar heroes de otros jugadores con acciones normales.");
  }
  if (control.type === "player" && control.participantId === actorId) return;
  if (combatant.type === "enemy") throw new Error("Los jugadores no pueden controlar enemigos.");
  throw new Error("Los jugadores solo pueden controlar sus propios heroes.");
}

export function canControlCombatant(actorId: string, combatant: Combatant): boolean {
  const participant = findParticipant(actorId);
  if (!participant) return false;
  const control = combatant.controlledBy ?? { type: combatant.controller };
  if (participant.role === "gm") return control.type === "gm";
  return control.type === "player" && control.participantId === actorId;
}

export function requireInitiativeControl(actorId: string, combatant: Combatant): void {
  const participant = findParticipant(actorId);
  if (!participant) throw new Error("Participante no encontrado.");
  if (participant.role === "gm") return;
  if (canControlCombatant(actorId, combatant)) return;
  throw new Error("Los jugadores solo pueden modificar iniciativa de sus propios heroes.");
}

export function requireTurnControl(actorId: string, combatant: Combatant): void {
  const participant = findParticipant(actorId);
  if (!participant) throw new Error("Participante no encontrado.");
  if (participant.role === "gm") return;
  if (canControlCombatant(actorId, combatant)) return;
  throw new Error("Los jugadores solo pueden terminar el turno de sus propios heroes.");
}
