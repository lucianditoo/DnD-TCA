# AI-First Project Guide

Guía breve de orientación para humanos y agentes. Las políticas obligatorias
no se duplican aquí:

- gobernanza: [`GOVERNANCE.md`](GOVERNANCE.md);
- operación y Definition of Done: [`.agents/AGENTS.md`](.agents/AGENTS.md);
- índice documental: [`INDEX.md`](INDEX.md);
- Rule IDs y estados: [`docs/rules/registry.md`](docs/rules/registry.md).

## Producto

`dnd-tactical-combat-assistant` es un motor táctico local de D&D 3.5 con UI
React, servidor Node/WebSocket autoritativo y reglas/contratos compartidos.
El cliente expresa intenciones y previews; el servidor valida ownership,
legalidad, RNG, consecuencias y commit.

## Mapa del repositorio

```text
apps/server/      comandos, autoridad, resolvers y estado de sala
apps/web/         interacción y presentación
packages/shared/  tipos, Zod, catálogos, snapshots y reglas puras
tests/            unitarias e integración directa
tests-ui/         Playwright
scripts/          E2E WebSocket
combat/           referencia normativa funcional
docs/             arquitectura, ADR, NDD, Registry y evidencia
.ai/              onboarding compacto
```

Para localizar archivos concretos, usar
[`.ai/FILE_INDEX.md`](.ai/FILE_INDEX.md).

## Arquitectura esencial

### Shared

- `types.ts`: contratos de dominio y red.
- `schemas/commands/`: validación Zod por dominio.
- `combatSnapshot.ts`: proyección inmutable de una sala.
- `rules.ts`: reglas y assessments puros compartidos.
- `effects/`: contratos, catálogo, manager, reducer y tick de ActiveEffects.
- catálogos: únicas fuentes de verdad para datos mecánicos declarativos.

### Server

- `index.ts`: entrada HTTP/WebSocket.
- `commands/dispatcher.ts`: routing de comandos ya validados.
- `auth/control.ts`: ownership y control de turno.
- `commands/`: preflight, orquestación, consecuencias y commit.
- `combat/`: resolvers puros y servicios de combate.
- `room/`: estado efímero y sincronización de fases.

### Web

React consume el estado publicado y las mismas proyecciones compartidas que
el servidor para previews. Nunca sustituye la validación autoritativa.

## Invariantes

1. El servidor es autoritativo.
2. El cliente no decide ownership, RNG ni estadísticas derivadas.
3. Perfiles/templates guardan fuentes; los valores efectivos se proyectan.
4. `CombatRulesSnapshot` es efímero e inmutable.
5. Cover, Line of Effect, Vision y Concealment son assessments separados.
6. `impassableCells` bloquea movimiento; no concede Cover.
7. Una regla tiene una sola Rule ID estable; no se crean variantes `-V2`.
8. Condiciones y equipo aportan contribuciones; no generan ramas por ID en
   handlers o resolvers.
9. Bugs de reglas obtienen un test de regresión.

Detalle: [`.ai/DO_NOT_BREAK.md`](.ai/DO_NOT_BREAK.md) y
[`docs/designs/modifier-pipeline-architecture.md`](docs/designs/modifier-pipeline-architecture.md).

## Flujo de cambio

Clasificar primero el nivel A/B/C/D definido en
[`GOVERNANCE.md`](GOVERNANCE.md). El flujo ejecutable, los artefactos
requeridos, los comandos de validación, commit, push y CI viven en
[`.agents/AGENTS.md`](.agents/AGENTS.md). [`.ai/WORKFLOW.md`](.ai/WORKFLOW.md)
es solo un resumen navegable.

No usar este archivo como un segundo backlog o una segunda política de
gobernanza.

## Ejecución local

```powershell
npm ci
npm run dev
```

- Web: `http://localhost:5173`
- Server/health: `http://localhost:3333`

Gates habituales:

```powershell
npm test
npm run typecheck
npm run build
node scripts/e2e-websocket.mjs
npm run test:ui
git diff --check
```

El E2E WebSocket requiere el servidor oficial en el puerto 3333 y debe
cerrarlo siempre al terminar. GitHub Actions es el gate canónico cuando el
sandbox local no puede ejecutar servicios o Chromium.

## Fuentes documentales

| Pregunta | Fuente |
|---|---|
| ¿Qué está integrado? | [`PROJECT_STATUS.md`](PROJECT_STATUS.md) |
| ¿Qué queda por hacer? | [`TODO.md`](TODO.md) |
| ¿En qué orden? | [`ROADMAP.md`](ROADMAP.md) |
| ¿Cuál es el estado oficial de una regla? | [`docs/rules/registry.md`](docs/rules/registry.md) |
| ¿Qué pruebas la respaldan? | [`docs/testing/master-coverage.md`](docs/testing/master-coverage.md) |
| ¿Qué deuda está abierta? | [`docs/technical-debt.md`](docs/technical-debt.md) |
| ¿Qué difiere del corpus? | [`docs/audits/combat-rules-deviations.md`](docs/audits/combat-rules-deviations.md) |
| ¿Por qué se diseñó así? | NDD correspondiente en [`docs/designs/`](docs/designs/) |
| ¿Qué cerró el último sprint? | [`walkthrough.md`](walkthrough.md) |

`docs/testing/master-coverage.md` contiene evidencia de testing, no cobertura
normativa exhaustiva del PHB. El índice completo está en [`INDEX.md`](INDEX.md).
