# Implementation Plan — D-1B-I6: Move Action Productive Integration

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

1. **`apps/server/src/commands/movementCommands.ts`**:
   - Desconectar `handleMoveCombatant` (fase activa) de `validateMovePath`, `calculatePathCostFeet`, y mutaciones manuales de posición/Squeezing.
   - Conectar con `resolveMovementPipeline` y `commitMovementResolution`.
   - Implementar el ciclo transaccional: resolución candidata completa -> evaluación CD 25 de Acrobacias -> re-resolución pura del prefijo confirmado si hubo fallo -> cálculo de AdOs y tiradas CD 15 locales -> precondiciones -> commit autoritativo -> publicación atómica.
   - Conservar la rama `room.phase === "preparation"` exactamente como colocación libre sin cambios.
2. **`tests/movement-integration.test.mjs`** (nuevo suite focalizado):
   - Cobertura exhaustiva de integración servidor para `handleMoveCombatant`: ortogonal, diagonal 5/10, paridad en movimiento segmentado, terreno difícil ortogonal y diagonal 15 ft, Squeezing puro, rechazo de Squeezing + DT, presupuesto insuficiente, rechazo de stale commit con cero mutación, éxito y fallo intermedio/inicial de Acrobacias, y persistencia de AdOs.
3. **`tests/regression-tactical-movement.test.mjs`** (o asserts en suites existentes):
   - Probar que `handleWithdraw`, `handleRun`, `handleCharge` y `handleFiveFootStep` siguen funcionando idénticamente bajo sus caminos legacy sin verse alterados por la migración de Move Action.
4. **`docs/testing/master-coverage.md`**, **`PROJECT_STATUS.md`**, **`TODO.md`**, **`walkthrough.md`**:
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
   - Si `result.kind === "rejected"`: se descarta `pendingPublication`, se lanza excepción y **cero mutaciones** ocurren en `room`.
3. **Fase de Publicación (Solo post-commit):**
   - `room.currentTurn.usedMoveAction = true;`
   - `room.log.unshift(...pendingPublication.logs);`
   - `room.log.unshift(makeLog("movement", `${combatant.name} avanza ${commitResult.distanceMovedFeet} pies...`));`
   - Si cambió de modo espacial (entrada o salida de compresión), se emite el log correspondiente.
   - `room.pendingOpportunityAttacks.push(...pendingPublication.opportunities);`
   - `syncEncounterPhase(room);`
   - `broadcast(room);`

---

## 4. Plan de Verificación y Testing

1. **Tests de Integración de Move Action (Servidor):**
   - Ortogonal básico (5 ft) y diagonal (5 ft -> 10 ft con paridad acumulada).
   - Movimiento segmentado: dos comandos consecutivos en el mismo turno comparten paridad diagonal.
   - Terreno difícil: ortogonal cuesta 10 ft; diagonal cuesta 15 ft fijos y no altera paridad de pasos normales.
   - Squeezing puro: coste x2 y aplicación automática del efecto `srd_squeezing`.
   - Squeezing + Terreno Difícil: rechazo limpio por `unsupported-cost-combination`.
   - Presupuesto insuficiente: rechazo y cero mutación.
   - Commit stale (ej. cambio en `movementUsedFeet` o posición previa): rechazo, `usedMoveAction` permanece `false`, cero logs y cero AdOs.
   - Acrobacias éxito: avanza a través de enemigo y consume coste de la ruta completa.
   - Acrobacias fallo intermedio: trunca la ruta, re-resuelve prefijo normativo, comitea en la casilla previa al enemigo y genera AdO.
   - Acrobacias fallo inicial: rechazo con "Movimiento interrumpido en el primer paso" y cero movimiento.
2. **Tests de No Regresión:**
   - `handleWithdraw` conserva exención de casilla inicial y 2x velocidad.
   - `handleRun` conserva multiplicador x4/x3 y línea recta.
   - `handleCharge` conserva bonus +2 y -2 CA.
   - `handleFiveFootStep` conserva 5 ft sin AdO y bloqueo de terreno difícil.
3. **E2E & UI:**
   - `node scripts/e2e-websocket.mjs`: verificar que el flujo E2E WebSocket para `move-combatant` pasa al 100%.
   - `npm run test:ui`: verificar que los smoke tests y la demo conservan compatibilidad.
