# Plan de Implementación — Sprint 038: Full Attack V2 (Disparo Rápido & Aceleración)

## Estado

Fase 3 — plan técnico pendiente de aprobación formal `Proceed` **específica para este sprint**. No modificar archivos `.ts`, `.tsx`, `.json` ni tests antes de esa autorización.

## Objetivo operativo

Consumir por primera vez el punto de extensión `FeatCatalog.attackRoutineRules`/`attackRoutineContribution` (inerte desde Sprint 036) para Disparo Rápido, extender `Buff` con `grantsExtraAttack` para Aceleración (Haste sigue siendo un `Buff` hardcodeado, no una `EffectInstance` — ver NDD), y **corregir el gating autoritativo del servidor** en `attackCommands.ts` para que use `getEffectiveAttackRoutine` en vez de `getAttackRoutine`, sin lo cual ningún ataque extra sería resoluble de punta a punta.

## Principio rector

Un solo array de salida (`IterativeAttack[]`), múltiples fuentes de entrada (rutina BAB, dote vía `FeatCatalog`, buff temporal). El servidor y la UI deben derivar la longitud de la rutina y el penalizador de cada ataque de la **misma** llamada a `getEffectiveAttackRoutine` — nunca de `getAttackRoutine` crudo una vez que existan fuentes de ataques extra.

## Orden de implementación

### 1. Tests de caracterización previos

Archivo: `tests/iterative-attacks-effective-routine.test.mjs` (extendido)

Acciones:
1. fijar que un combatiente con `srd_rapid_shot` y `attackContext.attackType === "ranged"` obtiene una entrada adicional `type: "extra"` con `routinePenalty` reflejando el `-2` global sumado a su propio `penalty: 0`;
2. fijar que el mismo combatiente, con `attackType === "melee"`, NO recibe la entrada extra ni el `-2` en ninguna entrada;
3. fijar que el `-2` global se refleja en **todas** las entradas de la rutina (primaria, iterativas y la extra), no solo en la nueva;
4. fijar que un combatiente con un `Buff` cuyo `grantsExtraAttack` esté presente obtiene la entrada extra sin penalizador global, y sin necesitar `attackType` en el contexto;
5. fijar que, sin dote ni buff relevante, la salida es idéntica byte-a-byte a la del Sprint 036 (regresión cero).

Archivo nuevo o extensión de `tests/full-attack.test.mjs` (regresión de servidor):
6. fijar que `attackCommands.ts::handleResolveAttackDraft`, con `srd_rapid_shot` y modo "full" activo, permite resolver `getAttackRoutine(attacker).length + 1` ataques (no se detiene en la rutina cruda);
7. fijar que sin la dote, el número de ataques permitidos es idéntico al de antes del sprint.

### 2. Catálogo declarativo

Archivo: `packages/shared/src/featCatalog.ts`

Acciones:
1. agregar `appliesToAttackType?: "melee" | "ranged"` dentro de `AttackRoutineContribution.extraAttack`;
2. agregar `FeatDefinition` para `srd_rapid_shot`: `attackRoutineRules: { extraAttack: { penalty: 0, appliesToAttackType: "ranged" }, flatAttackBonusToRoutine: -2 }`.

### 3. Extensión del Buff temporal

Archivo: `packages/shared/src/types.ts`

Acciones:
1. agregar `grantsExtraAttack?: { penalty: number }` a `Buff`.

Archivo: `apps/server/src/combat/abilityResolver.ts`

Acciones:
2. en el caso especial de Haste (línea ~24-28), agregar `grantsExtraAttack: { penalty: 0 }` al `Buff` empujado, sin tocar `attackBonus`/`speedBonusFeet`/`remainingTurns` existentes.

### 4. Read-model unificado

Archivo: `packages/shared/src/rules.ts`

Acciones:
1. reescribir el cuerpo de `getEffectiveAttackRoutine` para plegar `FeatCatalog.attackRoutineContribution(combatant.featIds)` y `combatant.buffs.find(b => b.grantsExtraAttack)`, aplicando la condición `appliesToAttackType` contra `attackContext?.attackType` antes de honrar la contribución de la dote;
2. agregar `"extra"` a la unión `IterativeAttack["type"]`;
3. aplicar `flatAttackBonusToRoutine` (si la dote lo declara) a **todas** las entradas del array resultante, incluida la extra.

### 5. Corrección del gating autoritativo (requisito, no opcional)

Archivo: `apps/server/src/commands/attackCommands.ts`

Acciones:
1. reordenar la obtención de `attackType` (ya calculado en la función) antes de derivar la rutina;
2. reemplazar `const routine = getAttackRoutine(attacker);` por `const routine = getEffectiveAttackRoutine(snapshot, attacker, { attackType });`;
3. reemplazar el uso de `currentAttack.penalty` por `currentAttack.routinePenalty` en el cálculo de `finalModifier`, sin tocar ninguna otra línea del pipeline de `resolveAttack`.

### 6. UI

Sin acciones — `ActionsPanel.tsx` ya consume `getEffectiveAttackRoutine` desde Sprint 036; el array crecerá automáticamente.

### 7. Regresión y cierre

Acciones:
1. ejecutar secuencialmente: `npm run typecheck`, `npm run build`, y correr los tests nuevos/extendidos con el runner nativo de Node contra `packages/shared/dist/*.js` (mismo enfoque que Sprints 036/037), además de `npm test` completo si el entorno lo permite;
2. actualizar al cierre: `PROJECT_STATUS.md`, `TODO.md`, `walkthrough.md`, `.ai/PROJECT_MEMORY.md`.

## Riesgos y gates

| Riesgo | Gate |
|---|---|
| UI muestra un ataque extra que el servidor rechaza | test de regresión de servidor (paso 1.6) exigiendo `routine.length` ampliado en `attackCommands.ts` |
| Doble conteo del bono base al usar `effectiveAttackBonus` en vez de `routinePenalty` en el servidor | revisión estática: `attackCommands.ts` solo lee `.routinePenalty`, nunca `.effectiveAttackBonus` |
| Disparo Rápido otorga el ataque extra en cuerpo a cuerpo | test explícito con `attackType: "melee"` → sin entrada extra |
| Migrar Haste a `EffectInstance` de forma no planeada (scope creep) | el NDD documenta explícitamente que Haste sigue siendo `Buff`; cero cambios en `effects/contracts.ts`/`catalog.ts` |
| Apilar accidentalmente dote + buff si ambos otorgan ataque extra | regla explícita: se prioriza la dote sobre el buff, documentada como deuda aceptada, no como bug |

## Criterio de detención

Con el NDD y este plan sincronizados, detener la ejecución y esperar un `Proceed` explícito para el Sprint 038. No se autoriza todavía ningún cambio de código o tests.
