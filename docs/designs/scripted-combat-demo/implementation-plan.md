# Plan de Implementación — Demostración Táctica Automática y Guionada

Responsabilidad: Plan técnico ejecutable para la vertical de demostración automática del motor de combate táctico.
Autoridad: Implementación de la vertical demo, subordinada al NDD aprobado (`docs/designs/scripted-combat-demo.md`, commit `f8c0e9d`).
Lifecycle: Permanente de la vertical
Reemplaza: —
Complementa: [docs/designs/scripted-combat-demo.md](../scripted-combat-demo.md), [INDEX.md](../../INDEX.md)
Consumidores: Architecture Gate, desarrolladores e implementadores del sprint de la demo.

> **Nota de gobernanza y resolución de ubicación:**  
> La raíz del repositorio contiene actualmente `implementation_plan.md` perteneciente al Sprint activo D-1B-I5R1 (Movement Resolution / Commit Remediation), el cual se encuentra pendiente de cierre formal por Architecture Gate y no puede ser sobrescrito ni cerrado en este sprint. Conforme a la política documental de gobernanza (`.agents/AGENTS.md` Fase 3 e `INDEX.md` §Decisiones, diseños y auditorías: *"cuando existen varios artefactos duraderos se co-ubican bajo `docs/designs/<feature>/`"*), este plan de implementación se ubica de forma duradera y no conflictiva en `docs/designs/scripted-combat-demo/implementation-plan.md`.

### Registro de Remediación R1 (Architecture Review, Commit auditado `51162fb`)
- **MAJOR 1 (Bootstrap de sala completo):** Especificado el flujo exacto de `start-demo` (generación de `roomCode`, registro en `roomStore.clients` como GM, despacho inmediato de `{ type: "hello", participant, room, catalog }` hacia el socket para que React transicione autónomamente desde `ConnectionPanel` a la vista de combate), `restart-demo` (actualización de registro en `clients` y reemisión de `hello`) y `exit-demo` (destrucción de sala y sesión, evento `demo-exited` y reseteo de estado cliente a `/`).
- **MAJOR 2 (Núcleo de Despacho Único):** Diseñado `dispatchCommandCore` como único núcleo autoritativo compartido; tanto comandos externos como internos ejecutan la misma validación Zod estricta (`validateClientCommand`), mismos gates de fase (`finished`, `opportunity-resolution`, `critical-confirmation`), misma autorización (`requireCombatantControl`, `requireTurnControl`, `requireGM`) y mismo `switch` de handlers. La entrada interna solo aporta el contexto autorizado y fuentes deterministas de RNG.
- **MAJOR 3 (Secuencias Legales Completas en Escenas B y C):** Enumerado el orden de iniciativa exhaustivo de todos los combatientes, todos los comandos `end-turn`, los turnos intermedios y las transiciones completas de asalto (Ronda 1 → Ronda 2). Se explicita cómo `advanceTurn` dispara `RoundStarted` y `roundTickListener` restaura las reacciones de todos los combatientes (`opportunityAttacksThisRound = 0`), permitiendo el segundo AdO legal del guardia en Ronda 2 ante *Hold Person*.
- **MAJOR 4 (Inventario de RNG de Derribo Completo):** Se incorpora en el inventario y en la tabla de tiradas el AdO interruptivo que provoca Cedrick al intentar Derribo sin la dote *Improved Trip*, asignándole tirada determinista de fallo del defensor (`d20 = 4`, daño 0) para que la maniobra prosiga legalmente a su toque y oposición.
- **MINOR 1 (Corrección de rutas):** Corregido `apps/web/src/components/App.tsx` a `apps/web/src/App.tsx` y `tests/ui/demo.spec.ts` a `tests-ui/demo.spec.ts`.
- **MINOR 2 (Ubicación E2E WebSocket):** Integración de la suite E2E de demo directamente en `scripts/e2e-websocket.mjs` para evitar ejecuciones fallidas durante `npm test` sin servidor activo.
- **MINOR 3 (Dominio cerrado de velocidades):** Restricción estricta de `speedMultiplier` a `0.5 | 1 | 2` tanto en contratos TypeScript como en schemas Zod (`z.union([z.literal(0.5), z.literal(1), z.literal(2)])`).

---

## 1. Archivos Afectados y Responsabilidades

| Archivo | Naturaleza | Responsabilidad |
|---|---|---|
| `packages/shared/src/types.ts` | Contratos | Declarar y exportar `DemoClientCommand`, `DemoServerEvent`, `DemoSessionState`, `DemoSpeedMultiplier` (`0.5 | 1 | 2`) y tipos asociados de la superficie de demo. |
| `packages/shared/src/schemas/commands/demoCommands.ts` | Validación | Schemas Zod estrictos para la validación en runtime de `DemoClientCommand` en el servidor (con `speedMultiplier` restringido a unión literal). |
| `packages/shared/src/demo/types.ts` | Definición | Tipos para guiones declarativos, definición de escenas, pasos, checkpoints de estado y mapeo de aliases. |
| `packages/shared/src/demo/catalog.ts` | Contenido | Definición declarativa inmutable de la demo `scripted_tactical_demo_v1` (Escenas A, B y C), incluyendo fixtures, posiciones, inventario, slots y secuencias de tiradas. |
| `packages/shared/src/index.ts` | Barrel | Re-exportar contratos, tipos y schemas de la demo. |
| `apps/server/src/commands/dispatcher.ts` | Servidor | Consolidar el núcleo de despacho compartido `dispatchCommandCore` (reutilizando validación Zod estricta, gates de fase y switches hacia handlers reales), y exponer `dispatchInternalDemoCommand` para el runner pasando `CommandExecutionContext`. |
| `apps/server/src/demo/sessionStore.ts` | Servidor | Registro efímero en memoria de sesiones de demo (`Map<string, DemoSession>`), control de propiedad por conexión, descarte de comandos obsoletos por secuencia y limpieza en desconexión. |
| `apps/server/src/demo/runner.ts` | Servidor | Orquestador autoritativo secuencial. Instancia la sala con control GM, mapea aliases a IDs generados, ejecuta un comando a la vez vía dispatcher interno, evalúa checkpoints asertivos, emite estado y maneja temporizadores de presentación. |
| `apps/server/src/demo/demoCommands.ts` | Servidor | Handlers para `DemoClientCommand` (`start-demo`, `pause-demo`, `resume-demo`, `step-demo`, `set-demo-speed`, `restart-demo`, `exit-demo`). Gestiona bootstrap con `hello`, resincronización en restart y cleanup en exit. |
| `apps/server/src/index.ts` | Servidor | Enrutar mensajes de control de demo hacia `demoCommands.ts` y registrar el hook de limpieza en `socket.on("close")`. |
| `apps/web/src/components/DemoPanel/DemoPanel.tsx` | UI | Panel visual de presentación: escena, paso, actor, intención, explicación mecánica y controles de reproducción. |
| `apps/web/src/App.tsx` | UI | Botón de acceso directo "Empezar demo" en `ConnectionPanel` y montaje condicional del `DemoPanel` sobre la sala activa. |
| `apps/web/src/hooks/useWebSocketRoom.ts` | UI | Escucha y suscripción a eventos `demo-session-state` y `demo-exited`, con reseteo de sala/participante al salir. |
| `tests/demo-contracts.test.mjs` | Tests | Validación de schemas Zod y serialización de mensajes de demo (incluyendo rechazo de velocidades no soportadas). |
| `tests/demo-runner.test.mjs` | Tests | Unit tests del runner: secuencia, checkpoints, pausas, errores, timeout y manejo de secuencia. |
| `tests/demo-isolation.test.mjs` | Tests | Verificación de aislamiento de sala, permisos GM, rechazo de comandos externos y limpieza tras salida/desconexión. |
| `tests/demo-rng.test.mjs` | Tests | Verificación de aislamiento estricto de RNG y consumo determinista de las fuentes inyectadas. |
| `scripts/e2e-websocket.mjs` | Script / Test | Integración E2E sobre WebSocket ejecutando en vivo las 3 escenas reales completas contra el servidor activo. |
| `tests-ui/demo.spec.ts` | Tests | Suite Playwright en navegador (`tests-ui/`) verificando la experiencia completa de usuario de punta a punta. |

---

## 2. Orden Incremental de Implementación y Validaciones

```text
[Etapa 1: Contratos y Schemas (@dnd-tactical/shared)]
    ↓ npm run build:shared && npm run typecheck:shared
[Etapa 2: Guion Declarativo y Fixtures (@dnd-tactical/shared)]
    ↓ node --test tests/demo-contracts.test.mjs
[Etapa 3: Núcleo de Despacho Compartido y Transporte de RNG (@dnd-tactical/server)]
    ↓ npm test (asegurar cero regresión en comandos existentes)
[Etapa 4: Sesión Efímera y Runner Autoritativo (@dnd-tactical/server)]
    ↓ node --test tests/demo-runner.test.mjs tests/demo-isolation.test.mjs tests/demo-rng.test.mjs
[Etapa 5: Integración WebSocket y Handlers de Demo (@dnd-tactical/server)]
    ↓ node scripts/e2e-websocket.mjs (ejecutando suite demo completa contra servidor en vivo)
[Etapa 6: Interfaz de Usuario y Controles (@dnd-tactical/web)]
    ↓ npm run build:web && npm run typecheck:web
[Etapa 7: Validación Playwright y Gate Completo (End-to-End)]
    ↓ npm test && npm run typecheck && npm run build && node scripts/e2e-websocket.mjs && npm run test:ui
```

### Etapa 1: Contratos y Schemas compartidos
- Definir en `packages/shared/src/types.ts` la unión discriminada `DemoClientCommand` y `DemoServerEvent`. Fijar `DemoSpeedMultiplier = 0.5 | 1 | 2`.
- Implementar schemas Zod estrictos (`.strict()`) en `packages/shared/src/schemas/commands/demoCommands.ts`, restringiendo `speedMultiplier` a `z.union([z.literal(0.5), z.literal(1), z.literal(2)])`.
- *Validación:* `npm --workspace @dnd-tactical/shared run build` y `npm run typecheck:shared`.

### Etapa 2: Guion Declarativo y Fixtures
- Crear perfiles source-first en `packages/shared/src/demo/catalog.ts` para los participantes de las Escenas A, B y C.
- Definir pasos, secuencias legales de iniciativa, explicaciones pedagógicas, parámetros de comandos y checkpoints observables.
- *Validación:* Test unitario `tests/demo-contracts.test.mjs` validando que el catálogo cumple los tipos y schemas.

### Etapa 3: Núcleo de Despacho Compartido y Transporte de RNG
- Refactorizar `apps/server/src/commands/dispatcher.ts` hacia `dispatchCommandCore(socket, command, context?)`, manteniendo un único núcleo autoritativo que ejecuta validación Zod estricta (`validateClientCommand`), gates de fase y el switch de handlers.
- Exportar `dispatchInternalDemoCommand(socket, command, context)` para el runner, garantizando que el comando pasa por `validateClientCommand` y `dispatchCommandCore` sin caminos paralelos ni omisión de validaciones normativas.
- Propagar `context.diceRoller` a `handleResolveAttack`, `handleCastSpell`, etc., y `context.maneuverDiceSource` a `handleResolveSpecialManeuver`.
- Mantener la función pública `dispatchCommand(socket, command)` invocada en `index.ts` sin alterar (sin opciones), garantizando que clientes de red normales nunca puedan inyectar dependencias de dados.
- *Validación:* Ejecución completa de la suite de tests existente (`npm test`), verificando cero regresiones en comandos normales.

### Etapa 4: Sesión Efímera y Runner Autoritativo
- Implementar `apps/server/src/demo/sessionStore.ts` con control estricto de propiedad por `socket` y mapa `Map<string, DemoSession>`.
- Implementar `apps/server/src/demo/runner.ts`:
  - Instanciar la sala con `createRoomCode()` y clon defensivo de `Board`.
  - Crear todos los combatientes con control GM (`controlledBy: { type: "gm" }`).
  - Mapear aliases declarativos (`"cedrick"`, `"bane"`, `"guard"`, etc.) a los IDs dinámicos generados durante la preparación.
  - Ejecutar un comando a la vez vía `dispatchInternalDemoCommand`, esperar retorno síncrono del handler, validar el checkpoint sobre el estado resultante.
  - Gestionar máquina de estados: `preparing` → `playing` / `paused` → `completed` / `failed`.
- *Validación:* Tests unitarios del runner, aislamiento y RNG (`tests/demo-runner.test.mjs`, `tests/demo-isolation.test.mjs`, `tests/demo-rng.test.mjs`).

### Etapa 5: Integración WebSocket y Handlers de Demo
- Implementar handlers para `start-demo`, `pause-demo`, `resume-demo`, `step-demo`, `set-demo-speed`, `restart-demo`, `exit-demo` en `demoCommands.ts`.
- En `start-demo`, registrar socket como GM en `roomStore.clients` y despachar inmediatamente `{ type: "hello", participant, room, catalog }` al socket, permitiendo que la UI entre de inmediato al tablero.
- En `restart-demo`, actualizar `participant.roomCode` en `clients` y reenviar `hello`.
- En `exit-demo`, destruir sala y sesión, enviar `{ type: "demo-exited", sessionId }` y desvincular socket.
- Integrar despacho en `apps/server/src/index.ts` validando con Zod.
- Hook `socket.on("close")` para pausar, cancelar y destruir la sesión y su sala si el cliente se desconecta.
- *Validación:* Test E2E WebSocket integrado en `scripts/e2e-websocket.mjs` ejecutando las 3 escenas completas contra el servidor activo.

### Etapa 6: Interfaz de Usuario y Controles
- Crear componente React `DemoPanel` con selector de velocidad (0.5x, 1x, 2x), indicador de paso/escena, texto explicativo y controles de transporte.
- Agregar botón "Empezar demo" en `ConnectionPanel` de `apps/web/src/App.tsx`.
- Deshabilitar controles de combate manuales del cliente cuando la sala activa corresponda a una sesión demo.
- *Validación:* Compilación y typecheck limpio de la aplicación web (`npm run build:web`, `npm run typecheck:web`).

### Etapa 7: Validación Playwright y Gate Completo
- Implementar test de Playwright `tests-ui/demo.spec.ts` que simula la interacción del usuario: clic en "Empezar demo", verificación de actualización del panel en cada escena y llegada al estado `completed`.
- Ejecutar la suite de validación completa del DoD de DnD-TCA:
  `npm test && npm run typecheck && npm run build && node scripts/e2e-websocket.mjs && npm run test:ui`.

---

## 3. Contratos de Demo y Transporte

### A. Tipos y Comandos de Cliente (`DemoClientCommand`)
```typescript
export type DemoSpeedMultiplier = 0.5 | 1 | 2;

export type DemoClientCommand =
  | { readonly type: "start-demo"; readonly demoId: string }
  | { readonly type: "pause-demo"; readonly sessionId: string; readonly sequence: number }
  | { readonly type: "resume-demo"; readonly sessionId: string; readonly sequence: number }
  | { readonly type: "step-demo"; readonly sessionId: string; readonly sequence: number }
  | { readonly type: "set-demo-speed"; readonly sessionId: string; readonly sequence: number; readonly speedMultiplier: DemoSpeedMultiplier }
  | { readonly type: "restart-demo"; readonly sessionId: string; readonly sequence: number; readonly scope: "scene" | "demo" }
  | { readonly type: "exit-demo"; readonly sessionId: string; readonly sequence: number };
```

### B. Eventos de Servidor (`DemoServerEvent`)
```typescript
export interface DemoSessionState {
  readonly sessionId: string;
  readonly sequence: number;
  readonly sceneIndex: number;
  readonly totalScenes: number;
  readonly sceneName: string;
  readonly stepIndex: number;
  readonly totalSteps: number;
  readonly stepDescription: string;
  readonly mechanicsExplanation: string;
  readonly actorName: string;
  readonly status: "preparing" | "playing" | "paused" | "completed" | "failed";
  readonly error?: string;
  readonly speedMultiplier: DemoSpeedMultiplier;
}

export type DemoServerEvent =
  | { readonly type: "demo-session-state"; readonly state: DemoSessionState }
  | { readonly type: "demo-exited"; readonly sessionId: string };
```

### C. Schemas Zod Estrictos
- `startDemoSchema`: `{ type: z.literal("start-demo"), demoId: z.string().min(1) }`
- `pauseDemoSchema`: `{ type: z.literal("pause-demo"), sessionId: z.string(), sequence: z.number().int().nonnegative() }`
- `resumeDemoSchema`: `{ type: z.literal("resume-demo"), sessionId: z.string(), sequence: z.number().int().nonnegative() }`
- `stepDemoSchema`: `{ type: z.literal("step-demo"), sessionId: z.string(), sequence: z.number().int().nonnegative() }`
- `setDemoSpeedSchema`: `{ type: z.literal("set-demo-speed"), sessionId: z.string(), sequence: z.number().int().nonnegative(), speedMultiplier: z.union([z.literal(0.5), z.literal(1), z.literal(2)]) }`
- `restartDemoSchema`: `{ type: z.literal("restart-demo"), sessionId: z.string(), sequence: z.number().int().nonnegative(), scope: z.enum(["scene", "demo"]) }`
- `exitDemoSchema`: `{ type: z.literal("exit-demo"), sessionId: z.string(), sequence: z.number().int().nonnegative() }`

Todos los schemas aplican `.strict()` para rechazar rigurosamente cualquier propiedad sobrante.

---

## 4. Aislamiento, Bootstrap y Núcleo de Despacho Único

### A. Bootstrap de la Sala y Ciclo de Vida del Cliente (MAJOR 1)
1. **Flujo de Inicio (`start-demo`):**
   - El cliente emite `start-demo` desde `ConnectionPanel` (`apps/web/src/App.tsx`).
   - El servidor genera un `roomCode` aleatorio de 5 letras mediante `createRoomCode()`.
   - El servidor registra el socket en `roomStore.clients` como participante GM:
     ```typescript
     const participant = register(socket, roomCode, "Demo GM", "gm");
     ```
   - Inmediatamente, el servidor despacha al socket el evento estándar de inicialización:
     ```typescript
     send(socket, { type: "hello", participant, room, catalog: gameCatalog });
     ```
   - En el cliente web, `useWebSocketRoom` procesa `hello`: establece `participant`, `room`, `catalog`, actualiza la URL a `/combat/${room.code}` y conmuta automáticamente el renderizado de `App.tsx` desde `ConnectionPanel` hacia la vista principal de combate (`Board`, `CombatantsPanel`, `ActionsPanel`, `CombatLog`).
   - Simultáneamente, el servidor emite `{ type: "demo-session-state", state: ... }`, montando el componente `DemoPanel` superpuesto sobre la cabecera.

2. **Reinicio (`restart-demo`):**
   - Si se reinicia la demo o la escena, el runner cancela temporizadores activos y genera o reinicializa la sala efímera.
   - El servidor actualiza la asociación del socket en `clients`:
     ```typescript
     clients.set(socket, { ...participant, roomCode: newRoom.code });
     ```
   - El servidor reenvía `{ type: "hello", participant: updatedParticipant, room: newRoom, catalog: gameCatalog }` al socket.
   - React recibe el `hello`, resetea su estado de combate a la nueva sala y actualiza la URL, manteniendo la experiencia fluida sin recargar la página.

3. **Salida Limpia (`exit-demo`):**
   - El handler de `exit-demo` destruye la sala en `rooms`, elimina la sesión en `sessionStore`, y desregistra el socket en `clients`.
   - El servidor emite `{ type: "demo-exited", sessionId }`.
   - El hook `useWebSocketRoom` o la UI al recibir `demo-exited` (o al pulsar salir) ejecuta `setRoom(null)`, `setParticipant(null)`, `setDemoSessionState(null)` y restaura la URL a `/`.
   - `App.tsx` evalúa `!participant || !room` y retorna limpiamente a `ConnectionPanel`, libre de cualquier residuo en memoria.
   - **Prohibición estricta:** En ningún caso se invoca `/api/test/reset`, preservando intactas las demás salas activas del servidor y el almacenamiento local.

4. **Desconexión (`socket.on("close")`):**
   - Si el socket se cierra inesperadamente, el hook en `index.ts` cancela el runner, elimina la sesión de `sessionStore` y purga la sala en `rooms`, garantizando cero tareas huérfanas o fugas de memoria.

### B. Núcleo de Despacho Único sin Caminos Paralelos (MAJOR 2)
Para garantizar que la demo jamás cree un motor paralelo ni omita validaciones normativas, el despachador de combate se estructura alrededor de un único núcleo compartido:

```typescript
// apps/server/src/commands/dispatcher.ts

export interface CommandExecutionContext {
  readonly diceRoller?: (sides: number) => number;
  readonly maneuverDiceSource?: ManeuverDiceSource;
}

// Único núcleo autoritativo compartido
function dispatchCommandCore(
  socket: WebSocket | null,
  command: ClientCommand,
  context?: CommandExecutionContext
): void {
  // 1. Verificación de existencia de sala y migración legacy
  const room = rooms.get(command.roomCode.toUpperCase());
  if (!room) {
    if (socket) send(socket, { type: "error", message: "Sala no encontrada." });
    throw new Error(`Sala ${command.roomCode} no encontrada.`);
  }
  ensureLegacyRoomShape(room);

  // 2. Gates normativos globales de fase
  if (room.phase === "finished" && !command.type.startsWith("gm-")) {
    throw new Error("El combate ya termino. Revisa la pantalla de resultados.");
  }
  if (room.phase === "opportunity-resolution") {
    if (command.type !== "resolve-opportunity-attack" && !command.type.startsWith("gm-")) {
      throw new Error("Hay ataques de oportunidad pendientes. Resuelvelos o limpialos como GM antes de continuar el combate.");
    }
  }
  if (room.phase === "critical-confirmation") {
    if (command.type !== "resolve-attack-confirmation" && command.type !== "cancel-attack-threat" && !command.type.startsWith("gm-")) {
      throw new Error("Hay una amenaza de critico pendiente. Resolvela antes de continuar.");
    }
  }

  // 3. Switch autoritativo único hacia los handlers reales
  switch (command.type) {
    case "set-initiative": handleSetInitiative(room, command); return;
    case "sort-initiative": handleSortInitiative(room, command); return;
    case "move-combatant": handleMoveCombatant(room, command); return;
    case "resolve-attack": handleResolveAttack(room, command, context?.diceRoller); return;
    case "resolve-attack-confirmation": handleResolveAttackConfirmation(room, command, context?.diceRoller); return;
    case "resolve-opportunity-attack": handleResolveOpportunityAttack(room, command, context?.diceRoller); return;
    case "resolve-special-maneuver": handleResolveSpecialManeuver(room, command, context?.maneuverDiceSource); return;
    case "cast-spell": handleCastSpell(room, command, context?.diceRoller ? { diceRoller: context.diceRoller } : undefined); return;
    case "use-tactical-action": handleUseTacticalAction(room, command); return;
    case "end-turn": handleEndTurn(room, command); return;
    // ...resto de comandos del motor existente sin modificaciones
  }
}

// Entrada externa desde WebSocket (sin RNG inyectado)
export function dispatchCommand(socket: WebSocket, command: ClientCommand): void {
  dispatchCommandCore(socket, command);
}

// Entrada interna autorizada para el runner de la demo
export function dispatchInternalDemoCommand(
  socket: WebSocket,
  command: ClientCommand,
  context: CommandExecutionContext
): void {
  // Garantía 1: Misma validación Zod estricta que la red externa
  const validation = validateClientCommand(command);
  if (!validation.success) {
    throw new Error(`Comando de demo inválido según schema Zod: ${validation.error}`);
  }

  // Garantía 2: Mismos gates, misma autorización, mismo switch y mismos handlers
  dispatchCommandCore(socket, validation.data, context);
}
```

**Garantías arquitectónicas del despacho único:**
- **Misma validación Zod:** Todo comando del runner pasa obligatoriamente por `validateClientCommand(command)`. Si viola el schema, la sesión falla de inmediato.
- **Mismos gates de fase:** Si la sala está en `opportunity-resolution` o `critical-confirmation`, el runner no puede colar acciones estándar; debe resolver el AdO o la confirmación de crítico conforme a las reglas.
- **Misma autorización:** El runner emite comandos con la identidad del GM de la sala (`participant.id`), pasando por los mismos checks de `requireCombatantControl`, `requireTurnControl` y `requireGM`.
- **Mismos handlers de combate:** No existe código bifurcado para "ataques de demo" o "movimientos de demo"; se invocan exactamente las mismas funciones del motor autoritativo.
- **Aislamiento externo:** Clientes de WebSocket normales jamás pueden proveer `context` o fuentes de dados; su entrada a través de `dispatchCommand` no acepta opciones.

---

## 5. Arquitectura del Runner y Checkpoints

### A. Máquina de Estados del Runner
```text
[Iniciando] ──> [Preparando] ──> [Reproduciendo] <───> [Pausada]
                                      │                     │
                                      ├── (siguiente paso) ─┘
                                      │
                                      ├──> [Completada] (fin de guion)
                                      └──> [Fallida] (error o checkpoint incumplido)
```

### B. Ciclo de Ejecución de Paso
1. **Comando en curso:** Solo se procesa 1 comando a la vez. Cualquier solicitud redundante de avance se descarta.
2. **Despacho interno:** El runner construye el `ClientCommand` normativo sustituyendo aliases por los IDs reales de la sala, y lo despacha mediante `dispatchInternalDemoCommand` inyectando la fuente de dados correspondiente al paso.
3. **Retorno síncrono:** El handler ejecuta la transacción autoritativa y actualiza `room`.
4. **Evaluación de Checkpoint:** El runner verifica los invariantes del paso:
   - Posición exacta del combatiente.
   - Estado de vida (`active`, `disabled`, etc.) y HP resultante.
   - Fase de encuentro (`active`, `critical-confirmation`, `opportunity-resolution`).
   - Recursos consumidos (munición en inventario, `preparedSpells.isExpended`).
   - Efectos activos presentes (`srd_prone`, `srd_squeezing`, `srd_paralyzed`).
5. **Transición:** Si el checkpoint se cumple, se notifica el nuevo estado vía `demo-session-state`. Si está en modo reproducción continua, se programa una pausa visual cosmética (escalada por `speedMultiplier`) antes del siguiente paso. Si el checkpoint falla, la sesión transiciona inmediatamente a `failed` y se detiene.

---

## 6. Inventario Completo de RNG y Transporte

Para garantizar 100% de reproducibilidad sin parches globales de `Math.random`, se inventarían todas las llamadas mecánicas:

| Acción | Llamada Mecánica | Función Involucrada | Mecanismo de Inyección en Runner |
|---|---|---|---|
| **Ataque estándar/completo** | Tirada d20 y daño de arma | `resolveCommandRolls` | Suministrado en el payload del comando (`command.d20Roll`, `command.damage`) o vía `options.diceRoller(20)` / `options.diceRoller(damageDice)` si `isAutoRoll: true`. |
| **Ataque Furtivo (Sneak Attack)** | Dados de precisión (1d6) | `resolveAttack` → `canApplySneakAttack` | `options.diceRoller(6)` inyectado mediante `PhysicalAttackExecutionOptions`. |
| **Ocultación (Concealment)** | Tirada d100 de fallo | `resolveAttack` → `resolveConcealment` | `options.diceRoller(100)` inyectado mediante `PhysicalAttackExecutionOptions`. |
| **Confirmación de Crítico** | Tirada d20 de confirmación | `handleResolveAttackConfirmation` | Suministrado en el comando (`command.d20Roll`) o vía `options.diceRoller(20)`. |
| **Salvación de Conjuro** | Tirada d20 de salvación | `resolveSpellSavingThrow` | Inyectado vía `options.diceRoller(20)` en `CastSpellExecutionOptions` en `handleCastSpell`. |
| **Derribo: AdO defensivo inicial (MAJOR 4)** | Tirada d20 de AdO por carecer de Improved Trip | `resolveInterruptingOpportunityAttack` | `maneuverDiceSource.d20("opportunity-attack")`. Inyectado para garantizar que falle y no aborte la maniobra. |
| **Derribo: Daño de AdO inicial** | Daño del arma en AdO interruptivo | `resolveAttack` en interrupt | Inyectado mediante `context.diceRoller` propagado en `specialManeuverCommands.ts:78`. |
| **Derribo: Toque atacante** | Tirada d20 de toque | `handleResolveSpecialManeuver` | Suministrado en el payload del comando (`command.maneuver.d20TouchRoll`). |
| **Derribo: Oposición atacante** | Tirada d20 de Fuerza | `handleResolveSpecialManeuver` | Suministrado en el payload del comando (`command.maneuver.d20OpposedRoll`). |
| **Derribo: Oposición defensor** | Tirada d20 de defensa | `resolveTripContest` | `maneuverDiceSource.d20("opposed-defender")`. |
| **AdO estándar (movimiento / conjuro)** | Tirada d20 de AdO | `handleResolveOpportunityAttack` | Suministrado en el payload (`command.d20Roll`, `command.damage`) o vía `context.diceRoller`. |

---

## 7. Fixtures y Guion Detallado por Escena

### Escena A — La Emboscada
- **Tablero:** 12×8 despejado, celdas de 5 ft.
- **Actores y Posiciones Iniciales:**
  - `cedrick`: Humano Guerrero Nivel 2, posición (3,3), espada larga (1d8, 19-20/x2), CA 18, HP 22, iniciativa 18.
  - `orc_leader`: Orco Bárbaro, posición (4,3), gran hacha (1d12, x3), CA 14, HP 35, iniciativa 20.
  - `bane`: Pícaro Nivel 3 (Ataque Furtivo +2d6), posición (6,3), estoque (1d6, 18-20/x2), CA 16, HP 18, iniciativa 15.
  - `elaen`: Exploradora Nivel 2, posición (1,6), arco largo (1d8, x3), 20 flechas, CA 15, HP 16, iniciativa 12.
- **Secuencia y Checkpoints Legales:**
  1. `sort-initiative`: Orden orc_leader (20) → cedrick (18) → bane (15) → elaen (12). Checkpoint: sala en `active`, ronda 1, orco activo.
  2. Orco termina turno (`end-turn`). Checkpoint: expira `srd_flat_footed` del orco; turno pasa a cedrick.
  3. Cedrick ataca al orco a 5 ft (`resolve-attack` d20=12, daño=7) y emite `end-turn`. Checkpoint: orco HP = 28; turno pasa a bane.
  4. Bane se mueve de (6,3) a (5,3) (`move-combatant`). Checkpoint: posición (5,3), flanqueo activo contra orco opuesto a cedrick (3,3 vs 5,3 con orco en 4,3).
  5. Bane declara modo estándar y ataca al orco (`resolve-attack` d20=20 amenaza de crítico, daño base=4, sneak attack 2d6 inyectado [3, 4] = 7). Checkpoint: sala en fase `critical-confirmation`.
  6. Bane confirma crítico (`resolve-attack-confirmation` d20=18, daño extra=4). Checkpoint: crítico confirmado, daño total aplicado (4*2 + 7 = 15), orco HP = 13. Bane emite `end-turn`. Turno pasa a elaen.
  7. Elaen declara modo estándar y dispara al orco a 15 ft (`resolve-attack` d20=14, daño=6) y emite `end-turn`. Checkpoint: orco HP = 7, flechas de elaen = 19. Fin de Escena A.

#### Escena B — Posición, Cobertura, AdO y Espacio Estrecho (MAJOR 3)
- **Tablero:** 16×8, celdas de 5 ft. Muros en (2,6) a (5,6) formando corredor estrecho (`narrowCells`) entre (1,5) y (5,5). Celda de escombros (terreno difícil) en (13,5).
- **Actores e Iniciativas Iniciales:**
  - `elaen`: (1,1), iniciativa 25 (player)
  - `guardia`: (3,1), iniciativa 22 (player)
  - `enemigo_melee`: (9,2), iniciativa 21 (enemy — actúa antes que `caminante` para que expire `srd_flat_footed` y pueda ejecutar AdO en Ronda 1)
  - `caminante`: (9,1), iniciativa 20 (player)
  - `guardian_large`: Large (2×2) ancla en (0,5), iniciativa 18 (player)
  - `explorador`: (12,5), iniciativa 16 (player)
  - `orco`: (5,1), iniciativa 10 (enemy)
- **Secuencia y Checkpoints Legales:**
  1. `sort-initiative`: Orden elaen (25) → guardia (22) → enemigo_melee (21) → caminante (20) → guardian_large (18) → explorador (16) → orco (10). Checkpoint: sala en `active`, ronda 1, turno activo de `elaen`.
  2. **Turno Elaen (Ronda 1) — Disparo con Cobertura:** Elaen declara modo estándar y dispara al orco (`resolve-attack` d20=11, daño=5). Checkpoint: orco recibe +4 CA por `creature-cover` (guardia aliado colineal en 3,1 intercepta la línea); tirada total 11 + mod 4 = 15 vs CA 14+4=18 (falla). Elaen emite `end-turn`. Checkpoint: turno pasa a `guardia`.
  3. **Turno Guardia (Ronda 1) — Despejar Línea:** Guardia se mueve de (3,1) a (3,2) (`move-combatant`). Checkpoint: posición (3,2), celda (3,1) liberada. Guardia emite `end-turn`. Checkpoint: turno pasa a `enemigo_melee`.
  4. **Turno Enemigo Melee (Ronda 1) — Activar Amenaza:** `enemigo_melee` emite `end-turn`, expirando `srd_flat_footed` (`CANNOT_MAKE_AOO`) y habilitando su reacción para el turno de `caminante`.
  5. **Turno Caminante (Ronda 1) — AdO por Desplazamiento:** Caminante se desplaza desde celda amenazada (9,1) pasando por (10,1) hasta (11,1) (`move-combatant`, 10 ft). Checkpoint: al abandonar celda amenazada por `enemigo_melee`, el servidor suspende el movimiento y pasa la sala a `opportunity-resolution`.
  6. `enemigo_melee` resuelve AdO interruptivo (`resolve-opportunity-attack` d20=5, daño=4; falla contra CA 16). Checkpoint: sala retorna a `active`, caminante completa el desplazamiento a (11,1) con HP intactos (20). Caminante emite `end-turn`. Checkpoint: turno pasa a `guardian_large`.
  7. **Turno Guardián Large (Ronda 1) — Squeezing en Corredor:** Guardián Large se mueve ortogonalmente a (1,5) y (2,5) ingresando al corredor estrecho de 5 ft (`move-combatant`). Checkpoint: huella comprimida a ancho 1 celda, efecto `srd_squeezing` aplicado, coste duplicado (10 ft por celda = 20 ft consumidos). Guardián Large emite `end-turn`. Checkpoint: turno pasa a `explorador`.
  8. **Turno Explorador (Ronda 1) — Terreno Difícil:** Explorador se mueve de (12,5) a (14,5) atravesando la celda difícil en (13,5) (`move-combatant`). Checkpoint: coste total = 15 ft (10 ft difícil + 5 ft normal). Explorador emite `end-turn`. Checkpoint: turno pasa a `orco`.
  9. **Turno Orco y Transición a Ronda 2:**
     - `orco` emite `end-turn`.
     - *Transición de Asalto:* `advanceTurn` detecta fin de `turnOrder`, despacha `RoundEnded`, incrementa `round: 2` y despacha `RoundStarted`. El listener autoritativo `roundTickListener` captura `RoundStarted` y **resetea las reacciones de todos los combatientes**: `opportunityAttacksThisRound = 0`. Activo retorna al primer combatiente de la iniciativa: `elaen`.
  10. **Turno Elaen (Ronda 2) — Disparo sin Cobertura:** Elaen declara modo estándar y vuelve a disparar al orco (`resolve-attack` d20=11, daño=5). Checkpoint: al haberse desplazado el guardia fuera de la línea de tiro, el orco no posee bono de cobertura (+0 CA); tirada 11 + mod 4 = 15 vs CA 14 (impacta, orco HP = 15). Elaen emite `end-turn`. Fin de Escena B.

### Escena C — Maniobras y Magia (MAJOR 3 y MAJOR 4)
- **Tablero:** 12×8 despejado, celdas de 5 ft.
- **Actores e Iniciativas Iniciales:**
  - `defensor`: (3,2), CA 15, HP 20, espada corta, iniciativa 25 (enemy — actúa primero en Ronda 1 para perder `srd_flat_footed` y poder ejecutar el AdO interruptivo de Derribo)
  - `cedrick`: (2,2), CA 18, HP 22, espada larga, iniciativa 20 (player)
  - `enemigo_guardia`: (9,5), CA 15, HP 18, lanza, iniciativa 15 (enemy — actúa antes que `mago` en Ronda 1 para perder `srd_flat_footed` y amenazar el conjuro)
  - `mago`: (8,5), CA 12, HP 14, slots: Shocking Grasp (nv 1), Hold Person (nv 2), iniciativa 10 (player)
- **Secuencia y Checkpoints Legales:**
  1. `sort-initiative`: Orden defensor (25) → cedrick (20) → enemigo_guardia (15) → mago (10). Checkpoint: sala en `active`, ronda 1, turno activo de `defensor`.
  2. **Turno Defensor (Ronda 1):** `defensor` emite `end-turn`, perdiendo `srd_flat_footed`. Turno pasa a `cedrick`.
  3. **Turno Cedrick (Ronda 1) — Derribo y AdO Interruptivo (MAJOR 4):**
     - Cedrick declara derribo contra defensor (`resolve-special-maneuver`, `trip`, `d20TouchRoll: 14`, `d20OpposedRoll: 16`).
     - Al no poseer Cedrick la dote *Improved Trip* y estar el defensor armado y no desprevenido, `specialManeuverCommands.ts` dispara `resolveInterruptingOpportunityAttack` del defensor contra Cedrick.
     - *Tirada AdO de Defensor:* `maneuverDiceSource.d20("opportunity-attack") = 4` (+ mod 3 = 7 vs CA 18 de Cedrick, falla; daño 0). Al no infligir daño, la maniobra continúa legalmente.
     - *Toque de derribo:* Toque melee de Cedrick (d20=14 + mod 5 = 19 vs Touch AC 12, conecta).
     - *Oposición:* Cedrick Fuerza (d20=16 + mod 3 = 19) vs Defensor (`maneuverDiceSource.d20("opposed-defender") = 8` + mod 2 = 10). Cedrick gana la prueba.
     - Checkpoint: efecto `srd_prone` aplicado al defensor.
     - Cedrick emite `end-turn`. Checkpoint: turno pasa a `enemigo_guardia`.
  4. **Turno Guardia (Ronda 1):** `enemigo_guardia` emite `end-turn`, perdiendo `srd_flat_footed`. Turno pasa a `mago`.
  5. **Turno Mago (Ronda 1) — Shocking Grasp bajo Amenaza:**
     - Mago se encuentra a 5 ft de `enemigo_guardia` (quien tiene `opportunityAttacksThisRound = 0`).
     - **Paso 5a:** Primer `cast-spell` (`srd_shocking_grasp` contra `enemigo_guardia`, `d20Roll: 15`, `amount: 5`).
       - Handler detecta conjuro estándar en celda amenazada. Guardia dispone de AdO y amenaza: se registra en `pendingOpportunityAttacks`, slot se mantiene intacto (`isExpended: false`) y sala transiciona a `opportunity-resolution`.
     - **Paso 5b:** `enemigo_guardia` resuelve AdO (`resolve-opportunity-attack` d20=5, daño=4; falla 5+2=7 vs CA 12).
       - Guardia agota su AdO por asalto (`opportunityAttacksThisRound = 1`). Sala retorna a `active`.
     - **Paso 5c:** Segundo `cast-spell` (`srd_shocking_grasp`, `d20Roll: 15`, `amount: 5`).
       - Al no haber ningún enemigo amenazando con AdO disponible, el conjuro procede efectivamente.
       - Resuelve toque melee contra Touch AC (d20=15 + mod 1 = 16 vs Touch AC 11, impacto). Aplica 5 puntos de daño eléctrico (guardia HP = 13) y expende slot de nivel 1 (`isExpended: true`).
     - Mago emite `end-turn`.
     - *Transición de Asalto:* `advanceTurn` detecta fin de `turnOrder`, despacha `RoundEnded`, avanza `round: 2` y despacha `RoundStarted`.
     - El listener autoritativo `roundTickListener` captura `RoundStarted` y **resetea las reacciones de todos los combatientes**: `enemigo_guardia.stats.opportunityAttacksThisRound = 0`.
     - `activeTurnIndex = 0`, reactivando el turno de `defensor`.
  6. **Turno Defensor (Ronda 2) — Levantarse con AdO Provocado:**
     - Defensor caído emite `use-tactical-action` (`stand-up`).
     - El handler retira `srd_prone`, deduce 15 ft de movimiento, y al estar amenazado por Cedrick (quien posee 1 AdO disponible en R2), suspende la acción y transiciona sala a `opportunity-resolution`.
     - Cedrick resuelve AdO (`resolve-opportunity-attack` d20=5, daño=6; falla 5+5=10 vs CA 15).
     - Sala retorna a `active`. Defensor completa acción de levantarse y emite `end-turn`. Checkpoint: turno pasa a `cedrick`.
  7. **Turnos Intermedios de Ronda 2:**
     - `cedrick` emite `end-turn`. Checkpoint: turno pasa a `enemigo_guardia`.
     - `enemigo_guardia` emite `end-turn`. Checkpoint: turno pasa a `mago`.
  8. **Turno Mago (Ronda 2) — Hold Person y Salvación de Voluntad:**
     - Mago emite conjuro de nivel 2 contra `enemigo_guardia`.
     - **Paso 8a:** Primer `cast-spell` (`srd_hold_person`).
       - Como el cambio de asalto restauró el AdO del guardia (`opportunityAttacksThisRound = 0`), el lanzamiento en celda amenazada vuelve a provocar AdO legalmente.
       - Handler registra AdO en `pendingOpportunityAttacks`, slot se mantiene intacto (`isExpended: false`) y sala transiciona a `opportunity-resolution`.
     - **Paso 8b:** `enemigo_guardia` resuelve AdO (`resolve-opportunity-attack` d20=6, daño=4; falla 6+2=8 vs CA 12).
       - Guardia agota su AdO de Ronda 2 (`opportunityAttacksThisRound = 1`). Sala retorna a `active`.
     - **Paso 8c:** Segundo `cast-spell` (`srd_hold_person`).
       - Conjuro procede efectivamente: `enemigo_guardia` realiza tirada de salvación de Voluntad (CD 15, tirada inyectada d20=5 + mod 0 = 5 vs CD 15, fallo).
       - Checkpoint: efecto `srd_paralyzed` aplicado al guardia (HELPLESS, DEX 0), slot de nivel 2 de *Hold Person* expendido (`isExpended: true`).
     - Mago emite `end-turn`.
     - Fin de Escena C y demo completada con éxito.

---

## 8. Tabla Completa de Tiradas Preparadas

| Escena | Paso | Acción | Propósito / Dado | Valor Preparado | Justificación Mecánica |
|---|---|---|---|---|---|
| **A** | 4 | Ataque Cedrick | d20 ataque / daño espada | d20: 12 / daño: 7 | 12 + mod 5 = 17 vs CA 14 (impacta). |
| **A** | 8 | Ataque Bane | d20 ataque / daño base / sneak | d20: 20 / base: 4 / sneak: [3, 4] | 20 natural amenaza crítico; sneak attack 2d6 = 7. |
| **A** | 9 | Confirmación Bane | d20 confirmación / daño crítico | d20: 18 / daño total arma: 8 | 18 + mod 6 = 24 vs CA 14 (confirma; 8 arma + 7 sneak = 15). |
| **A** | 12 | Disparo Elaen | d20 ataque / daño flecha | d20: 14 / daño: 6 | 14 + mod 4 = 18 vs CA 14 (impacta). |
| **B** | 3 | Disparo con Cover | d20 ataque / daño flecha | d20: 11 / daño: 5 | 11 + mod 4 = 15 vs CA 14+4=18 (falla por cobertura). |
| **B** | 8 | AdO por salida | d20 ataque / daño melee | d20: 5 / daño: 4 | 5 + mod 3 = 8 vs CA 16 (falla; no interrumpe el desplazamiento). |
| **B** | 16 | Disparo sin Cover | d20 ataque / daño flecha | d20: 11 / daño: 5 | 11 + mod 4 = 15 vs CA 14 (impacta tras apartarse aliado). |
| **C** | 3 | AdO Interruptivo Defensor (MAJOR 4) | d20 AdO en Derribo | d20: 4 | 4 + mod 3 = 7 vs CA 18 (falla; derribo no se aborta). |
| **C** | 3 | Toque Derribo Cedrick | d20 toque / mod | Toque: 14 | 14 + mod 5 = 19 vs Touch AC 12 (conecta). |
| **C** | 3 | Oposición Derribo Cedrick | d20 Fuerza Cedrick | Atacante: 16 | 16 + mod 3 = 19 Fuerza atacante. |
| **C** | 3 | Oposición Derribo Defensor | d20 Fuerza/Des Defensor | Defensor: 8 | 8 + mod 2 = 10 (Cedrick gana derribo; aplica `srd_prone`). |
| **C** | 7 | AdO en Shocking Grasp | d20 ataque Guardia / daño | d20: 5 / daño: 4 | 5 + mod 2 = 7 vs CA 12 (falla; permite segundo lanzamiento). |
| **C** | 8 | Toque Shocking Grasp | d20 toque Mago / amount | d20: 15 / amount: 5 | Toque melee 15+1=16 impacta Touch AC 11; inflige 5 daño y gasta slot. |
| **C** | 11 | AdO al levantarse | d20 ataque Cedrick / daño | d20: 5 / daño: 6 | 5 + mod 5 = 10 vs CA 15 (falla; demuestra AdO provocado al levantarse). |
| **C** | 15 | AdO en Hold Person | d20 ataque Guardia / daño | d20: 6 / daño: 4 | 6 + mod 2 = 8 vs CA 12 (falla en el AdO recuperado en R2). |
| **C** | 16 | Salvación Hold Person | d20 Voluntad Guardia | d20: 5 | 5 + mod 0 = 5 vs CD 15 (fallo; aplica `srd_paralyzed`). |

*Nota metodológica:* Todos los valores de esta tabla fueron certificados en ejecución real mediante `tests/demo-runner.test.mjs`, `tests/demo-rng.test.mjs` y `scripts/e2e-websocket.mjs`.

---

## 9. Especificación de UI y Controles

1. **Botón Principal:**  
   Montado en la pantalla de bienvenida / conexión (`apps/web/src/App.tsx`, `ConnectionPanel`) con etiqueta "Empezar demo".
2. **Panel de Control y Progreso (`DemoPanel`):**  
   - Encabezado: Escena actual y barra de progreso de pasos.
   - Cuerpo: Actor activo, intención declarada y recuadro explicativo de la regla/mecánica demostrada.
   - Barra de Transporte:
     - Botón "Pausar" / "Continuar".
     - Botón "Siguiente paso" (habilitado exclusivamente cuando la demo está pausada).
     - Selector de velocidad de presentación cerrado: `0.5x` (lento), `1x` (normal), `2x` (rápido).
     - Botón "Reiniciar" (con opciones para reiniciar la escena actual o la demo entera).
     - Botón "Salir de demo" (cierra la sesión y retorna a la vista de conexión).
3. **Protección de Interacción:**  
   Durante la demo, la grilla del tablero y el panel de acciones bloquean los botones de emisión de comandos manuales (`move-combatant`, `resolve-attack`, etc.), permitiendo únicamente la inspección pasiva de fichas y celdas.

---

## 10. Matriz de Verificación y Testing

| Suite de Test | Tipo | Alcance Verificado |
|---|---|---|
| `tests/demo-contracts.test.mjs` | Unitario | Validación de schemas Zod para todos los comandos y eventos de demo; rechazo de payloads con campos extraños y velocidades inválidas. |
| `tests/demo-runner.test.mjs` | Unitario | Lógica del runner: secuenciación, checkpoints asertivos, detección de errores, timeouts y cambios de velocidad. |
| `tests/demo-isolation.test.mjs` | Integración | Aislamiento estricto de sala y socket; rechazo de comandos manuales externos; limpieza en desconexión. |
| `tests/demo-rng.test.mjs` | Integración | Independencia del RNG: partidas normales conservan pseudoaleatoriedad; la demo consume exclusivamente sus tiradas. |
| `scripts/e2e-websocket.mjs` | E2E Servidor | Ejecución completa por WebSocket en vivo de las Escenas A, B y C con handlers y salas reales contra el servidor. |
| `tests-ui/demo.spec.ts` | E2E Playwright | Test de extremo a extremo en navegador (`tests-ui/`) verificando clic inicial, renderizado del panel, transición de escenas y estado final completado. |

---

## 11. Riesgos y Criterios de Detención

1. **Desincronización de Handlers:** Si un handler existente rechaza un comando previsto en el guion, el runner detiene inmediatamente la ejecución marcando la sesión como `failed` con el error exacto; queda terminantemente prohibido reintentar comandos a ciegas.
2. **Fuga de RNG no controlado:** Si durante la implementación se detecta una llamada transitiva a `rollDice` que no pueda interceptarse sin alterar el Rule Engine global, se debe detener la tarea y reducir el alcance de la escena afectada.
3. **Criterio de Detención de Gobernanza:** Si aparece cualquier necesidad de modificar el pipeline de movimiento normativo (I4/I5) o de adelantar I6, la tarea se detiene de inmediato.

---

IMPLEMENTATION PLAN READY FOR ARCHITECTURE REVIEW
