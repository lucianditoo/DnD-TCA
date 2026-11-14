import type { Combatant } from "../types.js";
import type { BonusType, EffectDefinition, EffectStat, StackingPolicy } from "./contracts.js";
import type { EffectInstance } from "./types.js";
import type { NumericContribution } from "./reducer.js";

/** This adapter selects policy, never computes a total. */
export function bonusPolicy(type: BonusType, value: number): StackingPolicy {
  if (value < 0 && type !== "untyped") return "lowest_value";
  if (["dodge", "circumstance", "racial", "untyped"].includes(type)) return "unique_by_source";
  return value < 0 ? "lowest_value" : "highest_value";
}

export function contribution(
  targetId: string, effectId: string, instanceId: string, modifierId: string,
  stat: EffectStat, value: number, group: string, policy: StackingPolicy,
  sourceKey: string
): NumericContribution {
  return {
    trace: { targetId, sourceKey, effectId, effectInstanceId: instanceId, modifierId, stat, value, stackingGroup: group },
    sourceKey, policy
  };
}

export function activeNumericContributions(
  instances: readonly EffectInstance<string>[], targetId: string, catalog: Record<string, EffectDefinition>
): NumericContribution[] {
  const result: NumericContribution[] = [];
  for (const instance of instances) {
    if (!instance.targets?.includes(targetId)) continue;
    const definition = catalog[instance.effectId];
    if (!definition) throw new Error(`[EffectReducer] Unknown ActiveEffect: effectId="${instance.effectId}", instanceId="${instance.instanceId}", targetId="${targetId}".`);
    for (const mod of definition.modifiers) {
      if (mod.type !== "numeric") continue;
      const source = mod.mechanicalSource ?? `${instance.effectId}:${mod.id}`;
      // Explicit legacy policies retain their existing source contract.
      const sourceKey = mod.bonusType ? source : instance.source.type === "system" ? "system:global"
        : `${instance.source.type}:${instance.source.id ?? instance.instanceId}`;
      if (!mod.bonusType && mod.stackingPolicy === "unique_by_source" && instance.source.type !== "system" && !instance.source.id) {
        throw new Error("unique_by_source requiere identidad de fuente explícita");
      }
      result.push(contribution(targetId, instance.effectId, instance.instanceId, mod.id, mod.stat, mod.value,
        mod.bonusType ?? mod.stackingGroup, mod.bonusType ? bonusPolicy(mod.bonusType, mod.value) : mod.stackingPolicy, sourceKey));
    }
  }
  return result;
}

export function legacyBuffContributions(combatant: Combatant, aidOpponentId?: string): NumericContribution[] {
  const result: NumericContribution[] = [];
  for (const buff of combatant.buffs) {
    if (aidOpponentId !== undefined && buff.aidTargetId === aidOpponentId && (buff.aidChoice === "attack" || buff.aidChoice === "ac")) {
      const stat = buff.aidChoice === "attack" ? "ATTACK" : "AC";
      result.push(contribution(combatant.id, "aid", buff.id, "ayuda", stat, buff.aidBonus ?? 2,
        "legacy:aid", "sum", buff.aidSourceId ?? buff.id));
    }
    const fields = [
      ["ATTACK", buff.attackBonus, buff.attackBonusType],
      ["SPEED", buff.speedBonusFeet, buff.speedBonusType],
      ["AC", buff.acBonus, buff.acBonusType]
    ] as const;
    for (const [stat, value, type] of fields) {
      if (value === undefined || value === 0) continue;
      if (stat === "AC" && value > 0 && !type) throw new Error("Invariante de CA violada: todo bonificador positivo debe declarar su tipo.");
      const typed = type && type !== "misc" && type !== "dex";
      if (stat !== "AC" && typed && !buff.stackingSource) throw new Error("Un buff tipado requiere stackingSource explícito");
      const instanceId = buff.id ?? `opaque:${stat}:${value}`;
      const source = buff.stackingSource ?? `legacy-instance:${instanceId}`;
      result.push(contribution(combatant.id, "legacy-buff", instanceId, stat, stat, value,
        typed ? type : `legacy:${type ?? "opaque"}`,
        typed ? bonusPolicy(type, value) : "sum", source));
    }
  }
  return result;
}
