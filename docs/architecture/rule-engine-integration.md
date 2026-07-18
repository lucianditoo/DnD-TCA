# Diseño Arquitectónico: Rule Engine Integration (EFFECTS-SYS-REDUCER)

## 1. Objetivo
Conectar la infraestructura puramente temporal (ActiveEffects, Sprint 002-004) con el motor de reglas mecánicas (`rules.ts`) de manera determinista y performante.

Este documento establece la frontera estable de evaluación para que las funciones de reglas puedan calcular resultados basados en efectos globales, garantizando inmutabilidad, predictibilidad y aislamiento para pruebas.

## 2. El Contexto de Evaluación

El Reducer no debe conocer `CombatRoom` ni la arquitectura circundante. Debe recibir únicamente los datos estrictos necesarios (instancias de efectos y el catálogo).
La capa de reglas extraerá estos datos del contexto oficial del motor: `CombatRulesSnapshot`.

### 2.1 CombatRulesSnapshot como Contexto Oficial
Se formaliza `CombatRulesSnapshot` como el único objeto de contexto requerido por las reglas puras temporales. Contendrá una copia estructural (con `deepFreeze` en desarrollo) de las instancias de efectos.

El Snapshot es **puramente pasivo**.
- No invoca reglas.
- No ejecuta funciones.
- No conoce el Reducer.
- No consolida estadísticas.

El assembler (ej. un handler de comandos) crea el Snapshot y se lo entrega al Rule Engine.

## 3. El Reducer de Efectos (`effects/reducer.ts`)

El `Reducer` es una función genérica y pura. No asume una única fuente de verdad y agrupa modificadores basándose exclusivamente en los metadatos declarativos del catálogo.

### 3.1. Firma Requerida y Catálogos Genéricos

Para aislar los tests sin contaminar el catálogo de producción, se utiliza tipado genérico:

```typescript
export interface EffectReductionInput<TCatalog extends Record<string, EffectDefinition>> {
  readonly effectInstances: readonly EffectInstance<keyof TCatalog>[];
  readonly targetId: string;
  readonly catalog: TCatalog;
}

export const EffectReducer = {
  reduceEffectsForTarget<TCatalog extends Record<string, EffectDefinition>>(
    input: EffectReductionInput<TCatalog>
  ): ReducedEffects
};
```

### 3.2. Modelo de Resultado (`ReducedEffects`) y Tipado Estricto

El Reducer genera "deltas" (no estadísticas finales). Las estadísticas permitidas en este Sprint están estrictamente limitadas.

```typescript
export type EffectStat = "ATTACK" | "AC" | "SPEED";

export interface ModifierTrace {
  readonly effectId: string;
  readonly effectInstanceId: string;
  readonly modifierId: string;
  readonly stat: EffectStat;
  readonly stackingGroup: string;
  readonly value: number;
  readonly status: "applied" | "suppressed";
  readonly reason?: "stacking";
}

export interface ReducedNumericModifier {
  readonly total: number;
  readonly bonuses: readonly ModifierTrace[];
  readonly penalties: readonly ModifierTrace[];
}

export interface ReducedEffects {
  readonly numericModifiers: Readonly<Partial<Record<EffectStat, ReducedNumericModifier>>>;
  readonly traits: readonly Trait[]; // Únicos, orden determinista
  readonly ruleOverrides: readonly RuleOverride[]; // Únicos, orden determinista
}
```

### 3.3. Estrategia Declarativa de Stacking y Agrupación
El Reducer desconoce conceptos como "morale" o "dodge". El apilamiento se define enteramente por los datos:

```typescript
export interface NumericModifierDefinition {
  readonly type: "numeric";
  readonly id: string; // Identificador estable para la traza
  readonly stat: EffectStat;
  readonly stackingGroup: string; // Ej: "morale", "circumstance", "base"
  readonly stackingPolicy: "highest_value" | "lowest_value" | "sum" | "unique_by_source";
  readonly value: number;
}
```

**Semántica Matemática de Políticas:**
- `highest_value`: Máximo numérico algebraico.
- `lowest_value`: Mínimo numérico algebraico (el más negativo).
- `sum`: Suma algebraica de todos los valores del grupo.
- `unique_by_source`: Se permite un solo modificador por identidad de fuente.

**Resolución en el Reducer:**
1. Separa modificadores en `bonuses` (>0) y `penalties` (<=0).
2. Agrupa por `stat` + `stackingGroup` + polaridad.
3. Aplica la `stackingPolicy` dentro de cada subgrupo.
4. Para `unique_by_source`, el Reducer derivará una `sourceKey` (ej. `${source.type}:${source.id || "global"}`) de la instancia para evitar que la misma fuente aplique el mismo efecto dos veces, pero permitiendo que distintas instancias del mismo hechizo sí se apliquen si la fuente es distinta.

## 4. Integración e Inyección (Rule Evaluator)

Para permitir pruebas de integración reales en `rules.ts` sin usar mocks globales ni ensuciar el catálogo de producción, se introduce una fábrica funcional de reglas:

```typescript
export function createRuleEvaluator<TCatalog extends Record<string, EffectDefinition>>(catalog: TCatalog) {
  return {
    totalAttackBonus(context: CombatRulesSnapshot, combatant: Combatant) { ... },
    totalArmorClass(context: CombatRulesSnapshot, combatant: Combatant) { ... },
    totalSpeedFeet(context: CombatRulesSnapshot, combatant: Combatant) { ... }
  };
}

// Exportación productiva para ser consumida por handlers y UI
export const Rules = createRuleEvaluator(effectsCatalog);
```

Los tests de reglas podrán crear su propia instancia `const testRules = createRuleEvaluator(testCatalog)` y verificar la correcta acumulación sin depender del estado global.

## 5. Alcance y Fronteras del Sprint 005
- **Reglas Funcionales Visibles:** Ninguna. El catálogo productivo (`effectsCatalog`) mantendrá únicamente `__INFRASTRUCTURE_SAMPLE__`. Ningún combate real se verá afectado numéricamente durante el Sprint 005.
- **Traits y Overrides:** Serán extraídos, agrupados de forma determinista y devueltos por el Reducer, pero **las reglas puras (`canMove`, `canAct`) no los interpretarán todavía**. Su interpretación funcional corresponde al Sprint 006 (Sistema Formal de Condiciones).
