# Sprint 036 — Consolidación de la Rutina de Ataques Iterativos (Read-Model Unificado)

## Estado

Diseño en revisión. **A la espera de aprobación `Proceed` específica para este sprint.** No se ha modificado ningún archivo ejecutable.

## Nota sobre la instrucción recibida

La instrucción de Fase 1/2 pide diseñar "desde cero" el Sistema de Ataques Iterativos Múltiples (Rule ID `ATTACK-ITERATIVE`). Antes de proponer arquitectura, la investigación obligatoria de Fase 1 (leer `.ai/` y la infraestructura real) encontró que **este sistema ya existe, está implementado, probado y en producción**, no como un supuesto a verificar sino como código ya escrito:

1. **La rutina pura por BAB ya existe.** `packages/shared/src/rules.ts` (línea ~2240) define `getAttackRoutine(combatant): AttackRoutineItem[]`, exactamente con el algoritmo descrito en la instrucción: primario en +0, e iterativos en -5/-10/-15 según el BAB cruce 6/11/16, tope estricto de 4 ataques. Tiene test dedicado (`tests/full-attack.test.mjs`) verificando los cuatro umbrales (BAB 4, 6, 11, 16).
2. **El gating servidor por `attackMode` ya existe y ya es transaccional.** `apps/server/src/commands/attackCommands.ts::handleResolveAttackDraft` (dentro de una transacción `cloneCombatRoom`/`commitCombatRoomTransaction`) ya: rechaza cualquier ataque si `attackMode === "none"`; rechaza un segundo ataque si `attackMode === "standard"` (`attacksMade >= 1`); indexa `routine[attacksMade]` para obtener el penalizador del ataque actual; rechaza si `attacksMade >= routine.length`; e incrementa `currentTurn.attacksMade += 1` de forma autoritativa tras cada resolución exitosa (con y sin amenaza de crítico). El efecto es idéntico al pedido en la instrucción ("si el índice ordinal > 0, exigir `attackMode === 'full'`"), solo que expresado como "el modo Estándar corta en 1" en vez de "el iterativo exige Completo" — misma regla, ya en producción.
3. **La UI predictiva ya existe.** `apps/web/src/components/ActionsPanel/ActionsPanel.tsx` (línea ~184) ya llama a `getAttackRoutine(selected)` para derivar `routine`, `attacksMade`, `currentAttack.penalty` y `hasRemainingAttacks`, ya muestra "Ataque X de Y (Penalizador Z)" cuando `routine.length > 1 && attackMode === "full"`, y ya deshabilita el botón de resolución (`!hasRemainingAttacks`) cuando la rutina se agotó. El bloqueo por movimiento >5 ft ya es autoritativo en `canFullAttack` (`rules.ts` línea 798: `movementUsedFeet > cellSizeFeet` rechaza el Ataque Completo antes de resolver el primer ataque de la rutina), no una validación cliente.
4. **Los penalizadores "por dotes o condiciones" que la instrucción pide anexar al objeto `IterativeAttack` ya existen, pero en otra capa — correctamente.** El -4 por Presa (`"forcejeo en presa -4"`, `rules.ts` línea 1849/1853, vía `getGrappleAttackEligibility`) y el -4 por Apretujarse (`srd_squeezing`, `effects/catalog.ts` línea 82, `conditionalModifiers` con `condition: { type: "attack_type", value: "melee" }`) ya se evalúan de forma genérica dentro de `evaluateConditionalModifiers` y ya se suman en `Rules.totalAttackBonus` (línea 338/349) — el mismo punto que consume flanqueo, Aid Another, alcance y cualquier futuro modificador de ataque. **Fusionar estos penalizadores dentro de un objeto `IterativeAttack` congelado por adelantado sería una regresión arquitectónica real**: (a) duplicaría una fuente de verdad que ya es única y testeada, (b) el resultado dejaría de ser correcto en cuanto el objetivo importe (flanqueo depende del `target`, que la rutina no conoce de antemano — es una proyección *por combatiente*, no *por combatiente+objetivo*), y (c) rompería el patrón "las reglas importantes no viven en más de un lugar" que ya gobierna el resto del motor (`CODEX_GUIDE.md`, `PROJECT_STATUS.md`).
5. **El patrón `RuleResult` con "rechazo explícito" ya existe, pero no en el handler de comandos.** `canFullAttack`/`canStandardAttack` (funciones puras) devuelven `RuleResult<true>`; el *handler* de red (`handleResolveAttackDraft`) los consume y **lanza `Error`** si `!result.ok` — es el mismo patrón de control de errores que usan absolutamente todos los demás handlers de este proyecto (`declare-dodge-target`, `use-tactical-action`, etc.). No hay necesidad ni precedente de que un comando WebSocket devuelva un `RuleResult` en vez de lanzar.

**Conclusión de Fase 1:** Construir el sistema "desde cero" como si no existiera duplicaría ~250 líneas de lógica ya correcta y arriesgaría una regresión sobre `tests/full-attack.test.mjs` y sobre toda la suite de combate que ya ejercita ataques completos (carga, flanqueo, Presa, Apretujarse). El Sprint 036 se re-enfoca a continuación hacia el **delta real y legítimo**: un read-model puro unificado que absorba el mismo cálculo que hoy vive repartido entre `getAttackRoutine` + `currentAttack.penalty` (UI) + `Rules.totalAttackBonus` (servidor), para que ambas capas dejen de recalcular por separado y para dejar un punto de extensión documentado para dotes futuras (Disparo Rápido, Ataques Múltiples con Dos Armas, el ataque extra de *Haste*).

## Objetivo (re-acotado)

1. Introducir `getEffectiveAttackRoutine(context, combatant): readonly IterativeAttack[]` en `packages/shared/src/rules.ts` como una proyección pura **adicional** (no un reemplazo) sobre `getAttackRoutine`, que devuelva por cada entrada de la rutina el bonus de ataque total ya resuelto (BAB + característica + tamaño + modificadores de efectos no condicionados a un objetivo específico + el penalizador iterativo de esa entrada), para que la UI deje de mostrar solo el penalizador relativo ("Penalizador -5") y pueda mostrar el bonus absoluto pedido en la instrucción ("2do Ataque: +6").
2. Documentar y dejar preparado (sin implementar) un punto de extensión en `FeatCatalog` para que una dote futura pueda inyectar ataques adicionales a la rutina (Disparo Rápido, Ataque con Dos Armas) o modificar el bonus base de todos los ataques de la rutina (*Haste*), sin tocar el contrato de red ni el handler de `resolve-attack`.
3. Actualizar `ActionsPanel.tsx` para consumir `getEffectiveAttackRoutine` en el bloque de rutina iterativa ya existente (línea ~250), mostrando el bonus absoluto de cada entrada en vez de solo el penalizador.
4. **No** tocar la validación transaccional de `handleResolveAttackDraft` (ya correcta), **no** tocar el contrato del comando `resolve-attack` (ya no necesita cambios), **no** tocar `evaluateConditionalModifiers`/`EffectReducer`/el catálogo de efectos (Presa y Apretujarse siguen viviendo exactamente donde viven).

## 1. Decisión arquitectónica: ¿nueva capa o consolidación de la existente?

Se descarta construir una segunda tubería de resolución de ataques iterativos (la que sugiere la instrucción original, con penalizadores de Presa/Apretujarse embebidos en cada `IterativeAttack`) por las razones (4) y (5) de la sección anterior. En su lugar:

**Decisión:** `getEffectiveAttackRoutine` es una función de **lectura pura** que combina dos fuentes ya existentes y ya correctas (`getAttackRoutine` para la forma/longitud de la rutina y penalizador ordinal; `Rules.totalAttackBonus` para el bonus base resuelto sin contexto de objetivo) en un único array congelado. No introduce una tercera fuente de verdad: simplemente evita que la UI reimplemente en TypeScript de React la aritmética `BAB + característica + tamaño` que el servidor ya calcula, algo que hoy **no pasa** (la UI solo muestra el penalizador relativo, nunca reimplementó el cálculo absoluto) pero que la instrucción pide exponer.

Los modificadores dependientes de objetivo o de contexto transitorio (flanqueo, Presa, Apretujarse, Luchar a la Defensiva, alcance) **deliberadamente no se incluyen** en `getEffectiveAttackRoutine` — siguen aplicándose exactamente donde ya se aplican hoy (`getAttackContextModifiers`, `evaluateConditionalModifiers`, `finalModifier` en `attackCommands.ts`), porque requieren un `target` concreto que la rutina (una propiedad *del atacante*, no del par atacante/objetivo) no tiene por diseño. Esto es coherente con cómo la UI de hoy ya muestra el bonus "sin objetivo" (`Rules.totalAttackBonus` en `SelectedInfo`) por separado del bonus "con objetivo, en el momento de disparar" (`getAttackContextModifiers`, calculado solo cuando hay `attackTarget`).

## 2. Arquitectura Propuesta

### A. Nueva proyección pura (`packages/shared/src/rules.ts`)

```typescript
export interface IterativeAttack {
  readonly ordinal: number;           // 1-based: 1º, 2º, 3º, 4º ataque
  readonly type: "primary" | "iterative";
  readonly routinePenalty: number;    // -0/-5/-10/-15, mismo valor que AttackRoutineItem.penalty
  readonly effectiveAttackBonus: number; // Rules.totalAttackBonus(...).total + routinePenalty
}

export function getEffectiveAttackRoutine(
  context: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant
): readonly IterativeAttack[] {
  const routine = getAttackRoutine(combatant);
  const baseAttack = Rules.totalAttackBonus(context, combatant);
  return Object.freeze(routine.map((entry, index) => Object.freeze({
    ordinal: index + 1,
    type: entry.type,
    routinePenalty: entry.penalty,
    effectiveAttackBonus: baseAttack.total + entry.penalty
  })));
}
```

No reemplaza `getAttackRoutine` (que sigue siendo la única fuente de la *forma* de la rutina, consumida por `attackCommands.ts` exactamente como hoy) ni `Rules.totalAttackBonus` (que sigue siendo la única fuente del bonus base). Es estrictamente una composición de ambas, sin lógica nueva.

### B. Punto de extensión documentado en `FeatCatalog` (sin implementar dotes)

Se agrega el campo opcional a la interfaz (siguiendo el mismo patrón de `lifeRules`/`tacticalActionRules`), **sin poblar ninguna dote todavía**:

```typescript
export interface AttackRoutineContribution {
  readonly extraAttack?: { readonly penalty: number };       // p.ej. Disparo Rápido: -2 a todos, +1 ataque
  readonly flatAttackBonusToRoutine?: number;                  // p.ej. Haste: +1 a cada entrada de la rutina
}

export interface FeatDefinition {
  // ...campos existentes sin cambios...
  readonly attackRoutineRules?: AttackRoutineContribution;
}
```

Y un selector agregador, mismo estilo que `FeatCatalog.lifeRules`:
```typescript
attackRoutineContribution(featIds: readonly string[]): AttackRoutineContribution { /* fold, igual que lifeRules */ }
```

Este selector queda **sin consumidores** en este sprint — es la infraestructura declarativa lista para que un sprint futuro implemente Disparo Rápido/Ataque con Dos Armas sin tocar `attackCommands.ts` ni el esquema Zod de `resolve-attack`, solo leyendo `getEffectiveAttackRoutine` (que en ese momento incorporaría esta contribución).

### C. UI (`apps/web/src/components/ActionsPanel/ActionsPanel.tsx`)

El bloque ya existente (línea ~250, `routine.length > 1 && attackMode === "full"`) cambia su fuente de datos de `getAttackRoutine(selected)` + `currentAttack.penalty` a `getEffectiveAttackRoutine(snapshot, selected)`, y el texto pasa de `"Ataque X de Y (Penalizador Z)"` a mostrar el bonus absoluto de la entrada activa (`effectiveAttackBonus`), formateado con signo (`+11`, `+6`, etc.), conservando el mismo criterio de bloqueo ya autoritativo (`hasRemainingAttacks`, `actionDisabled`). Cero lógica de reglas nueva en React.

## 3. Design Review Checklist

### Filtro de Irreversibilidad a 20 Sprints
Lo más difícil de revertir sería exactamente lo que este NDD evita: si hubiéramos embebido penalizadores de Presa/Apretujarse dentro de cada `IterativeAttack` congelado, cualquier futura mecánica que dependa del objetivo (Punto Débil, Combate a Ciegas, Esquiva Sobrenatural condicionada al atacante) hubiera exigido recalcular la rutina completa por cada objetivo potencial — un array que en realidad no depende de "a quién le pego" se hubiera acoplado a esa dimensión igual. Mantener `getEffectiveAttackRoutine` como función *solo del atacante* preserva la posibilidad de cachearla/memoizarla por combatiente-turno sin invalidarla por cambios de objetivo, y dentro de 20 sprints eso sigue siendo cierto sin im portar cuántas dotes de ataque nuevas se agreguen.

### Complejidad Accidental
Sí existe una pieza heredada digna de mención: el bonus "efectivo" no puede incluir flanqueo/Presa/Apretujarse porque esos dependen de un `target` que la rutina no recibe — no es una limitación artificial de este diseño, es la misma frontera que ya separa `Rules.totalAttackBonus` (sin objetivo) de `getAttackContextModifiers` (con objetivo) en el código actual. No se intenta "arreglar" esa frontera aquí porque hacerlo (pasar un `target` opcional a la rutina) mezclaría una proyección *por turno* con una *por intento de ataque*, complejizando el único punto de invalidación (recalcular en cada selección de objetivo en vez de una vez por turno).

### Matriz de Reutilización de Infraestructura
1. **ActiveEffects:** no se toca; Presa y Apretujarse permanecen en `effects/catalog.ts` con sus `conditionalModifiers` intactos.
2. **Pure Helpers (`rules.ts`):** se reutilizan íntegramente `getAttackRoutine` y `Rules.totalAttackBonus`; `getEffectiveAttackRoutine` es pura composición, cero matemática nueva.
3. **Resolvers:** `attackCommands.ts::handleResolveAttackDraft` no cambia una sola línea — sigue usando `getAttackRoutine`/`currentAttack.penalty` exactamente como hoy, porque esa lógica ya es correcta y ya está probada.

### La Regla de Tres
1. **Disparo Rápido (Rapid Shot):** agrega un ataque extra a distancia con -2 a todos los ataques del turno. Con `attackRoutineRules.extraAttack` ya declarado en `FeatDefinition`, un sprint futuro solo necesita poblar la dote y hacer que `getEffectiveAttackRoutine` (no `attackCommands.ts`) agregue la entrada — cero cambios de red.
2. **Ataque con Dos Armas (Two-Weapon Fighting):** agrega ataques del arma secundaria con penalizadores propios; mismo punto de extensión (`extraAttack`, o una lista de contribuciones si se necesita más de una entrada).
3. ***Haste* con ataque extra real:** hoy `srd_haste` es una demo simplificada (`+1 ataque, +10 ft velocidad`, ver `data/abilities.json` línea 49) que **no** otorga el ataque adicional real de la regla SRD. `flatAttackBonusToRoutine`/una extensión análoga es el lugar natural para implementarlo correctamente sin tocar `attackCommands.ts`, cuando se aborde como sprint propio.

### Matriz de Impacto de Subsistemas
- [x] **Rule Engine:** nueva función pura `getEffectiveAttackRoutine`; nuevo tipo `IterativeAttack`; nuevo campo opcional `FeatDefinition.attackRoutineRules` (sin poblar) + selector `FeatCatalog.attackRoutineContribution`.
- [ ] **CombatRoom / State Schema:** sin cambios. `currentTurn.attacksMade`/`attackMode` ya existen y no se tocan.
- [ ] **WebSocket Contract:** sin cambios. `resolve-attack` conserva su payload y su handler intactos.
- [x] **UI Presentation:** `ActionsPanel.tsx` consume la nueva proyección para mostrar bonus absoluto en vez de solo el penalizador.
- [x] **Tests:** nuevo archivo (o extensión de `tests/full-attack.test.mjs`) verificando `getEffectiveAttackRoutine` en los cuatro umbrales de BAB, y que **no** incluye modificadores dependientes de objetivo.

## 4. Qué NO resuelve este sprint
- **No implementa Disparo Rápido, Ataque con Dos Armas, ni el ataque extra real de *Haste*.** Solo deja el punto de extensión declarativo (`attackRoutineRules`) sin consumidores — implementarlas es trabajo de un sprint futuro con su propio NDD.
- **No cambia la validación transaccional existente** de `handleResolveAttackDraft`, porque ya es correcta y ya tiene cobertura implícita en la suite de combate actual.
- **No fusiona Presa/Apretujarse/flanqueo dentro de la rutina** — siguen viviendo en `evaluateConditionalModifiers`/`getAttackContextModifiers`, evaluados por intento de ataque contra un objetivo concreto, no por turno.
- **No agrega botones individuales por ataque iterativo en la UI** (la instrucción original lo sugiere). El flujo secuencial de un solo botón ("Resolver ataque X/Y") ya refleja correctamente el estado autoritativo del servidor (`hasRemainingAttacks`) y agregar botones independientes sería puramente cosmético, no una corrección funcional; se deja fuera para no inflar el scope del sprint.

## Riesgos y Mitigaciones
- **Riesgo de duplicar la matemática de ataque:** mitigado por diseño — `getEffectiveAttackRoutine` no calcula nada que `Rules.totalAttackBonus`/`getAttackRoutine` no calculen ya; solo los compone.
- **Riesgo de que la UI muestre un bonus "efectivo" que luego no coincida con el resultado real de `resolve-attack`** (porque el real sí incluye flanqueo/Presa/Apretujarse/Defensiva): se documenta explícitamente en la UI como bonus base de la rutina (sin contexto de objetivo), igual que hoy `Rules.totalAttackBonus` en `SelectedInfo` ya se muestra sin pretender ser el bonus final contra un enemigo específico.
- **Riesgo de acoplar `attackRoutineRules` a una forma equivocada antes de tener una dote real que lo use:** mitigado dejándolo sin consumidores y con dos formas mínimas (`extraAttack`, `flatAttackBonusToRoutine`) inspiradas directamente en los tres ejemplos reales de la Regla de Tres, no en una especulación abierta.

## Validación Planeada
- Extender `tests/full-attack.test.mjs` (o nuevo `tests/iterative-attacks-effective-routine.test.mjs`): `getEffectiveAttackRoutine` en BAB 4/6/11/16 produce el mismo largo/forma que `getAttackRoutine` más el bonus absoluto esperado; verificar que un combatiente con un modificador de característica o tamaño distinto de cero se refleja en `effectiveAttackBonus` de las cuatro entradas por igual (mismo desplazamiento, penalizador relativo intacto).
- `npm test`, `npm run typecheck`, `npm run build` (con la limitación de entorno ya documentada en Sprints 034/035 si persiste en el sandbox de implementación).
