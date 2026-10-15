# Walkthrough — D-1B-I10 Run Server Integration

Canonical responsibility: Cambios y evidencia del cierre de implementación I10.
Supersedes: Walkthrough I10 Design, preservado en Git.
Complements: [NDD Capítulo 12](docs/designs/normative-movement-design.md#capítulo-12--i10-run-server-normative-integration), [plan ejecutado](docs/designs/movement/run-implementation-plan.md), [coverage](docs/testing/master-coverage.md).
Derived from: Diseño aprobado y Proceed explícito del owner sobre 4c2aeccd4c52915176084005c1aa0bbd08924b79.
Lifecycle: Rotativo; implementación completada, Ready for Architecture Review externa.

## Resultado

Baseline limpio master/origin/master aprobado; Nivel C, sin nuevo Proceed. Se modificó únicamente handleRun en producción. Snapshot actor para construir ruta recta, budget efectivo ×4/×3 y Resolution; actor canónico vivo para Commit. Captura contexto real sin default, origen xyz, turno y gasto del snapshot. Como CombatRulesSnapshot no contiene round, captura room.round antes de resolver, siguiendo I8 sin ampliar contrato.

Preserva guards/canRun/ownership/wire. Errores en orden illegal→budget→DT→V1; steps confirmados para policies, sin reanclado ni fallback. AdO recibe coste total y evidencia de steps, sin exención ni cambio de metadata/early return global. Commit es única autoridad de posición/squeezing/eje/gasto/stats base/contexto. Después: usedFullAttack, efecto, logs/pending y broadcast único. No flags redundantes, esfuerzo Disabled ni syncEncounterPhase.

Efecto: intent desde snapshot feat; preflight add puro descartado antes de Commit. Segundo add contra room vigente y asignación solo de effectInstances preserva la transición espacial. Stacking ignore conserva instancia/duración y status log histórico; con srd_run no hay exposición/status. Garantía síncrona sin await ni extensión fingerprint. No rollback genérico ni excepciones tragadas.

## Verificación real

| Gate | Resultado |
|---|---|
| Run servidor/puro + Movement Resolution/Commit focalizados | 168/168 |
| npm test, incluido fixture puro normalizado final | 981/981 |
| npm run typecheck | Verde, tres workspaces |
| npm run build | Verde, tres workspaces |
| node scripts/e2e-websocket.mjs | 134/134 |
| npm run test:ui | 33/33 |
| git diff --check y enlaces/anchors | Verificados antes del commit |

Se conservan históricos R1..R18; 74 casos Run nuevos y 14 checks WebSocket nuevos. Oracle shared para coste/contexto/huellas, expectativas independientes de policy; handler real y room completo/broadcast verificados en rechazos. Stale inyecta mutaciones externas mediante consulta AdO con mocks acotados a t.mock y compara contra estado inmediatamente anterior al Commit, sin revertir mutación ajena. Preflight fallido no escribe movimiento/economía/efecto/logs/pending; éxito con squeezing demuestra conservación tras segundo add.

Dos fixtures exploratorios se corrigieron contra autoridad real, sin tocar reglas: Blinded sí declara FORBID_RUN (rate proyectada se comprueba pero Run rechaza); Large diagonal narrow está prohibida por geometría existente (se prueba rechazo atómico, no aceptación artificial). Coste genérico hampered 15/base5 no implica ruta Run legal. Buff heavy aceptado demuestra 20+10, luego ×3=90 sin doble reducción. Diagonal normal contexto0→dos pasos15 y contexto1→un paso10 se ejecutan realmente.

UI necesitó ejecución con permisos de servidores locales/Chromium tras cancelar arranque sandbox sin puertos disponibles. Un intento diagnóstico de node sobre dist sin loader no resuelve exports TS shared; se usó arranque tsx existente, sin cambiar infraestructura. WebSocket corrió separado de UI contra servidor real y se detuvo el proceso propio al finalizar. Build mantiene advertencia preexistente de bundle >500 kB. Ninguna modificación a demo, renderer ni tests UI.

## Fronteras y documentación

packages/shared, apps/web, schemas/protocolo, otros handlers, .claude/settings.local.json y test.txt intactos. Helpers legacy permanecen usados por 5ft/Charge. Run preview sigue legacy-run; I11 recomendado separado, D-7 y otras migraciones fuera. No se implementa resistencia/visión ni se cierra DT-018/DT-019. Registry mantiene estado MOVE-RUN: no se amplía cobertura RAW ni se cambia Rule ID; evidencia detallada actual en master-coverage, sin modificar catálogos/checklists por una integración de caller.

Plan raíz migrado a docs/designs/movement/run-implementation-plan.md tras gates verdes; enlaces entrantes corregidos y root eliminado, referencia ejecutada sin estado activo Awaiting Proceed. NDD Capítulo 12 conserva auditoría del baseline y contrato aprobado, agrega cierre/precisiones reales; snapshots y localizador sincronizados. Enlaces/anchors, responsabilidades y alcance se verifican antes del commit único/push origin/master. Windows CI se comprueba después del push sobre head_sha exacto. Implementación pendiente únicamente de Architecture Review externa; no autoaprobada.
