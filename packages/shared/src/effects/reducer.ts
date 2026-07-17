import type { EffectDefinition, EffectStat, Modifier, RuleOverride, StackingPolicy, Trait } from "./contracts.js";
import type { EffectInstance } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de salida del Reducer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Traza de un modificador individual. Identifica unívocamente el origen
 * y el resultado (applied / suppressed) de un modificador numérico.
 */
export interface ModifierTrace {
  readonly effectId: string;
  readonly effectInstanceId: string;
  /** Identificador declarativo del modificador dentro del EffectDefinition */
  readonly modifierId: string;
  readonly stat: EffectStat;
  readonly stackingGroup: string;
  readonly value: number;
  readonly status: "applied" | "suppressed";
  /** Presente únicamente cuando status === "suppressed" */
  readonly reason?: "stacking";
}

/**
 * Resultado de la reducción de modificadores numéricos para una stat concreta.
 * Los campos bonuses y penalties son arrays de sólo lectura con orden determinista.
 */
export interface ReducedNumericModifier {
  readonly total: number;
  readonly bonuses: readonly ModifierTrace[];
  readonly penalties: readonly ModifierTrace[];
}

/**
 * Resultado completo de la reducción de efectos para un objetivo.
 * Contiene únicamente DELTAS, no estadísticas finales.
 * La consolidación final (base + delta + buffs legacy) pertenece a rules.ts.
 *
 * Traits y ruleOverrides: únicos y ordenados determinísticamente (alfabético).
 * La interpretación funcional de traits y overrides pertenece al Sprint 006.
 */
export interface ReducedEffects {
  readonly numericModifiers: Readonly<Partial<Record<EffectStat, ReducedNumericModifier>>>;
  readonly statOverrides: Readonly<Partial<Record<EffectStat, number>>>;
  readonly traits: readonly Trait[];
  readonly ruleOverrides: readonly RuleOverride[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrada del Reducer
// ─────────────────────────────────────────────────────────────────────────────

export interface EffectReductionInput<TCatalog extends Record<string, EffectDefinition>> {
  readonly effectInstances: readonly EffectInstance<keyof TCatalog & string>[];
  readonly targetId: string;
  readonly catalog: TCatalog;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deriva la sourceKey usada por la política unique_by_source.
 * Una fuente realmente global debe indicarlo explícitamente mediante type="system".
 * Si se requiere unique_by_source pero la fuente carece de id Y no es "system", se rechaza.
 */
function resolveSourceKey(
  source: EffectInstance["source"],
  policy: StackingPolicy,
  effectInstanceId: string,
  modifierId: string
): string {
  if (policy !== "unique_by_source") {
    return `${source.type}:${source.id ?? effectInstanceId}`;
  }
  // unique_by_source requiere identidad estable
  if (source.type === "system") {
    return "system:global";
  }
  if (!source.id) {
    throw new Error(
      `[EffectReducer] Política unique_by_source rechazada: el modificador "${modifierId}" ` +
      `de la instancia "${effectInstanceId}" tiene source.type="${source.type}" sin id explícito. ` +
      `Una fuente sin id estable no puede participar en unique_by_source. ` +
      `Proporciona source.id o usa source.type="system" para fuentes verdaderamente globales.`
    );
  }
  return `${source.type}:${source.id}`;
}

/**
 * Clave de agrupación de stacking: stat + stackingGroup + polaridad.
 * Los valores cero no se clasifican como bonus ni penalty; se omiten.
 */
function groupKey(stat: EffectStat, stackingGroup: string, polarity: "bonus" | "penalty"): string {
  return `${stat}::${stackingGroup}::${polarity}`;
}

interface PendingTrace {
  trace: Omit<ModifierTrace, "status" | "reason">;
  sourceKey: string;
  policy: StackingPolicy;
}

/**
 * Aplica la política de stacking a un grupo de trazas pendientes.
 * Devuelve las trazas finales con status "applied" o "suppressed".
 */
function applyPolicy(
  group: PendingTrace[],
  policy: StackingPolicy,
  groupId: string
): ModifierTrace[] {
  if (group.length === 0) return [];

  switch (policy) {
    case "sum": {
      return group.map(({ trace }) => ({ ...trace, status: "applied" as const }));
    }

    case "highest_value": {
      let maxVal = group[0].trace.value;
      let maxIdx = 0;
      for (let i = 1; i < group.length; i++) {
        if (group[i].trace.value > maxVal) {
          maxVal = group[i].trace.value;
          maxIdx = i;
        }
      }
      return group.map(({ trace }, i) =>
        i === maxIdx
          ? { ...trace, status: "applied" as const }
          : { ...trace, status: "suppressed" as const, reason: "stacking" as const }
      );
    }

    case "lowest_value": {
      let minVal = group[0].trace.value;
      let minIdx = 0;
      for (let i = 1; i < group.length; i++) {
        if (group[i].trace.value < minVal) {
          minVal = group[i].trace.value;
          minIdx = i;
        }
      }
      return group.map(({ trace }, i) =>
        i === minIdx
          ? { ...trace, status: "applied" as const }
          : { ...trace, status: "suppressed" as const, reason: "stacking" as const }
      );
    }

    case "unique_by_source": {
      // Por cada sourceKey, sobrevive el de mayor |value| (desempate por modifierId ASC)
      const bySource = new Map<string, PendingTrace>();
      for (const pending of group) {
        const existing = bySource.get(pending.sourceKey);
        if (!existing) {
          bySource.set(pending.sourceKey, pending);
        } else {
          const existingAbs = Math.abs(existing.trace.value);
          const pendingAbs = Math.abs(pending.trace.value);
          if (
            pendingAbs > existingAbs ||
            (pendingAbs === existingAbs && pending.trace.modifierId < existing.trace.modifierId)
          ) {
            bySource.set(pending.sourceKey, pending);
          }
        }
      }
      const winners = new Set(Array.from(bySource.values()).map((p) => p.trace.modifierId + ":" + p.trace.effectInstanceId));
      return group.map(({ trace }) =>
        winners.has(trace.modifierId + ":" + trace.effectInstanceId)
          ? { ...trace, status: "applied" as const }
          : { ...trace, status: "suppressed" as const, reason: "stacking" as const }
      );
    }

    default: {
      const _exhaustive: never = policy;
      throw new Error(`[EffectReducer] Política desconocida: ${String(_exhaustive)} en grupo ${groupId}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reducer principal
// ─────────────────────────────────────────────────────────────────────────────

export const EffectReducer = {
  /**
   * Reduce todos los efectos que aplican a un objetivo en un punto en el tiempo.
   * - Genera únicamente DELTAS numéricos (no estadísticas finales).
   * - Aplica apilamiento por grupo (stat + stackingGroup + polaridad).
   * - Detecta y rechaza políticas contradictorias dentro del mismo grupo.
   * - Rechaza unique_by_source con fuentes sin identidad.
   * - Omite modificadores con value === 0 (no afectan stacking ni total).
   * - Retorna traits y ruleOverrides ordenados alfabéticamente (determinismo).
   * - La misma entrada siempre produce el mismo resultado (determinismo total).
   */
  reduceEffectsForTarget<TCatalog extends Record<string, EffectDefinition>>(
    input: EffectReductionInput<TCatalog>
  ): ReducedEffects {
    const { effectInstances, targetId, catalog } = input;

    // Filtrar instancias que aplican a este targetId
    const applicable = effectInstances.filter(
      (inst) => inst.targets !== undefined && inst.targets.includes(targetId)
    );

    // Acumuladores
    const traitSet = new Set<Trait>();
    const overrideSet = new Set<RuleOverride>();
    const statOverrides: Partial<Record<EffectStat, number>> = {};

    // Mapa: groupKey → { pendingTraces[], detectedPolicy }
    const groups = new Map<string, { policy: StackingPolicy; traces: PendingTrace[] }>();

    // Ordenar instancias de manera determinista antes de procesarlas
    // Orden: effectId ASC, instanceId ASC para estabilidad independiente de llegada
    const sorted = [...applicable].sort((a, b) => {
      const effectCompare = String(a.effectId).localeCompare(String(b.effectId));
      return effectCompare !== 0 ? effectCompare : a.instanceId.localeCompare(b.instanceId);
    });

    for (const inst of sorted) {
      const definition = catalog[inst.effectId];
      if (!definition) {
        throw new Error(`[EffectReducer] Unknown ActiveEffect: effectId="${inst.effectId}", instanceId="${inst.instanceId}", targetId="${targetId}".`);
      }

      // Traits
      for (const trait of definition.traits) {
        traitSet.add(trait);
      }

      // RuleOverrides
      for (const override of definition.ruleOverrides) {
        overrideSet.add(override);
      }

      // Modificadores numéricos y overrides
      for (const modifier of definition.modifiers) {
        if (modifier.type === "override") {
          const current = statOverrides[modifier.stat];
          if (current === undefined || modifier.value < current) {
            statOverrides[modifier.stat] = modifier.value;
          }
          continue;
        }

        if (modifier.type !== "numeric") continue;

        const numMod = modifier;

        // Omitir modificadores con value === 0
        if (numMod.value === 0) continue;

        const polarity: "bonus" | "penalty" = numMod.value > 0 ? "bonus" : "penalty";
        const key = groupKey(numMod.stat, numMod.stackingGroup, polarity);

        // Resolver sourceKey (puede lanzar para unique_by_source sin id)
        const sourceKey = resolveSourceKey(inst.source, numMod.stackingPolicy, inst.instanceId, numMod.id);

        const pending: PendingTrace = {
          trace: {
            effectId: String(inst.effectId),
            effectInstanceId: inst.instanceId,
            modifierId: numMod.id,
            stat: numMod.stat,
            stackingGroup: numMod.stackingGroup,
            value: numMod.value
          },
          sourceKey,
          policy: numMod.stackingPolicy
        };

        if (!groups.has(key)) {
          groups.set(key, { policy: numMod.stackingPolicy, traces: [pending] });
        } else {
          const group = groups.get(key)!;
          // Detectar políticas contradictorias
          if (group.policy !== numMod.stackingPolicy) {
            throw new Error(
              `[EffectReducer] Políticas contradictorias en el grupo "${key}": ` +
              `"${group.policy}" vs "${numMod.stackingPolicy}". ` +
              `Todos los modificadores del mismo stat+stackingGroup+polaridad deben declarar la misma política.`
            );
          }
          group.traces.push(pending);
        }
      }
    }

    // Resolver grupos y construir ReducedNumericModifier por stat
    const statMap = new Map<EffectStat, { bonuses: ModifierTrace[]; penalties: ModifierTrace[] }>();

    for (const [key, { policy, traces }] of groups) {
      const resolved = applyPolicy(traces, policy, key);
      // Extraer stat y polarity del key
      const [stat, , polarity] = key.split("::") as [EffectStat, string, "bonus" | "penalty"];

      if (!statMap.has(stat)) {
        statMap.set(stat, { bonuses: [], penalties: [] });
      }
      const entry = statMap.get(stat)!;
      if (polarity === "bonus") {
        entry.bonuses.push(...resolved);
      } else {
        entry.penalties.push(...resolved);
      }
    }

    // Construir numericModifiers
    const numericModifiers: Partial<Record<EffectStat, ReducedNumericModifier>> = {};
    for (const [stat, { bonuses, penalties }] of statMap) {
      const bonusTotal = bonuses
        .filter((t) => t.status === "applied")
        .reduce((sum, t) => sum + t.value, 0);
      const penaltyTotal = penalties
        .filter((t) => t.status === "applied")
        .reduce((sum, t) => sum + t.value, 0);

      // Ordenar trazas por determinismo: modifierId ASC, instanceId ASC
      const sortTrace = (a: ModifierTrace, b: ModifierTrace): number => {
        const m = a.modifierId.localeCompare(b.modifierId);
        return m !== 0 ? m : a.effectInstanceId.localeCompare(b.effectInstanceId);
      };

      numericModifiers[stat] = {
        total: bonusTotal + penaltyTotal,
        bonuses: [...bonuses].sort(sortTrace),
        penalties: [...penalties].sort(sortTrace)
      };
    }

    // Traits y overrides: únicos, orden determinista (alfabético)
    const traits = [...traitSet].sort() as Trait[];
    const ruleOverrides = [...overrideSet].sort() as RuleOverride[];

    return { numericModifiers, statOverrides, traits, ruleOverrides };
  }
};
