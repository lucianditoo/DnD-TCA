import { z } from "zod";
import abilitiesData from "./data/abilities.json" with { type: "json" };
import { assertValidProfileSources } from "./equipmentStats.js";
import { EquipmentCatalog } from "./equipmentCatalog.js";
import { FeatCatalog } from "./featCatalog.js";
import { creatureTemplateSchema } from "./schemas/commands/base.js";
import { SpellsCatalog } from "./spells/catalog.js";
import type { InventoryItem, StoredProfile } from "./types.js";

export const PROFILE_STORAGE_KEY = "dnd-tactical.profiles.v6";
export const V5_PROFILE_STORAGE_KEY = "dnd-tactical.profiles.v5";
export const V4_PROFILE_STORAGE_KEY = "dnd-tactical.profiles.v4";
export const V3_PROFILE_STORAGE_KEY = "dnd-tactical.profiles.v3";
export const V2_PROFILE_STORAGE_KEY = "dnd-tactical.profiles.v2";
export const LEGACY_PROFILE_STORAGE_KEY = "dnd-tactical.profiles.v1";
export const PROFILE_STORAGE_BACKUP_KEY = "dnd-tactical.profiles.pre-v6.backup";

export interface ProfileStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProfileMigrationIssue {
  index: number;
  profileId?: string;
  profileName?: string;
  message: string;
}

export interface ReadStoredProfilesResult {
  profiles: StoredProfile[];
  issues: ProfileMigrationIssue[];
  migrated: boolean;
}

const storedProfileSchema = creatureTemplateSchema.extend({ updatedAt: z.string().datetime() }).strict();
const envelopeSchema = (version: 1 | 2 | 3 | 4 | 5 | 6) => z.object({ version: z.literal(version), profiles: z.array(z.unknown()) }).strict();
const knownAbilityIds = new Set(abilitiesData.abilities.map((ability) => ability.id));

function validateCatalogReferences(profile: StoredProfile): void {
  assertValidProfileSources(profile);
  for (const abilityId of profile.abilities) {
    if (!knownAbilityIds.has(abilityId)) throw new Error(`La aptitud ${abilityId} no existe en AbilityCatalog.`);
  }
  for (const featId of profile.featIds) {
    if (!FeatCatalog.get(featId)) throw new Error(`La dote ${featId} no existe en FeatCatalog.`);
  }
  for (const slot of profile.preparedSpellLoadout ?? []) SpellsCatalog.require(slot.spellId);
}

function parseV6Profile(value: unknown): StoredProfile {
  const profile = storedProfileSchema.parse(value) as StoredProfile;
  validateCatalogReferences(profile);
  return profile;
}

function stableItemId(profileId: string, catalogId: string, ordinal: number): string {
  return `${profileId}:item:${catalogId}:${ordinal}`;
}

function packageQuantity(catalogId: string): number | undefined {
  if (catalogId === "arrows_20") return 20;
  if (catalogId === "crossbow_bolts_10" || catalogId === "sling_bullets_10") return 10;
  if (catalogId === "repeating_crossbow_bolts_5") return 5;
  return undefined;
}

interface LegacyWeaponRecord {
  weaponId: string;
  equipped?: boolean;
  slot?: "main" | "off" | "ranged";
  quantity?: number;
}

function migrateLegacyEquipment(profileId: string, legacy: Record<string, unknown>): Pick<StoredProfile, "inventory" | "equipmentSlots"> {
  if (Array.isArray(legacy.inventory) && legacy.equipmentSlots && typeof legacy.equipmentSlots === "object") {
    return {
      inventory: legacy.inventory as InventoryItem[],
      equipmentSlots: legacy.equipmentSlots as StoredProfile["equipmentSlots"]
    };
  }
  const raw = legacy.equipment;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`El perfil ${profileId} no declara equipo V3/V4 migrable.`);
  const equipment = raw as Record<string, unknown>;
  const mainWeapon = typeof equipment.mainWeapon === "string" ? equipment.mainWeapon : null;
  const offHand = typeof equipment.offHand === "string" ? equipment.offHand : null;
  const armor = typeof equipment.armor === "string" ? equipment.armor : null;
  const shield = typeof equipment.shield === "string" ? equipment.shield : null;
  if (offHand && shield && offHand !== shield) throw new Error(`El perfil ${profileId} declara dos objetos distintos para la mano secundaria.`);
  const weapons = Array.isArray(equipment.weapons) ? equipment.weapons.filter((value): value is LegacyWeaponRecord => {
    return Boolean(value && typeof value === "object" && typeof (value as LegacyWeaponRecord).weaponId === "string");
  }) : [];

  const requested: Array<{ catalogId: string; quantity?: number }> = [];
  const add = (catalogId: string | null, quantity?: number) => {
    if (!catalogId) return;
    if (!EquipmentCatalog.getItem(catalogId)) throw new Error(`El perfil ${profileId} referencia equipo desconocido: ${catalogId}.`);
    const existing = requested.find((item) => item.catalogId === catalogId);
    if (existing) {
      if (quantity !== undefined) existing.quantity = Math.max(existing.quantity ?? 1, quantity);
      return;
    }
    requested.push({ catalogId, ...(quantity !== undefined ? { quantity } : {}) });
  };
  add(mainWeapon);
  add(offHand ?? shield);
  add(armor);
  for (const weapon of weapons) add(weapon.weaponId, weapon.quantity ?? packageQuantity(weapon.weaponId));

  const inventory: InventoryItem[] = requested.map((item, index) => ({
    itemId: stableItemId(profileId, item.catalogId, index + 1),
    catalogId: item.catalogId,
    ...(item.quantity !== undefined ? { quantity: item.quantity } : packageQuantity(item.catalogId) !== undefined ? { quantity: packageQuantity(item.catalogId) } : {})
  }));
  const itemIdFor = (catalogId: string | null): string | null => inventory.find((item) => item.catalogId === catalogId)?.itemId ?? null;
  return {
    inventory,
    equipmentSlots: {
      mainHandItemId: itemIdFor(mainWeapon ?? weapons.find((weapon) => weapon.equipped && weapon.slot === "main")?.weaponId ?? null),
      offHandItemId: itemIdFor(offHand ?? shield ?? weapons.find((weapon) => weapon.equipped && weapon.slot === "off")?.weaponId ?? null),
      armorItemId: itemIdFor(armor)
    }
  };
}

const knownCreatureTypeByProfileId: Readonly<Record<string, StoredProfile["creatureTypeId"]>> = {
  bane: "humanoid", cedrick: "humanoid", elaen: "humanoid", canocrock: "magical_beast"
};

function migrateLegacyProfile(value: unknown): StoredProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("El perfil legacy no es un objeto.");
  const legacy = value as Record<string, unknown>;
  const identity = z.object({
    id: z.string().min(1), name: z.string().min(1), type: z.enum(["player", "enemy"]),
    controller: z.enum(["player", "gm"]).optional(), playerName: z.string().optional(), icon: z.string().min(1),
    hpMax: z.number().int().positive(), baseAttackBonus: z.number().int(),
    baseFortitude: z.number().int().optional(), baseReflex: z.number().int().optional(), baseWill: z.number().int().optional(),
    baseSpeedFeet: z.number().int().nonnegative(),
    abilityScores: z.object({ strength: z.number().int(), dexterity: z.number().int(), constitution: z.number().int(), intelligence: z.number().int(), wisdom: z.number().int(), charisma: z.number().int() }),
    sizeCategory: z.enum(["fine", "diminutive", "tiny", "small", "medium", "large", "huge", "gargantuan", "colossal"]),
    creatureTypeId: z.enum(["aberration", "animal", "construct", "dragon", "elemental", "fey", "giant", "humanoid", "magical_beast", "monstrous_humanoid", "ooze", "outsider", "plant", "undead", "vermin"]).optional(),
    featureIds: z.array(z.custom<`srd_sneak_attack_${number}d6`>((entry) => typeof entry === "string" && /^srd_sneak_attack_\d+d6$/.test(entry))).optional(),
    skillRanks: z.object({ escape_artist: z.number().int().nonnegative() }).strict().optional(),
    featIds: z.array(z.string()).optional(), intrinsicDefense: z.object({ naturalArmorBonus: z.number(), dodgeBonus: z.number(), deflectionBonus: z.number(), miscArmorClassBonus: z.number() }),
    naturalAttackId: z.string().optional(), abilities: z.array(z.string()).optional(), preparedSpellLoadout: z.array(z.object({ slotId: z.string(), spellId: z.string() })).optional(),
    buffs: z.array(z.unknown()).optional(), position: z.object({ x: z.number().int(), y: z.number().int(), zFeet: z.number().int().default(0) }).optional(), updatedAt: z.string().datetime().optional()
  }).passthrough().parse(legacy);
  const sources = migrateLegacyEquipment(identity.id, legacy);
  const creatureTypeId = identity.creatureTypeId ?? knownCreatureTypeByProfileId[identity.id];
  if (!creatureTypeId) throw new Error(`El perfil ${identity.id} no declara creatureTypeId y no existe un mapeo inequívoco.`);
  const featureIds = identity.featureIds ?? (identity.id === "bane" ? ["srd_sneak_attack_1d6" as const] : []);
  const buffs = z.array(z.object({
    name: z.string(), source: z.string(), attackBonus: z.number().optional(), acBonus: z.number().optional(),
    acBonusType: z.enum(["armor", "shield", "natural_armor", "dex", "dodge", "deflection", "size", "misc"]).optional(),
    speedBonusFeet: z.number().optional(), remainingTurns: z.number().int(), expiresAtStartOfTurnOf: z.string().optional(), expiresAfterTurnOf: z.string().optional(),
    preventsOpportunityAttacks: z.boolean().optional(), aidBonus: z.number().optional(), aidTargetId: z.string().optional(), aidTargetName: z.string().optional(), aidChoice: z.enum(["pending", "attack", "ac"]).optional(), aidSourceId: z.string().optional()
  }).strict()).parse(identity.buffs ?? []);
  return parseV6Profile({
    id: identity.id, name: identity.name, type: identity.type,
    controller: identity.type === "enemy" ? "gm" : (identity.controller ?? "player"),
    ...(identity.playerName ? { playerName: identity.playerName } : {}), icon: identity.icon,
    hpMax: identity.hpMax, baseAttackBonus: identity.baseAttackBonus,
    baseFortitude: identity.baseFortitude ?? 0, baseReflex: identity.baseReflex ?? 0, baseWill: identity.baseWill ?? 0,
    baseSpeedFeet: identity.baseSpeedFeet, abilityScores: identity.abilityScores, sizeCategory: identity.sizeCategory,
    creatureTypeId, featureIds, skillRanks: identity.skillRanks ?? { escape_artist: 0 }, ...sources, featIds: identity.featIds ?? [], intrinsicDefense: identity.intrinsicDefense,
    ...(identity.naturalAttackId ? { naturalAttackId: identity.naturalAttackId } : {}), abilities: identity.abilities ?? [],
    ...(identity.preparedSpellLoadout ? { preparedSpellLoadout: identity.preparedSpellLoadout } : {}), buffs,
    position: identity.position ?? { x: 0, y: 0, zFeet: 0 }, updatedAt: identity.updatedAt ?? new Date(0).toISOString()
  });
}

export function readStoredProfilesWithIssues(storage: ProfileStorageLike, key = PROFILE_STORAGE_KEY): ReadStoredProfilesResult {
  const isDefaultKey = key === PROFILE_STORAGE_KEY;
  const candidates = isDefaultKey
    ? [PROFILE_STORAGE_KEY, V5_PROFILE_STORAGE_KEY, V4_PROFILE_STORAGE_KEY, V3_PROFILE_STORAGE_KEY, V2_PROFILE_STORAGE_KEY, LEGACY_PROFILE_STORAGE_KEY]
    : [key];
  const sourceKey = candidates.find((candidate) => storage.getItem(candidate) !== null);
  if (!sourceKey) return { profiles: [], issues: [], migrated: false };
  const raw = storage.getItem(sourceKey)!;
  try {
    const parsed: unknown = JSON.parse(raw);
    const versions = ([6, 5, 4, 3, 2, 1] as const).map((version) => ({ version, result: envelopeSchema(version).safeParse(parsed) }));
    const recognized = versions.find((entry) => entry.result.success);
    const source = recognized ? recognized.result.data!.profiles : Array.isArray(parsed) ? parsed : null;
    if (!source) return { profiles: [], issues: [{ index: -1, message: "El contenedor de perfiles no tiene un esquema reconocido." }], migrated: false };
    const isV6 = recognized?.version === 6;
    const profiles: StoredProfile[] = [];
    const issues: ProfileMigrationIssue[] = [];
    source.forEach((candidate, index) => {
      try { profiles.push(isV6 ? parseV6Profile(candidate) : migrateLegacyProfile(candidate)); }
      catch (error) {
        const record = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : {};
        issues.push({ index, ...(typeof record.id === "string" ? { profileId: record.id } : {}), ...(typeof record.name === "string" ? { profileName: record.name } : {}), message: error instanceof Error ? error.message : "El perfil no pudo migrarse." });
      }
    });
    const migrated = !isV6;
    if (migrated && isDefaultKey) {
      storage.setItem(PROFILE_STORAGE_BACKUP_KEY, raw);
      writeStoredProfiles(storage, profiles);
    }
    return { profiles, issues, migrated };
  } catch (error) {
    return { profiles: [], issues: [{ index: -1, message: error instanceof Error ? error.message : "JSON de perfiles inválido." }], migrated: false };
  }
}

export function readStoredProfiles(storage: ProfileStorageLike, key = PROFILE_STORAGE_KEY): StoredProfile[] {
  return readStoredProfilesWithIssues(storage, key).profiles;
}

export function writeStoredProfiles(storage: ProfileStorageLike, profiles: StoredProfile[], key = PROFILE_STORAGE_KEY): void {
  const validated = profiles.map(parseV6Profile);
  storage.setItem(key, JSON.stringify({ version: 6, profiles: validated }));
}
