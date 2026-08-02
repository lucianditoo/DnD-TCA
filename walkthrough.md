# Walkthrough — Sprint D-1B-I5 (Authoritative Movement Commit)

## Objetivo

Implementar el Commit Autoritativo del pipeline de movimiento:

```
Command → Movement Resolution → Authoritative Commit → Publication
```

Estrategia: **CERO MIGRACIÓN PRODUCTIVA**. `packages/shared/src/movementCommit.ts`
expone `commitMovementResolution`, aislado del flujo legacy. No se migró
`handleMoveCombatant`, `handleWithdraw`, `handleRun`, `handleCharge`,
`validateMovePath`, `calculatePathStepCostsFeet` ni `commitSpatialTransition`
— ninguno de esos archivos fue tocado.

## Consumo exclusivo de I4

`commitMovementResolution` recibe únicamente un `MovementResolutionResult`
de kind `"ready"` (producido, sin excepción, por `resolveMovementPipeline`
de I4) y no recalcula nada: ni Route Validation, ni Movement Cost, ni
footprints, ni terreno difícil, ni el contador diagonal, ni `squeezingAxis`.
Toda esa evidencia se lee de `resolution.steps`/`resolution.totalCostFeet`/
`resolution.projectedContext` tal como llega. `resolveMovementPipeline` en
sí mismo no fue modificado.

## Precondición autoritativa (evita commits obsoletos)

Antes de mutar cualquier cosa, `commitMovementResolution` verifica que el
estado autoritativo de `room`/`combatant` siga coincidiendo con las
condiciones bajo las que se calculó la Resolution:

- `combatant.position` sigue siendo la misma que `preconditions.expectedOrigin`;
- `room.currentTurn.movementUsedFeet` sigue siendo el mismo que
  `preconditions.expectedMovementUsedFeet`;
- `room.currentTurn.normalDiagonalStepsThisTurn` sigue siendo el mismo que
  `preconditions.expectedDiagonalContext.normalDiagonalStepsThisTurn`.

Si cualquiera falla, el Commit se rechaza (`kind: "rejected"`, con
`rejectionCode` de `"stale-origin"` / `"stale-movement-used"` /
`"stale-diagonal-context"`) **sin mutar nada y sin publicar nada** — no
existe ningún canal de publicación en este módulo. No se implementó
versionado global ni concurrencia optimista genérica: solo los tres valores
mínimos que el propio sprint identificó como necesarios para detectar una
Resolution calculada sobre estado ya superado.

## Atomicidad

Las tres verificaciones de precondición ocurren antes de cualquier
mutación; si las tres se sostienen, todas las mutaciones (posición,
`movementUsedFeet`, `distanceMovedFeet`, `normalDiagonalStepsThisTurn`,
`EffectInstance` de Squeezing) se aplican juntas, en el mismo tramo
síncrono, sin punto de retorno intermedio.

## Estado mutado

- `combatant.position` ← posición del último `MovementResolutionStep`.
- `combatant.stats.distanceMovedFeet` ← `+= resolution.totalCostFeet`.
- `room.currentTurn.movementUsedFeet` ← `+= resolution.totalCostFeet`.
- `room.currentTurn.normalDiagonalStepsThisTurn` ← el valor exacto de
  `resolution.projectedContext.normalDiagonalStepsThisTurn` (asignación
  directa, nunca un recálculo — `resultingDiagonalCount` en el resultado
  del Commit es ese mismo valor ya aplicado).
- Presencia/ausencia de la `EffectInstance` `srd_squeezing`, según el
  `spatialMode` final del último Step (igual criterio que
  `apps/server/src/combat/spatialTransition.ts::commitSpatialTransition`,
  reimplementado de forma autocontenida dentro de `movementCommit.ts` —
  `packages/shared` no puede importar desde `apps/server`; es una
  duplicación temporal y documentada, esperable mientras no exista la
  migración productiva).

## ODR-D1B-I5-1 — Sede de `squeezingAxis` (permanece ABIERTA)

`commitMovementResolution` consume `squeezingAxis` directamente del último
`MovementResolutionStep` y lo expone en el resultado del Commit
(`result.squeezingAxis`), sin recalcularlo. **No se decidió** agregarlo a
`EffectInstance` ni a `CombatantSnapshot` — el modelo actual no tiene una
sede persistente para ese dato más allá del propio turno en que se calculó
el Commit; solo la presencia/ausencia de Squeezing (el `spatialMode`) tiene
hoy una sede clara (la `EffectInstance` `srd_squeezing`). Esta limitación
queda registrada explícitamente aquí, sin cerrar la ODR mediante una
decisión implícita de implementación.

## Tests

`tests/movement-commit.test.mjs` (17 casos): Commit exitoso; actualización
de posición/`movementUsedFeet`/`distanceMovedFeet`; persistencia de
`resultingDiagonalCount` recibido (no recalculado); consumo de
`spatialMode` final y de `squeezingAxis` sin recalcularlo; ruta con
múltiples Steps; Double Move/movimiento segmentado (dos Resolutions +
Commits secuenciales en el mismo turno conservan la paridad diagonal
acumulada — 5 ft, luego 10 ft); rechazo por posición inicial obsoleta,
por `movementUsedFeet` obsoleto y por contexto diagonal obsoleto; cero
mutación y cero publicación cuando falla una precondición; el Commit no
vuelve a ejecutar Route Validation ni Movement Cost (dos casos con una
Resolution fabricada a mano que contradice deliberadamente el tablero
actual o el coste real, para demostrar que el Commit confía ciegamente en
la evidencia recibida); y un caso de `deepFreeze` sobre `resolution`/
`preconditions` confirmando que ninguno de los dos se muta.

`packages/shared/src/index.ts` gana una única línea (`export * from
"./movementCommit.js"`).

## Validación

```
npm test                       -> 620/620
npm run typecheck               -> shared + web + server, sin errores
npm run build                   -> shared + web + server, sin errores
node scripts/e2e-websocket.mjs  -> 100/100 aserciones
npx playwright test              -> 7/7
git diff --check                 -> limpio
madge --circular                 -> mismos 4 ciclos preexistentes de
                                     types.ts/effects/*, ninguno nuevo
```

## Cierre

Legacy productivo intacto (`validateMovePath`, `calculatePathStepCostsFeet`,
`commitSpatialTransition`, `movementCommands.ts`, `tacticalCommands.ts` sin
modificar). `resolveMovementPipeline` (I4) sin modificar. Publication no
implementada (pertenece a una fase posterior). Sin Rule ID afectada —
`docs/rules/registry.md` no requirió actualización. ODR-D1B-I5-1 queda
explícitamente abierta.

READY FOR ARCHITECTURE REVIEW
