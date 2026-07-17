# Rule Registry

Índice maestro de todas las reglas del motor. Este registro reemplaza las matrices de cobertura dispersas. Su objetivo es proporcionar una única fuente de verdad sobre el estado de cada regla, sin duplicar la documentación de diseño funcional.

| Rule ID | Nombre | Estado | Documento de Diseño | Implementación | Tests | Sprint | ADR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `MOVE-BASIC` | Movimiento básico | Completa | `docs/designs/movement-validation.md` | `movementCommands.ts`, `rules.ts` | Unit, E2E | - | - |
| `MOVE-5FT` | Paso de 5 pies | Completa | `docs/designs/five-foot-step.md` | `tacticalCommands.ts`, `rules.ts` | Unit, E2E | - | - |
| `ATTACK-BASIC` | Ataque básico | Completa | `docs/designs/combat-engine-mvp.md` | `attackCommands.ts`, `rules.ts` | Unit, E2E | - | `ADR-0001`, `ADR-0005` |
| `ATTACK-FULL` | Ataque completo | Completa | `docs/designs/full-attack.md` | `attackCommands.ts`, `rules.ts` | Unit, E2E | - | - |
| `POSITION-THREAT` | Amenaza melee derivada | Completa | `docs/designs/flanking-and-threatening-design.md` | `combatSnapshot.ts`, `equipmentStats.ts`, `rules.ts` | Unit, E2E | 011 | - |
| `ATTACK-FLANK` | Flanqueo | Completa | `docs/designs/flanking-and-threatening-design.md` | `rules.ts`, handlers de comandos, `ActionsPanel.tsx` | Unit, Integration, E2E | 011 | - |
| `ATTACK-CRIT` | Críticos | Completa | `docs/designs/critical-hits.md` | `attackResolver.ts` | Unit, E2E | - | - |
| `DEFENSE-TOTAL` | Defensa total | Parcial | `docs/designs/combat-engine-mvp.md` | `tacticalCommands.ts` | Unit | - | - |
| `EFFECTS-SYS-CORE` | Infraestructura ActiveEffects | Completa | `docs/designs/effects-system-architecture.md` | `effects/manager.ts`, `types.ts` | `active-effects.test.mjs` | 003 | `ADR-0007` |
| `EFFECTS-SYS-CATALOG`| Catálogo de Efectos | Completa | `docs/designs/effects-system-architecture.md` | `effects/catalog.ts` | `active-effects.test.mjs` | 003 | `ADR-0007` |
| `EFFECTS-SYS-TICK` | Tick Layer Eventos | Completa | `docs/designs/effects-system-architecture.md` | `effects/tick.ts`, `events/bus.ts` | `effects-tick.test.mjs` | 004 | `ADR-0008` |
| `EFFECTS-SYS-REDUCER`| Modificadores y Extractor | Completa | `docs/designs/rule-engine-integration.md` | `effects/reducer.ts`, `rules.ts` | `rules-evaluator.test.mjs` | 005 | - |
| `EFFECT-STUNNED` | Stunned | Parcial (V1) | `docs/designs/sprint-006-conditions.md` | `gmCommands.ts`, `rules.ts` | Unit, E2E | 006 | - |
| `EFFECT-FLAT-FOOTED` | Flat-Footed (Desprevenido) | Completa | `docs/designs/conditions-v2-design.md` | `initiativeCommands.ts`, `effects/catalog.ts` | Unit | 007 | - |
| `DEFENSE-AC-SPLIT` | Normal, Touch y Flat-Footed AC | Completa | `docs/designs/ac-split-design.md` | `types.ts`, `equipmentStats.ts`, `combatSnapshot.ts`, `rules.ts`, `attackResolver.ts` | Unit | 009 | - |
| `ATTACK-TOUCH-AUTH` | Ataques de toque autoritativos | Completa | `docs/designs/migration-and-touch-attacks-design.md` | `abilityCommands.ts`, `abilityResolver.ts`, `attackResolver.ts`, `abilities.json` | Unit, E2E | 010 | `ADR-0001`, `ADR-0004` |
| `EFFORT-DISABLED`| Esfuerzo a 0 HP | Completa | `docs/designs/disabled-exertion.md` | `lifeStatusEffects.ts` | Unit, E2E | 001 | - |
| `ATK-RANGED-INTO-MELEE` | Disparar/lanzar a combate cuerpo a cuerpo (-4) | Completa | `docs/designs/ranged-into-melee-penalty.md` | `rules.ts` (`getRangedIntoMeleeAssessment`, `getAttackContextModifiers`), `featCatalog.ts` (`rangedAttackRules`, `srd_precise_shot`) | `ranged-into-melee.test.mjs` (13), `aoo-limit-regression.test.mjs` (4) | ATK-RIM | - |
