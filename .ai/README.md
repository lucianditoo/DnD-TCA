# `.ai/` — Onboarding compacto para agentes

Esta carpeta ofrece contexto rápido; no reemplaza las fuentes canónicas. La
tabla de responsabilidades documentales vive **únicamente** en
[`INDEX.md`](../INDEX.md) (no se duplica aquí — Sprint 054C).

## Orden de lectura

El orden obligatorio es el **Reader Pipeline** de
[`.agents/AGENTS.md`](../.agents/AGENTS.md) (Fase 0): P0
(`GOVERNANCE.md` + `AGENTS.md`) → P1 (`PROJECT_STATUS.md` + `TODO.md` +
`walkthrough.md`) → P3 condicional según la Reader Matrix. Esta carpeta lo
**complementa**, no lo reemplaza:

- [`PROJECT_MEMORY.md`](PROJECT_MEMORY.md) — contexto estable del sistema.
- [`DO_NOT_BREAK.md`](DO_NOT_BREAK.md) — invariantes antes de tocar código.
- [`FILE_INDEX.md`](FILE_INDEX.md) — mapa de código (P2, bajo demanda).
- [`DESIGN_REVIEW_CHECKLIST.md`](DESIGN_REVIEW_CHECKLIST.md) — si hay diseño.
- [`WORKFLOW.md`](WORKFLOW.md) — resumen derivado del flujo.
- [`COMMON_COMMANDS.md`](COMMON_COMMANDS.md) — comandos frecuentes.

Los checklists de `.ai/coverage/` (inventarios PHB) tienen granularidad
propia y no pueden redefinir Rule IDs; `docs/testing/master-coverage.md`
registra evidencia de pruebas, no cobertura normativa PHB.

## Mantenimiento

Mantener esta capa breve. Los hechos volátiles se enlazan a su fuente
canónica en vez de copiar conteos, estados de sprints o backlogs.
