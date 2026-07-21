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
- **Retirada — MOVE-WITHDRAW**: sub-acción `withdraw` de `use-tactical-action` (NO comando top-level ni modo de `move-combatant` — precedente Charge/Five-Foot-Step; `movementCommands.ts` quedó intocado). **Contrato real de economía verificado y documentado** (NDD Rev. 3 §2): `usedFullAttack` es el marcador vigente de "acción de asalto completo consumida" (lo escriben la rutina full Y Charge Y ahora Withdraw); la Retirada normal muta solo `movementUsedFeet` + `usedFullAttack`, y la rama Disabled (RAW "retirada limitada", 1× como estándar) muta `movementUsedFeet` + `usedStandardAction` + esfuerzo. **Deuda semántica registrada**: el nombre `usedFullAttack` es engañoso (candidato a `usedFullRoundAction` en sprint propio; renombre mecánico). Exención de AdO vía parámetro opcional puro `exemptDepartureCellKeys` en `findTriggeredOpportunityAttacksForPath` (default neutro; solo filtra el disparo por abandonar la huella inicial completa — jamás toca `canMakeOpportunityAttack`/AOO-03). **Secuencia real**: AdO calculadas sobre el snapshot previo, transición confirmada completa, pendientes resueltas después — sin interrupción a mitad de ruta en este comando. Simplificaciones V1: invisibles exentos (pro-defensor), Cegado sin validar, sin Acrobacias/atravesar enemigos.
- **Correr — MOVE-RUN (Sprint 041)**: sub-acción `run` de `use-tactical-action` (mismo patrón Carga/Retirada; `movementCommands.ts` intocado). El servidor deriva el camino canónico en línea recta desde la posición actual hasta `to` — el comando **no** acepta `path` del cliente (a diferencia de Retirada), eliminando la necesidad de validar rectitud de una ruta enviada externamente. **Consolidación arquitectónica clave**: `buildStraightPath`, antes privada y duplicada dentro de `chargeResolver.ts`, se movió a `packages/shared/src/rules.ts` como función pura exportada — única fuente de verdad, reutilizada por Carga sin cambio de comportamiento. **Desviación deliberada del paralelo con Carga**: el gate puro `canRun` (y el cálculo de presupuesto `runSpeedMultiplier`/`runSpeedBudgetFeet`) se implementó en el Rule Engine compartido (`rules.ts`), no en un resolver de servidor como su análogo `canCharge` — decisión justificada por el principio de gobernanza del proyecto ("toda la lógica de reglas permanece en funciones puras del Rule Engine"), no por replicar la ubicación histórica de Carga. Presupuesto ×4 (×3 armadura pesada) calculado siempre sobre la velocidad efectiva ya resuelta (`Rules.totalSpeedFeet`, hereda Prisa/penalizador de armadura). Terreno difícil: rechazo absoluto reutilizando los `occupiedCells` ya calculados por `validateMovePath` en cada paso (mismo dato que ya usa Retirada), sin una función pura nueva dedicada. Disabled: sin variante limitada — a diferencia de Retirada, el corpus no describe ningún "Correr limitado", así que `canDisabledCombatantTakeAction(..., "full-round")` rechaza sin excepción. **D-1 (AdO)**: sin exención de huella inicial — se reutiliza la generación normal por camino, sin evento adicional artificial, a diferencia de Retirada. **D-3/D-5 (Destreza/Esquiva)**: nuevo efecto de catálogo `srd_running_exposed` (`NO_DEX_TO_AC`, sin `CANNOT_MAKE_AOO`) aplicado con duración `until_turn`/inicio del propio próximo turno, omitido si `FeatCatalog.runContribution(featIds).keepsDexBonusWhileRunning` (dote `srd_run`, nuevo campo declarativo `runRules` en `FeatDefinition`). **Fuera de alcance explícito (D-2, D-4)**: resistencia multi-asalto (Constitución/CD creciente/descanso) y bloqueo por visión/Cegado — registradas como deuda técnica (`docs/technical-debt.md` DT-018/DT-019), no como heurísticas parciales.
- **Cobertura — DEFENSE-COVER (Sprint 042)**: `getAttackContextModifiers` es la única sede canónica de la inferencia táctica. Proyecta una `CoverAssessment` inmutable desde la línea entre las huellas completas del atacante y el objetivo, detectando criaturas conscientes interpuestas y celdas `impassableCells` estrictamente interiores. La evaluación es determinista ante cambios de orden del snapshot, conserva evidencia de todas las fuentes y aplica un único `+4` circunstancial a la CA aunque coincidan criatura y terreno. El mismo objeto alimenta servidor, preview React y `AttackContext`; no se persiste ni se acepta desde el cliente. Los ataques melee con alcance reciben cobertura si existe intercepción real; la adyacencia ordinaria no genera una celda interior. El pipeline legado quedó eliminado de los consumidores productivos.
- **Documentación Normativa**: La carpeta `combat/` es la referencia oficial y mandatoria para cualquier regla mecánica. 
- **Cierre del bloqueo ambiental de sandbox (2026-07-18)**: instalando `@esbuild/linux-x64` y `@rollup/rollup-linux-x64-gnu` (`npm install`, sin cambios de código — ya declarado como `optionalDependency`) se destrabó por completo la limitación que venía afectando a los sandboxes Linux desde Sprint 034: `tsx` ya transforma y ejecuta toda la suite (`npm test`), `vite build` compila `build:web` de verdad, y `scripts/e2e-websocket.mjs` corre contra un servidor real (`npx tsx apps/server/src/index.ts`) con sus 87 aserciones en verde. Sigue sin poder correr Playwright/`test:ui` en este tipo de sandbox porque instalar Chromium requiere librerías de sistema vía `apt`/root (`libXdamage.so.1` y similares), inaccesible sin privilegios elevados — no es un problema de Node/esbuild/rollup, es una limitación de permisos del entorno.
- **Próximo slice recomendado**: someter Sprint 042 a auditoría final con sus gates focales cerrados; no iniciar Concealment. Los únicos bloqueos globales observados pertenecen a pruebas preexistentes y al lanzamiento de Chromium en el entorno actual.
- **Estado de Tests**: al cierre técnico de Sprint 042 (`DEFENSE-COVER`, 2026-07-18), la suite focal de cobertura, flanqueo, huellas y disparo a melé quedó en **58/58**; `npm run typecheck`, `npm run build` y el flujo WebSocket real quedaron verdes (**87/87 E2E**). La suite global reportó **429 tests, 420 pass, 9 fail** en el conteo de Node (7 casos reales): cinco de `environmental-hazards`/Sprint 034, Ray of Frost de Sprint 011 por la penalización preexistente de disparar a melé y el mensaje de validación W22 de Retirada. Ningún fallo corresponde al pipeline de Cover. `npm run test:ui` no pudo iniciar Chromium (`spawn EPERM`) y, por tanto, no constituye una ejecución UI verde.

---

## Memoria de Decisiones Arquitectónicas

### Sprint Arquitectónico 001
- **Gobernanza**: Se consolidan las políticas Zero Orphan, Migration First y Minimal Documentation en `GOVERNANCE.md`.
- **Reglas**: Se unifica la cobertura en el **Rule Registry** (`docs/rules/registry.md`), eliminando matrices duplicadas.
- **Flujo de Trabajo**: Se formaliza el uso de Sprints Arquitectónicos y Funcionales con plantillas en `docs/sprints/` y `docs/audits/`.
- **Estructura Documental**: La carpeta `.ai/` se conserva para uso exclusivo de agentes. Los ADRs habitan en `docs/adr/`. Las fases históricas y documentos deprecados pasan a `docs/archive/`.
