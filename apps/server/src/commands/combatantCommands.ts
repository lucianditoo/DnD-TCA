import { createCatalogCombatant, createCombatantFromTemplate, createCombatantSnapshotFromProfile, cryptoId, demoAbilities, createDemoCombatant, gameCatalog, makeLog, type ClientCommand, type CombatRoom } from "@dnd-tactical/shared";
import { requireGM } from "../auth/control.js";
import { placeCombatantInFreeCell, formatCell } from "../room/roomState.js";
import { broadcast, findParticipant } from "../room/roomStore.js";

export function handleAddDemoCombatant(room: CombatRoom, command: Extract<ClientCommand, { type: "add-demo-combatant" }>): void {
  if (room.phase !== "preparation") throw new Error("Solo se pueden agregar combatientes durante la preparacion.");
  if (command.variant === "enemy") requireGM(command.actorId);
  const participant = findParticipant(command.actorId);
  if (!participant) throw new Error("Participante no encontrado.");
  const baseName = command.variant === "enemy" ? "Canocrock" : command.variant === "cedrick" ? "Cedrick" : command.variant === "ranger" ? "Elaen" : "Bane";
  const count = room.combatants.filter((combatant) => combatant.name.startsWith(baseName)).length + 1;
  const combatant = createDemoCombatant(command.variant, count, participant.role === "gm" ? { type: "gm" } : { type: "player", participantId: participant.id });
  placeCombatantInFreeCell(room, combatant);
  room.combatants.push(combatant);
  room.log.unshift(makeLog("system", combatant.name + " entra al combate en " + formatCell(combatant.position) + "."));
  broadcast(room);
}

export function handleAddCatalogCombatant(room: CombatRoom, command: Extract<ClientCommand, { type: "add-catalog-combatant" }>): void {
  if (room.phase !== "preparation") throw new Error("Solo se pueden agregar combatientes durante la preparacion.");
  if (command.category === "enemies") requireGM(command.actorId);
  const participant = findParticipant(command.actorId);
  if (!participant) throw new Error("Participante no encontrado.");
  const templates = gameCatalog.creatures[command.category];
  const template = templates.find((item) => item.id === command.templateId);
  if (!template) throw new Error("Plantilla no encontrada.");
  const count = room.combatants.filter((combatant) => combatant.name === template.name || combatant.name.startsWith(template.name + " ")).length + 1;
  const combatant = createCatalogCombatant(command.templateId, command.category, count, participant.role === "gm" ? { type: "gm" } : { type: "player", participantId: participant.id });
  placeCombatantInFreeCell(room, combatant);
  room.combatants.push(combatant);
  room.log.unshift(makeLog("system", combatant.name + " entra al combate desde catalogo en " + formatCell(combatant.position) + "."));
  broadcast(room);
}

export function handleAddProfileCombatant(room: CombatRoom, command: Extract<ClientCommand, { type: "add-profile-combatant" }>): void {
  if (room.phase !== "preparation") throw new Error("Solo se pueden agregar combatientes durante la preparacion.");
  if (command.profile.type === "enemy") requireGM(command.actorId);
  const participant = findParticipant(command.actorId);
  if (!participant) throw new Error("Participante no encontrado.");
  if (participant.role !== "gm" && command.profile.type !== "player") throw new Error("Los jugadores solo pueden agregar heroes propios.");
  const snapshotInput = {
    ...command.profile,
    controller: command.profile.type === "enemy" ? "gm" as const : "player" as const,
    hpMax: Math.max(1, Number(command.profile.hpMax) || 1),
    baseAttackBonus: Number(command.profile.baseAttackBonus) || 0,
    baseSpeedFeet: Math.max(0, Number(command.profile.baseSpeedFeet) || 30)
  };
  const count = room.combatants.filter((combatant) => combatant.name === snapshotInput.name || combatant.name.startsWith(snapshotInput.name + " ")).length + 1;
  const combatant = createCombatantSnapshotFromProfile(snapshotInput, {
    index: count,
    controlledBy: participant.role === "gm" ? { type: "gm" } : { type: "player", participantId: participant.id },
    abilitiesCatalog: demoAbilities,
    idFactory: cryptoId
  });
  placeCombatantInFreeCell(room, combatant);
  room.combatants.push(combatant);
  room.log.unshift(makeLog("system", combatant.name + " entra al combate desde perfil guardado en " + formatCell(combatant.position) + "."));
  broadcast(room);
}
