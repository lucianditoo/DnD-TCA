# Walkthrough — D-1B-I6 Move Action Productive Integration

Responsabilidad: registrar implementación, verificación y límites de este sprint.
Autoridad: registro; diseño canónico en [NDD D-1B](docs/designs/normative-movement-design.md).
Lifecycle: rotativo.
Reemplaza: walkthrough de remediación R5, preservado en Git.
Complementa: [plan ejecutado](docs/designs/movement/implementation-plan.md), [evidencia](docs/testing/master-coverage.md), [estado](PROJECT_STATUS.md).

## Resultado

Implementado con Proceed explícito sobre baseline 16711b603a7162e45df6effecc4f48a55010e453. Move activo usa Route Validation → coste RAW/Tumble → Resolution → Commit → publicación; conserva ownership/turno/economía, gating exacto de ataque y bloqueo tras Five-Foot Step. Costes/paridad de ocho combinaciones viven en movementCost, sin Double Move ni Accelerated Tumbling.

SqueezingAxis se define una vez en contrato hoja sin dependencias. EffectManager valida estructura/copia; snapshot y clones preservan eje; geometría orientable exige instancia única, eje válido/legal y falla explícitamente ante corrupción. Ambos commits preservan/reemplazan/remueven eje, evitando onStack ignore. Rechazos stale no publican logs, AdOs, economía ni movimiento. Fixtures map-builder usan horizontal porque todas las huellas iniciales auditadas son filas horizontales; effect-only no orientable sigue permitido. Fixture Disabled identifica ahora el turno canónico.

Los 13 sitios del audit inicial se cubren: Move activo deja de usar spatialTransition; los otros 12 adaptan firma/evidencia. Withdraw/Run/Five-Foot Step conservan validación/coste/economía; Charge/teleport/bull rush/ramas AdO continúan natural. GM/ability/hazard no pueden generar squeezing sin evidencia. No loader persistente ni fallback para salas orientables axisless; recrear salas antiguas.

## Ajustes técnicos respecto al plan

La geometría estricta expuso un caso objetivo no representado por una mera adaptación de firma: el helper AdO consulta posiciones futuras con el eje inicial persistido. Se agregó entrada opcional de huellas confirmadas y vista local de origen por paso (sin inferir eje ni mutar Room); Move usa Resolution, Withdraw/Run sus pasos legacy. Se conserva provocación, exención, reactores, CD15 y aritmética histórica del helper. Preparación/teleport validan candidato natural explícito para no consultar un eje anterior en destino natural. NDD §8.4 aclara esta adaptación; se hace explícita para revisión externa, no se autoaprueba arquitectura.

validateMovePath/calculatePathStepCostsFeet/calculatePathCostFeet comparados contra baseline: idénticos. UI Preview permanece legacy y sus divergencias de DT diagonal, footprints y Tumble se conservan en NDD §8.6. Las nuevas pruebas de integración/eje y suites existentes reemplazan el archivo de regresión separado previsto, evitando duplicación.

## Validación y gate documental

- Suite completa 746/746; suites focalizadas 188/188; typecheck/build de tres workspaces verdes.
- WebSocket 110/110; Playwright 16/16 sobre implementación final. El E2E detectó el guard Five-Foot Step que antes residía en validateMovePath: restaurado en handler y regresión agregada. Presupuesto conserva mensaje legacy con coste normativo.
- Sandbox impidió conexión localhost (EACCES); servidor de pruebas propio produjo conflicto de puerto al intentar Playwright. Se detuvieron procesos propios y se repitieron ambos gates fuera del sandbox; no ocultar fallos ni afirmar CI remoto por resultados locales. Bundle warning >500 kB preexistente.
- Diff check, enlaces locales, SSOT, Registry y snapshots sincronizados. Plan completado reubicado de raíz a movement/implementation-plan; INDEX actualizado. Sin cambio a .claude/settings.local.json ni archivos unrelated.

CI Windows remoto se inspecciona tras push. Estado de entrega: Ready for Architecture Review; el Architecture Gate externo decide cierre formal.
