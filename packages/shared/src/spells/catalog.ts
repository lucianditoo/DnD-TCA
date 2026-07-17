import type { SpellDefinition } from "./contracts.js";

/**
 * Catálogo inmutable de conjuros (SpellsCatalog).
 *
 * SSOT de la definición de cada conjuro.
 * Ningún consumidor duplica estos datos; el spellId en el snapshot
 * sirve como referencia para obtener la definición desde aquí.
 *
 * Los cinco conjuros migrados desde AbilityCatalog (abilities.json)
 * conservan sus resoluciones autoritativas.
 */
const spellsData = {
  "srd_ray_of_frost": {
    id: "srd_ray_of_frost",
    name: "Ray of Frost",
    level: 0,
    school: "evocation",
    castingTime: { kind: "standard" },
    rangeFeet: 25,
    associatedAbility: "intelligence",
    target: "enemy",
    savingThrowType: "reflex",
    saveEffect: "half",
    resolution: {
      kind: "attack-roll",
      attackType: "ranged",
      targetAcType: "touch",
      abilityForAttack: "dexterity",
      damageExpression: "1d3",
      criticalThreatFrom: 20,
      criticalMultiplier: 2
    }
  },
  "srd_magic_missile": {
    id: "srd_magic_missile",
    name: "Magic Missile",
    level: 1,
    school: "evocation",
    castingTime: { kind: "standard" },
    rangeFeet: 100,
    associatedAbility: "intelligence",
    target: "enemy",
    savingThrowType: "none",
    saveEffect: "none",
    resolution: {
      kind: "automatic-damage",
      damageExpression: "1d4+1"
    }
  },
  "srd_shocking_grasp": {
    id: "srd_shocking_grasp",
    name: "Shocking Grasp",
    level: 1,
    school: "evocation",
    castingTime: { kind: "standard" },
    rangeFeet: 5,
    associatedAbility: "intelligence",
    target: "enemy",
    savingThrowType: "none",
    saveEffect: "none",
    resolution: {
      kind: "attack-roll",
      attackType: "melee",
      targetAcType: "touch",
      abilityForAttack: "strength",
      damageExpression: "1d6",
      criticalThreatFrom: 20,
      criticalMultiplier: 2
    }
  },
  "srd_cure_light_wounds": {
    id: "srd_cure_light_wounds",
    name: "Cure Light Wounds",
    level: 1,
    school: "conjuration",
    castingTime: { kind: "standard" },
    rangeFeet: 5,
    associatedAbility: "wisdom",
    target: "ally",
    savingThrowType: "none",
    saveEffect: "none",
    resolution: {
      kind: "healing",
      healingExpression: "1d8+1"
    }
  },
  "srd_haste": {
    id: "srd_haste",
    name: "Haste",
    level: 3,
    school: "transmutation",
    castingTime: { kind: "standard" },
    rangeFeet: 25,
    associatedAbility: "intelligence",
    target: "ally",
    savingThrowType: "none",
    saveEffect: "none",
    resolution: {
      kind: "effect",
      effectId: "srd_haste"
    }
  },
  "srd_hold_person": {
    id: "srd_hold_person",
    name: "Hold Person",
    level: 3,
    school: "enchantment",
    castingTime: { kind: "standard" },
    rangeFeet: 100,
    associatedAbility: "intelligence",
    target: "enemy",
    savingThrowType: "will",
    saveEffect: "negates",
    resolution: {
      kind: "effect",
      effectId: "srd_paralyzed"
    }
  },
  "srd_burning_hands": {
    id: "srd_burning_hands",
    name: "Burning Hands",
    level: 1,
    school: "evocation",
    castingTime: { kind: "standard" },
    rangeFeet: 15,
    associatedAbility: "intelligence",
    target: "area",
    aoe: { type: "cone", lengthFeet: 15 },
    savingThrowType: "reflex",
    saveEffect: "half",
    resolution: {
      kind: "automatic-damage",
      damageExpression: "1d4"
    }
  },
  "srd_lightning_bolt": {
    id: "srd_lightning_bolt",
    name: "Lightning Bolt",
    level: 3,
    school: "evocation",
    castingTime: { kind: "standard" },
    rangeFeet: 120,
    associatedAbility: "intelligence",
    target: "area",
    aoe: { type: "line", lengthFeet: 120, widthFeet: 5 },
    savingThrowType: "reflex",
    saveEffect: "half",
    resolution: {
      kind: "automatic-damage",
      damageExpression: "5d6"
    }
  },
  "srd_fireball": {
    id: "srd_fireball",
    name: "Fireball",
    level: 3,
    school: "evocation",
    castingTime: { kind: "standard" },
    rangeFeet: 400,
    associatedAbility: "intelligence",
    target: "area",
    aoe: { type: "burst", radiusFeet: 20 },
    savingThrowType: "reflex",
    saveEffect: "half",
    resolution: {
      kind: "automatic-damage",
      damageExpression: "5d6"
    }
  }
} as const satisfies Record<string, SpellDefinition>;

export type SpellId = keyof typeof spellsData;

export function isSpellId(value: string): value is SpellId {
  return value in spellsData;
}

/**
 * Acceso tipado al catálogo.
 * Lanza error descriptivo si el ID no existe — falla cerrado.
 */
export function requireSpell(spellId: string): SpellDefinition {
  const spell = (spellsData as Record<string, SpellDefinition>)[spellId];
  if (!spell) throw new Error(`SpellsCatalog: conjuro desconocido "${spellId}".`);
  return spell;
}

export function getSpell(spellId: string): SpellDefinition | undefined {
  return (spellsData as Record<string, SpellDefinition>)[spellId];
}

export const SpellsCatalog = Object.freeze({
  all: Object.freeze({ ...spellsData }) as Readonly<typeof spellsData>,
  get: getSpell,
  require: requireSpell,
  isSpellId
}) as {
  readonly all: Readonly<typeof spellsData>;
  get(spellId: string): SpellDefinition | undefined;
  require(spellId: string): SpellDefinition;
  isSpellId(value: string): value is SpellId;
};
