# Sprint 038 — Full Attack V2: Disparo Rápido (Rapid Shot) y Aceleración (Haste)

## Estado

Diseño en revisión. **A la espera de aprobación `Proceed` específica para este sprint.** No se ha modificado ningún archivo ejecutable.

## Nota sobre el NDD recibido

El documento recibido no venía marcado como `Proceed`/Fase 5 — se trata en efecto de una propuesta de diseño, y este proyecto exige que toda propuesta se contraste contra el código real antes de aprobarse (Fase 1). La investigación encontró **dos problemas de fondo** que, de implementarse tal como se propuso, habrían producido una funcionalidad rota o inerte. Se documentan aquí antes de proponer la arquitectura corregida.

### 1. Discrepancia de forma con el código real post-Sprint 036

El NDD recibido redeclara `IterativeAttack` y `AttackRoutineContribution` como si no existieran. Ambos **ya existen**, con una forma distinta a la propuesta:

- `packages/shared/src/rules.ts` (línea 2258): `IterativeAttack` ya tiene `ordinal`, `type: "primary" | "iterative"`, `routinePenalty`, `effectiveAttackBonus`. Falta solamente el nuevo valor `"extra"` en `type`.
- `packages/shared/src/rules.ts` (línea 2265): `getEffectiveAttackRoutine(context, combatant, attackContext?: Pick<AttackContext, "abilityForAttack" | "attackType">)` — el tercer parámetro ya existe, es **opcional** y de tipo acotado (no el `AttackContext` completo obligatorio que propone el NDD).
- `packages/shared/src/featCatalog.ts` (línea 28): `AttackRoutineContribution` ya existe, pero como `{ extraAttack?: { penalty: number }; flatAttackBonusToRoutine?: number }` — sin el campo `kind` propuesto, y con el nombre `flatAttackBonusToRoutine` (no `globalRoutinePenalty`; funcionalmente equivalente, es un delta con signo). Ya vive en `featCatalog.ts`, no en `effects/contracts.ts`.
- `FeatCatalog.attackRoutineContribution(featIds)` (línea 116) ya existe como fold declarativo — hoy sin consumidores.

Ninguna de estas piezas necesita "crearse"; necesitan **extenderse y, sobre todo, consumirse por primera vez**.

### 2. Gap crítico no contemplado: el servidor sigue gateando con `getAttackRoutine`, no con `getEffectiveAttackRoutine`

Este es el hallazgo más importante de Fase 1. `apps/server/src/commands/attackCommands.ts` (líneas 63-66) sigue haciendo:
```typescript
const routine = getAttackRoutine(attacker); // rutina CRUDA por BAB, sin extras
if (room.currentTurn.attacksMade >= routine.length) {
  throw new Error("No le quedan mas ataques en su rutina.");
}
```
El NDD propuesto solo toca `rules.ts` y `ActionsPanel.tsx` — **nunca `attackCommands.ts`**. Si se implementara así, la UI mostraría (vía `getEffectiveAttackRoutine`) un ataque extra de Disparo Rápido o Aceleración disponible, pero al intentar resolverlo el servidor lo rechazaría con "No le quedan mas ataques en su rutina", porque su gating autoritativo sigue midiendo `routine.length` contra la rutina cruda de BAB, que nunca creció. **Sin corregir este punto, la funcionalidad completa es inutilizable de punta a punta**, no un detalle de pulido — se agrega explícitamente al plan de este sprint.

### 3. Hallazgo más profundo: *Haste* no vive en el catálogo de `EffectDefinition` — es un `Buff` hardcodeado

El NDD propone anexar `attackRoutineRules` a `EffectDefinition` (`effects/contracts.ts`) asumiendo que Haste se resuelve a través del catálogo de `ActiveEffects`. La investigación encontró que **no es así**:

- `effectsCatalog` (`packages/shared/src/effects/catalog.ts`) no contiene ninguna entrada `"haste"` ni `"srd_haste"` — se verificó exhaustivamente (`srd_stunned`, `srd_flat_footed`, `srd_fatigued`, `srd_squeezing`, `srd_grappling`, `srd_prone`, `srd_dazed`, `srd_paralyzed`, y los dos hazards de Sprint 034; ninguno es Haste).
- `apps/server/src/combat/abilityResolver.ts` (línea 24-28) tiene un **caso especial hardcodeado**: `if (ability.resolution.kind === "effect" && (effectId === "haste" || effectId === "srd_haste")) { target.buffs.push({ ..., attackBonus: 1, speedBonusFeet: 10, remainingTurns: 5 }); return; }` — Haste empuja directamente un `Buff` (el sistema legado usado también por "Luchar a la Defensiva", Ayuda, etc.), **sin pasar nunca por `EffectManager`/`EffectInstance`/`EffectDefinition`**.
- Consecuencia: agregar `attackRoutineRules` a `EffectDefinition` no tendría **ningún efecto sobre Haste**, porque Haste nunca consulta ese catálogo. El trait `"srd_haste_effect"` que menciona el NDD recibido no existe en ningún lugar del código.

**Decisión:** en lugar de forzar una migración de Haste al sistema `ActiveEffects` (fuera de alcance razonable para este sprint — implicaría revisar duración, apilamiento y todo el ciclo de vida de un efecto real), se extiende el mismo mecanismo que Haste **ya usa**: el `Buff` plano. `Buff` ya tiene `attackBonus`/`acBonus`/`speedBonusFeet` como deltas numéricos consumidos directamente por `Rules.totalAttackBonus`/`Rules.totalArmorClass`/`Rules.totalSpeedFeet`. Se agrega `Buff.grantsExtraAttack?: { penalty: number }` con el mismo espíritu, y `getEffectiveAttackRoutine` pliega tanto `FeatCatalog.attackRoutineContribution(combatant.featIds)` (dotes permanentes: Disparo Rápido) como `combatant.buffs` (temporales: Aceleración) hacia el mismo array de salida. Esto es honesto con la arquitectura real de hoy y no inventa una tercera vía: es la misma dualidad Featas-permanentes/Buffs-temporales que ya existe para `attackBonus`.

### 4. Ajuste propuesto: generalizar "solo aplica a distancia/cuerpo a cuerpo" de forma declarativa, no por nombre de dote

El NDD recibido resolvía la restricción de Disparo Rápido ("solo con arma a distancia") con un campo `kind: "rapid_shot" | "haste"` que el motor tendría que interpretar por nombre — acoplando `getEffectiveAttackRoutine` a dotes específicas por switch/if, en vez de datos. Se propone en cambio un campo declarativo genérico `appliesToAttackType?: "melee" | "ranged"` dentro de `extraAttack`, para que la misma pieza de datos sirva de inmediato para Ataque con Dos Armas (melee-only) sin tocar `rules.ts` de nuevo — ver Regla de Tres.

## Objetivo (re-acotado)

1. Registrar `srd_rapid_shot` en `FeatCatalog` con `attackRoutineRules: { extraAttack: { penalty: 0, appliesToAttackType: "ranged" }, flatAttackBonusToRoutine: -2 }`.
2. Agregar `Buff.grantsExtraAttack?: { penalty: number }` y actualizar el caso especial de Haste en `abilityResolver.ts` para incluirlo (`penalty: 0`), manteniendo intactos `attackBonus`/`speedBonusFeet` ya existentes.
3. `getEffectiveAttackRoutine` consume ambas fuentes (dotes vía `FeatCatalog.attackRoutineContribution`, buffs vía `combatant.buffs`) para inyectar entradas `type: "extra"` y aplicar el `flatAttackBonusToRoutine` (si existe) a **todas** las entradas de la rutina, incluida la nueva.
4. **`apps/server/src/commands/attackCommands.ts` reemplaza `getAttackRoutine(attacker)` por `getEffectiveAttackRoutine(snapshot, attacker, { attackType })`** para el gating de `attacksMade`/`routine.length`, y usa `routine[attacksMade].routinePenalty` (no `.penalty`) como el delta que ya suma a `finalModifier` — sin duplicar el bono base, que sigue viniendo de `Rules.totalAttackBonus` dentro de `resolveAttack`.
5. `ActionsPanel.tsx` no necesita cambios adicionales a los ya hechos en Sprint 036 — ya lee `getEffectiveAttackRoutine`, y el array simplemente crecerá con la entrada `"extra"` cuando corresponda.
6. **No** se toca `EffectDefinition`/`effects/contracts.ts`/`effects/catalog.ts` — nada en este sprint lo necesita (Haste sigue siendo `Buff`, no `EffectInstance`).

## 1. Arquitectura Propuesta

### A. `packages/shared/src/featCatalog.ts`

```typescript
export interface AttackRoutineContribution {
  readonly extraAttack?: { readonly penalty: number; readonly appliesToAttackType?: "melee" | "ranged" };
  readonly flatAttackBonusToRoutine?: number;
}
```
(Único cambio: se agrega `appliesToAttackType` opcional dentro de `extraAttack`; `flatAttackBonusToRoutine` no cambia de nombre ni de forma — ya existe y ya es un delta con signo.)

Nueva entrada en `definitions`:
```typescript
Object.freeze({
  id: "srd_rapid_shot",
  name: "Disparo Rápido (Rapid Shot)",
  avoidsOpportunityOn: Object.freeze([] as SpecialManeuverId[]),
  attackRoutineRules: Object.freeze({
    extraAttack: Object.freeze({ penalty: 0, appliesToAttackType: "ranged" as const }),
    flatAttackBonusToRoutine: -2
  })
})
```
`FeatCatalog.attackRoutineContribution` no cambia de firma (ya existe desde Sprint 036); solo empieza a devolver datos reales cuando `srd_rapid_shot` está en `featIds`.

### B. `packages/shared/src/types.ts`

```typescript
export interface Buff {
  // ...campos existentes sin cambios...
  grantsExtraAttack?: { penalty: number };
}
```

### C. `apps/server/src/combat/abilityResolver.ts`

```typescript
if (ability.resolution.kind === "effect" && (effectId === "haste" || effectId === "srd_haste")) {
  target.buffs.push({
    id: "buff-" + Math.random().toString(36).slice(2, 10),
    name: "Haste", source: caster.name,
    attackBonus: 1, speedBonusFeet: 10,
    grantsExtraAttack: { penalty: 0 }, // NUEVO: ataque extra real al bono maximo
    remainingTurns: 5
  });
  ...
}
```

### D. `packages/shared/src/rules.ts` — `getEffectiveAttackRoutine`

Algoritmo (reemplaza el cuerpo actual, que solo componía `getAttackRoutine` + `Rules.totalAttackBonus`):
```typescript
export function getEffectiveAttackRoutine(
  context: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  attackContext?: Pick<AttackContext, "abilityForAttack" | "attackType">
): readonly IterativeAttack[] {
  const routine = getAttackRoutine(combatant);
  const baseAttack = Rules.totalAttackBonus(context, combatant, attackContext);

  const featContribution = FeatCatalog.attackRoutineContribution(combatant.featIds);
  const buffContribution = combatant.buffs.find((buff) => buff.grantsExtraAttack)?.grantsExtraAttack;

  const attackType = attackContext?.attackType;
  const extraFromFeat = featContribution.extraAttack && (!featContribution.extraAttack.appliesToAttackType || featContribution.extraAttack.appliesToAttackType === attackType)
    ? featContribution.extraAttack
    : undefined;
  const extraEntry = extraFromFeat ?? buffContribution;
  const globalPenalty = featContribution.flatAttackBonusToRoutine ?? 0;

  const entries = [...routine, ...(extraEntry ? [{ type: "extra" as const, penalty: extraEntry.penalty }] : [])];

  return Object.freeze(entries.map((entry, index) => Object.freeze({
    ordinal: index + 1,
    type: entry.type,
    routinePenalty: entry.penalty + globalPenalty,
    effectiveAttackBonus: baseAttack.total + entry.penalty + globalPenalty
  })));
}
```
Notas de diseño:
- Si tanto una dote como un buff otorgaran un ataque extra simultáneamente (no ocurre en este sprint, pero es la razón de nombrarlo explícitamente), se prioriza la dote y se documenta como decisión — no se apilan dos ataques extra en este sprint (RAW tampoco lo permite libremente; Disparo Rápido y Prisa combinados sí otorgan cada uno su propio ataque adicional según el manual, pero *apilar múltiples fuentes de ataque extra* se deja fuera de alcance explícitamente, ver sección 4).
- `globalPenalty` solo puede provenir de una dote (`flatAttackBonusToRoutine`), nunca de un buff en este sprint — Haste no impone penalizador global; si en el futuro un buff necesitara uno, se generaliza en ese momento (Regla de Tres ya cubre el patrón).

### E. `apps/server/src/commands/attackCommands.ts`

```typescript
// Antes: const routine = getAttackRoutine(attacker);
const routine = getEffectiveAttackRoutine(snapshot, attacker, { attackType });
if (room.currentTurn.attacksMade >= routine.length) { throw new Error("No le quedan mas ataques en su rutina."); }
...
const currentAttack = routine[room.currentTurn.attacksMade];
...
const finalModifier = (fightingDefensively ? -4 : 0) + tactical.attackBonus + currentAttack.routinePenalty; // antes: currentAttack.penalty
```
`attackType` ya se calcula en esa misma función (línea 80, `getWeaponAttackTypeForTarget`) antes del punto donde se usaba `getAttackRoutine` — se reordena la obtención de `routine` para que ocurra después de resolver `attackType`, sin cambiar ninguna otra secuencia de validaciones.

### F. UI

Sin cambios adicionales — `ActionsPanel.tsx` ya lee `getEffectiveAttackRoutine(snapshot, selected, { attackType })` desde Sprint 036; el array crecerá solo cuando corresponda.

## 2. Design Review Checklist

### Filtro de Irreversibilidad a 20 Sprints
Lo más difícil de revertir sería mezclar el origen del ataque extra (dote vs. buff) dentro de la firma pública de `IterativeAttack` — no se hace: `IterativeAttack` solo expone `type: "extra"`, agnóstico de si vino de una dote o un efecto temporal. Esto significa que Ataque con Dos Armas (dote futura), Ráfaga de Golpes (progresión por nivel) y ataques naturales de monstruos (dato de catálogo de criatura, no dote ni buff) podrán inyectar entradas `"extra"` por una **cuarta** vía en el futuro (ej. `combatant.naturalAttackId`/`CreatureTypeCatalog`) sin romper ningún consumidor existente de `IterativeAttack`, porque el contrato de salida ya es uniforme.

### Complejidad Accidental
Se evitó la complejidad accidental real que traía el NDD original: forzar `attackRoutineRules` dentro de `EffectDefinition` cuando ningún efecto real lo necesita todavía (Haste no pasa por ahí) habría dejado una segunda superficie de extensión completamente muerta, además de la que ya existe sin usar en `FeatCatalog` desde Sprint 036. Se prefirió extender `Buff` (ya en uso activo por Haste) en vez de migrar Haste a `EffectInstance` prematuramente — esa migración es libre de hacerse después, con su propio NDD, si Haste necesita algo más que un delta plano.

### Matriz de Reutilización de Infraestructura
1. **ActiveEffects:** deliberadamente no se toca (ver hallazgo 3).
2. **Pure Helpers (`rules.ts`):** se extiende `getEffectiveAttackRoutine` (ya existente, Sprint 036) en vez de crear una función paralela; se reutiliza `FeatCatalog.attackRoutineContribution` (inerte desde Sprint 036, ahora con su primer consumidor real).
3. **Resolvers:** `attackCommands.ts` cambia de fuente de rutina (`getAttackRoutine` → `getEffectiveAttackRoutine`) sin alterar ninguna otra validación ni el pipeline de `resolveAttack`/`attackResolver.ts`.

### La Regla de Tres
1. **Ataque con Dos Armas (Two-Weapon Fighting):** `attackRoutineRules.extraAttack.appliesToAttackType: "melee"` — mismo campo, mismo pliegue, cero cambios en `rules.ts` ni `attackCommands.ts`.
2. **Ráfaga de Golpes del Monje (Flurry of Blows):** el ataque extra "al bono máximo" y el penalizador uniforme por nivel encajan exactamente en `extraAttack.penalty`/`flatAttackBonusToRoutine`, calculados por una futura regla de progresión del monje al poblar el `FeatDefinition`.
3. **Ataques naturales de monstruos concatenados (garras/mordiscos a -5 fijo):** requeriría una tercera fuente de contribución (catálogo de criatura, no dote ni buff) plegada en el mismo array de salida — validando que el diseño de "múltiples fuentes, un solo array `IterativeAttack[]`" escala más allá de dos fuentes.

### Matriz de Impacto de Subsistemas
- [x] **Rule Engine:** `getEffectiveAttackRoutine` deja de ser una simple composición y empieza a plegar `FeatCatalog.attackRoutineContribution` + `combatant.buffs`; `IterativeAttack.type` gana `"extra"`; `AttackRoutineContribution.extraAttack` gana `appliesToAttackType`.
- [x] **CombatRoom / State Schema:** `Buff.grantsExtraAttack?: { penalty: number }` (opcional, retrocompatible).
- [ ] **WebSocket Contract:** sin cambios de payload — `resolve-attack` sigue igual.
- [ ] **UI Presentation:** sin cambios de código (Sprint 036 ya dejó `ActionsPanel.tsx` consumiendo la función correcta).
- [x] **Tests:** `tests/iterative-attacks-effective-routine.test.mjs` (extendido) + regresión de `attackCommands.ts` (nuevo o extendido) verificando que el servidor permite resolver el ataque extra hasta el final de la rutina ampliada.

## 3. Qué NO resuelve este sprint
- **Migración de Haste al sistema `ActiveEffects`/`EffectInstance`.** Sigue siendo un `Buff` hardcodeado; solo se le agrega el campo de ataque extra.
- **Apilar múltiples fuentes de ataque extra simultáneas** (ej. Disparo Rápido + Prisa activos a la vez): este sprint prioriza la dote sobre el buff y no suma ambos. Documentado como deuda aceptada.
- **Ataque con Dos Armas, Ráfaga de Golpes, ataques naturales concatenados:** quedan fuera, solo se valida que la arquitectura los soporta (Regla de Tres).
- **Corregir el nombre de efecto ambiguo `"haste"` vs `"srd_haste"`** en `abilityResolver.ts`/`data/abilities.json`/`spells/catalog.ts` (dos IDs distintos para la misma mecánica demo): fuera de alcance, se documenta como deuda preexistente detectada, no introducida por este sprint.

## Riesgos y Mitigaciones
- **Riesgo ya materializado de "UI miente, servidor rechaza":** mitigado por el punto D del NDD — `attackCommands.ts` pasa a usar `getEffectiveAttackRoutine`, la misma fuente que la UI.
- **Riesgo de doble conteo del bono base:** mitigado usando `currentAttack.routinePenalty` (delta) en `attackCommands.ts`, no `effectiveAttackBonus` (absoluto) — `resolveAttack` sigue calculando el bono base una sola vez vía su propio `Rules.totalAttackBonus` interno.
- **Riesgo de que Disparo Rápido otorgue el ataque extra en combate cuerpo a cuerpo:** mitigado por `appliesToAttackType: "ranged"`, evaluado contra `attackContext.attackType` en `getEffectiveAttackRoutine`.
- **Riesgo de que Haste's `attackBonus: 1` ya existente se duplique con el nuevo ataque extra:** no ocurre — `attackBonus` sigue fluyendo únicamente por `Rules.totalAttackBonus`'s `legacyBuffBonus`; `grantsExtraAttack` es un campo estructuralmente distinto que solo añade una entrada al array, no un bono numérico adicional.

## Validación Planeada
- Extender `tests/iterative-attacks-effective-routine.test.mjs`: combatiente con `srd_rapid_shot` y `attackType: "ranged"` obtiene una entrada `"extra"` y el `-2` se refleja en **todas** las entradas (incluida la extra); el mismo combatiente con `attackType: "melee"` no obtiene la entrada extra ni el `-2`; un combatiente con un buff `grantsExtraAttack` obtiene la entrada extra sin penalizador global.
- Nueva prueba de regresión de servidor (extender o crear `tests/full-attack.test.mjs`/uno nuevo): con `srd_rapid_shot` y modo "full" activo, el servidor permite resolver `routine.length` ataques (BAB + 1), no solo los de `getAttackRoutine` crudo; sin la dote, el comportamiento es idéntico al de antes del sprint (regresión cero).
- `npm run typecheck`, `npm run build`, y ejecución real de los tests nuevos/actualizados con el runner nativo de Node contra `packages/shared/dist/*.js` (mismo enfoque que Sprints 036/037).
