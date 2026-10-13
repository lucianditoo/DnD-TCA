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

export const boardCellKeySchema = z.string().regex(/^\d+,\d+$/, {
  message: "La clave de celda debe tener el formato 'x,y' con enteros no negativos."
});

export const updateBoardSchema = z.object({
  type: z.literal("update-board"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  board: z.object({
    width: z.number().int().min(6).max(40),
    height: z.number().int().min(6).max(40),
    cellSizeFeet: z.literal(5).optional(),
    difficultTerrainCells: z.array(boardCellKeySchema).optional(),
    impassableCells: z.array(boardCellKeySchema).optional(),
    narrowCells: z.array(boardCellKeySchema).optional(),
    lineOfEffectBlockingCells: z.array(boardCellKeySchema).optional(),
    dimLightCells: z.array(boardCellKeySchema).optional(),
    darknessCells: z.array(boardCellKeySchema).optional()
  })
});
