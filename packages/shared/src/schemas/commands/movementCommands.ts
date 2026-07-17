import { z } from "zod";
import { positionSchema } from "./base.js";

export const moveCombatantSchema = z.object({
  type: z.literal("move-combatant"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  to: positionSchema,
  path: z.array(positionSchema).optional(),
  isAcrobatic: z.boolean().optional()
});
