import { z } from "zod";
import { positionSchema } from "./base.js";

export const useTacticalActionSchema = z.discriminatedUnion("action", [
  z.object({
    type: z.literal("use-tactical-action"),
    roomCode: z.string().min(1),
    actorId: z.string().min(1),
    combatantId: z.string().min(1),
    action: z.literal("total-defense")
  }),
  z.object({
    type: z.literal("use-tactical-action"),
    roomCode: z.string().min(1),
    actorId: z.string().min(1),
    combatantId: z.string().min(1),
    action: z.literal("charge"),
    targetId: z.string().min(1),
    d20Roll: z.number().int().nullable(),
    damage: z.number().int().nullable(),
    isAutoRoll: z.boolean().optional()
  }),
  z.object({
    type: z.literal("use-tactical-action"),
    roomCode: z.string().min(1),
    actorId: z.string().min(1),
    combatantId: z.string().min(1),
    action: z.literal("aid-another"),
    allyId: z.string().min(1),
    targetId: z.string().min(1),
    d20Roll: z.number().int().nullable(),
    isAutoRoll: z.boolean().optional()
  }),
  z.object({
    type: z.literal("use-tactical-action"),
    roomCode: z.string().min(1),
    actorId: z.string().min(1),
    combatantId: z.string().min(1),
    action: z.literal("five-foot-step"),
    to: positionSchema
  }),
  z.object({
    type: z.literal("use-tactical-action"),
    roomCode: z.string().min(1),
    actorId: z.string().min(1),
    combatantId: z.string().min(1),
    action: z.literal("stand-up"),
    isAutoRoll: z.boolean().optional()
  })
]);

export const chooseAidBonusSchema = z.object({
  type: z.literal("choose-aid-bonus"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  buffId: z.string().min(1),
  choice: z.enum(["attack", "ac"])
});

export const declareAttackModeSchema = z.object({
  type: z.literal("declare-attack-mode"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  mode: z.enum(["standard", "full"]),
  defensive: z.boolean()
});

export const cancelAttackModeSchema = z.object({
  type: z.literal("cancel-attack-mode"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1)
});

export const resolveSavingThrowSchema = z.object({
  type: z.literal("resolve-saving-throw"),
  roomCode: z.string().min(1),
  targetId: z.string().min(1),
  saveType: z.enum(["fortitude", "reflex", "will"]),
  dc: z.number().int(),
  d20Roll: z.number().int().min(1).max(20).nullable(),
  isAutoRoll: z.boolean().optional()
});

export const declareDodgeTargetSchema = z.object({
  type: z.literal("declare-dodge-target"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  combatantId: z.string().min(1),
  targetId: z.string().min(1).nullable()
});
