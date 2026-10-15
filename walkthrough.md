# Walkthrough — D-1B-I10 Design

Canonical responsibility: Evidencia del cierre documental de diseño I10.
Supersedes: Walkthrough I9 implementado, preservado en Git.
Complements: [NDD Capítulo 12](docs/designs/normative-movement-design.md#capítulo-12--i10-run-server-normative-integration), [plan activo](implementation_plan.md), [estado](PROJECT_STATUS.md), [pendientes](TODO.md).
Derived from: Auditoría de HEAD 9b8f8dd58bba9b79d18bcd3fcdf38dc97708e3a8 y orden del owner.
Lifecycle: Rotativo; entrega documental, Awaiting Architecture Review and Proceed.

## Resultado

Baseline limpio master/origin/master coincide con el solicitado. I6/I7/I8/I9 aprobados según el owner; Windows CI I9 SUCCESS informado, sin atribuir esa aprobación a esta auditoría. Entrega actual Nivel A; implementación propuesta Nivel C, pendiente de aprobación y Proceed.

Se extendió NDD Movement con Capítulo 12, inventario de fuentes auditadas y 24 respuestas de diseño. Run-specific RAW sigue en run-design; solo se agregó allí status factual/cross-reference e identificación del material histórico. Se creó único plan activo raíz exigido por AGENTS Fase 3, separado de referencias ejecutadas I6–I9. INDEX, PROJECT_STATUS y TODO actualizados según su responsabilidad.

APIs Resolution/Commit actuales suficientes, sin shared nuevo. Caller conserva straight path de rules.ts, altura de origen y budget efectivo ×4/×3. Precedencia cerrada illegal → budget → DT → V1, sin DT sobre insufficient. Footprints solo de steps. Contexto real y contabilidad base/total quedan en Commit. Evidencia final modo/eje viene de último step y resultado committed, no de campos top-level inexistentes en Resolution.

Atomicidad exposición cerrada en §12.7: preflight add puro descarta room devuelto; tras Commit add sobre estado vigente y asignación solo de effectInstances. No room de snapshot que sobrescriba posición/eje/contabilidad. Validaciones de id/eje/cadenas auditadas, garantía condicionada a catálogo estático/flujo síncrono; no promesa de rollback arbitrario. Guards Run no se confunden con fingerprint. Sin exención AdO, nueva regla squeezing ni variante Disabled.

Matriz futura de tests cubre A–I y E2E real; distingue cobertura existente de propuesta e inyección stale controlada de comandos WebSocket seriales. Preview permanece legacy-run; I11 separado recomendado. D-7 y deudas D-2/DT-018, D-4/DT-019 intactas. Cero ODR bloqueantes de diseño; no implementación autorizada.

## DoD documental

Se verificaron alcance exclusivamente Markdown, `git diff --check`, enlaces/anchors internos nuevos, referencias de autoridades y plan activo único I10. Root implementation_plan.md existe como plan pendiente de este sprint; I8 e I9 permanecen referencias ejecutadas. Registry MOVE-RUN/deudas y evidencia master-coverage se inspeccionaron, sin cambiar su estado ni registrar pruebas inexistentes.

No se modificaron código, tests, scripts, schemas, shared/server/web ni archivos excluidos. No se ejecutaron suites técnicas ni CI para esta entrega Markdown. El commit documental único se publica en origin/master sin force. Diseño y plan pendientes de Architecture Review y Proceed; sin autoaprobación.
