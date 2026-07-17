import { z } from "zod";

export const castSpellSchema = z.object({
  type: z.literal("cast-spell"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  casterId: z.string().min(1),
  targetId: z.string().min(1).optional(),
  direction: z.enum(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]).optional(),
  targetPosition: z.object({ x: z.number(), y: z.number(), zFeet: z.number().optional() }).optional(),
  slotId: z.string().min(1),
  d20Roll: z.number().int().min(1).max(20).nullable(),
  amount: z.number().int().nullable()
}).strict();

export const useAbilitySchema = z.object({
  type: z.literal("use-ability"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  casterId: z.string().min(1),
  targetId: z.string().min(1),
  abilityId: z.string().min(1),
  amount: z.number().int().nullable()
}).strict();

export const resolveAbilityAttackSchema = z.object({
  type: z.literal("resolve-ability-attack"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  casterId: z.string().min(1),
  targetId: z.string().min(1),
  abilityId: z.string().min(1),
  d20Roll: z.number().int().min(1).max(20),
  damage: z.number().int().nonnegative().nullable()
}).strict();

export const rollStabilizationSchema = z.object({
  type: z.literal("roll-stabilization"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  d100Roll: z.number().int()
});
