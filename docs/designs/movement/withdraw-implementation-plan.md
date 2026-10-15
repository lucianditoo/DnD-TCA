# Implementation Plan — Withdraw Server Normative Movement Integration (seleccionado por D-1B-I8)

Responsabilidad: referencia del plan aprobado y ejecutado de la migración de Withdraw servidor.
Autoridad: derivada del [NDD D-1B §10.5](../normative-movement-design.md#105-diseño-completo-del-consumidor-seleccionado--withdraw-servidor); reglas propias en [Withdraw Rev. 3](../withdraw/design.md).
Lifecycle: Referencia de implementación ejecutada; no es un plan activo.
Reemplaza: ningún plan de implementación original de Withdraw; ese plan registra su entrega previa, no esta migración.
Complementa: [estado](../../../PROJECT_STATUS.md), [pendientes](../../../TODO.md), [walkthrough](../../../walkthrough.md).
Consumidores: Architecture Reviewer y desarrolladores/agentes que consultan la implementación ejecutada.

**IMPLEMENTACIÓN Y DoD LOCAL COMPLETADOS; READY FOR ARCHITECTURE REVIEW EXTERNA.** Diseño técnicamente aprobado y Proceed explícito sobre `61c7e96c0e084b0fb64c960cd3ee60e4444f9650`. Nivel C, sin cambios shared/web/protocolo. El plan aprobado conservado abajo documenta tareas originales y no autoriza migraciones adicionales. Evidencia final en walkthrough/master-coverage; Windows CI se observa tras el push.

## 1. Alcance y archivos

| Archivo futuro | Cambio acotado |
|---|---|
| apps/server/src/commands/tacticalCommands.ts | Solo handleWithdraw/imports necesarios: guards existentes, resolver común, regla de ocupación V1, buffer AdO/logs, Commit y publicación posterior. No refactorizar las otras ramas. |
| tests/withdraw-server.test.mjs | Fixtures con contexto explícito y pruebas de paridad/contabilidad, guards, ocupación, squeezing, stale, no mutación/broadcast parcial y Disabled. |
| tests/withdraw.test.mjs | Conservar W-S1…W-S9; ampliar únicamente evidencia de huellas confirmadas del seleccionado si falta cobertura. |
| tests/movement-integration.test.mjs | Solo si reutilizar su harness permite verificar rechazo de Commit/buffers en Withdraw sin API productiva; alternativa: misma prueba en withdraw-server. No pruebas espejo. |
| scripts/e2e-websocket.mjs | Escenarios Withdraw real con aceptación/rechazo, contexto/coste y exención; conservar todas las aserciones existentes. |
| Documentación de cierre | Estado/TODO/walkthrough/master-coverage/INDEX y referencia de ejecución; aclaraciones factuales en NDD, sin otra autoridad ni nuevas reglas. |

**Fuera de scope:** packages/shared/src entero (incluidos Resolution/Cost/Geometry/Commit/rules/effects/types/schemas), apps/web, useWebSocketRoom/protocolo, Move I6, I7, Run, Five-Foot Step, Charge, forced/GM/preparation, range spells, economía nueva/D-7, .claude/settings.local.json y archivos unrelated. ST/helper AdO permanecen sin modificaciones globales. Si se necesita cambiar estos límites, detener ejecución y obtener nueva Review/Proceed, no inventar un bridge de coste ni modificar una Resolution.

## 2. Secuencia después de Proceed

1. Reader Pipeline y precondition gate; verificar HEAD/sincronía y auditar otra vez caller real si el baseline cambió. No sobrescribir cambios ajenos. Leer NDD §10.5 y Withdraw §4/§5/§8; conservar semántica vigente del consumidor.
2. Preparar casos significativos en withdraw-server: TurnState explícito con normalDiagonalStepsThisTurn, budgets exacto/exceso ×2/×1, coste/contexto y distancia base comparados con ready del resolver. No introducir default cero en producción para fixtures incompletos.
3. Conservar guards de dispatch y handleWithdraw antes de toda mutación. Capturar snapshotActor y liveActor separadamente, origen xyz, ronda, turno, gasto y contexto. Resolver ruta completa copiada (path no vacío o [to]), isAcrobatic=false y budget local speed efectiva ×2/×1, con contexto real. No reutilizar cálculo de budget Move ordinario.
4. Traducir illegal-route/insufficient-budget a error por canal vigente, sin prefijo/reintento/log/pendiente/mutación. Solo ready pasa al resto; no fabricar fingerprint ni recomputar coste manualmente.
5. Preservar ocupación V1 extra desde resolution.steps[].occupiedCells: tránsito enemigo no-dead bloqueado, destino cualquier no-dead bloqueado, dead excepción vigente. Conservar protección helpless que es más estricta que Route Validation común; no moverla al core.
6. Construir exención de huella inicial desde snapshot. Obtener AdO con helper actual, resolution.totalCostFeet y resolution.steps, false y exención completa. Bufferizar logs/pendientes sin publicarlos. Mantener semántica existente del helper y su metadata local (§10.2), sin usarla para budget ni cambiar todas las acciones.
7. Llamar commitMovementResolution con preconditions y liveActor; no await ni mutaciones entre guards/Resolve/Commit. Rejected descarta buffers y lanza reason. Si se introduce una ventana temporal, reautorizar economía antes del Commit además de las comprobaciones de vigencia.
8. Retirar de esta rama validateMovePath, commitSpatialTransition y sumas manuales de gasto/stats. Commit escribe posición/squeezing/eje/contexto, totalCostFeet a gasto y totalBaseRouteCostFeet a stats. No compensar ni duplicar escrituras. Guardar modo inicial únicamente para logs.
9. Tras committed, normal marca usedFullAttack; limitada usedStandardAction. Publicar buffers locales, log de coste total y cambios de modo; conservar esfuerzo Disabled/logStatusChange/checkCombatOutcome como hoy. Broadcast una sola vez al final, con estado coherente. AdO manuales siguen posteriores al desplazamiento completo; sin rollback ni cambio de protocolo.
10. Mantener preview legacy-withdraw y su divergencia conocida; no tocar UI, ni añadir un segundo resolver. Ejecutar regresiones completas y gates; registrar conteos reales/CI sin autoaprobar. Reubicar el plan a referencia de ejecución conforme a gobernanza, sin sobrescribir docs/designs/withdraw/implementation-plan.md original ni dejar plan activo duplicado; destino sugerido docs/designs/movement/withdraw-implementation-plan.md, actualizado en INDEX.

## 3. Validación y aceptación

La matriz canónica de pruebas de esta integración es [NDD §10.6](../normative-movement-design.md#106-verificación-futura-y-fronteras-de-regresión). Demostrar:

- Guards y políticas Withdraw existentes equivalentes: turno virgen, ×2/×1, ocupación V1, economía mínima, esfuerzo y exención inicial completa; cero mutación/publicación de éxito ante rechazo.
- Diferencias intencionales del engine: coste normativo DT/stacking, contador real y stats base I6. No exigir igualdad al legacy donde precisamente se elimina su divergencia.
- Eje H/V persistido, transición/salida/corrupción, xyz y huellas confirmadas; Commit único y buffers descartados cuando no se confirma.
- AdO posterior y full-route conservados, metadata/early return del helper intactos; no claiming de CD15/CD25 ni AoO predictivo.
- Servidor real E2E y suites de Move I6, I7, 5ft, Run, Charge/opportunity-phase, D-5/demo. W26/W27 no sustituye una prueba Charge real.

Gates futuros obligatorios: `npm test`, `npm run typecheck`, `npm run build`, `node scripts/e2e-websocket.mjs`, `npm run test:ui`; commit único de implementación, push origin/master y Windows CI observado. I8 Design no ejecuta gates técnicos ni altera cobertura histórica.

## 4. Riesgos, alternativas y decisiones cerradas

- 5ft primero descartado por excepción no expresada; Run segundo por mayor superficie de postura/dote; Charge pospuesto por selector/ataque. Este plan no implementa ninguno de ellos.
- No crear Budget Policy shared: número local basta. No crear WithdrawMovementResolver ni reutilizar validateMovePath como fuente de coste auxiliar.
- No segunda autoridad espacial: usar steps/Commit; no fallback de eje ni reanclado del actor para reconstruir footprints.
- No nueva economía: usedFullAttack sigue marcador full-round; Double Move/múltiples Routes/fragmentación/Spring Attack quedan en D-7.
- Preview separado: puede discrepar con coste normativo hasta migración posterior; servidor decide. No constituye ODR de este caller.
- Rollback operativo: revertir el commit de migración; sin migración de datos/protocolo. No se diseña rollback por daño/AdO después de una ruta ya comprometida.

**Cero ODR bloqueantes para Withdraw servidor. IMPLEMENTACIÓN COMPLETADA; Ready for Architecture Review externa. No se requiere un nuevo Proceed.**
