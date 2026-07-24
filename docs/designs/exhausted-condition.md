# Sprint 049 — Exhausted: condición oficial y corrección de `onStack`

**Estado:** implementado y validado (457→467 tests, typecheck/build verdes)

**Rule ID:** `EFFECT-EXHAUSTED`

**Pipeline rector:** [Arquitectura del pipeline de modificadores](modifier-pipeline-architecture.md), precedente directo: [entangled-condition.md](entangled-condition.md)

## 1. Objetivo

Implementar **Exhausted** (SRD 3.5) reutilizando el mismo patrón declarativo que
Fatigued/Entangled/Blinded, y — condición explícita del usuario antes de aprobar
la implementación — cerrar de una vez el gap real descubierto durante la auditoría
normativa: `EffectDefinition.onStack` estaba declarado desde el diseño original de
ActiveEffects (Sprint 003) pero **ningún consumidor lo leía nunca**. Ver DT-022 en
`docs/technical-debt.md` para el hallazgo completo con evidencia de código.

Quedan fuera de este sprint: Frightened, Panicked, Vision, Line of Effect,
Concentration, y — explícitamente — la recuperación de Exhausted→Fatigued tras 1
hora de descanso (transición dependiente del paso del tiempo, no de aplicación de
efectos).

## 2. Auditoría normativa (SRD 3.5)

No se pudo acceder a d20srd.org/dandwiki.com directamente (403/402 al hacer fetch);
la investigación se trianguló con múltiples fuentes secundarias independientes
convergentes en el mismo texto.

### 2.1 La condición

- **Fatigued**: -2 Fuerza/-2 Destreza, no puede correr ni cargar. *"Hacer cualquier
  cosa que normalmente causaría fatiga hace que el personaje fatigado quede
  Exhausted en su lugar."* Esta cláusula vive en la definición de la condición
  misma, no en cada fuente. Tras 8h de descanso completo, deja de estar Fatigued.
- **Exhausted**: -6 Fuerza/-6 Destreza, mitad de velocidad, no puede correr ni
  cargar. Tras 1h de descanso completo, pasa a Fatigued (fuera de alcance, ver §1).

### 2.2 Fuentes oficiales auditadas y su comportamiento exacto

| Fuente | Aplica | Ya Fatigued | Ya Exhausted |
|---|---|---|---|
| Regla general de la condición | Fatigued | — | — |
| **Ray of Exhaustion** (hechizo) | Exhausted directo; salvación exitosa → Fatigued | Se vuelve Exhausted | Sin efecto (declarado explícitamente en el propio hechizo) |
| Marcha Forzada (>8h/día) | Fatigued, atado a **daño no letal** acumulado (1d6 por chequeo fallido) | No escala a Exhausted por sí sola | N/A |
| Inanición / Sed | Fatigued, atado a daño no letal | Igual patrón | N/A |
| Calor/Frío extremos | Daño no letal — sin cláusula explícita de Fatigued encontrada en las fuentes consultadas | — | — |

Ninguna de estas fuentes está implementada en este motor hoy (no hay spells de
Exhausted/Ray of Exhaustion en `abilities.json`, no hay reglas de marcha
forzada/inanición/sed/temperatura). La única fuente real y ya existente que aplica
Fatigued es `srd_poison_gas_hazard` (`onFailEffectId: "srd_fatigued"`).

### 2.3 Conclusión: ¿la transición depende de la condición o de la fuente?

**De la condición.** La cláusula de escalado vive en la definición de Fatigued,
no en cada fuente individual — Ray of Exhaustion simplemente la reafirma en su
propio texto por ser la fuente más citada. Esto respalda normativamente que
`onStack`/`upgradeTo` vivan en `EffectDefinition` (como ya estaban declarados) y que
el consumo sea genérico en `EffectManager`, nunca repetido en cada fuente/handler.

## 3. El hallazgo de código que amplió el alcance (DT-022)

`EffectManager.add` (`packages/shared/src/effects/manager.ts`) era puramente
aditivo: nunca comparaba la nueva instancia contra instancias ya existentes del
mismo `effectId`+objetivo. `EffectReducer` tampoco consumía `onStack` — solo
resuelve `stackingGroup`/`stackingPolicy`, un mecanismo distinto (a nivel de
modificador numérico, no de instancia de efecto).

`tests/conditions-v3.test.mjs` ya documentaba el síntoma para `srd_prone`: dos
instancias manuales sumaban el penalizador de CA dos veces (14-4-4=6), con un
comentario que afirmaba (incorrectamente) que `onStack:"ignore"` bloqueaba esto
"en el EffectManager". Nunca lo hizo.

Peor: `srd_poison_gas_hazard` reaplica `srd_fatigued` cada ronda que el objetivo
falla su salvación mientras permanece en la nube (`environmentalHazardResolver.ts`).
Sin consumo de `onStack`, tres fallos consecutivos producían -6 STR/-6 DEX (tres
instancias de -2/-2 sumadas), no la transición a Exhausted que exige el RAW.

Por instrucción explícita del usuario, este sprint corrige `onStack` de forma
**genérica** (beneficia a Prone, Dazed, Paralyzed, y cualquier condición futura),
no solo para Exhausted, documentado como corrección de infraestructura existente
(DT-022), no como funcionalidad nueva.

## 4. Auditoría de valores de `onStack` necesarios

Se auditó si el dominio requiere `"replace"` o `"refresh_duration"` además de
`"ignore"`/`"upgrade_to"`:

- Los 14 entries del catálogo (antes de este sprint) usaban exclusivamente
  `"ignore"`. Ninguno declaraba `"replace"` ni `"accumulate"`.
- Los únicos efectos con `duration` real (`rounds`, `until_turn`, etc.) son
  asignados por comandos puntuales (`initiativeCommands.ts`,
  `tacticalCommands.ts`, `specialManeuverCommands.ts`, `abilityResolver.ts`,
  `spatialTransition.ts`); ninguno modela "recast mientras sigue activo" — no hay
  caso normativo ni de diseño que pida refrescar una duración al reaplicar.
- La investigación SRD de Fatigued/Exhausted tampoco requiere `"replace"`: Ray of
  Exhaustion usa exactamente `"upgrade_to"` (fatigado→exhausto) e `"ignore"`
  (exhausto→exhausto), nunca un reemplazo de duración.

**Conclusión**: sin casos normativos reales, `EffectDefinition.onStack` se angostó
de 4 a 2 valores: `"ignore" | "upgrade_to"` (`contracts.ts`). `"replace"` y
`"accumulate"` se retiran del tipo en vez de dejarse como opciones muertas.

## 5. Diseño de `EffectManager.add`

Único punto de consumo de `onStack` — cero lógica en fuentes, handlers o hazards.

```
severityChain(effectId):
  cadena = [effectId]
  mientras la definición actual tenga onStack:"upgrade_to" con upgradeTo válido
  y no visitado: agregar upgradeTo a la cadena, continuar desde ahí.
  → para srd_fatigued: [srd_fatigued, srd_exhausted]
  → para srd_exhausted: [srd_exhausted]
```

Al agregar una instancia nueva (con `targets`, nunca `targetCells` — ver §6):

1. Buscar instancias existentes sobre el mismo objetivo que sean del mismo
   `effectId`, o que pertenezcan a la misma cadena de severidad (en cualquier
   dirección: más severas o más débiles).
2. Si ya existe una **estrictamente más severa** (ej. ya Exhausted mientras algo
   vuelve a aplicar Fatigued — el caso real de la ronda 3+ de gas venenoso): la
   nueva aplicación es redundante, se descarta sin mirar su propio `onStack`.
3. Si lo existente es exactamente el mismo `effectId`: se aplica **su propio**
   `onStack` — `"ignore"` la descarta, `"upgrade_to"` remueve la vieja y agrega una
   instancia del `upgradeTo`.
4. Si lo existente es **estrictamente más débil** (ej. Exhausted aplicado directo
   sobre un objetivo que solo estaba Fatigued): la nueva instancia, más severa, la
   reemplaza — Fatigued y Exhausted nunca coexisten sobre el mismo objetivo.

## 6. Por qué `targetCells` queda fuera de la detección de colisión

`tests/environmental-hazards.test.mjs` ("múltiples hazards solapados sobre la
misma celda") ya prueba y exige que varias instancias de un mismo hazard
(`srd_wall_of_fire_hazard`) coexistan intencionalmente sobre la misma celda —
representan lanzamientos distintos, no una reaplicación del mismo efecto sobre el
mismo objetivo. La detección de colisión de `onStack` compara únicamente
`targets` (efectos anclados a criaturas); los hazards (anclados a `targetCells`)
nunca colisionan aquí, preservando ese comportamiento ya probado sin condicionales
por tipo de efecto.

## 7. Catálogo

```ts
"srd_fatigued": {
  // ...sin cambios en modifiers/ruleOverrides...
  onStack: "upgrade_to",
  upgradeTo: "srd_exhausted"
},
"srd_exhausted": {
  name: "Exhausto",
  traits: ["EXHAUSTED"],
  modifiers: [ STRENGTH -6, DEXTERITY -6 ], // mismo stackingGroup:"penalty"/"sum" que Fatigued, por precedente
  movementRateContributions: [ ×1/2, stackingKey "condition:exhausted:half-speed" ],
  ruleOverrides: ["FORBID_RUN", "FORBID_CHARGE"],
  onStack: "ignore"
}
```

No se tocó `srd_fatigued.modifiers` — el fix de instancia-duplicada en
`EffectManager` ya vuelve irrelevante el riesgo de doble-instancia para ese
`effectId` específico; ampliar su `stackingGroup` a uno dedicado (al estilo
Entangled) es una mejora ortogonal no pedida por este sprint.

## 8. Límite de alcance conocido, documentado (no silencioso)

La cadena de severidad se calcula **hacia adelante** desde el `effectId` que se
está agregando. Esto cubre completamente los dos escenarios reales de este
sprint (reaplicar Fatigued, y la ronda 3+ de gas venenoso contra un objetivo ya
Exhausted) y el caso simétrico (aplicar Exhausted directo sobre un Fatigued). No
existe hoy ninguna fuente que dispare este último caso salvo un GM eligiendo
manualmente `srd_exhausted` vía `gm-apply-effect` — cubierto igualmente por el
mismo algoritmo (§5, punto 4), sin necesidad de lógica adicional.

## 9. Tests

- `tests/active-effects.test.mjs`: 7 casos nuevos sobre `EffectManager.add` —
  ignore descarta duplicado, ignore no cruza objetivos, upgrade_to escala
  Fatigued→Exhausted, una tercera fatiga contra un objetivo ya Exhausted no lo
  revierte, ignore en Exhausted descarta duplicado directo, aplicar Exhausted
  directo sobre un Fatigued reemplaza la instancia débil.
- `tests/exhausted-condition.test.mjs`: consecuencias mecánicas de estar Exhausted
  (STR/DEX -6, velocidad ×1/2, FORBID_RUN/FORBID_CHARGE, snapshot), mismo patrón
  que `entangled-condition.test.mjs`.
- `tests/conditions-v3.test.mjs`: comentario corregido (ya no afirma que el bug de
  Prone duplicado sigue abierto).

## 10. Definition of Done

- `EFFECT-EXHAUSTED` en Registry (`Completo`), `EFFECT-FATIGUED` referencia la
  transición.
- DT-022 documentado como resuelto.
- `onStack` angostado a 2 valores, consumido únicamente en `EffectManager.add`.
- Suite completa, typecheck, build, E2E WebSocket y Playwright en verde.
- Sin `if (effectId === ...)` en ningún resolver/handler.
- Recuperación por descanso (Exhausted→Fatigued, 1h) permanece explícitamente
  fuera de alcance.
