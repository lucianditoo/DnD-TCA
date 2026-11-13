import { currentCombatant, type ClientCommand, type CombatRoom } from "@dnd-tactical/shared";
import { findCombatant } from "../room/roomState.js";
import { findParticipant } from "../room/roomStore.js";
import { requireCombatantControl, requireGM, requireInitiativeControl, requireTurnControl } from "./control.js";

export type RoomCommand = Exclude<ClientCommand, { type: "create-room" | "join-room" }>;
type PolicyMap = {
  readonly [K in RoomCommand["type"]]: (room: CombatRoom, command: Extract<RoomCommand, { type: K }>) => void;
};

const gm = (_room: CombatRoom, command: RoomCommand): void => requireGM(command.actorId);
const owned = (room: CombatRoom, command: { actorId: string; combatantId: string }): void =>
  requireCombatantControl(command.actorId, findCombatant(room, command.combatantId));
const attacker = (room: CombatRoom, command: { actorId: string; attackerId: string }): void =>
  requireCombatantControl(command.actorId, findCombatant(room, command.attackerId));
const caster = (room: CombatRoom, command: { actorId: string; casterId: string }): void =>
  requireCombatantControl(command.actorId, findCombatant(room, command.casterId));
const threatOwner = (room: CombatRoom, command: RoomCommand): void => {
  if (!room.activeAttackThreat) throw new Error("No hay una amenaza de critico activa.");
  requireCombatantControl(command.actorId, findCombatant(room, room.activeAttackThreat.attackerId));
};

// Every new room command requires an explicit policy at compile time. Resolve
// reactive actors from server state, never from a client-supplied actor/target.
// Turn, phase, action economy and combat legality remain in their existing layers.
export const commandAuthorizationPolicies: PolicyMap = Object.freeze({
  "add-demo-combatant": (_room, command) => {
    if (command.variant === "enemy") requireGM(command.actorId);
  },
  "add-catalog-combatant": (_room, command) => {
    if (command.category === "enemies") requireGM(command.actorId);
  },
  "add-profile-combatant": (_room, command) => {
    if (command.profile.type !== "player") requireGM(command.actorId);
  },
  "set-initiative": (room, command) => requireInitiativeControl(command.actorId, findCombatant(room, command.combatantId)),
  "sort-initiative": gm,
  "move-combatant": owned,
  "resolve-attack": attacker,
  "resolve-attack-confirmation": threatOwner,
  "cancel-attack-threat": threatOwner,
  "use-tactical-action": owned,
  "resume-coup-de-grace": owned,
  "choose-aid-bonus": owned,
  "declare-attack-mode": owned,
  "cancel-attack-mode": owned,
  "resolve-saving-throw": (room, command) => {
    const target = findCombatant(room, command.targetId);
    if (findParticipant(command.actorId)?.role !== "gm") requireCombatantControl(command.actorId, target);
  },
  "declare-dodge-target": owned,
  "use-ability": caster,
  "cast-spell": caster,
  "resolve-ability-attack": caster,
  "roll-stabilization": owned,
  "resolve-opportunity-attack": (room, command) => {
    const opportunity = room.pendingOpportunityAttacks.find(item => item.id === command.opportunityId);
    if (!opportunity) throw new Error("Ataque de oportunidad no encontrado.");
    requireTurnControl(command.actorId, findCombatant(room, opportunity.attackerId));
  },
  "resolve-special-maneuver": (room, command) =>
    requireCombatantControl(command.actorId, findCombatant(room, command.maneuver.attackerId)),
  "resolve-grapple-escape": owned,
  "equip-item": owned,
  "unequip-item": owned,
  "heal-combatant": gm,
  "gm-move-combatant": gm,
  "gm-set-hp": gm,
  "gm-set-status": gm,
  "gm-clear-opportunities": gm,
  "gm-add-log": gm,
  "gm-apply-effect": gm,
  "gm-apply-environmental-hazard": gm,
  "gm-remove-effect": gm,
  "gm-force-outcome": gm,
  "update-board": gm,
  "end-turn": (room, command) => {
    const outgoing = currentCombatant(room);
    if (outgoing) requireTurnControl(command.actorId, outgoing);
  }
} satisfies PolicyMap);

/** Called only after socket/session identity validation, before handler effects. */
export function authorizeRoomCommand(room: CombatRoom, command: RoomCommand): void {
  const participant = findParticipant(command.actorId);
  if (!participant || participant.roomCode !== room.code || command.roomCode.toUpperCase() !== room.code) {
    throw new Error("El participante no pertenece a esta sala.");
  }
  if (!Object.hasOwn(commandAuthorizationPolicies, command.type)) {
    throw new Error("El comando no tiene una politica de autorizacion.");
  }
  // The mapped type checks each entry against its discriminated command above;
  // this local widening preserves that correlation when indexing the union.
  const policy = commandAuthorizationPolicies[command.type] as (room: CombatRoom, command: RoomCommand) => void;
  policy(room, command);
}
