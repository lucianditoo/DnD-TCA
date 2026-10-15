# Walkthrough — D-1B-I8 Design: Tactical Movement Consumers Migration Sequencing

Responsabilidad: evidencia de auditoría, decisión de secuencia y entrega documental I8.
Autoridad: registro; integración en [NDD D-1B Capítulo 10](docs/designs/normative-movement-design.md#capítulo-10--i8-tactical-movement-consumers-migration-sequencing).
Lifecycle: Rotativo.
Reemplaza: walkthrough I7, conservado en Git.
Complementa: [plan activo](implementation_plan.md), [estado](PROJECT_STATUS.md), [pendientes](TODO.md), [índice](INDEX.md).
Consumidores: Architecture Reviewer y agentes que ejecutarán únicamente tras Proceed específico.

## Resultado

Baseline limpio y sincronizado master/origin/master: `67f6c3659e3e6be5b3111b8f1855d8c44dc212c9`. I6/I7 TECHNICALLY APPROVED por el owner; Windows CI I7 SUCCESS. Entrega exclusivamente audit/design; no es Proceed ni implementación. No se modificaron ni ejecutaron tests productivos, código web/server/shared, schemas/protocolo ni configuración local.

**Único consumidor seleccionado: Withdraw servidor.** Run es segundo recomendado, sin plan de implementación propio en esta entrega. Five-Foot Step requiere cerrar su excepción de coste/contabilidad/paridad; Charge requiere delimitar selección/geometría/terreno y movimiento→ataque. Ninguno se migra ahora. La decisión no depende de D-7 para Withdraw aislado.

## Auditoría y decisiones

Se inspeccionaron tacticalCommands, movementCommands I6, spatialTransition, rules, movementResolution, movementCommit, movementCost y routeValidation, además de chargeResolver, previews web y pruebas/diseños existentes. Tabla de quince aspectos por consumidor y referencias a símbolos reales en NDD §10.2; comparación explícita de complejidad/shared/server/UI/D-7/regresión/reglas/beneficio/reutilización en §10.4.

Withdraw conserva turno virgen y economía existente; presupuesto caller ×2/×1, contexto diagonal real e isAcrobatic=false. Mantiene ocupación V1 más estricta que Route Validation y la exención inicial completa fuera del core. Resolution ready genuino alimenta Commit sin cambios shared; se retiran del caller validateMovePath, ST y sumas manuales. Commit escribe coste total a gasto, distancia base a stats, contexto y efecto/eje. Esta diferencia de stats frente al legacy se declara y probará, sin duplicar contabilidad.

AdO usa el bridge existente con Resolution.steps; se declara su metadata local/early return y no se presenta como Movement Cost normativo por paso. Buffer antes del Commit, economía/logs/pendientes/esfuerzo después y un único broadcast coherente. Se conserva desplazamiento completo y AdO posterior, sin nueva interrupción/rollback. Preview legacy-withdraw se migra en sprint separado. Ninguna fórmula del consumidor entra en el core.

Hallazgos documentales resueltos con notas de estado: NDD y plan de creación original de Withdraw conservaban frases de aprobación pendiente y un trío de economía Rev. 2 ya superado. Se identifican como referencias originales, subordinadas a Rev. 3 y al código; no hay dos planes activos de migración. No se reescribe su contrato RAW. También se detectó que W26/W27 menciona Charge en su título pero solo ejecuta Move; se exige cobertura Charge real en regresión futura. Fixtures de servidor antiguos carecen del contador diagonal: plan exige corregirlos al implementar, sin fallback productivo.

Nivel futuro C por integración en comandos/resolver servidor (GOVERNANCE §5.2), aunque no cambie shared. Una necesidad de contratos/infraestructura exige detener y reclasificar con Review nueva. Las 17 preguntas quedan respondidas en §10.7 y el plan operativo cubre exclusivamente Withdraw. Cero ODR bloqueantes del seleccionado; decisiones de consumidores posteriores no se disfrazan de dependencias de D-7.

## DoD documental

NDD canónico ampliado; NDD Withdraw recibe solo nota de estado y vínculo de integración. Plan temporal completo en raíz; INDEX, PROJECT_STATUS y TODO sincronizados con sus responsabilidades. master-coverage/Registry y checklists permanecen intactos: no hay reglas implementadas ni nueva evidencia de tests en esta entrega.

Verificados antes del commit: diff check; enlaces/anchors locales tocados; responsabilidad SSOT; baseline y auditoría real; diff solo Markdown, sin archivos unrelated; exactamente una migración futura seleccionada y cero ODR bloqueantes. No se ejecutan gates técnicos ni se requiere CI para este cierre documental. Commit único y push origin/master, sin force push.

Awaiting Architecture Review and Proceed.
