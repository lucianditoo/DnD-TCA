# Walkthrough — Sprint D-1B-I5R1: Movement Resolution / Commit Remediation

Responsabilidad: Registrar la remediación ejecutada de D-1B-I5 y su validación técnica completa.
Autoridad: Registro
Lifecycle: Rotativo
Reemplaza: Walkthrough de saneamiento documental posterior a D-1B-I5.
Complementa: [PROJECT_STATUS.md](PROJECT_STATUS.md), [TODO.md](TODO.md), [docs/designs/normative-movement-design.md](docs/designs/normative-movement-design.md)
Consumidores: Architecture Gate, siguiente agente y revisión técnica.

## 1. Alcance y Objetivos

Sprint D-1B-I5R1 remedia exclusivamente los hallazgos identificados en la Architecture Review de D-1B-I5:
- **Major 1 — Stale Resolution y Vigencia:** Fortalecer el contrato Resolution → Commit para impedir que una resolución calculada sobre un estado anterior pueda commitearse tras cambios de turno, actor, ronda, posición, presupuesto, contexto diagonal o estado espacial del combate.
- **Major 2 — Coste Normativo de Squeezing:** Implementar en `assessMovementCost` el coste doble para Squeezing (ortogonal y diagonal con paridad 5/10), y devolver resultado tipado `{ kind: "unsupported-cost-combination" }` cuando confluyan Squeezing y Terreno Difícil (ODR D-1B-C3-01 abierta).
- **Minor — Distinción Coste vs Distancia:** Separar formalmente el presupuesto consumido (`totalCostFeet` acumulado a `room.currentTurn.movementUsedFeet`) del recorrido espacial físico (`totalBaseRouteCostFeet` acumulado a `combatant.stats.distanceMovedFeet`).

### Fronteras y Restricciones Respetadas
- **Aislamiento productivo total:** Ningún comando productivo (`movementCommands.ts`, `tacticalCommands.ts`, `spatialTransition.ts`) fue modificado ni conectado al pipeline normativo. Sprint I6 permanece bloqueado.
- **NDD congelado:** Sin alteraciones en `docs/designs/normative-movement-design.md`.
- **ODRs abiertas:** ODR D-1B-C3-01 y ODR-D1B-I5-1 se mantienen abiertas y documentadas.
- **Archivos protegidos:** `.claude/` y `test.txt` no fueron leídos, modificados ni incluidos.

---

## 2. Cambios Técnicos Realizados

### `packages/shared/src/movementCost.ts`
- Agregado campo opcional `spatialMode?: SpatialMode` a `MovementCostStep`.
- Incorporados `stepBaseRouteCostFeet` y `cumulativeBaseRouteCostFeet` en `MovementCostAssessmentStep`.
- Agregado `totalBaseRouteCostFeet` al resultado de `MovementCostAssessment`.
- Incorporada unión discriminada `UnsupportedCostCombination` (`kind: "unsupported-cost-combination"`).
- Implementada tabla de costes de Squeezing:
  - Ortogonal bajo Squeezing: 10 ft (base 5 * 2).
  - Diagonal base 5 bajo Squeezing: 10 ft (consume paridad normal y avanza contador en 1).
  - Diagonal base 10 bajo Squeezing: 20 ft (consume paridad normal y avanza contador en 1).
- Detección de combinación Squeezing + Difficult Terrain devolviendo `UnsupportedCostCombination` sin arrojar excepciones.

### `packages/shared/src/movementResolution.ts`
- Creada función pura `createMovementStateFingerprint(context)`: genera una cadena serializada y canónicamente ordenada del estado que afecta Route Validation y Movement Cost (tablero: ancho, alto, tamaño de celda, celdas intransitables, terreno difícil y estrechas; combatientes: ID, posición 3D, tamaño, tipo y estado vital; instancias activas del efecto `srd_squeezing`). Sin dependencias de Node.js (100% portable para shared y web).
- Agregado `rulesStateFingerprint` a los resultados de `MovementResolutionResult` (`ready` e `insufficient-budget`).
- Propagación directa de `UnsupportedCostCombination` en `resolveMovementPipeline`.
- Agregado `stepBaseRouteCostFeet` y `cumulativeBaseRouteCostFeet` a `MovementResolutionStep`.
- Agregado `totalBaseRouteCostFeet` a `MovementResolutionReady` e `insufficient-budget`.

### `packages/shared/src/movementCommit.ts`
- Actualizado `MovementCommitPreconditions`:
  - `expectedTurnCombatantId: string`
  - `expectedRound?: number`
  - `expectedOrigin: Position`
  - `expectedMovementUsedFeet: number`
  - `expectedDiagonalContext: MovementContext`
- Ampliados códigos de rechazo: `"invalid-actor"`, `"stale-round"`, `"stale-rules-state"`.
- Implementadas precondiciones secuenciales y atómicas:
  1. Identidad de actor y correspondencia con el turno activo (`combatant.id === expectedTurnCombatantId === room.currentTurn.combatantId`).
  2. Ronda del combate (`expectedRound !== undefined && room.round !== expectedRound`).
  3. Origen espacial (`positionsMatch(combatant.position, expectedOrigin)`).
  4. Presupuesto consumido previo (`room.currentTurn.movementUsedFeet !== expectedMovementUsedFeet`).
  5. Contexto diagonal vinculado estrictamente a `resolution.initialContext.normalDiagonalStepsThisTurn`.
  6. Fingerprint del estado de reglas: `createMovementStateFingerprint(room) === resolution.rulesStateFingerprint`.
- Mutación atómica autoritativa:
  - `combatant.stats.distanceMovedFeet += resolution.totalBaseRouteCostFeet`
  - `room.currentTurn.movementUsedFeet += resolution.totalCostFeet`
  - `room.currentTurn.normalDiagonalStepsThisTurn = resolution.projectedContext.normalDiagonalStepsThisTurn`

---

## 3. Cobertura de Pruebas

### `tests/movement-cost.test.mjs`
- Squeezing ortogonal normal: base 5 / coste 10.
- Squeezing diagonal base 5: base 5 / coste 10.
- Squeezing diagonal base 10: base 10 / coste 20.
- Difficult Terrain ortogonal: base 5 / coste 10.
- Regresión A: diagonal normal (5) → diagonal difícil (15) → diagonal normal (10).
- Regresión B: diagonal squeezing (10, avanza contador) → diagonal normal (10).
- Combinación no soportada: Squeezing + Difficult Terrain produce resultado tipado `unsupported-cost-combination`.

### `tests/movement-resolution.test.mjs`
- Detección y propagación tipada de Squeezing + Difficult Terrain como `unsupported-cost-combination`.
- Squeezing puro sin DT produce resolución `ready` con coste duplicado.
- Preservación y reporte de `totalBaseRouteCostFeet` y `rulesStateFingerprint`.

### `tests/movement-commit.test.mjs`
- Rechazo por `stale-turn` al cambiar de turno a otro combatiente.
- Rechazo por `invalid-actor` al intentar commitear un combatiente ajeno al turno.
- Rechazo por `stale-round` al avanzar de ronda aunque vuelva al mismo actor.
- Rechazo por `stale-rules-state` si cambia el tablero (nuevos obstáculos/terrenos).
- Rechazo por `stale-rules-state` si otro combatiente se desplaza.
- Verificación de determinismo canónico de `createMovementStateFingerprint` frente a reordenamiento de arrays.
- Separación estricta entre `totalCostFeet` (`room.currentTurn.movementUsedFeet`) y `totalBaseRouteCostFeet` (`combatant.stats.distanceMovedFeet`).

---

## 4. Resultado de Validaciones

| Validación | Comando | Resultado |
|---|---|---|
| **Unit Tests** | `npm test` | **635 pass**, 0 fail (19 suites) |
| **Typecheck** | `npm run typecheck` | **0 errors** (shared, web, server) |
| **Build** | `npm run build` | **Exitoso** (shared dist, web dist, server dist) |
| **E2E WebSocket** | `node scripts/e2e-websocket.mjs` | **Exitoso** (suite completa en verde contra servidor real) |

---

## 5. Estado de ODRs y Deuda Técnica

- **ODR-D1B-C3-01:** Composición de fuentes de coste acumulativas (Squeezing + Difficult Terrain) permanece **ABIERTA**. La implementación devuelve resultado tipado `unsupported-cost-combination` sin asumir heurísticas arbitrarias.
- **ODR-D1B-I5-1:** Sede de almacenamiento persistente de `squeezingAxis` permanece **ABIERTA**.
- **Deuda Técnica:** No se introdujo deuda técnica nueva.

---

READY FOR ARCHITECTURE REVIEW
