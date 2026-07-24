import { z } from "zod";
import { positionSchema } from "./base.js";

export const lifeStatusSchema = z.enum(["active", "disabled", "dying", "stable", "dead"]);
export const combatOutcomeSchema = z.enum(["ongoing", "victory", "tpk"]);

export const healCombatantSchema = z.object({
  type: z.literal("heal-combatant"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  amount: z.number().int(),
  source: z.string().min(1)
});

export const gmMoveCombatantSchema = z.object({
  type: z.literal("gm-move-combatant"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  to: positionSchema
});

export const gmSetHpSchema = z.object({
  type: z.literal("gm-set-hp"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  hpCurrent: z.number().int(),
  hpMax: z.number().int().optional()
});

export const gmSetStatusSchema = z.object({
  type: z.literal("gm-set-status"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  status: lifeStatusSchema
});

export const gmClearOpportunitiesSchema = z.object({
  type: z.literal("gm-clear-opportunities"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1)
});

export const gmAddLogSchema = z.object({
  type: z.literal("gm-add-log"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  message: z.string().min(1)
});

export const gmForceOutcomeSchema = z.object({
  type: z.literal("gm-force-outcome"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  outcome: combatOutcomeSchema
});

export const gmApplyEffectSchema = z.object({
  type: z.literal("gm-apply-effect"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  targetId: z.string().min(1),
  effectId: z.string().min(1),
  durationPreset: z.enum(["until_target_turn_end"]).optional()
});

/** Clave canónica de celda de grid, formato estricto "x,y,zFeet" (ver `footprintCellKey`). */
export const cellKeySchema = z.string().regex(/^-?\d+,-?\d+,-?\d+$/, "Clave de celda inválida: se espera el formato \"x,y,zFeet\".");

export const gmApplyEnvironmentalHazardSchema = z.object({
  type: z.literal("gm-apply-environmental-hazard"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  effectId: z.string().min(1),
  targetCells: z.array(cellKeySchema).min(1)
});

/** Sprint 050.1: remoción administrativa por instanceId — nunca por effectId (ver docs/designs/gm-condition-panel.md). */
export const gmRemoveEffectSchema = z.object({
  type: z.literal("gm-remove-effect"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  instanceId: z.string().min(1)
});
