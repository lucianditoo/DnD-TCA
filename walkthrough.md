# Walkthrough — Sprint D-1B-I1 Movement Context

## Objetivo

Introducir exclusivamente el contexto autoritativo de movimiento perteneciente al turno, sin activar todavía cálculo de costes, validación de rutas, presupuesto, resolución, acciones, previews, comandos ni UI.

## Implementación

- `MovementContext` define el único estado nuevo: `normalDiagonalStepsThisTurn`.
- `TurnState` incorpora ese contrato de forma plana, por lo que el contador pertenece al turno y no a una Route, acción o preview.
- Las fábricas de sala y turno inicializan el contador en `0`.
- `advanceTurn` lo reinicia en la frontera que comienza el siguiente turno, antes de publicar `TurnStarted`.
- `createCombatRulesSnapshot` conserva el valor mediante su copia inmutable existente; no se agregó cálculo ni consumidor.
- La frontera legacy completa con `0` las salas anteriores que todavía no posean el campo.

## Tests estructurales

`tests/movement-context.test.mjs` cubre cuatro invariantes:

1. creación del contexto en las dos fábricas autoritativas;
2. valor inicial `0`;
3. persistencia exacta a través del snapshot sin mutación o reinicio;
4. reinicio al comenzar un turno nuevo y compatibilidad de una sala legacy.

No se agregaron pruebas ni comportamiento de coste diagonal, terreno difícil, Run, Charge, Double Move, Five-Foot Step, Forced Movement o Movement Resolution.

## Archivos modificados

- `packages/shared/src/types.ts`
- `packages/shared/src/demo-data.ts`
- `apps/server/src/combat/turnManager.ts`
- `apps/server/src/room/roomState.ts`
- `tests/test-utils.mjs`
- `tests/movement-context.test.mjs`
- `PROJECT_STATUS.md`
- `TODO.md`
- `walkthrough.md`

## Validación

- Tests focalizados: 4/4.
- Suite global: 563/563.
- Typecheck: verde.
- Build: verde.
- WebSocket E2E: 100/100.
- No corresponde Playwright local: no hubo cambios de UI; el gate Windows CI ejecutará igualmente la suite canónica completa.
- `git diff --check`: verde.

## Alcance y deuda

No se modificaron el NDD congelado, el Research ni el Rule Registry. No se creó una Rule ID, no se abrió una ODR y no se introdujo deuda técnica nueva. El contador es deliberadamente inerte hasta los futuros sprints propietarios de Movement Cost y Resolution.

READY FOR ARCHITECTURE REVIEW
