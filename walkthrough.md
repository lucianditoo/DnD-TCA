# Walkthrough — D-1B-I8 Withdraw Server Normative Movement Integration

Responsabilidad: evidencia de implementación, validaciones y límites de I8.
Autoridad: registro; integración en [NDD Capítulo 10](docs/designs/normative-movement-design.md#capítulo-10--i8-tactical-movement-consumers-migration-sequencing), reglas en [Withdraw Rev. 3](docs/designs/withdraw/design.md).
Lifecycle: Rotativo.
Reemplaza: walkthrough I8 Design, conservado en Git.
Complementa: [plan ejecutado](docs/designs/movement/withdraw-implementation-plan.md), [estado](PROJECT_STATUS.md), [pendientes](TODO.md), [coverage](docs/testing/master-coverage.md).
Consumidores: Architecture Reviewer y agentes que consultan la implementación publicada.

## Resultado y alcance

Baseline limpio y sincronizado `61c7e96c0e084b0fb64c960cd3ee60e4444f9650`. Diseño técnicamente aprobado y Proceed explícito del owner, Nivel C. Se migró exclusivamente handleWithdraw/imports necesarios, tests asociados y WebSocket E2E. packages/shared/src, apps/web, schemas/protocolo, spatialTransition global y otros callers no cambian; tampoco .claude/settings.local.json ni archivos unrelated.

Resolution recibe actor del snapshot, ruta xyz copiada (path o fallback to), budget efectivo propio ×2/×1, contador diagonal real e isAcrobatic=false. Se mantienen guards y ocupación V1 externa desde occupiedCells, sin reanclar/fallback. El helper AdO recibe totalCostFeet/steps y exención inicial completa; sus metadata/early return siguen intactos. Oportunidades quedan locales hasta Commit.

Commit recibe la referencia viva y precondiciones de turno/ronda/origen xyz/gasto/paridad; ready no se altera. Solo Commit escribe posición, squeezing/eje, contexto, gasto total y stats base. Se retiraron del caller validateMovePath/ST y sumas manuales. Economía full-round o estándar limitada, logs, pendientes y esfuerzo Disabled se publican después de committed, antes de un único broadcast. No retry, aceptación de prefijo, nueva economía, sync adicional ni rollback de consecuencias posteriores. Axis H↔V no inventa entrada/salida de squeezing.

La UI Withdraw permanece legacy por decisión aprobada. Run, Five-Foot Step, Charge, Move I6, preview I7, D-7, forced/GM/preparation y rango de conjuros quedan fuera. Ningún helper legacy compartido se elimina.

## Validación

| Gate | Resultado local |
|---|---|
| npm test | 854/854 |
| Withdraw + movement integration/resolution/commit focalizados | 172/172 |
| npm run typecheck | Verde, tres workspaces |
| npm run build | Verde, tres workspaces |
| node scripts/e2e-websocket.mjs | 120/120 |
| npm run test:ui | 22/22 |

Pruebas nuevas comparan el handler con el resolver real, sin duplicar fórmula RAW. Cubren DT fijo de dos diagonales, contexto no cero, stacking/contabilidad, budgets/guards, V1 helpless/dead/aliado/Large, todas las transiciones H/V/natural, corrupción de eje, huellas comprimidas y metadata AdO, payload/fallback y stale de actor/referencia/turno/ronda/origen/gasto/contexto/movilidad/eje. El harness stale muta estado desde un callback shared mockeado solo en tests; verifica igualdad contra el estado inmediatamente previo a Commit y ausencia de buffers/esfuerzo/publicación, sin nueva API productiva.

Disabled conserva gasto estándar, esfuerzo único y transición dying; Diehard en -9 HP verifica muerte/TPK por esfuerzo antes de publicar. Fixtures antiguos ahora inicializan el contador explícito, sin fallback productivo. Se corrigieron fixtures exploratorios de salida de squeezing (debían conservar legal el eje en origen) y una expectativa de outcome: dying no es muerte/TPK. WebSocket AdO inicialmente no provocaba porque los reactores seguían Flat-Footed; darles su primer turno resolvió el fixture sin cambiar reglas. Gates finales completos verdes. Advertencia de bundle >500 kB preexistente; servidores propios detenidos.

## Cierre documental

Plan retirado de raíz a docs/designs/movement/withdraw-implementation-plan.md; no se reemplazó la referencia de creación original Withdraw, solo se mantuvo su enlace entrante. INDEX/PROJECT_STATUS/TODO/master-coverage sincronizados; NDD recibe solo estado factual posterior, sin rediseño. Enlaces/anchors locales, scope y diff check verificados. Registry/checklists no cambian: integración de regla existente, sin nueva cobertura normativa declarada.

DoD local completo; commit único y push origin/master. Windows CI se observa sobre el SHA publicado y se informa al owner. Ready for Architecture Review; no se autoaprueba el sprint. Preview Withdraw y siguientes consumidores requieren su propio alcance/revisión.
