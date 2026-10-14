# Walkthrough — D-1B-I6 Design Remediation R5

Responsabilidad: trazabilidad histórica y auditoría de remediaciones de diseño I6.
Autoridad: registro; los contratos viven únicamente en el [NDD D-1B §8.7](docs/designs/normative-movement-design.md).
Lifecycle: rotativo; historial anterior conservado en Git.
Complementa: [plan ejecutable](implementation_plan.md), [estado actual](PROJECT_STATUS.md).

## Auditoría preservada y resultado

- R3 (`dc6b08db622013daaf4ddebe5ccd472913b7c9dd`): matriz RAW aprobada; R5 no modifica costes, Tumble, terreno difícil, squeezing ni paridad.
- R4 (`e2c192975e12578ffb59d5843aeae70a93c8723b`): lifecycle aprobado conceptualmente y auditoría de callers aprobada. Identificó copias manuales en safeInstance y cloneEffectInstances que pierden eje; broadcast JSON no lo filtra. Las 13 invocaciones (9 natural, 4 variables con evidencia disponible) quedan trazadas en NDD §8.7.7. No se reauditaron ni migraron pipelines tácticos en R5.
- R5 migra toda información útil del documento separado de integración a NDD §8.7 (contrato, fronteras, callers y compatibilidad) y implementation_plan (archivos, secuencia, fixtures y pruebas). Tras validar contenido/referencias se elimina ese documento; desaparece la autoridad normativa paralela.
- R5 corrige la atribución de integridad espacial a manager: éste copia y valida estructura; productores exigen evidencia y geometría protege ocupación autoritativa. Se decide una única definición SqueezingAxis en módulo hoja de contratos sin imports. Evidencia discriminada comparte ese nivel inferior sin invertir capas.

## Verificación de esta entrega

Solo documentación: NDD/plan consolidados, snapshot de PROJECT_STATUS, acciones pendientes en TODO y este registro. Matriz RAW sin cambios. Cobertura R4 conservada con fronteras y pruebas de ciclos ajustadas; ningún código ni test productivo implementado. Diff check, referencias locales y alcance documental verificados antes de publicación.

Awaiting Architecture Review and Proceed.
