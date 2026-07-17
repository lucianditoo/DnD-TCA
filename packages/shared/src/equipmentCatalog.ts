import { armors, exoticWeapons, martialWeapons, shields, simpleWeapons, weapons, type AmmunitionKind, type ArmorEntry, type RangedDelivery, type ShieldEntry, type WeaponEntry } from "./data/equipment/index.js";
import type { WeaponProfile } from "./types.js";

const THROWN_MAX_INCREMENTS = 5;
const PROJECTILE_MAX_INCREMENTS = 10;

function byId<T extends { id: string }>(items: T[], id: string | null | undefined): T | undefined {
  if (!id) return undefined;
  return items.find((item) => item.id === id);
}

function maxRangeIncrements(weapon: WeaponEntry): number | undefined {
  if (!weapon.rangeIncrementFt) return undefined;
  return weapon.isMelee && weapon.isRanged ? THROWN_MAX_INCREMENTS : PROJECTILE_MAX_INCREMENTS;
}

function weaponHandedness(weapon: WeaponEntry): WeaponProfile["handedness"] {
  if (weapon.isMelee && weapon.isRanged) return "thrown";
  if (weapon.handedness === "ranged" || weapon.handedness === "ammunition") return "ranged";
  if (weapon.handedness === "two-handed") return "two-handed";
  if (weapon.handedness === "one-handed") return "one-handed";
  return "light";
}

export type EquipmentCatalogItem =
  | { readonly kind: "weapon"; readonly entry: WeaponEntry }
  | { readonly kind: "armor"; readonly entry: ArmorEntry }
  | { readonly kind: "shield"; readonly entry: ShieldEntry };

function getItem(id: string | null | undefined): EquipmentCatalogItem | undefined {
  const weapon = byId(weapons, id);
  if (weapon) return { kind: "weapon", entry: weapon };
  const armor = byId(armors, id);
  if (armor) return { kind: "armor", entry: armor };
  const shield = byId(shields, id);
  if (shield) return { kind: "shield", entry: shield };
  return undefined;
}

function rangedDelivery(weapon: WeaponEntry): RangedDelivery {
  if (weapon.rangedDelivery) return weapon.rangedDelivery;
  if (!weapon.isRanged || weapon.isAmmunition) return "none";
  return "thrown";
}

function validateCatalog(): void {
  const all = [...weapons, ...armors, ...shields];
  const ids = new Set<string>();
  for (const entry of all) {
    if (ids.has(entry.id)) throw new Error(`EquipmentCatalog repite el id ${entry.id}.`);
    ids.add(entry.id);
  }
  const ammunitionKinds = new Set<AmmunitionKind>();
  for (const weapon of weapons) {
    const delivery = rangedDelivery(weapon);
    if (delivery === "projectile" && !weapon.requiredAmmunitionKind) {
      throw new Error(`${weapon.id} es un arma de proyectil sin requiredAmmunitionKind.`);
    }
    if (weapon.isAmmunition) {
      if (!weapon.ammunitionKind) throw new Error(`${weapon.id} es munición sin ammunitionKind.`);
      ammunitionKinds.add(weapon.ammunitionKind);
    }
  }
  for (const weapon of weapons) {
    if (weapon.requiredAmmunitionKind && !ammunitionKinds.has(weapon.requiredAmmunitionKind)) {
      throw new Error(`${weapon.id} requiere una familia de munición no catalogada: ${weapon.requiredAmmunitionKind}.`);
    }
  }
}

validateCatalog();

export const EquipmentCatalog = {
  getItem,
  requireItem(id: string): EquipmentCatalogItem {
    const item = getItem(id);
    if (!item) throw new Error(`EquipmentCatalog no contiene ${id}.`);
    return item;
  },
  getWeapon(id: string | null | undefined): WeaponEntry | undefined { return byId(weapons, id); },
  getArmor(id: string | null | undefined): ArmorEntry | undefined { return byId(armors, id); },
  getShield(id: string | null | undefined): ShieldEntry | undefined { return byId(shields, id); },
  getAllWeapons(): WeaponEntry[] { return weapons; },
  getSimpleWeapons(): WeaponEntry[] { return simpleWeapons; },
  getMartialWeapons(): WeaponEntry[] { return martialWeapons; },
  getExoticWeapons(): WeaponEntry[] { return exoticWeapons; },
  getAllArmors(): ArmorEntry[] { return armors; },
  getAllShields(): ShieldEntry[] { return shields; },
  getRangedDelivery: rangedDelivery,
  toWeaponProfile(weapon: WeaponEntry): WeaponProfile {
    const increments = maxRangeIncrements(weapon);
    const rangeIncrementFeet = weapon.rangeIncrementFt ?? undefined;
    const maxRangeFeet = rangeIncrementFeet ? rangeIncrementFeet * (increments ?? 1) : weapon.isReach ? 10 : weapon.isMelee ? 5 : 0;
    return {
      name: weapon.name,
      handedness: weaponHandedness(weapon),
      damageDice: weapon.damage.medium ?? "0",
      critical: weapon.critical.text,
      abilityForAttack: weapon.isRanged && !weapon.isMelee ? "dexterity" : "strength",
      abilityForDamage: weapon.isRanged && !weapon.isMelee ? "none" : "strength",
      damageAbilityMultiplier: weapon.handedness === "two-handed" ? 1.5 : weapon.isRanged && !weapon.isMelee ? 0 : 1,
      meleeReachFeet: weapon.isReach ? 10 : weapon.isMelee ? 5 : 0,
      rangeIncrementFeet,
      maxRangeIncrements: increments,
      maxRangeFeet,
      notes: weapon.notes?.join(" ") ?? "",
      criticalThreatFrom: weapon.critical.threatFrom ?? 20,
      criticalMultiplier: weapon.critical.multiplier ?? 2
    };
  }
} as const;
