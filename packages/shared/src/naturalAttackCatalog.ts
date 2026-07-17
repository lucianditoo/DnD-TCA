import type { WeaponProfile } from "./types.js";

const naturalAttacks = {
  "canocrock-bite": {
    name: "Mordisco de Canocrock",
    handedness: "light",
    damageDice: "2d6",
    critical: "x2",
    abilityForAttack: "strength",
    abilityForDamage: "strength",
    damageAbilityMultiplier: 1,
    meleeReachFeet: 5,
    maxRangeFeet: 5,
    notes: "Ataque natural primario.",
    criticalThreatFrom: 20,
    criticalMultiplier: 2
  }
} satisfies Record<string, WeaponProfile>;

export type NaturalAttackId = keyof typeof naturalAttacks;

export const NaturalAttackCatalog = {
  get(id: string | null | undefined): WeaponProfile | undefined {
    if (!id || !(id in naturalAttacks)) return undefined;
    return naturalAttacks[id as NaturalAttackId];
  },
  has(id: string): id is NaturalAttackId { return id in naturalAttacks; },
  getAllIds(): NaturalAttackId[] { return Object.keys(naturalAttacks) as NaturalAttackId[]; }
} as const;
