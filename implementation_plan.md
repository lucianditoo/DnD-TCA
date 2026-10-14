# Implementation Plan — D-1B-I6: Move Action Productive Integration (Remediated)

Responsabilidad: Plan ejecutable para migrar productivamente la Move Action ordinaria al pipeline normativo de D-1B.
Autoridad: Derivada del [NDD D-1B (Capítulo 8)](docs/designs/normative-movement-design.md)
Lifecycle: Temporal (gobierna la implementación de I6 hasta su cierre formal).
Reemplaza: —
Complementa: [Walkthrough](walkthrough.md), [estado](PROJECT_STATUS.md), [I5R2 plan cerrado](docs/designs/movement/i5r2-implementation-plan.md)
Consumidores: Architecture Reviewer y desarrolladores/agentes que implementarán el Sprint D-1B-I6 tras el Proceed explícito.

**ESTADO ACTUAL:** EN ESPERA DE ARCHITECTURE REVIEW Y PROCEED EXPLÍCITO.
**MODO:** NO IMPLEMENTAR CÓDIGO PRODUCTIVO NI MODIFICAR TESTS HASTA APROBACIÓN.

---

## 1. Archivos Afectados

1. **`packages/shared/src/movementCost.ts`** y **`packages/shared/src/movementResolution.ts`**:
   - Incorporar soporte para coste de Acrobacias (`isAcrobatic?: boolean`) en `MovementCostStep` y `assessMovementCost` (duplicación x2 de coste de paso).
   - Composición de costes: ortogonal normal 5->10 ft; diagonal normal 5/10->10/20 ft; DT ortogonal 10->20 ft; DT diagonal 15->30 ft; Squeezing ortogonal 10->20 ft; Squeezing diagonal 10/20->20/40 ft; Squeezing + DT permanece bloqueado (`unsupported-cost-combination`).
2. **`apps/server/src/commands/movementCommands.ts`**:
   - Desconectar `handleMoveCombatant` (fase activa) de `validateMovePath`, `calculatePathCostFeet`, y mutaciones manuales de posición/Squeezing.
   - Conectar con `resolveMovementPipeline` y `commitMovementResolution`.
   - Preservar exactamente el gating de modo de ataque: `attackMode === "full" || (attackMode === "standard" && !usedStandardAction)`.
   - Implementar el ciclo transaccional: resolución candidata completa (con coste x2 en acrobacias) -> evaluación CD 25 de Acrobacias -> re-resolución pura del prefijo confirmado si hubo fallo -> cálculo de AdOs entregando `resolution.totalCostFeet` y tiradas CD 15 locales -> precondiciones -> commit autoritativo -> publicación atómica.
   - Conservar la rama `room.phase === "preparation"` exactamente como colocación libre sin cambios.
3. **`tests/movement-integration.test.mjs`** (nuevo suite focalizado):
   - Cobertura exhaustiva de integración servidor para `handleMoveCombatant`: ortogonal, diagonal 5/10, rechazo de segundo movimiento en el mismo turno por economía vigente (`usedMoveAction`), terreno difícil ortogonal (10 ft) y diagonal (15 ft fijos sin paridad), Squeezing puro, rechazo de Squeezing + DT, presupuesto insuficiente, rechazo de stale commit con cero mutación, gating de modo de ataque (full bloquea, standard no gastado bloquea, standard gastado permite), Acrobacias (coste x2, éxito, fallo intermedio con prefijo re-resuelto, fallo inicial), y entrega de `totalCostFeet` a AdO/publicación.
4. **`tests/regression-tactical-movement.test.mjs`** (o asserts en suites existentes):
   - Probar que `handleWithdraw`, `handleRun`, `handleCharge` y `handleFiveFootStep` siguen funcionando idénticamente bajo sus caminos legacy sin verse alterados por la migración de Move Action.
5. **`docs/testing/master-coverage.md`**, **`PROJECT_STATUS.md`**, **`TODO.md`**, **`walkthrough.md`**:
   - Sincronización del cierre tras la validación en Fase 6.

---

## 2. Aislamiento Estricto y Helpers Legacy

- **`packages/shared/src/rules.ts`**:
  - `validateMovePath`, `calculatePathStepCostsFeet`, `calculatePathCostFeet` se mantienen **intactos y sin modificar**. Siguen dando soporte a:
    - `handleWithdraw`
    - `handleRun`
    - `handleFiveFootStep`
    - `chargePreviewPath` y helpers de UI/preview en el cliente.
- **`apps/server/src/combat/spatialTransition.ts`**:
  - Sigue existiendo para la fase de colocación `preparation` y acciones tácticas no migradas.
  - Para `handleMoveCombatant` activo, la transición de estado espacial y efectos de `srd_squeezing` la gobierna exclusivamente `commitMovementResolution`.

---

## 3. Arquitectura Transaccional y Búfer Local de Publicación

Para impedir que tiradas de dados de Acrobacias o AdO contaminen `room.log` ante un stale Commit que rechace la acción:

```ts
interface PendingMovementPublication {
  logs: LogEntry[];
  opportunities: OpportunityAttack[];
}
```

1. **Fase de Evaluación (Sin mutar Room):**
   - Las tiradas de dados de Acrobacias (CD 25) y evasión de AdO (CD 15) se generan y sus `LogEntry` se agregan a `pendingPublication.logs`.
   - Los AdOs detectados que no fueron evadidos se agregan a `pendingPublication.opportunities`.
2. **Fase de Commit:**
   - Se ejecuta `commitMovementResolution`.
   - Si `result.kind === "rejected"`: se descarta `pendingPublication`, se lanza excepción y **cero mutaciones** ocurren en `room` (sin `usedMoveAction`, sin logs y sin AdOs).
3. **Fase de Publicación (Solo post-commit):**
   - `room.currentTurn.usedMoveAction = true;`
   - `room.log.unshift(...pendingPublication.logs);`
   - `room.log.unshift(makeLog("movement", `${combatant.name} avanza ${resolution.totalCostFeet} pies...`));`
   - Si cambió de modo espacial (entrada o salida de compresión), se emite el log correspondiente.
   - `room.pendingOpportunityAttacks.push(...pendingPublication.opportunities);`
   - `syncEncounterPhase(room);`
   - `broadcast(room);`

---

## 4. Divergencias Conocidas con UI / Preview

En I6 el frontend continúa utilizando helpers legacy (`calculatePathStepCostsFeet`):
- **Diagonales DT:** UI muestra 15/20 ft alternado; servidor aplica 15 ft fijos normativos sin consumir paridad.
- **Squeezing:** UI mira anclas individuales; servidor deriva huellas multicasilla y compresión legal.
- **Acrobacias:** Ambos aplican x2, pero el servidor valida paridad estricta paso a paso.
- El servidor mantiene autoridad exclusiva; la divergencia visual se resolverá en el sprint posterior de UI Preview.

---

## 5. Plan de Verificación y Testing

1. **Tests de Integración de Move Action (Servidor):**
   - Ortogonal básico (5 ft) y diagonal (5 ft -> 10 ft con paridad acumulada).
   - Economía de turno: primera Move Action gasta `usedMoveAction = true`; un segundo comando `move-combatant` ordinario en el mismo turno es rechazado tajantemente por `canUseMoveAction` con cero mutación.
   - Attack Mode gating: modo "full" rechaza; modo "standard" sin consumir rechaza; modo "standard" consumido (`usedStandardAction === true`) permite mover.
   - Terreno difícil: ortogonal cuesta 10 ft; diagonal cuesta 15 ft fijos y no altera paridad de pasos normales.
   - Squeezing puro: coste x2 y aplicación automática del efecto `srd_squeezing`.
   - Squeezing + Terreno Difícil: rechazo limpio por `unsupported-cost-combination`.
   - Presupuesto insuficiente: rechazo y cero mutación.
   - Commit stale (ej. cambio en `movementUsedFeet` o posición previa): rechazo, `usedMoveAction` permanece `false`, cero logs y cero AdOs.
   - Acrobacias normal: coste de ruta x2 (ortogonal 10 ft, diagonal 10/20 ft).
   - Acrobacias + DT: ortogonal 20 ft, diagonal 30 ft.
   - Acrobacias + Squeezing: ortogonal 20 ft, diagonal 20/40 ft.
   - Acrobacias interrupción: CD 25 éxito avanza todo; CD 25 fallo intermedio trunca la ruta, re-resuelve prefijo normativo, comitea en la casilla previa al enemigo y genera AdO; CD 25 fallo inicial rechazo con "Movimiento interrumpido en el primer paso" y cero movimiento.
   - AdO metric: `findTriggeredOpportunityAttacksForPath` recibe `resolution.totalCostFeet`.
2. **Tests de No Regresión:**
   - `handleWithdraw` conserva exención de casilla inicial y 2x velocidad.
   - `handleRun` conserva multiplicador x4/x3 y línea recta.
   - `handleCharge` conserva bonus +2 y -2 CA.
   - `handleFiveFootStep` conserva 5 ft sin AdO y bloqueo de terreno difícil.
3. **E2E & UI:**
   - `node scripts/e2e-websocket.mjs`: verificar que el flujo E2E WebSocket para `move-combatant` pasa al 100%.
   - `npm run test:ui`: verificar que los smoke tests y la demo conservan compatibilidad.
