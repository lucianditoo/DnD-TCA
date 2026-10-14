# Implementation Plan — D-1B-I6: Move Action Productive Integration (Remediated R5)

Responsabilidad: Plan ejecutable para migrar productivamente la Move Action ordinaria al pipeline normativo de D-1B y resolver la sede autoritativa de `squeezingAxis` (ODR-D1B-I5-1).
Autoridad: Derivada del [NDD D-1B (Capítulos 3 y 8)](../normative-movement-design.md)
Lifecycle: Referencia de implementación ejecutada; no es un plan activo.
Reemplaza: —
Complementa: [Walkthrough](../../../walkthrough.md), [estado](../../../PROJECT_STATUS.md), [I5R2 plan cerrado](i5r2-implementation-plan.md)
Consumidores: Architecture Reviewer y desarrolladores/agentes que consultan la ejecución del Sprint D-1B-I6.

**ESTADO ACTUAL:** IMPLEMENTACIÓN Y DoD COMPLETADOS; PENDIENTE DE ARCHITECTURE REVIEW EXTERNA.
**MODO:** Registro del plan aprobado en 16711b6 y ejecutado con Proceed del owner. Las tareas/pruebas futuras descritas abajo documentan el diseño original; no autorizan trabajo adicional.

---

## 1. Archivos Afectados

1. **`packages/shared/src/effects/types.ts`**:
   - Importar SqueezingAxis del módulo hoja movementContracts.ts, sin depender de movementGeometry; incorporar `readonly squeezingAxis?: SqueezingAxis;` a la interfaz `EffectInstance` como sede autoritativa única de la orientación espacial de `srd_squeezing` (resolución de ODR-D1B-I5-1).
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
   - Estrechar/validar último paso a evidencia discriminada antes de cualquier mutación; remove/reinsert candidato al cambiar eje evita onStack ignore. Persistir `lastStep.squeezingAxis` en la instancia de `srd_squeezing` al entrar en compresión o al actualizar el eje en pasos subsiguientes de compresión.
   - Si la resolución final es `natural`, eliminar las instancias de `srd_squeezing` mediante `EffectManager.removeMany`.
   - Si el Commit es rechazado, cero mutaciones a `room.effectInstances` y cero alteraciones al eje.
4. **`packages/shared/src/movementGeometry.ts`**:
   - Importar/re-exportar SqueezingAxis del módulo hoja. En footprint orientable con squeezing exigir instancia única, eje válido y proyección legal; si falla, error de integridad sin fallback legal[0]/horizontal/natural. En `getCombatantOccupiedCellsAt`, extraer `instance.squeezingAxis` de la instancia activa de `srd_squeezing` del combatiente y pasarla a `getSqueezedFootprintAt` como `preferredAxis`.
   - Esto garantiza determinismo total sin depender del orden del array de candidatos (`legal[0]`):
     `occupiedCellsImmediatelyAfterCommit == occupiedCellsDerivedFromNextAuthoritativeSnapshot`.
5. **`apps/server/src/commands/movementCommands.ts`**:
   - Desconectar `handleMoveCombatant` (fase activa) de `validateMovePath`, `calculatePathCostFeet`, y mutaciones manuales de posición/Squeezing.
   - Conectar con `resolveMovementPipeline` y `commitMovementResolution`.
   - Preservar exactamente el gating de modo de ataque: `attackMode === "full" || (attackMode === "standard" && !usedStandardAction)`.
   - Derivación canónica de `wasSqueezing` previo al Commit consultando `room.effectInstances.some(i => i.effectId === "srd_squeezing" && i.targets?.includes(combatant.id))` (no mediante campos inexistentes en `Combatant`).
   - Ciclo transaccional: resolución candidata completa -> evaluación CD 25 de Acrobacias -> re-resolución pura del prefijo confirmado si hubo fallo -> cálculo de AdOs entregando `resolution.totalCostFeet` y tiradas CD 15 locales -> precondiciones -> commit autoritativo -> publicación atómica.
   - Emisión de logs de compresión únicamente ante cambios reales (`wasSqueezing !== isSqueezingNow`); cero logs si el commit es rechazado.
   - Preparación conserva colocación libre; adaptar solo firma natural. Move activo usa eje del último paso del prefijo re-resuelto, nunca destino descartado.
6. **`packages/shared/src/movementContracts.ts`** (nuevo módulo hoja): única definición SqueezingAxis y ConfirmedSpatialTransition discriminada; sin imports/runtime. effects/types, geometría, Resolution/Commit y SpatialTransition usan import type. movementGeometry retira unión local y conserva re-export compatible.
7. **`packages/shared/src/effects/manager.ts`**: copiar eje en safeInstance, validar valor si existe y rechazar campo en otros efectos antes de collision/onStack. Mantener infraestructura genérica; no footprints, tamaño, board, geometría, cardinalidad espacial ni obligación de eje ausente por target.
8. **`packages/shared/src/combatSnapshot.ts`**: copiar eje en cloneEffectInstances para snapshot y clones transaccionales; comprobar aislamiento de referencias y round trip JSON.
9. **`apps/server/src/combat/spatialTransition.ts`**: entrada ConfirmedSpatialTransition y guardas antes de mutar; sin inferencia/revalidación para recuperar eje perdido. Natural limpia; mismo eje preserva estado único válido; eje distinto remove/reinsert candidato antes de publicar para evitar onStack ignore.
10. **`apps/server/src/commands/tacticalCommands.ts`**: Withdraw/Run/Five-Foot Step propagan eje existente en último paso validado; Charge adapta firma natural. Conservar validación, costes, economía, AoO y action semantics vigentes; squeezing solo si legal bajo su pipeline actual.
11. **`apps/server/src/commands/gmCommands.ts`**: teleport adapta firma natural; GM manual squeezing sin evidencia rechaza antes de efectos/logs/publicación. Hazard mantiene rechazo vigente.
12. **`apps/server/src/commands/attackCommands.ts`** y **`apps/server/src/commands/specialManeuverCommands.ts`**: adaptar firma de cinco ramas de AdO y bull rush natural explícito; mantener rollback/avance y forced movement actuales.
13. **`packages/shared/src/index.ts`**: comprobar exposición pública de tipo/evidencia desde autoridad única sin exportaciones ambiguas; preservar re-exports type-only compatibles.
14. **Tests futuros**: `tests/active-effects.test.mjs`, `tests/dt-006-snapshot-integrity.test.mjs`, `tests/movement-commit.test.mjs`, `tests/movement-integration.test.mjs` (nuevo), `tests/regression-tactical-movement.test.mjs`, `tests/withdraw-server.test.mjs`, `tests/run-server.test.mjs`, `tests/gm-apply-effect.test.mjs`, `tests/demo-runner.test.mjs`, `tests/map-builder.test.mjs`, `tests/bull-rush-and-squeezing.test.mjs`, `tests/iterative-attacks-effective-routine.test.mjs`. Casos en §5; ningún test se modifica en R5.
15. **Documentación futura**: NDD canónico, `docs/testing/master-coverage.md`, PROJECT_STATUS, TODO y walkthrough según responsabilidad; sin segundo contrato normativo.

---

## 2. Aislamiento Estricto y Helpers Legacy

- **`packages/shared/src/rules.ts`**:
  - `validateMovePath`, `calculatePathStepCostsFeet`, `calculatePathCostFeet` se mantienen **intactos y sin modificar**. Siguen dando soporte a:
    - `handleWithdraw`
    - `handleRun`
    - `handleFiveFootStep`
    - `chargePreviewPath` y helpers de UI/preview en el cliente.
- **`apps/server/src/combat/spatialTransition.ts`**:
  - Sigue existiendo para preparación y tácticas no migradas. Adaptar evidencia/firma de las 13 invocaciones enumeradas en NDD §8.7.7: 9 natural conservan modo; 4 variables ya tienen eje en pasos validados.
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
   - No regresión: `handleWithdraw`, `handleRun`, `handleCharge`, `handleFiveFootStep` conservan pipelines; solo propagación de evidencia/firma según NDD §8.7.
   - E2E & UI: `node scripts/e2e-websocket.mjs` y `npm run test:ui` 100% verde.


4. **Integración completa del eje y fronteras:**

1. Manager preserva horizontal y vertical exactamente; mutar objeto/arrays originales no altera copia ni eje. remove/removeMany elimina eje y efecto. Efectos ordinarios no adquieren eje; eje en efecto ajeno/invalid axis se rechaza sin mutación, incluso con onStack ignore. Manager no evalúa footprint ni exige eje ausente; effect-only/no orientable axisless permitido.
2. cloneEffectInstances/createCombatRulesSnapshot y round trip JSON preservan eje y copias defensivas. Huella inmediata = huella de siguiente snapshot en ambos ejes y cuando ambos son legales.
3. Move normal crea instancia completa; prefijo tras fallo CD25 usa su último paso confirmado, sin heredar eje del destino descartado. No cambio de matriz R3.
4. Withdraw entra horizontal/vertical mediante validación legacy y conserva coste, economía, AoO y semántica. Run entra solo en caso legal existente y conserva prohibiciones (terreno difícil, línea recta). Five-Foot Step: caso natural y propagación si squeezing es legal; si no, rechazo previo sin ampliar reglas.
5. Cubrir cada fila y rama de las 13 invocaciones: natural no crea eje y limpia previo; Charge/teleport/bull rush/ramas de AdO conservan comportamiento. GM manual squeezing rechazado antes de logs/mutación. Demo genera estado completo.
6. Squeezing → natural elimina instancia/eje; squeezing → squeezing mismo eje conserva orientación; cambio horizontal ↔ vertical reemplaza determinísticamente aun con onStack ignore. Sin duplicados.
7. Stale Commit no cambia posición, eje, efectos, economía, logs ni AdOs; cambio externo del eje invalida fingerprint mediante ocupación. Evidencia ausente/contradictoria rechazada sin mutación.
8. Estado legacy orientable axisless y eje ya ilegal producen error explícito, sin fallback legal[0]/natural; fixtures map-builder migrados preservan comparación exacta y rechazo de rotación. Colocación preparation conserva semántica natural.

9. Spatial commit rechaza squeezing orientable sin eje antes de cualquier mutación; observar room completo sin delegar a manager. Geometry rechaza estado orientable axisless, duplicado o eje ilegal. Fixture effect-only/no orientable axisless permitido solo si no actúa como autoridad espacial orientada.
10. EffectManager copia/valida estructura sin importar geometry/size rules ni consultar board. Typecheck y revisión de imports verifican módulo hoja sin dependencias y ningún ciclo nuevo effects ↔ movement. Una sola definición de SqueezingAxis y re-exports type-only compatibles.

**Secuencia futura:** contrato hoja/copias estructurales → geometría/snapshot → ambos commits → propagación de callers y cierre GM → fixtures/integración/checks. Todos los cambios de código/tests de este plan esperan Proceed; R5 modifica únicamente documentación.

**Migración de fixtures y despliegue:**

Auditoría de fixtures sin eje:

- `tests/map-builder.test.mjs`: seis instancias manuales (398, 452, 501, 582, 640, 689); migrar con el eje explicitado por cada escenario/celdas esperadas. Cuando el test exige preservar compresión vertical, declarar vertical; no agregar horizontal indiscriminadamente.
- `tests/bull-rush-and-squeezing.test.mjs:169` e `tests/iterative-attacks-effective-routine.test.mjs:82`: fixtures manuales de modificadores. Si footprint no orientable, pueden permanecer axisless bajo excepción acotada; migrar a escenario espacial confirmado cuando se use ocupación orientable. No fingir un eje confirmado para una prueba puramente numérica.
- `tests/movement-commit.test.mjs` y casos de entrada/continuidad de bull-rush-and-squeezing generan squeezing vía código: ampliar aserciones de eje y huella, no solo presencia/count.
- `packages/shared/src/demo/catalog.ts:603,616`: explicación y expectativa `hasEffect`, no instancia manual; conservar datos y añadir verificación del estado generado en cobertura futura de demo.

Drenar/recrear salas anteriores con squeezing orientable axisless antes de habilitar contrato. No hay loader persistido en baseline; restauración futura aplica admisión de integridad espacial del NDD §8.7.8. Sin fallback temporal aprobado.

## 6. Ejecución I6 y verificaciones

Plan ejecutado: Move activo integrado; matriz RAW/Tumble aplicada centralmente; eje persistido/copiado y geometría estricta. Callers tácticos conservan pipelines y propagan evidencia; GM/ability/hazard sin evidencia no crean squeezing. Fixtures espaciales migrados conforme a sus celdas; fixture Disabled ahora identifica turno activo.

Ajuste técnico necesario: AdO recibe opcionalmente huellas confirmadas, y sus orígenes hipotéticos usan vista local espacial coherente. Esto evita aplicar eje inicial a un destino/paso donde ya no es legal. Sin cambio de reglas de provocación, coste legacy, exenciones ni CD15. Preparación/teleport validan candidato natural explícito. Aclaración en NDD §8.4; no se modificaron validateMovePath/calculatePathStepCostsFeet/calculatePathCostFeet.

Las pruebas de integración/regresión planeadas se distribuyeron en movement-integration, squeezing-axis-integration y suites tácticas existentes; no se creó un segundo archivo de regresiones redundante. DoD: 746/746 suite completa, 188/188 focalizadas, typecheck/build de tres workspaces, 110/110 WebSocket, 16/16 Playwright. CI remoto se comprueba tras push; aprobación arquitectónica no autoemitida.
