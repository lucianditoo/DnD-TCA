import {
  type CombatRulesSnapshot,
  type Combatant,
  type DamageBundle,
  type DamageComponent,
  type ProductionEffectId,
  type SavingThrowType,
  type SpellDefinition,
  type SpellSaveEffect,
  Rules,
  resolveSavingThrowCheck
} from "@dnd-tactical/shared";

export interface SavingThrowResult {
  readonly success: boolean;
  readonly d20Roll: number;
  readonly modifier: number;
  readonly total: number;
  readonly dc: number;
  readonly parts: readonly string[];
  readonly isNatural1: boolean;
  readonly isNatural20: boolean;
}

export interface SpellSavingThrowResult extends SavingThrowResult {
  readonly saveType: SavingThrowType;
  readonly saveEffect: SpellSaveEffect;
}

export function resolveSavingThrow(
  context: CombatRulesSnapshot<ProductionEffectId>,
  target: Combatant,
  saveType: SavingThrowType,
  dc: number,
  d20Roll: number
): SavingThrowResult {
  const saveBreakdown = Rules.totalSavingThrow(context, target, saveType);
  const check = resolveSavingThrowCheck(d20Roll, saveBreakdown.total, dc);

  return {
    success: check.success,
    d20Roll,
    modifier: saveBreakdown.total,
    total: check.total,
    dc,
    parts: saveBreakdown.parts,
    isNatural1: check.isNatural1,
    isNatural20: check.isNatural20
  };
}

export function resolveSpellSavingThrow(
  context: CombatRulesSnapshot<ProductionEffectId>,
  caster: Combatant,
  target: Combatant,
  spell: SpellDefinition,
  diceRoller: (sides: number) => number
): SpellSavingThrowResult | null {
  if (spell.savingThrowType === "none") return null;
  const dc = Rules.calculateSpellSaveDC(context, caster, spell.id);
  const result = resolveSavingThrow(context, target, spell.savingThrowType, dc, diceRoller(20));
  return { ...result, saveType: spell.savingThrowType, saveEffect: spell.saveEffect };
}

export function applySpellSaveToDamageBundle(
  bundle: DamageBundle,
  saveEffect: SpellSaveEffect,
  saveSucceeded: boolean
): DamageBundle {
  if (!saveSucceeded || saveEffect === "none") {
    const components = bundle.components.map((component) => ({ ...component }));
    return { components, total: components.reduce((sum, component) => sum + component.amount, 0) };
  }
  if (saveEffect === "negates") {
    return {
      components: bundle.components.map((component) => ({ ...component, amount: 0 })),
      total: 0
    };
  }

  const targetTotal = bundle.total > 0 ? Math.max(1, Math.floor(bundle.total / 2)) : 0;
  let cumulativeBefore = 0;
  const components: DamageComponent[] = bundle.components.map((component) => {
    const cumulativeAfter = cumulativeBefore + component.amount;
    const amount = Math.floor(cumulativeAfter / 2) - Math.floor(cumulativeBefore / 2);
    cumulativeBefore = cumulativeAfter;
    return { ...component, amount };
  });
  const distributed = components.reduce((sum, component) => sum + component.amount, 0);
  if (targetTotal > distributed && components.length > 0) {
    components[0] = { ...components[0], amount: components[0].amount + (targetTotal - distributed) };
  }
  return { components, total: targetTotal };
}
