import { effectsCatalog, type ProductionEffectId } from "../effects/catalog.js";
import { type EffectDefinition } from "../effects/contracts.js";
import { EffectReducer } from "../effects/reducer.js";
import { type CatalogEffectId } from "../effects/types.js";
import { FeatCatalog } from "../featCatalog.js";
import { getLifeStateProjection, lifeStatus } from "../lifeStatus.js";
import { type Combatant, type CombatRulesSnapshot, type LifeStatus } from "../types.js";
import { hasEffectTrait, type RuleResult, Rules } from "./utils.js";

export { getLifeStateProjection, lifeStatus, type LifeStateProjection } from "../lifeStatus.js";

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
