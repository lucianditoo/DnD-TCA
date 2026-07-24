import { z } from "zod";
import { createRoomSchema, joinRoomSchema } from "./roomCommands.js";
import { addDemoCombatantSchema, addCatalogCombatantSchema, addProfileCombatantSchema } from "./combatantCommands.js";
import { moveCombatantSchema } from "./movementCommands.js";
import { resolveAttackSchema, resolveAttackConfirmationSchema, cancelAttackThreatSchema, resolveOpportunityAttackSchema } from "./attackCommands.js";
import { useTacticalActionSchema, chooseAidBonusSchema, declareAttackModeSchema, cancelAttackModeSchema, resolveSavingThrowSchema, declareDodgeTargetSchema, resumeCoupDeGraceSchema } from "./tacticalCommands.js";
import { useAbilitySchema, resolveAbilityAttackSchema, rollStabilizationSchema, castSpellSchema } from "./abilityCommands.js";
import { healCombatantSchema, gmMoveCombatantSchema, gmSetHpSchema, gmSetStatusSchema, gmClearOpportunitiesSchema, gmAddLogSchema, gmApplyEffectSchema, gmApplyEnvironmentalHazardSchema, gmRemoveEffectSchema, gmForceOutcomeSchema } from "./gmCommands.js";
import { setInitiativeSchema, sortInitiativeSchema, endTurnSchema } from "./initiativeCommands.js";
import { resolveSpecialManeuverSchema } from "./specialManeuverCommands.js";
import { equipItemSchema, unequipItemSchema } from "./equipmentCommands.js";
import { resolveGrappleEscapeSchema } from "./grappleCommands.js";

export * from "./base.js";
export * from "./roomCommands.js";
export * from "./combatantCommands.js";
export * from "./movementCommands.js";
export * from "./attackCommands.js";
export * from "./tacticalCommands.js";
export * from "./abilityCommands.js";
export * from "./gmCommands.js";
export * from "./initiativeCommands.js";
export * from "./specialManeuverCommands.js";
export * from "./equipmentCommands.js";
export * from "./grappleCommands.js";

export const clientCommandSchema = z.union([
  createRoomSchema,
  joinRoomSchema,
  addDemoCombatantSchema,
  addCatalogCombatantSchema,
  addProfileCombatantSchema,
  setInitiativeSchema,
  sortInitiativeSchema,
  moveCombatantSchema,
  resolveAttackSchema,
  resolveAttackConfirmationSchema,
  cancelAttackThreatSchema,
  useTacticalActionSchema,
  chooseAidBonusSchema,
  declareAttackModeSchema,
  cancelAttackModeSchema,
  resolveSavingThrowSchema,
  declareDodgeTargetSchema,
  useAbilitySchema,
  castSpellSchema,
  resolveAbilityAttackSchema,
  resolveOpportunityAttackSchema,
  rollStabilizationSchema,
  healCombatantSchema,
  gmMoveCombatantSchema,
  gmSetHpSchema,
  gmSetStatusSchema,
  gmClearOpportunitiesSchema,
  gmAddLogSchema,
  gmApplyEffectSchema,
  gmApplyEnvironmentalHazardSchema,
  gmRemoveEffectSchema,
  gmForceOutcomeSchema,
  endTurnSchema,
  resolveSpecialManeuverSchema,
  resolveGrappleEscapeSchema,
  equipItemSchema,
  unequipItemSchema,
  resumeCoupDeGraceSchema
]);
export type ClientCommandInput = z.input<typeof clientCommandSchema>;
export type ClientCommandParsed = z.output<typeof clientCommandSchema>;

export const commandSchemasMap: Record<string, z.ZodTypeAny> = {
  "create-room": createRoomSchema,
  "join-room": joinRoomSchema,
  "add-demo-combatant": addDemoCombatantSchema,
  "add-catalog-combatant": addCatalogCombatantSchema,
  "add-profile-combatant": addProfileCombatantSchema,
  "set-initiative": setInitiativeSchema,
  "sort-initiative": sortInitiativeSchema,
  "move-combatant": moveCombatantSchema,
  "resolve-attack": resolveAttackSchema,
  "resolve-attack-confirmation": resolveAttackConfirmationSchema,
  "cancel-attack-threat": cancelAttackThreatSchema,
  "use-tactical-action": useTacticalActionSchema,
  "choose-aid-bonus": chooseAidBonusSchema,
  "declare-attack-mode": declareAttackModeSchema,
  "cancel-attack-mode": cancelAttackModeSchema,
  "resolve-saving-throw": resolveSavingThrowSchema,
  "declare-dodge-target": declareDodgeTargetSchema,
  "use-ability": useAbilitySchema,
  "cast-spell": castSpellSchema,
  "resolve-ability-attack": resolveAbilityAttackSchema,
  "resolve-opportunity-attack": resolveOpportunityAttackSchema,
  "roll-stabilization": rollStabilizationSchema,
  "heal-combatant": healCombatantSchema,
  "gm-move-combatant": gmMoveCombatantSchema,
  "gm-set-hp": gmSetHpSchema,
  "gm-set-status": gmSetStatusSchema,
  "gm-clear-opportunities": gmClearOpportunitiesSchema,
  "gm-add-log": gmAddLogSchema,
  "gm-apply-effect": gmApplyEffectSchema,
  "gm-apply-environmental-hazard": gmApplyEnvironmentalHazardSchema,
  "gm-remove-effect": gmRemoveEffectSchema,
  "gm-force-outcome": gmForceOutcomeSchema,
  "end-turn": endTurnSchema,
  "resolve-special-maneuver": resolveSpecialManeuverSchema,
  "resolve-grapple-escape": resolveGrappleEscapeSchema,
  "equip-item": equipItemSchema,
  "unequip-item": unequipItemSchema,
  "resume-coup-de-grace": resumeCoupDeGraceSchema
};
