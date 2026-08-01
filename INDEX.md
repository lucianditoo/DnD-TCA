# Índice maestro de documentación

Este archivo localiza responsabilidades; no replica su contenido.

## Fuentes canónicas

| Responsabilidad | Fuente canónica |
|---|---|
| Gobernanza | [`GOVERNANCE.md`](GOVERNANCE.md) |
| Operación y Definition of Done | [`.agents/AGENTS.md`](.agents/AGENTS.md) |
| Índice documental | `INDEX.md` |
| Estado integrado y publicado | [`PROJECT_STATUS.md`](PROJECT_STATUS.md) |
| Pendientes | [`TODO.md`](TODO.md) |
| Orden futuro | [`ROADMAP.md`](ROADMAP.md) |
| Rule IDs y estado oficial | [`docs/rules/registry.md`](docs/rules/registry.md) |
| Evidencia de tests | [`docs/testing/master-coverage.md`](docs/testing/master-coverage.md) |
| Deuda técnica | [`docs/technical-debt.md`](docs/technical-debt.md) |
| Divergencias normativas | [`docs/audits/combat-rules-deviations.md`](docs/audits/combat-rules-deviations.md) |
| Diseño por vertical | NDD correspondiente en [`docs/designs/`](docs/designs/) |
| Último cierre ejecutado | [`walkthrough.md`](walkthrough.md) |
| Historia reemplazada | [`docs/archive/`](docs/archive/) o Git |

`docs/testing/master-coverage.md` es evidencia global de pruebas, no una
checklist exhaustiva de reglas PHB. Las matrices temáticas de `.ai/coverage/`
tienen consumidores y granularidad diferentes y no redefinen Rule IDs.

## Clasificación documental (Sprint 054C)

Todo documento del repositorio pertenece a exactamente una categoría
(`GOVERNANCE.md` §6.2.2 define la política; esta sección es la asignación
vigente):

- **SSOT**: `GOVERNANCE.md`, `.agents/AGENTS.md`, `INDEX.md`,
  `PROJECT_STATUS.md`, `TODO.md`, `ROADMAP.md`, `docs/rules/registry.md`,
  `docs/testing/master-coverage.md`, `docs/technical-debt.md`,
  `docs/audits/combat-rules-deviations.md`, `docs/adr/*`, cada NDD vigente de
  `docs/designs/**` respecto de su vertical, y los cuatro inventarios PHB de
  `.ai/coverage/` (`RULES`/`FEATS`/`SPELLS`/`EQUIPMENT` `_PHB_CHECKLIST.md`)
  más `V1_LAUNCH_MANIFESTO.md`.
- **Vista derivada** (pierde ante su canónico en todo conflicto):
  `README.md`, `CODEX_GUIDE.md`, `ARCHITECTURE.md`, `RULES_ENGINE.md`,
  `COMBAT_FLOW.md`, `docs/architecture/**` (vistas profundas por subsistema),
  y toda la carpeta `.ai/` salvo `coverage/`.
- **Histórico** (solo lectura, sin autoridad): todo `docs/archive/**` y las
  auditorías puntuales cerradas que permanezcan en `docs/audits/`
  (`core-engine-audit.md`).
- **Temporal**: `implementation_plan.md` en la raíz mientras dura su sprint;
  `walkthrough.md` es rotativo (se reescribe por completo en cada cierre).
- **Plantilla**: `docs/sprints/TEMPLATE.md`, `docs/audits/TEMPLATE.md`.
- **Obsoleto**: categoría vacía por definición — un documento obsoleto se
  archiva o elimina en el mismo sprint que lo detecta (`GOVERNANCE.md` §2.3).

En Sprint 054C se archivaron en `docs/archive/`: los tres cortes de coverage
pre-PHB (`FEATS`/`SPELLS`/`EQUIPMENT` `_CHECKLIST.md`), las auditorías de
sprint cerradas (`sprint-001-final-audit.md`, `Sprint-003-Audit.md`,
`Sprint-004-Audit.md`, `migration-report-001.md`), los planes de
implementación cerrados (`large-footprints-v1-implementation-plan.md`,
`prone-eschewal-diehard-implementation-plan.md`), el diseño supersedido
`flanking.md`, y los meta-diseños de proceso ya ejecutados
(`architectural-cleanup-phase1.md`, `project-hygiene.md`,
`ai-agent-onboarding.md`, `document-architecture-cleanup.md`).

## Arquitectura

- [`ARCHITECTURE.md`](ARCHITECTURE.md): topología cliente-servidor.
- [`RULES_ENGINE.md`](RULES_ENGINE.md): separación de reglas y estado.
- [`COMBAT_FLOW.md`](COMBAT_FLOW.md): ciclo de vida del encuentro.
- [`docs/architecture/combat-engine.md`](docs/architecture/combat-engine.md):
  pipeline del motor.
- [`docs/architecture/combat-documentation-integration.md`](docs/architecture/combat-documentation-integration.md):
  integración del corpus `combat/`.
- [`docs/architecture/rule-engine-integration.md`](docs/architecture/rule-engine-integration.md):
  fronteras del Rule Engine.
- [`docs/architecture/active-effects/`](docs/architecture/active-effects/):
  arquitectura de ActiveEffects.

## Decisiones, diseños y auditorías

- [`docs/adr/`](docs/adr/): decisiones arquitectónicas estables.
- [`docs/designs/`](docs/designs/): NDD y planes por vertical.
  - [`docs/designs/spatial-engine-2.5d.md`](docs/designs/spatial-engine-2.5d.md): NDD Oficial del Motor Espacial 3D Discreto y Presentación 2.5D.
  - [`docs/designs/normative-spatial-geometry.md`](docs/designs/normative-spatial-geometry.md): Geometría Normativa Espacial (D-1R1).
  - [`docs/designs/normative-area-shape-projection.md`](docs/designs/normative-area-shape-projection.md): Proyección Normativa de Áreas (D-1A).
  - [`docs/designs/normative-movement-design.md`](docs/designs/normative-movement-design.md): Modelo abstracto y normativo de movimiento (D-1B, Capítulo 1).
- [`docs/audits/`](docs/audits/): auditorías y divergencias.
  - [`docs/audits/combat-rules-deviations.md`](docs/audits/combat-rules-deviations.md): Desviaciones documentadas de las reglas oficiales.
  - [`docs/audits/movement-rules-audit.md`](docs/audits/movement-rules-audit.md): Auditoría oficial de reglas de movimiento (D-1B-Research).
- [`docs/sprints/TEMPLATE.md`](docs/sprints/TEMPLATE.md): plantilla de sprint.

Las features con un único artefacto persistente usan
`docs/designs/<feature>.md`; cuando existen varios artefactos duraderos se
co-ubican bajo `docs/designs/<feature>/`.

## Testing

- [`docs/testing/master-coverage.md`](docs/testing/master-coverage.md):
  evidencia canónica de pruebas.
- [`docs/testing/playwright-e2e-testing.md`](docs/testing/playwright-e2e-testing.md):
  guía de Playwright.
- [`.github/workflows/windows-ci.yml`](.github/workflows/windows-ci.yml):
  gate Windows canónico.

## Onboarding de agentes

- [`.ai/README.md`](.ai/README.md): entrada compacta.
- [`.ai/PROJECT_MEMORY.md`](.ai/PROJECT_MEMORY.md): contexto estable.
- [`.ai/DO_NOT_BREAK.md`](.ai/DO_NOT_BREAK.md): invariantes.
- [`.ai/WORKFLOW.md`](.ai/WORKFLOW.md): resumen derivado del flujo.
- [`.ai/FILE_INDEX.md`](.ai/FILE_INDEX.md): mapa de código.
- [`.ai/DESIGN_REVIEW_CHECKLIST.md`](.ai/DESIGN_REVIEW_CHECKLIST.md):
  preguntas de diseño.

## Historia

Los documentos reemplazados viven en [`docs/archive/`](docs/archive/) y deben
leerse como contexto histórico, no como autoridad vigente.
