# Implementation Plan — Sprint 025-R Prone Eschewal & Diehard

## Estado

✅ Implementación y DoD completados tras la aprobación formal `Proceed`.

## Fase 1 — Catálogo y capacidades

1. Ampliar `packages/shared/src/featCatalog.ts` con contribuciones vitales y de acciones tácticas tipadas.
2. Registrar `srd_diehard` y `srd_prone_eschewal` como definiciones inmutables.
3. Añadir selectores agregados sin exponer condicionales por ID a consumidores.
4. Confirmar aceptación estricta desde perfiles V3 y snapshots sin persistir derivados.

## Fase 2 — Proyección vital y transición de HP

1. Implementar `getLifeStateProjection` y hacer que `lifeStatus` delegue en ella.
2. Implementar `normalizeLifeStateAfterHpChange` con precedencia inequívoca de muerte a −10.
3. Migrar `applyDamage`, `applyHealing`, estabilización y comandos GM a la frontera común.
4. Auditar todas las escrituras de `hpCurrent`/`isStable` y eliminar rutas sin normalización.
5. Migrar `canTakeTurn`, economía Disabled, turn manager y consumidores de consciencia al estado efectivo.

## Fase 3 — Sangrado y esfuerzo

1. Cambiar `roundTickListener` para consultar `bleedsAtRoundStart` sin conocer dotes concretas.
2. Tipar el contexto de `applyDisabledExertion` por clase de acción y carácter extenuante.
3. Migrar handlers estándar para aplicar esfuerzo después de la acción.
4. Garantizar que acciones de movimiento no apliquen daño de esfuerzo.
5. Verificar transición −9→−10 y logs/resultado de combate.

## Fase 4 — Stand Up declarativo

1. Crear `getStandUpActionProfile` en shared.
2. Hacer que `calculateStandUpCostFeet` y `validateStandUp` deleguen en el perfil.
3. Refactorizar `handleStandUp` para consumir coste, consumo de acción y provocación derivados.
4. Mantener el comando WebSocket sin overrides de coste o seguridad.

## Fase 5 — UI

1. Calcular el perfil desde el snapshot local en `ActionsPanel`/view model.
2. Mostrar coste real y advertencia normal para combatientes sin dote.
3. Mostrar `0 pies` y `SEGURO (Sin AdO)` en verde para Prone Eschewal.
4. Reutilizar la validación shared para habilitar/deshabilitar la acción.

## Fase 6 — Pruebas

1. Crear suite unitaria de Diehard, normalización vital, sangrado y economía de acciones.
2. Extender pruebas de Stand Up con coste cero, ausencia de AdO y consumo de move action.
3. Añadir regresiones para no-Diehard y Stand Up normal.
4. Extender persistencia/catálogo para ambos IDs.
5. Añadir E2E autoritativo y escenario Playwright del indicador seguro.

## Fase 7 — Validación y cierre

1. Ejecutar secuencialmente `npm test`, `npm run typecheck`, `npm run build` y E2E WebSocket.
2. Ejecutar `npm run test:ui`.
3. Actualizar arquitectura, cobertura, memoria, `PROJECT_STATUS.md`, `TODO.md` y `walkthrough.md` con resultados reales.
4. Registrar deuda solo si queda una limitación concreta no resuelta.

## Orden y rollback

- Catálogo y proyección vital preceden a Tick Layer y handlers.
- La frontera de HP debe estar completa antes de habilitar Diehard en datos productivos.
- El perfil shared de Stand Up debe existir antes de cambiar UI.
- Cada fase conserva el comportamiento de combatientes sin las nuevas dotes.
- Ante una ruta de HP no migrable, Diehard no se habilita parcialmente.

## Resultado

Las siete fases quedaron completadas. Validación final: 290/290 tests, typecheck/build, 87/87 E2E WebSocket y 3/3 Playwright. No se registró deuda nueva.
