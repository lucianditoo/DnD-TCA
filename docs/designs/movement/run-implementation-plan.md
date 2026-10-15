# D-1B-I10 — Plan ejecutado de Run servidor normativo

Canonical responsibility: Referencia de la secuencia aprobada y ejecutada de integración I10 servidor.
Supersedes: —; no reemplaza planes ejecutados I6/I7/I8/I9.
Complements: [NDD Movement Capítulo 12](../normative-movement-design.md#capítulo-12--i10-run-server-normative-integration), [Run](../run-design.md).
Derived from: Auditoría sobre 9b8f8dd58bba9b79d18bcd3fcdf38dc97708e3a8 y .agents/AGENTS.md Fase 3.
Lifecycle: Referencia de implementación ejecutada; no es un plan activo. Ready for Architecture Review externa. No se requiere un nuevo Proceed.

## Gate y frontera

IMPLEMENTACIÓN Y DoD LOCAL COMPLETADOS. Diseño técnicamente aprobado y Proceed explícito del owner sobre 4c2aeccd4c52915176084005c1aa0bbd08924b79. Las instrucciones futuras siguientes conservan el plan aprobado como referencia histórica de ejecución. Implementación Nivel C: caller servidor sobre APIs shared existentes; D si requiere infraestructura/contratos. Este plan operacionaliza decisiones de §12, sin copiar RAW ni convertir el cierre documental en autorización.

Permitidos tras Proceed: `apps/server/src/commands/tacticalCommands.ts` (rama handleRun y ajuste mínimo de imports), `tests/run-server.test.mjs`, `tests/run.test.mjs` si falta cobertura de helpers, `scripts/e2e-websocket.mjs` para escenarios reales Run, documentación afectada por evidencia. Conservar shared, apps/web, schemas/wire y consumidores ajenos. No .claude/settings.local.json ni test.txt. No cambios preventivos en EffectManager, resolver, Commit, spatialTransition ni extracción de framework. Si la auditoría de implementación prueba bloqueo, detener y reportar/reclasificar.

## Secuencia de implementación futura

1. Verificar checkout limpio/baseline publicado, Reader Pipeline y aprobación. Revalidar contratos auditados; no asumir que este diseño autoriza ampliaciones posteriores.
2. Completar fixture Run con normalDiagonalStepsThisTurn real. Registrar casos discriminantes de §12.10 antes de cambiar expectativas legacy. Conservar tests existentes de reglas/ownership/schema.
3. En handleRun mantener guards y encontrar actor snapshot por id. Copiar turno/ronda/origen xyz/gasto/contexto. Construir ruta exclusivamente con buildStraightPath y budget con runSpeedBudgetFeet. Resolver con isAcrobatic false y contador real.
4. Aplicar orden cerrado illegal-route → insufficient-budget → DT sobre steps ocupados → V1 sobre steps. No reanclar ni fallback. Asegurar rechazo de integridad espacial antes de cualquier escritura.
5. Preparar oportunidades usando totalCostFeet/steps, false y sin exención; capturar modo previo y buffers. Preparar intent de exposición según feat, source/target/duration/sequence actuales. Ejecutar add puro como preflight y descartar resultado, antes de Commit; no mutar room ni conservar colección precalculada.
6. Invocar commitMovementResolution con actor canónico vivo y precondiciones capturadas. Si rejected, descartar buffers y lanzar error sin publicar. Sin duplicar escritura de posición/efecto squeezing/stats/gasto/contexto.
7. Solo tras committed, marcar usedFullAttack. Aplicar exposición mediante add sobre room vigente y asignar únicamente effectInstances devuelto; nunca copiar preflight room. Publicar logs/pending conforme §12.6, broadcast una vez. No esfuerzo Disabled, syncEncounterPhase, nueva economía o predictor AdO.
8. Retirar únicamente usos legacy de handleRun (validateMovePath, spatialTransition, distancia/sumas/reanclado). Conservar helpers/imports cuando otras ramas los necesiten; straight path y budget permanecen. No modificar preview legacy-run.
9. Ejecutar integración focalizada real y regresiones shared/Withdraw; agregar E2E real descrito abajo. Investigar fallos sin alterar contratos para satisfacer fixtures.
10. Ejecutar gates, actualizar evidencia real y snapshots, reubicar este plan como referencia ejecutada en `docs/designs/movement/run-implementation-plan.md`, actualizar enlaces entrantes y eliminar root tras comprobar migración. No dejar dos planes activos ni Awaiting Proceed vigente para una implementación ya ejecutada.
11. Un commit de implementación tras DoD, push origin/master sin force y comprobar Windows CI del SHA. Ready for Architecture Review externa, sin autoaprobación.

## Verificación futura

Matriz completa obligatoria: [§12.10](../normative-movement-design.md#1210-diseño-de-pruebas-y-evidencia-ejecutada). Cubrir exacto/exceso ×4/×3 y speed; straight xyz; contexto inicial no cero; DT no-ancla y precedencia doble; transiciones/ejes/corrupción; gasto/base; V1 estados/alturas; AdO inicial/posterior/múltiples; guards/economía; efecto/dote/tick; stale y ausencia de publicación parcial.

Pruebas de atomicidad discriminantes: fallo preflight antes de Commit sin cambios; stale inyectado en callback de consulta como I8 descarta buffers y conserva estado inmediatamente anterior a Commit; segundo add conserva squeezing/eje/posición/stats/contexto recién confirmados. No afirmar que un mock de excepción arbitraria postcommit pruebe rollback inexistente. No nuevo hook productivo ni suite shared duplicada.

E2E WebSocket contra servidor real: ×4 (posición/gasto/fullround), heavy ×3, dos diagonales (15/contexto2), DT sin mutación, origen amenazado con pending, exposición sin feat/ausente con feat, invalid/turn/actor sin éxito parcial. Stale intermedio queda en integración controlada: no simular concurrencia mediante comandos seriales y llamarla cobertura real.

Gates de implementación futura: `npm test`, `npm run typecheck`, `npm run build`, `node scripts/e2e-websocket.mjs`, `git diff --check`; UI solo si corresponde por regresión demostrada, sin usarlo como permiso para migrar web. Actualizar master-coverage únicamente con resultados realmente ejecutados entonces. Revisar enlaces/SSOT/Registry y ausencia de cambios fuera de alcance.

## Riesgos y aceptación

Presupuesto no residual ni doble penalización armadura; errores DT/budget ordenados; costos normativos separados de stats; actor snapshot vs referencia viva; persistencia squeezing preservada por add posterior; no fingerprint que aparente autorizar Run. Mantener tramo síncrono y catálogo estático. Si aparece await/reentrada/efecto dependiente de posición tras Commit, revisar §12.7–12.8 antes de ejecutar; no extender fingerprint o transacción por conveniencia.

D-2/DT-018 y D-4/DT-019 permanecen diferidas. D-7, 5ft, Charge, metadata global AdO y Run preview (I11 recomendado) fuera del sprint. No nuevas ODR bloqueantes de diseño. Este plan fue ejecutado. Gates locales completos verdes; evidencia en [master-coverage](../../testing/master-coverage.md). IMPLEMENTACIÓN COMPLETADA; Ready for Architecture Review externa. No se requiere un nuevo Proceed.
