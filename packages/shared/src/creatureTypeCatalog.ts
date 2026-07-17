import type { CreatureTypeId } from "./types.js";
import type { Trait } from "./effects/contracts.js";

export interface CreatureTypeDefinition {
  readonly id: CreatureTypeId;
  readonly name: string;
  readonly traits: readonly Trait[];
}

const rawDefinitions: CreatureTypeDefinition[] = [
  { id: "aberration", name: "Aberración", traits: [] },
  { id: "animal", name: "Animal", traits: [] },
  { id: "construct", name: "Constructo", traits: ["IMMUNE_TO_CRITICAL_HITS", "IMMUNE_TO_PRECISION_DAMAGE"] },
  { id: "dragon", name: "Dragón", traits: [] },
  { id: "elemental", name: "Elemental", traits: [] },
  { id: "fey", name: "Feérico", traits: [] },
  { id: "giant", name: "Gigante", traits: [] },
  { id: "humanoid", name: "Humanoide", traits: [] },
  { id: "magical_beast", name: "Bestia mágica", traits: [] },
  { id: "monstrous_humanoid", name: "Humanoide monstruoso", traits: [] },
  { id: "ooze", name: "Cieno", traits: [] },
  { id: "outsider", name: "Ajeno", traits: [] },
  { id: "plant", name: "Planta", traits: [] },
  { id: "undead", name: "Muerto viviente", traits: ["IMMUNE_TO_CRITICAL_HITS", "IMMUNE_TO_PRECISION_DAMAGE"] },
  { id: "vermin", name: "Alimaña", traits: [] }
];

const definitions: readonly CreatureTypeDefinition[] = Object.freeze(
  rawDefinitions.map((definition): CreatureTypeDefinition => Object.freeze({
    ...definition,
    traits: Object.freeze([...definition.traits])
  }))
);

const byId = new Map(definitions.map((definition) => [definition.id, definition]));

export const CreatureTypeCatalog = Object.freeze({
  all(): readonly CreatureTypeDefinition[] {
    return definitions;
  },
  get(id: CreatureTypeId | string | null | undefined): CreatureTypeDefinition | undefined {
    return id ? byId.get(id as CreatureTypeId) : undefined;
  },
  has(id: string): id is CreatureTypeId {
    return byId.has(id as CreatureTypeId);
  },
  traitsFor(id: CreatureTypeId): Trait[] {
    const definition = byId.get(id);
    if (!definition) throw new Error(`Tipo de criatura desconocido: ${id}.`);
    return [...definition.traits];
  }
});
