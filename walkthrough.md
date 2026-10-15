# Walkthrough — D-1B-I9 Withdraw Normative Preview Integration

Responsabilidad: evidencia de implementación, gates y límites de I9.
Autoridad: registro; [NDD Capítulo 11](docs/designs/normative-movement-design.md#capítulo-11--i9-withdraw-normative-preview-parity), reglas propias en [Withdraw Rev. 3](docs/designs/withdraw/design.md).
Lifecycle: Rotativo.
Reemplaza: walkthrough I9 Design, conservado en Git.
Complementa: [plan ejecutado](docs/designs/normative-movement-design.md#118-plan-de-implementación-ejecutado--referencia-i9), [estado](PROJECT_STATUS.md), [pendientes](TODO.md), [coverage](docs/testing/master-coverage.md).
Consumidores: Architecture Reviewer y agentes que consultan la implementación publicada.

## Resultado y alcance

Baseline limpio master/origin/master `041bee05f6f4a5aa571dea778827eb51cbccbdb0`; diseño técnicamente aprobado y Proceed explícito del owner, Nivel B. Implementación exclusivamente apps/web, tests de preview/paridad y UI, documentación de cierre. packages/shared, apps/server, schemas/protocolo, scripts/e2e-websocket.mjs y .claude/settings.local.json permanecen intactos; ningún unrelated incorporado.

buildWithdrawMovementPreview y buildWithdrawCandidates son wrappers explícitos, sin opción isAcrobatic. Reutilizan mapper de Resolution y enumerador privado de vecinos, sin framework de acciones. Ordinary conserva budget/Tumble/CD25. Withdraw obtiene límite ×2/×1 por gates Disabled shared (también Diehard), contador diagonal real y false fijo; copia xyz/draft y valida estado espacial también vacío. Una evaluación del draft y hasta ocho extensiones, memoizadas sobre snapshot actual, sin scan/BFS/pathfinding.

Policy V1 privada después de ready: intersecciones entre occupiedCells de steps y huellas shared de otros, primer blocker y reasonSource. Illegal/movement vs withdraw-policy no inventa coste/pasos/contexto; insufficient-budget conserva ruta completa y no ejecuta V1, según precedencia I8. No Commit, RNG, logs, efectos ni autoridad cliente. Disponibilidad separada consume guards shared y economía real; gasto previo mantiene evaluación hipotética con límite completo, sin residual ni confundir bloqueo con ilegalidad de ruta.

Hook/panel/Board consumen la misma proyección. App permite editar candidatos legales/excedidos/ilegales, preserva altura, elimina bloqueo por token/reanclado de destino para Withdraw y protege su primera rama de confirmación antes del envío. Payload exacto de intención copiada, sin coste/budget/axis/contexto/status/fingerprint/isAcrobatic. No optimismo ni retry. Textos normal full-round ×2 vs limitada estándar ×1, esfuerzo solo servidor y exención inicial completa sin predictor AdO; Tumble/CD25 ocultos en Withdraw.

El kind withdraw reemplaza solo legacy-withdraw. Se retiran del flujo Withdraw los costes/rango/validator legacy y turnVirgin local; helpers siguen para Run/5ft/Charge/spells/GM/preparation. PresentationModel comparte evidencia con ambos renderers; solo se aclara su nombre interno de proyección normativa, sin geometría nueva ni cambios en TacticalScene3D/Board. Token y eje publicados no se alteran hasta room-update. Reset local por actor/ronda cubre turno nuevo del mismo actor (el callback WebSocket existente solo detecta cambios de actor); actualizaciones del mismo actor/turno no borran draft.

## Verificación

| Gate | Resultado local |
|---|---|
| npm test | 907/907 |
| Preview ordinary + Withdraw/paridad focalizados | 99/99 |
| npm run typecheck | Verde, tres workspaces |
| npm run build | Verde, tres workspaces |
| node scripts/e2e-websocket.mjs, sin cambios | 120/120 |
| npm run test:ui | 33/33 |

Los oracles son resolveMovementPipeline y handleUseTacticalAction I8 real sobre rooms independientes, sin función V1 de test compartida con producción. Nuevos tests cubren coste/contexto/speed, budgets/Diehard, V1 discriminante y orden budget, toda transición/eje/corrupción, no mutación/RNG/candidatos xyz, gates separados y presentación común. Los 11 UI ejecutan handler real mediante transporte controlado: dos DT=30, contexto inicial, limitada exacto/exceso/esfuerzo, dying/active/aliado/dead, room-update terrain/economy, turno nuevo misma criatura, Intent retrasado N+1 y ghost/coste/eje en dos modos/cuatro cámaras. WebSocket es regresión del servidor real, no evidencia de preview por sí solo.

Se corrigieron fixtures exploratorios para respetar la integridad source-first (efectos compartidos en lugar de traits derivados inventados y estructura completa de amenaza crítica). Paralyzed tiene speed 0: se prueba bloqueo separado más exceso de presupuesto real, no se fuerza una ruta legal con un límite inexistente. La suite completa se repitió tras añadir reset/test del turno nuevo del mismo actor. Esa repetición tuvo un timeout total de 30 segundos al salir de la demo en el primer test existente (los 11 I9 pasaron); se repitió la suite sin compilaciones ni unitarias paralelas y pasó completa, sin modificar demo ni su test. No se cambiaron reglas para satisfacer expectativas. Build conserva advertencia previa >500 kB; servidores propios detenidos al terminar.

## Cierre documental

Capítulo 11/§11.8 marcado como referencia ejecutada y preguntas de lifecycle cerradas: implementación completada, sin nuevo Proceed. Instrucciones históricas del plan aprobado preservadas, sin plan activo duplicado ni root implementation_plan.md retroactivo. PROJECT_STATUS/TODO/INDEX/master-coverage sincronizados; Registry/checklists no cambian porque no se implementan reglas nuevas. Enlaces/anchors locales, diff check y frontera de archivos verificados antes del commit.

DoD local completo. Tras el commit único y push origin/master, se verifica Windows CI sobre el SHA publicado y se informa su resultado real al owner. Ready for Architecture Review; sin autoaprobación. Run/5ft/Charge y los demás follow-ups permanecen separados.
