import type { ArmorClassBonusType, ArmorClassBreakdown, AttackContextModifiers, AttackDeliveryContext, CombatLogEntry, CombatRoom, CombatRulesSnapshot, Combatant, CombatantSnapshot, ConcealmentAssessment, ConcealmentKind, CoverAssessment, CoverKind, LifeStatus, LineOfEffectAssessment, OpportunityAttack, Position, SavingThrowType, SizeCategory, SpecialManeuverId, VisionAssessment, VisionReason, VisionTrace, VisualPathAssessment } from "./types.js";
import type { ConditionalModifier, EffectDefinition, ModifierCondition, Trait, TraitCondition, EffectStat } from "./effects/contracts.js";
import type { CatalogEffectId } from "./effects/types.js";
import { EffectReducer, type MovementRateTrace, type ReducedConcealment, type ReducedEffects } from "./effects/reducer.js";
import { effectsCatalog, type ProductionEffectId } from "./effects/catalog.js";
import { EquipmentCatalog } from "./equipmentCatalog.js";
import { deriveArmorClassBreakdown, deriveMeleeThreatSources, getArmorAdjustedSpeedFeet, getEquippedArmorEntry, getEquippedWeaponEntry, resolveEquippedWeaponProfile } from "./equipmentStats.js";
import { FeatCatalog } from "./featCatalog.js";
import { getSizeRule } from "./sizeRules.js";
import { SpellsCatalog } from "./spells/catalog.js";
import type { SpellSaveDCBreakdown } from "./spells/contracts.js";
import type { AmmunitionKind, WeaponEntry } from "./data/equipment/index.js";

import { cryptoId } from "./demo-data.js";

export interface RuleResult<T> { ok: boolean; value?: T; error?: string; }

export interface LifeStateProjection {
  readonly status: LifeStatus;
  readonly conscious: boolean;
  readonly canAct: boolean;
  readonly usesDisabledActionEconomy: boolean;
  readonly bleedsAtRoundStart: boolean;
  readonly mustBeStable: boolean;
}

export function getLifeStateProjection(combatant: Combatant): LifeStateProjection {
  const lifeRules = FeatCatalog.lifeRules(combatant.featIds ?? []);
  const inNegativeHpRange = combatant.hpCurrent <= -1 && combatant.hpCurrent >= -9;
  const mustBeStable = inNegativeHpRange && lifeRules.autoStabilizeNegativeHp;

  let status: LifeStatus;
  if (combatant.hpCurrent <= -10) status = "dead";
  else if (combatant.hpCurrent < 0 && lifeRules.negativeHpActionState === "disabled") status = "disabled";
  else if (combatant.hpCurrent < 0) status = combatant.isStable ? "stable" : "dying";
  else if (combatant.hpCurrent === 0) status = "disabled";
  else status = "active";

  const conscious = status === "active" || status === "disabled";
  return {
    status,
    conscious,
    canAct: conscious,
    usesDisabledActionEconomy: status === "disabled",
    bleedsAtRoundStart: inNegativeHpRange && !combatant.isStable && lifeRules.bleedsWhileNegative,
    mustBeStable
  };
}

export function lifeStatus(combatant: Combatant): LifeStatus {
  return getLifeStateProjection(combatant).status;
}

export function normalizeLifeStateAfterHpChange(combatant: Combatant): void {
  if (combatant.hpCurrent <= -10 || combatant.hpCurrent >= 0) {
    combatant.isStable = false;
    return;
  }
  if (getLifeStateProjection(combatant).mustBeStable) combatant.isStable = true;
}

export function lifeStatusLabel(status: LifeStatus): string {
  if (status === "active") return "activo";
  if (status === "disabled") return "incapacitado";
  if (status === "dying") return "moribundo";
  if (status === "stable") return "estable";
  return "muerto";
}

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

export function canTakeTurn(combatant: Combatant): RuleResult<true> {
  const status = getLifeStateProjection(combatant).status;
  if (status === "dead") return { ok: false, error: combatant.name + " esta muerto y no puede actuar." };
  if (status === "dying") return { ok: false, error: combatant.name + " esta moribundo e inconsciente." };
  if (status === "stable") return { ok: false, error: combatant.name + " esta estable pero inconsciente." };
  return { ok: true, value: true };
}

export function canDisabledCombatantTakeAction<TCatalog extends Record<string, EffectDefinition>>(
  room: CombatRulesSnapshot<CatalogEffectId<TCatalog>>,
  combatant: Combatant,
  actionKind: "standard" | "move" | "full-round" | "non-action"
): RuleResult<true> {
  if (!getLifeStateProjection(combatant).usesDisabledActionEconomy) return { ok: true, value: true };
  const disabledDescription = combatant.hpCurrent === 0 ? " esta en 0 HP" : " esta incapacitado con " + combatant.hpCurrent + " HP";
  if (actionKind === "full-round") return { ok: false, error: combatant.name + disabledDescription + " y no puede realizar acciones de asalto completo." };
  if (actionKind === "non-action") return { ok: true, value: true };
  
  const alreadyUsedAction = room.currentTurn.usedMoveAction || room.currentTurn.usedStandardAction || room.currentTurn.usedFullAttack || room.currentTurn.usedTotalDefense || room.currentTurn.attacksMade > 0;
  if (alreadyUsedAction) {
    return { ok: false, error: combatant.name + disabledDescription + " y ya consumio su unica accion (movimiento o estandar) de este turno." };
  }
  return { ok: true, value: true };
}

export function applyDamage(combatant: Combatant, damage: number): { hpBefore: number; hpAfter: number; statusBefore: LifeStatus; statusAfter: LifeStatus } {
  const hpBefore = combatant.hpCurrent;
  const statusBefore = lifeStatus(combatant);
  combatant.hpCurrent = Math.max(-10, combatant.hpCurrent - Math.max(0, damage));
  if (damage > 0 && combatant.hpCurrent < 0) combatant.isStable = false;
  normalizeLifeStateAfterHpChange(combatant);
  return { hpBefore, hpAfter: combatant.hpCurrent, statusBefore, statusAfter: lifeStatus(combatant) };
}

export function applyHealing(combatant: Combatant, amount: number): { hpBefore: number; hpAfter: number; statusBefore: LifeStatus; statusAfter: LifeStatus; appliedHealing: number } {
  const hpBefore = combatant.hpCurrent;
  const statusBefore = lifeStatus(combatant);
  const safeAmount = Math.max(0, amount);
  if (lifeStatus(combatant) === "dead") return { hpBefore, hpAfter: combatant.hpCurrent, statusBefore, statusAfter: statusBefore, appliedHealing: 0 };
  combatant.hpCurrent = Math.min(combatant.hpMax, combatant.hpCurrent + safeAmount);
  if (combatant.hpCurrent < 0 && safeAmount > 0) combatant.isStable = true;
  normalizeLifeStateAfterHpChange(combatant);
  const hpAfter = combatant.hpCurrent;
  return { hpBefore, hpAfter, statusBefore, statusAfter: lifeStatus(combatant), appliedHealing: Math.max(0, hpAfter - hpBefore) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contexto de ataque táctico para evaluación situacional de CA
// ─────────────────────────────────────────────────────────────────────────────


export interface DefensiveAbilityProjection {
  readonly effectiveDexterityScore: number;
  readonly dexterityModifier: number;
  readonly suppressDexAndDodge: boolean;
  readonly traitSource: "HELPLESS" | "NO_DEX_TO_AC" | "FLAT_FOOTED" | "NORMAL";
}

export function getDefensiveAbilityProjection(
  combatant: Combatant,
  reduced: ReducedEffects,
  attackContext?: AttackContext,
  contextualTraits?: readonly Trait[]
): DefensiveAbilityProjection {
  const isHelpless = hasEffectTrait(reduced, "HELPLESS") || (contextualTraits && contextualTraits.includes("HELPLESS"));

  if (isHelpless) {
    return {
      effectiveDexterityScore: 0,
      dexterityModifier: -5,
      suppressDexAndDodge: true,
      traitSource: "HELPLESS"
    };
  }

  const effectiveDexScore = _getEffectiveAbilityScoreFromReduced(combatant, "dexterity", reduced);
  const effectiveDexMod = getAbilityModifier(effectiveDexScore);

  const isFlatFooted = attackContext?.isFlatFootedOverride === true;
  const noDex = hasEffectTrait(reduced, "NO_DEX_TO_AC") || (contextualTraits && contextualTraits.includes("NO_DEX_TO_AC"));

  if (noDex || isFlatFooted) {
    return {
      effectiveDexterityScore: effectiveDexScore,
      dexterityModifier: Math.min(0, effectiveDexMod), // if mod is > 0, we suppress it
      suppressDexAndDodge: true,
      traitSource: noDex ? "NO_DEX_TO_AC" : "FLAT_FOOTED"
    };
  }

  return {
    effectiveDexterityScore: effectiveDexScore,
    dexterityModifier: effectiveDexMod,
    suppressDexAndDodge: false,
    traitSource: "NORMAL"
  };
}

export function isValidCoupDeGraceTarget(
  context: CombatRulesSnapshot<any>,
  targetId: string,
  catalog: Record<string, EffectDefinition>
): boolean {
  const target = context.combatants.find(c => c.id === targetId);
  if (!target) return false;
  if (lifeStatus(target) === "dead") return false;
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: context.effectInstances,
    targetId: target.id,
    catalog
  });
  return hasEffectTrait(reduced, "HELPLESS");
}

export interface AttackContext {
  readonly attackType?: "melee" | "ranged";
  readonly targetAcType?: "normal" | "touch";
  readonly abilityForAttack?: "strength" | "dexterity";
  readonly isFlatFootedOverride?: boolean;
  readonly attackerId?: string;
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

function projectStructuredArmorClass(breakdown: ArmorClassBreakdown, attackContext: AttackContext | undefined, suppressDexAndDodge: boolean): { total: number; parts: string[] } {
  const components: Array<{ label: string; type: ArmorClassBonusType | "base"; value: number }> = [
    { label: "base", type: "base", value: breakdown.base },
    { label: "armadura", type: "armor", value: breakdown.armor },
    { label: "escudo", type: "shield", value: breakdown.shield },
    { label: "armadura natural", type: "natural_armor", value: breakdown.naturalArmor },
    { label: "DEX", type: "dex", value: breakdown.dexterity },
    { label: "tamaño", type: "size", value: breakdown.size },
    { label: "esquiva", type: "dodge", value: breakdown.dodge },
    { label: "desvío", type: "deflection", value: breakdown.deflection },
    { label: "misc", type: "misc", value: breakdown.misc }
  ];
  let total = 0;
  const parts: string[] = [];
  for (const component of components) {
    const applies = component.type === "base" || shouldApplyAcModifier(component.value, component.type, attackContext, suppressDexAndDodge);
    if (applies) {
      total += component.value;
      if (component.value !== 0 || component.type === "base") parts.push(component.label + " " + (component.value >= 0 ? "+" : "") + component.value);
    } else if (component.value !== 0) {
      parts.push(component.label + " suprimido -" + component.value);
    }
  }
  return { total, parts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluador de Modificadores Condicionales
//
// Función pura que evalúa los `conditionalModifiers` de los efectos activos
// de un objetivo dado un contexto táctico de ataque.
// ─────────────────────────────────────────────────────────────────────────────

function evaluateConditionalModifiers<TCatalog extends Record<string, EffectDefinition>>(
  applicableInstances: readonly import('./effects/types.js').EffectInstance<keyof TCatalog & string>[],
  catalog: TCatalog,
  attackContext: AttackContext,
  suppressDexAndDodge: boolean,
  targetStat: EffectStat
): { total: number; parts: string[] } {
  let total = 0;
  const parts: string[] = [];
  for (const inst of applicableInstances) {
    const definition = catalog[inst.effectId as string];
    if (!definition?.conditionalModifiers) continue;
    for (const cm of definition.conditionalModifiers) {
      if (cm.stat === targetStat && isConditionMet(cm.condition, attackContext)) {
        if (targetStat === 'AC' && !shouldApplyAcModifier(cm.value, cm.stackingGroup, attackContext, suppressDexAndDodge)) continue;
        total += cm.value;
        parts.push(cm.label);
      }
    }
  }
  return { total, parts };
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
  instance: import("./effects/types.js").EffectInstance,
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
  applicableInstances: readonly import("./effects/types.js").EffectInstance<keyof TCatalog & string>[],
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
function _getEffectiveAbilityScoreFromReduced(combatant: Combatant, ability: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma', reduced: import('./effects/reducer.js').ReducedEffects): number {
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
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: context.effectInstances,
    targetId: combatant.id,
    catalog: effectsCatalog
  });
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
  const reduced = EffectReducer.reduceEffectsForTarget(reductionInput);
  const rate = EffectReducer.reduceMovementRateContributions(reductionInput);
  const deltaSpeed = reduced.numericModifiers["SPEED"]?.total ?? 0;
  const legacyBuffBonus = combatant.buffs.reduce((sum, buff) => sum + (buff.speedBonusFeet ?? 0), 0);
  const armorAdjustedSpeed = getArmorAdjustedSpeedFeet(combatant);
  const beforeRate = Math.max(0, armorAdjustedSpeed + legacyBuffBonus + deltaSpeed);
  const parts = [
    `base/equipo ${armorAdjustedSpeed} ft`,
    ...(legacyBuffBonus !== 0 ? [`buffs ${legacyBuffBonus >= 0 ? "+" : ""}${legacyBuffBonus} ft`] : []),
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
      attackContext?: Pick<AttackContext, "abilityForAttack" | "attackType">
    ): { total: number; parts: string[] } {
      const applicable = context.effectInstances.filter(
        (inst) => inst.targets !== undefined && inst.targets.includes(combatant.id)
      );
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });
      const deltaAttack = reduced.numericModifiers["ATTACK"]?.total ?? 0;
      const legacyBuffBonus = combatant.buffs.reduce((sum, buff) => sum + (buff.attackBonus ?? 0), 0);
      const attackAbility = attackContext?.abilityForAttack ?? resolveEquippedWeaponProfile(combatant).profile.abilityForAttack;
      const effectiveAbilityScore = _getEffectiveAbilityScoreFromReduced(combatant, attackAbility, reduced);
      const selectedModifier = getAbilityModifier(effectiveAbilityScore) + getSizeRule(combatant.sizeCategory).attackAndAcModifier;

      let conditionalDelta = 0;
      let conditionalParts: string[] = [];
      if (attackContext && attackContext.attackType) {
        // cast to full AttackContext, we only need attackType for "attack_type" condition
        const fullContext = attackContext as AttackContext;
        const conditional = evaluateConditionalModifiers(applicable, catalog, fullContext, false, "ATTACK");
        conditionalDelta = conditional.total;
        conditionalParts = conditional.parts;
      }

      const total = combatant.baseAttackBonus + selectedModifier + legacyBuffBonus + deltaAttack + conditionalDelta;
      const parts: string[] = [
        "BAB +" + combatant.baseAttackBonus,
        "mod " + (selectedModifier >= 0 ? "+" : "") + selectedModifier,
        legacyBuffBonus ? "buffs +" + legacyBuffBonus : "buffs +0"
      ];
      if (deltaAttack !== 0) parts.push("efectos " + (deltaAttack >= 0 ? "+" : "") + deltaAttack);
      parts.push(...conditionalParts);
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
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });
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

      const projected = projectStructuredArmorClass(armorClassBreakdown, attackContext, suppressDexAndDodge);
      const baseAC = projected.total;
      const parts = projected.parts;

      const legacyBuffBonus = combatant.buffs.reduce((sum, buff) => {
        const value = buff.acBonus ?? 0;
        return sum + (shouldApplyAcModifier(value, buff.acBonusType, attackContext, suppressDexAndDodge) ? value : 0);
      }, 0);

      const coverBonus = attackContext?.cover?.acBonus ?? 0;

      const acModifier = reduced.numericModifiers["AC"];
      let deltaAC = [...(acModifier?.bonuses ?? []), ...(acModifier?.penalties ?? [])]
        .filter((trace) => trace.status === "applied")
        .reduce((sum, trace) => sum + (shouldApplyAcModifier(trace.value, trace.stackingGroup, attackContext, suppressDexAndDodge) ? trace.value : 0), 0);

      let conditionalDelta = 0;
      if (attackContext) {
        const conditional = evaluateConditionalModifiers(applicable, catalog, attackContext, suppressDexAndDodge, "AC");
        conditionalDelta = conditional.total;
        parts.push(...conditional.parts);
      }

      if (coverBonus > 0) {
        parts.push("cobertura +" + coverBonus);
      }

      const total = baseAC + legacyBuffBonus + deltaAC + conditionalDelta + coverBonus + featDodgeBonus;
      parts.push(legacyBuffBonus ? "buffs " + (legacyBuffBonus >= 0 ? "+" : "") + legacyBuffBonus : "buffs +0");
      if (deltaAC !== 0) parts.push("efectos " + (deltaAC >= 0 ? "+" : "") + deltaAC);
      parts.push(...featDodgeParts);
      return { total, parts };
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
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });
      if (hasEffectTrait(reduced, "CANNOT_ACT")) {
        return { ok: false, error: combatant.name + " esta incapacitado y no puede realizar acciones." };
      }
      return { ok: true, value: true };
    },

    canMakeOpportunityAttack(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant,
      targetId?: string
    ): boolean {
      if (combatant.buffs.some((buff) => buff.preventsOpportunityAttacks)) return false;
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });
      if (hasEffectTrait(reduced, "CANNOT_MAKE_AOO")) return false;

      let maxAooAllowed = 1;
      if (combatant.featIds.includes("srd_combat_reflexes")) {
        const effectiveDex = _getEffectiveAbilityScoreFromReduced(combatant, "dexterity", reduced);
        maxAooAllowed = 1 + Math.max(0, getAbilityModifier(effectiveDex));
      }

      if ((combatant.stats.opportunityAttacksThisRound ?? 0) >= maxAooAllowed) return false;

      if (targetId && combatant.stats.targetsAttackedThisRoundViaAoO?.includes(targetId)) {
        return false;
      }

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
          if (threatensTarget(prodSnapshot, enemy, combatant) && this.canMakeOpportunityAttack(snapshot, enemy, combatant.id)) {
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
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });
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
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });

      let baseSave = 0;
      let associatedAbility: "constitution" | "dexterity" | "wisdom" = "constitution";
      let statKey: import("./effects/contracts.js").EffectStat = "FORTITUDE";

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

export function getSpecialManeuverSizeModifier(sizeCategory: SizeCategory): number {
  return getSizeRule(sizeCategory).grappleModifier;
}

export function distanceFeet(from: Position, to: Position, cellSizeFeet: number): number {
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  const diagonals = Math.min(dx, dy);
  const straight = Math.max(dx, dy) - diagonals;
  return Math.floor(diagonals / 2) * cellSizeFeet * 3 + (diagonals % 2) * cellSizeFeet + straight * cellSizeFeet;
}
export function isAdjacent(a: Position, b: Position): boolean { const dx = Math.abs(a.x - b.x); const dy = Math.abs(a.y - b.y); return dx <= 1 && dy <= 1 && dx + dy > 0; }

export function validateMove<TCatalog extends Record<string, EffectDefinition>>(room: CombatRulesSnapshot<CatalogEffectId<TCatalog>>, combatant: Combatant, to: Position, totalSpeedFeet: number): RuleResult<number> {
  const result = validateMovePath(room, combatant, [to], totalSpeedFeet);
  if (!result.ok || result.value === undefined) return { ok: false, error: result.error };
  return { ok: true, value: result.value.distanceFeet };
}

export function isImpassable(context: CombatRulesSnapshot<any>, x: number, y: number): boolean {
  if (!context.board.impassableCells) return false;
  return context.board.impassableCells.includes(`${x},${y}`);
}

export function validateMovePath<TCatalog extends Record<string, EffectDefinition>>(
  context: CombatRulesSnapshot<CatalogEffectId<TCatalog>>,
  combatant: Combatant,
  path: Position[],
  totalSpeedFeet: number,
  isFiveFootStep: boolean = false,
  isAcrobatic: boolean = false
): RuleResult<{
  distanceFeet: number;
  path: Position[];
  steps: MovementStepProjection[];
  finalSpatialMode: SpatialMode;
}> {
  if (context.activeAttackThreat) return { ok: false, error: "Hay una amenaza de critico pendiente. Resolvela antes de continuar." };
  const turnCheck = canTakeTurn(combatant);
  if (!turnCheck.ok) return { ok: false, error: turnCheck.error };
  if (path.length === 0) return { ok: false, error: "Elegi al menos una casilla de destino." };

  let current = combatant.position;
  const visited = new Set<string>();
  const occupancyIndex = createFootprintOccupancyIndex(context);
  const steps: MovementStepProjection[] = [];

  if (isFiveFootStep && getCombatantOccupiedCellsAt(combatant, context, current).some((cell) => isDifficultTerrain(context, cell.x, cell.y))) {
    return { ok: false, error: "No puedes dar un paso de 5 pies desde terreno dificil." };
  }

  for (let index = 0; index < path.length; index++) {
    const step = path[index];
    const dx = Math.abs(current.x - step.x);
    const dy = Math.abs(current.y - step.y);
    if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) return { ok: false, error: "La ruta debe avanzar de a una casilla adyacente." };

    const projection = projectMovementFootprint(context, combatant, step, {
      dx: Math.sign(step.x - current.x),
      dy: Math.sign(step.y - current.y)
    });
    if (!projection) {
      const naturalCells = getNaturalCombatantOccupiedCellsAt(combatant, context, step);
      if (naturalCells.some((cell) => !isPositionInsideBoard(context, cell))) return { ok: false, error: "La ruta sale del tablero." };
      return { ok: false, error: "La huella del combatiente colisiona con un muro u obstaculo intransitable." };
    }
    const stepCells = projection.occupiedCells;

    if (isFiveFootStep && stepCells.some((cell) => isDifficultTerrain(context, cell.x, cell.y))) {
      return { ok: false, error: "No puedes dar un paso de 5 pies hacia terreno dificil." };
    }

    const occupiedCombatants = getCombatantsIntersectingCells(occupancyIndex, stepCells, combatant.id)
      .filter((other) => lifeStatus(other) !== "dead");
    const isLast = index === path.length - 1;
    for (const occupied of occupiedCombatants) {
      const isAlly = occupied.type === combatant.type;
      const occupiedStatus = lifeStatus(occupied);
      const isHelpless = occupiedStatus === "dying" || occupiedStatus === "stable" || occupiedStatus === "dead";
      if (isLast && !isHelpless) return { ok: false, error: "La ruta no puede terminar en la casilla ocupada por " + occupied.name + "." };
      if (!isLast && !isAlly && !isHelpless && !isAcrobatic) return { ok: false, error: "La ruta no puede atravesar la casilla ocupada por el enemigo " + occupied.name + "." };
    }

    if (dx === 1 && dy === 1) {
      const horizontalAnchor = { x: step.x, y: current.y, zFeet: step.zFeet ?? current.zFeet ?? 0 };
      const verticalAnchor = { x: current.x, y: step.y, zFeet: step.zFeet ?? current.zFeet ?? 0 };
      if (
        isCornerAnchorBlockedByTerrain(context, combatant, horizontalAnchor) ||
        isCornerAnchorBlockedByTerrain(context, combatant, verticalAnchor)
      ) {
        return { ok: false, error: "No puedes moverte en diagonal a traves de una esquina bloqueada por un obstaculo solido." };
      }
    }

    const key = step.x + "," + step.y;
    if (visited.has(key)) return { ok: false, error: "La ruta no puede pasar dos veces por la misma casilla." };
    visited.add(key);

    steps.push({
      position: { ...step },
      occupiedCells: stepCells.map((cell) => ({ ...cell })),
      spatialMode: projection.spatialMode,
      ...(projection.squeezingAxis ? { squeezingAxis: projection.squeezingAxis } : {}),
      cumulativeCostFeet: 0
    });
    current = step;
  }

  const cumulativeCosts = calculatePathStepCostsFeet(combatant.position, path, context, isAcrobatic);
  for (let index = 0; index < steps.length; index++) {
    steps[index] = { ...steps[index], cumulativeCostFeet: cumulativeCosts[index] ?? 0 };
  }
  const distance = cumulativeCosts[cumulativeCosts.length - 1] ?? 0;
  const available = totalSpeedFeet - context.currentTurn.movementUsedFeet;
  if (distance > available) return { ok: false, error: combatant.name + " intenta mover " + distance + " pies, pero solo tiene " + available + " pies disponibles." };
  if (!isFiveFootStep && context.currentTurn.usedFiveFootStep && distance > 0) return { ok: false, error: "Ya uso paso de 5 pies este turno." };
  return {
    ok: true,
    value: {
      distanceFeet: distance,
      path,
      steps,
      finalSpatialMode: steps[steps.length - 1]?.spatialMode ?? "natural"
    }
  };
}

export function canUseMoveAction(room: CombatRulesSnapshot<ProductionEffectId>, actor: Combatant): RuleResult<true> {
  if (room.activeAttackThreat) return { ok: false, error: "Hay una amenaza de critico pendiente. Resolvela antes de continuar." };
  const turnCheck = canTakeTurn(actor);
  if (!turnCheck.ok) return turnCheck;
  if (hasActiveTrait(room, actor, "CANNOT_MOVE")) return { ok: false, error: actor.name + " no puede moverse voluntariamente mientras esté paralizado o en presa." };
  if (room.currentTurn.usedTotalDefense) return { ok: false, error: actor.name + " ya uso Defensa total y renuncio al resto de acciones del turno." };

  const disabledCheck = canDisabledCombatantTakeAction(room, actor, "move");
  if (!disabledCheck.ok) return disabledCheck;

  if (room.currentTurn.usedFullAttack || room.currentTurn.attacksMade > 1) return { ok: false, error: "Ya uso una accion de asalto completo." };
  if (room.currentTurn.usedMoveAction) return { ok: false, error: "Ya uso su accion de movimiento." };
  return { ok: true, value: true };
}

export function canFullAttack<TCatalog extends Record<string, EffectDefinition>>(room: CombatRulesSnapshot<CatalogEffectId<TCatalog>>, attacker: Combatant): RuleResult<true> {
  if (room.activeAttackThreat) return { ok: false, error: "Hay una amenaza de critico pendiente. Resolvela antes de continuar." };
  const turnCheck = canTakeTurn(attacker);
  if (!turnCheck.ok) return turnCheck;
  if (room.currentTurn.usedTotalDefense) return { ok: false, error: attacker.name + " ya uso Defensa total y no puede atacar este turno." };

  const disabledCheck = canDisabledCombatantTakeAction(room, attacker, "full-round");
  if (!disabledCheck.ok) return disabledCheck;

  if (room.currentTurn.movementUsedFeet > room.board.cellSizeFeet) return { ok: false, error: "No puede hacer ataque completo despues de moverse mas de 5 pies." };
  if (room.currentTurn.usedStandardAction || room.currentTurn.usedFullAttack) return { ok: false, error: "Ya uso su accion ofensiva este turno." };
  return { ok: true, value: true };
}

/**
 * Sprint 041 (MOVE-RUN): gate puro de la accion de asalto completo "Correr", analogo a
 * `canCharge` (chargeResolver.ts). Vive en el Rule Engine (no en el servidor) por el
 * principio de arquitectura del proyecto: toda la logica de reglas permanece en funciones
 * puras aqui, el servidor solo orquesta. Reutiliza `canFullAttack` (economia de turno +
 * gate de Disabled para acciones de asalto completo) y consume el override declarativo
 * `FORBID_RUN` (ya declarado en `srd_fatigued` desde antes de este sprint, sin consumidor
 * hasta ahora), exactamente como `FORBID_CHARGE` ya es consumido por Carga.
 */
export function canRun(room: CombatRulesSnapshot<ProductionEffectId>, combatant: Combatant): RuleResult<true> {
  const turnCheck = canFullAttack(room, combatant);
  if (!turnCheck.ok) return turnCheck;
  if (room.currentTurn.movementUsedFeet > 0 || room.currentTurn.usedMoveAction || room.currentTurn.usedFiveFootStep) {
    return { ok: false, error: combatant.name + " ya se movio este turno; Correr exige el turno completo sin movimiento previo." };
  }
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: combatant.id,
    catalog: effectsCatalog
  });
  if (reduced.ruleOverrides.includes("FORBID_RUN")) {
    return { ok: false, error: combatant.name + " no puede correr en su estado actual." };
  }
  return { ok: true, value: true };
}

/**
 * Sprint 041 (MOVE-RUN): multiplicador RAW de Correr segun categoria de armadura equipada
 * (pag. 148 del corpus): x4 sin armadura o con armadura ligera/media, x3 con armadura pesada.
 * Reutiliza la categoria ya expuesta por `getEquippedArmorEntry` (EquipmentCatalog) — sin
 * nueva data.
 */
export function runSpeedMultiplier(combatant: Combatant): 3 | 4 {
  return getEquippedArmorEntry(combatant)?.category === "heavy" ? 3 : 4;
}

/**
 * Sprint 041 (MOVE-RUN): presupuesto de movimiento de Correr, calculado SIEMPRE sobre la
 * velocidad efectiva ya resuelta (`Rules.totalSpeedFeet`, que ya incorpora Prisa/Haste,
 * penalizador de velocidad por armadura, etc.) y nunca sobre la velocidad base cruda —
 * riesgo explicito registrado en el NDD (docs/designs/run-design.md §4).
 */
export function runSpeedBudgetFeet(room: CombatRulesSnapshot<ProductionEffectId>, combatant: Combatant): number {
  return Rules.totalSpeedFeet(room, combatant) * runSpeedMultiplier(combatant);
}

/**
 * Sprint 041 (MOVE-RUN): geometria de linea recta, consolidada aqui como unica fuente de
 * verdad (antes vivia privada y duplicada en `chargeResolver.ts`). Carga la reutiliza sin
 * cambio de comportamiento; Correr la usa para derivar el camino canonico desde la posicion
 * actual del combatiente hasta el destino solicitado por el cliente, sin confiar en ningun
 * camino intermedio enviado por el cliente (evita una segunda implementacion de geometria).
 * Devuelve null si el destino no es alcanzable en linea recta (ni ortogonal ni diagonal de 45°).
 */
export function buildStraightPath(origin: Position, destination: Position): Position[] | null {
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return null;
  const path: Position[] = [];
  for (let index = 1; index <= steps; index += 1) path.push({ x: origin.x + stepX * index, y: origin.y + stepY * index, zFeet: origin.zFeet });
  return path;
}

export function canStandardAttack<TCatalog extends Record<string, EffectDefinition>>(room: CombatRulesSnapshot<CatalogEffectId<TCatalog>>, attacker: Combatant): RuleResult<true> {
  if (room.activeAttackThreat) return { ok: false, error: "Hay una amenaza de critico pendiente. Resolvela antes de continuar." };
  const turnCheck = canTakeTurn(attacker);
  if (!turnCheck.ok) return turnCheck;
  if (room.currentTurn.usedTotalDefense) return { ok: false, error: attacker.name + " ya uso Defensa total y no puede atacar este turno." };

  const disabledCheck = canDisabledCombatantTakeAction(room, attacker, "standard");
  if (!disabledCheck.ok) return disabledCheck;

  if (room.currentTurn.usedStandardAction || room.currentTurn.usedFullAttack) return { ok: false, error: "Ya uso su accion ofensiva este turno." };
  return { ok: true, value: true };
}

export function findTriggeredOpportunityAttacks(
  room: CombatRulesSnapshot<ProductionEffectId>,
  mover: Combatant,
  destination: Position,
  distanceMovedFeet: number,
  canMakeAoO: (combatant: Combatant) => boolean
): OpportunityAttack[] {
  return findTriggeredOpportunityAttacksForPath(room, mover, [destination], distanceMovedFeet, canMakeAoO);
}

const NO_EXEMPT_DEPARTURE_CELLS: ReadonlySet<string> = new Set();

export function findTriggeredOpportunityAttacksForPath(
  room: CombatRulesSnapshot<ProductionEffectId>,
  mover: Combatant,
  path: Position[],
  distanceMovedFeet: number,
  canMakeAoO: (combatant: Combatant) => boolean,
  isAcrobatic: boolean = false,
  /**
   * MOVE-WITHDRAW: celdas (claves `footprintCellKey`) cuya salida NO dispara AdO.
   * Uso: la huella inicial completa de una Retirada. Default neutro (conjunto vacío):
   * los call sites existentes conservan su comportamiento exacto. La exención filtra
   * únicamente el evento de provocación; jamás toca la capacidad del reactor
   * (`canMakeAoO` / AOO-03 / Reflejos de Combate siguen decidiendo).
   */
  exemptDepartureCellKeys: ReadonlySet<string> = NO_EXEMPT_DEPARTURE_CELLS
): OpportunityAttack[] {
  if (distanceMovedFeet <= room.board.cellSizeFeet || path.length === 0) return [];
  if (lifeStatus(mover) === "dead" || lifeStatus(mover) === "dying" || lifeStatus(mover) === "stable") return [];
  const destination = path[path.length - 1];
  const opportunities: OpportunityAttack[] = [];
  const triggeredAttackerIds = new Set<string>();
  const reactors = room.combatants
    .filter((other) => other.id !== mover.id && other.type !== mover.type)
    .filter((other) => lifeStatus(other) === "active" && canMakeAoO(other))
    .filter((other) => canProjectMeleeThreat(room, other))
    .map((other) => ({
      combatant: other,
      geometry: getCombatantFootprintGeometry(other, room),
      threatSources: deriveMeleeThreatSources(other)
    }));
  let origin = mover.position;
  let costBeforeOrigin = 0;
  let diagonalSteps = 0;

  for (const step of path) {
    const dx = Math.abs(origin.x - step.x);
    const dy = Math.abs(origin.y - step.y);
    const stepCost = dx === 1 && dy === 1 ? (++diagonalSteps % 2 === 1 ? room.board.cellSizeFeet : room.board.cellSizeFeet * 2) : room.board.cellSizeFeet;
    const originCells = getCombatantOccupiedCellsAt(mover, room, origin);
    const stepCellKeys = new Set(getCombatantOccupiedCellsAt(mover, room, step).map(footprintCellKey));
    const abandonedCells = originCells.filter((cell) => {
      const key = footprintCellKey(cell);
      return !stepCellKeys.has(key) && !exemptDepartureCellKeys.has(key);
    });
    for (const reactor of reactors) {
      const other = reactor.combatant;
      if (triggeredAttackerIds.has(other.id)) continue;
      const provokingCells = abandonedCells.filter((cell) => {
        const distance = distanceBetweenFootprintGeometriesFeet(
          reactor.geometry,
          projectFootprintGeometry([cell]),
          room.board.cellSizeFeet
        );
        return hasMeleeThreatFromSourcesAtDistance(reactor.threatSources, distance);
      });
      if (provokingCells.length === 0) continue;
      triggeredAttackerIds.add(other.id);
      opportunities.push({
        id: cryptoId("aoo"),
        attackerId: other.id,
        targetId: mover.id,
        attackerPosition: { ...other.position },
        origin: { ...origin },
        destination: { ...destination },
        movementCostFeet: Math.max(0, distanceMovedFeet - costBeforeOrigin),
        reason: mover.name + " abandona una casilla amenazada por " + other.name + " durante su ruta de movimiento.",
        createdAt: new Date().toISOString(),
        provokingCells: provokingCells.map((cell) => ({ ...cell })),
        ...(isAcrobatic ? { requiredCd: 15 as const } : {})
      });
    }
    costBeforeOrigin += stepCost;
    origin = step;
  }

  return opportunities;
}

export function makeLog(kind: CombatLogEntry["kind"], message: string): CombatLogEntry { return { id: cryptoId("log"), kind, message, createdAt: new Date().toISOString() }; }
export function currentCombatant(room: CombatRoom): Combatant | null { const id = room.turnOrder[room.activeTurnIndex] ?? null; return room.combatants.find((combatant) => combatant.id === id) ?? null; }

export function isDifficultTerrain(context: CombatRulesSnapshot<any>, x: number, y: number): boolean {
  if (!context.board.difficultTerrainCells) return false;
  return context.board.difficultTerrainCells.includes(`${x},${y}`);
}

export function calculatePathStepCostsFeet(origin: Position, path: Position[], context: CombatRulesSnapshot<any>, isAcrobatic: boolean = false): number[] {
  let current = origin;
  let distance = 0;
  let diagonals = 0;
  const costs: number[] = [];
  const cellSizeFeet = context.board.cellSizeFeet;

  for (const step of path) {
    const dx = Math.abs(current.x - step.x);
    const dy = Math.abs(current.y - step.y);
    const isDT = isDifficultTerrain(context, step.x, step.y);
    const isNarrow = context.board.narrowCells?.includes(`${step.x},${step.y}`);

    let stepCost = 0;
    if (dx === 1 && dy === 1) {
      diagonals += 1;
      const isFirstOfPair = (diagonals % 2 === 1);
      if (isDT) {
        stepCost = isFirstOfPair ? 15 : 20;
      } else {
        stepCost = isFirstOfPair ? cellSizeFeet : cellSizeFeet * 2;
      }
    } else if (dx + dy > 0) {
      stepCost = isDT ? cellSizeFeet * 2 : cellSizeFeet;
    }

    if (isAcrobatic) stepCost *= 2;
    if (isNarrow) stepCost *= 2;

    distance += stepCost;
    costs.push(distance);
    current = step;
  }
  return costs;
}

export function calculatePathCostFeet(origin: Position, path: Position[], context: CombatRulesSnapshot<any>, isAcrobatic: boolean = false): number {
  if (path.length === 0) return 0;
  const costs = calculatePathStepCostsFeet(origin, path, context, isAcrobatic);
  return costs[costs.length - 1] ?? 0;
}

export function isCriticalThreat(d20Roll: number, attackTotal: number, targetAC: number, threatFrom: number): boolean {
  if (d20Roll === 1) return false;
  return (d20Roll >= threatFrom && attackTotal >= targetAC) || d20Roll === 20;
}

export function isCriticalConfirmed(confirmD20Roll: number, attackBonusTotal: number, targetAC: number): boolean {
  if (confirmD20Roll === 1) return false;
  if (confirmD20Roll === 20) return true;
  return confirmD20Roll + attackBonusTotal >= targetAC;
}

export function getWeaponAttackTypeForTarget(room: CombatRulesSnapshot<ProductionEffectId>, attacker: Combatant, target: Combatant): "melee" | "ranged" {
  const weapon = resolveEquippedWeaponProfile(attacker).profile;
  if (!weapon || weapon.handedness !== "ranged" && weapon.handedness !== "thrown") return "melee";
  if (weapon.handedness === "ranged") return "ranged";
  const distance = distanceBetweenFootprintsFeet(room, attacker, target);
  return distance <= weapon.meleeReachFeet ? "melee" : "ranged";
}

function getNaturalCombatantOccupiedCellsAt(
  combatant: CombatantSnapshot,
  snapshot: CombatRulesSnapshot,
  position: Position
): Position[] {
  const sizeRule = getSizeRule(combatant.sizeCategory ?? "medium");
  const cellsPerSide = Math.max(1, Math.ceil(sizeRule.spaceFeet / snapshot.board.cellSizeFeet));
  const cells: Position[] = [];
  for (let dy = 0; dy < cellsPerSide; dy++) {
    for (let dx = 0; dx < cellsPerSide; dx++) {
      cells.push({ x: position.x + dx, y: position.y + dy, zFeet: position.zFeet ?? 0 });
    }
  }
  return cells;
}

export type SpatialMode = "natural" | "squeezing";
export type SqueezingAxis = "horizontal" | "vertical";

export interface MovementStepProjection {
  readonly position: Position;
  readonly occupiedCells: readonly Position[];
  readonly spatialMode: SpatialMode;
  readonly squeezingAxis?: SqueezingAxis;
  readonly cumulativeCostFeet: number;
}

interface MovementFootprintProjection {
  readonly occupiedCells: Position[];
  readonly spatialMode: SpatialMode;
  readonly squeezingAxis?: SqueezingAxis;
}

function isSqueezingCombatant(snapshot: CombatRulesSnapshot, combatantId: string): boolean {
  return snapshot.effectInstances?.some((instance) =>
    instance.effectId === "srd_squeezing" && instance.targets?.includes(combatantId)
  ) ?? false;
}

function isNarrowCell(snapshot: CombatRulesSnapshot, cell: Pick<Position, "x" | "y">): boolean {
  return snapshot.board.narrowCells?.includes(`${cell.x},${cell.y}`) ?? false;
}

function getSqueezedFootprintAt(
  combatant: CombatantSnapshot,
  snapshot: CombatRulesSnapshot,
  position: Position,
  preferredAxis?: SqueezingAxis
): MovementFootprintProjection | null {
  const naturalCells = getNaturalCombatantOccupiedCellsAt(combatant, snapshot, position);
  const naturalGeometry = projectFootprintGeometry(naturalCells);
  const width = naturalGeometry.maxX - naturalGeometry.minX + 1;
  const height = naturalGeometry.maxY - naturalGeometry.minY + 1;
  if (width !== 2 || height !== 2) return null;

  const zFeet = position.zFeet ?? 0;
  const candidates: Array<{ axis: SqueezingAxis; cells: Position[] }> = [
    {
      axis: "horizontal",
      cells: [
        { x: position.x, y: position.y, zFeet },
        { x: position.x + 1, y: position.y, zFeet }
      ]
    },
    {
      axis: "vertical",
      cells: [
        { x: position.x, y: position.y, zFeet },
        { x: position.x, y: position.y + 1, zFeet }
      ]
    }
  ];
  const legal = candidates.filter((candidate) => candidate.cells.every((cell) =>
    isPositionInsideBoard(snapshot, cell) &&
    !isImpassable(snapshot, cell.x, cell.y) &&
    isNarrowCell(snapshot, cell)
  ));
  const selected = preferredAxis
    ? legal.find((candidate) => candidate.axis === preferredAxis)
    : legal[0];
  return selected ? { occupiedCells: selected.cells, spatialMode: "squeezing", squeezingAxis: selected.axis } : null;
}

function projectMovementFootprint(
  snapshot: CombatRulesSnapshot,
  combatant: CombatantSnapshot,
  position: Position,
  direction: { dx: number; dy: number }
): MovementFootprintProjection | null {
  const naturalCells = getNaturalCombatantOccupiedCellsAt(combatant, snapshot, position);
  const naturalIsLegal = naturalCells.every((cell) =>
    isPositionInsideBoard(snapshot, cell) && !isImpassable(snapshot, cell.x, cell.y)
  );
  const touchesNarrow = naturalCells.some((cell) => isNarrowCell(snapshot, cell));
  const isLargeSquare = naturalCells.length === 4;
  if (touchesNarrow && isLargeSquare && direction.dx !== 0 && direction.dy !== 0) return null;
  const preferredAxis: SqueezingAxis = direction.dx !== 0 ? "horizontal" : "vertical";
  if (touchesNarrow && isLargeSquare) {
    const squeezed = getSqueezedFootprintAt(combatant, snapshot, position, preferredAxis);
    if (squeezed) return squeezed;
  }
  if (naturalIsLegal) return { occupiedCells: naturalCells, spatialMode: "natural" };
  if (direction.dx !== 0 && direction.dy !== 0) return null;
  return getSqueezedFootprintAt(combatant, snapshot, position, preferredAxis);
}

function getCombatantOccupiedCellsAt(
  combatant: CombatantSnapshot,
  snapshot: CombatRulesSnapshot,
  position: Position
): Position[] {
  if (isSqueezingCombatant(snapshot, combatant.id)) {
    const squeezed = getSqueezedFootprintAt(combatant, snapshot, position);
    if (squeezed) return squeezed.occupiedCells;
  }
  return getNaturalCombatantOccupiedCellsAt(combatant, snapshot, position);
}

export interface AmmunitionState {
  readonly required: boolean;
  readonly ammunitionKind?: AmmunitionKind;
  readonly availableQuantity: number;
  readonly selectedItemId?: string;
}

export function getAmmunitionState(combatant: Combatant, weapon: WeaponEntry | undefined = getEquippedWeaponEntry(combatant)): AmmunitionState {
  if (!weapon || EquipmentCatalog.getRangedDelivery(weapon) !== "projectile") {
    return { required: false, availableQuantity: 0 };
  }
  const ammunitionKind = weapon.requiredAmmunitionKind;
  if (!ammunitionKind) throw new Error(`Invariante de catálogo violada: ${weapon.id} no declara munición requerida.`);
  const compatible = combatant.inventory
    .filter((item) => {
      const candidate = EquipmentCatalog.getWeapon(item.catalogId);
      return candidate?.isAmmunition === true && candidate.ammunitionKind === ammunitionKind;
    })
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
  const availableQuantity = compatible.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const selectedItemId = compatible.find((item) => (item.quantity ?? 0) > 0)?.itemId;
  return { required: true, ammunitionKind, availableQuantity, ...(selectedItemId ? { selectedItemId } : {}) };
}

export function validateAttackAmmunition(combatant: Combatant, weapon: WeaponEntry | undefined = getEquippedWeaponEntry(combatant)): RuleResult<AmmunitionState> {
  const state = getAmmunitionState(combatant, weapon);
  if (state.required && (!state.selectedItemId || state.availableQuantity <= 0)) {
    return { ok: false, error: `No queda munición compatible para ${weapon?.name ?? "el arma equipada"}.` };
  }
  return { ok: true, value: state };
}

export function consumeInventoryQuantity(combatant: Combatant, itemId: string, amount = 1): Combatant {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`Cantidad de consumo inválida: ${amount}.`);
  const current = combatant.inventory.find((item) => item.itemId === itemId);
  if (!current) throw new Error(`El inventario de ${combatant.name} no contiene ${itemId}.`);
  const quantity = current.quantity;
  if (quantity === undefined || quantity < amount) throw new Error(`Stock insuficiente en ${itemId}.`);
  return {
    ...combatant,
    inventory: combatant.inventory.map((item) => item.itemId === itemId ? { ...item, quantity: quantity - amount } : { ...item }),
    equipmentSlots: { ...combatant.equipmentSlots }
  };
}

/** Deriva de forma autoritativa las celdas ocupadas desde tamaño, ancla y escala del tablero. */
export function getCombatantOccupiedCells(
  combatant: CombatantSnapshot,
  snapshot: CombatRulesSnapshot
): Position[] {
  return getCombatantOccupiedCellsAt(combatant, snapshot, combatant.position);
}

/** Clave canónica de celda de grid ("x,y,zFeet"). Única fuente de serialización compartida por
 * footprints de combatientes, intersección de AoE de conjuros y hazards ambientales persistentes. */
export function footprintCellKey(position: Pick<Position, "x" | "y" | "zFeet">): string {
  return `${position.x},${position.y},${position.zFeet ?? 0}`;
}

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

interface FootprintGeometry {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly zFeet: number;
}

function projectFootprintGeometry(cells: readonly Position[]): FootprintGeometry {
  const first = cells[0];
  if (!first) throw new Error("Una huella de combatiente debe contener al menos una celda.");
  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;
  for (let index = 1; index < cells.length; index++) {
    const cell = cells[index];
    minX = Math.min(minX, cell.x);
    maxX = Math.max(maxX, cell.x);
    minY = Math.min(minY, cell.y);
    maxY = Math.max(maxY, cell.y);
  }
  return { minX, maxX, minY, maxY, zFeet: first.zFeet ?? 0 };
}

function getCombatantFootprintGeometry(
  combatant: CombatantSnapshot,
  snapshot: CombatRulesSnapshot
): FootprintGeometry {
  return projectFootprintGeometry(getCombatantOccupiedCells(combatant, snapshot));
}

function distanceBetweenFootprintGeometriesFeet(
  first: FootprintGeometry,
  second: FootprintGeometry,
  cellSizeFeet: number
): number {
  const dx = Math.max(0, second.minX - first.maxX, first.minX - second.maxX);
  const dy = Math.max(0, second.minY - first.maxY, first.minY - second.maxY);
  return distanceFeet(
    { x: 0, y: 0, zFeet: first.zFeet },
    { x: dx, y: dy, zFeet: second.zFeet },
    cellSizeFeet
  );
}

function isPositionInsideBoard(snapshot: CombatRulesSnapshot, position: Pick<Position, "x" | "y">): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < snapshot.board.width && position.y < snapshot.board.height;
}

type FootprintOccupancyIndex = ReadonlyMap<string, readonly Combatant[]>;

function createFootprintOccupancyIndex(snapshot: CombatRulesSnapshot): FootprintOccupancyIndex {
  const index = new Map<string, Combatant[]>();
  for (const combatant of snapshot.combatants as Combatant[]) {
    for (const cell of getCombatantOccupiedCells(combatant, snapshot)) {
      const key = footprintCellKey(cell);
      const occupants = index.get(key);
      if (occupants) occupants.push(combatant);
      else index.set(key, [combatant]);
    }
  }
  return index;
}

function getCombatantsIntersectingCells(
  occupancyIndex: FootprintOccupancyIndex,
  cells: readonly Position[],
  exceptId?: string
): Combatant[] {
  const intersecting = new Map<string, Combatant>();
  for (const cell of cells) {
    for (const combatant of occupancyIndex.get(footprintCellKey(cell)) ?? []) {
      if (combatant.id !== exceptId) intersecting.set(combatant.id, combatant);
    }
  }
  return [...intersecting.values()];
}

/**
 * Sprint 037: comprobación pura y exclusiva de terreno/límites del tablero para el corte de
 * esquina diagonal (Rule ID MOVE-05, Cap. 8 pág. 147). Deliberadamente NO consulta ocupación por
 * combatientes — una criatura (aliada o enemiga) nunca bloquea el vértice diagonal, solo un
 * obstáculo sólido (`board.impassableCells`) o el límite del tablero. Ver
 * `docs/designs/corners-geometry-design.md` (corrige una divergencia deliberada de Sprint 015).
 */
function isCornerAnchorBlockedByTerrain(
  snapshot: CombatRulesSnapshot,
  combatant: Combatant,
  anchor: Position
): boolean {
  const cells = getCombatantOccupiedCellsAt(combatant, snapshot, anchor);
  return cells.some((cell) => !isPositionInsideBoard(snapshot, cell) || isImpassable(snapshot, cell.x, cell.y));
}

function canProjectMeleeThreat(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant
): boolean {
  const status = lifeStatus(attacker);
  if (status !== "active" && status !== "disabled") return false;
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: attacker.id,
    catalog: effectsCatalog
  });
  return !hasEffectTrait(reduced, "NO_THREAT");
}

function hasMeleeThreatFromSourcesAtDistance(
  sources: ReturnType<typeof deriveMeleeThreatSources>,
  distance: number
): boolean {
  return sources.some((source) =>
    Number.isFinite(source.maxReachFeet) &&
    source.maxReachFeet > 0 &&
    distance > source.minReachFeet &&
    distance <= source.maxReachFeet
  );
}

function hasMeleeThreatAtDistance(attacker: Combatant, distance: number): boolean {
  return hasMeleeThreatFromSourcesAtDistance(deriveMeleeThreatSources(attacker), distance);
}

export function threatensCell(room: CombatRulesSnapshot<ProductionEffectId>, attacker: Combatant, cell: Position): boolean {
  if (!canProjectMeleeThreat(room, attacker)) return false;
  const distance = distanceBetweenFootprintGeometriesFeet(
    getCombatantFootprintGeometry(attacker, room),
    projectFootprintGeometry([cell]),
    room.board.cellSizeFeet
  );
  return hasMeleeThreatAtDistance(attacker, distance);
}

function threatensTargetWithGeometry(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  attackerGeometry: FootprintGeometry,
  targetGeometry: FootprintGeometry
): boolean {
  if (attacker.id === target.id || attacker.type === target.type) return false;
  if (!canProjectMeleeThreat(room, attacker)) return false;
  const distance = distanceBetweenFootprintGeometriesFeet(attackerGeometry, targetGeometry, room.board.cellSizeFeet);
  return hasMeleeThreatAtDistance(attacker, distance);
}

export function threatensTarget(room: CombatRulesSnapshot<ProductionEffectId>, attacker: Combatant, target: Combatant): boolean {
  return threatensTargetWithGeometry(
    room,
    attacker,
    target,
    getCombatantFootprintGeometry(attacker, room),
    getCombatantFootprintGeometry(target, room)
  );
}

/** Distancia mínima entre las huellas ocupadas por dos combatientes. */
export function distanceBetweenFootprintsFeet(room: CombatRulesSnapshot<ProductionEffectId>, attacker: Combatant, target: Combatant): number {
  return distanceBetweenFootprintGeometriesFeet(
    getCombatantFootprintGeometry(attacker, room),
    getCombatantFootprintGeometry(target, room),
    room.board.cellSizeFeet
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ATK-RANGED-INTO-MELEE: penalizador por disparar a un objetivo enzarzado en
// combate cuerpo a cuerpo (PHB 3.5 pág. 140; NDD: ranged-into-melee-penalty.md)
// ─────────────────────────────────────────────────────────────────────────────

export const RANGED_INTO_MELEE_PENALTY = -4;
export const RANGED_INTO_MELEE_SAFE_DISTANCE_FEET = 10;

export interface RangedIntoMeleeAssessment {
  /** true si el penalizador -4 debe aplicarse a la tirada de ataque a distancia. */
  readonly applies: boolean;
  readonly penalty: 0 | typeof RANGED_INTO_MELEE_PENALTY;
  /** Motivo por el que un objetivo enzarzado NO recibe el penalizador. */
  readonly exemption?: "distance" | "feat";
  /** Distancia mínima (entre footprints) del objetivo al personaje amistoso más cercano al atacante. */
  readonly nearestFriendlyDistanceFeet: number | null;
}

const NOT_APPLICABLE: RangedIntoMeleeAssessment = Object.freeze({
  applies: false,
  penalty: 0,
  nearestFriendlyDistanceFeet: null
});

/**
 * Evaluador puro de la regla "enzarzado en cuerpo a cuerpo":
 * - el objetivo y un personaje amistoso del atacante son enemigos entre sí y AL MENOS UNO
 *   amenaza al otro (`threatensTarget` — RAW ingles: "either threatens the other"; la
 *   formulación "mutuamente" del corpus local es una imprecisión de traducción, ver D-11);
 * - excepción de distancia: se ignora el penalizador si el objetivo está a
 *   >= 10 ft del personaje amistoso más cercano al atacante (medición entre footprints,
 *   correcta para criaturas Large/Huge);
 * - excepción declarativa de dote: `FeatCatalog.rangedAttackContribution` (Disparo Preciso);
 * - simplificación V1 documentada: un objetivo indefenso (trait HELPLESS) o sin estado de
 *   vida activo/disabled no se considera enzarzado (RAW: "no se considerará enzarzado a no
 *   ser que esté siendo atacado" — el matiz de turno queda fuera de alcance).
 * Determinista e independiente del orden de los combatientes en el snapshot.
 */
export function getRangedIntoMeleeAssessment(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): RangedIntoMeleeAssessment {
  if (attacker.id === target.id || attacker.type === target.type) return NOT_APPLICABLE;

  const friendlies = room.combatants.filter(
    (candidate) => candidate.id !== attacker.id && candidate.type === attacker.type && lifeStatus(candidate) !== "dead"
  );
  if (friendlies.length === 0) return NOT_APPLICABLE;

  let nearestFriendlyDistanceFeet: number | null = null;
  for (const friendly of friendlies) {
    const distance = distanceBetweenFootprintsFeet(room, target, friendly);
    if (nearestFriendlyDistanceFeet === null || distance < nearestFriendlyDistanceFeet) {
      nearestFriendlyDistanceFeet = distance;
    }
  }

  const targetStatus = lifeStatus(target);
  const targetReduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: target.id,
    catalog: effectsCatalog
  });
  const targetEngageable =
    (targetStatus === "active" || targetStatus === "disabled") && !hasEffectTrait(targetReduced, "HELPLESS");

  const engaged = targetEngageable && friendlies.some(
    (friendly) => threatensTarget(room, friendly, target) || threatensTarget(room, target, friendly)
  );
  if (!engaged) {
    return Object.freeze({ applies: false, penalty: 0 as const, nearestFriendlyDistanceFeet });
  }

  if (nearestFriendlyDistanceFeet !== null && nearestFriendlyDistanceFeet >= RANGED_INTO_MELEE_SAFE_DISTANCE_FEET) {
    return Object.freeze({ applies: false, penalty: 0 as const, exemption: "distance" as const, nearestFriendlyDistanceFeet });
  }

  if (FeatCatalog.rangedAttackContribution(attacker.featIds).ignoresFiringIntoMeleePenalty === true) {
    return Object.freeze({ applies: false, penalty: 0 as const, exemption: "feat" as const, nearestFriendlyDistanceFeet });
  }

  return Object.freeze({ applies: true, penalty: RANGED_INTO_MELEE_PENALTY, nearestFriendlyDistanceFeet });
}

export interface ForcedMovementDirection {
  readonly dx: -1 | 0 | 1;
  readonly dy: -1 | 0 | 1;
}

export interface ForcedMovementProjection {
  readonly path: readonly Position[];
  readonly finalPosition: Position;
  readonly distanceFeet: number;
  readonly blocked: boolean;
  readonly blockedAt: Position | null;
  readonly blockedReason: "impassable_cell" | "occupied_by_combatant" | null;
}

/**
 * Proyecta desplazamiento forzado sin mutar la sala. No dispara AdO ni consume
 * movimiento voluntario; devuelve siempre la ultima ancla completamente legal.
 */
export function projectForcedMovement(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  target: Combatant,
  direction: ForcedMovementDirection,
  maxDistanceFeet: number
): ForcedMovementProjection {
  if ((direction.dx === 0 && direction.dy === 0) || Math.abs(direction.dx) > 1 || Math.abs(direction.dy) > 1) {
    throw new Error("La direccion de desplazamiento forzado debe ser un vector unitario no nulo.");
  }
  if (!Number.isFinite(maxDistanceFeet) || maxDistanceFeet < 0) {
    throw new Error("La distancia maxima de desplazamiento forzado debe ser finita y no negativa.");
  }

  const maximumSteps = Math.floor(maxDistanceFeet / snapshot.board.cellSizeFeet);
  const occupancyIndex = createFootprintOccupancyIndex(snapshot);
  const path: Position[] = [];
  let finalPosition = { ...target.position };
  let blockedAt: Position | null = null;
  let blockedReason: ForcedMovementProjection["blockedReason"] = null;

  for (let step = 1; step <= maximumSteps; step++) {
    const candidate: Position = {
      x: target.position.x + direction.dx * step,
      y: target.position.y + direction.dy * step,
      zFeet: target.position.zFeet ?? 0
    };

    const proj = projectMovementFootprint(snapshot, target, candidate, direction);
    if (!proj) {
       blockedAt = candidate;
       blockedReason = "impassable_cell";
       break;
    }
    const cells = proj.occupiedCells;

    if (cells.some((cell) => !isPositionInsideBoard(snapshot, cell))) {
      blockedAt = candidate;
      blockedReason = "impassable_cell";
      break;
    }
    if (cells.some((cell) => isImpassable(snapshot, cell.x, cell.y))) {
      blockedAt = candidate;
      blockedReason = "impassable_cell";
      break;
    }
    const blockingCombatant = getCombatantsIntersectingCells(occupancyIndex, cells, target.id).some((other) => {
      const status = lifeStatus(other);
      return status === "active" || status === "disabled";
    });
    if (blockingCombatant) {
      blockedAt = candidate;
      blockedReason = "occupied_by_combatant";
      break;
    }
    path.push(candidate);
    finalPosition = candidate;
  }

  return {
    path,
    finalPosition,
    distanceFeet: path.length * snapshot.board.cellSizeFeet,
    blocked: blockedAt !== null,
    blockedAt,
    blockedReason
  };
}

/**
 * Sprint 042: geometría pura de intercepción de línea de ataque. Detecta criaturas vivas
 * interpuestas (Sprint 013, `creatureBlockerIds`) entre el atacante y el objetivo mediante
 * colinealidad exacta entera.
 *
 * Sprint 052B (corrección de contradicción detectada en Sprint 052A, ver
 * `docs/designs/terrain-cover-line-of-effect-decision.md`): esta función ya NO consulta
 * `board.impassableCells`. Esa consulta (introducida en este mismo Sprint 042 sin NDD propio)
 * hacía que un muro produjera `terrain-cover` (+4 CA, ataque permitido) — un veredicto opuesto
 * al que produce la nueva `getLineOfEffect` (Total Cover, ataque inválido) para la misma celda.
 * Cover queda ahora exclusivamente sobre criaturas interpuestas; la obstrucción física completa
 * es responsabilidad única de `getLineOfEffect`/`LineOfEffectAssessment`.
 */
export interface AttackLineInterception {
  readonly creatureBlockerIds: readonly string[];
}

export function getAttackLineInterception(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): AttackLineInterception {
  const compareCells = (left: Position, right: Position): number =>
    left.x - right.x || left.y - right.y || (left.zFeet ?? 0) - (right.zFeet ?? 0);
  const attackerCells = [...getCombatantOccupiedCells(attacker, room)].sort(compareCells);
  const targetCells = [...getCombatantOccupiedCells(target, room)].sort(compareCells);
  let origin = attackerCells[0] ?? attacker.position;
  let destination = targetCells[0] ?? target.position;
  let shortestDistanceSquared = Number.POSITIVE_INFINITY;
  for (const attackerCell of attackerCells) {
    for (const targetCell of targetCells) {
      const dx = targetCell.x - attackerCell.x;
      const dy = targetCell.y - attackerCell.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < shortestDistanceSquared) {
        shortestDistanceSquared = distanceSquared;
        origin = attackerCell;
        destination = targetCell;
      }
    }
  }

  const ax = origin.x;
  const ay = origin.y;
  const bx = destination.x;
  const by = destination.y;
  const dxAB = bx - ax;
  const dyAB = by - ay;
  const lengthSquaredAB = dxAB * dxAB + dyAB * dyAB;

  const isExactInteriorPoint = (px: number, py: number): boolean => {
    const dxAC = px - ax;
    const dyAC = py - ay;
    const cross = dxAB * dyAC - dyAB * dxAC;
    if (cross !== 0) return false;
    const dot = dxAC * dxAB + dyAC * dyAB;
    return dot > 0 && dot < lengthSquaredAB;
  };

  const creatureBlockerIds: string[] = [];
  for (const combatant of [...room.combatants].sort((left, right) => left.id.localeCompare(right.id))) {
    if (combatant.id === attacker.id || combatant.id === target.id) continue;
    const status = lifeStatus(combatant);
    if (status !== "active" && status !== "disabled") continue;
    if (getCombatantOccupiedCells(combatant, room).some((cell) => isExactInteriorPoint(cell.x, cell.y))) {
      creatureBlockerIds.push(combatant.id);
    }
  }

  return { creatureBlockerIds };
}

/**
 * Sprint 042: proyecta la geometría de `getAttackLineInterception` a un veredicto de Cover para
 * un intento de ataque. Sprint 052B: exclusivamente criaturas interpuestas — ver nota arriba.
 */
function buildCoverAssessment(interception: AttackLineInterception): CoverAssessment {
  const creatureApplies = interception.creatureBlockerIds.length > 0;
  const kind: CoverKind = creatureApplies ? "creature-cover" : "none";
  return {
    applies: creatureApplies,
    acBonus: creatureApplies ? 4 : 0,
    kind,
    blockerIds: interception.creatureBlockerIds
  };
}

/**
 * Recorrido "supercover" entre dos celdas (Sprint 052B.1, corrige el bug geométrico de Sprint
 * 052B: la versión anterior probaba si el ancla entera de una celda bloqueadora era un punto
 * exactamente colineal del segmento centro-a-centro, lo que fallaba para cualquier línea que
 * atravesara el ÁREA de una celda sin pasar exactamente por su punto ancla — ver
 * `docs/designs/vision-and-line-of-effect-architecture.md` §1.3.1 para la auditoría completa).
 *
 * Modela cada celda como el área unitaria `[x,x+1)×[y,y+1)` y traza el segmento entre los
 * CENTROS de la celda de origen y destino (`(x+0.5, y+0.5)`), devolviendo el conjunto de celdas
 * cuya área el segmento realmente atraviesa. Es el algoritmo "supercover"/"conservative line
 * drawing" estándar para líneas de visión en grillas: en cada paso avanza el eje que va
 * "atrasado" respecto al otro (comparando el avance fraccional de x e y sin dividir, por
 * multiplicación cruzada `(2*ix+1)*ny` vs `(2*iy+1)*nx` — aritmética enteramente entera, sin
 * coma flotante). Cuando el segmento cruza exactamente un vértice compartido por 4 celdas (un
 * cruce diagonal exacto — línea "por vértice"), el algoritmo incluye conservadoramente las DOS
 * celdas vecinas de esa esquina además de la celda de destino de ese paso: una diagonal no puede
 * "colarse" entre dos bloqueadores que se tocan solo en la esquina.
 *
 * Política de bordes explícita: un segmento recto que corre exactamente por una fila o columna
 * (horizontal/vertical) atraviesa el área completa de cada celda de esa fila/columna — nunca
 * "roza" un borde sin entrar, porque el centro de cada celda intermedia está estrictamente dentro
 * de su área. Una diagonal exacta que pasa por un vértice compartido ("por vértice") se resuelve
 * de forma conservadora incluyendo ambas celdas vecinas, como se describe arriba.
 */
function traversedCellKeysBetween(ax: number, ay: number, bx: number, by: number): Set<string> {
  const dx = bx - ax;
  const dy = by - ay;
  const nx = Math.abs(dx);
  const ny = Math.abs(dy);
  const signX = dx > 0 ? 1 : -1;
  const signY = dy > 0 ? 1 : -1;
  let x = ax;
  let y = ay;
  let ix = 0;
  let iy = 0;
  const visited = new Set<string>([`${x},${y}`]);
  while (ix < nx || iy < ny) {
    const lhs = (2 * ix + 1) * ny;
    const rhs = (2 * iy + 1) * nx;
    if (ny === 0 || (nx > 0 && lhs < rhs)) {
      x += signX;
      ix += 1;
    } else if (nx === 0 || lhs > rhs) {
      y += signY;
      iy += 1;
    } else {
      visited.add(`${x + signX},${y}`);
      visited.add(`${x},${y + signY}`);
      x += signX;
      y += signY;
      ix += 1;
      iy += 1;
    }
    visited.add(`${x},${y}`);
  }
  return visited;
}

/**
 * Sprint 052B: geometría pura e independiente de Line of Effect. Responde exclusivamente si
 * existe obstrucción física completa (`board.lineOfEffectBlockingCells`) entre el atacante y el
 * objetivo — nunca consulta criaturas ni `impassableCells`. No generaliza ni envuelve
 * semánticamente `getAttackLineInterception`: comparte únicamente el mismo tipo de tablero, no la
 * prueba geométrica (que es un recorrido de celdas por área, no una prueba de colinealidad de
 * puntos — ver `traversedCellKeysBetween` arriba, corregido en Sprint 052B.1).
 *
 * Footprints multicasilla (Sprint 052A/052B, decisión de Fase 1, ver
 * `docs/designs/terrain-cover-line-of-effect-decision.md`): existe Line of Effect si **al menos
 * un** par de celdas ocupadas (una del atacante, una del objetivo) tiene un recorrido sin
 * bloqueadores — análogo a que el SRD permita elegir la esquina/casilla más favorable del propio
 * espacio al trazar líneas hacia el objetivo. Hay Total Cover únicamente si **todos** los pares
 * posibles están bloqueados. Para criaturas 1×1 (todas las del catálogo de demo actual) esto
 * colapsa a un único par, igual que antes. Las celdas propias de origen/destino (de cualquiera de
 * los dos combatientes, no solo del par actual) nunca cuentan como bloqueadoras de su propia
 * línea de efecto.
 *
 * `zFeet` (altura): esta primera versión ignora la diferencia de altura entre celdas, igual que
 * `getAttackLineInterception` hace hoy — es una simplificación deliberada y documentada, no un
 * descuido; queda como pregunta abierta para una futura vertical de altura/vuelo.
 */
/**
 * Extracción compartida (Sprint 053B) entre `getLineOfEffect` y `getVisualPathAssessment`: ambas
 * responden la misma CLASE de pregunta geométrica ("¿al menos un par de celdas ocupadas tiene un
 * recorrido supercover sin bloqueadores?") sobre una fuente de celdas bloqueadoras distinta —
 * nunca la misma fuente de datos por fusión conceptual, cada llamador decide su propia fuente
 * (`blockingCellSource`). Extracción puramente mecánica del cuerpo ya probado de
 * `getLineOfEffect` (Sprint 052B.1): mismo comportamiento exacto, cero cambios de lógica.
 */
function computeSupercoverPathAssessment(
  room: CombatRulesSnapshot<ProductionEffectId>,
  origin: Combatant,
  target: Combatant,
  blockingCellSource: ReadonlyArray<string> | undefined
): { readonly hasClearPath: boolean; readonly blockedCellKeys: readonly string[] } {
  const originCells = getCombatantOccupiedCells(origin, room);
  const destinationCells = getCombatantOccupiedCells(target, room);
  const ownCellKeys = new Set<string>([
    ...originCells.map((cell) => `${cell.x},${cell.y}`),
    ...destinationCells.map((cell) => `${cell.x},${cell.y}`)
  ]);

  const blockingCellKeys = new Set(
    [...new Set(blockingCellSource ?? [])].filter((key) => {
      const [x, y] = key.split(",").map(Number);
      return Number.isInteger(x) && Number.isInteger(y) && `${x},${y}` === key && !ownCellKeys.has(key);
    })
  );

  let hasClearPath = false;
  const blockedCellKeys = new Set<string>();

  for (const a of originCells) {
    for (const b of destinationCells) {
      const visited = traversedCellKeysBetween(a.x, a.y, b.x, b.y);
      visited.delete(`${a.x},${a.y}`);
      visited.delete(`${b.x},${b.y}`);
      const blockersForThisPair = [...visited].filter((key) => blockingCellKeys.has(key));
      if (blockersForThisPair.length === 0) {
        hasClearPath = true;
      } else {
        for (const key of blockersForThisPair) blockedCellKeys.add(key);
      }
    }
  }

  return {
    hasClearPath,
    blockedCellKeys: [...blockedCellKeys].sort()
  };
}

export function getLineOfEffect(
  room: CombatRulesSnapshot<ProductionEffectId>,
  origin: Combatant,
  target: Combatant
): LineOfEffectAssessment {
  const result = computeSupercoverPathAssessment(room, origin, target, room.board.lineOfEffectBlockingCells);
  return { hasLineOfEffect: result.hasClearPath, blockedCellKeys: result.blockedCellKeys };
}

/**
 * Sprint 053B: geometría pura e independiente de Line of Sight (ruta visual) — hermana de
 * `getLineOfEffect`, nunca su alias. Reutiliza la misma primitiva compartida
 * (`computeSupercoverPathAssessment`/`traversedCellKeysBetween`) porque responde la misma clase
 * de pregunta geométrica, pero es una función exportada independiente con su propio contrato
 * (`VisualPathAssessment`). Fuente de bloqueadores: reutiliza provisionalmente
 * `board.lineOfEffectBlockingCells` (autorizado por el NDD, Sprint 053 §3) — eso no fusiona LoE y
 * Visual Path en el mismo assessment; es una reutilización de datos explícitamente provisional,
 * a separar en un campo dedicado (`lineOfSightBlockingCells`) el día que exista un obstáculo real
 * que deba bloquear uno sin el otro (cristal, niebla — ver
 * `docs/designs/vision-and-line-of-effect-architecture.md` §13.4/§3).
 */
export function getVisualPathAssessment(
  room: CombatRulesSnapshot<ProductionEffectId>,
  observer: Combatant,
  target: Combatant
): VisualPathAssessment {
  const result = computeSupercoverPathAssessment(room, observer, target, room.board.lineOfEffectBlockingCells);
  return { hasClearVisualPath: result.hasClearPath, blockedCellKeys: result.blockedCellKeys };
}

/**
 * Sprint 053B: composición pura de `VisualPathAssessment` + iluminación estática +
 * `IntrinsicPerception` del observador. No depende de `EffectReducer`, `ConcealmentAssessment`
 * ni del Attack Resolver — es un assessment independiente que se compone con Concealment en
 * `getConcealmentAssessment` (severidad máxima), nunca se fusiona con él. Ver
 * `docs/designs/vision-and-line-of-effect-architecture.md` §13.5/§13.9.
 *
 * Precedencia de evaluación (más restrictivo gana, orden fijado por el NDD):
 * 1. Ruta visual bloqueada → total, 50%, requiere casilla, `blocked-visual-path`.
 * 2. Objetivo en oscuridad total, observador sin Darkvision → total, 50%, `darkness`.
 * 3. Objetivo en oscuridad total, observador con Darkvision pero fuera de alcance →
 *    total, 50%, `darkvision-out-of-range`.
 * 4. Objetivo en luz tenue, observador sin Darkvision → parcial, 20%, `dim-light`.
 * 5. Cualquier otro caso (incluida luz tenue/oscuridad con Darkvision suficiente) → `clear`.
 *
 * Precedencia de datos: si una celda aparece en `darknessCells` y `dimLightCells` a la vez,
 * `darkness` domina — se consulta primero.
 *
 * Simplificación deliberada y documentada (misma clase que `zFeet` en `getLineOfEffect`): esta
 * primera vertical consulta únicamente la casilla ancla (`target.position`) del objetivo para
 * determinar su nivel de luz, no la huella completa — footprints multicasilla con niveles de luz
 * mixtos entre sus propias celdas quedan como pregunta abierta para una vertical posterior.
 */
export function getVisionAssessment(
  room: CombatRulesSnapshot<ProductionEffectId>,
  observer: Combatant,
  target: Combatant
): VisionAssessment {
  const visualPath = getVisualPathAssessment(room, observer, target);
  const traces: VisionTrace[] = [];

  if (!visualPath.hasClearVisualPath) {
    traces.push({
      source: "visual-path",
      label: "Ruta visual bloqueada",
      kind: "total",
      missChancePercent: 50,
      status: "applied"
    });
    return {
      canPerceiveVisually: false,
      kind: "total",
      missChancePercent: 50,
      directTargetingAllowed: false,
      requiresTargetSquare: true,
      dominantReason: "blocked-visual-path",
      traces
    };
  }

  const darkvisionFeet = observer.intrinsicPerception?.darkvisionFeet ?? 0;
  const targetCellKey = `${target.position.x},${target.position.y}`;
  const inDarkness = (room.board.darknessCells ?? []).includes(targetCellKey);
  const inDimLight = !inDarkness && (room.board.dimLightCells ?? []).includes(targetCellKey);

  if (inDarkness) {
    const distanceFeet = distanceBetweenFootprintsFeet(room, observer, target);
    const withinDarkvisionRange = darkvisionFeet > 0 && distanceFeet <= darkvisionFeet;
    traces.push({
      source: "board-light",
      label: "Oscuridad total",
      kind: "total",
      missChancePercent: 50,
      status: withinDarkvisionRange ? "suppressed" : "applied"
    });
    if (darkvisionFeet > 0) {
      traces.push({
        source: "intrinsic-perception",
        label: `Darkvision ${darkvisionFeet} ft` + (withinDarkvisionRange ? " (dentro de alcance)" : " (fuera de alcance)"),
        kind: withinDarkvisionRange ? "none" : "total",
        missChancePercent: withinDarkvisionRange ? 0 : 50,
        status: withinDarkvisionRange ? "applied" : "suppressed"
      });
    }
    if (withinDarkvisionRange) {
      return { canPerceiveVisually: true, kind: "none", missChancePercent: 0, directTargetingAllowed: true, requiresTargetSquare: false, dominantReason: "clear", traces };
    }
    return {
      canPerceiveVisually: false,
      kind: "total",
      missChancePercent: 50,
      directTargetingAllowed: false,
      requiresTargetSquare: true,
      dominantReason: darkvisionFeet > 0 ? "darkvision-out-of-range" : "darkness",
      traces
    };
  }

  if (inDimLight) {
    const hasDarkvision = darkvisionFeet > 0;
    traces.push({
      source: "board-light",
      label: "Iluminación tenue",
      kind: "partial",
      missChancePercent: 20,
      status: hasDarkvision ? "suppressed" : "applied"
    });
    if (hasDarkvision) {
      traces.push({
        source: "intrinsic-perception",
        label: `Darkvision ${darkvisionFeet} ft (anula luz tenue)`,
        kind: "none",
        missChancePercent: 0,
        status: "applied"
      });
      return { canPerceiveVisually: true, kind: "none", missChancePercent: 0, directTargetingAllowed: true, requiresTargetSquare: false, dominantReason: "clear", traces };
    }
    return {
      canPerceiveVisually: true,
      kind: "partial",
      missChancePercent: 20,
      directTargetingAllowed: true,
      requiresTargetSquare: false,
      dominantReason: "dim-light",
      traces
    };
  }

  return {
    canPerceiveVisually: true,
    kind: "none",
    missChancePercent: 0,
    directTargetingAllowed: true,
    requiresTargetSquare: false,
    dominantReason: "clear",
    traces
  };
}

interface FootprintFaceSignature { readonly dx: -1 | 0 | 1; readonly dy: -1 | 0 | 1; }

function getFaceSignature(footprint: FootprintGeometry, target: FootprintGeometry): FootprintFaceSignature {
  const dx = footprint.maxX < target.minX ? -1 : footprint.minX > target.maxX ? 1 : 0;
  const dy = footprint.maxY < target.minY ? -1 : footprint.minY > target.maxY ? 1 : 0;
  return { dx, dy };
}

/** Frontera geométrica de oposición contra caras del footprint defensor. */
function areOppositeForFlanking(
  attacker: FootprintGeometry,
  ally: FootprintGeometry,
  target: FootprintGeometry
): boolean {
  const attackerFace = getFaceSignature(attacker, target);
  if (attackerFace.dx === 0 && attackerFace.dy === 0) return false;
  const allyFace = getFaceSignature(ally, target);
  return attackerFace.dx === -allyFace.dx && attackerFace.dy === -allyFace.dy;
}

export function isFlanking(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): boolean {
  const targetGeometry = getCombatantFootprintGeometry(target, room);
  const attackerGeometry = getCombatantFootprintGeometry(attacker, room);
  if (!threatensTargetWithGeometry(room, attacker, target, attackerGeometry, targetGeometry)) return false;
  for (const ally of room.combatants) {
    if (ally.id === attacker.id || ally.type !== attacker.type) continue;
    const allyGeometry = getCombatantFootprintGeometry(ally, room);
    if (
      threatensTargetWithGeometry(room, ally, target, allyGeometry, targetGeometry) &&
      areOppositeForFlanking(attackerGeometry, allyGeometry, targetGeometry)
    ) return true;
  }
  return false;
}

/**
 * Assessment puro y efimero de DEFENSE-CONCEALMENT para un intento concreto. Sprint 053B: compone
 * la reducción declarativa existente (`EffectReducer.reduceConcealmentContributions` — Blinded,
 * futura niebla mágica) con `VisionAssessment` (fuente contextual independiente: geometría + luz
 * + percepción). Nunca se sintetiza un `EffectInstance` ficticio para Vision, y Vision nunca se
 * inyecta dentro del reductor — se componen en `composeConcealmentAssessment` por severidad
 * máxima. Ver `docs/designs/vision-and-line-of-effect-architecture.md` §13.8/§13.9.
 */
export function getConcealmentAssessment(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): ConcealmentAssessment {
  const reduced = EffectReducer.reduceConcealmentContributions({
    effectInstances: room.effectInstances,
    catalog: effectsCatalog,
    targets: [
      { targetId: target.id, perspective: "attacks_against_target" },
      { targetId: attacker.id, perspective: "attacks_by_target" }
    ]
  });
  const vision = getVisionAssessment(room, attacker, target);
  return composeConcealmentAssessment(reduced, vision);
}

/**
 * Convierte la reduccion especializada en el assessment consumido por servidor y UI. `vision` es
 * opcional (retrocompatible con llamadores que solo evalúan la reducción declarativa pura, ej.
 * `tests/concealment-core.test.mjs`) — cuando se provee, se compone por **severidad máxima**
 * (`total > partial > none`), nunca sumando porcentajes ni fusionando ambos assessments en uno
 * solo. Si cualquiera de las dos fuentes exige `requiresTargetSquare`/prohíbe
 * `directTargetingAllowed`, el resultado final hereda esa restricción (la más restrictiva
 * domina) — esto es lo que permite que Blinded (efecto declarativo, total incondicional) siga
 * funcionando exactamente igual que hoy sin ninguna rama especial de "si Blinded, ignorar
 * Vision": su propia severidad ya domina cualquier resultado que Vision produzca para el mismo
 * ataque.
 */
export function composeConcealmentAssessment(reduced: ReducedConcealment, vision?: VisionAssessment): ConcealmentAssessment {
  const effectTotal = reduced.kind === "total";
  const effectPartial = reduced.kind === "partial";
  const visionTotal = vision?.kind === "total";
  const visionPartial = vision?.kind === "partial";

  const total = effectTotal || visionTotal;
  const partial = !total && (effectPartial || visionPartial);
  const kind: ConcealmentKind = total ? "total" : partial ? "partial" : "none";
  const applies = kind !== "none";

  const missChancePercent = total
    ? Math.max(effectTotal ? reduced.missChancePercent : 0, visionTotal ? vision!.missChancePercent : 0)
    : partial
      ? Math.max(effectPartial ? reduced.missChancePercent : 0, visionPartial ? vision!.missChancePercent : 0)
      : 0;

  const labels = reduced.traces
    .filter((trace) => trace.status === "applied")
    .map((trace) => `${trace.label} (${trace.missChancePercent}%)`);
  for (const trace of vision?.traces ?? []) {
    if (trace.status === "applied") labels.push(`${trace.label} (${trace.missChancePercent}%)`);
  }

  return {
    applies,
    kind,
    missChancePercent,
    directTargetingAllowed: !total,
    requiresTargetSquare: total,
    opportunityAttackAllowed: !total,
    labelParts: labels,
    traces: reduced.traces,
    visionTraces: vision?.traces ?? []
  };
}

// -----------------------------------------------------------------------------
// Pipeline avanzado de modificadores contextuales y daño de precisión
// -----------------------------------------------------------------------------

export function getAttackContextModifiers(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): AttackContextModifiers {
  const flanking = isFlanking(room, attacker, target);
  // ATK-RANGED-INTO-MELEE: penalizador -4 por disparar a un objetivo enzarzado en cuerpo a
  // cuerpo, resuelto por el helper puro (incluye excepción de 10 ft y la exención declarativa
  // de Disparo Preciso vía FeatCatalog — cero condicionales por dote en esta capa ni en los
  // resolvers). Esta es la misma costura isomorfa que ya usa el flanqueo: la consumen el
  // servidor (armas, conjuros con tirada de ataque) y la UI predictiva sin recalcular.
  const rangedIntoMelee = getRangedIntoMeleeAssessment(room, attacker, target);
  const rangedLabelParts =
    rangedIntoMelee.applies
      ? ["disparo a melé " + rangedIntoMelee.penalty]
      : rangedIntoMelee.exemption === "feat"
        ? ["disparo a melé evitado (Disparo Preciso)"]
        : [];
  // Sprint 042: única sede de cómputo de Cover — geometría resuelta una vez y proyectada por
  // tipo de ataque. Ningún otro punto del servidor/UI vuelve a llamar getAttackLineInterception.
  const interception = getAttackLineInterception(room, attacker, target);
  const cover = buildCoverAssessment(interception);
  const concealment = getConcealmentAssessment(room, attacker, target);
  return {
    flanking,
    byAttackType: {
      melee: { attackBonus: flanking ? 2 : 0, labelParts: flanking ? ["flanqueo +2"] : [], cover, concealment },
      ranged: { attackBonus: rangedIntoMelee.penalty, labelParts: rangedLabelParts, cover, concealment }
    }
  };
}

export function getEffectiveSneakAttackDice(
  room: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant
): number {
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: combatant.id,
    catalog: effectsCatalog
  });
  const bonus = reduced.numericModifiers["SNEAK_ATTACK_DICE"]?.total ?? 0;
  return Math.max(0, (combatant.sneakAttackDice || 0) + bonus);
}

export function canApplySneakAttack(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  delivery?: AttackDeliveryContext,
  concealment?: ConcealmentAssessment
): boolean {
  if (getEffectiveSneakAttackDice(room, attacker) <= 0 || attacker.type === target.type) return false;
  if (target.ruleTraits.includes("IMMUNE_TO_PRECISION_DAMAGE") || target.ruleTraits.includes("IMMUNE_TO_CRITICAL_HITS")) return false;

  const targetEffects = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: target.id,
    catalog: effectsCatalog
  });
  if (hasEffectTrait(targetEffects, "IMMUNE_TO_PRECISION_DAMAGE") || hasEffectTrait(targetEffects, "IMMUNE_TO_CRITICAL_HITS")) return false;

  const attackType = delivery?.attackType ?? getWeaponAttackTypeForTarget(room, attacker, target);
  const attackDistance = delivery?.distanceFeet ?? distanceBetweenFootprintsFeet(room, attacker, target);
  if (delivery && (!delivery.requiresAttackRoll || !delivery.dealsDamage)) return false;
  if (attackType === "ranged" && attackDistance > 30) return false;
  const effectiveConcealment = concealment ?? getConcealmentAssessment(room, attacker, target);
  if (effectiveConcealment.applies) return false;
  return hasEffectTrait(targetEffects, "NO_DEX_TO_AC") || isFlanking(room, attacker, target);
}

/** Wrappers de compatibilidad que conservan al evaluador productivo como única fuente matemática. */
export function calculateSpellSaveDC(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  spellId: string
): number {
  return Rules.calculateSpellSaveDC(snapshot, combatant, spellId);
}

export function calculateSpellSaveDCBreakdown(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  spellId: string
): SpellSaveDCBreakdown {
  return Rules.calculateSpellSaveDCBreakdown(snapshot, combatant, spellId);
}

const SIZE_ORDER: readonly SizeCategory[] = [
  "fine", "diminutive", "tiny", "small", "medium", "large", "huge", "gargantuan", "colossal"
];

function hasActiveTrait(
  room: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  trait: Trait
): boolean {
  if (combatant.ruleTraits.includes(trait)) return true;
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: room.effectInstances,
    targetId: combatant.id,
    catalog: effectsCatalog
  });
  return hasEffectTrait(reduced, trait);
}

export interface MeleeTouchManeuverProfile {
  readonly distanceFeet: number;
  readonly minReachFeet: number;
  readonly maxReachFeet: number;
  readonly flankingBonus: number;
  readonly touchArmorClass: number;
  readonly concealment: ConcealmentAssessment;
}

/** Valida alcance y deriva el contexto Touch AC común a maniobras especiales. */
export function validateMeleeTouchManeuver(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  minReachFeet: number,
  maxReachFeet: number,
  maneuverName: string
): RuleResult<MeleeTouchManeuverProfile> {
  const distance = distanceBetweenFootprintsFeet(room, attacker, target);
  if (!(distance > minReachFeet && distance <= maxReachFeet)) {
    return { ok: false, error: `${target.name} esta a ${distance} ft, fuera del alcance de ${maneuverName} de ${attacker.name} (${minReachFeet}-${maxReachFeet} ft).` };
  }
  const tactical = getAttackContextModifiers(room, attacker, target).byAttackType.melee;
  const touchArmorClass = Rules.totalArmorClass(room, target, {
    attackType: "melee",
    targetAcType: "touch",
    attackerId: attacker.id,
    cover: tactical.cover
  }).total;
  return {
    ok: true,
    value: {
      distanceFeet: distance,
      minReachFeet,
      maxReachFeet,
      flankingBonus: tactical.attackBonus,
      touchArmorClass,
      concealment: tactical.concealment
    }
  };
}

export interface MeleeTouchManeuverResult {
  readonly hits: boolean;
  readonly d20Roll: number;
  readonly attackBonus: number;
  readonly total: number;
  readonly targetArmorClass: number;
  readonly parts: readonly string[];
}

/** Resuelve un toque melee contra un perfil ya validado, sin mutar el snapshot. */
export function resolveMeleeTouchManeuver(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  profile: MeleeTouchManeuverProfile,
  d20Roll: number
): MeleeTouchManeuverResult {
  const attack = Rules.totalAttackBonus(room, attacker, { abilityForAttack: "strength", attackType: "melee" });
  const attackBonus = attack.total + profile.flankingBonus;
  const total = d20Roll + attackBonus;
  const hits = d20Roll === 1 ? false : d20Roll === 20 ? true : total >= profile.touchArmorClass;
  return {
    hits,
    d20Roll,
    attackBonus,
    total,
    targetArmorClass: profile.touchArmorClass,
    parts: [...attack.parts, ...(profile.flankingBonus ? ["flanqueo +2"] : [])]
  };
}

export interface OpposedCheckResult {
  readonly attackerRoll: number;
  readonly defenderRoll: number;
  readonly attackerModifier: number;
  readonly defenderModifier: number;
  readonly attackerTotal: number;
  readonly defenderTotal: number;
  readonly attackerWins: boolean;
  readonly requiresReroll: boolean;
}

/** Oráculo único de checks opuestos: total, desempate por modificador y reroll exacto. */
export function resolveOpposedCheck(
  attackerRoll: number,
  defenderRoll: number,
  attackerModifier: number,
  defenderModifier: number
): OpposedCheckResult {
  const attackerTotal = attackerRoll + attackerModifier;
  const defenderTotal = defenderRoll + defenderModifier;
  const requiresReroll = attackerTotal === defenderTotal && attackerModifier === defenderModifier;
  const attackerWins = attackerTotal > defenderTotal
    || (attackerTotal === defenderTotal && attackerModifier > defenderModifier);
  return {
    attackerRoll,
    defenderRoll,
    attackerModifier,
    defenderModifier,
    attackerTotal,
    defenderTotal,
    attackerWins,
    requiresReroll
  };
}

export type GrappleEscapeType = "grapple_check" | "escape_artist";

export interface GrappleLink {
  readonly effectInstanceId: string;
  readonly participantIds: readonly [string, string];
  readonly opponentId: string;
}

/** Localiza una única relación binaria de Presa. Cualquier ambigüedad falla cerrada. */
export function getGrappleLink(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatantId: string
): RuleResult<GrappleLink> {
  const links = snapshot.effectInstances.filter((instance) =>
    instance.effectId === "srd_grappling" && (instance.targets?.includes(combatantId) ?? false)
  );
  if (links.length !== 1) {
    return { ok: false, error: links.length === 0
      ? "El combatiente no pertenece a una Presa activa."
      : "El combatiente pertenece a múltiples vínculos de Presa; la relación es inválida." };
  }
  const link = links[0]!;
  const targets = link.targets ?? [];
  if (targets.length !== 2 || targets[0] === targets[1] || !targets.includes(combatantId)) {
    return { ok: false, error: "La instancia de Presa no contiene exactamente dos participantes distintos." };
  }
  if (targets.some((targetId) => !snapshot.combatants.some((combatant) => combatant.id === targetId))) {
    return { ok: false, error: "La instancia de Presa referencia un participante inexistente." };
  }
  const opponentId = targets.find((targetId) => targetId !== combatantId)!;
  return {
    ok: true,
    value: {
      effectInstanceId: link.instanceId,
      participantIds: [targets[0]!, targets[1]!],
      opponentId
    }
  };
}

export interface GrappleEscapePreview {
  readonly escapeType: GrappleEscapeType;
  readonly effectInstanceId: string;
  readonly opponentId: string;
  readonly opponentName: string;
  readonly escapeBaseAttackBonus: number;
  readonly escapeAbility: "strength" | "dexterity";
  readonly escapeAbilityModifier: number;
  readonly escapeSkillRanks: number;
  readonly escapeSizeModifier: number;
  readonly escapeModifier: number;
  readonly defenderBaseAttackBonus: number;
  readonly defenderStrengthModifier: number;
  readonly defenderSizeModifier: number;
  readonly defenderModifier: number;
  readonly escapeParts: readonly string[];
  readonly defenderParts: readonly string[];
}

/** Proyecta las dos fórmulas de Escape sin tirar dados ni mutar la sala. */
export function getGrappleEscapePreview(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  escapeType: GrappleEscapeType
): RuleResult<GrappleEscapePreview> {
  const link = getGrappleLink(snapshot, combatant.id);
  if (!link.ok || !link.value) return { ok: false, error: link.error };
  if (!hasActiveTrait(snapshot, combatant, "GRAPPLING")) {
    return { ok: false, error: `${combatant.name} no posee el estado GRAPPLING requerido para escapar.` };
  }
  const opponent = snapshot.combatants.find((candidate) => candidate.id === link.value!.opponentId);
  if (!opponent || !hasActiveTrait(snapshot, opponent, "GRAPPLING")) {
    return { ok: false, error: "El retenedor de la Presa no posee un estado de agarre válido." };
  }

  const usesSkill = escapeType === "escape_artist";
  const escapeBaseAttackBonus = usesSkill ? 0 : combatant.baseAttackBonus;
  const escapeAbility = usesSkill ? "dexterity" : "strength";
  const escapeAbilityModifier = getEffectiveAbilityModifier(snapshot, combatant, escapeAbility);
  const escapeSkillRanks = usesSkill ? combatant.skillRanks.escape_artist : 0;
  const escapeSizeModifier = usesSkill ? 0 : getSpecialManeuverSizeModifier(combatant.sizeCategory);
  const escapeModifier = escapeBaseAttackBonus + escapeAbilityModifier + escapeSkillRanks + escapeSizeModifier;
  const defenderStrengthModifier = getEffectiveAbilityModifier(snapshot, opponent, "strength");
  const defenderSizeModifier = getSpecialManeuverSizeModifier(opponent.sizeCategory);
  const defenderModifier = opponent.baseAttackBonus + defenderStrengthModifier + defenderSizeModifier;
  return {
    ok: true,
    value: {
      escapeType,
      effectInstanceId: link.value.effectInstanceId,
      opponentId: opponent.id,
      opponentName: opponent.name,
      escapeBaseAttackBonus,
      escapeAbility,
      escapeAbilityModifier,
      escapeSkillRanks,
      escapeSizeModifier,
      escapeModifier,
      defenderBaseAttackBonus: opponent.baseAttackBonus,
      defenderStrengthModifier,
      defenderSizeModifier,
      defenderModifier,
      escapeParts: usesSkill
        ? [`DES ${escapeAbilityModifier >= 0 ? "+" : ""}${escapeAbilityModifier}`, `Rangos +${escapeSkillRanks}`]
        : [`BAB +${escapeBaseAttackBonus}`, `FUE ${escapeAbilityModifier >= 0 ? "+" : ""}${escapeAbilityModifier}`, `Tamaño ${escapeSizeModifier >= 0 ? "+" : ""}${escapeSizeModifier}`],
      defenderParts: [`BAB +${opponent.baseAttackBonus}`, `FUE ${defenderStrengthModifier >= 0 ? "+" : ""}${defenderStrengthModifier}`, `Tamaño ${defenderSizeModifier >= 0 ? "+" : ""}${defenderSizeModifier}`]
    }
  };
}

export function resolveGrappleEscapeCheck(
  preview: GrappleEscapePreview,
  escapeRoll: number,
  defenderRoll: number
): OpposedCheckResult {
  return resolveOpposedCheck(escapeRoll, defenderRoll, preview.escapeModifier, preview.defenderModifier);
}

export interface GrappleAttackEligibility {
  readonly isGrappling: boolean;
  readonly sourceKind: "unrestricted" | "light_weapon" | "natural";
  readonly sourceId?: string;
  readonly sourceName: string;
  readonly attackPenalty: number;
  readonly labelParts: readonly string[];
}

/** Único selector de fuentes de ataque permitidas mientras el actor está en Presa. */
export function getGrappleAttackEligibility(
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant
): RuleResult<GrappleAttackEligibility> {
  if (!hasActiveTrait(snapshot, combatant, "GRAPPLING")) {
    const source = resolveEquippedWeaponProfile(combatant);
    return { ok: true, value: { isGrappling: false, sourceKind: "unrestricted", sourceId: source.entry?.id, sourceName: source.profile.name, attackPenalty: 0, labelParts: [] } };
  }
  const weapon = getEquippedWeaponEntry(combatant);
  if (weapon) {
    if (weapon.handedness !== "light" || !weapon.isMelee) {
      return { ok: false, error: `${combatant.name} no puede atacar en Presa con ${weapon.name}; solo se permiten armas ligeras melee o ataques naturales.` };
    }
    return { ok: true, value: { isGrappling: true, sourceKind: "light_weapon", sourceId: weapon.id, sourceName: weapon.name, attackPenalty: -4, labelParts: ["forcejeo en presa -4"] } };
  }
  if (combatant.naturalAttackId) {
    const natural = resolveEquippedWeaponProfile(combatant).profile;
    return { ok: true, value: { isGrappling: true, sourceKind: "natural", sourceId: combatant.naturalAttackId, sourceName: natural.name, attackPenalty: -4, labelParts: ["forcejeo en presa -4"] } };
  }
  return { ok: false, error: `${combatant.name} no posee un arma ligera melee ni un ataque natural válido para atacar en Presa.` };
}

export interface TripManeuverPreview {
  readonly maneuverId: "trip";
  readonly distanceFeet: number;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly armedTrip: boolean;
  readonly minReachFeet: number;
  readonly maxReachFeet: number;
  readonly provokesOpportunityAttack: boolean;
  readonly defenderCanMakeOpportunityAttack: boolean;
  readonly flankingBonus: number;
  readonly touchArmorClass: number;
  readonly concealment: ConcealmentAssessment;
  readonly attackerStrengthModifier: number;
  readonly attackerSizeModifier: number;
  readonly defenderAbility: ManeuverAbility;
  readonly defenderAbilityModifier: number;
  readonly defenderSizeModifier: number;
}

export interface BullRushManeuverPreview {
  readonly maneuverId: "bull_rush";
  readonly distanceFeet: number;
  readonly provokesOpportunityAttack: boolean;
  readonly defenderCanMakeOpportunityAttack: boolean;
  readonly attackerStrengthModifier: number;
  readonly attackerSizeModifier: number;
  readonly defenderStrengthModifier: number;
  readonly defenderSizeModifier: number;
  readonly direction: ForcedMovementDirection;
  readonly projectedPath: readonly Position[];
  readonly projectedFinalPosition: Position;
  readonly blocked: boolean;
  readonly blockedAt: Position | null;
  readonly blockedReason: "impassable_cell" | "occupied_by_combatant" | null;
}

export interface GrappleManeuverPreview extends MeleeTouchManeuverProfile {
  readonly maneuverId: "grapple";
  readonly provokesOpportunityAttack: boolean;
  readonly defenderCanMakeOpportunityAttack: boolean;
  readonly attackerBaseAttackBonus: number;
  readonly attackerStrengthModifier: number;
  readonly attackerSizeModifier: number;
  readonly attackerGrappleModifier: number;
  readonly defenderBaseAttackBonus: number;
  readonly defenderStrengthModifier: number;
  readonly defenderSizeModifier: number;
  readonly defenderGrappleModifier: number;
}

function validateGrappleManeuver(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): RuleResult<GrappleManeuverPreview> {
  if (attacker.id === target.id) return { ok: false, error: "Presa requiere otro combatiente como objetivo." };
  if (attacker.type === target.type) return { ok: false, error: "Presa requiere un enemigo como objetivo." };
  const attackerStatus = lifeStatus(attacker);
  const targetStatus = lifeStatus(target);
  if (attackerStatus !== "active" && attackerStatus !== "disabled") {
    return { ok: false, error: `${attacker.name} no puede iniciar una Presa en su estado actual.` };
  }
  if (targetStatus !== "active" && targetStatus !== "disabled") {
    return { ok: false, error: `${target.name} no puede ser objetivo de Presa en su estado actual.` };
  }
  if (hasActiveTrait(room, attacker, "GRAPPLING") || hasActiveTrait(room, target, "GRAPPLING")) {
    return { ok: false, error: "Grapple V1 no permite iniciar una nueva Presa con un combatiente que ya está agarrando o agarrado." };
  }

  const touch = validateMeleeTouchManeuver(
    room,
    attacker,
    target,
    0,
    getSizeRule(attacker.sizeCategory).defaultReachFeet,
    "Presa"
  );
  if (!touch.ok || !touch.value) return { ok: false, error: touch.error };
  const provokesOpportunityAttack = !FeatCatalog.avoidsOpportunity(attacker.featIds, "grapple");
  const defenderCanMakeOpportunityAttack = provokesOpportunityAttack
    && targetStatus === "active"
    && Rules.canMakeOpportunityAttack(room, target, attacker.id)
    && threatensTarget(room, target, attacker);
  const attackerStrengthModifier = getEffectiveAbilityModifier(room, attacker, "strength");
  const attackerSizeModifier = getSpecialManeuverSizeModifier(attacker.sizeCategory);
  const defenderStrengthModifier = getEffectiveAbilityModifier(room, target, "strength");
  const defenderSizeModifier = getSpecialManeuverSizeModifier(target.sizeCategory);
  return {
    ok: true,
    value: {
      maneuverId: "grapple",
      ...touch.value,
      provokesOpportunityAttack,
      defenderCanMakeOpportunityAttack,
      attackerBaseAttackBonus: attacker.baseAttackBonus,
      attackerStrengthModifier,
      attackerSizeModifier,
      attackerGrappleModifier: attacker.baseAttackBonus + attackerStrengthModifier + attackerSizeModifier,
      defenderBaseAttackBonus: target.baseAttackBonus,
      defenderStrengthModifier,
      defenderSizeModifier,
      defenderGrappleModifier: target.baseAttackBonus + defenderStrengthModifier + defenderSizeModifier
    }
  };
}

function validateBullRushManeuver(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): RuleResult<BullRushManeuverPreview> {
  if (attacker.id === target.id) return { ok: false, error: "Embestida requiere otro combatiente como objetivo." };
  if (attacker.type === target.type) return { ok: false, error: "Embestida requiere un enemigo como objetivo." };
  const attackerStatus = lifeStatus(attacker);
  const targetStatus = lifeStatus(target);
  if (attackerStatus !== "active" && attackerStatus !== "disabled") {
    return { ok: false, error: `${attacker.name} no puede intentar una Embestida en su estado actual.` };
  }
  if (targetStatus !== "active" && targetStatus !== "disabled") {
    return { ok: false, error: `${target.name} no puede ser objetivo de Embestida en su estado actual.` };
  }
  const distance = distanceBetweenFootprintsFeet(room, attacker, target);
  const reachFeet = getSizeRule(attacker.sizeCategory).defaultReachFeet;
  if (!(distance > 0 && distance <= reachFeet)) {
    return { ok: false, error: `${target.name} esta a ${distance} ft, fuera del alcance de Embestida de ${attacker.name} (${reachFeet} ft).` };
  }

  const attackerGeometry = getCombatantFootprintGeometry(attacker, room);
  const targetGeometry = getCombatantFootprintGeometry(target, room);
  const direction: ForcedMovementDirection = {
    dx: (targetGeometry.minX > attackerGeometry.maxX ? 1 : targetGeometry.maxX < attackerGeometry.minX ? -1 : 0),
    dy: (targetGeometry.minY > attackerGeometry.maxY ? 1 : targetGeometry.maxY < attackerGeometry.minY ? -1 : 0)
  };
  if (direction.dx === 0 && direction.dy === 0) return { ok: false, error: "No se pudo derivar una direccion valida para la Embestida." };

  const provokesOpportunityAttack = !FeatCatalog.avoidsOpportunity(attacker.featIds, "bull_rush");
  const defenderCanMakeOpportunityAttack = provokesOpportunityAttack
    && targetStatus === "active"
    && Rules.canMakeOpportunityAttack(room, target, attacker.id)
    && threatensTarget(room, target, attacker);
  const projection = projectForcedMovement(room, target, direction, room.board.cellSizeFeet);
  return {
    ok: true,
    value: {
      maneuverId: "bull_rush",
      distanceFeet: distance,
      provokesOpportunityAttack,
      defenderCanMakeOpportunityAttack,
      attackerStrengthModifier: getEffectiveAbilityModifier(room, attacker, "strength"),
      attackerSizeModifier: getSpecialManeuverSizeModifier(attacker.sizeCategory),
      defenderStrengthModifier: getEffectiveAbilityModifier(room, target, "strength"),
      defenderSizeModifier: getSpecialManeuverSizeModifier(target.sizeCategory),
      direction,
      projectedPath: projection.path,
      projectedFinalPosition: projection.finalPosition,
      blocked: projection.blocked,
      blockedAt: projection.blockedAt,
      blockedReason: projection.blockedReason
    }
  };
}

export function validateSpecialManeuver(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  maneuverId: SpecialManeuverId
): RuleResult<TripManeuverPreview | BullRushManeuverPreview | GrappleManeuverPreview> {
  if (maneuverId === "grapple") return validateGrappleManeuver(room, attacker, target);
  if (maneuverId === "bull_rush") return validateBullRushManeuver(room, attacker, target);
  if (maneuverId !== "trip") return { ok: false, error: `Maniobra especial desconocida: ${String(maneuverId)}.` };
  if (attacker.id === target.id) return { ok: false, error: "Derribo requiere otro combatiente como objetivo." };
  if (attacker.type === target.type) return { ok: false, error: "Derribo requiere un enemigo como objetivo." };

  const attackerStatus = lifeStatus(attacker);
  if (attackerStatus !== "active" && attackerStatus !== "disabled") {
    return { ok: false, error: `${attacker.name} no puede intentar un derribo en su estado actual.` };
  }
  const targetStatus = lifeStatus(target);
  if (targetStatus !== "active" && targetStatus !== "disabled") {
    return { ok: false, error: `${target.name} no puede ser objetivo de Derribo en su estado actual.` };
  }
  if (hasActiveTrait(room, target, "PRONE")) return { ok: false, error: `${target.name} ya esta derribado.` };

  const attackerSizeIndex = SIZE_ORDER.indexOf(attacker.sizeCategory);
  const targetSizeIndex = SIZE_ORDER.indexOf(target.sizeCategory);
  if (attackerSizeIndex < 0 || targetSizeIndex < 0) return { ok: false, error: "Categoria de tamaño desconocida en Derribo." };
  if (targetSizeIndex > attackerSizeIndex + 1) {
    return { ok: false, error: `${target.name} supera en mas de una categoria de tamaño a ${attacker.name}.` };
  }

  const weapon = getEquippedWeaponEntry(attacker);
  const weaponId = weapon?.id ?? null;
  const armedTrip = Boolean(weapon?.specialManeuvers?.includes("trip"));
  let sourceId = "unarmed_strike";
  let sourceName = "ataque sin arma";
  let minReachFeet = 0;
  let maxReachFeet = getSizeRule(attacker.sizeCategory).defaultReachFeet;

  if (armedTrip && weaponId && weapon) {
    const source = deriveMeleeThreatSources(attacker).find((candidate) => candidate.sourceId === weaponId);
    if (!source) return { ok: false, error: `Invariante de Derribo violada: ${weapon.name} no posee fuente de amenaza derivada.` };
    sourceId = weaponId;
    sourceName = weapon.name;
    minReachFeet = source.minReachFeet;
    maxReachFeet = source.maxReachFeet;
  }

  const touchValidation = validateMeleeTouchManeuver(room, attacker, target, minReachFeet, maxReachFeet, "Derribo");
  if (!touchValidation.ok || !touchValidation.value) return { ok: false, error: touchValidation.error };

  const improvedTrip = FeatCatalog.avoidsOpportunity(attacker.featIds, "trip");
  const provokesOpportunityAttack = !improvedTrip && !armedTrip;
  const defenderCanMakeOpportunityAttack = provokesOpportunityAttack
    && targetStatus === "active"
    && Rules.canMakeOpportunityAttack(room, target, attacker.id)
    && threatensTarget(room, target, attacker);
  const defenderStrengthModifier = getEffectiveAbilityModifier(room, target, "strength");
  const defenderDexterityModifier = getEffectiveAbilityModifier(room, target, "dexterity");
  const defenderAbility: ManeuverAbility = defenderDexterityModifier > defenderStrengthModifier ? "dexterity" : "strength";

  return {
    ok: true,
    value: {
      maneuverId: "trip",
      distanceFeet: touchValidation.value.distanceFeet,
      sourceId,
      sourceName,
      armedTrip,
      minReachFeet,
      maxReachFeet,
      provokesOpportunityAttack,
      defenderCanMakeOpportunityAttack,
      flankingBonus: touchValidation.value.flankingBonus,
      touchArmorClass: touchValidation.value.touchArmorClass,
      concealment: touchValidation.value.concealment,
      attackerStrengthModifier: getEffectiveAbilityModifier(room, attacker, "strength"),
      attackerSizeModifier: getSpecialManeuverSizeModifier(attacker.sizeCategory),
      defenderAbility,
      defenderAbilityModifier: defenderAbility === "dexterity" ? defenderDexterityModifier : defenderStrengthModifier,
      defenderSizeModifier: getSpecialManeuverSizeModifier(target.sizeCategory)
    }
  };
}

export interface TripTouchAttackResult extends MeleeTouchManeuverResult {}

export function resolveTripTouchAttack(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  d20Roll: number
): TripTouchAttackResult {
  const validation = validateSpecialManeuver(room, attacker, target, "trip");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "trip") throw new Error(validation.error ?? "Derribo invalido.");
  return resolveMeleeTouchManeuver(room, attacker, validation.value, d20Roll);
}

export interface TripOpposedCheckResult {
  readonly attackerRoll: number;
  readonly defenderRoll: number;
  readonly attackerModifier: number;
  readonly defenderModifier: number;
  readonly attackerTotal: number;
  readonly defenderTotal: number;
  readonly defenderAbility: ManeuverAbility;
  readonly attackerWins: boolean;
  readonly requiresReroll: boolean;
}

export function resolveTripOpposedCheck(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  attackerRoll: number,
  defenderRoll: number
): TripOpposedCheckResult {
  const validation = validateSpecialManeuver(room, attacker, target, "trip");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "trip") throw new Error(validation.error ?? "Derribo invalido.");
  const attackerModifier = validation.value.attackerStrengthModifier + validation.value.attackerSizeModifier;
  const defenderModifier = validation.value.defenderAbilityModifier + validation.value.defenderSizeModifier;
  const opposed = resolveOpposedCheck(attackerRoll, defenderRoll, attackerModifier, defenderModifier);
  return {
    ...opposed,
    defenderAbility: validation.value.defenderAbility,
  };
}

export interface BullRushOpposedCheckResult {
  readonly attackerRoll: number;
  readonly defenderRoll: number;
  readonly attackerModifier: number;
  readonly defenderModifier: number;
  readonly attackerTotal: number;
  readonly defenderTotal: number;
  readonly attackerWins: boolean;
  readonly requiresReroll: boolean;
  readonly margin: number;
}

export function resolveBullRushOpposedCheck(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  attackerRoll: number,
  defenderRoll: number
): BullRushOpposedCheckResult {
  const validation = validateSpecialManeuver(room, attacker, target, "bull_rush");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "bull_rush") {
    throw new Error(validation.error ?? "Embestida invalida.");
  }
  const attackerModifier = validation.value.attackerStrengthModifier + validation.value.attackerSizeModifier;
  const defenderModifier = validation.value.defenderStrengthModifier + validation.value.defenderSizeModifier;
  const opposed = resolveOpposedCheck(attackerRoll, defenderRoll, attackerModifier, defenderModifier);
  return {
    ...opposed,
    margin: Math.max(0, opposed.attackerTotal - opposed.defenderTotal)
  };
}

export interface GrappleOpposedCheckResult extends OpposedCheckResult {}

export function resolveGrappleTouchAttack(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  d20Roll: number
): MeleeTouchManeuverResult {
  const validation = validateSpecialManeuver(room, attacker, target, "grapple");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "grapple") {
    throw new Error(validation.error ?? "Presa invalida.");
  }
  return resolveMeleeTouchManeuver(room, attacker, validation.value, d20Roll);
}

export function resolveGrappleOpposedCheck(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  attackerRoll: number,
  defenderRoll: number
): GrappleOpposedCheckResult {
  const validation = validateSpecialManeuver(room, attacker, target, "grapple");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "grapple") {
    throw new Error(validation.error ?? "Presa invalida.");
  }
  return resolveOpposedCheck(
    attackerRoll,
    defenderRoll,
    validation.value.attackerGrappleModifier,
    validation.value.defenderGrappleModifier
  );
}

export function canUseFiveFootStep(
  room: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant
): RuleResult<true> {
  if (room.activeAttackThreat) return { ok: false, error: "Hay una amenaza de critico pendiente. Resolvela antes de continuar." };
  if (room.pendingOpportunityAttacks && room.pendingOpportunityAttacks.length > 0) {
    return { ok: false, error: "Hay ataques de oportunidad pendientes. Resuelvelos antes de continuar." };
  }
  const turnCheck = canTakeTurn(combatant);
  if (!turnCheck.ok) return turnCheck;
  if (hasActiveTrait(room, combatant, "CANNOT_MOVE")) {
    return { ok: false, error: combatant.name + " no puede dar un paso de 5 pies mientras esté paralizado o en presa." };
  }
  if (Rules.totalSpeedFeet(room, combatant) <= room.board.cellSizeFeet) {
    return { ok: false, error: combatant.name + " no puede dar un paso de 5 pies porque su velocidad efectiva no supera una casilla." };
  }
  if (room.currentTurn.usedTotalDefense) {
    return { ok: false, error: combatant.name + " ya uso Defensa total y renuncio al resto de acciones del turno." };
  }
  const disabledCheck = canDisabledCombatantTakeAction(room, combatant, "non-action");
  if (!disabledCheck.ok) return disabledCheck;
  if (room.currentTurn.usedFiveFootStep) return { ok: false, error: "Ya uso paso de 5 pies este turno." };
  if (room.currentTurn.movementUsedFeet > 0) return { ok: false, error: "Ya uso movimiento este turno; no puede dar un paso de 5 pies." };
  if (room.currentTurn.usedMoveAction) return { ok: false, error: "Ya uso la accion de movimiento este turno." };
  return { ok: true, value: true };
}

export interface AttackRoutineItem {
  type: "primary" | "iterative";
  penalty: number;
}

export function getAttackRoutine(combatant: Combatant): AttackRoutineItem[] {
  const routine: AttackRoutineItem[] = [{ type: "primary", penalty: 0 }];
  if (combatant.baseAttackBonus >= 6) routine.push({ type: "iterative", penalty: -5 });
  if (combatant.baseAttackBonus >= 11) routine.push({ type: "iterative", penalty: -10 });
  if (combatant.baseAttackBonus >= 16) routine.push({ type: "iterative", penalty: -15 });
  return routine;
}

/**
 * Sprint 036: read-model puro y congelado que unifica `getAttackRoutine` (forma/penalizador
 * ordinal por BAB) con `Rules.totalAttackBonus` (bonus base ya resuelto: característica, tamaño,
 * modificadores de efectos no dependientes de objetivo) en un único array consumible por UI y
 * servidor sin recalcular por separado. Deliberadamente NO recibe un `target`: flanqueo, Presa,
 * Apretujarse-vs-objetivo y Luchar a la Defensiva siguen viviendo exclusivamente en
 * `getAttackContextModifiers`/`evaluateConditionalModifiers`, evaluados por intento de ataque
 * contra un objetivo concreto — ver `docs/designs/iterative-attacks-core-design.md`.
 */
export interface IterativeAttack {
  readonly ordinal: number;
  readonly type: "primary" | "iterative";
  readonly routinePenalty: number;
  readonly effectiveAttackBonus: number;
}

export function getEffectiveAttackRoutine(
  context: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  attackContext?: Pick<AttackContext, "abilityForAttack" | "attackType">
): readonly IterativeAttack[] {
  const routine = getAttackRoutine(combatant);
  const baseAttack = Rules.totalAttackBonus(context, combatant, attackContext);
  return Object.freeze(routine.map((entry, index) => Object.freeze({
    ordinal: index + 1,
    type: entry.type,
    routinePenalty: entry.penalty,
    effectiveAttackBonus: baseAttack.total + entry.penalty
  })));
}

export function calculateStandUpCostFeet(
  context: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant
): number {
  return getStandUpActionProfile(context, combatant).costFeet;
}

export interface StandUpActionProfile {
  readonly costFeet: number;
  readonly consumesMoveAction: true;
  readonly provokesOpportunityAttacks: boolean;
  readonly labelParts: readonly string[];
}

export function getStandUpActionProfile(
  context: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant
): StandUpActionProfile {
  const contribution = FeatCatalog.tacticalActionRule(combatant.featIds ?? [], "stand-up");
  const isZeroCost = contribution?.movementCost === "zero";
  const provokesOpportunityAttacks = contribution?.provokesOpportunityAttacks ?? true;
  const defaultCost = Math.floor(Rules.totalSpeedFeet(context, combatant) / 2);
  return {
    costFeet: isZeroCost ? 0 : defaultCost,
    consumesMoveAction: true,
    provokesOpportunityAttacks,
    labelParts: Object.freeze([
      isZeroCost ? "Levantarse Rápido: 0 pies" : `levantarse: ${defaultCost} pies`,
      provokesOpportunityAttacks ? "provoca AdO" : "SEGURO (Sin AdO)"
    ])
  };
}

export function validateStandUp(
  context: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant
): RuleResult<StandUpActionProfile> {
  if (context.activeAttackThreat) return { ok: false, error: "Hay una amenaza de critico pendiente." };
  if (context.pendingOpportunityAttacks && context.pendingOpportunityAttacks.length > 0) {
    return { ok: false, error: "Hay ataques de oportunidad pendientes." };
  }
  const turnCheck = canTakeTurn(combatant);
  if (!turnCheck.ok) return { ok: false, error: turnCheck.error };
  const effects = EffectReducer.reduceEffectsForTarget({
    effectInstances: context.effectInstances,
    targetId: combatant.id,
    catalog: effectsCatalog
  });
  if (!hasEffectTrait(effects, "PRONE")) return { ok: false, error: "El combatiente no está derribado." };
  const profile = getStandUpActionProfile(context, combatant);
  if (context.currentTurn.movementUsedFeet + profile.costFeet > Rules.totalSpeedFeet(context, combatant)) {
    return { ok: false, error: "No tienes suficiente movimiento para levantarte." };
  }
  return { ok: true, value: profile };
}
