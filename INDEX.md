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
- [`docs/audits/`](docs/audits/): auditorías y divergencias.
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
