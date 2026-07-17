# AI-First Project Guide

This is the main guide for any human or AI agent opening this repository for the first time.

The project is no longer treated as only a playable demo. It is a long-term tactical combat engine for Dungeons & Dragons 3.5, with a local web UI on top of an authoritative server and shared rule/data packages.

Keep this file updated whenever an important change affects architecture, the rule engine, catalogs, testing, or development workflow.

## What This Project Is

`dnd-tactical-combat-assistant` is a local-first web application for running tactical D&D 3.5 combat.

The current app supports:

- local combat rooms,
- GM and player roles,
- WebSocket synchronization with Zod runtime validation of all client commands,
- a tactical grid,
- initiative,
- movement by route,
- attacks, ranged increments, abilities and tactics,
- attacks of opportunity,
- critical hits (threat, confirmation, multiplier, cancel-to-normal-damage),
- victory/TPK resolution,
- saved profile editing,
- equipment catalogs for weapons, armors and shields,
- versioned V2 profile migration with Zod validation, backup and explicit quarantine,
- mandatory structured Normal/Touch/Flat-Footed AC derived from equipment, size and intrinsic defense,
- server-authoritative Shocking Grasp and Ray of Frost attack rolls,
- derived melee threat profiles and server-authoritative 1×1 flanking (+2 melee, never ranged),
- automated tests for equipment/profile derived stats, critical flow, and command validation,
- WebSocket E2E coverage for important combat flows.

The long-term goal is a maintainable D&D 3.5 tactical engine that can grow into feats, spells, conditions, creature types, maps and campaigns without turning into a pile of one-off rules.

## Repository Map

The project is structured as a monorepo containing the following workspaces:

- `apps/web/`: React frontend (Vite, TypeScript, Tailwind-less plain CSS).
- `apps/server/`: Node.js WebSocket server authoritative logic.
- `packages/shared/`: Shared domain logic, rules, types, and schemas.
- `.agents/`: Agent configuration (rules, rules engine docs).
- `.ai/`: [AI Agent Onboarding Guide](./.ai/README.md) - Compact memory for local AI models.

```text
dnd-tactical-combat-assistant/
  apps/
    server/              Authoritative combat server and WebSocket API.
    web/                 React/Vite UI.
  packages/
    shared/              Shared types, catalogs, pure helpers and rules.
  scripts/
    e2e-websocket.mjs    End-to-end WebSocket test flow.
  tests/
    *.test.mjs           Node test runner suites.
  docs/
    combat/              Normative D&D 3.5 rule references (Chapter 8).
    prompts/             Reusable project prompts for any AI assistant.
    phase-*.md           Historical implementation notes.
    *-checklist.md       Testing/rules coverage references.
  CODEX_GUIDE.md         Main AI-first project guide.
  PROJECT_STATUS.md      Current state snapshot.
  ARCHITECTURE.md        Architecture reference.
  docs/architecture/combat-engine.md  Detailed Combat Engine architecture.
  RULES_ENGINE.md        Rule/data separation and implemented rules.
  COMBAT_FLOW.md         Runtime encounter flow.
  TODO.md                Roadmap and next work.
```

## Core Architecture

### Server

`apps/server` is authoritative.

The server owns combat state, validates permissions, applies rules, mutates rooms and broadcasts updates. The client can ask for actions, but the server decides whether they are legal.

Important areas:

- `src/index.ts`: HTTP/WebSocket entrypoint.
- `src/commands`: command handlers grouped by domain.
- `src/combat`: attack, ability, charge, buffs, turns and opportunity attack resolution.
- `src/auth/control.ts`: control/ownership validation.
- `src/room`: room state/store helpers.
- `src/gm`: GM-only state helpers.

### Web

`apps/web` is presentation and interaction.

The UI should guide the player with buttons, overlays, forms and disabled states, but must not be the only place where rules are enforced.

Important areas:

- `src/App.tsx`: top-level composition.
- `src/components`: Board, ActionsPanel, GmPanel, CombatantsPanel, log and profile forms.
- `src/hooks`: WebSocket room state, board selection and combat actions.
- `src/pages/ProfilesPage.tsx`: profile editor separate from combat.
- `src/profileEquipment.ts`: UI-facing equipment derived summaries.

### Shared

`packages/shared` is the common contract between server, web and tests.

Important areas:

- `types.ts`: public data model and WebSocket command/message types.
- `rules.ts`: shared combat helpers.
- `equipmentCatalog.ts`: only API that UI/server should use for equipment lookup.
- `equipmentStats.ts`: pure derived stat helpers.
- `combatSnapshot.ts`: pure helper that creates temporary combat snapshots from permanent profiles/templates.
- `rules.ts#threatensTarget`: shared threat capability used by flanking and opportunity-attack detection.
- `rules.ts#getAttackContextModifiers`: typed melee/ranged tactical context consumed by server and UI preview.
- `rules.ts#getLifeStateProjection`: canonical separation of HP status, consciousness, Disabled action economy and round bleeding.
- `rules.ts#getStandUpActionProfile`: shared cost/action/provocation projection for standing up; server remains authoritative.
- `featCatalog.ts`: immutable mechanical feat contributions such as Diehard and Prone Eschewal.
- `rules.ts#totalArmorClass`: single projection point for Normal, Touch, Flat-Footed and combined AC using typed snapshot components and ActiveEffects.
- `profileStorage.ts`: profile localStorage helpers.
- `data/equipment`: official equipment catalog data.
- `data/creatures.json` and `data/abilities.json`: current starter/demo catalogs.

## Non-Negotiable Rules

Always preserve these principles:

- The server is authoritative.
- The client never decides ownership.
- The client never sends derived stats as truth.
- Store catalog IDs, never full duplicated catalog objects.
- `EquipmentCatalog` is the source of truth for weapons, armors and shields.
- Data lives in catalogs.
- Rules live in shared helpers and server combat/rule modules.
- UI never contains complex game rules.
- Important logic must be testable.
- Prefer pure functions for calculations.
- Separate base stats from derived stats.
- Avoid giant files.
- Avoid duplicate logic.
- Keep data, rules and presentation separate.
- Do not change the WebSocket contract casually.
- Do not add new behavior during a refactor-only task.

## Development Workflow

For any important feature, follow this cycle:

1. Analyze the problem.
2. Design the architecture.
3. Implement the smallest useful version.
4. Test manually.
5. Convert every discovered bug into an automated test.
6. Run the full validation suite.
7. Update documentation.
8. Start the next feature only after the current one is stable.

Validation commands:

```powershell
npm test
npm run typecheck
npm run build
node scripts/e2e-websocket.mjs
```

For the E2E command, the server must be running unless the command is wrapped by a temporary server startup.

## How To Run

Install dependencies:

```powershell
npm install
```

Run web and server:

```powershell
npm run dev
```

Default URLs:

- Web: `http://localhost:5173`
- Server health: `http://localhost:3333/health`

The web client builds its WebSocket URL from `VITE_WS_URL` when present, otherwise from `window.location.hostname`. This allows a phone on the same Wi-Fi network to connect to the local server host that served the page.

## How To Add A Feature Safely

Use this checklist before editing:

1. Identify whether the change belongs to data, rules, server, UI or tests.
2. If it changes combat legality, implement validation on the server.
3. If it is a reusable calculation, put it in `packages/shared`.
4. If it uses equipment data, access it through `EquipmentCatalog`.
5. If it stores profile/equipment data, store IDs and base stats, not copied derived objects.
6. Add tests close to the pure logic first when possible.
7. Extend `scripts/e2e-websocket.mjs` for multiplayer or combat-flow regressions.
8. Update the relevant docs.

## Current Testing Strategy

There are two layers today:

- Unit-style tests with Node's built-in test runner in `tests/*.test.mjs`.
- WebSocket E2E tests in `scripts/e2e-websocket.mjs`.

Current focus:

- profile persistence,
- equipment IDs,
- derived equipment stats,
- ownership and permission boundaries,
- combat flow regressions,
- attacks of opportunity,
- threatening/flanking, including `NO_THREAT`, thrown-weapon melee capability and ranged exclusion,
- projected life state, Diehard stabilization/bleeding and declarative Stand Up previews,
- critical hit flow (threat, confirmation, cancel),
- prepared spell slots, dynamic save DCs and automatic server-side saving throws,
- transactional spell resolution: damage/effect, slot, action and log are committed together,
- WebSocket command schema validation (Zod).

Future useful additions:

- natural 1 / natural 20 unit tests,
- critical damage multiplier unit test,
- buff expiration unit test,
- browser UI tests for `/profiles`,
- component tests for critical panels,
- rule-level tests for coverage and future conditions.

See [docs/testing-coverage-report.md](docs/testing-coverage-report.md) for the full coverage analysis.

## Documentation Rules

Use the docs this way:

- `CODEX_GUIDE.md`: main orientation and working rules.
- `VISION.md`: long-term product and engine vision.
- `PROJECT_PRINCIPLES.md`: non-negotiable engineering principles.
- `PROJECT_STATUS.md`: current snapshot of what exists and what is missing.
- `ARCHITECTURE.md`: how code is organized.
- `docs/architecture/combat-engine.md`: detailed explanation of the combat engine flow and its architectural principles.
- `RULES_ENGINE.md`: rule/data architecture and rule coverage.
- `COMBAT_FLOW.md`: encounter lifecycle.
- `TODO.md`: prioritized roadmap.
- `docs/adr`: Architecture Decision Records for important project decisions.
- `docs/prompts`: reusable project prompts for any AI assistant.
- `docs/designs/rule-coverage-matrix.md`: complete matrix of rule coverage per system.
- `docs/testing-coverage-report.md`: test coverage analysis and recommended tests.
- `docs/technical-debt.md`: consolidated, prioritized technical debt register.
- `docs/audits/core-engine-audit.md`: original technical audit of all engine subsystems.

Avoid creating another guide that duplicates `CODEX_GUIDE.md`. Update this file instead.

## Architecture Decision Records

Important architecture decisions are recorded in `docs/adr`.

Current ADRs:

- `ADR-0001-server-authoritative.md`: the server owns combat truth.
- `ADR-0002-ownership-in-server.md`: ownership is assigned and validated by the server.
- `ADR-0003-equipment-catalog-source-of-truth.md`: equipment data comes from `EquipmentCatalog`.
- `ADR-0004-profile-vs-combat-state.md`: permanent profiles are separate from combat instances.
- `ADR-0005-rule-engine-separation.md`: data, rules and UI stay separate.
- `ADR-0006-testing-culture.md`: important bugs become automated tests.

## High-Level Roadmap

This is direction, not an implementation order locked in stone:

1. ~~Critical Hits~~ ✅ Done.
2. ~~WebSocket runtime validation (Zod)~~ ✅ Done.
3. ~~Natural 1 / Natural 20 in `attackResolver` (DT-005).~~ ✅ Done.
4. ~~Architectural Cleanup Phase 1 (DT-001/DT-003).~~ ✅ Done.
5. Movement through allies/enemies (DT-002, required before flanking).
6. Conditions.
7. Flanking.
8. Feats.
9. Spells.
10. Skills.
11. Creatures.
12. AI assistance, if ever added.
13. Map editor.
14. Campaigns.

See [docs/technical-debt.md](docs/technical-debt.md) for the prioritized debt register.

## Prompt Library

Reusable prompts live in `docs/prompts`.

They are project prompts, not Codex-specific prompts. They should work for Codex, ChatGPT, Claude Code, Gemini CLI, Cursor or another future assistant.

When creating or updating prompts:

- keep them tool-agnostic,
- include constraints and validation commands,
- reference this guide,
- avoid relying on chat history,
- keep prompts focused on one kind of work.

## Sprint 030 — Grapple Core V2

- Los rangos de habilidad son fuentes explícitas en `SkillRanks`; `escape_artist` nunca se estima.
- `getGrappleLink`, `getGrappleEscapePreview` y `getGrappleAttackEligibility` son las fronteras compartidas para Presa.
- El servidor deriva retenedor, modificadores, desempates e instancia a retirar; el cliente solo expresa intención.
- Dentro de la Presa solo se permiten armas melee ligeras o ataques naturales elegibles, con `forcejeo en presa -4` proyectado por efectos.
