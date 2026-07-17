# PROJECT_MEMORY — Resumen ultracompacto

> Para profundizar: [`CODEX_GUIDE.md`](../CODEX_GUIDE.md) · [`ARCHITECTURE.md`](../ARCHITECTURE.md) · [`RULES_ENGINE.md`](../RULES_ENGINE.md)

---

## ¿Qué es este proyecto?

Aplicación web local para dirigir combates tácticos de **D&D 3.5**. El GM y los jugadores se conectan por WebSocket; el servidor aplica las reglas y es la única fuente de verdad del estado del combate.

---

## Estructura del monorepo

```
apps/server/     Servidor autoritativo (Node + WebSocket). Aplica reglas. Nunca confiar en el cliente.
apps/web/        Frontend React/Vite. Solo presenta estado; no aplica reglas.
packages/shared/ Tipos, helpers de reglas puros, catálogos y schemas Zod. Compartido por server y web.
tests/           Tests unitarios con Node Test Runner.
scripts/         E2E WebSocket (e2e-websocket.mjs).
docs/            Documentación técnica, diseños, auditorías, ADRs.
combat/          Referencia normativa funcional oficial (Capítulo 8).
.ai/             Esta carpeta — onboarding compacto para agentes de IA.
```

---

## Sistemas clave

| Sistema | Dónde vive | Qué hace |
|---|---|---|
| **WebSocket** | `apps/server/src/index.ts` | Recibe comandos del cliente, valida, despacha |
| **Dispatcher** | `apps/server/src/commands/dispatcher.ts` | Enruta cada `ClientCommand` al handler correcto |
| **Validación Zod** | `apps/server/src/validation/validateClientCommand.ts` | Valida payload antes de ejecutar cualquier handler |
| **Ownership** | `apps/server/src/auth/control.ts` | Decide quién puede controlar qué combatiente |
| **Rule Engine** | `packages/shared/src/rules.ts` | Funciones puras de movimiento, ataque, CA, críticos, AdO |
| **CombatRulesSnapshot** | `packages/shared/src/combatSnapshot.ts` | Vista inmutable de la sala para calcular reglas sin mutar |
| **EquipmentCatalog** | `packages/shared/src/equipmentCatalog.ts` | Única fuente de verdad para armas, armaduras y escudos |
| **Types** | `packages/shared/src/types.ts` | Contrato de datos, `EncounterPhase`, y contrato WebSocket |
| **Schemas Zod** | `packages/shared/src/schemas/commands/` | Un schema por dominio de comando |
| **Room State** | `apps/server/src/room/roomState.ts` | Manejo de fases del combate centralizado mediante `syncEncounterPhase(room)` |

---

## Distinción perfil vs snapshot

| Concepto | Qué es | Dónde vive |
|---|---|---|
| **Perfil** | Estado permanente de un héroe (localStorage). Guarda IDs de equipo, stats base. | `profileStorage.ts`, editor en `/profiles` |
| **Snapshot de combate** | Estado temporal en un encuentro activo. Derivado del perfil al agregar al combate. | `combatSnapshot.ts`, `CombatRoom.combatants[]` |

El cliente **nunca** envía stats derivados como verdad. El servidor recalcula desde IDs.

---

## Testing

- **Unitarios**: `npm test` — Node Test Runner + tsx. Totalmente automatizados y verificables.
- **E2E**: `node scripts/e2e-websocket.mjs` — requiere server corriendo. Cubre flujos WebSocket reales con validación estricta de estado.

---

## Estado actual y próximos pasos

- **Sistemas implementados**: turnos, movimiento (con paso de 5-foot explícito y a través de aliados/enemigos muertos), flanqueo, AdO, críticos, carga, luchar a la defensiva, prestar ayuda, Disabled Effort, Conditions V1-V3 y AC Split.
- **Modo Explícito de Ataque**: El turno trackea `attackMode: "none" | "standard" | "full"`. Un ataque estándar impide iterativos y permite mover, un Full Attack bloquea movimiento (pero permite paso de 5 pies).
- **AC Split**: `armorClassBreakdown` preserva componentes tipados. `AttackContext` separa `attackType`, `targetAcType` y el override Flat-Footed. El servidor decide Touch; ActiveEffects decide la pérdida real de DEX/dodge.
- **Migración total V2**: Los perfiles solo contienen fuentes mecánicas explícitas. V0/V1 se migran con Zod, backup y cuarentena; no existe fallback de CA plana (DT-004/DT-017 resueltas).
- **Touch autoritativo**: `resolve-ability-attack` expresa la aptitud elegida, pero el servidor deriva tipo de ataque, característica y `targetAcType` desde AbilityCatalog. Ray of Frost y Shocking Grasp usan el pipeline común; Magic Missile no tira ataque.
- **Amenaza y flanqueo (Sprint 011)**: cada snapshot deriva `ThreatProfile.meleeSources`; `threatensTarget` combina capacidad, alcance, vida, facción y `NO_THREAT`. `getAttackContextModifiers` entrega +2 solo a melee y cero a ranged. Servidor y preview React comparten reglas, pero el servidor recalcula y prevalece.
- **Salvaciones automáticas (Sprint 024)**: `SpellsCatalog` declara tipo y efecto de salvación; `cast-spell` tira el d20 en servidor y confirma daño/efecto, slot, acción y logs en un solo commit. React solo proyecta DC, bono y consecuencia mediante `Rules`.
- **Large Footprints V1 (Sprint 025)**: `getCombatantOccupiedCells` deriva la huella desde tamaño y escala del tablero. Reglas, servidor, previews y Board comparten esta geometría; Large ocupa 2×2, flanquea por caras opuestas y no puede solapar parcialmente paredes o criaturas.
- **Proyección vital y Stand Up seguro (Sprint 025-R)**: `LifeStateProjection` separa estabilidad, consciencia, acción y sangrado. Diehard se estabiliza y actúa como Disabled entre −1 y −9; Prone Eschewal consume move action, 0 pies y no provoca AdO. `FeatCatalog` aporta capacidades y React consume el mismo perfil que el servidor.
- **Grapple Core V2 (Sprint 030)**: `SkillRanks.escape_artist` es fuente obligatoria en StoredProfile V6 y snapshots. El servidor deriva el vínculo y resuelve Escape por Presa o Escapismo en un commit; los ataques en agarre se limitan mediante helper shared a armas melee ligeras o naturales y reciben `forcejeo en presa -4` desde efectos.
- **Spell AoE (Sprint 033)**: `getCellsIntersectedByAoE` calcula plantillas `cone`/`line`/`burst` en `packages/shared/src/geometry/aoe.ts`; `cast-spell` intersecta esas celdas contra `getCombatantOccupiedCells` para resolver salvaciones y mitigaciones simultáneas a múltiples objetivos. React comparte la misma función para el overlay predictivo.
- **Salvaciones Pasivas Ambientales (Sprint 034)**: `EffectInstance` admite `targetCells?` (celdas de grid ancladas, formato canónico `"x,y,zFeet"` vía `footprintCellKey`/`parseCellKey`, ahora exportados), independiente de un `targetId` biológico. `EffectDefinition` admite un bloque declarativo `hazard` (CD, tipo/efecto de salvación, daño, `onFailEffectId`). El helper puro `getEnvironmentalHazardHits` detecta combatientes atrapados; `resolveEnvironmentalHazards` (orquestación en `turnManager.advanceTurn`, **fuera** del Event Bus puro) tira el d20 y resuelve daño/efecto en una sola pasada tras `RoundStarted`. Nuevo comando GM aditivo `gm-apply-environmental-hazard`; overlay `hazard-cell` en `Board.tsx`.
- **Defensas Contextuales — Dodge & Mobility (Sprint 035)**: Esquiva y Movilidad se modelaron como reglas puras derivadas de `combatant.featIds` (vía `FeatCatalog.hasFeat`), evaluadas dentro de `Rules.totalArmorClass`, **no** como `EffectInstance`/`ConditionalModifier` — Esquiva necesita un foco dinámico redeclarable turno a turno (`dodgeTargetId`) incompatible con un catálogo 100% estático. `AttackContext` gana `isOpportunityAttack?`/`isMovementProvoked?`; ambos bonos (Esquiva +1 vs. el `attackerId` designado, Movilidad +4 solo en AdO con ambas banderas en `true`) se anulan íntegramente reutilizando `suppressDexAndDodge` — sin segunda ruta de supresión. Nuevo comando `declare-dodge-target` (valida control, turno, posesión de la dote y que el objetivo exista y no esté muerto). `resolveAttack`/`handleResolveOpportunityAttack` propagan las banderas de Movilidad reutilizando `OpportunityAttack.movementCostFeet` (sin campo redundante). UI en `SelectedInfo`: proyección "CA vs. objetivo actual" y control "Declarar Esquiva".
- **Consolidación de Ataques Iterativos (Sprint 036)**: el sistema de rutina por BAB (`getAttackRoutine`, gating transaccional en `attackCommands.ts`, preview en `ActionsPanel.tsx`) ya existía en producción desde antes de la numeración estricta de sprints; el Fase 1 de este sprint lo documentó explícitamente y re-acotó el trabajo para no duplicarlo. Delta real: `getEffectiveAttackRoutine` (nuevo, `rules.ts`) compone `getAttackRoutine` + `Rules.totalAttackBonus` en un read-model puro y congelado (`IterativeAttack[]`) que expone el bonus absoluto por ataque ordinal, deliberadamente sin recibir `target` — flanqueo/Presa/Apretujarse siguen evaluándose exclusivamente por intento de ataque contra un objetivo concreto, vía `conditionalModifiers` en `effects/catalog.ts`, sin fusionarse jamás dentro de la rutina. `FeatCatalog` gana un punto de extensión declarativo e inerte (`attackRoutineRules`/`attackRoutineContribution`, sin consumidores) para Disparo Rápido/Ataque con Dos Armas/el ataque extra real de *Haste* en sprints futuros.
- **Restricción de Esquinas y Obstáculos Diagonales (Sprint 037)**: `validateMovePath` bloqueaba desde Sprint 015 el corte de esquina diagonal tanto por `board.impassableCells` como por una criatura enemiga activa en la celda de anclaje — esto último era una decisión deliberada de Sprint 015 (`docs/designs/difficult-terrain-and-corners-design.md`, D.2) pero divergía del manual (Cap. 8 pág. 147): las criaturas nunca bloquean el vértice diagonal, solo obstáculos sólidos. `isFootprintHardBlocked` se simplificó y renombró a `isCornerAnchorBlockedByTerrain`, eliminando la rama de ocupación por combatientes (único punto de consumo: dos llamadas en `validateMovePath`). Cero cambios de UI — `viewModel.ts::isLegalNextPathStep`/`getHighlightedCells` ya consumían `validateMovePath` directamente. `tests/difficult-terrain.test.mjs` tuvo su aserción de esquina invertida intencionalmente (documentado como corrección, no regresión); nuevo `tests/corners-geometry.test.mjs` cubre ambas anclas, aliado/enemigo y footprints Large 2×2.
- **Disparar a Combate Cuerpo a Cuerpo — ATK-RANGED-INTO-MELEE**: helper puro `getRangedIntoMeleeAssessment` (`rules.ts`) con contrato RAW "either threatens the other" (una dirección de amenaza basta — la formulación "mutuamente" del corpus `combat/06:58` es imprecisión de traducción, hallazgo D-11), excepción de 10 ft medida con `distanceBetweenFootprintsFeet` respecto del **amistoso más cercano en general**, y exclusión de objetivos no activos/indefensos. **Decisión de sede clave**: se integró en `getAttackContextModifiers.byAttackType.ranged` (la costura isomorfa del flanqueo) y NO en `totalAttackBonus`+`AttackContext.targetId` como proponía el NDD — el servidor la consume para armas (`attackCommands`) y conjuros con tirada de ataque (`abilityCommands`), con cero cambios en resolvers/UI y cero doble conteo; los rayos de toque a distancia heredaron la regla gratis. `FeatCatalog` ganó `rangedAttackRules`/`rangedAttackContribution` (fold OR patrón `lifeRules`) con `srd_precise_shot` como primer consumidor; Point Blank Shot deliberadamente NO registrado (prerrequisito, no exención — test T9). `getAttackContextModifiers` queda establecida como sede canónica de modificadores circunstanciales atacante↔objetivo (siguiente candidata: ocultación). AOO-03 cerrada del todo con `tests/aoo-limit-regression.test.mjs`.
- **Documentación Normativa**: La carpeta `combat/` es la referencia oficial y mandatoria para cualquier regla mecánica. 
- **Próximo slice recomendado**: validar Sprints 034-037 en la máquina local (el sandbox de implementación no pudo correr `npm test` completo, `build:web`/E2E/Playwright por el mismo bloqueo de binarios nativos linux-x64 — ver `walkthrough.md` y `PROJECT_STATUS.md`) antes de planear el siguiente sprint.
- **Estado de Tests**: 303 casos unitarios/de integración, 87 verificaciones E2E WebSocket y 5 escenarios Playwright al cierre de Sprint 030 (última cifra confirmada en máquina local). Sprint 034 agrega `tests/environmental-hazards.test.mjs` y Sprint 035 agrega `tests/dodge-mobility.test.mjs` (ambos pendientes de correr junto al resto de la suite en máquina local; typecheck/build de `tsc` puro sí verificados en verde). Sprints 036 y 037 agregan `tests/iterative-attacks-effective-routine.test.mjs` y `tests/corners-geometry.test.mjs` (más la actualización de `tests/difficult-terrain.test.mjs`) respectivamente, **ambos ejecutados realmente en verde** (5/5 y 12/12) dentro del sandbox vía `node --test` puro contra `packages/shared/dist/*.js` (sin `tsx`/esbuild), al no depender de ningún módulo `.ts` sin compilar — la excepción a la limitación de entorno que sigue afectando a `npm test` completo/`build:web`/E2E.

---

## Memoria de Decisiones Arquitectónicas

### Sprint Arquitectónico 001
- **Gobernanza**: Se consolidan las políticas Zero Orphan, Migration First y Minimal Documentation en `GOVERNANCE.md`.
- **Reglas**: Se unifica la cobertura en el **Rule Registry** (`docs/rules/registry.md`), eliminando matrices duplicadas.
- **Flujo de Trabajo**: Se formaliza el uso de Sprints Arquitectónicos y Funcionales con plantillas en `docs/sprints/` y `docs/audits/`.
- **Estructura Documental**: La carpeta `.ai/` se conserva para uso exclusivo de agentes. Los ADRs habitan en `docs/adr/`. Las fases históricas y documentos deprecados pasan a `docs/archive/`.
