# Backlog del Proyecto

Documento vivo de tareas pendientes. El backlog está organizado en Sprints. Para añadir una nueva feature grande, debe proponerse un diseño y asignarse a un Sprint futuro.

## Sprints Completados
- [x] Sprint Arquitectónico 001: Ingeniería del Proyecto y Auditoría
- [x] Sprint Arquitectónico 002: Diseño ActiveEffects (EFFECTS-SYS-CATALOG)
- [x] Sprint Arquitectónico 003: Core ActiveEffects (EFFECTS-SYS-CORE)
- [x] Sprint Arquitectónico 004: Tick Layer (EFFECTS-SYS-TICK)
- [x] Sprint Arquitectónico 005: Rule Engine Integration (EFFECTS-SYS-REDUCER)
- [x] Sprint Arquitectónico 006: Sistema Formal de Condiciones V1 (`srd_stunned`)
- [x] Sprint Arquitectónico 007: Sistema Formal de Condiciones V2 (`srd_flat_footed`, ciclo de vida automático vía Tick Layer)
- [x] Sprint 008: Condiciones V3 — Fatigued & Prone (Modificadores Contextuales)
- [x] Sprint 009: Clase de Armadura Desglosada — Normal, Touch, Flat-Footed y combinación Touch + Flat-Footed.
- [x] Sprint 010: Migración total V2, erradicación de CA legacy y ataques autoritativos Shocking Grasp/Ray of Frost.
- [x] Sprint 011: Flanqueo y Amenaza — fuentes melee derivadas, amenaza compartida, oposición 1×1, +2 autoritativo y preview UI.
- [x] Sprint 012: Ataque Furtivo y purga legacy — snapshots fuente-first, StoredProfile V3, tipos/features catalogados y `DamageBundle` con precisión no multiplicable.
- [x] Sprint 013: Cobertura viva e intervalos de alcance dinámico (Dynamic Reach).
- [x] Sprint 014: Sistema Formal de Condiciones V3 (Fatigued, Prone, Dazed, Paralyzed)
- [x] Sprint 015: Terreno Difícil y Esquinas (Difficult Terrain & Corners)
- [x] Sprint 016: Integración autoritativa de Ataque Furtivo mediante `SNEAK_ATTACK_DICE` y preview compartido.
- [x] Sprint 017: Total Migration V3 y guards estáticos contra caches escalares en Snapshot, Template y Profile.
- [x] Sprint 018: Derribo autoritativo — AdO interruptivo, toque melee, prueba enfrentada, tamaño especial, `srd_prone` y preview UI.
- [x] Sprint 019: Fundación de Conjuros y Gestión de Slots — separación de conjuros de aptitudes, modelado de slots preparados individuales, CD predictiva pura, consumo de slots en servidor y preview en UI.
- [x] Sprint 020: Saving Throws Core — bonos derivados de Fortaleza, Reflejos y Voluntad, reglas 1/20 natural y comando táctico base.
- [x] Sprint 021: Global Round Tracker & Bleeding — reloj global, reseteo de reacciones y desangrado pasivo.
- [x] Sprint 022: Stand Up & Percentile Roller — levantarse con AdO y roller porcentual físico.
- [x] Sprint 023: Acrobatic Movement & Squeezing — movimiento acrobático y restricciones espaciales del grid.
- [x] Sprint 024: Automatización de Salvaciones Tácticas — catálogo declarativo, tirada interna, `half`/`negates`, commit único y preview UI.
- [x] Sprint 025-A: Large Footprints V1 — huellas derivadas, flanqueo multicelda, movimiento/colocación autoritativos y tokens Large 2×2; entregado antes de la repriorización.
- [x] Sprint 025-R: Prone Eschewal & Diehard — proyección vital, estabilización automática, economía Disabled en negativos y Stand Up seguro.
- [x] Sprint 026: Inventory & Ammunition Core — inventario/ranuras V5, migración estricta, proyecciones source-first, equip/unequip, consumo transaccional, AUTO servidor y UI de stock.
- [x] Sprint 027: Large Footprints Core Integration — límites efímeros, distancia O(1), caras opuestas, índice de ocupación y trazas corporales de AdO.
- [x] Sprint 028: Bull Rush & Dynamic Squeezing — franjas comprimidas derivadas, `srd_squeezing` contextual, movimiento forzado, Embestida atómica y preview UI.
- [x] Sprint 029: Grapple Core V1 — primitivas genéricas de toque/oposición, vínculo `srd_grappling`, resolución transaccional y preview UI.
- [x] Sprint 030: Grapple Core V2 — Escape de Presa, SkillRanks/StoredProfile V6, ataques restringidos en agarre y preview UI compartido.
- [x] Sprint 031: Consolidación de Infraestructura Espacial — footprints efectivos, transiciones espaciales idempotentes y preview de colisión.
- [x] Sprint 032: Advanced AoO Limits & Reaction Triggers — oráculo puro de provocación, límites elásticos y alertas predictivas en React.
- [x] Sprint 033: Spell Areas of Effect & Polygonal Templates — geometría `cone`/`line`/`burst`, intersección con huellas multiposición y overlays de área en React.
- [x] Sprint 042: Cover — pipeline canónico único, cobertura por criatura/terreno, footprints deterministas, consumidores full-stack y regresiones focalizadas.
- [x] Sprint 042.5: Recuperación de Baseline — bug real de `cloneEffectInstances` (targetCells) corregido por causa raíz, Snapshot Integrity robustecido, Ray of Frost y Withdraw W22 corregidos, `npm test` 430/430 y los 5 gates del DoD en verde real. Sprint 042 (Cover) cerrado formalmente.
- [x] Sprint 045: Entangled Core — `MovementRateContribution`, -2 ataque, -4 DEX, velocidad ×1/2, `FORBID_RUN`/`FORBID_CHARGE`, trazabilidad compartida y validación 440/440 + 91/91 + Playwright 6/6. `EFFECT-ENTANGLED` permanece Parcial por Concentration pendiente.
- [x] Sprint 046: infraestructura `DEFENSE-CONCEALMENT` — contribuciones especializadas, stacking/trazas, assessment compartido, d100 autoritativo post-CA, bloqueo de Sneak Attack y preview UI; validación 450/450 + 91/91 + Playwright 6/6. Estado: **Infraestructura solamente**, sin fuentes productivas.

## Próximos Sprints

Ver `ROADMAP.md`. Sprint 044.2 fija el pipeline transversal y Sprint 046 entrega la infraestructura de `DEFENSE-CONCEALMENT`. Las fuentes productivas, Blinded, targeting por casilla de ocultación total y la política efectiva de AdO requieren gates propios. Power Attack (039) sigue congelado.

## Sprint Activo

**Sprint 046 — DEFENSE-CONCEALMENT. COMPLETADO en su alcance aprobado.** La Rule ID conserva estado global **Infraestructura solamente** porque las fuentes productivas no forman parte de este sprint.

  **Sprint 046 — COMPLETADO**
  - [x] Eliminar el marker dormido `Modifier.mechanic/CONCEALMENT` y sustituirlo por `ConcealmentContribution` especializado.
  - [x] Implementar reducción determinista, deduplicación por `stackingKey`, trazas y precedencia máxima sin sumar porcentajes.
  - [x] Compartir `ConcealmentAssessment` entre servidor y React, separado de Cover y sin estado persistido.
  - [x] Resolver d100 en servidor después de CA y antes de daño/crítico/consecuencias; impedir Sneak Attack mediante el mismo assessment.
  - [x] Integrar ataques, AdO, Carga, conjuros/aptitudes, toques de maniobra y preview UI sin RNG de cliente.
  - [x] Validar 450/450 unitarias, typecheck, build, 91/91 WebSocket y Playwright 6/6.
  - [ ] Fuentes productivas, targeting por casilla y política efectiva de AdO (fuera de alcance; mantiene la Rule ID en **Infraestructura solamente**).

**Sprint 045 — Entangled Core. COMPLETADO en su alcance aprobado.** La regla conserva estado global **Parcial** porque Concentration no forma parte de este sprint.

  **Sprint 045 — COMPLETADO**
  - [x] Implementar `MovementRateContribution` especializado, sin modificador universal.
  - [x] Registrar -2 Attack, -4 Dexterity, velocidad ×1/2, `FORBID_RUN` y `FORBID_CHARGE` solo como contribuciones.
  - [x] Compartir proyección y trazas entre servidor y React.
  - [x] Aplicar el gate general de paso de 5 pies por velocidad efectiva/casilla y conservar terreno difícil en la ruta.
  - [x] Cubrir stacking, deduplicación, Fatigued, Prone, armadura, terreno, snapshot, WebSocket y UI.
  - [x] Validar 440/440 unitarias, typecheck, build, 91/91 WebSocket y Playwright 6/6.
  - [ ] Concentration (fuera de alcance; mantiene `EFFECT-ENTANGLED` en Parcial).

**Sprint 044.2 — Arquitectura del Pipeline de Modificadores.** Auditoría y diseño documentados en `docs/designs/modifier-pipeline-architecture.md`.

  **Sprint 044.2 — EN REVISIÓN**
  - [x] Verificar rama, HEAD, sincronización con `origin/master` y cambios locales.
  - [x] Preservar `.claude/settings.local.json` fuera de auditoría, staging y commit.
  - [x] Revisar documentación de diseños, arquitectura, reglas y control del proyecto.
  - [x] Auditar código real de ataque, movimiento, efectos, daño, Cover, snapshot, amenaza y AdO.
  - [x] Clasificar todas las rutas actuales de modificación.
  - [x] Decidir rutas a conservar, retirar y consolidar.
  - [x] Fijar el pipeline oficial y contratos reutilizados/faltantes.
  - [x] Documentar impactos, riesgos, alternativas y decisiones abiertas.
  - [ ] Revisión arquitectónica; ningún trabajo funcional queda autorizado por este documento.

  **Sprint 045 (Pre-diseño previo) — DOCUMENTADO**
  - [x] Reconstruir estado real y sincronización Git desde `master`.
  - [x] Clasificar regla base, modificador, infraestructura, fuente normativa y estado runtime.
  - [x] Auditar `ATTACK-FULL` y separar fuentes independientes.
  - [x] Auditar individualmente Blinded, Entangled, Dazzled, Shaken, Frightened, Panicked, Exhausted, Stunned y Helpless Combat.
  - [x] Comparar recortes A–F y recomendar `DEFENSE-CONCEALMENT`.
  - [x] Entregar como antecedente de Sprint 044.2; cualquier vertical específica mantiene su propio gate antes de TypeScript/tests.

  **Sprint 043 (Planning & Roadmap) — COMPLETADO**
  - [x] Gobernanza: `walkthrough.md` quitado de `.gitignore` (aprobación explícita a la propuesta pendiente de Sprint 040 §3).
  - [x] Auditoría real documentación↔código↔tests↔CI, sin asumir nada.
  - [x] `ROADMAP.md` reescrito desde cero (el anterior describía fases pre-Sprint-005, ya obsoletas).
  - [x] Hallazgos de staleness documentados: DT-011 y DT-014 desactualizadas; "Modificadores/alcance por tamaño" ya implementados (corregido en `PROJECT_STATUS.md`).
  - [x] Recomendación justificada de próximo sprint: Condiciones Restantes (comparado contra Concealment/Vision/Feats/Spells).

  **Sprint 042.5 (Recuperación de Baseline) — COMPLETADO**
  - [x] Revisar fuentes obligatorias (PROJECT_STATUS, TODO, docs de cobertura/deviations, walkthrough, tests, combatSnapshot.ts) antes de tocar código.
  - [x] Auditar `cloneEffectInstances` y todos los helpers de clonado equivalentes del monorepo (`cloneCombatRoom`, `structuredClone`, bloques internos de `createCombatRulesSnapshot`).
  - [x] Corregir la causa raíz: agregar `targetCells` a `cloneEffectInstances`, en paridad con `EffectManager.add`. Ver DT-021.
  - [x] Robustecer `dt-006-snapshot-integrity.test.mjs` con un caso de comportamiento (deepStrictEqual genérico) que hubiera detectado el bug original.
  - [x] Ray of Frost: trazabilidad completa Manual → corpus → Rule ID → registry → implementación confirmada correcta; test de Sprint 011 actualizado, motor intocado.
  - [x] Withdraw W22: regex corregido; revisados todos los `assert.throws`/`match` de la suite sin encontrar otro caso similar.
  - [x] `npm test` 430/430, typecheck 0 errores, build 3/3 workspaces, E2E WebSocket 87/87, Playwright 5/5 — los 5 gates del DoD verdes en la misma corrida.

  **Sprint 042 (COVER) — COMPLETADO (cerrado formalmente en Sprint 042.5)**
  - [x] Auditar y conservar el trabajo local iniciado por Claude.
  - [x] Consolidar Cover exclusivamente en `getAttackContextModifiers`.
  - [x] Preservar cobertura por criatura +4 e incorporar obstáculos completos +4 sin apilamiento.
  - [x] Migrar armas, touch/conjuros, AdO, Carga, maniobras y UI al mismo `CoverAssessment`.
  - [x] Eliminar `hasObstacleInterception` y cálculos paralelos de resolución/UI.
  - [x] Añadir determinismo por footprints, orden de snapshot, inmutabilidad y no doble aplicación.
  - [x] Tests focalizados: 58/58.
  - [x] Typecheck, build y E2E WebSocket 87/87.
  - [x] Suite global completamente verde: 430/430 (ver Sprint 042.5).
  - [x] Playwright: 5/5 (Chromium ya instalado en esta máquina).

  **Sprint 041 (MOVE-RUN) — COMPLETADO (validación Windows pendiente)**
  - [x] NDD aprobado con PROCEED; decisiones D-1 a D-5 cerradas (§1/§8 de `docs/designs/run-design.md`).
  - [x] Shared: variante `run` (types+Zod); gate puro `canRun` + `runSpeedMultiplier`/`runSpeedBudgetFeet` (rules.ts, consume `FORBID_RUN`); `buildStraightPath` consolidado como función pura exportada (antes privada en `chargeResolver.ts`); `FeatCatalog` (`runRules`/`runContribution`, `srd_run`); efecto de catálogo `srd_running_exposed` (`NO_DEX_TO_AC`).
  - [x] Servidor: `handleRun` en `tacticalCommands.ts` (×4/×3 según armadura, línea recta derivada por el servidor, terreno difícil bloqueado en absoluto, AdO sin exención D-1, supresión Destreza/Esquiva salvo dote; `movementCommands.ts` intocado).
  - [x] UI: botón "Correr (×4/×3)" + preview, mutuamente excluyente con Retirada.
  - [x] Tests: 21 puros en verde real (`run.test.mjs`) + 18 de servidor escritos (`run-server.test.mjs`, tsx/Windows); regresión de la suite pura idéntica antes/después (11 fallos preexistentes ajenos a este sprint).
  - [x] Docs: NDD (D-1 a D-5 cerradas + §8 Implementación), registry `MOVE-RUN`, checklists (`RULES_PHB_CHECKLIST.md`, `FEATS_PHB_CHECKLIST.md`), `docs/technical-debt.md` (DT-018 resistencia, DT-019 visión), `PROJECT_STATUS.md`, memoria.
  - [ ] Windows: `npm test` completo (`run-server.test.mjs`), `build:web`, E2E WebSocket, Playwright — **DoD no declarado completo hasta entonces**.

  **Sprint MOVE-WITHDRAW — COMPLETADO (validación Windows pendiente)**
  - [x] NDD Rev. 3 aprobado con PROCEED; contrato real de economía verificado (matriz en NDD §2).
  - [x] Shared: variante `withdraw` (types+Zod) + `exemptDepartureCellKeys` en `findTriggeredOpportunityAttacksForPath` (default neutro).
  - [x] Servidor: `handleWithdraw` en `tacticalCommands.ts` (2×/1× Disabled, huella inicial exenta, patrón Charge; `movementCommands.ts` intocado).
  - [x] UI: botón Retirada + preview ×2/×1 presentacional.
  - [x] Tests: 8 puros en verde real + 13 de servidor (tsx/Windows); regresión 40/40.
  - [x] Docs: NDD (secuencia real de AdO), registry `MOVE-WITHDRAW`, checklist 62/96=65%, dashboard, memoria (incl. deuda `usedFullAttack`).
  - [ ] Windows: `npm test` completo, `build:web`, E2E WebSocket, Playwright (W21/W22) — **DoD no declarado completo hasta entonces**.

  **Sprint ATK-RANGED-INTO-MELEE — COMPLETADO**
  - [x] NDD `docs/designs/ranged-into-melee-penalty.md` con contrato RAW corregido (revisión "either threatens", excepción 10 ft por footprints, distinción Precise/Point Blank Shot).
  - [x] `featCatalog.ts`: `rangedAttackRules` + fold `rangedAttackContribution` + `srd_precise_shot`.
  - [x] `rules.ts`: helper puro `getRangedIntoMeleeAssessment` integrado en `getAttackContextModifiers.byAttackType.ranged` (cero cambios en servidor/UI — costura isomorfa existente; conjuros con tirada de ataque heredan la regla).
  - [x] Tests: `ranged-into-melee.test.mjs` (13) + `aoo-limit-regression.test.mjs` (4, cierra AOO-03) — 32/32 en verde vía `node --test` con regresión de Sprints 036/037.
  - [x] Cierre documental: RULES/FEATS checklists, dashboard, D-11 en `combat-rules-deviations.md`, cabecera obsoleta "Sprint 031" de `PROJECT_STATUS.md` resincronizada.
  - [ ] Validación final en máquina Windows: `npm test` completo, `build:web`, E2E WebSocket, Playwright (limitación pre-existente del sandbox).

  ❄️ **Sprint 039 (Power Attack): CONGELADO** por decreto de producto (`core-rules-consolidation.md`); NDD intacta en `docs/designs/power-attack-v6-declarative.md`.

  - [x] Sprint 038: investigar el estado real post-Sprint 036 de `IterativeAttack`/`AttackRoutineContribution`/`getEffectiveAttackRoutine`, el gating de `attackCommands.ts`, y cómo se implementa realmente *Haste* — hallazgos: el servidor sigue gateando con `getAttackRoutine` (rutina cruda, sin extras — gap crítico que habría dejado la funcionalidad inutilizable), y Haste es un `Buff` hardcodeado en `abilityResolver.ts`, no una `EffectDefinition`.
  - [x] Sprint 038: crear `docs/designs/full-attack-v2-haste-rapid-shot-design.md` con checklist arquitectónico (decisión: poblar el punto de extensión de `FeatCatalog` para Disparo Rápido, extender `Buff` en vez de migrar Haste a `ActiveEffects`, y corregir `attackCommands.ts` para usar `getEffectiveAttackRoutine`).
  - [x] Sprint 038: crear el `implementation_plan.md` asociado.
  - [x] Sprint 038: asignar formalmente el sprint en `PROJECT_STATUS.md` y `TODO.md`.
  - [ ] Sprint 038: recibir aprobación formal `Proceed`.
  - [ ] Sprint 038: implementar `srd_rapid_shot` en `FeatCatalog`, `Buff.grantsExtraAttack`, la reescritura de `getEffectiveAttackRoutine`, y la corrección de `attackCommands.ts`.
  - [ ] Sprint 038: ejecutar unitarias (incluyendo regresión de servidor y verificación real vía `node --test`), typecheck y build.

  - [x] Master Plan de Cobertura Total PHB 3.5: manifiesto de gobernanza registrado en `.ai/coverage/V1_LAUNCH_MANIFESTO.md` y checklists taxativas de dotes/conjuros/equipamiento (`FEATS_CHECKLIST.md`, `FEATS_PHB_CHECKLIST.md`, `SPELLS_CHECKLIST.md`, `SPELLS_PHB_CHECKLIST.md`, `EQUIPMENT_CHECKLIST.md`, `EQUIPMENT_PHB_CHECKLIST.md`). Puramente documental — cada brecha marcada `[ ]` requiere su propia NDD y `Proceed` antes de implementarse.

  - [x] Sprint 037: investigar `validateMovePath`/`isFootprintHardBlocked`, el test `tests/difficult-terrain.test.mjs` y el NDD original de Sprint 015 — hallazgo: el bloqueo de esquina por enemigo fue una decisión deliberada de Sprint 015 pero diverge del manual (Cap. 8, pág. 147); la UI ya hereda la corrección sin cambios vía `validateMovePath`.
  - [x] Sprint 037: crear `docs/designs/corners-geometry-design.md` con checklist arquitectónico (decisión: simplificar `isFootprintHardBlocked` → `isCornerAnchorBlockedByTerrain`, único punto de consumo).
  - [x] Sprint 037: crear el `implementation_plan.md` asociado.
  - [x] Sprint 037: asignar formalmente el sprint en `PROJECT_STATUS.md` y `TODO.md`.
  - [x] Sprint 037: recibir aprobación formal `Proceed`.
  - [x] Sprint 037: implementar la simplificación de `isCornerAnchorBlockedByTerrain`, actualizar `tests/difficult-terrain.test.mjs` y crear `tests/corners-geometry.test.mjs`.
  - [x] Sprint 037: ejecutar unitarias — **12/12 en verde vía `node --test` real contra `dist/rules.js`** (sin `tsx`/esbuild) — y `typecheck`/`build:shared`/`build:server` en verde en todo el monorepo.
  - [ ] Sprint 037: **pendiente** — ejecutar `npm test` completo (vía `tsx`), `build:web` (Vite) y E2E WebSocket/Playwright en la máquina Windows local (mismo bloqueo de binarios nativos que Sprints 034-036).

  - [x] Sprint 036: investigar `getAttackRoutine`, el gating de `attackMode`/`attacksMade` en `attackCommands.ts`, el preview en `ActionsPanel.tsx` y dónde viven los penalizadores de Presa/Apretujarse — hallazgo: el sistema base ya existe y está probado (`tests/full-attack.test.mjs`).
  - [x] Sprint 036: crear `docs/designs/iterative-attacks-core-design.md` con checklist arquitectónico (decisión: read-model `getEffectiveAttackRoutine` adicional, sin duplicar `getAttackRoutine`/`Rules.totalAttackBonus`/`conditionalModifiers`).
  - [x] Sprint 036: crear el `implementation_plan.md` asociado.
  - [x] Sprint 036: asignar formalmente el sprint en `PROJECT_STATUS.md` y `TODO.md`.
  - [x] Sprint 036: recibir aprobación formal `Proceed`.
  - [x] Sprint 036: implementar `getEffectiveAttackRoutine`, el punto de extensión `FeatCatalog.attackRoutineRules` (sin consumidores) y la UI de `ActionsPanel` con bonus absoluto.
  - [x] Sprint 036: escribir `tests/iterative-attacks-effective-routine.test.mjs` y **ejecutarlo realmente en verde** (5/5) importando `packages/shared/dist/index.js` vía `node --test` puro, sin necesitar `tsx`/esbuild — primera verificación ejecutada (no solo trazada a mano) desde que el sandbox perdió el binario nativo linux-x64. `typecheck`/`build:shared`/`build:server` también verificados en verde.
  - [ ] Sprint 036: **pendiente** — ejecutar `npm test` completo (vía `tsx`), `build:web` (Vite) y E2E WebSocket/Playwright en la máquina Windows local (mismo bloqueo de binarios nativos que Sprints 034/035).

  - [x] Sprint 035: investigar `AttackContext`, `Rules.totalArmorClass`, `FeatCatalog` y el pipeline de AdO por movimiento.
  - [x] Sprint 035: crear `docs/designs/dodge-mobility-feats-design.md` con checklist arquitectónico (decisión: featIds, no EffectInstance).
  - [x] Sprint 035: crear el `implementation_plan.md` asociado.
  - [x] Sprint 035: asignar formalmente el sprint en `PROJECT_STATUS.md` y `TODO.md`.
  - [x] Sprint 035: recibir aprobación formal `Proceed`.
  - [x] Sprint 035: implementar `dodgeTargetId`, `AttackContext.isOpportunityAttack/isMovementProvoked`, bloques de CA en `totalArmorClass`, comando `declare-dodge-target` y UI de `SelectedInfo`.
  - [x] Sprint 035: escribir `tests/dodge-mobility.test.mjs` y verificar `typecheck`/`build:shared`/`build:server` en verde.
  - [ ] Sprint 035: **pendiente** — ejecutar `npm test` completo, `build:web` (Vite) y E2E WebSocket/Playwright en la máquina Windows local (mismo bloqueo de binarios nativos linux-x64 que Sprint 034; ver `PROJECT_STATUS.md`).

  - [x] Sprint 034: investigar infraestructura de efectos/tick layer, geometría de huellas y salvaciones atómicas reutilizable.
  - [x] Sprint 034: crear `docs/designs/environmental-saves-automation-design.md` con checklist arquitectónico.
  - [x] Sprint 034: crear el `implementation_plan.md` asociado.
  - [x] Sprint 034: asignar formalmente el sprint en `PROJECT_STATUS.md` y `TODO.md`.
  - [x] Sprint 034: recibir aprobación formal `Proceed`.
  - [x] Sprint 034: implementar `targetCells` en `EffectInstance`, bloque `hazard` en `EffectDefinition`, `getEnvironmentalHazardHits`, `resolveEnvironmentalHazards` en `turnManager`, comando `gm-apply-environmental-hazard` y overlay UI.
  - [x] Sprint 034: escribir `tests/environmental-hazards.test.mjs` y verificar `typecheck:shared`/`build:shared` en verde.
  - [ ] Sprint 034: **pendiente** — ejecutar `npm test` completo, `typecheck:server`/`build`, E2E WebSocket y Playwright en la máquina Windows local (el sandbox de implementación tiene esbuild nativo y symlinks de workspace rotos; ver `walkthrough.md`).

  - [x] Sprint 033: investigar infraestructuras geométricas y de salvaciones atómicas.
  - [x] Sprint 033: crear `docs/designs/spell-aoe-geometry-design.md` con checklist arquitectónico.
  - [x] Sprint 033: crear el `implementation_plan.md` asociado.
  - [x] Sprint 033: asignar formalmente el sprint en `PROJECT_STATUS.md` y `TODO.md`.
  - [x] Sprint 033: recibir aprobación formal `Proceed`.
  - [x] Sprint 033: implementar geometría AoE (`getCellsIntersectedByAoE`), extender `cast-spell` con área de efecto (daño y salvaciones simultáneas) y alerta de UI.
  - [x] Sprint 033: ejecutar unitarias, typecheck, build, E2E WebSocket y Playwright.

  - [x] Sprint 032: mapear límites elásticos de AdO con Destreza y desacoplamiento de triggers de provocación.
  - [x] Sprint 032: crear el `implementation_plan.md` asociado.
  - [x] Sprint 032: asignar formalmente el sprint en `PROJECT_STATUS.md` y `TODO.md`.
  - [x] Sprint 032: recibir aprobación formal `Proceed`.
  - [x] Sprint 032: implementar lógica elástica en backend, reinicios en tickLayer y alertas en ActionsPanel UI.
  - [x] Sprint 032: ejecutar unitarias, typecheck, build, E2E WebSocket y Playwright.

- [x] Sprint 031: mapear footprints, forced movement, commits espaciales, Bull Rush y Squeezing ya implementados.
- [x] Sprint 031: detectar el solapamiento con Sprint 028 y definir únicamente el delta de consolidación.
- [x] Sprint 031: actualizar `docs/designs/bull-rush-and-squeezing-design.md` con checklist arquitectónico.
- [x] Sprint 031: crear el `implementation_plan.md` asociado.
- [x] Sprint 031: asignar formalmente el sprint en `PROJECT_STATUS.md` y `TODO.md`.
- [x] Sprint 031: recibir aprobación formal `Proceed`.
- [x] Sprint 031: consolidar forced movement, reconciliación Squeezing, commits espaciales y preview de colisión.
- [x] Sprint 031: ejecutar unitarias, typecheck, build, E2E WebSocket y Playwright.

- [x] Sprint 030: mapear vínculo `srd_grappling`, oposición común, inventario V5 y clasificación catalogada de armas.
- [x] Sprint 030: crear `docs/designs/grapple-core-v2-actions-design.md` con checklist arquitectónico.
- [x] Sprint 030: crear el `implementation_plan.md` asociado.
- [x] Sprint 030: asignar formalmente el sprint en `PROJECT_STATUS.md` y `TODO.md`.
- [x] Sprint 030: recibir aprobación formal `Proceed`.
- [x] Sprint 030: implementar Escape de Presa, rangos V6 y ataques restringidos durante Grapple.
- [x] Sprint 030: ejecutar unitarias, typecheck, build, E2E WebSocket y Playwright.

- [x] Sprint 029: mapear maniobras transaccionales, Touch AC, oposición y `grappleModifier`.
- [x] Sprint 029: crear `docs/designs/grapple-core-v1-design.md` con checklist arquitectónico.
- [x] Sprint 029: crear el `implementation_plan.md` asociado.
- [x] Sprint 029: asignar formalmente el sprint en `PROJECT_STATUS.md` y `TODO.md`.
- [x] Sprint 029: recibir aprobación formal `Proceed`.
- [x] Sprint 029: implementar Grapple Core V1.
- [x] Sprint 029: ejecutar unitarias, typecheck, build, E2E WebSocket y Playwright.

- [x] Sprint 028: mapear footprints, `narrowCells`, `srd_squeezing` y transacción de Derribo.
- [x] Sprint 028: crear `docs/designs/bull-rush-and-squeezing-design.md` con checklist arquitectónico.
- [x] Sprint 028: crear el `implementation_plan.md` asociado.
- [x] Sprint 028: asignar formalmente el sprint en `PROJECT_STATUS.md` y `TODO.md`.
- [x] Sprint 028: recibir aprobación formal `Proceed`.
- [x] Sprint 028: implementar Bull Rush y Dynamic Squeezing.
- [x] Sprint 028: ejecutar unitarias, typecheck, build, E2E WebSocket y Playwright.

- Resistencia a conjuros, Evasion/Improved Evasion, áreas y salvaciones periódicas.

Sprint 020 permanece cerrado en el histórico; DT-007 es la asignación activa y no renumera trabajo previo.

## Backlog General


## Sprints Futuros: Interacciones y Magia
- [ ] Acciones reales de ataque de toque/rayo cuya CA objetivo se deriva exclusivamente de catálogos autoritativos del servidor.
- [ ] Feats y Spells reales (componentes, slots, resistencia a conjuros).

## Sprint Funcional 004: Feats y Spells (Fundación)
- [ ] Separar datos de dotes (Feats) de efectos mecánicos.
- [ ] Sprint 019: modelar catálogo, slots preparados y CDs dinámicas. Salvaciones permanecen fuera de alcance.

## Deuda Técnica y Mantenimiento Continuo
- [x] Migración validada V1→V2 para perfiles guardados, con backup y cuarentena explícita de datos opacos (DT-004).
- [x] DT-017 mitigada de raíz: eliminados fallbacks/estimaciones legacy; fuentes dinámicas y `armorClassBreakdown` obligatorio.
- [x] Validación Sprint 010: 218/218 tests, typecheck, build y 80/80 verificaciones WebSocket.
- [x] Validación Sprint 011: 221/221 tests, typecheck, build, 80/80 verificaciones WebSocket y 2/2 pruebas UI.
- [x] Validación Sprint 012: 225/225 tests, typecheck, build y 80/80 verificaciones WebSocket.
- [x] Validación Sprint 018: 251/251 tests, typecheck, build y 80/80 verificaciones WebSocket.
- [x] Validación Sprint 024: 279/279 tests, typecheck, build y 82/82 verificaciones WebSocket.
- [x] Validación Sprint 025-A: 286/286 tests, typecheck, build, 84/84 verificaciones WebSocket y 2/2 escenarios Playwright.
- [x] Validación Sprint 025-R: 290/290 tests, typecheck, build, 87/87 verificaciones WebSocket y 3/3 escenarios Playwright.
- [x] Validación Sprint 026: 279/279 tests, typecheck, build, 87/87 verificaciones WebSocket y 3/3 escenarios Playwright.
- [x] Validación Sprint 027: 283/283 tests, typecheck, build, 87/87 verificaciones WebSocket y 3/3 escenarios Playwright.
- [x] Validación Sprint 028: 288/288 tests, typecheck, build, 87/87 verificaciones WebSocket y 3/3 escenarios Playwright.
- [x] Validación Sprint 029: 295/295 tests, typecheck, build, 87/87 verificaciones WebSocket y 4/4 escenarios Playwright.
- [x] Validación Sprint 030: 303/303 tests, typecheck, build, 87/87 verificaciones WebSocket y 5/5 escenarios Playwright.
- [x] Validación Sprint 013: 227/227 tests, typecheck, build y 80/80 verificaciones WebSocket.
- [x] Purga residual de DT-004/DT-017: eliminados los cuatro caches escalares de snapshots, consumidores, fixtures y E2E; StoredProfile V3 rechaza o pone en cuarentena datos ambiguos.
- [ ] Mejoras de UI/UX en tokens y logs (indicador visible de buffs).
- [ ] Persistencia de salas en base de datos en lugar de memoria RAM.
- [x] Soporte base robusto para criaturas Large 2×2 en reglas, servidor, previews y Board.
