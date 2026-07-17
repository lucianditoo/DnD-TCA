import { z } from "zod";

export const equipmentSlotCommandSchema = z.enum(["mainHand", "offHand", "armor"]);

export const equipItemSchema = z.object({
  type: z.literal("equip-item"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  itemId: z.string().min(1),
  slot: equipmentSlotCommandSchema
}).strict();

export const unequipItemSchema = z.object({
  type: z.literal("unequip-item"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  slot: equipmentSlotCommandSchema
}).strict();
