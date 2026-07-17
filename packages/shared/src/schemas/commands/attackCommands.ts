import { z } from "zod";

export const resolveAttackSchema = z.object({
  type: z.literal("resolve-attack"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  attackerId: z.string().min(1),
  targetId: z.string().min(1),
  d20Roll: z.number().int().nullable(),
  damage: z.number().int().nullable(),
  isAutoRoll: z.boolean().optional()
}).strict();

export const resolveAttackConfirmationSchema = z.object({
  type: z.literal("resolve-attack-confirmation"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  d20Roll: z.number().int().nullable(),
  damage: z.number().int().nullable(),
  isAutoRoll: z.boolean().optional()
}).strict();

export const cancelAttackThreatSchema = z.object({
  type: z.literal("cancel-attack-threat"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1)
}).strict();

export const resolveOpportunityAttackSchema = z.object({
  type: z.literal("resolve-opportunity-attack"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  opportunityId: z.string().min(1),
  d20Roll: z.number().int().nullable(),
  damage: z.number().int().nullable(),
  isAutoRoll: z.boolean().optional()
}).strict();
