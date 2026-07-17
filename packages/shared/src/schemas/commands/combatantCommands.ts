import { z } from "zod";
import { creatureTemplateSchema } from "./base.js";

export const addDemoCombatantSchema = z.object({
  type: z.literal("add-demo-combatant"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  variant: z.enum(["hero", "enemy", "cedrick", "ranger"])
});

export const addCatalogCombatantSchema = z.object({
  type: z.literal("add-catalog-combatant"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  templateId: z.string().min(1),
  category: z.enum(["heroes", "enemies"])
});

export const addProfileCombatantSchema = z.object({
  type: z.literal("add-profile-combatant"),
  roomCode: z.string().min(1),
  actorId: z.string().min(1),
  profile: creatureTemplateSchema
});
