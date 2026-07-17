import type { AbilityResolution, SavingThrowType, AoEShape } from "../types.js";

/**
 * Nivel de conjuro (0 = truco, 1-9 = conjuros con slot).
 */
export type SpellLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * Característica mental asociada al lanzamiento.
 * Determina la CD y el ataque de conjuro.
 */
export type MentalAbility = "intelligence" | "wisdom" | "charisma";

export type SpellSchool =
  | "abjuration"
  | "conjuration"
  | "divination"
  | "enchantment"
  | "evocation"
  | "illusion"
  | "necromancy"
  | "transmutation"
  | "universal";

/**
 * Tiempo de lanzamiento discriminado.
 * Sprint 019: todos los conjuros son acción estándar.
 * Extensiones futuras: swift/immediate, full-round, minutes.
 */
export type SpellCastingTime =
  | { readonly kind: "standard" }
  | { readonly kind: "swift" }
  | { readonly kind: "full-round" }
  | { readonly kind: "minutes"; readonly count: number };

export type SpellSaveEffect = "none" | "half" | "negates";

/**
 * Definición estática e inmutable de un conjuro.
 * NO contiene estado de encuentro (isExpended, slots, etc.).
 */
export interface SpellDefinition {
  readonly id: string;
  readonly name: string;
  readonly level: SpellLevel;
  readonly school: SpellSchool;
  readonly castingTime: SpellCastingTime;
  readonly rangeFeet: number;
  readonly associatedAbility: MentalAbility;
  readonly target: "self" | "ally" | "enemy" | "creature" | "area";
  readonly aoe?: AoEShape;
  readonly resolution: AbilityResolution;
  readonly savingThrowType: SavingThrowType | "none";
  readonly saveEffect: SpellSaveEffect;
}

/**
 * Parámetros derivados de un conjuro para el cálculo de CD y ataques.
 * Actualmente refleja los campos canónicos del catálogo.
 * Futuras listas de clase podrán sobrescribir level/associatedAbility
 * sin cambiar calculateSpellSaveDC ni el command handler.
 */
export interface SpellCastingParameters {
  readonly spellId: string;
  readonly level: SpellLevel;
  readonly associatedAbility: MentalAbility;
  readonly school: SpellSchool;
}

/**
 * Desglose completo de la CD de un conjuro para UI y logs.
 */
export interface SpellSaveDCBreakdown {
  readonly base: 10;
  readonly spellLevel: SpellLevel;
  readonly associatedAbility: MentalAbility;
  readonly effectiveAbilityScore: number;
  readonly abilityModifier: number;
  readonly total: number;
}
