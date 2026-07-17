import type { SpecialManeuverId } from "./types.js";

export interface LifeRuleContribution {
  readonly autoStabilizeNegativeHp?: boolean;
  readonly negativeHpActionState?: "disabled";
  readonly bleedsWhileNegative?: boolean;
}

export interface ResolvedLifeRules {
  readonly autoStabilizeNegativeHp: boolean;
  readonly negativeHpActionState?: "disabled";
  readonly bleedsWhileNegative: boolean;
}

export interface TacticalActionRuleContribution {
  readonly actionId: "stand-up";
  readonly movementCost: "default" | "zero";
  readonly provokesOpportunityAttacks: boolean;
}

/**
 * Sprint 036: punto de extensión declarativo e inerte para la Rutina de Ataques Iterativos
 * (`getEffectiveAttackRoutine`, `rules.ts`). Ninguna dote lo puebla todavía y ningún selector lo
 * consume desde `getEffectiveAttackRoutine` — queda listo para Disparo Rápido (`extraAttack`),
 * Ataque con Dos Armas (`extraAttack`) o el ataque extra real de *Haste* (`flatAttackBonusToRoutine`)
 * en un sprint futuro con su propio NDD. Ver `docs/designs/iterative-attacks-core-design.md`.
 */
export interface AttackRoutineContribution {
  readonly extraAttack?: { readonly penalty: number };
  readonly flatAttackBonusToRoutine?: number;
}

/**
 * Sprint ATK-RANGED-INTO-MELEE: contribuciones declarativas de dotes al combate a distancia.
 * Consumida por `getRangedIntoMeleeAssessment` (`rules.ts`) vía el fold `rangedAttackContribution`.
 * Extensión futura natural: Improved Precise Shot (ignorar cobertura/ocultación parcial) como
 * bits adicionales de esta misma interfaz — ver `docs/designs/ranged-into-melee-penalty.md`.
 */
export interface RangedAttackContribution {
  readonly ignoresFiringIntoMeleePenalty?: boolean;
}

export interface FeatDefinition {
  readonly id: string;
  readonly name: string;
  readonly avoidsOpportunityOn: readonly SpecialManeuverId[];
  readonly lifeRules?: LifeRuleContribution;
  readonly tacticalActionRules?: readonly TacticalActionRuleContribution[];
  readonly attackRoutineRules?: AttackRoutineContribution;
  readonly rangedAttackRules?: RangedAttackContribution;
}

const definitions = Object.freeze([
  Object.freeze({
    id: "srd_improved_trip",
    name: "Derribo mejorado",
    avoidsOpportunityOn: Object.freeze(["trip"] as SpecialManeuverId[])
  }),
  Object.freeze({
    id: "srd_diehard",
    name: "Duro de Pelar",
    avoidsOpportunityOn: Object.freeze([] as SpecialManeuverId[]),
    lifeRules: Object.freeze({
      autoStabilizeNegativeHp: true,
      negativeHpActionState: "disabled" as const,
      bleedsWhileNegative: false
    })
  }),
  Object.freeze({
    id: "srd_prone_eschewal",
    name: "Levantarse Rápido",
    avoidsOpportunityOn: Object.freeze([] as SpecialManeuverId[]),
    tacticalActionRules: Object.freeze([
      Object.freeze({
        actionId: "stand-up" as const,
        movementCost: "zero" as const,
        provokesOpportunityAttacks: false
      })
    ])
  }),
  Object.freeze({
    id: "srd_dodge",
    name: "Esquiva (Dodge)",
    avoidsOpportunityOn: Object.freeze([] as SpecialManeuverId[])
  }),
  Object.freeze({
    id: "srd_mobility",
    name: "Movilidad (Mobility)",
    avoidsOpportunityOn: Object.freeze([] as SpecialManeuverId[])
  }),
  Object.freeze({
    id: "srd_precise_shot",
    name: "Disparo Preciso (Precise Shot)",
    avoidsOpportunityOn: Object.freeze([] as SpecialManeuverId[]),
    rangedAttackRules: Object.freeze({
      ignoresFiringIntoMeleePenalty: true
    })
  })
] satisfies readonly FeatDefinition[]);

const byId = new Map<string, FeatDefinition>(definitions.map((definition) => [definition.id, definition]));

export const FeatCatalog = Object.freeze({
  all(): readonly FeatDefinition[] { return definitions; },
  get(id: string): FeatDefinition | undefined { return byId.get(id); },
  hasFeat(featIds: readonly string[], id: string): boolean { return featIds.includes(id); },
  avoidsOpportunity(featIds: readonly string[], maneuverId: SpecialManeuverId): boolean {
    return featIds.some((id) => byId.get(id)?.avoidsOpportunityOn.includes(maneuverId));
  },
  lifeRules(featIds: readonly string[]): ResolvedLifeRules {
    return Object.freeze(featIds.reduce<ResolvedLifeRules>((result, id) => {
      const contribution = byId.get(id)?.lifeRules;
      return {
        autoStabilizeNegativeHp: result.autoStabilizeNegativeHp || contribution?.autoStabilizeNegativeHp === true,
        negativeHpActionState: result.negativeHpActionState ?? contribution?.negativeHpActionState,
        bleedsWhileNegative: result.bleedsWhileNegative && contribution?.bleedsWhileNegative !== false
      };
    }, {
      autoStabilizeNegativeHp: false,
      negativeHpActionState: undefined,
      bleedsWhileNegative: true
    }));
  },
  tacticalActionRule(featIds: readonly string[], actionId: TacticalActionRuleContribution["actionId"]): TacticalActionRuleContribution | undefined {
    for (const id of featIds) {
      const contribution = byId.get(id)?.tacticalActionRules?.find((rule) => rule.actionId === actionId);
      if (contribution) return contribution;
    }
    return undefined;
  },
  /**
   * Sprint 036: fold declarativo sobre `attackRoutineRules`, mismo patrón que `lifeRules`.
   * Sin consumidores todavía (`getEffectiveAttackRoutine` no lo invoca) — ver NDD del sprint.
   */
  attackRoutineContribution(featIds: readonly string[]): AttackRoutineContribution {
    return Object.freeze(featIds.reduce<AttackRoutineContribution>((result, id) => {
      const contribution = byId.get(id)?.attackRoutineRules;
      if (!contribution) return result;
      return {
        extraAttack: result.extraAttack ?? contribution.extraAttack,
        flatAttackBonusToRoutine: (result.flatAttackBonusToRoutine ?? 0) + (contribution.flatAttackBonusToRoutine ?? 0)
      };
    }, {}));
  },
  /**
   * Sprint ATK-RANGED-INTO-MELEE: fold OR declarativo sobre `rangedAttackRules`,
   * mismo patrón que `lifeRules`. Consumido por `getRangedIntoMeleeAssessment`.
   */
  rangedAttackContribution(featIds: readonly string[]): RangedAttackContribution {
    return Object.freeze(featIds.reduce<RangedAttackContribution>((result, id) => {
      const contribution = byId.get(id)?.rangedAttackRules;
      if (!contribution) return result;
      return {
        ignoresFiringIntoMeleePenalty:
          result.ignoresFiringIntoMeleePenalty === true || contribution.ignoresFiringIntoMeleePenalty === true
      };
    }, {}));
  }
});
