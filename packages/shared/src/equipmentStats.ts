import { EquipmentCatalog, type EquipmentCatalogItem } from "./equipmentCatalog.js";
import { NaturalAttackCatalog } from "./naturalAttackCatalog.js";
import { getSizeRule } from "./sizeRules.js";
import { CreatureTypeCatalog } from "./creatureTypeCatalog.js";
import { CombatFeatureCatalog } from "./combatFeatureCatalog.js";
import type { ArmorEntry, ShieldEntry, WeaponEntry } from "./data/equipment/index.js";
import type { ArmorClassBreakdown, Combatant, CreatureTemplate, EquipmentSlots, InventoryItem, MeleeThreatSource, WeaponProfile } from "./types.js";

export interface EquipmentSourceCarrier {
  readonly name: string;
  readonly abilityScores: CreatureTemplate["abilityScores"];
  readonly sizeCategory: CreatureTemplate["sizeCategory"];
  readonly baseSpeedFeet: number;
  readonly intrinsicDefense: CreatureTemplate["intrinsicDefense"];
  readonly naturalAttackId?: string;
  readonly inventory: readonly InventoryItem[];
  readonly equipmentSlots: EquipmentSlots;
}

export interface EquipmentDerivedStats {
  normalArmorClassPreview: number;
  armorClassBreakdown: ArmorClassBreakdown;
  attackAbilityAndSizeBonus: number;
  averageWeaponDamage: number;
  armorAdjustedSpeedFeet: number;
  baseSpeedFeet: number;
  armorBonus: number;
  shieldBonus: number;
  maxDexBonus: number | null;
  armorCheckPenalty: number;
  arcaneSpellFailurePercent: number;
  weaponDamage: string;
  weaponCritical: string;
  weaponDamageType: string;
  weaponRange: string;
  weaponWeight: string;
  weaponProfile: WeaponProfile;
  meleeThreatSources: MeleeThreatSource[];
  mainWeapon?: WeaponEntry;
  offHand?: WeaponEntry | ShieldEntry;
}

export function abilityModifier(score: number): number { return Math.floor((score - 10) / 2); }

export function averageDiceDamage(dice: string): number {
  const match = dice.match(/^(\d+)d(\d+)$/i);
  if (!match) return Number(dice) || 0;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (!Number.isFinite(count) || !Number.isFinite(sides) || count <= 0 || sides <= 0) return 0;
  return count * ((sides + 1) / 2);
}

function assertEquipmentCarrier(combatant: Partial<EquipmentSourceCarrier>): asserts combatant is EquipmentSourceCarrier {
  if (!Array.isArray(combatant.inventory) || !combatant.equipmentSlots) {
    throw new Error(`El combatiente ${combatant.name ?? "desconocido"} no posee inventory/equipmentSlots V5 explícitos.`);
  }
}

export function getInventoryItem(combatant: Pick<EquipmentSourceCarrier, "inventory">, itemId: string | null | undefined): InventoryItem | undefined {
  if (!itemId) return undefined;
  return combatant.inventory.find((item) => item.itemId === itemId);
}

export function getInventoryCatalogItem(combatant: Pick<EquipmentSourceCarrier, "inventory">, itemId: string | null | undefined): EquipmentCatalogItem | undefined {
  const item = getInventoryItem(combatant, itemId);
  return item ? EquipmentCatalog.getItem(item.catalogId) : undefined;
}

export function getEquippedWeaponEntry(combatant: Pick<EquipmentSourceCarrier, "inventory" | "equipmentSlots">): WeaponEntry | undefined {
  assertEquipmentCarrier(combatant);
  const item = getInventoryCatalogItem(combatant, combatant.equipmentSlots.mainHandItemId);
  return item?.kind === "weapon" && !item.entry.isAmmunition ? item.entry : undefined;
}

export function getEquippedArmorEntry(combatant: Pick<EquipmentSourceCarrier, "inventory" | "equipmentSlots">): ArmorEntry | undefined {
  assertEquipmentCarrier(combatant);
  const item = getInventoryCatalogItem(combatant, combatant.equipmentSlots.armorItemId);
  return item?.kind === "armor" ? item.entry : undefined;
}

export function getEquippedOffHandEntry(combatant: Pick<EquipmentSourceCarrier, "inventory" | "equipmentSlots">): WeaponEntry | ShieldEntry | undefined {
  assertEquipmentCarrier(combatant);
  const item = getInventoryCatalogItem(combatant, combatant.equipmentSlots.offHandItemId);
  return item?.kind === "weapon" || item?.kind === "shield" ? item.entry : undefined;
}

export function resolveEquippedWeaponProfile(combatant: EquipmentSourceCarrier): { entry?: WeaponEntry; profile: WeaponProfile } {
  const entry = getEquippedWeaponEntry(combatant);
  if (entry) return { entry, profile: EquipmentCatalog.toWeaponProfile(entry) };
  const natural = NaturalAttackCatalog.get(combatant.naturalAttackId);
  if (natural) return { profile: { ...natural } };
  const unarmed = EquipmentCatalog.getWeapon("unarmed_strike");
  if (!unarmed) throw new Error("EquipmentCatalog no contiene unarmed_strike.");
  return { entry: unarmed, profile: EquipmentCatalog.toWeaponProfile(unarmed) };
}

export function averageWeaponDamageForCombatant(combatant: Combatant): number {
  const weapon = resolveEquippedWeaponProfile(combatant).profile;
  const abilityBonus = weapon.abilityForDamage === "none" ? 0 : abilityModifier(combatant.abilityScores[weapon.abilityForDamage]);
  return Math.max(0, Math.floor(averageDiceDamage(weapon.damageDice) + abilityBonus * weapon.damageAbilityMultiplier));
}

function assertKnownInventory(profile: CreatureTemplate): void {
  const ids = new Set<string>();
  for (const item of profile.inventory) {
    if (ids.has(item.itemId)) throw new Error(`El perfil ${profile.name} repite itemId ${item.itemId}.`);
    ids.add(item.itemId);
    const catalogItem = EquipmentCatalog.getItem(item.catalogId);
    if (!catalogItem) throw new Error(`El perfil ${profile.name} referencia un elemento de catálogo desconocido: ${item.catalogId}.`);
    if (item.quantity !== undefined && (!Number.isInteger(item.quantity) || item.quantity < 0)) {
      throw new Error(`El perfil ${profile.name} posee quantity inválida en ${item.itemId}.`);
    }
    if (catalogItem.kind === "weapon" && catalogItem.entry.isAmmunition && item.quantity === undefined) {
      throw new Error(`La munición ${item.catalogId} de ${profile.name} debe declarar quantity.`);
    }
  }
  const slots = profile.equipmentSlots;
  const slotReferences = [slots.mainHandItemId, slots.offHandItemId, slots.armorItemId].filter((id): id is string => Boolean(id));
  if (new Set(slotReferences).size !== slotReferences.length) throw new Error(`El perfil ${profile.name} equipa una instancia en más de una ranura.`);
  for (const itemId of slotReferences) {
    if (!ids.has(itemId)) throw new Error(`El perfil ${profile.name} equipa una instancia inexistente: ${itemId}.`);
  }
  const main = getInventoryCatalogItem(profile, slots.mainHandItemId);
  if (main && (main.kind !== "weapon" || main.entry.isAmmunition)) throw new Error(`La mano principal de ${profile.name} no contiene un arma válida.`);
  const off = getInventoryCatalogItem(profile, slots.offHandItemId);
  if (off && off.kind !== "weapon" && off.kind !== "shield") throw new Error(`La mano secundaria de ${profile.name} contiene un objeto incompatible.`);
  if (off?.kind === "weapon" && off.entry.isAmmunition) throw new Error(`La mano secundaria de ${profile.name} no puede equipar munición.`);
  const armor = getInventoryCatalogItem(profile, slots.armorItemId);
  if (armor && armor.kind !== "armor") throw new Error(`La ranura de armadura de ${profile.name} contiene un objeto incompatible.`);
  if (main?.kind === "weapon" && main.entry.handedness === "two-handed" && slots.offHandItemId) {
    throw new Error(`${profile.name} no puede ocupar la mano secundaria mientras empuña un arma a dos manos.`);
  }
}

export function assertValidProfileSources(profile: CreatureTemplate): void {
  if (!profile.abilityScores) throw new Error(`El perfil ${profile.name} no posee abilityScores completas.`);
  if (!profile.sizeCategory) throw new Error(`El perfil ${profile.name} no posee sizeCategory.`);
  if (!Array.isArray(profile.inventory)) throw new Error(`El perfil ${profile.name} no posee inventory explícito.`);
  if (!profile.skillRanks || !Number.isInteger(profile.skillRanks.escape_artist) || profile.skillRanks.escape_artist < 0) {
    throw new Error(`El perfil ${profile.name} no posee rangos de Escapismo explícitos y válidos.`);
  }
  if (!profile.equipmentSlots) throw new Error(`El perfil ${profile.name} no posee equipmentSlots explícitos.`);
  if (!profile.intrinsicDefense) throw new Error(`El perfil ${profile.name} no posee intrinsicDefense explícita.`);
  if (!CreatureTypeCatalog.has(profile.creatureTypeId)) throw new Error(`El perfil ${profile.name} posee un tipo de criatura desconocido: ${profile.creatureTypeId}.`);
  if (!Array.isArray(profile.featureIds)) throw new Error(`El perfil ${profile.name} no posee featureIds explícitas.`);
  for (const featureId of profile.featureIds) {
    if (!CombatFeatureCatalog.has(featureId)) throw new Error(`El perfil ${profile.name} posee una feature desconocida: ${featureId}.`);
  }
  assertKnownInventory(profile);
  if (profile.naturalAttackId && !NaturalAttackCatalog.has(profile.naturalAttackId)) {
    throw new Error(`El perfil de ${profile.name} referencia un ataque natural desconocido: ${profile.naturalAttackId}.`);
  }
  for (const [key, value] of Object.entries(profile.intrinsicDefense)) {
    if (!Number.isFinite(value)) throw new Error(`La defensa intrínseca ${key} de ${profile.name} no es finita.`);
  }
}

function addWeaponThreatSource(profile: EquipmentSourceCarrier, sources: Map<string, MeleeThreatSource>, weapon: WeaponEntry | undefined): void {
  if (!weapon || weapon.id === "unarmed_strike" || !weapon.isMelee || sources.has(weapon.id)) return;
  const weaponProfile = EquipmentCatalog.toWeaponProfile(weapon);
  const naturalReach = getSizeRule(profile.sizeCategory).defaultReachFeet;
  let minReachFeet = 0;
  let maxReachFeet = naturalReach;
  if (weapon.isReach) {
    const multiplier = (weaponProfile.meleeReachFeet || 10) / getSizeRule("medium").defaultReachFeet;
    maxReachFeet = naturalReach * multiplier;
    minReachFeet = naturalReach;
  } else if (weaponProfile.meleeReachFeet && weaponProfile.meleeReachFeet !== 5) {
    maxReachFeet = weaponProfile.meleeReachFeet;
  }
  sources.set(weapon.id, { sourceId: weapon.id, kind: "weapon", minReachFeet, maxReachFeet });
}

export function deriveMeleeThreatSources(profile: EquipmentSourceCarrier): MeleeThreatSource[] {
  const sources = new Map<string, MeleeThreatSource>();
  addWeaponThreatSource(profile, sources, getEquippedWeaponEntry(profile));
  const offHand = getEquippedOffHandEntry(profile);
  addWeaponThreatSource(profile, sources, offHand && "isMelee" in offHand ? offHand : undefined);
  const naturalAttack = NaturalAttackCatalog.get(profile.naturalAttackId);
  if (naturalAttack && profile.naturalAttackId) {
    sources.set(`natural:${profile.naturalAttackId}`, {
      sourceId: profile.naturalAttackId,
      kind: "natural",
      minReachFeet: 0,
      maxReachFeet: naturalAttack.meleeReachFeet || getSizeRule(profile.sizeCategory).defaultReachFeet
    });
  }
  return [...sources.values()];
}

export function deriveArmorClassBreakdown(profile: EquipmentSourceCarrier): ArmorClassBreakdown {
  const armor = getEquippedArmorEntry(profile);
  const offHand = getEquippedOffHandEntry(profile);
  const shield = offHand && "shieldBonus" in offHand ? offHand : undefined;
  const dexterityModifier = abilityModifier(profile.abilityScores.dexterity);
  const dexterity = armor?.maxDexBonus === null || armor?.maxDexBonus === undefined
    ? dexterityModifier
    : Math.min(dexterityModifier, armor.maxDexBonus);
  return {
    base: 10,
    armor: armor?.armorBonus ?? 0,
    shield: shield?.shieldBonus ?? 0,
    naturalArmor: profile.intrinsicDefense.naturalArmorBonus,
    dexterity,
    size: getSizeRule(profile.sizeCategory).attackAndAcModifier,
    dodge: profile.intrinsicDefense.dodgeBonus,
    deflection: profile.intrinsicDefense.deflectionBonus,
    misc: profile.intrinsicDefense.miscArmorClassBonus
  };
}

export function getArmorAdjustedSpeedFeet(profile: EquipmentSourceCarrier): number {
  const armor = getEquippedArmorEntry(profile);
  return armor ? profile.baseSpeedFeet === 20 ? armor.speed20Ft : armor.speed30Ft : profile.baseSpeedFeet;
}

export function deriveEquipmentStats(profile: CreatureTemplate): EquipmentDerivedStats {
  assertValidProfileSources(profile);
  const resolvedWeapon = resolveEquippedWeaponProfile(profile);
  const mainWeapon = resolvedWeapon.entry;
  const weaponProfile = resolvedWeapon.profile;
  const offHand = getEquippedOffHandEntry(profile);
  const armor = getEquippedArmorEntry(profile);
  const shield = offHand && "shieldBonus" in offHand ? offHand : undefined;
  const armorBonus = armor?.armorBonus ?? 0;
  const shieldBonus = shield?.shieldBonus ?? 0;
  const maxDexBonus = armor?.maxDexBonus ?? null;
  const sizeModifier = getSizeRule(profile.sizeCategory).attackAndAcModifier;
  const attackAbilityScore = profile.abilityScores[weaponProfile.abilityForAttack];
  const attackAbilityAndSizeBonus = abilityModifier(attackAbilityScore) + sizeModifier;
  const damageAbilityScore = weaponProfile.abilityForDamage === "none" ? 10 : profile.abilityScores[weaponProfile.abilityForDamage];
  const damageAbilityBonus = weaponProfile.abilityForDamage === "none" ? 0 : abilityModifier(damageAbilityScore);
  const averageWeaponDamage = Math.max(0, Math.floor(averageDiceDamage(weaponProfile.damageDice) + damageAbilityBonus * weaponProfile.damageAbilityMultiplier));
  const armorAdjustedSpeedFeet = getArmorAdjustedSpeedFeet(profile);
  const armorClassBreakdown = deriveArmorClassBreakdown(profile);
  return {
    normalArmorClassPreview: Object.values(armorClassBreakdown).reduce((sum, value) => sum + value, 0),
    armorClassBreakdown,
    attackAbilityAndSizeBonus,
    averageWeaponDamage,
    armorAdjustedSpeedFeet,
    baseSpeedFeet: profile.baseSpeedFeet,
    armorBonus,
    shieldBonus,
    maxDexBonus,
    armorCheckPenalty: (armor?.armorCheckPenalty ?? 0) + (shield?.armorCheckPenalty ?? 0),
    arcaneSpellFailurePercent: (armor?.arcaneSpellFailurePercent ?? 0) + (shield?.arcaneSpellFailurePercent ?? 0),
    weaponDamage: weaponProfile.damageDice,
    weaponCritical: weaponProfile.critical,
    weaponDamageType: mainWeapon?.damageTypes.join("/") ?? "natural",
    weaponRange: weaponProfile.rangeIncrementFeet ? `${weaponProfile.rangeIncrementFeet} ft inc.` : "melee",
    weaponWeight: mainWeapon?.weightLb === null || mainWeapon?.weightLb === undefined ? "-" : `${mainWeapon.weightLb} lb`,
    weaponProfile,
    meleeThreatSources: deriveMeleeThreatSources(profile),
    mainWeapon,
    offHand
  };
}

export function applyEquipmentDerivedStats<T extends CreatureTemplate>(profile: T): T & EquipmentDerivedStats {
  return { ...profile, ...deriveEquipmentStats(profile) };
}
