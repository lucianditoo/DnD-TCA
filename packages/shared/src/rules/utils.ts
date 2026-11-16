import { cryptoId } from "../demo-data.js";
import { effectsCatalog, type ProductionEffectId } from "../effects/catalog.js";
import { type EffectDefinition, type EffectStat, type ModifierCondition, type Trait, type TraitCondition } from "../effects/contracts.js";
import { activeNumericContributions, bonusPolicy, contribution, legacyBuffContributions } from "../effects/contributions.js";
import { EffectReducer, type MovementRateTrace, type NumericContribution, type ReducedEffects } from "../effects/reducer.js";
import { type CatalogEffectId } from "../effects/types.js";
import { averageDiceDamage, deriveArmorClassBreakdown, getArmorAdjustedSpeedFeet, getEquippedArmorEntry, getEquippedWeaponEntry, resolveEquippedWeaponProfile } from "../equipmentStats.js";
import { FeatCatalog } from "../featCatalog.js";
import { lifeStatus } from "../lifeStatus.js";
import { footprintCellKey, getCombatantOccupiedCells } from "../movementGeometry.js";
import { getSizeRule } from "../sizeRules.js";
import { SpellsCatalog } from "../spells/catalog.js";
import { type SpellSaveDCBreakdown } from "../spells/contracts.js";
import { type Combatant, type CombatLogEntry, type CombatRoom, type CombatRulesSnapshot, type CoverAssessment, type Position, type SavingThrowType } from "../types.js";
import { getDefensiveAbilityProjection, getOpportunityAttackLegality, threatensTarget } from "./attack.js";

export interface RuleResult<T> { ok: boolean; value?: T; error?: string; }

export function hasEffectTrait(reduced: ReturnType<typeof EffectReducer.reduceEffectsForTarget>, trait: Trait): boolean {
  return reduced.traits.includes(trait);
}

export function getAbilityModifier(abilityScore: number): number {
  return Math.floor((abilityScore - 10) / 2);
}

export interface SavingThrowCheckResult {
  readonly saveType?: SavingThrowType;
  readonly d20Roll: number;
  readonly modifier: number;
  readonly total: number;
  readonly dc: number;
  readonly success: boolean;
  readonly outcome: "success" | "failure";
  readonly isNatural1: boolean;
  readonly isNatural20: boolean;
}

/**
 * Evaluación pura de una salvación ya proyectada. La procedencia del modificador
 * permanece en Rules.totalSavingThrow; esta función solo resuelve el dado contra la CD.
 */
export function resolveSavingThrowCheck(d20Roll: number, modifier: number, dc: number): SavingThrowCheckResult {
  if (!Number.isInteger(d20Roll) || d20Roll < 1 || d20Roll > 20) {
    throw new Error(`Tirada de salvación inválida: ${d20Roll}. Debe ser un entero entre 1 y 20.`);
  }
  if (!Number.isFinite(modifier)) throw new Error(`Modificador de salvación inválido: ${modifier}.`);
  if (!Number.isFinite(dc)) throw new Error(`CD de salvación inválida: ${dc}.`);

  const isNatural1 = d20Roll === 1;
  const isNatural20 = d20Roll === 20;
  const total = d20Roll + modifier;
  const success = isNatural1 ? false : isNatural20 ? true : total >= dc;
  return {
    d20Roll,
    modifier,
    total,
    dc,
    success,
    outcome: success ? "success" : "failure",
    isNatural1,
    isNatural20
  };
}

export interface AttackContext {
  readonly attackType?: "melee" | "ranged";
  readonly targetAcType?: "normal" | "touch";
  readonly abilityForAttack?: "strength" | "dexterity";
  readonly isFlatFootedOverride?: boolean;
  readonly attackerId?: string;
  readonly aidOpponentId?: string;
  /** Sprint 042: cobertura ya resuelta por `getAttackContextModifiers` para este atacante/objetivo/tipo. */
  readonly cover?: CoverAssessment;
  /** Sprint 035: distingue si la resolución actual es un Ataque de Oportunidad. */
  readonly isOpportunityAttack?: boolean;
  /** Sprint 035: distingue si el AdO fue provocado específicamente por movimiento (Mobility). */
  readonly isMovementProvoked?: boolean;
}

const TOUCH_IGNORED_AC_TYPES = new Set<string>(["armor", "shield", "natural_armor"]);

function shouldApplyAcModifier(value: number, bonusType: string | undefined, attackContext: AttackContext | undefined, suppressDexAndDodge: boolean): boolean {
  if (value <= 0) return true;
  if (!bonusType) throw new Error("Invariante de CA violada: todo bonificador positivo debe declarar su tipo.");
  if (attackContext?.targetAcType === "touch" && TOUCH_IGNORED_AC_TYPES.has(bonusType)) return false;
  if (suppressDexAndDodge && (bonusType === "dex" || bonusType === "dodge")) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluador de Modificadores Condicionales
//
// Función pura que evalúa los `conditionalModifiers` de los efectos activos
// de un objetivo dado un contexto táctico de ataque.
// ─────────────────────────────────────────────────────────────────────────────
function reduceCombatantEffects<TCatalog extends Record<string, EffectDefinition>>(
  context: CombatRulesSnapshot<CatalogEffectId<TCatalog>>, combatant: Combatant, catalog: TCatalog,
  attackContext?: AttackContext, suppressDexAndDodge = false, extra: readonly NumericContribution[] = []
): ReducedEffects {
  const numeric = [...activeNumericContributions(context.effectInstances, combatant.id, catalog), ...legacyBuffContributions(combatant, attackContext?.aidOpponentId), ...extra];
  if (attackContext) for (const inst of context.effectInstances) {
    if (!inst.targets?.includes(combatant.id)) continue;
    for (const cm of catalog[inst.effectId]?.conditionalModifiers ?? []) {
      if (!isConditionMet(cm.condition, attackContext)) continue;
      numeric.push(contribution(combatant.id, String(inst.effectId), inst.instanceId, cm.id, cm.stat, cm.value,
        cm.bonusType ?? `legacy:conditional:${cm.stackingGroup ?? "opaque"}`,
        cm.bonusType ? bonusPolicy(cm.bonusType, cm.value) : cm.stackingPolicy ?? "sum",
        cm.mechanicalSource ?? `${inst.effectId}:${cm.id}`));
    }
  }
  return EffectReducer.reduceEffectsForTarget({
    effectInstances: context.effectInstances, targetId: combatant.id, catalog, includeNumeric: false,
    numericContributions: numeric.filter(({trace}) => trace.stat !== "AC" ||
      shouldApplyAcModifier(trace.value, trace.stackingGroup.replace(/^legacy:(conditional:)?/, ""), attackContext, suppressDexAndDodge))
  });
}

function modifierParts(reduced: ReducedEffects, stat: EffectStat, catalog: Record<string, EffectDefinition>): string[] {
  const result = reduced.numericModifiers[stat];
  const parts: string[] = [];
  let buffs = 0;
  let effects = 0;
  const signed = (value: number) => (value > 0 ? "+" : "") + value;
  for (const trace of [...(result?.bonuses ?? []), ...(result?.penalties ?? [])]) {
    if (trace.status !== "applied") continue;
    const conditional = catalog[trace.effectId]?.conditionalModifiers?.find(mod => mod.id === trace.modifierId);
    if (conditional) parts.push(conditional.label);
    else if (trace.effectId === "legacy-buff") buffs += trace.value;
    else if (trace.effectId === "equipment/base" || trace.effectId === "cover" || trace.effectId === "aid" || trace.effectId === "feats") {
      parts.push(trace.modifierId + " " + signed(trace.value));
    } else effects += trace.value;
  }
  if (buffs !== 0) parts.push("buffs " + signed(buffs));
  if (effects !== 0) parts.push("efectos " + signed(effects));
  return parts;
}

function isConditionMet(condition: ModifierCondition, attackContext: AttackContext): boolean {
  if (condition.type === 'attack_type') {
    return condition.value === attackContext.attackType;
  }
  if (condition.type === 'attacker_prone') {
    return condition.value === true;
  }
  const _exhaustive: never = condition as never;
  throw new Error(`[evaluateConditionalModifiers] Tipo de condición no manejado: ${JSON.stringify(_exhaustive)}`);
}

function isTraitConditionMet(
  condition: TraitCondition,
  instance: import("../effects/types.js").EffectInstance,
  attackContext: AttackContext
): boolean {
  switch (condition.type) {
    case "attacker_outside_effect_targets":
      return condition.value === true
        && attackContext.attackerId !== undefined
        && !(instance.targets?.includes(attackContext.attackerId) ?? false);
    default: {
      throw new Error(`[evaluateConditionalTraits] Tipo de condición no manejado: ${JSON.stringify(condition)}`);
    }
  }
}

function evaluateConditionalTraits<TCatalog extends Record<string, EffectDefinition>>(
  applicableInstances: readonly import("../effects/types.js").EffectInstance<keyof TCatalog & string>[],
  catalog: TCatalog,
  attackContext: AttackContext
): readonly Trait[] {
  const traits = new Set<Trait>();
  for (const instance of applicableInstances) {
    const definition = catalog[instance.effectId as string];
    for (const conditionalTrait of definition?.conditionalTraits ?? []) {
      if (isTraitConditionMet(conditionalTrait.condition, instance, attackContext)) {
        traits.add(conditionalTrait.trait);
      }
    }
  }
  return [...traits].sort();
}

/** Primitiva privada — consume ReducedEffects ya calculados. */
export function _getEffectiveAbilityScoreFromReduced(combatant: Combatant, ability: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma', reduced: import('../effects/reducer.js').ReducedEffects): number {
  const statName = ability.toUpperCase() as EffectStat;
  const override = reduced.statOverrides?.[statName];
  if (override !== undefined) return override;

  const baseScore = combatant.abilityScores[ability];
  const delta = reduced.numericModifiers[statName]?.total ?? 0;
  return Math.max(1, baseScore + delta);
}

/**
 * Proyección pública del score efectivo de una característica.
 * Considera overrides y modificadores numéricos de ActiveEffects.
 * Utilizada por calculateSpellSaveDC y la UI para previews de CD.
 */
export function getEffectiveAbilityScore(
  context: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  ability: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
): number {
  const reduced = reduceCombatantEffects(context, combatant, effectsCatalog);
  return _getEffectiveAbilityScoreFromReduced(combatant, ability, reduced);
}

export type ManeuverAbility = "strength" | "dexterity";

export interface MovementSpeedProjection {
  readonly total: number;
  readonly beforeRate: number;
  readonly rateNumerator: number;
  readonly rateDenominator: number;
  readonly parts: readonly string[];
  readonly rateTraces: readonly MovementRateTrace[];
}

function projectMovementSpeed<TCatalog extends Record<string, EffectDefinition>>(
  context: CombatRulesSnapshot<CatalogEffectId<TCatalog>>,
  combatant: Combatant,
  catalog: TCatalog
): MovementSpeedProjection {
  const reductionInput = { effectInstances: context.effectInstances, targetId: combatant.id, catalog };
  const reduced = reduceCombatantEffects(context, combatant, catalog);
  const rate = EffectReducer.reduceMovementRateContributions(reductionInput);
  const deltaSpeed = reduced.numericModifiers["SPEED"]?.total ?? 0;

  const armorAdjustedSpeed = getArmorAdjustedSpeedFeet(combatant);
  const beforeRate = Math.max(0, armorAdjustedSpeed + deltaSpeed);
  const parts = [
    `base/equipo ${armorAdjustedSpeed} ft`,

    ...(deltaSpeed !== 0 ? [`efectos ${deltaSpeed >= 0 ? "+" : ""}${deltaSpeed} ft`] : []),
    ...rate.traces.filter((trace) => trace.status === "applied").map((trace) => trace.label)
  ];
  const common = {
    beforeRate,
    rateNumerator: rate.numerator,
    rateDenominator: rate.denominator,
    rateTraces: Object.freeze([...rate.traces])
  };

  if (hasEffectTrait(reduced, "CANNOT_MOVE")) {
    return { ...common, total: 0, parts: Object.freeze([...parts, "CANNOT_MOVE → 0 ft"]) };
  }
  return {
    ...common,
    total: Math.floor(beforeRate * rate.numerator / rate.denominator),
    parts: Object.freeze(parts)
  };
}

export function createRuleEvaluator<TCatalog extends Record<string, EffectDefinition>>(catalog: TCatalog) {
  type TEffectId = keyof TCatalog & string;

  return {
    totalAttackBonus(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant,
      attackContext?: Pick<AttackContext, "abilityForAttack" | "attackType" | "aidOpponentId"> & { useEquippedWeapon?: boolean }
    ): { total: number; parts: string[] } {
      const weapon = attackContext?.useEquippedWeapon ? collectWeaponEnhancements(context, combatant) : [];
      const reduced = reduceCombatantEffects(context, combatant, catalog, attackContext, false, weapon);
      const deltaAttack = reduced.numericModifiers["ATTACK"]?.total ?? 0;
      const attackAbility = attackContext?.abilityForAttack ?? resolveEquippedWeaponProfile(combatant).profile.abilityForAttack;
      const effectiveAbilityScore = _getEffectiveAbilityScoreFromReduced(combatant, attackAbility, reduced);
      const selectedModifier = getAbilityModifier(effectiveAbilityScore) + getSizeRule(combatant.sizeCategory).attackAndAcModifier;

      const total = combatant.baseAttackBonus + selectedModifier + deltaAttack;
      const parts = ["BAB +" + combatant.baseAttackBonus, "mod " + (selectedModifier >= 0 ? "+" : "") + selectedModifier, ...modifierParts(reduced, "ATTACK", catalog)];
      return { total, parts };
    },

    totalArmorClass(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant,
      attackContext?: AttackContext
    ): { total: number; parts: string[] } {
      const applicable = context.effectInstances.filter(
        (inst) => inst.targets !== undefined && inst.targets.includes(combatant.id)
      );
      const reduced = reduceCombatantEffects(context, combatant, catalog);
      const contextualTraits = attackContext ? evaluateConditionalTraits(applicable, catalog, attackContext) : [];

      const defenseProj = getDefensiveAbilityProjection(combatant, reduced, attackContext, contextualTraits);
      const suppressDexAndDodge = defenseProj.suppressDexAndDodge;

      let featDodgeBonus = 0;
      const featDodgeParts: string[] = [];
      if (!suppressDexAndDodge && attackContext) {
        if (
          FeatCatalog.hasFeat(combatant.featIds, "srd_dodge") &&
          attackContext.attackerId !== undefined &&
          combatant.dodgeTargetId != null &&
          attackContext.attackerId === combatant.dodgeTargetId
        ) {
          featDodgeBonus += 1;
          featDodgeParts.push("esquiva +1");
        }
        if (
          FeatCatalog.hasFeat(combatant.featIds, "srd_mobility") &&
          attackContext.isOpportunityAttack === true &&
          attackContext.isMovementProvoked === true
        ) {
          featDodgeBonus += 4;
          featDodgeParts.push("movilidad +4");
        }
      }

      const armorClassBreakdown = deriveArmorClassBreakdown(combatant);
      // Incorporar la proyeccion de destreza defensiva preservando el tope de armadura
      const armor = getEquippedArmorEntry(combatant);
      const rawDexMod = getAbilityModifier(defenseProj.effectiveDexterityScore);
      armorClassBreakdown.dexterity = armor?.maxDexBonus === null || armor?.maxDexBonus === undefined
        ? rawDexMod
        : Math.min(rawDexMod, armor.maxDexBonus);

      for (const [component, value] of Object.entries(armorClassBreakdown)) {
        if (!Number.isFinite(value)) throw new Error(`Invariante de CA violada: ${combatant.name} posee ${component} no finito.`);
      }

      const components = [
        ["armor", armorClassBreakdown.armor], ["shield", armorClassBreakdown.shield],
        ["natural_armor", armorClassBreakdown.naturalArmor], ["dex", armorClassBreakdown.dexterity],
        ["size", armorClassBreakdown.size], ["dodge", armorClassBreakdown.dodge],
        ["deflection", armorClassBreakdown.deflection], ["misc", armorClassBreakdown.misc]
      ] as const;
      const extra = components.map(([type, value]) => contribution(combatant.id, "equipment/base", combatant.id, type, "AC", value,
        type === "misc" || type === "dex" ? `legacy:${type}` : type,
        type === "misc" || type === "dex" ? "sum" : bonusPolicy(type, value), `base:${type}`));
      extra.push(contribution(combatant.id, "feats", combatant.id, "dodge", "AC", featDodgeBonus, "dodge", "unique_by_source", "feats:dodge"));
      extra.push(contribution(combatant.id, "cover", combatant.id, "cobertura", "AC", attackContext?.cover?.acBonus ?? 0, "cover", "highest_value", "cover"));
      const composed = reduceCombatantEffects(context, combatant, catalog, attackContext, suppressDexAndDodge, extra);
      const delta = composed.numericModifiers.AC?.total ?? 0;
      const suppressedDex = suppressDexAndDodge && armorClassBreakdown.dexterity > 0
        ? ["DEX suprimido -" + armorClassBreakdown.dexterity] : [];
      const parts = ["base +" + armorClassBreakdown.base, ...suppressedDex, ...featDodgeParts,
        ...modifierParts(composed, "AC", catalog)];
      return { total: armorClassBreakdown.base + delta, parts };
    },

    getMovementSpeedProjection(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant
    ): MovementSpeedProjection {
      return projectMovementSpeed(context, combatant, catalog);
    },

    totalSpeedFeet(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant
    ): number {
      return projectMovementSpeed(context, combatant, catalog).total;
    },

    evaluateActionAvailability(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant
    ): RuleResult<true> {
      const reduced = reduceCombatantEffects(context, combatant, catalog);
      if (hasEffectTrait(reduced, "CANNOT_ACT")) {
        return { ok: false, error: combatant.name + " esta incapacitado y no puede realizar acciones." };
      }
      return { ok: true, value: true };
    },

    canMakeOpportunityAttack(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant,
      _legacyTargetId?: string
    ): boolean {
      if (combatant.buffs.some((buff) => buff.preventsOpportunityAttacks)) return false;
      const reduced = reduceCombatantEffects(context, combatant, catalog);
      if (hasEffectTrait(reduced, "CANNOT_MAKE_AOO")) {
        if (!combatant.featIds.includes("srd_combat_reflexes")) return false;
        const withoutFlatFooted = EffectReducer.reduceEffectsForTarget({
          effectInstances: context.effectInstances.filter(effect => effect.effectId !== "srd_flat_footed"),
          targetId: combatant.id,
          catalog
        });
        if (hasEffectTrait(withoutFlatFooted, "CANNOT_MAKE_AOO")) return false;
      }

      let maxAooAllowed = 1;
      if (combatant.featIds.includes("srd_combat_reflexes")) {
        const effectiveDex = _getEffectiveAbilityScoreFromReduced(combatant, "dexterity", reduced);
        maxAooAllowed = 1 + Math.max(0, getAbilityModifier(effectiveDex));
      }

      if ((combatant.stats.opportunityAttacksThisRound ?? 0) >= maxAooAllowed) return false;

      return true;
    },

    actionProvokesOpportunityAttack(
      snapshot: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant,
      actionType: "cast-spell" | "ranged-attack" | "coup-de-grace"
    ): boolean {
      const prodSnapshot = snapshot as unknown as CombatRulesSnapshot<ProductionEffectId>;
      // Chequear si algun enemigo amenaza al combatiente
      for (const enemy of prodSnapshot.combatants) {
        if (enemy.id !== combatant.id && enemy.type !== combatant.type && lifeStatus(enemy) === "active") {
          if (threatensTarget(prodSnapshot, enemy, combatant) && this.canMakeOpportunityAttack(snapshot, enemy) && getOpportunityAttackLegality(prodSnapshot, enemy, combatant).allowed) {
            return true;
          }
        }
      }
      return false;
    },

    calculateSpellSaveDCBreakdown(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant,
      spellId: string
    ): SpellSaveDCBreakdown {
      const spell = SpellsCatalog.require(spellId);
      const reduced = reduceCombatantEffects(context, combatant, catalog);
      const effectiveAbilityScore = _getEffectiveAbilityScoreFromReduced(combatant, spell.associatedAbility, reduced);
      const abilityModifier = getAbilityModifier(effectiveAbilityScore);
      const total = 10 + spell.level + abilityModifier;
      return {
        base: 10,
        spellLevel: spell.level,
        associatedAbility: spell.associatedAbility,
        effectiveAbilityScore,
        abilityModifier,
        total
      };
    },

    calculateSpellSaveDC(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant,
      spellId: string
    ): number {
      return this.calculateSpellSaveDCBreakdown(context, combatant, spellId).total;
    },

    totalSavingThrow(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant,
      saveType: "fortitude" | "reflex" | "will"
    ): { total: number; parts: string[] } {
      const reduced = reduceCombatantEffects(context, combatant, catalog);

      let baseSave = 0;
      let associatedAbility: "constitution" | "dexterity" | "wisdom" = "constitution";
      let statKey: import("../effects/contracts.js").EffectStat = "FORTITUDE";

      if (saveType === "fortitude") {
        baseSave = combatant.baseFortitude;
        associatedAbility = "constitution";
        statKey = "FORTITUDE";
      } else if (saveType === "reflex") {
        baseSave = combatant.baseReflex;
        associatedAbility = "dexterity";
        statKey = "REFLEX";
      } else if (saveType === "will") {
        baseSave = combatant.baseWill;
        associatedAbility = "wisdom";
        statKey = "WILL";
      }

      const effectiveAbilityScore = _getEffectiveAbilityScoreFromReduced(combatant, associatedAbility, reduced);
      const abilityModifier = getAbilityModifier(effectiveAbilityScore);
      const deltaSave = reduced.numericModifiers[statKey]?.total ?? 0;

      const total = baseSave + abilityModifier + deltaSave;
      const parts: string[] = [
        "Base +" + baseSave,
        associatedAbility.substring(0, 3).toUpperCase() + " " + (abilityModifier >= 0 ? "+" : "") + abilityModifier
      ];
      if (deltaSave !== 0) {
        parts.push("efectos " + (deltaSave >= 0 ? "+" : "") + deltaSave);
      }

      return { total, parts };
    }
  };
}

/**
 * Instancia productiva del evaluador de reglas.
 * Usa el catálogo productivo (neutro durante Sprint 005).
 * Es la única API válida para código de producción.
 * No exportar funciones standalone que omitan el contexto.
 */
export const Rules = createRuleEvaluator(effectsCatalog);

export function getEffectiveAbilityModifier(
  context: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  ability: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
): number {
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: context.effectInstances,
    targetId: combatant.id,
    catalog: effectsCatalog
  });
  return getAbilityModifier(_getEffectiveAbilityScoreFromReduced(combatant, ability, reduced));
}

/** Overlapping enhancements retain their durations and contribute only the highest bonus. */
function collectWeaponEnhancements(context: CombatRulesSnapshot<string> | null, combatant: Combatant): NumericContribution[] {
  const itemId = combatant.equipmentSlots.mainHandItemId;
  if (!itemId || !getEquippedWeaponEntry(combatant)) return [];
  const contributions: NumericContribution[] = [];
  for (const instance of context?.effectInstances ?? []) {
    if (instance.targetItem?.combatantId !== combatant.id || instance.targetItem.itemId !== itemId) continue;
    const definition = (effectsCatalog as Record<string, EffectDefinition>)[instance.effectId];
    contributions.push(contribution(combatant.id, String(instance.effectId), instance.instanceId, itemId, "ATTACK", definition?.weaponEnhancement ?? 0,
      "enhancement", "highest_value", `weapon:${combatant.id}:${itemId}`));
  }
  return contributions;
}

export function getWeaponEnhancement(context: CombatRulesSnapshot<ProductionEffectId> | null, combatant: Combatant): number {
  return EffectReducer.reduceNumericContributions(collectWeaponEnhancements(context, combatant)).ATTACK?.total ?? 0;
}

/** Project weapon damage from current effects without altering the weapon or actor. */
export function projectWeaponDamage(context: CombatRulesSnapshot<ProductionEffectId> | null, combatant: Combatant, weapon = resolveEquippedWeaponProfile(combatant).profile) {
  const ability = weapon.abilityForDamage;
  const modifier = ability === "none" ? 0 : context
    ? getEffectiveAbilityModifier(context, combatant, ability)
    : getAbilityModifier(combatant.abilityScores[ability]);
  const enhancement = getWeaponEnhancement(context, combatant);
  const scaledModifier = modifier * weapon.damageAbilityMultiplier + enhancement;
  return {
    dice: weapon.damageDice,
    enhancement,
    modifier: Math.floor(scaledModifier),
    average: Math.max(1, Math.floor(averageDiceDamage(weapon.damageDice) + scaledModifier))
  };
}

export function makeLog(kind: CombatLogEntry["kind"], message: string): CombatLogEntry { return { id: cryptoId("log"), kind, message, createdAt: new Date().toISOString() }; }

export function currentCombatant(room: CombatRoom): Combatant | null { const id = room.turnOrder[room.activeTurnIndex] ?? null; return room.combatants.find((combatant) => combatant.id === id) ?? null; }

/** Inversa pura de `footprintCellKey`. Lanza si la clave no respeta el formato "x,y,zFeet". */
export function parseCellKey(key: string): Position {
  const parts = key.split(",");
  if (parts.length !== 3) throw new Error(`Clave de celda inválida: "${key}". Se espera el formato "x,y,zFeet".`);
  const [x, y, zFeet] = parts.map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zFeet)) {
    throw new Error(`Clave de celda inválida: "${key}". Se espera el formato "x,y,zFeet".`);
  }
  return { x, y, zFeet };
}

/** Resultado puro de la intersección de un hazard ambiental persistente contra un combatiente. */
export interface EnvironmentalHazardHit {
  readonly instanceId: string;
  readonly effectId: ProductionEffectId;
  readonly combatantId: string;
}

/**
 * Helper puro (sin dados, sin mutación) que detecta qué combatientes vivos ocupan, al menos
 * parcialmente, alguna celda de peligro (`targetCells`) de los efectos de área persistentes
 * activos en la sala. Reutiliza `getCombatantOccupiedCells` para huellas multiposición (incluye
 * criaturas Large 2×2) y la clave canónica `footprintCellKey` para la comparación de celdas.
 */
export function getEnvironmentalHazardHits(
  snapshot: CombatRulesSnapshot<ProductionEffectId>
): EnvironmentalHazardHit[] {
  const hits: EnvironmentalHazardHit[] = [];
  for (const instance of snapshot.effectInstances) {
    if (!instance.targetCells || instance.targetCells.length === 0) continue;
    const dangerCells = new Set(instance.targetCells);
    for (const combatant of snapshot.combatants) {
      if (lifeStatus(combatant) === "dead") continue;
      const occupied = getCombatantOccupiedCells(combatant, snapshot);
      const isCaught = occupied.some((cell) => dangerCells.has(footprintCellKey(cell)));
      if (isCaught) {
        hits.push({ instanceId: instance.instanceId, effectId: instance.effectId, combatantId: combatant.id });
      }
    }
  }
  return hits;
}
