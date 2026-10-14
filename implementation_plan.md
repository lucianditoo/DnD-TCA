# Implementation Plan — D-1B-I6: Move Action Productive Integration (Remediated R3)

Responsabilidad: Plan ejecutable para migrar productivamente la Move Action ordinaria al pipeline normativo de D-1B y resolver la sede autoritativa de `squeezingAxis` (ODR-D1B-I5-1).
Autoridad: Derivada del [NDD D-1B (Capítulos 3 y 8)](docs/designs/normative-movement-design.md)
Lifecycle: Temporal (gobierna la implementación de I6 hasta su cierre formal).
Reemplaza: —
Complementa: [Walkthrough](walkthrough.md), [estado](PROJECT_STATUS.md), [I5R2 plan cerrado](docs/designs/movement/i5r2-implementation-plan.md)
Consumidores: Architecture Reviewer y desarrolladores/agentes que implementarán el Sprint D-1B-I6 tras el Proceed explícito.

**ESTADO ACTUAL:** EN ESPERA DE ARCHITECTURE REVIEW Y PROCEED EXPLÍCITO.
**MODO:** NO IMPLEMENTAR CÓDIGO PRODUCTIVO NI MODIFICAR TESTS HASTA APROBACIÓN.

---

## 1. Archivos Afectados

1. **`packages/shared/src/effects/types.ts`**:
   - Incorporar `readonly squeezingAxis?: SqueezingAxis;` a la interfaz `EffectInstance` como sede autoritativa única de la orientación espacial de `srd_squeezing` (resolución de ODR-D1B-I5-1).
2. **`packages/shared/src/movementCost.ts`** y **`packages/shared/src/movementResolution.ts`**:
   - Implementar la matriz canónica RAW de costes y paridad diagonal (§8.3.2):
     - **Normal:** ortogonal 5 ft; diagonal 5/10 ft (alternado); paridad: SÍ.
     - **Tumble Aislado:** ortogonal 10 ft; diagonal normal 10/20 ft (alternado); paridad: SÍ (consume e incrementa `normalDiagonalStepsThisTurn`). NO es diagonal hampered fija de 15 ft.
     - **Terreno Difícil Aislado:** ortogonal 10 ft; diagonal 15 ft fijos; paridad: NO (`normalDiagonalStepsThisTurn` intacto).
     - **Squeezing Aislado:** ortogonal 10 ft; diagonal 15 ft fijos; paridad: NO (`normalDiagonalStepsThisTurn` intacto).
     - **Tumble + Terreno Difícil:** ortogonal 20 ft; diagonal 30 ft fijos; paridad: NO.
     - **Tumble + Squeezing:** ortogonal 20 ft; diagonal 30 ft fijos; paridad: NO.
     - **Terreno Difícil + Squeezing:** ortogonal 20 ft; diagonal 30 ft fijos; paridad: NO (ODR D-1B-C3-01 resuelta, ya no retorna `unsupported-cost-combination`).
     - **Tumble + Terreno Difícil + Squeezing:** ortogonal 40 ft; diagonal 60 ft fijos; paridad: NO.
3. **`packages/shared/src/movementCommit.ts`**:
   - Persistir `lastStep.squeezingAxis` en la instancia de `srd_squeezing` al entrar en compresión o al actualizar el eje en pasos subsiguientes de compresión.
   - Si la resolución final es `natural`, eliminar las instancias de `srd_squeezing` mediante `EffectManager.removeMany`.
   - Si el Commit es rechazado, cero mutaciones a `room.effectInstances` y cero alteraciones al eje.
4. **`packages/shared/src/movementGeometry.ts`**:
   - En `getCombatantOccupiedCellsAt`, extraer `instance.squeezingAxis` de la instancia activa de `srd_squeezing` del combatiente y pasarla a `getSqueezedFootprintAt` como `preferredAxis`.
   - Esto garantiza determinismo total sin depender del orden del array de candidatos (`legal[0]`):
     `occupiedCellsImmediatelyAfterCommit == occupiedCellsDerivedFromNextAuthoritativeSnapshot`.
5. **`apps/server/src/commands/movementCommands.ts`**:
   - Desconectar `handleMoveCombatant` (fase activa) de `validateMovePath`, `calculatePathCostFeet`, y mutaciones manuales de posición/Squeezing.
   - Conectar con `resolveMovementPipeline` y `commitMovementResolution`.
   - Preservar exactamente el gating de modo de ataque: `attackMode === "full" || (attackMode === "standard" && !usedStandardAction)`.
   - Derivación canónica de `wasSqueezing` previo al Commit consultando `room.effectInstances.some(i => i.effectId === "srd_squeezing" && i.targets?.includes(combatant.id))` (no mediante campos inexistentes en `Combatant`).
   - Ciclo transaccional: resolución candidata completa -> evaluación CD 25 de Acrobacias -> re-resolución pura del prefijo confirmado si hubo fallo -> cálculo de AdOs entregando `resolution.totalCostFeet` y tiradas CD 15 locales -> precondiciones -> commit autoritativo -> publicación atómica.
   - Emisión de logs de compresión únicamente ante cambios reales (`wasSqueezing !== isSqueezingNow`); cero logs si el commit es rechazado.
   - Conservar la rama `room.phase === "preparation"` exactamente como colocación libre sin cambios.
6. **`tests/movement-integration.test.mjs`** (nuevo suite focalizado):
   - Cobertura exhaustiva de integración servidor para `handleMoveCombatant`, matriz canónica de costes y paridad, y contrato de persistencia de `squeezingAxis`.
7. **`tests/regression-tactical-movement.test.mjs`**:
   - Probar no-regresión de `handleWithdraw`, `handleRun`, `handleCharge` y `handleFiveFootStep`.
8. **Documentación de gobernanza**:
   - `docs/testing/master-coverage.md`, `PROJECT_STATUS.md`, `TODO.md`, `walkthrough.md`.

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

## 3. Arquitectura Transaccional, Búfer Local y Squeezing Axis Lifecycle

Para impedir que tiradas de dados de Acrobacias o AdO contaminen `room.log` ante un stale Commit que rechace la acción:

```ts
interface PendingMovementPublication {
  logs: LogEntry[];
  opportunities: OpportunityAttack[];
}
```

1. **Fase de Evaluación (Sin mutar Room):**
   - Se captura el estado previo de compresión:
     ```ts
     const wasSqueezing = room.effectInstances.some(
       (instance) => instance.effectId === "srd_squeezing" && instance.targets?.includes(combatant.id)
     );
     ```
   - Las tiradas de dados de Acrobacias (CD 25) y evasión de AdO (CD 15) se generan y sus `LogEntry` se agregan a `pendingPublication.logs`.
   - Los AdOs detectados que no fueron evadidos se agregan a `pendingPublication.opportunities`.
2. **Fase de Commit:**
   - Se ejecuta `commitMovementResolution`.
   - Si `result.kind === "rejected"`: se descarta `pendingPublication`, se lanza excepción y **cero mutaciones** ocurren en `room` (sin `usedMoveAction`, sin logs, sin AdOs y sin mutación de `srd_squeezing` o su eje).
   - Si `result.kind === "committed"`:
     - `commitMovementResolution` asegura que `room.effectInstances` contenga la instancia de `srd_squeezing` con `squeezingAxis: result.squeezingAxis` si el modo final es `"squeezing"`, o remueve la instancia si es `"natural"`.
3. **Fase de Publicación (Solo post-commit):**
   - `room.currentTurn.usedMoveAction = true;`
   - `room.log.unshift(...pendingPublication.logs);`
   - `room.log.unshift(makeLog("movement", `${combatant.name} avanza ${resolution.totalCostFeet} pies...`));`
   - Si cambió de modo espacial:
     - `const isSqueezingNow = commitResult.finalSpatialMode === "squeezing";`
     - `if (!wasSqueezing && isSqueezingNow) { room.log.unshift(makeLog("movement", `${combatant.name} se comprime para avanzar por un espacio estrecho.`)); }`
     - `if (wasSqueezing && !isSqueezingNow) { room.log.unshift(makeLog("movement", `${combatant.name} recupera su espacio normal.`)); }`
   - `room.pendingOpportunityAttacks.push(...pendingPublication.opportunities);`
   - `syncEncounterPhase(room);`
   - `broadcast(room);`

---

## 4. Divergencias Conocidas con UI / Preview

En I6 el frontend continúa utilizando helpers legacy (`calculatePathStepCostsFeet`):
- **Diagonales DT:** UI muestra 15/20 ft alternado; servidor aplica 15 ft fijos normativos sin consumir paridad.
- **Squeezing:** UI mira anclas individuales; servidor deriva huellas multicasilla con eje persistido y compresión legal.
- **Acrobacias:** UI aplica x2; servidor valida paridad estricta (10/20 ft en diagonal ordinaria) o duplicación a 30 ft fijos en terreno impedido.
- El servidor mantiene autoridad exclusiva; la divergencia visual se resolverá en el sprint posterior de UI Preview.

---

## 5. Plan de Verificación y Testing

1. **Matriz Canónica de Costes de Movimiento y Paridad (Servidor):**
   - **Normal:** ortogonal 5 ft; diagonal 5 ft (paso 1) -> 10 ft (paso 2); `normalDiagonalStepsThisTurn` incrementa.
   - **Tumble Aislado:** ortogonal 10 ft; diagonal normal 10 ft (paso 1) -> 20 ft (paso 2); `normalDiagonalStepsThisTurn` incrementa. Verifica explícitamente que NO cuesta 15 ft fijos.
   - **Terreno Difícil Aislado:** ortogonal 10 ft; diagonal 15 ft fijos; `normalDiagonalStepsThisTurn` permanece intacto.
   - **Squeezing Aislado:** ortogonal 10 ft; diagonal 15 ft fijos; `normalDiagonalStepsThisTurn` permanece intacto. Verifica explícitamente que NO cuesta 10/20 ft ni consume paridad.
   - **Tumble + Terreno Difícil:** ortogonal 20 ft; diagonal 30 ft fijos; paridad permanece intacta.
   - **Tumble + Squeezing:** ortogonal 20 ft; diagonal 30 ft fijos; paridad permanece intacta.
   - **Terreno Difícil + Squeezing:** ortogonal 20 ft; diagonal 30 ft fijos; paridad permanece intacta.
   - **Tumble + Terreno Difícil + Squeezing:** ortogonal 40 ft; diagonal 60 ft fijos; paridad permanece intacta.
   - **Invariante de continuidad de paridad normal:** intercalar diagonales normales con diagonales impedidas (15 ft / 30 ft) demuestra que el contador normal retoma exactamente la paridad esperada sin desfasajes.

2. **Contrato de Persistencia de Squeezing Axis (ODR-D1B-I5-1):**
   - **Large entra horizontal:** Large entra en corredor horizontal -> `squeezingAxis: "horizontal"` persistido en `srd_squeezing` -> siguiente llamada a `getCombatantOccupiedCells` / siguiente snapshot reproduce exactamente las celdas horizontales `(x, y)` y `(x+1, y)`.
   - **Large entra vertical:** Large entra en corredor vertical -> `squeezingAxis: "vertical"` persistido en `srd_squeezing` -> siguiente snapshot reproduce exactamente las celdas verticales `(x, y)` y `(x, y+1)`.
   - **Ambas orientaciones legales:** en una intersección estrecha donde tanto horizontal como vertical son legalmente posibles, el snapshot posterior conserva EXACTAMENTE la orientación confirmada por Resolution, sin depender del orden del array ni cambiar a horizontal.
   - **Squeezing -> Squeezing:** movimiento continuado dentro de compresión conserva o actualiza el eje según la Resolution confirmada.
   - **Squeezing -> Natural:** salir del corredor elimina la instancia de `srd_squeezing` y limpia el eje por completo.
   - **Stale Commit:** commit rechazado por precondición stale no muta `room.effectInstances` ni altera el eje.
   - **Fingerprint:** cambio externo en el eje de una criatura comprimida altera sus celdas ocupadas en `createMovementStateFingerprint`, invalidando limpiamente una resolución stale previa.
   - **Fase de Preparación:** colocación libre en fase de preparación no se ve alterada por la lógica transaccional de I6.

3. **Integración Transaccional y Regresión:**
   - Economía de turno: primera Move Action gasta `usedMoveAction = true`; un segundo `move-combatant` ordinario en el mismo turno es rechazado tajantemente.
   - Attack Mode gating: modo "full" rechaza; modo "standard" sin consumir rechaza; modo "standard" consumido permite mover.
   - Presupuesto insuficiente: rechazo y cero mutación.
   - Commit stale: rechazo, cero logs y cero AdOs.
   - Acrobacias interrupción: CD 25 éxito avanza todo; CD 25 fallo intermedio trunca la ruta, re-resuelve prefijo normativo, comitea en la casilla previa al enemigo y genera AdO; CD 25 fallo inicial rechazo con error y cero movimiento.
   - AdO metric: `findTriggeredOpportunityAttacksForPath` recibe `resolution.totalCostFeet`.
   - Máquina de estados de logs de Squeezing: emitir log de entrada únicamente en la transición normal -> squeezing; emitir log de salida únicamente en la transición squeezing -> normal; no emitir log si permanece en el mismo modo; cero logs ante commit rechazado.
   - No regresión: `handleWithdraw`, `handleRun`, `handleCharge`, `handleFiveFootStep` intactos.
   - E2E & UI: `node scripts/e2e-websocket.mjs` y `npm run test:ui` 100% verde.
