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

### DT-011: Ataque completo sin ataques iterativos reales

**Descripción**: El sistema marca el turno como "ataque completo" pero no genera ataques iterativos por BAB (BAB 6/1, 11/6/1, etc.). El ataque completo es solo un marcador de acción.

**Riesgo**: Personajes de nivel alto (BAB ≥ 6) no tienen mecánica correcta de ataques iterativos.

**Módulo afectado**: `apps/server/src/commands/attackCommands.ts`

**Recomendación**: Diseñar el flujo de ataques iterativos antes de implementar personajes de nivel 6+. El diseño debe respetar las tiradas manuales del proyecto.

**Bloquea MVP**: No para personajes de nivel bajo.

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

### DT-014: Pérdida automática de 1 HP por ronda (combatiente moribundo) sin implementar

**Descripción**: Un combatiente moribundo debería perder 1 HP automáticamente al inicio de cada turno. Actualmente esto no ocurre.

**Módulo afectado**: `apps/server/src/combat/turnManager.ts`

**Recomendación**: Agregar tick de HP en `turnManager.ts` para combatientes en estado `dying`.

**Bloquea MVP**: No para la demo, pero es regla importante para tensión narrativa.

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
