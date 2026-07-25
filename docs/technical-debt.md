# Deuda Técnica Consolidada — D&D 3.5 Tactical Combat Engine

*Documento consolidado y saneado por última vez en Sprint 054A.*

> Este documento es la fuente única de verdad para la deuda técnica. Los documentos fuente solo deben **enlazar** hacia aquí, no duplicar la información.

---

## 🔴 Prioridad Alta

Estas deudas bloquean la implementación correcta de reglas futuras o representan riesgos activos de seguridad o corrupción de estado.

---

<a id="dt-001"></a>
### ~~DT-001: AttackResolver muta el estado de sala directamente (impuro)~~ ✅ RESUELTO

**Resolución (2026-07-08)**: `attackResolver.ts` fue refactorizado y ahora es 100% puro. Las funciones `resolveAttack` y `resolveCriticalConfirmation` devuelven una interfaz plana `AttackResult`. Todas las mutaciones imperativas (HP, stats, logs) se movieron a `apps/server/src/commands/attackCommands.ts` (específicamente en `applyAttackMutations` y `resolveThreatOutcome`).

---

<a id="dt-002"></a>
### ~~DT-002: Movimiento a través de aliados y enemigos sin implementar~~ ✅ RESUELTO

**Resolución (2026-07-08)**: Se implementó la lógica en `validateMovePath` en `rules.ts` para distinguir entre aliados, enemigos y criaturas indefensas. El frontend (`viewModel.ts` y `ActionsPanel.tsx`) ahora permite atravesar aliados e indefensos, y bloquea el botón de confirmación si se intenta terminar sobre una criatura consciente.

Cambios realizados:
- `validateMovePath`: Reglas exactas de ocupación y permiso de terminar sobre indefensos.
- `chargeResolver.ts`: Falla de carga con ruta bloqueada (incluso por criaturas muertas).
- `rules.test.mjs`: Tests exhaustivos para aliados, enemigos, y combatientes helpless.

---

<a id="dt-003"></a>
### ~~DT-003: Bloqueo de flujo de críticos y AdO es ad-hoc en el dispatcher~~ ✅ RESUELTO

**Resolución (2026-07-08)**: Se centralizó el estado en una máquina formal (`EncounterPhase`) calculada dinámicamente mediante `syncEncounterPhase(room)` en `roomState.ts`. A su vez, `dispatcher.ts` verifica esta fase y bloquea activamente la ejecución de comandos inválidos.

---

<a id="dt-004"></a>
### ~~DT-004: No existe validación de payload de datos persistidos (perfiles guardados)~~ ✅ RESUELTO

**Resolución final (Sprint 012, 2026-07-15)**: `profileStorage.ts` usa un sobre V3 y schemas Zod estrictos. Migra entradas anteriores de forma determinista e idempotente solo cuando tipo de criatura y features son explícitos o tienen un mapeo inequívoco, conserva backup, valida catálogos y pone perfiles opacos en cuarentena mediante `ProfileMigrationIssue`.

**Descripción histórica**: Antes de Sprint 010, los perfiles se guardaban en localStorage como JSON plano y podían cargarse con datos incorrectos o ausentes después de un cambio de schema.

**Riesgo mitigado**: El envelope versionado, el backup previo a migración y la cuarentena evitan que datos opacos lleguen al combate silenciosamente.

**Módulo afectado**: `packages/shared/src/profileStorage.ts`, `packages/shared/src/types.ts`

**Impacto futuro**: Los próximos cambios de schema deben agregar una migración versionada explícita.

**Implementado**: Versión V3, migrador pre-V3 → V3, validación Zod y reporte visible de entradas en cuarentena.

**Bloquea MVP**: No inmediatamente, pero crítico a mediano plazo.

---

<a id="dt-005"></a>
### ~~DT-005: Natural 1 y Natural 20 sin implementación ni test~~ ✅ RESUELTO

**Resolución (2026-07-07)**: La lógica estaba correcta en `attackResolver.ts` línea 42 (ternario `d20Roll === 1 ? false : d20Roll === 20 ? true : ...`) y en `isCriticalThreat`/`isCriticalConfirmed` en `rules.ts`. Lo que faltaban eran los tests explícitos de nivel de resolver y el log diferenciado.

Cambios realizados:
- `attackResolver.ts`: Variables explícitas `isNatural1` / `isNatural20` + log que dice "Falla automática (1 natural)" y "¡Impacto automático! (20 natural)".
- `tests/attack-rules.test.mjs`: Nuevo archivo con 9 tests de regresión que cubren el resolver completo.

**Tests agregados**: `tests/attack-rules.test.mjs` — 9 casos sobre natural 1/20 y ataques ordinarios.

---

<a id="dt-006"></a>
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



<a id="dt-007"></a>
### ~~DT-007: Límite de 1 AdO por criatura por ronda sin implementar~~ ✅ RESUELTO

**Resolución (Sprint 021, 2026-07-16)**: D&D 3.5 exige que un combatiente realice como máximo 1 Ataque de Oportunidad por ronda, o más si posee "Reflejos de Combate" (1 + Mod DEX), pero nunca más de 1 AdO contra el mismo objetivo en la misma ronda. Se implementó un tracking inmutable en `CombatantStats` (`opportunityAttacksThisRound` y `targetsAttackedThisRoundViaAoO`) que se incrementa en `attackCommands.ts` de forma atómica. La validación autoritativa en `rules.ts` restringe los ataques correctamente respetando los históricos (Irreversibilidad a 20 sprints) y la regla del objetivo único. El contador se resetea vía `tickLayer.ts` puramente al comienzo de cada ronda.

---

<a id="dt-008"></a>
### DT-008: Ownership acoplado imperativamente en cada handler

**Descripción**: Las comprobaciones de `requireCombatantControl` y `requireTurnControl` están duplicadas en cada handler de comando individualmente. No existe middleware centralizado.

**Riesgo**: Si se crea un handler nuevo y se olvida agregar la comprobación, se genera una vulnerabilidad de seguridad donde jugadores pueden controlar combatientes ajenos.

**Módulo afectado**: Todos los handlers en `apps/server/src/commands/`

**Recomendación**: Definir metadata de ownership por tipo de comando en el schema Zod y procesar la verificación en el dispatcher antes de llamar al handler.

**Bloquea MVP**: No, pero es un riesgo de seguridad que crece con cada nuevo comando.

---

<a id="dt-009"></a>
### DT-009: E2E Tests son frágiles ante cambios en mecánicas de dados

**Descripción**: El script E2E usa valores de d20 fijos. Cuando se agregó el sistema de críticos, los tests que usaban `d20Roll: 20` empezaron a fallar porque el servidor interceptaba el 20 como amenaza de crítico y bloqueaba la resolución del flujo. Los valores tuvieron que cambiarse a 15.

**Riesgo**: Fragilidad mantenedora. Cualquier mecánica nueva que intercepte valores específicos de dado puede romper el E2E.

**Módulo afectado**: `scripts/e2e-websocket.mjs`

**Recomendación**: Agregar un modo de test en el servidor que permita inyectar dados predeterminados o desactivar tiradas de confirmación de crítico, separando la prueba del flujo de la prueba del valor de dado.

**Bloquea MVP**: No.

**Mitigación parcial (Sprint 024, 2026-07-16)**: las pruebas unitarias del lanzamiento inyectan un roller interno determinista sin exponer tiradas en el contrato WebSocket. El E2E de salvación acepta ambos resultados legales y verifica invariantes de estado, por lo que esta nueva mecánica no amplía la fragilidad. La deuda permanece abierta para los escenarios históricos de ataque/crítico.

---

<a id="dt-010"></a>
### DT-010: Tests unitarios/de componente de UI inexistentes

**Descripción**: No existe ningún test unitario ni de componente para
`apps/web`. Sí existe una suite Playwright de flujos críticos; esta deuda no
afirma que la UI carezca de toda cobertura.

**Riesgo**: Regresiones silenciosas en la interfaz tras actualización de dependencias o refactors.

**Módulo afectado**: `apps/web/src/components/*`

**Recomendación**: Instalar Vitest + React Testing Library en `apps/web`. Comenzar con tests de `ActionsPanel` (los controles de combate más críticos) y `ProfilesPage`.

**Bloquea MVP**: No.

---

<a id="dt-011"></a>
### ~~DT-011: Ataque completo sin ataques iterativos reales~~ ✅ RESUELTO (verificado en Sprint 044)

**Descripción histórica**: El sistema marcaba el turno como "ataque completo" pero no generaba ataques iterativos por BAB (BAB 6/1, 11/6/1, etc.). El ataque completo era solo un marcador de acción.

**Resolución (Sprint 036, verificada por código y tests en Sprint 044)**: `packages/shared/src/rules.ts` implementa `getAttackRoutine` y `getEffectiveAttackRoutine` (read-model puro que compone `getAttackRoutine` + `Rules.totalAttackBonus`), con progresión real de ataques iterativos por umbral de BAB. Confirmado en uso activo desde `attackCommands.ts` y `ActionsPanel.tsx`. Tests: `iterative-attacks-effective-routine.test.mjs` (5/5), `full-attack.test.mjs`. Ver Rule ID `ATTACK-FULL` en `docs/rules/registry.md` (Completo).

**Alcance pendiente, no confundir con esta deuda**: Disparo Rápido, Haste
real y otros productores de ataques extra siguen pendientes como componentes
de la única regla `ATTACK-FULL`. No existe ni debe restaurarse una Rule ID de
versión. El estado oficial de `ATTACK-FULL` vive en el Registry.

**Módulo afectado**: `packages/shared/src/rules.ts`, `apps/server/src/commands/attackCommands.ts`.

**Bloquea MVP**: No — deuda cerrada.

---

<a id="dt-012"></a>
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

<a id="dt-013"></a>
### DT-013: Stack de buffs del mismo tipo sin validación

**Descripción**: Múltiples buffs del mismo tipo (ej. dos Bless) pueden acumularse y sumar bonificadores incorrectamente. D&D 3.5 tiene reglas de no-stack por tipo de bonificador.

**Módulo afectado**: `apps/server/src/combat/buffRules.ts`

**Recomendación**: Agregar campo `bonusType` al modelo de `Buff` y validar que solo el mayor bonificador de cada tipo se aplique.

**Bloquea MVP**: No.

---

<a id="dt-014"></a>
### ~~DT-014: Pérdida automática de 1 HP por ronda (combatiente moribundo) sin implementar~~ ✅ RESUELTO (verificado en Sprint 044)

**Descripción histórica**: Un combatiente moribundo debería perder 1 HP automáticamente al inicio de cada turno. Esto no ocurría.

**Resolución (Sprint 021, verificada por código y tests en Sprint 044)**: `apps/server/src/combat/turnManager.ts` implementa `roundTickListener`, que desangra pasivamente a los combatientes moribundos en cada ronda mediante el Tick Layer del Event Bus. Confirmado también en el Apéndice A de `docs/audits/combat-rules-deviations.md` (fila `COND-02`, "Resuelta"). Tests: `global-round-tracker.test.mjs`. Ver Rule IDs `ROUND-TRACKER`/`EFFECT-DYING-BLEED` en `docs/rules/registry.md` (ambos Completo).

**Módulo afectado**: `apps/server/src/combat/turnManager.ts`.

**Bloquea MVP**: No — deuda cerrada.

---

<a id="dt-015"></a>
### ~~DT-015: Documentación fragmentada entre múltiples archivos~~ ✅ RESUELTO (Sprint 054A)

**Descripción histórica**: La deuda técnica y el estado del proyecto estaban
dispersos entre `core-engine-audit.md`, `PROJECT_STATUS.md`, `TODO.md` y
walkthroughs.

**Resolución**: Sprint 054A fijó una fuente canónica por responsabilidad,
consolidó aquí el estado de cada deuda, redujo `PROJECT_STATUS.md`, `TODO.md` y
`ROADMAP.md` a sus funciones operativas y corrigió las rutas activas hacia
documentos reemplazados. `INDEX.md` y `.ai/README.md` publican la jerarquía.

**Módulo afectado**: documentación raíz, `.ai/` y `docs/`.

**Bloquea MVP**: No — deuda cerrada.

---

<a id="dt-016"></a>
### DT-016: DurationPolicy acoplado al número de ronda

**Descripción**: La evaluación de efectos con duración en rondas en ActiveEffects (Fase 6) asume que la duración expira comprobando `event.round - appliedRound >= count`. Esto asume que el sistema de iniciativa es estático y el concepto de "ronda" es uniforme para todos.

**Riesgo**: Si se implementan reglas de alterar la iniciativa como "Preparar Acción" (Ready) o "Retrasar" (Delay), o sistemas de combate que eliminen el concepto global de "ronda", esta validación fallará.

**Módulo afectado**: `packages/shared/src/effects/tick.ts`, `contracts.ts`.

**Recomendación**: Evolucionar la política hacia una basada únicamente en ocurrencias del evento ancla (event occurrences), contando cuántas veces sucedió el evento desde la aplicación en lugar del número de ronda global.

**Bloquea MVP**: No.

---

<a id="dt-017"></a>
### ~~DT-017: Variantes de CA legacy sin desglose exacto~~ ✅ RESUELTO

**Resolución (2026-07-15)**: se eliminaron el retorno de `armorClass` plano y las estimaciones Touch/Flat-Footed. Las plantillas guardan fuentes explícitas; `createCombatantSnapshotFromProfile` deriva un breakdown completo y `totalArmorClass` falla con un error descriptivo si la invariante no se cumple. Todas las criaturas integradas fueron migradas.

**Descripción histórica**: Perfiles y monstruos anteriores a Sprint 009 podían conservar únicamente `armorClass` como escalar, por lo que Touch AC no podía reconstruirse exactamente.

**Mitigación definitiva**: Normal, Touch y Flat-Footed AC exigen el mismo desglose estructurado; los datos opacos son rechazados o puestos en cuarentena antes de entrar al motor.

**Módulo afectado**: `packages/shared/src/types.ts`, `combatSnapshot.ts`, `rules.ts`, datos de criaturas y perfiles persistidos.

**Implementado**: Catálogos migrados, perfiles V3 y derivación uniforme de `armorClassBreakdown`; Sprint 012 eliminó además todos los caches escalares residuales de snapshot, consumidores y fixtures.

**Bloquea MVP**: No; deuda cerrada.

---

## Índice

El estado canónico está únicamente en el encabezado y cuerpo de cada entrada;
este índice no lo repite:

[DT-001](#dt-001) · [DT-002](#dt-002) · [DT-003](#dt-003) ·
[DT-004](#dt-004) · [DT-005](#dt-005) · [DT-006](#dt-006) ·
[DT-007](#dt-007) · [DT-008](#dt-008) · [DT-009](#dt-009) ·
[DT-010](#dt-010) · [DT-011](#dt-011) · [DT-012](#dt-012) ·
[DT-013](#dt-013) · [DT-014](#dt-014) · [DT-015](#dt-015) ·
[DT-016](#dt-016) · [DT-017](#dt-017) · [DT-018](#dt-018) ·
[DT-019](#dt-019) · [DT-020](#dt-020) · [DT-021](#dt-021) ·
[DT-022](#dt-022) · [DT-023](#dt-023)

---

## Referencia de Documentos Relacionados

- [docs/audits/core-engine-audit.md](./audits/core-engine-audit.md): Auditoría técnica detallada original con análisis de subsistemas.
- [docs/rules/registry.md](./rules/registry.md): Rule IDs y estados oficiales.
- [docs/testing/master-coverage.md](./testing/master-coverage.md): evidencia
  canónica de tests.
- [TODO.md](../TODO.md): acciones pendientes.
- [PROJECT_STATUS.md](../PROJECT_STATUS.md): Foto actual del estado del proyecto.

<a id="dt-018"></a>
### DT-018: Correr — resistencia multi-asalto (Constitución/CD creciente/descanso) sin implementar

**Descripción**: Sprint 041 (`MOVE-RUN`) entrega el movimiento de Correr de un único asalto (×4/×3 velocidad, línea recta, terreno difícil bloqueado, pérdida de Destreza salvo dote). El RAW completo (`combat/07_movimiento.txt:33`) exige además: rondas gratuitas de Correr = puntuación de Constitución; agotadas esas rondas, una prueba de Constitución (CD 10, +1 por ronda adicional) cada asalto que se mantenga la carrera; al fallar, detenerse; y un descanso obligatorio de 10 asaltos (1 minuto) antes de poder volver a correr. Ninguna de estas piezas está implementada — es una decisión explícita de acotación de alcance (D-2 del NDD), no un olvido.

**Riesgo**: Un combatiente puede correr indefinidamente asalto tras asalto sin límite de resistencia. Bajo, dado que Correr ya es una acción de asalto completo que expone al personaje (pérdida de Destreza salvo dote) y consume el turno igual que Carga/Retirada.

**Módulo afectado**: `packages/shared/src/rules.ts` (`canRun`), `apps/server/src/commands/tacticalCommands.ts` (`handleRun`). Requeriría estado nuevo persistente entre turnos (asaltos corriendo consecutivos, última CD intentada), hoy inexistente — toda la economía de turno vive en `TurnState`, que se reinicia cada turno.

**Recomendación**: Diseñar en un sprint propio (NDD dedicado) el estado de resistencia multi-asalto antes de implementarlo; no improvisar contadores ad-hoc en el handler de Correr.

**Bloquea MVP**: No.

---

<a id="dt-019"></a>
### DT-019: Correr — bloqueo por "no ver hacia dónde vas" sin implementar

**Descripción**: El RAW de Correr (`combat/07_movimiento.txt:33`) prohíbe
correr si el personaje no puede ver hacia dónde va. Desde Sprint 047/053B el
motor ya dispone de `EFFECT-BLINDED` y `DEFENSE-VISION`, pero `canRun` todavía
no consume una proyección visual hacia el destino. La dependencia dejó de ser
"crear Vision"; el trabajo pendiente real es diseñar el gate compartido de
movimiento sin acoplarlo a una condición concreta.

**Riesgo**: Un combatiente Cegado o sin visión hacia su destino puede correr
igualmente.

**Módulo afectado**: `packages/shared/src/rules.ts` (`canRun`); comparte el mismo punto de extensión futuro que usará Retirada para su deuda de visión equivalente.

**Recomendación**: Diseñar una proyección visual de movimiento compartida por
Correr y Retirada; no ramificar por `effectId`.

**Bloquea MVP**: No.

---

<a id="dt-020"></a>
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

<a id="dt-021"></a>
### ~~DT-021: `cloneEffectInstances` no propagaba `targetCells` — hazards ambientales inoperantes en producción~~ ✅ RESUELTO (Sprint 042.5)

**Descripción**: hallazgo de la auditoría de baseline Sprint 042-R, confirmado y corregido en Sprint 042.5. `packages/shared/src/combatSnapshot.ts::cloneEffectInstances` (usada por `createCombatRulesSnapshot`, invocada en cada resolución de comando) es una lista blanca explícita de campos que nunca se actualizó cuando Sprint 034 agregó `targetCells` a `EffectInstance` para modelar peligros ambientales anclados a celda (Muro de Fuego, gas venenoso, etc.). El campo se perdía silenciosamente en cada snapshot, por lo que `getEnvironmentalHazardHits` (que filtra por `instance.targetCells`) nunca detectaba ningún hazard — ni en los 5 tests de `tests/environmental-hazards.test.mjs` (que fallaban desde entonces) ni en una partida real (`apps/server/src/combat/environmentalHazardResolver.ts::resolveEnvironmentalHazards`, invocado desde `turnManager.advanceTurn`, usa el mismo snapshot roto).

**Por qué ocurrió**: existe una segunda implementación independiente del mismo clonado de `EffectInstance` en `packages/shared/src/effects/manager.ts` (`EffectManager.add`), que sí incluye `targetCells` correctamente desde Sprint 034. Las dos listas blancas divergieron — exactamente el antipatrón "una regla, dos fuentes" que `.ai/coverage/V1_LAUNCH_MANIFESTO.md` prohíbe para reglas de juego, reproducido aquí en lógica de clonado de infraestructura.

**Auditoría de clones equivalentes (Sprint 042.5)**: se revisaron todos los helpers de clonado/copia del monorepo (`cloneCombatRoom`/`structuredClone` en `roomTransaction.ts` y `abilityCommands.ts` — inmunes por construcción, `structuredClone` es exhaustivo; el resto de `createCombatRulesSnapshot` en `combatSnapshot.ts` — usa spread (`...c`, `...o`) como base en `combatants`, `currentTurn`, `pendingOpportunityAttacks`, `activeAttackThreat`, por lo que un campo nuevo de nivel superior no se perdería). Se encontraron otros dos bloques que usan lista blanca explícita sin spread base — la misma clase de patrón frágil, pero **sin bug activo hoy** porque coinciden exactamente con sus tipos actuales: el bloque `board: {...}` dentro de `createCombatRulesSnapshot` (6 campos, coincide con `Board`) y `activeAttackThreat.normalDamageBundle: { total, components }` (coincide con `DamageBundle`). No se tocaron — no son bugs, son riesgo latente documentado aquí para que quien agregue un campo nuevo a `Board` o `DamageBundle` sepa que debe actualizar también estos dos puntos.

**Resolución**: se agregó `targetCells` a la lista blanca de `cloneEffectInstances`, en paridad exacta con `EffectManager.add`. Se amplió `tests/dt-006-snapshot-integrity.test.mjs` con un caso que construye un `EffectInstance` con todos sus campos actuales y compara por `assert.deepStrictEqual` contra el clonado del snapshot — verifica comportamiento (¿se preserva todo lo que entró?), no la lista de campos de la implementación, por lo que un campo futuro no propagado por *cualquier* clon de `EffectInstance` (no solo `targetCells`) volverá a poner este test en rojo automáticamente. Confirmado que el nuevo test efectivamente detecta el bug (se revirtió el fix temporalmente y el test falló con el diff exacto del campo faltante, antes de restaurar el fix).

**Módulo afectado**: `packages/shared/src/combatSnapshot.ts` (`cloneEffectInstances`), `apps/server/src/combat/environmentalHazardResolver.ts` (consumidor real afectado), `tests/environmental-hazards.test.mjs` (5 casos, ahora en verde sin cambios), `tests/dt-006-snapshot-integrity.test.mjs` (ampliado).

**Bloqueaba MVP**: la funcionalidad de hazards ambientales (Sprint 034) estaba de hecho inoperante en cualquier partida real desde su introducción — ahora resuelto.

---

<a id="dt-022"></a>
### ~~DT-022: `onStack` declarado en `EffectDefinition` desde Sprint 003 sin ningún consumidor real~~ ✅ RESUELTO (Sprint 049)

**Descripción**: hallazgo de la auditoría normativa de Sprint 049 (`EFFECT-EXHAUSTED`). El campo `EffectDefinition.onStack` (y `upgradeTo`) estaba declarado en `packages/shared/src/effects/contracts.ts` desde el diseño original de ActiveEffects, con cuatro valores posibles (`ignore`/`replace`/`upgrade_to`/`accumulate`), pero ningún módulo lo leía: ni `EffectManager.add` (puramente aditivo, sin comparar contra instancias existentes) ni `EffectReducer` (que solo resuelve `stackingGroup`/`stackingPolicy` a nivel de modificador numérico, un mecanismo distinto). En la práctica, cualquier `effectId` podía tener múltiples instancias simultáneas activas sobre el mismo objetivo, sin importar su `onStack` declarado.

**Evidencia de que el gap ya era conocido pero no corregido**: `tests/conditions-v3.test.mjs` (el test `srd_prone: instancias duplicadas no stackean el bono condicional`) documentaba en un comentario que "la política onStack:'ignore' bloquea el stackeo... en el EffectManager" y a la vez relajaba su propia aserción (`<= 10` en vez de `=== 10`) porque en la práctica dos instancias manuales sumaban el penalizador dos veces (14-4-4=6). El comentario describía un comportamiento aspiracional que nunca se implementó.

**Riesgo real, no solo hipotético**: `srd_poison_gas_hazard` usa `onFailEffectId:"srd_fatigued"` (`environmentalHazardResolver.ts`), que crea una instancia nueva de `srd_fatigued` cada ronda que el objetivo falla su salvación de Fortaleza mientras permanece en la nube. Sin consumo de `onStack`, un objetivo que fallara 3 salvaciones consecutivas terminaba con -6 STR/-6 DEX (tres instancias de -2/-2 sumadas por `stackingGroup:"penalty"`+`stackingPolicy:"sum"`), no -2/-2. Ningún test ejercitaba ese escenario.

**Resolución**: `EffectManager.add` es ahora el único punto de consumo de `onStack` (por instrucción explícita: nada de lógica en fuentes/handlers/hazards individuales). Implementa una resolución por "cadena de severidad" (`severityChain`, siguiendo los punteros `upgradeTo`): si el objetivo ya tiene una instancia del mismo `effectId`, se aplica su política (`ignore` la descarta, `upgrade_to` la reemplaza por una instancia del `upgradeTo`); si el objetivo ya tiene un miembro *más severo* de la misma cadena, la nueva aplicación es redundante y se descarta sin importar su propio `onStack`; si el objetivo tiene solo un miembro *más débil*, la nueva instancia (más severa) lo reemplaza. El tipo `onStack` se angostó de 4 a 2 valores (`"ignore" | "upgrade_to"`) tras confirmar, vía auditoría normativa SRD, que `"replace"`/`"accumulate"` no tienen ningún caso oficial que los requiera en este dominio (ver `docs/designs/exhausted-condition.md`).

**Módulo afectado**: `packages/shared/src/effects/contracts.ts` (tipo `onStack`), `packages/shared/src/effects/manager.ts` (`EffectManager.add`, `severityChain`), `packages/shared/src/effects/catalog.ts` (`srd_fatigued.upgradeTo`, nueva entrada `srd_exhausted`). Tests: `tests/active-effects.test.mjs` (7 casos nuevos de stacking), `tests/exhausted-condition.test.mjs`, comentario corregido en `tests/conditions-v3.test.mjs`.

**Bloqueaba MVP**: no bloqueaba el MVP, pero dejaba sin protección real cualquier condición reaplicada (Prone, Fatigued, y cualquier futura condición con `onStack`) — ahora resuelto de forma genérica, no solo para Exhausted.

---

<a id="dt-023"></a>
### DT-023: Deuda documental — ambigüedades de responsabilidad detectadas en la clasificación de Sprint 054C

**Descripción**: al aplicar la clasificación operativa SSOT/Derivado/Histórico/Temporal (`GOVERNANCE.md` §6.2.2, Sprint 054C) sobre el corpus documental, se detectaron las siguientes ambigüedades. Por alcance explícito del sprint, se registran **sin resolver** — no se eliminó, movió ni renombró ningún documento:

1. **`RULES_ENGINE.md`** solapa parcialmente la responsabilidad de `docs/rules/registry.md` ("reglas implementadas y pendientes") y de `PROJECT_STATUS.md`. Como vista derivada, pierde ante ambos en conflicto, pero su existencia exige mantenimiento por sprint — candidata a consolidación o reducción a puntero.
2. **`CODEX_GUIDE.md`** solapa `PROJECT_STATUS.md` (estado/features) y `ARCHITECTURE.md` (organización técnica). `README.md` lo presenta como "guía principal del proyecto", lo que compite con la puerta de entrada oficial del Reader Pipeline.
3. **Tres órdenes de lectura distintos** conviven: `README.md` ("Empieza por leer" con 7 documentos), `.ai/README.md` ("Orden de lectura" propio) e `INDEX.md`. Ninguno coincide exactamente con el Reader Pipeline oficial (P0→P1, `.agents/AGENTS.md` Fase 0); deben quedar como punteros al pipeline, no como órdenes paralelos.
4. **Tabla de fuentes canónicas duplicada** en `INDEX.md` y `.ai/README.md` — dos copias casi idénticas de la misma tabla, riesgo directo de divergencia (violación latente de `GOVERNANCE.md` §2.1).
5. **`.agents/AGENTS.md` §3** exige actualizar `CODEX_GUIDE.md`, `ARCHITECTURE.md` y `RULES_ENGINE.md` en cada funcionalidad importante, pese a que §6.2.2 los clasifica como vistas derivadas — tensión entre el costo de mantenimiento por sprint y su condición de derivadas (`GOVERNANCE.md` §6.6, paso 5).
6. **`.ai/WORKFLOW.md`** re-narra las fases de `AGENTS.md` con detalle propio (no es un mero enlace); como derivada con contenido extenso, es el punto de divergencia más probable cada vez que cambie el flujo — ya requirió sincronización manual en Sprints 052/054B.

**Riesgo**: bajo — ninguna ambigüedad afecta código ni reglas; el riesgo es deriva documental futura y confusión de onboarding, exactamente lo que la metodología de §6 busca prevenir.

**Módulo afectado**: solo documentación (`RULES_ENGINE.md`, `CODEX_GUIDE.md`, `README.md`, `.ai/README.md`, `.ai/WORKFLOW.md`, `INDEX.md`, `.agents/AGENTS.md` §3).

**Recomendación**: resolver en la próxima auditoría documental (`GOVERNANCE.md` §6.7) aplicando Migration First (§2.4) caso por caso: consolidar o reducir a puntero las derivadas con solapamiento, dejar un único orden de lectura (el Reader Pipeline) y una única tabla de fuentes canónicas (en `INDEX.md`). No resolver de forma incremental en sprints funcionales.

**Bloquea MVP**: No.
