# Implementation Plan — D-1B-I7: Normative Movement Preview Parity

Responsabilidad: tareas ejecutables para migrar exclusivamente el preview cliente de Move ordinario activo.
Autoridad: Derivada del [NDD D-1B, Capítulo 9](docs/designs/normative-movement-design.md#capítulo-9--i7-normative-movement-preview-parity).
Lifecycle: Temporal.
Reemplaza: — (plan I6 ejecutado permanece en [movement/implementation-plan](docs/designs/movement/implementation-plan.md)).
Complementa: [Estado](PROJECT_STATUS.md), [pendientes](TODO.md), [registro de auditoría](walkthrough.md).
Consumidores: Architecture Reviewer y desarrolladores/agentes tras Proceed explícito.

**ESTADO:** DISEÑO ÚNICAMENTE. Awaiting Architecture Review and Proceed.
Baseline de código auditado: `650f22dd514fac56b033acb6e937b3aabe5cdc3d`, I6 técnicamente aprobado por Review externa.
Entrega actual: documentación/auditoría, sin código/tests. Implementación futura seleccionada: Nivel B, APIs shared existentes; si requiere cambiar shared/protocolo/server, detener expansión y reclasificar C/D antes de Proceed para ese alcance.

## 1. Archivos y responsabilidades futuras

| Archivo | Cambio previsto | Frontera |
|---|---|---|
| `apps/web/src/movementPreview.ts` (nuevo) | Adapter puro a resolveMovementPipeline; empty/legal/over-budget/illegal/unavailable; evidencia/costes/context/budget; anotación CD25 desde intersecciones de footprints | Sin fórmulas RAW, Commit, RNG, efectos nuevos ni mutación de Room |
| `apps/web/src/hooks/useBoardSelection.ts` | previewKind antes de resolver; memoizar ordinary current draft y candidatos adyacentes; una proyección para Board/panel; branching legacy explícito | Dos llamadas de coste legacy quedan solo para caminos no ordinarios; evitar coste corriente ordinary por legacy |
| `apps/web/src/viewModel.ts` | Dejar de usar isLegalNextPathStep/getHighlightedCells/destination reprojection para ordinary; conservar funciones para tácticas/placement; quitar imports verdaderamente no usados | No cambiar legacy factores/cálculos Charge/Withdraw/Run/spell/GM por migración accidental |
| `apps/web/src/App.tsx` | Estado isAcrobatic local y origen 5ft local; propagation/recomputation; ordinary draft authoring/candidate statuses, alturas de grid preservadas; Intent con boolean existente | No setRoom/optimistic position/effects/budget/context; canControlSelected y guards locales no dan autoridad |
| `apps/web/src/components/ActionsPanel/ActionsPanel.tsx` | Total/saldo/status desde projection; toggle Tumble; CD25 contingente; selector local preview 5ft; gating confirm ordinary separado | Run/Withdraw/5ft conservan disponibilidad y comandos actuales; conservar Charge/spell calls legacy |
| `apps/web/src/components/Board/presentationModel.ts` | Recibir source/projection; ordinary pinta step occupiedCells, footprint final ghost, estado/error/exceso y etiquetas acumuladas | No llamar resolver/assess/calculate para coste; no reanclar combatiente para huella de ruta ordinary |
| `apps/web/src/components/Board/Board.tsx` | Props de proyección presentacional y semántica común 2D/2.5D | Token publicado no se mueve por preview; cámara sin reglas |
| `apps/web/src/components/Board/renderer/TacticalScene3D.tsx` | Consumir celdas/markers/status del mismo presentation; mantener hit testing y fallback | No coste, validación ni eje inferido visualmente |
| `apps/web/src/styles.css` | Distinción accesible de legal/exceso/illegal/contingente y ghost footprint | Presentación proporcional, sin rediseño estético completo |
| `tests/movement-preview.test.mjs` (nuevo) | Adapter/paridad/pureza/status y proyección comparada con resolver de servidor | Pruebas de comportamiento, sin segunda fórmula de referencia |
| `tests/board-presentation-25d.test.mjs` | Evidencia común de cells/axis/cost/status en ambos modos/cámara, separación tactical/placement | No alterar reglas ni fixtures para fingir legalidad |
| `tests-ui/movement-preview.spec.ts` (nuevo) | Edición ordinary/over-budget/illegal/Tumble/CD25; payload; cliente/servidor y staleness | Usar protocolos existentes y fixtures deterministas de test |
| `tests-ui/smoke.spec.ts`, `tests-ui/demo.spec.ts`, `tests-ui/map-builder.spec.ts` | Regresión; extender solo si escenarios relevantes no están ya cubiertos | D-5/demo/acciones tácticas siguen comportamiento previo |
| Documentación al implementar | NDD solo aclaraciones factuales; master-coverage/PROJECT_STATUS/TODO/walkthrough, lifecycle del plan/INDEX | No otro contrato normativo ni estado de tests ficticio |

**Sin cambios previstos**: packages/shared/src (incluidos movementResolution, movementCost, movementGeometry, contracts, rules, schemas), apps/server, useWebSocketRoom, useCombatActions, perfiles, comandos/protocolo, .claude/settings.local.json. No borrar helpers shared legacy: siguen teniendo consumidores tácticos y de rango de conjuro.

## 2. Secuencia de implementación después de Proceed

1. Verificar baseline/estado y Reader Pipeline, sin sobrescribir archivos unrelated. Releer NDD §9.2 para ubicar callers reales; no asumir que auditoría histórica describe un HEAD posterior.
2. Adapter puro ordinary: snapshot único de Room recibido, actor de misma revisión, path copiado xyz, contexto copiado del contador actual, budget derivado por Rules.totalSpeedFeet − movementUsedFeet (clamp cero), isAcrobatic intención. Llamar resolver existente directamente; conservar fingerprint privado sin usarlo como autoridad ni enviarlo. Empty sin resolución; actor distinto del currentTurn ordinary, inputs ausentes o errores de integridad unavailable sin fallback.
3. Estados discriminados y evidencia completa: ready→legal; insufficient-budget→over-budget con ruta completa y saldo firmado; illegal-route→illegal solo reason/failedStepIndex y draft; no coste/prefix/huella inventados. Probar adapter antes de conectarlo a UI.
4. Separar previewKind ordinary/placement/GM/Withdraw/Run/5ft/Charge/forced/none. Añadir selector de intención visual 5ft porque hoy comparte draft con ordinary; su branch sigue usando helpers/availability y comando legacy. Armar Withdraw/Run/5ft desactiva Tumble ordinary y limpia draft; no migrar economía.
5. Hook: una resolución memoizada de draft por Room/actor/path/isAcrobatic/previewKind y hasta ocho resoluciones de extensiones adyacentes. Reutilizar snapshot; no recalcular por renderer ni cada celda del tablero. Guardas de acción/control separadas de status geométrico; preservar bloqueo I6 full/standard no consumido, usedMoveAction/usedFiveFootStep, phase, pendientes, demo y D-5.
6. Autoría: ordinary deja de filtrar exclusivamente verde/token enemigo. Candidatos muestran status; over-budget o illegal pueden editarse como draft corregible, nunca habilitan Confirmar. Ruta Tumble provisional que acaba en enemigo permanece illegal hasta añadir salida libre; no inventar permiso normativo para endpoint ocupado. Undo/Clear siempre disponibles. No pathfinding/rango nuevo ni recorte por presupuesto. Click grid ordinary conserva altura del actor.
7. Board/presentation/panel: pasos y axis desde shared; ghost final solo preview; token actual/persisted axis unchanged. Route labels acumulados (baseline usa valores acumulados pese al nombre stepCost); tooltip individual explícito si se muestra. Total/saldo/context no se recalculan en JSX. Illegal no tiene costes/context evaluados. Background terrain sigue presentacional y no vuelve a determinar coste.
8. Tumble/CD25: boolean local default false; anotación por intersección de footprints shared y evidencia por step con filtros de vida de I6; sin RNG ni AoO pipeline nuevo. Mostrar contingencia/interrupción potencial. ActionsPanel conserva pendientes autoritativos existentes; no overlay «seguro» inventado por Tumble.
9. Intent ordinario existente: to último step, path íntegro, isAcrobatic. No cost/remainingBudget/spatialMode/axis/context/fingerprint de cliente. WebSocket no cambia. Room actualizado solo por servidor; mismo actor room-update recompone preview, turno/actor nuevo limpia overlay como hoy. Rechazo muestra error; no retry/success optimista.
10. Gates completos y regresión; registrar conteos reales. Tras implementación verificada, reubicar/fusionar plan según gobernanza sin duplicar activo; actualizar links/INDEX y esperar Review externa.

## 3. Verificación futura obligatoria

| Grupo | Casos y oracle |
|---|---|
| Paridad predictiva | Adapter frente a resolveMovementPipeline del mismo snapshot/path/actor/budget/context/isAcrobatic. Steps/occupiedCells xyz, costes, status, projectedContext iguales. No comparar contra matemática React ni fabricar Resolution |
| Coste/contexto | Casos §8.3.2; normal ortho/diag; inicial !=0; DT fijo; Tumble normal; squeezing/eje; fuentes dobles/triples; normal→hampered→normal. Si geometría no admite diagonal squeezing, oracle es illegal de resolver, matriz numérica cubierta por assessment shared existente |
| Presupuesto | Exacto→legal, exceso→over-budget con steps completos, saldo firmado y exceso explícito. Budget ya gastado y cero disponible. Ningún prefijo aceptado silenciosamente |
| Pureza | Deep-freeze Room/snapshot/actor/path/contador cuando sea compatible; ejecutar preview repetido, editar/cancelar/toggle/cámara; comprobar igualdad e identidad autoritativas sin gastar ni modificar axis/efectos/posición/stats. Clone defensivo de snapshot conserva axis |
| Espacial | Inicial horizontal/vertical persistido, giro, ambigüedad ambos ejes legales, salida natural; ghost/step celdas desde resolución. Axisless/duplicado/eje inválido orientable→unavailable, sin fallback |
| Illegal/draft | Obstáculo/ocupación/bounds/repetición, failedStepIndex, no total inventado; endpoint enemigo Tumble provisional→illegal y siguiente salida→legal si shared lo permite. Undo/Clear corrige; ruta stale se muestra sin truncar |
| Tumble | Toggle coste/capability; checkbox y payload del mismo boolean; CD25 indicador por huella enemiga, exclusión dead/dying/stable; no consumo Math.random ni uso useCombatActions. Sin resultados CD15/CD25 ni seguridad AoO ficticios |
| Presentación | Misma proyección Board/ActionsPanel y 2D/2.5D/cuatro cámaras; coste acumulado frente a individual; total/saldo; exceso distinto de illegal también por texto. Altura xyz preservada en Intent/celdas, sin movimiento vertical cosmético |
| Separación | Placement sin pipeline/coste, GM/demo/D-5 sin mutación; draftBoard no input normativo; toggles 5ft/Withdraw/Run y Charge/forced/spell siguen legacy. Confirmación táctica no depende de ready/guards ordinary |
| Payload/stale | Capturar WebSocket saliente: tipo/ids/to/path/isAcrobatic únicamente; ausencia cost/axis/context/fingerprint. Snapshot N→N+1 recompone; no locking. Servidor siempre evalúa estado nuevo aunque intent se retrase |
| E2E | Ruta DT de dos diagonales preview 30 y server gasto30 cuando unchanged; normal con contador !=0; Tumble usando fixtures de tiradas servidor para contingencia. Con segundo participante/GM cambiar estado entre dibujo y ejecución; interceptar/demorar envío de Intent si hace falta para controlar la carrera y verificar rechazo/resolución servidor, nunca confiar en valor cliente |
| Regresión | Tests de servidor I6 y tácticas actuales, D-5/map-builder, demo/renderer/smoke y estado/ownership. Toda la suite vigente verde; no usar conteo histórico como meta |

Gates tras código futuro: pruebas focalizadas de preview/presentation y suites servidor/movement, `npm test`, `npm run typecheck`, `npm run build`, `node scripts/e2e-websocket.mjs`, `npm run test:ui`; GitHub Actions Windows observado tras push. En esta entrega documental: diff check, links, SSOT, auditoría real y scope solo Markdown; no CI técnico requerido.

## 4. Riesgos y límites cerrados

- Illegal-route no trae steps evaluados: UI no inventa costes/prefijo. Datos corruptos van a unavailable, no una orientación por defecto.
- Endpoint enemigo y shared draft 5ft requieren cambios de autoría/presentación, definidos en §9.6; no ampliar reglas/tactical pipeline.
- El fingerprint del resolver incrementa trabajo por candidato: máximo ocho extensiones, memo y snapshot único; no introducir extracción shared/endpoint por optimización prematura. Medir durante implementación; una necesidad objetiva de modificar contracts exige reclasificación.
- GM/D-5/Charge/spell helpers legacy no se eliminan para «limpiar» callers; spell range basado en Movement Cost y AoO predictivo son follow-ups separados. No queda ODR bloqueante de I7.
- Paridad cliente-servidor presupone mismos inputs; cambios de estado/dados pueden variar resultado autoritativo. UI anuncia predicción y contingencia.
