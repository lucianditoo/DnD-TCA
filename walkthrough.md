# Walkthrough — Sprint D-1B-I2 Movement Cost

## Objetivo

Introducir exclusivamente el assessment normativo y puro del coste de una Route ya legal, sin conectarlo todavía con Route Validation, Movement Budget, Resolution, Commit, acciones, comandos, networking ni UI.

## Implementación

- `MovementCostStep` representa un Step ordenado mediante origen, destino y el hecho efímero `isDifficultTerrain`.
- `MovementCostRoute` conserva origen, secuencia ordenada de Steps y destino sin validar continuidad ni adyacencia.
- `assessMovementCost` recibe la Route y una copia del `MovementContext` inicial.
- Los Steps ortogonales normales cuestan 5 ft.
- Las diagonales normales siguen 5/10/5/10 desde `normalDiagonalStepsThisTurn`, incluyendo diagonales que cambian tres ejes como una sola unidad ordinal.
- Los Steps ortogonales difíciles cuestan 10 ft y las diagonales difíciles 15 ft constantes; ninguno de estos últimos modifica el contador diagonal normal.
- El resultado contiene `totalCostFeet` y un `resultingContext` nuevo. El assessment no muta sus entradas ni ningún estado autoritativo.
- La exportación compartida queda disponible para consumidores futuros, pero el calculador legacy y la resolución productiva permanecen intactos.

## Tests

`tests/movement-cost.test.mjs` agrega siete casos focalizados:

1. uno y varios Steps ortogonales normales;
2. secuencia diagonal 5/10/5/10;
3. continuidad de paridad desde contadores iniciales 0, 1, 2 y 3;
4. diagonal XYZ tratada como un único Step diagonal;
5. costes 10/15 de terreno difícil sin alterar el contador;
6. Route mixta donde solo las diagonales normales alteran la paridad;
7. pureza mediante Route y contexto congelados, con contexto resultante independiente.

## Archivos modificados

- `packages/shared/src/movementCost.ts`
- `packages/shared/src/index.ts`
- `tests/movement-cost.test.mjs`
- `PROJECT_STATUS.md`
- `TODO.md`
- `walkthrough.md`

## Validación

- Tests focalizados: 7/7.
- Suite global: 570/570.
- Typecheck: verde.
- Build: verde.
- WebSocket E2E: 100/100.
- Playwright: 7/7.
- `git diff --check`: verde.

## Alcance y deuda

No se modificaron el NDD congelado, el Research, el Rule Registry ni la resolución de movimiento existente. No se creó una Rule ID ni se abrió una ODR. D-1B-C3-01 permanece fuera de alcance: este sprint solo compone Movimiento Diagonal con terreno difícil, interacción ya resuelta normativamente.

READY FOR ARCHITECTURE REVIEW
