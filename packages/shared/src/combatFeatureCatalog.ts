import type { CombatFeatureId } from "./types.js";

export interface CombatFeatureDefinition {
  readonly id: CombatFeatureId;
  readonly name: string;
  readonly sneakAttackDice: number;
}

const definitions = Object.freeze(Array.from({ length: 10 }, (_, index): CombatFeatureDefinition => {
  const dice = index + 1;
  return {
    id: `srd_sneak_attack_${dice}d6`,
    name: `Ataque furtivo +${dice}d6`,
    sneakAttackDice: dice
  };
}).map((definition) => Object.freeze(definition)));

const byId = new Map(definitions.map((definition) => [definition.id, definition]));

export const CombatFeatureCatalog = Object.freeze({
  all(): readonly CombatFeatureDefinition[] {
    return definitions;
  },
  get(id: CombatFeatureId | string): CombatFeatureDefinition | undefined {
    return byId.get(id as CombatFeatureId);
  },
  has(id: string): id is CombatFeatureId {
    return byId.has(id as CombatFeatureId);
  }
});

export function deriveSneakAttackDice(featureIds: readonly CombatFeatureId[]): number {
  return featureIds.reduce((highest, id) => {
    const feature = CombatFeatureCatalog.get(id);
    if (!feature) throw new Error(`Feature de combate desconocida: ${id}.`);
    return Math.max(highest, feature.sneakAttackDice);
  }, 0);
}
