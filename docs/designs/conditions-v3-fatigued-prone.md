# Diseño Funcional: Sprint 008 — Condiciones V3 (Fatigued & Prone)
## **v2.0 — NDD Amendment (Post-Rechazo Arquitectónico)**

> ❌ La Opción A fue rechazada. Este documento implementa la **Opción B (Evolución Genérica del Pipeline)** conforme a los requerimientos emitidos en el rechazo formal.

---

## 1. Contexto y Problema a Resolver

El rechazo a la Opción A identificó dos problemas estructurales:

1. **Inconsistencia UI/Servidor**: `totalArmorClass` es invocado por el frontend para renderizar previews de CA en el grid. Prone con Opción A habría creado una CA estática "incorrecta" visible al jugador, desincronizada de la CA real que el servidor calcularía en `resolveAttack`.

2. **Deuda Estructural Irreversible**: Cover (+4 CA condicional), Concealment, Dodge (condicional al enemigo designado) y potencialmente todos los bonus situacionales del roadmap requieren exactamente el mismo mecanismo. Construirlo sólo para Prone sería parche; necesita ser genérico desde el inicio.

---

## 2. Arquitectura Aprobada: Opción B

### 2.1. El Principio Rector

**La CA no es una estadística estática del Snapshot. Es una proyección contextual en función de una agresión.**

La firma de `totalArmorClass` se extiende para aceptar un contexto táctico opcional:

```typescript
totalArmorClass(
  context: CombatRulesSnapshot<TEffectId>,
  combatant: Combatant,
  attackContext?: { attackType: "melee" | "ranged"; attackerId?: string }
): { total: number; parts: string[] }
```

- **Sin `attackContext`** (UI, fichas, previews): se computa la CA base estática (idéntica al comportamiento actual). El frontend no se rompe.
- **Con `attackContext`** (resolvers de combate, AdO): el evaluador aplica los `conditionalModifiers` declarados en el catálogo.

### 2.2. Extensión Declarativa del Catálogo

Se introduce un nuevo campo opcional en `EffectDefinition`: `conditionalModifiers`.

```typescript
// Condición de activación de un modificador condicional
export type ModifierCondition =
  | { readonly type: "attack_type"; readonly value: "melee" | "ranged" }
  | { readonly type: "attacker_has_trait"; readonly value: Trait }
  | { readonly type: "attacker_flanking"; readonly value: true };

// Modificador condicional (no entra al Reducer estático; se evalúa en contexto táctico)
export interface ConditionalModifier {
  readonly id: string;
  readonly stat: EffectStat;
  readonly value: number;
  readonly condition: ModifierCondition;
}
```

El catálogo de `srd_prone` quedaría:

```typescript
"srd_prone": {
  name: "Derribado",
  description: "...",
  traits: ["PRONE"],
  modifiers: [],
  conditionalModifiers: [
    { id: "prone_vs_melee", stat: "AC", value: +4, condition: { type: "attack_type", value: "melee" } },
    { id: "prone_vs_ranged", stat: "AC", value: -4, condition: { type: "attack_type", value: "ranged" } }
  ],
  ruleOverrides: [],
  onStack: "ignore"
}
```

### 2.3. Evaluación de Modificadores Condicionales

El `EffectReducer` **no procesa** los `conditionalModifiers` — mantiene su responsabilidad de reducción pura y estática. En cambio, se introduce una función nueva en `rules.ts`:

```typescript
function evaluateConditionalModifiers(
  reduced: ReducedEffects,
  catalog: TCatalog,
  applicable: EffectInstance[],
  attackContext: { attackType: "melee" | "ranged"; attackerId?: string }
): number
```

Esta función itera los `conditionalModifiers` de los efectos activos del objetivo y evalúa si la condición se cumple dado el `attackContext`. Retorna el delta numérico total. `totalArmorClass` la invoca opcionalmente al final del cálculo si se provee `attackContext`.

### 2.4. Integración en `totalArmorClass` (sin romper la firma actual)

```typescript
totalArmorClass(
  context: CombatRulesSnapshot<TEffectId>,
  combatant: Combatant,
  attackContext?: { attackType: "melee" | "ranged"; attackerId?: string }
): { total: number; parts: string[] } {
  // ... cálculo existente: baseAC, NO_DEX_TO_AC, legacyBuffBonus, deltaAC ...
  
  // Condicional: solo si se provee contexto táctico
  let conditionalDelta = 0;
  if (attackContext) {
    conditionalDelta = evaluateConditionalModifiers(reduced, catalog, applicable, attackContext);
    if (conditionalDelta !== 0) parts.push("condicional " + signed(conditionalDelta));
  }
  
  return { total: baseAC + legacyBuffBonus + deltaAC + conditionalDelta, parts };
}
```

### 2.5. Integración en `resolveAttack`

`resolveAttack` determina el tipo de ataque a partir del arma del atacante y lo pasa a `totalArmorClass`:

```typescript
const attackType = attacker.weapon?.handedness === "ranged" || attacker.weapon?.handedness === "thrown"
  ? "ranged"
  : "melee";

const ac = Rules.totalArmorClass(context, target, { attackType, attackerId: attacker.id });
```

---

## 3. Diseño de las Condiciones

### 3.1. `srd_fatigued` — Fatigado

```typescript
"srd_fatigued": {
  name: "Fatigado",
  description: "El personaje no puede correr ni cargar. Si ya está fatigado y sufre el efecto nuevamente, pasa a estar Exhausted.",
  traits: ["FATIGUED"],       // Trait semántico ya existente en contracts.ts
  modifiers: [],              // STR/DEX postpuestos — ver §4.1
  conditionalModifiers: [],
  ruleOverrides: ["FORBID_RUN", "FORBID_CHARGE"],  // Tipo ya existente en contracts.ts
  onStack: "ignore"
}
```

> **Hallazgo de auditoría del código existente (verificado)**: `contracts.ts` ya define `RuleOverride = "FORBID_CHARGE" | "FORBID_RUN" | "FORBID_AOO"` y el `EffectReducer` ya los extrae correctamente en `ReducedEffects.ruleOverrides`. El campo `ruleOverrides` llega poblado al consumidor — pero **nadie lo lee aún**. `evaluateActionAvailability` solo verifica `CANNOT_ACT`. `canCharge` llama a `canFullAttack` pero no consulta `ruleOverrides`. **Este es el gap exacto a cerrar en el Sprint 008: no hay infraestructura nueva, solo conectar lo existente.**

**Integración en `canCharge` (`chargeResolver.ts`)**: El resolver actual verifica `canFullAttack(room, combatant)` (turno y estado de vida) pero omite `ruleOverrides`. Deberá extenderse invocando `EffectReducer.reduceEffectsForTarget` para el combatiente y verificando:

```typescript
if (reduced.ruleOverrides.includes("FORBID_CHARGE")) {
  return { ok: false, error: combatant.name + " está fatigado y no puede cargar." };
}
```

Esta verificación ocurre **dentro de `canCharge`** (recibe el Snapshot). Es el patrón idéntico al de `CANNOT_ACT` en `evaluateActionAvailability`. **No se toca `tacticalCommands.ts`**.

---

### 3.2. `srd_prone` — Derribado

```typescript
"srd_prone": {
  name: "Derribado",
  description: "El personaje está en el suelo. +4 a CA contra ataques melee, -4 a CA contra ataques a distancia. -4 a sus propios ataques melee.",
  traits: ["PRONE"],
  modifiers: [],
  conditionalModifiers: [
    { id: "prone_vs_melee_def",   stat: "AC",     value: +4, condition: { type: "attack_type", value: "melee"  } },
    { id: "prone_vs_ranged_def",  stat: "AC",     value: -4, condition: { type: "attack_type", value: "ranged" } }
  ],
  ruleOverrides: [],
  onStack: "ignore"
}
```

> **Nota**: El penalizador de -4 a los propios ataques melee de la criatura Prone se registra como **fuera de alcance de este sprint** (requiere que `resolveAttack` consulte también los `conditionalModifiers` del atacante, que es el caso simétrico). Se registra como deuda técnica consciente.

---

## 4. Design Review Checklist Enmendado

### 4.1. El Filtro de Irreversibilidad (20 Sprints al Futuro)

> **¿Qué decisión de este diseño será la más difícil de cambiar en 20 sprints?**

**El tipo discriminante de `ModifierCondition`.** Actualmente se propone:
```typescript
{ type: "attack_type"; value: "melee" | "ranged" }
```

Si en el futuro necesitamos condiciones más complejas — como "el atacante tiene el rasgo X", "la distancia es mayor de Y pies", o "el defensor tiene un aliado adyacente" — el tipo deberá extenderse. Cada extensión es **no breaking** (unión de tipos), pero la evaluación del switch en `evaluateConditionalModifiers` deberá manejarse con `never` exhaustivo para garantizar que no haya condiciones ignoradas silenciosamente.

La decisión irreversible real es: **los `conditionalModifiers` aplican sobre el stat `AC` del defensor, evaluados desde la perspectiva del atacante**. Si D&D 3.5 necesita modificadores condicionales sobre ATTACK del atacante dependiendo del estado del defensor (ej. +2 ataque vs Prone), la arquitectura deberá extenderse para que `resolveAttack` también evalúe los `conditionalModifiers` del atacante en la función `totalAttackBonus`.

### 4.2. Complejidad Accidental Resuelta

- **`FORBID_CHARGE` y `FORBID_RUN` ya existen**: El catálogo de `contracts.ts` y el `EffectReducer` ya los soportan. El trabajo de Sprint 008 es solo conectar la validación en `canCharge`.
- **`totalArmorClass` con firma opcional**: El parámetro `attackContext?` es completamente retrocompatible. Todo código existente que no lo pase seguirá funcionando sin cambios.

### 4.3. Matriz de Reutilización

1. **ActiveEffects**: `conditionalModifiers` como nuevo campo en `EffectDefinition`. `ruleOverrides` ya existentes para Fatigued.
2. **Pure Helpers (`rules.ts`)**: Extensión de `totalArmorClass`. Nueva función `evaluateConditionalModifiers`.
3. **Resolvers**: `resolveAttack` pasa `attackType` derivado del arma. `canCharge` verifica `FORBID_CHARGE` en `ruleOverrides`.

### 4.4. Futuras Extensiones — La Regla de Tres

1. **Cover (+4 CA)**: Se modela como `conditionalModifier` con condición `{ type: "attack_type", value: "ranged" }` o bien una nueva condición `{ type: "line_of_sight_blocked" }`. La infraestructura de evaluación ya existe.
2. **Dodge (Esquiva condicional al enemigo designado)**: Requiere `{ type: "attacker_is", value: targetId }` — una extensión del discriminante `ModifierCondition` de bajo costo.
3. **Entangled (Enredado)**: Usa `FORBID_RUN` y `FORBID_CHARGE` ya definidos en `ruleOverrides`. Puede implementarse inmediatamente sin cambios de infraestructura.

### 4.5. Matriz de Impacto de Subsistemas

- [x] **Rule Engine**: Extensión de `EffectDefinition` (nuevo campo opcional), nueva función `evaluateConditionalModifiers`, firma extendida de `totalArmorClass`, extensión de `canCharge`.
- [x] **CombatRoom / State Schema**: Sin cambios. Todo vive en `effectInstances`.
- [x] **WebSocket Contract**: Sin cambios. `gm-apply-effect` acepta cualquier `ProductionEffectId` válido.
- [x] **UI Presentation**: `totalArmorClass` sin `attackContext` retorna CA estática correcta para previews — **no hay regresión de UI**.
- [x] **Tests**: Unit tests para Fatigued (FORBID_CHARGE bloqueado), Prone vs melee (+4), Prone vs ranged (-4), y retrocompatibilidad de `totalArmorClass` sin contexto.

### 4.6. ¿Qué NO Resuelve este Sprint?

**Fuera de alcance:**
- Penalizador de Fatigued a STR/DEX (requiere Attribute Modifier Pipeline dedicado).
- Penalizador de -4 a ataques propios de un combatiente Prone (caso simétrico del `conditionalModifier` en el atacante — sprint de infraestructura propio).
- Levantarse de Prone como acción de movimiento (requiere nueva acción táctica explícita).
- Condición Exhausted (superset de Fatigued, pospuesto).
- Modificadores condicionales por atacante específico (Dodge vs enemigo designado) — extensión del discriminante `ModifierCondition`.

**Deuda técnica aceptada y registrada:**
- `evaluateConditionalModifiers` comenzará con un switch de tipo discriminante simple sobre `ModifierCondition`. Cuando el número de variantes crezca, deberá evaluarse si extraerlo del `EffectReducer` o mantenerlo en `rules.ts`.
- El campo `conditionalModifiers` en `EffectDefinition` se introduce como `readonly` y opcional (`readonly conditionalModifiers?: readonly ConditionalModifier[]`), preservando compatibilidad hacia atrás con todos los efectos existentes.

---

## 5. Plan de Implementación (Requiere "Proceed" explícito)

**Orden estricto de cambios:**

1. **`packages/shared/src/effects/contracts.ts`**:
   - Añadir tipos `ModifierCondition` y `ConditionalModifier`.
   - Añadir campo `readonly conditionalModifiers?: readonly ConditionalModifier[]` en `EffectDefinition`.

2. **`packages/shared/src/effects/catalog.ts`**:
   - Añadir `srd_fatigued` (con `ruleOverrides: ["FORBID_RUN", "FORBID_CHARGE"]`).
   - Añadir `srd_prone` (con `conditionalModifiers`).

3. **`packages/shared/src/rules.ts`**:
   - Añadir función interna `evaluateConditionalModifiers`.
   - Extender `totalArmorClass` con el parámetro opcional `attackContext?`.

4. **`apps/server/src/combat/chargeResolver.ts`**:
   - Extender `canCharge` para consultar `reduced.ruleOverrides.includes("FORBID_CHARGE")`.

5. **`apps/server/src/combat/attackResolver.ts`**:
   - Derivar `attackType` del arma del atacante.
   - Pasar `{ attackType, attackerId: attacker.id }` a `Rules.totalArmorClass`.

6. **`tests/rules-evaluator.test.mjs`**:
   - Tests para Fatigued: bloqueo de carga, bloqueo de carrera.
   - Tests para Prone: CA vs melee (+4), CA vs ranged (-4), CA sin contexto (sin cambio), no stackea consigo mismo.
   - Tests de retrocompatibilidad: `totalArmorClass` sin `attackContext` no cambia para Stunned ni Flat-Footed.

7. **Documentación**: Actualizar `registry.md`, `PROJECT_STATUS.md`, `TODO.md`, `conditions-pattern.md` (§6: Modificadores Condicionales), `walkthrough.md`.
