import { z } from "zod";

export const positionSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  zFeet: z.number().int().default(0)
});

export const combatantTypeSchema = z.enum(["player", "enemy"]);
export const controllerTypeSchema = z.enum(["player", "gm"]);
export const sizeCategorySchema = z.enum(["fine", "diminutive", "tiny", "small", "medium", "large", "huge", "gargantuan", "colossal"]);
export const creatureTypeIdSchema = z.enum(["aberration", "animal", "construct", "dragon", "elemental", "fey", "giant", "humanoid", "magical_beast", "monstrous_humanoid", "ooze", "outsider", "plant", "undead", "vermin"]);
export const combatFeatureIdSchema = z.custom<`srd_sneak_attack_${number}d6`>((value) => typeof value === "string" && /^srd_sneak_attack_\d+d6$/.test(value));
export const skillRanksSchema = z.object({
  escape_artist: z.number().int().nonnegative()
}).strict();

export const abilityScoresSchema = z.object({
  strength: z.number().int(),
  dexterity: z.number().int(),
  constitution: z.number().int(),
  intelligence: z.number().int(),
  wisdom: z.number().int(),
  charisma: z.number().int()
});

export const inventoryItemSchema = z.object({
  itemId: z.string().min(1),
  catalogId: z.string().min(1),
  quantity: z.number().int().nonnegative().optional()
}).strict();

export const equipmentSlotsSchema = z.object({
  mainHandItemId: z.string().min(1).nullable(),
  offHandItemId: z.string().min(1).nullable(),
  armorItemId: z.string().min(1).nullable()
}).strict();

export const buffSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  source: z.string(),
  acBonus: z.number().optional(),
  acBonusType: z.enum(["armor", "shield", "natural_armor", "dex", "dodge", "deflection", "size", "misc"]).optional(),
  attackBonus: z.number().optional(),
  speedBonusFeet: z.number().optional(),
  remainingTurns: z.number().int(),
  expiresAtStartOfTurnOf: z.string().optional(),
  expiresAfterTurnOf: z.string().optional(),
  preventsOpportunityAttacks: z.boolean().optional(),
  aidBonus: z.number().optional(),
  aidTargetId: z.string().optional(),
  aidTargetName: z.string().optional(),
  aidChoice: z.enum(["pending", "attack", "ac"]).optional(),
  aidSourceId: z.string().optional()
});

export const intrinsicDefenseSchema = z.object({
  naturalArmorBonus: z.number().finite(),
  dodgeBonus: z.number().finite(),
  deflectionBonus: z.number().finite(),
  miscArmorClassBonus: z.number().finite()
}).strict();

export const preparedSpellLoadoutEntrySchema = z.object({
  slotId: z.string().min(1),
  spellId: z.string().min(1)
}).strict();

export const creatureTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: combatantTypeSchema,
  controller: controllerTypeSchema,
  playerName: z.string().optional(),
  icon: z.string(),
  hpMax: z.number().int(),
  baseAttackBonus: z.number().int(),
  baseFortitude: z.number().int(),
  baseReflex: z.number().int(),
  baseWill: z.number().int(),
  baseSpeedFeet: z.number().int().nonnegative(),
  abilityScores: abilityScoresSchema,
  sizeCategory: sizeCategorySchema,
  creatureTypeId: creatureTypeIdSchema,
  featureIds: z.array(combatFeatureIdSchema),
  skillRanks: skillRanksSchema,
  inventory: z.array(inventoryItemSchema),
  equipmentSlots: equipmentSlotsSchema,
  featIds: z.array(z.string()),
  intrinsicDefense: intrinsicDefenseSchema,
  naturalAttackId: z.string().optional(),
  abilities: z.array(z.string()),
  preparedSpellLoadout: z.array(preparedSpellLoadoutEntrySchema).optional(),
  buffs: z.array(buffSchema.omit({ id: true })),
  position: positionSchema
}).strict();
