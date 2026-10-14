# Walkthrough — D-1B-I7: Normative Movement Preview Parity

Responsabilidad: evidencia de implementación, verificación y límites de I7.
Autoridad: registro; contrato en [NDD D-1B Capítulo 9](docs/designs/normative-movement-design.md#capítulo-9--i7-normative-movement-preview-parity).
Lifecycle: Rotativo.
Reemplaza: walkthrough de diseño I7, conservado en Git.
Complementa: [plan ejecutado](docs/designs/movement-preview/implementation-plan.md), [estado](PROJECT_STATUS.md), [pendientes](TODO.md), [coverage](docs/testing/master-coverage.md).
Consumidores: Architecture Reviewer y agentes que consultan el cierre.

## Resultado y autoridad

Diseño técnicamente aprobado y Proceed explícito del owner sobre `8aa4119372315308dc4bcb05f063d68965385ac1`. Implementación Nivel B limitada a apps/web, tests asociados y documentación. No se modificaron packages/shared/src, apps/server, schemas, protocolo, contratos ni .claude/settings.local.json. No se incorporaron archivos unrelated.

El adapter puro llama directamente resolveMovementPipeline con snapshot/actor actuales, ruta completa, presupuesto desde Rules.totalSpeedFeet menos gasto recibido, contador diagonal real e intención isAcrobatic. Conserva evidencia shared para legal/exceso; illegal solo aporta draft/reason/índice, unavailable captura precondiciones e integridad sin inferir eje. Empty no resuelve. No hay Commit, RNG, efectos, fórmulas RAW duplicadas ni movimiento optimista.

useBoardSelection memoiza el draft y ocho candidatos del mismo snapshot. La autoría permite exceso y drafts ilegales corregibles, incluido endpoint enemigo Tumble seguido de salida libre. Confirmar ordinary exige legalidad y guardas separadas de control/economía I6; no recorta rutas. El payload conserva exclusivamente type/ids/to/path/isAcrobatic y los clicks preservan zFeet.

previewKind aísla ordinary de placement/GM/Withdraw/Run/5ft/Charge/forced/demo/editor. El selector local de paso de 5 pies conserva comando y evaluación legacy; los cambios de familia limpian intención Tumble. Los helpers tácticos y de rango de conjuros permanecen disponibles.

Panel y ambos renderers consumen una misma proyección. Ghost final y pasos salen de occupiedCells/spatialMode/squeezingAxis de Resolution; etiquetas acumuladas y saldo vienen de esa evidencia. El token publicado conserva posición/eje. CD25 es contingencia por intersección de footprints, excluye dead/dying/stable y anuncia posible interrupción; CD15/AdO siguen siendo resueltos por servidor.

## Verificación

| Gate | Resultado local |
|---|---|
| npm test | 792/792 |
| Preview + presentación focalizados | 55/55 |
| npm run typecheck | Verde, tres workspaces |
| npm run build | Verde, tres workspaces |
| node scripts/e2e-websocket.mjs | 110/110 |
| npm run test:ui | 22/22 |
| Repetición stale con room-update N+1 | 1/1 |

Los seis tests UI nuevos usan transporte controlado y el handler I6 real sin cambios productivos. Verifican diagonales DT, paridad inicial, Tumble CD25/altura, edición/exceso/modos, estado N→N+1 y ghost común. La suite WebSocket independiente usa servidor real. El test stale verifica recomposición del draft al recibir room-update y, separadamente, rechazo autoritativo del Intent retrasado, sin gasto/movimiento optimista ni reintento. La prueba de humo Entangled selecciona ahora explícitamente el modo 5ft antes de dibujar.

Los fixtures de velocidad baja eliminan la armadura de demo para usar la velocidad efectiva declarada; no se cambiaron reglas para acomodar expectativas. Una aserción exploratoria posterior al envío esperaba un draft visible, aunque la confirmación limpia overlays por diseño existente; se ubicó la comprobación de recomposición antes del envío y pasó. La ejecución UI concurrente inicial encontró el puerto ocupado por nuestro E2E; la repetición se realizó con ese servidor detenido. Todos los servidores propios se detuvieron. Build mantiene la advertencia previa de bundle >500 kB.

## Cierre documental y límites

Plan retirado de raíz y conservado en docs/designs/movement-preview/implementation-plan.md sin duplicar un plan activo. INDEX, PROJECT_STATUS, TODO y master-coverage sincronizados; NDD recibe solo aclaración factual de la divergencia histórica. Enlaces locales, scope, SSOT y diff check revisados. Registry, inventarios PHB y deuda técnica no cambian: I7 no incorpora reglas nuevas ni cierra follow-ups tácticos, AoO predictivo, rango de conjuros o D-7.

DoD local completo. Commit único y push origin/master; Windows CI se observa sobre el SHA publicado y se informa al owner. Ready for Architecture Review; no se autoaprueba la implementación.
