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

export const updateBoardSchema = z.object({
  type: z.literal("update-board"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  board: z.object({
    width: z.number().int().min(6).max(40),
    height: z.number().int().min(6).max(40),
    cellSizeFeet: z.number().optional(),
    difficultTerrainCells: z.array(z.string()).optional(),
    impassableCells: z.array(z.string()).optional(),
    narrowCells: z.array(z.string()).optional(),
    lineOfEffectBlockingCells: z.array(z.string()).optional(),
    dimLightCells: z.array(z.string()).optional(),
    darknessCells: z.array(z.string()).optional()
  })
});
