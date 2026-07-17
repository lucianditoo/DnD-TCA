import { z } from "zod";

export const resolveGrappleEscapeSchema = z.object({
  type: z.literal("resolve-grapple-escape"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  escapeType: z.enum(["grapple_check", "escape_artist"]),
  d20Roll: z.number().int().min(1).max(20).nullable(),
  isAutoRoll: z.boolean().optional()
}).strict();
