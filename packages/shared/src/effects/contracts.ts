/**
 * Origen de un efecto activo (polimórfico).
 * No almacena referencias a objetos, solo IDs serializables.
 */
export interface EffectSource {
  readonly type: "creature" | "object" | "spell" | "aura" | "terrain" | "environment" | "system";
  readonly id?: string; // ID opcional (ej. combatantId, itemId).
}

/**
 * Políticas de duración extensibles.
 */
export type DurationPolicy =
  | { readonly type: "until_turn"; readonly anchorCombatantId: string; readonly phase: "start" | "end"; readonly appliedAtSequence: number }
  | { readonly type: "rounds"; readonly count: number; readonly anchorCombatantId: string; readonly anchorPhase: "start" | "end"; readonly appliedRound: number; readonly appliedAtSequence: number }
  | { readonly type: "permanent" }
  | { readonly type: "until_rest" }
  | { readonly type: "until_dispelled" }
  | { readonly type: "until_save_success"; readonly saveType: "fort" | "ref" | "will"; readonly dc: number };

/**
 * Rasgos (Traits) descriptivos que definen ESTADOS, no comportamientos.
 */
export type Trait =
  | "IMMOBILIZED"
  | "UNCONSCIOUS"
  | "NO_DEX_TO_AC"
  | "NO_THREAT"
  | "LIMITED_ACTIONS"
  | "PRONE"
  | "GRAPPLING"
  | "SQUEEZING"
  | "BLIND"
  | "FATIGUED"
  | "EXHAUSTED"
  | "MIND_AFFECTING"
  | "CANNOT_ACT"
  | "CANNOT_MOVE"
  | "HELPLESS"
  | "CANNOT_MAKE_AOO"
  | "IMMUNE_TO_CRITICAL_HITS"
  | "COMBAT_REFLEXES"
  | "IMMUNE_TO_PRECISION_DAMAGE";

/**
 * Estadísticas numéricas que el Reducer puede producir deltas para.
 * Este tipo es CERRADO intencionalmente — expandir solo cuando una regla nueva lo requiera.
 */
export type EffectStat = "ATTACK" | "AC" | "SPEED" | "STRENGTH" | "DEXTERITY" | "SNEAK_ATTACK_DICE" | "FORTITUDE" | "REFLEX" | "WILL";

/**
 * Política de apilamiento del Reducer.
 * Las políticas tienen semántica matemática estricta e inequívoca:
 *
 * - highest_value: El máximo numérico algebraico del grupo.
 * - lowest_value:  El mínimo numérico algebraico del grupo.
 * - sum:           La suma algebraica de todos los valores del grupo.
 * - unique_by_source: Un solo modificador por identidad de fuente (sourceKey).
 *   La fuente DEBE tener un `id` explícito; si no, el Reducer rechaza el modificador.
 *   Cuando hay múltiples del mismo origen, sobrevive el de mayor valor absoluto (mayor |value|).
 */
export type StackingPolicy = "highest_value" | "lowest_value" | "sum" | "unique_by_source";

/**
 * Modificadores mecánicos y numéricos.
 *
 * La variante `numeric` ahora incluye:
 * - id: Identificador declarativo estable del modificador dentro del EffectDefinition.
 * - stackingGroup: Agrupación de apilamiento (ej. "morale", "circumstance"). El Reducer
 *   NO interpreta el nombre; es un dato declarativo puro.
 * - stackingPolicy: Regla de combinación dentro del grupo + polaridad.
 *   Todos los modificadores del mismo grupo+polaridad DEBEN declarar la MISMA política;
 *   de lo contrario, el Reducer lanzará un error explícito.
 */
export type Modifier =
  | {
      readonly type: "numeric";
      readonly id: string;
      readonly stat: EffectStat;
      readonly stackingGroup: string;
      readonly stackingPolicy: StackingPolicy;
      readonly value: number;
    }
  | { readonly type: "override"; readonly stat: EffectStat; readonly value: number }
  | { readonly type: "multiplier"; readonly stat: "CRIT_RANGE" | "CRIT_MULTIPLIER"; readonly value: number }
  | { readonly type: "mechanic"; readonly rule: "CONCEALMENT"; readonly percentage: number };

/**
 * Condición de activación de un modificador condicional.
 * El tipo es un discriminante cerrado con exhaustividad garantizada en el evaluador.
 * Nuevas variantes se agregan aquí y deben manejarse en `evaluateConditionalModifiers`.
 */
export type ModifierCondition =
  | { readonly type: "attack_type"; readonly value: "melee" | "ranged" }
  | { readonly type: "attacker_prone"; readonly value: true };
  // Futuras extensiones (no implementadas aún):
  // | { readonly type: "attacker_has_trait"; readonly value: Trait }
  // | { readonly type: "attacker_is"; readonly value: string }   // Dodge vs enemigo designado
  // | { readonly type: "line_of_sight_blocked"; readonly value: true } // Cover

/**
 * Modificador condicional (no procesado por el Reducer estático).
 * Se evalúa en tiempo de resolución táctica cuando se provee un `attackContext`.
 * - `id`: Identificador único dentro del EffectDefinition.
 * - `stat`: La estadística afectada.
 * - `value`: Delta a aplicar si la condición se cumple.
 * - `condition`: Predicado de activación.
 */
export interface ConditionalModifier {
  readonly id: string;
  readonly label: string;
  readonly stat: EffectStat;
  readonly value: number;
  readonly stackingGroup?: string;
  readonly condition: ModifierCondition;
}

/** Predicados contextuales para traits que dependen de la relación de una instancia. */
export type TraitCondition =
  | { readonly type: "attacker_outside_effect_targets"; readonly value: true };

export interface ConditionalTrait {
  readonly trait: Trait;
  readonly condition: TraitCondition;
}

/**
 * Excepciones de reglas puras (bloqueos operativos).
 */
export type RuleOverride = "FORBID_CHARGE" | "FORBID_RUN" | "FORBID_AOO";

/**
 * Contribución multiplicativa especializada para la velocidad efectiva.
 *
 * Se mantiene fuera de `Modifier.numeric`: una razón representa una tasa, no
 * un delta plano. `stackingKey` identifica aportes mecánicamente equivalentes
 * para que el reducer aplique uno solo con trazabilidad determinista.
 */
export interface MovementRateContribution {
  readonly id: string;
  readonly label: string;
  readonly stackingKey: string;
  readonly numerator: number;
  readonly denominator: number;
}

/**
 * Bloque declarativo (Sprint 034) que describe un peligro ambiental persistente (trampa, muro
 * mágico, terreno peligroso) anclado a `targetCells` en vez de a un `targetId` biológico.
 * Es exclusivamente datos: números y strings. No contiene funciones ni callbacks, y no consulta
 * el estado del combate — la resolución (tirada, mitigación, aplicación de daño/efecto) vive en
 * `resolveEnvironmentalHazards` (capa de orquestación del servidor), nunca aquí.
 */
export interface EnvironmentalHazard {
  readonly savingThrowType: "fortitude" | "reflex" | "will";
  readonly saveEffect: "none" | "half" | "negates";
  readonly dc: number;
  /** Expresión de dados (ej. "2d4"). Ausente si el hazard solo aplica una condición (`onFailEffectId`). */
  readonly damageExpression?: string;
  /** Efecto adicional (referencia a otra entrada del catálogo) a inyectar si la salvación falla. */
  readonly onFailEffectId?: string;
}

/**
 * Nivel 1: EffectDefinition (El Catálogo)
 * Descripción puramente declarativa y determinista de un efecto.
 */
export interface EffectDefinition {
  readonly name: string;
  readonly description: string;
  readonly traits: readonly Trait[];
  readonly modifiers: readonly Modifier[];
  /**
   * Modificadores que solo se aplican en contexto táctico específico (ej. tipo de ataque).
   * NO son procesados por el EffectReducer estático.
   * Se evalúan en `totalArmorClass` cuando se provee `attackContext`.
   * Campo opcional para compatibilidad hacia atrás: efectos sin este campo se comportan igual.
   */
  readonly conditionalModifiers?: readonly ConditionalModifier[];
  /** Traits proyectados únicamente cuando el contexto satisface la condición de la instancia. */
  readonly conditionalTraits?: readonly ConditionalTrait[];
  /** Contribuciones multiplicativas a la velocidad; nunca persisten un total derivado. */
  readonly movementRateContributions?: readonly MovementRateContribution[];
  readonly ruleOverrides: readonly RuleOverride[];
  // Reglas de apilamiento de instancias del mismo tipo de efecto
  readonly onStack: "ignore" | "replace" | "upgrade_to" | "accumulate";
  readonly upgradeTo?: string; // Si onStack === "upgrade_to", hacia qué efecto evoluciona (string para evitar circularidad fina)
  /** Bloque declarativo de peligro ambiental (Sprint 034). Ausente en condiciones/buffs normales. */
  readonly hazard?: EnvironmentalHazard;
}
