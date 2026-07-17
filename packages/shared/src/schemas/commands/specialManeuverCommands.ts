import { z } from "zod";

const tripManeuverSchema = z.object({
  type: z.literal("trip"),
  attackerId: z.string().min(1),
  targetId: z.string().min(1),
  d20TouchRoll: z.number().int().min(1).max(20).nullable(),
  d20OpposedRoll: z.number().int().min(1).max(20).nullable(),
  isAutoRoll: z.boolean().optional()
}).strict();

const bullRushManeuverSchema = z.object({
  type: z.literal("bull_rush"),
  attackerId: z.string().min(1),
  targetId: z.string().min(1),
  d20OpposedRoll: z.number().int().min(1).max(20).nullable(),
  isAutoRoll: z.boolean().optional()
}).strict();

const grappleManeuverSchema = z.object({
  type: z.literal("grapple"),
  attackerId: z.string().min(1),
  targetId: z.string().min(1),
  d20TouchRoll: z.number().int().min(1).max(20).nullable(),
  d20OpposedRoll: z.number().int().min(1).max(20).nullable(),
  isAutoRoll: z.boolean().optional()
}).strict();

export const resolveSpecialManeuverSchema = z.object({
  type: z.literal("resolve-special-maneuver"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  maneuver: z.discriminatedUnion("type", [tripManeuverSchema, bullRushManeuverSchema, grappleManeuverSchema])
}).strict();
