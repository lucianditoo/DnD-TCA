import { z } from "zod";

export const participantRoleSchema = z.enum(["gm", "player"]);

export const createRoomSchema = z.object({
  type: z.literal("create-room"),
  name: z.string().min(1)
});

export const joinRoomSchema = z.object({
  type: z.literal("join-room"),
  roomCode: z.string().min(1),
  name: z.string().min(1),
  role: participantRoleSchema
});
