import abilitiesData from "./data/abilities.json" with { type: "json" };
import creaturesData from "./data/creatures.json" with { type: "json" };
import { createCombatantSnapshotFromProfile, createEmptyCombatantStats } from "./combatSnapshot.js";
import type { Ability, Board, CombatRoom, Combatant, CombatantControl, CombatantStats, CreatureCatalog, CreatureTemplate, GameCatalog } from "./types.js";

export const demoBoard: Board = { width: 16, height: 8, cellSizeFeet: 5 };

export const demoAbilities = abilitiesData.abilities as Ability[];
export const creatureCatalog = creaturesData as CreatureCatalog;
export const gameCatalog: GameCatalog = { creatures: creatureCatalog, abilities: demoAbilities };

export function createEmptyRoom(code: string): CombatRoom {
  return {
    code,
    board: demoBoard,
    combatants: [],
    turnOrder: [],
    activeTurnIndex: 0,
    round: 1,
    phase: "preparation",
    outcome: "ongoing",
    completedAt: null,
    currentTurn: { combatantId: null, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false },
    pendingOpportunityAttacks: [],
    log: [{ id: cryptoId("log"), kind: "system", message: "Sala " + code + " creada. Preparacion: agreguen combatientes, posiciones e iniciativas.", createdAt: new Date().toISOString() }],
    activeAttackThreat: null,
    effectInstances: [],
    eventSequence: 0
  };
}

export function createDemoCombatant(variant: "hero" | "enemy" | "cedrick" | "ranger", index: number, controlledBy?: CombatantControl): Combatant {
  const templateId = variant === "cedrick" ? "cedrick" : variant === "ranger" ? "elaen" : variant === "enemy" ? "canocrock" : "bane";
  return createCatalogCombatant(templateId, variant === "enemy" ? "enemies" : "heroes", index, controlledBy);
}

export function createCatalogCombatant(templateId: string, category: "heroes" | "enemies", index: number, controlledBy?: CombatantControl): Combatant {
  const template = creatureCatalog[category].find((item) => item.id === templateId);
  if (!template) throw new Error("No existe una plantilla con id " + templateId + ".");
  return createCombatantFromTemplate(template, index, controlledBy);
}

export function createCombatantFromTemplate(template: CreatureTemplate, index: number, controlledBy?: CombatantControl): Combatant {
  return createCombatantSnapshotFromProfile(template, { index, controlledBy: controlledBy ?? { type: template.controller }, abilitiesCatalog: demoAbilities, idFactory: cryptoId });
}

export function createEmptyStats(): CombatantStats { return createEmptyCombatantStats(); }

export function cryptoId(prefix: string): string { return prefix + "-" + Math.random().toString(36).slice(2, 10); }
