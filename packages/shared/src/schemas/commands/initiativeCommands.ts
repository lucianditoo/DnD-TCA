import { z } from "zod";

export const setInitiativeSchema = z.object({
  type: z.literal("set-initiative"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  initiative: z.number().int()
});

export const sortInitiativeSchema = z.object({
  type: z.literal("sort-initiative"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1)
});

export const endTurnSchema = z.object({
  type: z.literal("end-turn"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1)
});
