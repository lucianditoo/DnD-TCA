export type Currency = "cp" | "sp" | "gp" | "special" | "none";

export type DamageType = "bludgeoning" | "piercing" | "slashing";

export type WeaponProficiency = "simple" | "martial" | "exotic";

export type WeaponGroup =
  | "unarmed"
  | "light-melee"
  | "one-handed-melee"
  | "two-handed-melee"
  | "ranged";

export type WeaponHandedness = "unarmed" | "light" | "one-handed" | "two-handed" | "ranged" | "ammunition";
export type RangedDelivery = "none" | "thrown" | "projectile";
export type AmmunitionKind = "arrow" | "bolt" | "sling-bullet";

export interface MoneyCost {
  value: number | null;
  currency: Currency;
  text: string;
}

export interface CriticalProfile {
  /** Minimum natural d20 value that threatens a critical. 20 means only natural 20. */
  threatFrom: number | null;
  multiplier: number | null;
  text: string;
}

export interface WeaponEntry {
  id: string;
  name: string;
  proficiency: WeaponProficiency;
  group: WeaponGroup;
  handedness: WeaponHandedness;
  cost: MoneyCost;
  damage: {
    small: string | null;
    medium: string | null;
  };
  critical: CriticalProfile;
  /** Range increment in feet. Null means melee/no listed range. */
  rangeIncrementFt: number | null;
  /** Weight for a Medium weapon in pounds. Null means special/not listed. */
  weightLb: number | null;
  damageTypes: DamageType[];
  isMelee: boolean;
  isRanged: boolean;
  /** Forma autoritativa de entrega. Las armas de proyectil requieren munición compatible. */
  rangedDelivery?: RangedDelivery;
  requiredAmmunitionKind?: AmmunitionKind;
  ammunitionKind?: AmmunitionKind;
  isReach?: boolean;
  /** Maniobras especiales que esta arma puede iniciar como ataque armado. */
  specialManeuvers?: "trip"[];
  isDouble?: boolean;
  isAmmunition?: boolean;
  notes?: string[];
}

export type ArmorCategory = "light" | "medium" | "heavy";
export type ShieldCategory = "shield" | "accessory";

export interface ArmorEntry {
  id: string;
  name: string;
  category: ArmorCategory;
  cost: MoneyCost;
  armorBonus: number;
  maxDexBonus: number | null;
  armorCheckPenalty: number;
  arcaneSpellFailurePercent: number;
  speed30Ft: number;
  speed20Ft: number;
  weightLb: number;
  notes?: string[];
}

export interface ShieldEntry {
  id: string;
  name: string;
  category: ShieldCategory;
  cost: MoneyCost;
  shieldBonus: number | null;
  maxDexBonus: number | null;
  armorCheckPenalty: number | null;
  arcaneSpellFailurePercent: number | null;
  speed30Ft: number | null;
  speed20Ft: number | null;
  weightLb: number;
  notes?: string[];
}
