# Walkthrough — Sprint D-1B-I3R1 (Route Validation Dependency Remediation)

## Objetivo

Corregir dos hallazgos detectados en la revisión arquitectónica del commit
`3696f08` (Sprint D-1B-I3, integración de Route Validation como SSOT de
movimiento): una dependencia circular real entre `rules.ts` y
`routeValidation.ts`, y una superficie pública del paquete inflada por
exports internos que nunca tuvieron un consumidor real. No se rediseñó
arquitectura, no se cambiaron reglas, no se amplió alcance.

## Hallazgo 1 — Dependencia circular (resuelto)

`rules.ts` importaba `validateRouteLegality` desde `routeValidation.ts`, que
a su vez importaba desde `rules.ts` siete helpers geométricos/de ocupación
y de estado vital. Se extrajo ese cierre transitivo completo (no solo los
siete nombrados explícitamente, sino sus dependencias privadas reales) a
dos módulos inferiores nuevos, sin cambiar ninguna línea de lógica:

- **`packages/shared/src/movementGeometry.ts`**: `isPositionInsideBoard`,
  `isImpassable`, `getNaturalCombatantOccupiedCellsAt`,
  `projectMovementFootprint`, `getCombatantOccupiedCellsAt`,
  `getCombatantOccupiedCells`, `footprintCellKey`,
  `createFootprintOccupancyIndex`, `getCombatantsIntersectingCells`,
  `isCornerAnchorBlockedByTerrain`, `projectFootprintGeometry`, y los tipos
  `SpatialMode`/`SqueezingAxis`/`FootprintGeometry`/
  `MovementFootprintProjection`, más los privados `isNarrowCell`/
  `isSqueezingCombatant`/`getSqueezedFootprintAt` que estas funciones
  necesitaban para no duplicar lógica.
- **`packages/shared/src/lifeStatus.ts`**: `LifeStateProjection`,
  `getLifeStateProjection`, `lifeStatus`.

`rules.ts` y `routeValidation.ts` ahora importan ambos desde estos dos
módulos; ninguno de los dos módulos nuevos importa desde `rules.ts` ni
desde `routeValidation.ts`. Dirección final verificada con `madge
--circular`: el ciclo `rules.ts ↔ routeValidation.ts` ya no existe (los 4
ciclos preexistentes que `madge` reporta pertenecen a `types.ts`/
`effects/*`, no tocados por este sprint y fuera de su alcance).

`rules.ts` conserva `getCombatantFootprintGeometry`/
`distanceBetweenFootprintGeometriesFeet` (usadas por AdO/Threat, ajenas a
Route Validation), importando `projectFootprintGeometry` desde el nuevo
módulo en vez de duplicarla.

## Hallazgo 2 — API pública inflada (resuelto)

Antes de este sprint, los siete helpers ya eran públicos de facto (`export
* from "./rules.js"` en `index.ts`) sin que ningún consumidor externo real
los usara. Verificado por grep exhaustivo contra `apps/server`, `apps/web`
y `tests/`: `getCombatantOccupiedCells`, `footprintCellKey`,
`getLifeStateProjection`, `lifeStatus` y los tipos `SpatialMode`/
`SqueezingAxis` sí tienen consumidores reales (`tickLayer.ts`,
`spatialTransition.ts`, `tests/special-movement-roller.test.mjs`,
`Board.tsx`, `tacticalCommands.ts`, entre otros) y se re-exportan por
nombre desde `rules.ts` para no romper ningún import existente.
`isImpassable`, `isPositionInsideBoard`, `getNaturalCombatantOccupiedCellsAt`,
`isCornerAnchorBlockedByTerrain`, `createFootprintOccupancyIndex`,
`getCombatantsIntersectingCells` y `projectMovementFootprint` no tenían
ningún consumidor externo real: se importan (no se re-exportan) en
`rules.ts`, por lo que dejan de ser parte de la superficie pública del
paquete sin que ningún archivo existente deba modificarse. `index.ts` no
requirió ningún cambio.

## Hallazgo 3 — Cobertura directa (resuelto)

`tests/route-validation.test.mjs` pasó de 10 a 20 casos. Se agregaron:

- **Footprints grandes**: ruta legal Large 2×2; colisión de una sola celda
  de la huella con un obstáculo; rechazo al terminar sobre una huella
  completa aunque el enemigo solo ocupe una de sus cuatro celdas.
- **Squeezing**: proyección con `spatialMode: "squeezing"` y
  `squeezingAxis` conservado; rechazo cuando ni la proyección natural ni la
  estrecha son válidas.
- **Repetición de casilla**: ruta que revisita una celda ya visitada,
  verificando `failedStepIndex` exacto.
- **Bridge legacy**: cuatro casos de equivalencia observable entre
  `validateRouteLegality` y `validateMovePath` (ruta legal, bloqueada por
  obstáculo, ocupación por enemigo consciente, footprint Large efectivo).

## Hallazgo 4 — `isAcrobatic` (documentado, sin rediseño)

Se agregó un comentario técnico en `validateRouteLegality` aclarando que
`isAcrobatic` es una capacidad de tránsito del actor consumida como
booleano opaco por Route Validation, no la lógica de una acción concreta
(Acrobacias/Tumble). No se creó ninguna política genérica nueva ni ODR;
el comportamiento observable no cambió.

## Validación

```
npm test                       -> 590/590
npm run typecheck               -> shared + web + server, sin errores
npm run build                   -> shared + web + server, sin errores
node scripts/e2e-websocket.mjs  -> 100/100 aserciones
npx playwright test              -> 7/7
git diff --check                 -> limpio
madge --circular                 -> sin rules.ts <-> routeValidation.ts
```

## Cierre

Sin cambio de comportamiento observable en ningún flujo existente. Sin
Rule ID afectada (refactor de infraestructura interna, no de reglas SRD) —
`docs/rules/registry.md` no requirió actualización, verificado por grep
(no referencia la estructura interna de `routeValidation.ts`).

READY FOR ARCHITECTURE REVIEW
