# Índice maestro de documentación

Este archivo localiza responsabilidades; no replica su contenido.

## Fuentes canónicas

| Responsabilidad | Fuente canónica |
|---|---|
| Gobernanza | [`GOVERNANCE.md`](GOVERNANCE.md) |
| Operación y Definition of Done | [`AGENTS.md`](AGENTS.md) |
| Índice documental | `INDEX.md` |
| Estado integrado y publicado | [`PROJECT_STATUS.md`](PROJECT_STATUS.md) |
| Pendientes | [`TODO.md`](TODO.md) |
| Orden futuro | [`ROADMAP.md`](ROADMAP.md) |
| Texto normativo externo | [SRD 3.5 en Markdown](#srd-35-en-markdown) |
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

## Guías y registros

- [Codex y ECC](CODEX_GUIDE.md): habilidades, criterios de activación y comandos.
- [Contexto para agentes](.ai/README.md): referencias técnicas bajo demanda.
- [ADR](docs/adr/): decisiones estructurales. La [adopción de ECC](docs/adr/ADR-0009-ecc-governance.md) registra el origen del flujo operativo vigente.
- [Plantilla de sprint](docs/sprints/TEMPLATE.md) y [plantilla de auditoría](docs/audits/TEMPLATE.md).
- Los diseños ejecutados conservan su contexto histórico junto a la vertical. El ciclo de vida documental se define en [GOVERNANCE.md](GOVERNANCE.md#23-ciclo-de-vida).
## Arquitectura

- [`ARCHITECTURE.md`](ARCHITECTURE.md): topología cliente-servidor.
- [`RULES_ENGINE.md`](RULES_ENGINE.md): separación de reglas y estado.
- [`COMBAT_FLOW.md`](COMBAT_FLOW.md): ciclo de vida del encuentro.
- [`docs/architecture/combat-engine.md`](docs/architecture/combat-engine.md):
  pipeline del motor.
- [`docs/architecture/combat-documentation-integration.md`](docs/architecture/combat-documentation-integration.md):
  uso del SRD y del corpus histórico `combat/`.
- [`docs/architecture/rule-engine-integration.md`](docs/architecture/rule-engine-integration.md):
  fronteras del Rule Engine.
- [`docs/architecture/active-effects/`](docs/architecture/active-effects/):
  arquitectura de ActiveEffects.

## Decisiones, diseños y auditorías

- [I10 Run servidor — implementación](docs/designs/normative-movement-design.md#capítulo-12--i10-run-server-normative-integration): [plan ejecutado](docs/designs/movement/run-implementation-plan.md), Ready for Architecture Review externa; sin plan activo raíz ni nuevo Proceed. Reglas propias en [Run](docs/designs/run-design.md).

- [I9 Withdraw preview — diseño e implementación](docs/designs/normative-movement-design.md#capítulo-11--i9-withdraw-normative-preview-parity): [plan ejecutado embebido](docs/designs/normative-movement-design.md#118-plan-de-implementación-ejecutado--referencia-i9), implementación completada y TECHNICALLY APPROVED según el owner (9b8f8dd); referencia ejecutada, sin plan activo I9.

- [Plan I8 Withdraw servidor ejecutado](docs/designs/movement/withdraw-implementation-plan.md): integración aprobada y ejecutada con Proceed, derivada del [NDD Capítulo 10](docs/designs/normative-movement-design.md#capítulo-10--i8-tactical-movement-consumers-migration-sequencing); TECHNICALLY APPROVED tras I8R1 (791fb4b), según el owner. Referencia ejecutada, separada de la referencia I9.
- [Plan I7 ejecutado](docs/designs/movement-preview/implementation-plan.md): referencia de Preview Parity técnicamente aprobado sobre 67f6c36; permanece separado de la referencia ejecutada I8.
- [Plan I6 ejecutado](docs/designs/movement/implementation-plan.md): referencia de implementación de Move Action técnicamente aprobada (650f22d); reubicado de raíz tras DoD.
- [`docs/designs/movement/i5r2-implementation-plan.md`](docs/designs/movement/i5r2-implementation-plan.md): plan cerrado y técnicamente aprobado de D-1B-I5R1/I5R2 (Movement Resolution / Commit Remediation).

- [`docs/adr/`](docs/adr/): decisiones arquitectónicas estables.
- [`docs/designs/`](docs/designs/): NDD y planes por vertical.
  - [`docs/designs/scripted-combat-demo.md`](docs/designs/scripted-combat-demo.md): NDD de demo táctica automática por comandos reales, escenas, aislamiento y controles de reproducción (aprobado).
  - [`docs/designs/scripted-combat-demo/implementation-plan.md`](docs/designs/scripted-combat-demo/implementation-plan.md): plan de implementación ejecutable de la demo táctica automática.
  - [`docs/designs/spatial-engine-2.5d.md`](docs/designs/spatial-engine-2.5d.md): NDD Oficial del Motor Espacial 3D Discreto y Presentación 2.5D.
  - [`docs/designs/normative-spatial-geometry.md`](docs/designs/normative-spatial-geometry.md): Geometría Normativa Espacial (D-1R1).
  - [`docs/designs/normative-area-shape-projection.md`](docs/designs/normative-area-shape-projection.md): Proyección Normativa de Áreas (D-1A).
  - [`docs/designs/normative-movement-design.md`](docs/designs/normative-movement-design.md): Contratos normativos de movimiento, coste, validación, resolución e integración (D-1B, Capítulos 1–7).
  - [`docs/designs/tactical-renderer-2.5d/design.md`](docs/designs/tactical-renderer-2.5d/design.md): NDD D-4 del renderer táctico WebGL, cámara ortográfica orbital, picking y sprites pixel-art.
  - [`docs/designs/tactical-renderer-2.5d/implementation-plan.md`](docs/designs/tactical-renderer-2.5d/implementation-plan.md): plan incremental pendiente de aprobación para implementar D-4 sin trasladar autoridad al cliente.
  - [`docs/designs/map-builder-mvp/design.md`](docs/designs/map-builder-mvp/design.md): NDD D-5 del Editor Táctico de Mapas (MVP), dimensiones, obstáculos y exclusividad de capas.
  - [`docs/designs/map-builder-mvp/implementation-plan.md`](docs/designs/map-builder-mvp/implementation-plan.md): plan de implementación del Editor Táctico de Mapas (MVP).
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

## SRD 3.5 en Markdown

La [matriz del SRD 3.5](docs/rules/srd-3.5/README.md) enlaza los 86 documentos de la distribución archivada y registra su origen, licencia y verificación. El [Rule Registry](docs/rules/registry.md) enlaza las reglas usadas por el motor con su diseño, código y pruebas. Los NDD y ADR conservan las decisiones del proyecto. El [corpus histórico de combate](combat/00_indice.txt) permite rastrear las citas anteriores.

## Historia

- [`docs/archive/combat-engine-mvp.md`](docs/archive/combat-engine-mvp.md): precursor del MVP inicial, sin autoridad sobre el alcance de V1 ni sobre el estado actual.

Los documentos reemplazados viven en [`docs/archive/`](docs/archive/) y deben
leerse como contexto histórico, no como autoridad vigente.
