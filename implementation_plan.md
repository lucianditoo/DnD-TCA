# Implementation Plan — D-1B-I5R1 / I5R2: Movement Resolution / Commit Remediation

Responsabilidad: Plan ejecutable de remediación de procedencia y vigencia del commit de movimiento.
Autoridad: Derivada del [NDD D-1B](docs/designs/normative-movement-design.md)
Lifecycle: Temporal, pendiente de Architecture Review y reubicación al cierre formal.
Reemplaza: — (recupera y continúa el mismo plan de I5R1)
Complementa: [Walkthrough](walkthrough.md), [estado](PROJECT_STATUS.md)
Consumidores: Implementador y Architecture Reviewer de D-1B-I5R2.

**Estado vigente:** la sección 8 gobierna I5R2; las secciones 1–7 conservan la
trazabilidad del plan I5R1 y no constituyen una segunda autoridad de fingerprint.

Este plan describe la remediación final de la Architecture Review de D-1B-I5 (Round 4). Vincula estrictamente la validación diagonal a `resolution.initialContext`, exige correspondencia obligatoria entre actor, turno y ronda (impidiendo ataques de ciclo de ronda), garantiza la portabilidad de `createMovementStateFingerprint` dentro de `packages/shared`, preserva la semántica diagonal y de Squeezing congelada, y mantiene abiertas las ODRs normativas.

**IMPORTANTE:**
- **NO** se migrarán consumidores productivos en este sprint.
- I6 permanece bloqueado hasta nueva Architecture Review.

---

## 1. Procedencia, Identidad de Turno y Vigencia de la Resolución

**Problema:**
1. Si el contexto diagonal se valida contra una precondición independiente provista por el caller, este podría validar una resolución calculada sobre un contexto diagonal diferente.
2. Si solo se valida `room.currentTurn.combatantId`, un caller podría commitear la resolución sobre un `combatant` ajeno al turno.
3. Si el combate avanza una ronda completa y vuelve al turno del mismo combatiente con posición y contadores reiniciados idénticos, una resolución vieja de la ronda anterior podría confirmarse erróneamente si no se valida la ronda.

### Solución Arquitectónica

#### A. Evidencia de la Resolución (Provenance)
`MovementResolutionResult` (en sus variantes `ready` e `insufficient-budget`) ya contiene de forma inmutable:
- `readonly initialContext: Readonly<MovementContext>` (contexto diagonal exacto bajo el cual se calculó).
- Se incorpora: `readonly rulesStateFingerprint: string` (fingerprint determinista del snapshot exacto consumido).

#### B. Precondiciones del Commit (`MovementCommitPreconditions`)
Para los datos que la resolución no captura por sí misma (la identidad temporal del turno y el presupuesto gastado previo en la sala):
```typescript
export interface MovementCommitPreconditions {
  /** Identidad del combatiente activo del turno. */
  readonly expectedTurnCombatantId: string | null;
  /** Ronda del combate en la que se calculó la resolución. */
  readonly expectedRound: number;
  /** Posición de origen esperada del actor. */
  readonly expectedOrigin: Readonly<Position>;
  /** Presupuesto de movimiento consumido al inicio de la resolución. */
  readonly expectedMovementUsedFeet: number;
}
```
*(Nota: Se desacopla `expectedDiagonalContext` de las precondiciones externas; la autoridad sobre el contexto diagonal inicial recae exclusivamente en `resolution.initialContext`).*

#### C. Verificaciones Secuenciales en `commitMovementResolution`
El Commit ejecuta las siguientes comprobaciones atómicas antes de cualquier mutación:

1. **Correspondencia Actor / Turno:**
   - Si `input.combatant.id !== preconditions.expectedTurnCombatantId` o `room.currentTurn.combatantId !== input.combatant.id` o `room.currentTurn.combatantId !== preconditions.expectedTurnCombatantId`:
     Rechazar con `"stale-turn"` o `"invalid-actor"` (el actor recibido no es el combatiente del turno activo).
2. **Identidad Temporal de Ronda:**
   - Si `room.round !== preconditions.expectedRound`:
     Rechazar con `"stale-round"` (impide reutilizar una resolución al ciclar la ronda y volver al mismo combatiente).
3. **Origen Espacial:**
   - Si `!positionsMatch(combatant.position, preconditions.expectedOrigin)`:
     Rechazar con `"stale-origin"`.
4. **Presupuesto Consumido:**
   - Si `room.currentTurn.movementUsedFeet !== preconditions.expectedMovementUsedFeet`:
     Rechazar con `"stale-movement-used"`.
5. **Contexto Diagonal Vinculado a Resolution:**
   - Si `room.currentTurn.normalDiagonalStepsThisTurn !== resolution.initialContext.normalDiagonalStepsThisTurn`:
     Rechazar con `"stale-diagonal-context"` (garantiza que la sala está exactamente en el contexto para el que se calculó la resolución).
6. **Vigencia del Estado de Reglas (Fingerprint):**
   - Se genera el snapshot actual `currentSnapshot = createCombatRulesSnapshot(room)`.
   - Se deriva `currentFingerprint = createMovementStateFingerprint(currentSnapshot)`.
   - Si `currentFingerprint !== resolution.rulesStateFingerprint`:
     Rechazar con `"stale-rules-state"`.

---

## 2. Portabilidad y Determinismo de `createMovementStateFingerprint`

El helper vive en `packages/shared/src/movementResolution.ts` y debe ser 100% portable (browser y Node):
- **Cero dependencias nativas:** No importar `node:crypto` ni librerías externas.
- **Determinismo Canónico:** Antes de la serialización, todos los arrays se normalizan y ordenan:
  - `board.impassableCells`, `board.difficultTerrainCells`, `board.narrowCells`: clonados y ordenados léxicamente (`sort()`).
  - `board.width`, `board.height`, `board.cellSizeFeet`: serializados explícitamente.
  - `combatants`: clonados y ordenados por `id`. Para cada combatiente se extraen únicamente: `id`, `position: { x, y, zFeet: zFeet ?? 0 }`, `sizeCategory`, `type`, y `lifeStatus: lifeStatus(combatant)`.
  - `effectInstances`: filtradas a aquellas relevantes para movimiento (`effectId === "srd_squeezing"`), ordenadas por `instanceId` o `targets`, con `targets` ordenados léxicamente.
- **Formato:** Serialización canónica en string (JSON estructurado o concatenación delimitada estable). Dos snapshots con el mismo significado semántico producen exactamente el mismo string independientemente del orden de inserción en arrays.

---

## 3. Coste de Squeezing y Semántica Diagonal (NDD §3.4, §3.6, §3.10)

`assessMovementCost` en `packages/shared/src/movementCost.ts` se mantiene como la ÚNICA autoridad de coste:
1. `MovementCostStep` recibe `spatialMode: SpatialMode` desde la Resolución.
2. Tabla de evaluación estricta:
   - **NORMAL ORTHOGONAL:** base 5 ft, coste 5 ft, NO altera contador diagonal.
   - **NORMAL DIAGONAL:** base alternada 5/10 ft, coste 5/10 ft, incrementa `normalDiagonalStepsThisTurn` exactamente una vez.
   - **SQUEEZING ORTHOGONAL (sin DT):** base 5 ft, coste final 10 ft, NO altera contador diagonal.
   - **SQUEEZING DIAGONAL (sin DT):** consume la paridad NORMAL correspondiente (base 5 o 10 ft), incrementa `normalDiagonalStepsThisTurn` exactamente una vez, y Squeezing duplica el coste final a 10 o 20 ft.
   - **DIFFICULT TERRAIN ORTHOGONAL (sin Squeezing):** base 5 ft, coste final 10 ft, NO altera contador diagonal.
   - **DIFFICULT TERRAIN DIAGONAL (sin Squeezing):** coste final fijo 15 ft, NO altera contador diagonal, NO altera la paridad normal posterior.
   - **SQUEEZING + DIFFICULT TERRAIN:** Retorna `unsupported-cost-combination`, no inventa coste, no altera contextos, y la ODR D-1B-C3-01 continúa ABIERTA.

---

## 4. Separación Base Route Cost vs Distancia Espacial

1. `MovementCostAssessment` produce:
   - `stepBaseRouteCostFeet`: Coste base normativo del paso antes de modificadores (5 o 10 ft según ortogonal/diagonal).
   - `totalBaseRouteCostFeet`: Sumatoria pura de los costes base.
2. En `commitMovementResolution`:
   - `room.currentTurn.movementUsedFeet += resolution.totalCostFeet` (presupuesto consumido).
   - `combatant.stats.distanceMovedFeet += resolution.totalBaseRouteCostFeet` (métrica legacy de recorrido).
3. **Limitación de Alcance:** Queda explícitamente establecido que `totalBaseRouteCostFeet` **NO es la Spatial Distance normativa** del NDD y no resuelve la ODR de distancia espacial. El nombre histórico `distanceMovedFeet` no convierte esta métrica en autoridad espacial.

---

## 5. Salida Tipada para ODR D-1B-C3-01

- `assessMovementCost` devuelve una unión discriminada que incluye:
  ```typescript
  {
    kind: "unsupported-cost-combination",
    reason: "Squeezing + Difficult Terrain combination is pending normative resolution (ODR-D1B-C3-01).",
    failedStepIndex: index
  }
  ```
- `resolveMovementPipeline` propaga este resultado tipado sin arrojar excepciones (`throw`).
- Al no ser de tipo `kind: "ready"`, TypeScript y el runtime impiden que sea aceptado por `commitMovementResolution`.

---

## 6. Matriz de Tests Obligatorios

Ubicación: `tests/movement-commit.test.mjs`, `tests/movement-cost.test.mjs`, `tests/movement-resolution.test.mjs`.

### STALE STATE & IDENTIDAD TEMPORAL (Commit)
1. `stale-turn`: Resolución de A rechazada si cambió el turno a B (`room.currentTurn.combatantId !== expectedTurnCombatantId`).
2. `invalid-actor`: Resolución rechazada si se intenta commitear pasando una referencia de combatiente distinta a la del turno activo (`combatant.id !== room.currentTurn.combatantId`).
3. `stale-round (ciclo de ronda)`: Resolución de A calculada en Ronda 1 es rechazada cuando el combate avanza a Ronda 2 y vuelve a ser el turno de A con idéntica posición (1,1) y contadores en 0 (`room.round !== expectedRound`).
4. `stale-diagonal-context`: Resolución calculada con `initialContext` 0 es rechazada si la sala tiene `normalDiagonalStepsThisTurn = 1`, vinculando la validación directamente a `resolution.initialContext`.
5. `stale-rules-state`: Resolución rechazada si el board o combatientes cambiaron (detectado por `rulesStateFingerprint`).
6. Rechazo completamente no mutante (no altera `room`, `combatant` ni aplica `srd_squeezing`).
7. Resolución vigente confirma normalmente sin stale state.

### SQUEEZING COST & SEMÁNTICA DIAGONAL
8. Squeezing ortogonal normal: base 5 / cost final 10.
9. Squeezing diagonal base 5: base 5 / cost final 10.
10. Segundo diagonal bajo Squeezing: base 10 → cost final 20.
11. Difficult Terrain ortogonal: base 5 / cost final 10.
12. **Regresión A:** normal diagonal → difficult diagonal → normal diagonal (paridad normal preservada al saltar DT).
13. **Regresión B:** squeezing diagonal → normal diagonal (squeezing diagonal participa de la paridad normal y avanza el contador).
14. **Combinación No Soportada:** Squeezing + Difficult Terrain produce resultado tipado `unsupported-cost-combination` sin arrojar excepción.

### BASE ROUTE COST & DISTANCIA
15. Multi-step y terrenos mixtos: el Commit incrementa `movementUsedFeet` en `totalCostFeet` y `distanceMovedFeet` en `totalBaseRouteCostFeet` de manera independiente.

### FINGERPRINT PORTABLE
16. `createMovementStateFingerprint` produce exactamente el mismo string ante arrays con celdas o combatientes desordenados (determinismo canónico) y no depende de `node:crypto`.

### REGRESIÓN GENERAL
17. Regresión completa de suites I1-I5.
18. Pureza / deep-freeze en entradas de resolución.

---

## 7. Documentación y ODRs

- **ODR-D1B-C3-01:** ABIERTA.
- **ODR-D1B-I5-1:** ABIERTA.
- **I6:** BLOQUEADA (cero migración productiva en I5R1).
- El NDD congelado NO se modifica.

---
Estado histórico del plan I5R1: IMPLEMENTATION PLAN READY FOR OWNER REVIEW.


## 8. Remediación I5R2 — dependencias verificadas y ejecución autorizada

Este plan se recupera de 9a6b87d:implementation_plan.md; fue retirado de la raíz
en 551a333 al implementar D-5. Continúa el mismo artefacto, sin nuevo NDD.
Las secciones anteriores documentan I5R1; esta sección sustituye su alcance
de identidad y fingerprint para I5R2.

### Dependencias reales

- routeValidation.ts consume dimensiones/escala del Board, muros, narrowCells,
  posición/tamaño/facción y lifeStatus de ocupantes, huellas efectivas y la
  capacidad isAcrobatic del intento. movementGeometry.ts deriva huellas
  comprimidas desde Squeezing; se reutilizarán las celdas proyectadas, no IDs
  de instancias, como evidencia semántica.
- assessMovementCost consume Steps legales, terreno difícil, modo espacial y
  contexto diagonal. No cambia ninguna fórmula en I5R2.
- Rules.getMovementSpeedProjection consume getArmorAdjustedSpeedFeet
  (baseSpeedFeet, inventario, armorItemId y EquipmentCatalog), buffs.speedBonusFeet,
  delta SPEED del EffectReducer, MovementRateContribution y CANNOT_MOVE.
  La evidencia guardará total, beforeRate y razón reducida; excluye etiquetas,
  IDs de instancias y trazas cosméticas.
- La prohibición CANNOT_MOVE también existe como trait intrínseco ruleTraits;
  se conserva su booleano junto con la reducción declarativa de efectos.
- El presupuesto externo availableBudgetFeet permanece como autorización del
  caller. La evidencia captura sus fuentes productivas vigentes (proyección de
  velocidad del actor y movementUsedFeet), sin inventar multiplicadores por acción.
  La integración de acciones/autorizaciones distintas sigue perteneciendo a I6.
- lifeStatus conserva la semántica actual de HP, estabilidad y Diehard.
  No se amplía la legalidad ni se introduce una nueva regla.

### Cambios

1. ready/insufficient-budget capturan readonly combatantId desde input.combatant.id;
   initialContext se copia para no compartir evidencia mutable con el caller.
2. Commit busca al actor por resolution.combatantId, exige identidad de referencia
   con la entidad viva y correspondencia con turno y precondición antes de mutar.
3. Un único fingerprint recibe snapshot y actor: estado espacial normalizado,
   huellas efectivas canónicas, proyección de velocidad/restricción del actor y
   presupuesto ya usado. No incorpora nombres, colores, logs, timestamps,
   identidad de objetos ni efectos ajenos al movimiento.
4. Se mantienen las guardas I5R1 y las ODR abiertas. No hay consumidores productivos.
5. Pruebas: sustitución A/B, clon, actor ausente, éxito canónico, aplicación/remoción
   de condiciones, Speed base/equipo/buffs, orden semántico y cambios cosméticos,
   siempre comparando la sala completa antes/después de cada rechazo.

### Validación y estado

DoD: npm test, npm run typecheck, npm run build, WebSocket, Playwright,
git diff --check. Commit único y CI según Governance v2.
Implementado y validado: 701/701 unitarias, 72/72 focalizadas, typecheck/build
sin errores, 110/110 WebSocket y 16/16 Playwright. `git diff --check` sin errores.
I5R2: READY FOR ARCHITECTURE REVIEW; I5 no cerrado, I6 BLOQUEADO.
