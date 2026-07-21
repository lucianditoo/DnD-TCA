# Deuda Técnica Consolidada — D&D 3.5 Tactical Combat Engine

*Documento consolidado: 2026-07-15. Fuentes: `core-engine-audit.md`, `PROJECT_STATUS.md`, `TODO.md`, `CODEX_GUIDE.md`, walkthroughs de sesiones.*

> Este documento es la fuente única de verdad para la deuda técnica. Los documentos fuente solo deben **enlazar** hacia aquí, no duplicar la información.

---

## 🔴 Prioridad Alta

Estas deudas bloquean la implementación correcta de reglas futuras o representan riesgos activos de seguridad o corrupción de estado.

---

### ~~DT-001: AttackResolver muta el estado de sala directamente (impuro)~~ ✅ RESUELTO

**Resolución (2026-07-08)**: `attackResolver.ts` fue refactorizado y ahora es 100% puro. Las funciones `resolveAttack` y `resolveCriticalConfirmation` devuelven una interfaz plana `AttackResult`. Todas las mutaciones imperativas (HP, stats, logs) se movieron a `apps/server/src/commands/attackCommands.ts` (específicamente en `applyAttackMutations` y `resolveThreatOutcome`).

---

### ~~DT-002: Movimiento a través de aliados y enemigos sin implementar~~ ✅ RESUELTO

**Resolución (2026-07-08)**: Se implementó la lógica en `validateMovePath` en `rules.ts` para distinguir entre aliados, enemigos y criaturas indefensas. El frontend (`viewModel.ts` y `ActionsPanel.tsx`) ahora permite atravesar aliados e indefensos, y bloquea el botón de confirmación si se intenta terminar sobre una criatura consciente.

Cambios realizados:
- `validateMovePath`: Reglas exactas de ocupación y permiso de terminar sobre indefensos.
- `chargeResolver.ts`: Falla de carga con ruta bloqueada (incluso por criaturas muertas).
- `rules.test.mjs`: Tests exhaustivos para aliados, enemigos, y combatientes helpless.

---

### ~~DT-003: Bloqueo de flujo de críticos y AdO es ad-hoc en el dispatcher~~ ✅ RESUELTO

**Resolución (2026-07-08)**: Se centralizó el estado en una máquina formal (`EncounterPhase`) calculada dinámicamente mediante `syncEncounterPhase(room)` en `roomState.ts`. A su vez, `dispatcher.ts` verifica esta fase y bloquea activamente la ejecución de comandos inválidos.

---

### ~~DT-004: No existe validación de payload de datos persistidos (perfiles guardados)~~ ✅ RESUELTO

**Resolución final (Sprint 012, 2026-07-15)**: `profileStorage.ts` usa un sobre V3 y schemas Zod estrictos. Migra entradas anteriores de forma determinista e idempotente solo cuando tipo de criatura y features son explícitos o tienen un mapeo inequívoco, conserva backup, valida catálogos y pone perfiles opacos en cuarentena mediante `ProfileMigrationIssue`.

**Descripción histórica**: Antes de Sprint 010, los perfiles se guardaban en localStorage como JSON plano y podían cargarse con datos incorrectos o ausentes después de un cambio de schema.

**Riesgo mitigado**: El envelope versionado, el backup previo a migración y la cuarentena evitan que datos opacos lleguen al combate silenciosamente.

**Módulo afectado**: `packages/shared/src/profileStorage.ts`, `packages/shared/src/types.ts`

**Impacto futuro**: Los próximos cambios de schema deben agregar una migración versionada explícita.

**Implementado**: Versión V3, migrador pre-V3 → V3, validación Zod y reporte visible de entradas en cuarentena.

**Bloquea MVP**: No inmediatamente, pero crítico a mediano plazo.

---

### ~~DT-005: Natural 1 y Natural 20 sin implementación ni test~~ ✅ RESUELTO

**Resolución (2026-07-07)**: La lógica estaba correcta en `attackResolver.ts` línea 42 (ternario `d20Roll === 1 ? false : d20Roll === 20 ? true : ...`) y en `isCriticalThreat`/`isCriticalConfirmed` en `rules.ts`. Lo que faltaban eran los tests explícitos de nivel de resolver y el log diferenciado.

Cambios realizados:
- `attackResolver.ts`: Variables explícitas `isNatural1` / `isNatural20` + log que dice "Falla automática (1 natural)" y "¡Impacto automático! (20 natural)".
- `tests/attack-rules.test.mjs`: Nuevo archivo con 9 tests de regresión que cubren el resolver completo.

**Tests agregados**: `tests/attack-rules.test.mjs` — 9 casos sobre natural 1/20 y ataques ordinarios.

---

### ~~DT-006: CombatRulesSnapshot mapeo manual — riesgo de desincronización~~ ✅ RESUELTO

**Resolución (2026-07-16)**: Se blindaron las interfaces y el mapeador estructural para impedir que cambios futuros en `CombatRoom` desincronicen el motor de reglas.
Se agregó el type guard `_RoomSnapshotExhaustiveGuard` en `types.ts` cruzando `CombatRoom` y `CombatRulesSnapshot`. Además se incluyó una suite estricta de validación en tiempo de ejecución en `dt-006-snapshot-integrity.test.mjs` que evalúa dinámicamente si los keys de la sala activa (exceptuando llaves efímeras) están representadas sin ser undefined en el snapshot inmutable (protegido por `deepFreeze`).

**Riesgo mitigado**: Evitar campos huérfanos que el snapshot descarta y el motor de reglas necesita. Fallos futuros generarán alerta del compilador (TypeScript `never` constraint) y fallos en tests unitarios.

**Módulo afectado**: `packages/shared/src/combatSnapshot.ts`, `packages/shared/src/types.ts`

**Implementado**: Type Guard (`SizedStructuralMatch`), Tests de introspección estructural dinámica.

---

## 🟡 Prioridad Media

Estas deudas generan riesgo de regresión o complican implementaciones futuras pero no bloquean funcionalidad actual.

---



### ~~DT-007: Límite de 1 AdO por criatura por ronda sin implementar~~ ✅ RESUELTO

**Resolución (Sprint 021, 2026-07-16)**: D&D 3.5 exige que un combatiente realice como máximo 1 Ataque de Oportunidad por ronda, o más si posee "Reflejos de Combate" (1 + Mod DEX), pero nunca más de 1 AdO contra el mismo objetivo en la misma ronda. Se implementó un tracking inmutable en `CombatantStats` (`opportunityAttacksThisRound` y `targetsAttackedThisRoundViaAoO`) que se incrementa en `attackCommands.ts` de forma atómica. La validación autoritativa en `rules.ts` restringe los ataques correctamente respetando los históricos (Irreversibilidad a 20 sprints) y la regla del objetivo único. El contador se resetea vía `tickLayer.ts` puramente al comienzo de cada ronda.

---

### DT-008: Ownership acoplado imperativamente en cada handler

**Descripción**: Las comprobaciones de `requireCombatantControl` y `requireTurnControl` están duplicadas en cada handler de comando individualmente. No existe middleware centralizado.

**Riesgo**: Si se crea un handler nuevo y se olvida agregar la comprobación, se genera una vulnerabilidad de seguridad donde jugadores pueden controlar combatientes ajenos.

**Módulo afectado**: Todos los handlers en `apps/server/src/commands/`

**Recomendación**: Definir metadata de ownership por tipo de comando en el schema Zod y procesar la verificación en el dispatcher antes de llamar al handler.

**Bloquea MVP**: No, pero es un riesgo de seguridad que crece con cada nuevo comando.

---

### DT-009: E2E Tests son frágiles ante cambios en mecánicas de dados

**Descripción**: El script E2E usa valores de d20 fijos. Cuando se agregó el sistema de críticos, los tests que usaban `d20Roll: 20` empezaron a fallar porque el servidor interceptaba el 20 como amenaza de crítico y bloqueaba la resolución del flujo. Los valores tuvieron que cambiarse a 15.

**Riesgo**: Fragilidad mantenedora. Cualquier mecánica nueva que intercepte valores específicos de dado puede romper el E2E.

**Módulo afectado**: `scripts/e2e-websocket.mjs`

**Recomendación**: Agregar un modo de test en el servidor que permita inyectar dados predeterminados o desactivar tiradas de confirmación de crítico, separando la prueba del flujo de la prueba del valor de dado.

**Bloquea MVP**: No.

**Mitigación parcial (Sprint 024, 2026-07-16)**: las pruebas unitarias del lanzamiento inyectan un roller interno determinista sin exponer tiradas en el contrato WebSocket. El E2E de salvación acepta ambos resultados legales y verifica invariantes de estado, por lo que esta nueva mecánica no amplía la fragilidad. La deuda permanece abierta para los escenarios históricos de ataque/crítico.

---

### DT-010: Tests unitarios de UI inexistentes

**Descripción**: No existe ningún test unitario ni de componente para `apps/web`. Cambios en `Board.tsx`, `ActionsPanel.tsx` o `GmPanel.tsx` pueden generar regresiones invisibles.

**Riesgo**: Regresiones silenciosas en la interfaz tras actualización de dependencias o refactors.

**Módulo afectado**: `apps/web/src/components/*`

**Recomendación**: Instalar Vitest + React Testing Library en `apps/web`. Comenzar con tests de `ActionsPanel` (los controles de combate más críticos) y `ProfilesPage`.

**Bloquea MVP**: No.

---

### ~~DT-011: Ataque completo sin ataques iterativos reales~~ ✅ RESUELTO (verificado en Sprint 044)

**Descripción histórica**: El sistema marcaba el turno como "ataque completo" pero no generaba ataques iterativos por BAB (BAB 6/1, 11/6/1, etc.). El ataque completo era solo un marcador de acción.

**Resolución (Sprint 036, verificada por código y tests en Sprint 044)**: `packages/shared/src/rules.ts` implementa `getAttackRoutine` y `getEffectiveAttackRoutine` (read-model puro que compone `getAttackRoutine` + `Rules.totalAttackBonus`), con progresión real de ataques iterativos por umbral de BAB. Confirmado en uso activo desde `attackCommands.ts` y `ActionsPanel.tsx`. Tests: `iterative-attacks-effective-routine.test.mjs` (5/5), `full-attack.test.mjs`. Ver Rule ID `ATTACK-FULL` en `docs/rules/registry.md` (Completo).

**Alcance pendiente, no confundir con esta deuda**: Disparo Rápido (Rapid Shot) y Aceleración (Haste) real como *fuentes adicionales* de ataque extra siguen sin implementar — eso es el Rule ID `ATTACK-FULL-V2` (Sprint 038, NDD aprobado, esperando `Proceed`), una funcionalidad nueva, no la deuda original de DT-011 (que era "sin iterativos reales en absoluto").

**Módulo afectado**: `packages/shared/src/rules.ts`, `apps/server/src/commands/attackCommands.ts`.

**Bloquea MVP**: No — deuda cerrada.

---

### DT-012: EquipmentCatalog es estático y no soporta buffs dinámicos

**Descripción**: `toWeaponProfile` y `deriveEquipmentStats` calculan derivados una vez, asumiendo condiciones estáticas. No pueden representar armas mágicas o efectos que modifiquen el equipo en tiempo real.

**Riesgo**: Implementar *Arma mágica*, *Afilar*, *Improved Critical* o *Keen* requerirá una refactorización del catálogo.

**Módulo afectado**: `packages/shared/src/equipmentCatalog.ts`, `packages/shared/src/equipmentStats.ts`

**Recomendación**: Cambiar la firma de `toWeaponProfile` para aceptar buffs activos del combatiente y recalcular modificadores en caliente.

**Bloquea MVP**: No.

---

## 🟢 Prioridad Baja

Estas deudas no generan riesgo activo pero conviene resolverlas antes de las fases de feats y spells.

---

### DT-013: Stack de buffs del mismo tipo sin validación

**Descripción**: Múltiples buffs del mismo tipo (ej. dos Bless) pueden acumularse y sumar bonificadores incorrectamente. D&D 3.5 tiene reglas de no-stack por tipo de bonificador.

**Módulo afectado**: `apps/server/src/combat/buffRules.ts`

**Recomendación**: Agregar campo `bonusType` al modelo de `Buff` y validar que solo el mayor bonificador de cada tipo se aplique.

**Bloquea MVP**: No.

---

### ~~DT-014: Pérdida automática de 1 HP por ronda (combatiente moribundo) sin implementar~~ ✅ RESUELTO (verificado en Sprint 044)

**Descripción histórica**: Un combatiente moribundo debería perder 1 HP automáticamente al inicio de cada turno. Esto no ocurría.

**Resolución (Sprint 021, verificada por código y tests en Sprint 044)**: `apps/server/src/combat/turnManager.ts` implementa `roundTickListener`, que desangra pasivamente a los combatientes moribundos en cada ronda mediante el Tick Layer del Event Bus. Confirmado también en el Apéndice A de `docs/audits/combat-rules-deviations.md` (fila `COND-02`, "Resuelta"). Tests: `global-round-tracker.test.mjs`. Ver Rule IDs `ROUND-TRACKER`/`EFFECT-DYING-BLEED` en `docs/rules/registry.md` (ambos Completo).

**Módulo afectado**: `apps/server/src/combat/turnManager.ts`.

**Bloquea MVP**: No — deuda cerrada.

---

### DT-015: Documentación fragmentada entre múltiples archivos

**Descripción**: La deuda técnica y el estado del proyecto estaban dispersos entre `core-engine-audit.md`, `PROJECT_STATUS.md`, `TODO.md` y walkthroughs. Este documento consolida la deuda; los demás deben enlazar aquí.

**Módulo afectado**: Todos los `.md` de la raíz y `docs/`.

**Recomendación**: Mantener este archivo como fuente única de deuda. `PROJECT_STATUS.md` y `TODO.md` deben ser resúmenes ejecutivos que enlacen aquí para el detalle.

**Bloquea MVP**: No.

---

### DT-016: DurationPolicy acoplado al número de ronda

**Descripción**: La evaluación de efectos con duración en rondas en ActiveEffects (Fase 6) asume que la duración expira comprobando `event.round - appliedRound >= count`. Esto asume que el sistema de iniciativa es estático y el concepto de "ronda" es uniforme para todos.

**Riesgo**: Si se implementan reglas de alterar la iniciativa como "Preparar Acción" (Ready) o "Retrasar" (Delay), o sistemas de combate que eliminen el concepto global de "ronda", esta validación fallará.

**Módulo afectado**: `packages/shared/src/effects/tick.ts`, `contracts.ts`.

**Recomendación**: Evolucionar la política hacia una basada únicamente en ocurrencias del evento ancla (event occurrences), contando cuántas veces sucedió el evento desde la aplicación en lugar del número de ronda global.

**Bloquea MVP**: No.

---

### ~~DT-017: Variantes de CA legacy sin desglose exacto~~ ✅ RESUELTO

**Resolución (2026-07-15)**: se eliminaron el retorno de `armorClass` plano y las estimaciones Touch/Flat-Footed. Las plantillas guardan fuentes explícitas; `createCombatantSnapshotFromProfile` deriva un breakdown completo y `totalArmorClass` falla con un error descriptivo si la invariante no se cumple. Todas las criaturas integradas fueron migradas.

**Descripción histórica**: Perfiles y monstruos anteriores a Sprint 009 podían conservar únicamente `armorClass` como escalar, por lo que Touch AC no podía reconstruirse exactamente.

**Mitigación definitiva**: Normal, Touch y Flat-Footed AC exigen el mismo desglose estructurado; los datos opacos son rechazados o puestos en cuarentena antes de entrar al motor.

**Módulo afectado**: `packages/shared/src/types.ts`, `combatSnapshot.ts`, `rules.ts`, datos de criaturas y perfiles persistidos.

**Implementado**: Catálogos migrados, perfiles V3 y derivación uniforme de `armorClassBreakdown`; Sprint 012 eliminó además todos los caches escalares residuales de snapshot, consumidores y fixtures.

**Bloquea MVP**: No; deuda cerrada.

---

## Tabla Resumen

| ID | Descripción breve | Prioridad | Módulo | Bloquea MVP |
|---|---|---|---|---|
| ~~DT-001~~ | ~~AttackResolver muta sala directamente (impuro)~~ | ~~🔴 Alta~~ | ~~`attackResolver.ts`~~ | ~~No~~ | ✅ **Resuelto** |
| ~~DT-002~~ | ~~Sin validación de paso a través de aliados/enemigos~~ | ~~🔴 Alta~~ | ~~`movementCommands.ts`~~ | ~~Sí (flanqueo)~~ | ✅ **Resuelto** |
| ~~DT-003~~ | ~~Bloqueo de flujo ad-hoc en dispatcher~~ | ~~🔴 Alta~~ | ~~`dispatcher.ts`~~ | ~~No~~ | ✅ **Resuelto** |
| ~~DT-004~~ | ~~Sin migraciones para perfiles guardados~~ | ~~🔴 Alta~~ | ~~`profileStorage.ts`~~ | ~~No~~ | ✅ **Resuelto** |
| ~~DT-005~~ | ~~Natural 1 / Natural 20 sin implementación~~ | ~~🔴 Alta~~ | ~~`attackResolver.ts`~~ | ~~Sí~~ | ✅ **Resuelto** |
| ~~DT-006~~ | ~~CombatSnapshot mapeo manual sin auto-verificación~~ | ~~🟡 Media~~ | ~~`combatSnapshot.ts`~~ | ~~No~~ | ✅ **Resuelto** |
| ~~DT-007~~ | ~~Límite de 1 AdO por criatura sin implementar~~ | ~~🟡 Media~~ | ~~`rules.ts`, `attackCommands.ts`~~ | ~~No~~ | ✅ **Resuelto** |
| DT-008 | Ownership acoplado imperativamente | 🟡 Media | Handlers de commands | No |
| DT-009 | E2E tests frágiles ante mecánicas de dados | 🟡 Media | `e2e-websocket.mjs` | No |
| DT-010 | Tests de UI inexistentes | 🟡 Media | `apps/web` | No |
| DT-011 | Ataque completo sin ataques iterativos reales | 🟡 Media | `attackCommands.ts` | No (nivel bajo) |
| DT-012 | EquipmentCatalog estático sin soporte de buffs | 🟡 Media | `equipmentCatalog.ts` | No |
| DT-013 | Stack de buffs sin validación de tipo | 🟢 Baja | `buffRules.ts` | No |
| DT-014 | Sin pérdida automática de HP (moribundo) | 🟢 Baja | `turnManager.ts` | No |
| DT-015 | Documentación fragmentada | 🟢 Baja | Docs | No |
| DT-016 | DurationPolicy acoplado al número de ronda | 🟢 Baja | `effects/tick.ts` | No |
| ~~DT-017~~ | ~~Variantes de CA legacy sin desglose exacto~~ | ~~🟡 Media~~ | ~~`types.ts`, `combatSnapshot.ts`, `rules.ts`~~ | ~~No~~ | ✅ **Resuelto** |
| DT-018 | Correr: resistencia multi-asalto (Constitución/CD/descanso) diferida | 🟢 Baja | `rules.ts`, `tacticalCommands.ts` | No |
| DT-019 | Correr: bloqueo por visión/Cegado diferido (sin modelo de visión) | 🟢 Baja | `rules.ts` | No |

---

## Referencia de Documentos Relacionados

- [docs/audits/core-engine-audit.md](./audits/core-engine-audit.md): Auditoría técnica detallada original con análisis de subsistemas.
- [docs/designs/rule-coverage-matrix.md](./designs/rule-coverage-matrix.md): Matriz completa de cobertura de reglas.
- [docs/testing-coverage-report.md](./testing-coverage-report.md): Reporte de cobertura de tests.
- [TODO.md](../TODO.md): Roadmap ejecutivo por área.
- [PROJECT_STATUS.md](../PROJECT_STATUS.md): Foto actual del estado del proyecto.

## Cierre Sprint 030

Grapple Core V2 no introduce deuda técnica nueva. La selección restringida a arma principal ligera o ataque natural es alcance funcional explícito de V2; futuras acciones internas de Presa deben ampliar el catálogo de acciones sobre las mismas fronteras compartidas, sin bypasses en handlers o UI.

---

### DT-018: Correr — resistencia multi-asalto (Constitución/CD creciente/descanso) sin implementar

**Descripción**: Sprint 041 (`MOVE-RUN`) entrega el movimiento de Correr de un único asalto (×4/×3 velocidad, línea recta, terreno difícil bloqueado, pérdida de Destreza salvo dote). El RAW completo (`combat/07_movimiento.txt:33`) exige además: rondas gratuitas de Correr = puntuación de Constitución; agotadas esas rondas, una prueba de Constitución (CD 10, +1 por ronda adicional) cada asalto que se mantenga la carrera; al fallar, detenerse; y un descanso obligatorio de 10 asaltos (1 minuto) antes de poder volver a correr. Ninguna de estas piezas está implementada — es una decisión explícita de acotación de alcance (D-2 del NDD), no un olvido.

**Riesgo**: Un combatiente puede correr indefinidamente asalto tras asalto sin límite de resistencia. Bajo, dado que Correr ya es una acción de asalto completo que expone al personaje (pérdida de Destreza salvo dote) y consume el turno igual que Carga/Retirada.

**Módulo afectado**: `packages/shared/src/rules.ts` (`canRun`), `apps/server/src/commands/tacticalCommands.ts` (`handleRun`). Requeriría estado nuevo persistente entre turnos (asaltos corriendo consecutivos, última CD intentada), hoy inexistente — toda la economía de turno vive en `TurnState`, que se reinicia cada turno.

**Recomendación**: Diseñar en un sprint propio (NDD dedicado) el estado de resistencia multi-asalto antes de implementarlo; no improvisar contadores ad-hoc en el handler de Correr.

**Bloquea MVP**: No.

---

### DT-019: Correr — bloqueo por "no ver hacia dónde vas" sin implementar (depende de un modelo de visión/Cegado)

**Descripción**: El RAW de Correr (`combat/07_movimiento.txt:33`) prohíbe correr si el personaje no puede ver hacia dónde va. El motor no tiene todavía ningún modelo real de visión ni de la condición Cegado — deuda ya registrada de forma general en el Sprint MOVE-WITHDRAW ("exención pro-defensor ante invisibles y Cegado sin validar"). Sprint 041 (`MOVE-RUN`, decisión D-4) difiere explícitamente esta restricción hasta que exista dicho modelo, en vez de introducir una heurística parcial.

**Riesgo**: Un combatiente Cegado o sin línea de visión hacia su destino puede correr igualmente. Bajo en el estado actual del motor (Cegado tampoco está modelado como condición jugable todavía).

**Módulo afectado**: `packages/shared/src/rules.ts` (`canRun`); comparte el mismo punto de extensión futuro que usará Retirada para su deuda de visión equivalente.

**Recomendación**: Cuando se diseñe el modelo de visión/Cegado, conectar tanto Correr como Retirada al mismo gate — no acoplar la solución a una sola de las dos acciones.

**Bloquea MVP**: No.

---

### ~~DT-020: `tests/withdraw-server.test.mjs` importa un módulo inexistente (`validation/index.ts`) — el archivo entero nunca ejecuta~~ ✅ RESUELTO (Sprint 042.5)

**Descripción**: Hallazgo del gate de validación de Sprint 041 (`MOVE-RUN`), al instalar por primera vez los binarios nativos `linux-x64` de `esbuild`/`rollup` en el sandbox y lograr ejecutar `tsx` de verdad contra toda la suite. `tests/withdraw-server.test.mjs` (Sprint 040, `MOVE-WITHDRAW`) importa `../apps/server/src/validation/index.ts`, archivo que no existe — el módulo real es `apps/server/src/validation/validateClientCommand.ts`. Al ser un `import` estático ESM, Node aborta la carga completa del archivo con `ERR_MODULE_NOT_FOUND` antes de registrar un solo `test()`; confirmado en aislamiento (`npx tsx --test tests/withdraw-server.test.mjs` → `1 test, 0 pass, 1 fail`) y reproducido de forma idéntica en un `git worktree` del commit previo a Sprint 041 (`3190182`), por lo que es un defecto pre-existente de Sprint 040, no una regresión de Correr. Quedó invisible hasta ahora porque en sandboxes anteriores `tsx` nunca llegaba a intentar cargar el archivo (bloqueo ambiental previo de `esbuild`/`rollup`, ver DT-018/DT-019 y walkthroughs de Sprint 040/041).

**Riesgo**: Las 18 aserciones server-side de Retirada (`W-S*`... en realidad prefijo distinto, ver el propio archivo) documentadas como "pendientes de Windows" en el walkthrough de MOVE-WITHDRAW nunca se ejecutaron ni siquiera allí — el archivo está roto desde su commit original. Bajo impacto funcional inmediato (Retirada tiene cobertura pura equivalente en `tests/withdraw.test.mjs`, que sí corre en verde), pero la cobertura de integración servidor de Retirada es hoy inexistente en la práctica.

**Módulo afectado**: `tests/withdraw-server.test.mjs` (solo el import, línea 4). No afecta código de producción ni a `run-server.test.mjs` (Sprint 041), que importa correctamente `validateClientCommand.ts` y corre 15/15 en verde.

**Recomendación**: Corregir el import (`validation/index.ts` → `validation/validateClientCommand.ts`) en un cambio aislado de un solo archivo de test, y confirmar en verde antes de cerrarla. No requiere NDD por ser una corrección mecánica de un path de import en un test, sin tocar reglas ni arquitectura — sí requiere aprobación explícita antes de tocar el archivo, según el flujo del proyecto.

**Bloquea MVP**: No, pero deja sin cobertura real de integración a Retirada hasta que se corrija.

**Actualización (Sprint 041.5, 2026-07-18)**: Corregido el import (`validation/index.ts` → `validation/validateClientCommand.ts`, línea 4). Al inspeccionar el archivo completo se encontró un segundo defecto del mismo origen (caso W24, líneas 174-177): las aserciones comparaban `bad.ok`/`good.ok`, un campo que nunca existió en el contrato de `validateClientCommand` (que devuelve `{ success, data }` o `{ success, error }`, igual que `run-server.test.mjs`, `sprint010.test.mjs` y `websocket-validation.test.mjs`); corregido a `.success`. No se tocó ninguna otra aserción ni lógica de negocio.

**Ejecución real bloqueada por una limitación de entorno ajena a este defecto**: en el sandbox Windows usado para este sprint, `npx tsx --test tests/withdraw-server.test.mjs` falla con `ERR_MODULE_NOT_FOUND` al resolver `@dnd-tactical/shared` — pero el mismo error, idéntico, se reproduce ejecutando `tests/rules.test.mjs` y `tests/run-server.test.mjs` (este último documentado como "15/15 en verde" en otro entorno), archivos no tocados por este sprint. Causa raíz identificada por inspección: `node -e "require('fs').realpathSync('node_modules/@dnd-tactical/shared')"` devuelve `EACCES: permission denied` — el symlink de workspace (creado, a juzgar por `@esbuild/linux-x64` presente en `node_modules`, en un sandbox Linux distinto) no puede ser resuelto por el Node nativo de Windows en esta máquina. Es el mismo bloqueo de "mismatch de binarios/entorno multiplataforma" ya documentado repetidamente en `PROJECT_STATUS.md` para los Sprints 034-041, aplicado ahora también a la resolución de módulos y no solo a binarios nativos de `esbuild`/`rollup`. No se intentó reparar este symlink por estar fuera del alcance estricto de este sprint (cierre exclusivo de DT-020).

**Verificación por inspección (sustituta de la ejecución, según el propio gate de este sprint)**: el import corregido apunta al único archivo real de `apps/server/src/validation/` (`validateClientCommand.ts`, que exporta `validateClientCommand`); el patrón de uso (`.success`/`.error`, invocación de `handleUseTacticalAction`, `makeCombatant`/`makeRoom`) es estructuralmente idéntico al de `tests/run-server.test.mjs`, que sí corre en verde en un entorno sin el bloqueo de symlinks descrito arriba. Con esa evidencia, el defecto original de DT-020 (import roto) se considera corregido; la deuda se mantiene abierta únicamente como "pendiente de confirmación de ejecución real en una máquina/sandbox sin el bloqueo de symlinks de workspace" — no debe cerrarse con checkmark hasta esa confirmación.

**✅ RESUELTA por completo (Sprint 042.5, 2026-07-18)**: el bloqueo de symlinks descrito arriba se resolvió solo en este entorno (sin intervención) y `tests/withdraw-server.test.mjs` corrió de verdad por primera vez: 13/13 casos, incluido W22, que **falló** con un defecto distinto y real (regex `/a traves de/` no coincide con el mensaje de producción correcto `"...no puede atravesar..."`; ver Sprint 042-R/042.5). Corregido el regex a `/atravesar/`; archivo completo 13/13 en verde confirmado por ejecución real, no por inspección. DT-020 queda cerrada.

---

### ~~DT-021: `cloneEffectInstances` no propagaba `targetCells` — hazards ambientales inoperantes en producción~~ ✅ RESUELTO (Sprint 042.5)

**Descripción**: hallazgo de la auditoría de baseline Sprint 042-R, confirmado y corregido en Sprint 042.5. `packages/shared/src/combatSnapshot.ts::cloneEffectInstances` (usada por `createCombatRulesSnapshot`, invocada en cada resolución de comando) es una lista blanca explícita de campos que nunca se actualizó cuando Sprint 034 agregó `targetCells` a `EffectInstance` para modelar peligros ambientales anclados a celda (Muro de Fuego, gas venenoso, etc.). El campo se perdía silenciosamente en cada snapshot, por lo que `getEnvironmentalHazardHits` (que filtra por `instance.targetCells`) nunca detectaba ningún hazard — ni en los 5 tests de `tests/environmental-hazards.test.mjs` (que fallaban desde entonces) ni en una partida real (`apps/server/src/combat/environmentalHazardResolver.ts::resolveEnvironmentalHazards`, invocado desde `turnManager.advanceTurn`, usa el mismo snapshot roto).

**Por qué ocurrió**: existe una segunda implementación independiente del mismo clonado de `EffectInstance` en `packages/shared/src/effects/manager.ts` (`EffectManager.add`), que sí incluye `targetCells` correctamente desde Sprint 034. Las dos listas blancas divergieron — exactamente el antipatrón "una regla, dos fuentes" que `.ai/coverage/V1_LAUNCH_MANIFESTO.md` prohíbe para reglas de juego, reproducido aquí en lógica de clonado de infraestructura.

**Auditoría de clones equivalentes (Sprint 042.5)**: se revisaron todos los helpers de clonado/copia del monorepo (`cloneCombatRoom`/`structuredClone` en `roomTransaction.ts` y `abilityCommands.ts` — inmunes por construcción, `structuredClone` es exhaustivo; el resto de `createCombatRulesSnapshot` en `combatSnapshot.ts` — usa spread (`...c`, `...o`) como base en `combatants`, `currentTurn`, `pendingOpportunityAttacks`, `activeAttackThreat`, por lo que un campo nuevo de nivel superior no se perdería). Se encontraron otros dos bloques que usan lista blanca explícita sin spread base — la misma clase de patrón frágil, pero **sin bug activo hoy** porque coinciden exactamente con sus tipos actuales: el bloque `board: {...}` dentro de `createCombatRulesSnapshot` (6 campos, coincide con `Board`) y `activeAttackThreat.normalDamageBundle: { total, components }` (coincide con `DamageBundle`). No se tocaron — no son bugs, son riesgo latente documentado aquí para que quien agregue un campo nuevo a `Board` o `DamageBundle` sepa que debe actualizar también estos dos puntos.

**Resolución**: se agregó `targetCells` a la lista blanca de `cloneEffectInstances`, en paridad exacta con `EffectManager.add`. Se amplió `tests/dt-006-snapshot-integrity.test.mjs` con un caso que construye un `EffectInstance` con todos sus campos actuales y compara por `assert.deepStrictEqual` contra el clonado del snapshot — verifica comportamiento (¿se preserva todo lo que entró?), no la lista de campos de la implementación, por lo que un campo futuro no propagado por *cualquier* clon de `EffectInstance` (no solo `targetCells`) volverá a poner este test en rojo automáticamente. Confirmado que el nuevo test efectivamente detecta el bug (se revirtió el fix temporalmente y el test falló con el diff exacto del campo faltante, antes de restaurar el fix).

**Módulo afectado**: `packages/shared/src/combatSnapshot.ts` (`cloneEffectInstances`), `apps/server/src/combat/environmentalHazardResolver.ts` (consumidor real afectado), `tests/environmental-hazards.test.mjs` (5 casos, ahora en verde sin cambios), `tests/dt-006-snapshot-integrity.test.mjs` (ampliado).

**Bloqueaba MVP**: la funcionalidad de hazards ambientales (Sprint 034) estaba de hecho inoperante en cualquier partida real desde su introducción — ahora resuelto.
