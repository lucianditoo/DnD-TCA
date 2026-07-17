# FILE_INDEX — Mapa rápido de archivos clave

Para cada archivo: responsabilidad · qué modificar · qué NO hacer.

---

## Servidor (`apps/server/`)

### `apps/server/src/index.ts`
**Responsabilidad**: Punto de entrada del servidor WebSocket. Acepta conexiones, recibe mensajes, llama a `validateClientCommand` y luego al dispatcher.

**Podés modificar**: Configuración del servidor, port, CORS, manejo de conexión/desconexión.

**No hagas**: Agregar lógica de negocio aquí. No poner reglas de combate. No saltear la validación Zod.

---

### `apps/server/src/commands/dispatcher.ts`
**Responsabilidad**: Enruta cada `ClientCommand` validado al handler correspondiente según el `type` del comando.

**Podés modificar**: Agregar nuevos casos cuando se agrega un nuevo tipo de comando (después de crear el schema Zod y el handler).

**No hagas**: Poner lógica de negocio en el dispatcher. No ignorar errores silenciosamente.

---

### `apps/server/src/commands/attackCommands.ts`
**Responsabilidad**: Handlers de ataques: `resolve-attack`, `resolve-attack-confirmation`, `cancel-attack-threat`, `resolve-opportunity-attack`.

**Podés modificar**: Lógica de handlers existentes tras pasar por FASE 2–4 del workflow. Agregar nuevas mecánicas de ataque (ataques iterativos, etc.).

**No hagas**: Mover lógica de reglas puras aquí. Las reglas viven en `packages/shared/src/rules.ts`. No duplicar la lógica de `resolveThreatOutcome`.

---

### `apps/server/src/commands/movementCommands.ts`
**Responsabilidad**: Handlers de movimiento: `move`, `move-path`, `gm-move`.

**Podés modificar**: Agregar validaciones de movimiento (ej: paso a través de aliados/enemigos, DT-002).

**No hagas**: Poner cálculos de distancia o reglas de movimiento aquí; eso va en `rules.ts`.

---

### `apps/server/src/combat/attackResolver.ts`
**Responsabilidad**: Función pura (en la práctica muta la sala — DT-001) que resuelve un ataque completo: calcula impacto, daño, amenaza de crítico y log. También resuelve la confirmación de crítico.

**Podés modificar**: Agregar Damage Reduction, condiciones de inmunidad, ataques iterativos, una vez diseñados.

**No hagas**: Mover aquí lógica que ya está en `rules.ts`. No saltear `isCriticalThreat`/`isCriticalConfirmed`. No olvidar el mínimo de 1 de daño.

---

### `apps/server/src/auth/control.ts`
**Responsabilidad**: `requireCombatantControl` y `requireTurnControl` — verifican que el actor que envió el comando tiene permiso de controlar ese combatiente.

**Podés modificar**: Añadir roles nuevos si el sistema de ownership cambia.

**No hagas**: Saltear estas funciones en handlers. No poner lógica de combate aquí.

---

### `apps/server/src/validation/validateClientCommand.ts`
**Responsabilidad**: Valida el payload del comando con Zod antes de que llegue al dispatcher. Devuelve error seguro al cliente si el payload es inválido (sin stack trace interno).

**Podés modificar**: Actualizar schemas cuando se agrega un nuevo comando.

**No hagas**: Saltear esta función en el flujo de `index.ts`. No exponer detalles internos del servidor en mensajes de error.

---

### `apps/server/src/room/roomState.ts`
**Responsabilidad**: Manejo central de fases (`syncEncounterPhase`), Helpers de estado de sala: encontrar combatientes, calcular outcome, log de cambio de estado, distancias de movimiento.

**Podés modificar**: Agregar helpers de estado nuevos.

**No hagas**: Poner reglas de D&D aquí. No mutar combatants directamente sin pasar por las funciones de `rules.ts`.

---

## Shared (`packages/shared/`)

### `packages/shared/src/types.ts`
**Responsabilidad**: Definición de todos los tipos TypeScript del proyecto: `CombatRoom`, `Combatant`, `ClientCommand`, `ServerMessage`, `AttackThreatState`, etc.

**Podés modificar**: Agregar campos a tipos existentes (con cuidado — puede afectar snapshots guardados), agregar tipos nuevos.

**No hagas**: Cambiar el contrato de `ClientCommand` o `ServerMessage` sin diseño previo y sin actualizar schemas Zod y E2E.

---

### `packages/shared/src/rules.ts`
**Responsabilidad**: Todas las reglas puras de combate D&D 3.5: `validateMovePath`, `isCriticalThreat`, `isCriticalConfirmed`, `applyDamage`, `totalAttackBonus`, `totalArmorClass`, `canMakeOpportunityAttack`, etc.

**Podés modificar**: Agregar o corregir funciones de reglas. Aquí viven las reglas, no en los handlers.

**No hagas**: Poner lógica de UI aquí. No usar efectos secundarios ni mutar el estado directamente. Mantener funciones puras.

---

### `packages/shared/src/combatSnapshot.ts`
**Responsabilidad**: `createCombatRulesSnapshot` — crea una vista inmutable (congelada con `Object.freeze`) de la sala para calcular reglas sin riesgo de mutación accidental.

**Podés modificar**: Agregar campos al snapshot cuando se agrega un sistema nuevo.

**No hagas**: Romper el `Object.freeze`. No agregar lógica de negocio aquí.

---

### `packages/shared/src/equipmentCatalog.ts`
**Responsabilidad**: Catálogo estático de armas, armaduras y escudos con sus propiedades completas. Fuente de verdad para derivar stats de equipo.

**Podés modificar**: Agregar nuevos items de equipo.

**No hagas**: Cambiar el tipo de las propiedades sin actualizar todos los lugares que las usan. No poner items con stats incompletos.

---

### `packages/shared/src/equipmentStats.ts`
**Responsabilidad**: Funciones para derivar stats de un combatiente a partir de sus IDs de equipo y el catálogo.

**Podés modificar**: Añadir derivaciones nuevas (ej: bonos de escudo al CMD, velocidad de armadura pesada).

**No hagas**: Sobrescribir stats manuales de monstruos cuando no hay equipo definido. Respetar: si no hay equipo → preservar valores manuales.

---

### `packages/shared/src/schemas/commands/`
**Responsabilidad**: Schemas Zod por dominio de comando. Un archivo por grupo: `attackCommands.ts`, `movementCommands.ts`, `tacticalCommands.ts`, `gmCommands.ts`, `combatantCommands.ts`, `abilityCommands.ts`, `roomCommands.ts`, `initiativeCommands.ts`.

**Podés modificar**: Agregar campos a schemas existentes o crear schemas nuevos.

**No hagas**: Relajar validaciones para "hacer pasar" payloads inválidos. No crear un schema gigante en `index.ts` — mantener estructura por dominio.

---

## Frontend (`apps/web/`)

### `apps/web/src/App.tsx`
**Responsabilidad**: Componente raíz de la UI. Maneja la conexión WebSocket, el estado local del cliente, el renderizado del board y los paneles.

**Podés modificar**: Agregar paneles, controles, botones, estilos.

**No hagas**: Poner reglas de D&D aquí. No tomar decisiones de combate en el cliente. No confiar en datos del cliente para calcular resultados.

---

### `apps/web/src/viewModel.ts`
**Responsabilidad**: Transforma el estado del servidor (`CombatRoom`) en datos listos para renderizar en la UI. Cálculos puramente de presentación.

**Podés modificar**: Agregar transformaciones de presentación.

**No hagas**: Poner reglas de combate aquí. Este archivo no tiene autoridad sobre el estado del juego.

---

## Tests y Scripts

### `tests/`
**Responsabilidad**: Tests unitarios organizados por dominio. Actualmente: `rules.test.mjs`, `critical-flow.test.mjs`, `attack-rules.test.mjs`, `combat-rules.test.mjs`, `validation.test.mjs` y otros.

**Podés modificar**: Agregar tests nuevos cuando se implementa una feature o se corrige un bug.

**No hagas**: Borrar tests para hacer pasar el build. No deshabilitar tests con `skip` sin justificación documentada.

---

### `scripts/e2e-websocket.mjs`
**Responsabilidad**: Suite E2E que levanta una sala real por WebSocket y ejecuta flujos completos de combate. Cubre ownership, movimiento, ataques, AdO, carga, prestar ayuda, etc.

**Podés modificar**: Agregar casos E2E cuando se implementan features nuevas.

**No hagas**: Usar valores hardcodeados de dados que dependan de que el ataque impacte — la CA y el modificador deben ser predecibles en el escenario de test.
