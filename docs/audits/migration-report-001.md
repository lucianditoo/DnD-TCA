# Document Migration Report (Sprint 001)

Este reporte detalla todas las reubicaciones y modificaciones documentales ejecutadas durante el Sprint Arquitectónico 001.

| Documento Original | Acción | Motivo | Referencias Actualizadas | Estado |
| --- | --- | --- | --- | --- |
| `docs/decisions/` (dir) | Migrar a `docs/adr/` | Estandarización de nomenclaturas según requerimiento del sprint. | `.ai/README.md`, `.ai/WORKFLOW.md`, `CODEX_GUIDE.md` | ✅ Completado |
| `PROJECT_PRINCIPLES.md` | Consolidar y Eliminar | Absorber principios en `GOVERNANCE.md` (Zero Orphan). | `CODEX_GUIDE.md` | ✅ Completado |
| `VISION.md` | Consolidar y Eliminar | Absorber visión a largo plazo en `GOVERNANCE.md`. | `CODEX_GUIDE.md` | ✅ Completado |
| `docs/designs/combat-roadmap.md` | Migrar a `ROADMAP.md` | Posicionar documento clave en la raíz del proyecto. | `PROJECT_STATUS.md` | ✅ Completado |
| `docs/rules-coverage-checklist.md` | Consolidar y Archivar | Fusionar cobertura en `docs/rules/registry.md`. | `N/A` | ✅ Completado |
| `docs/designs/rule-coverage-matrix.md` | Consolidar y Archivar | Duplicado con checklist, unificado en Rule Registry. | `N/A` | ✅ Completado |
| `docs/designs/combat-rules-coverage.md` | Consolidar y Archivar | Duplicado funcional. | `N/A` | ✅ Completado |
| `docs/phase-*.md` (10 docs) | Archivar | Documentos históricos que ensuciaban el árbol principal. Se preservan en `docs/archive/`. | `N/A` | ✅ Completado |
| `docs/prompts/` (dir) | Archivar | Historial de prompts antiguos. | `N/A` | ✅ Completado |
| `docs/testing-checklist.md` | Consolidar y Archivar | Se fusionó el checklist en `docs/testing/master-coverage.md`. | `N/A` | ✅ Completado |
| `docs/testing-coverage-report.md` | Consolidar y Archivar | Se unificó en Master Coverage. | Limpiado en `TODO.md` | ✅ Completado |
| `docs/designs/combat-test-coverage.md` | Consolidar y Archivar | Duplicado de testing documental. | `N/A` | ✅ Completado |
| `docs/designs/playwright-e2e-testing.md` | Migrar a `docs/testing/` | Ubicación semántica correcta. | `N/A` | ✅ Completado |
| `ARCHITECTURE.md` | Mantener | Movimiento denegado: ningún beneficio técnico, podría romper integraciones locales. | `N/A` | ✅ Completado |
| `RULES_ENGINE.md` | Mantener | Ídem anterior. | `N/A` | ✅ Completado |
| `COMBAT_FLOW.md` | Mantener | Ídem anterior. | `N/A` | ✅ Completado |
| `.ai/PROJECT_MEMORY.md` | Mantener | Mantiene ubicación actual al ser dependencia crítica del workflow LLM. | `N/A` | ✅ Completado |
