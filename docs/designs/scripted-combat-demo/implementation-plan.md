# Plan de Implementación — Demostración Táctica Automática y Guionada

Responsabilidad: Plan técnico ejecutable para la vertical de demostración automática del motor de combate táctico.
Autoridad: Implementación de la vertical demo, subordinada al NDD aprobado (`docs/designs/scripted-combat-demo.md`, commit `f8c0e9d`).
Lifecycle: Permanente de la vertical
Reemplaza: —
Complementa: [docs/designs/scripted-combat-demo.md](../scripted-combat-demo.md), [INDEX.md](../../INDEX.md)
Consumidores: Architecture Gate, desarrolladores e implementadores del sprint de la demo.

> **Nota de gobernanza y resolución de ubicación:**  
> La raíz del repositorio contiene actualmente `implementation_plan.md` perteneciente al Sprint activo D-1B-I5R1 (Movement Resolution / Commit Remediation), el cual se encuentra pendiente de cierre formal por Architecture Gate y no puede ser sobrescrito ni cerrado en este sprint. Conforme a la política documental de gobernanza (`.agents/AGENTS.md` Fase 3 e `INDEX.md` §Decisiones, diseños y auditorías: *"cuando existen varios artefactos duraderos se co-ubican bajo `docs/designs/<feature>/`"*), este plan de implementación se ubica de forma duradera y no conflictiva en `docs/designs/scripted-combat-demo/implementation-plan.md`.

---

## 1. Archivos Afectados y Responsabilidades

| Archivo | Naturaleza | Responsabilidad |
|---|---|---|
| `packages/shared/src/types.ts` | Contratos | Declarar y exportar `DemoClientCommand`, `DemoServerEvent`, `DemoSessionState` y tipos asociados de la superficie de demo. |
| `packages/shared/src/schemas/commands/demoCommands.ts` | Validación | Schemas Zod estrictos para la validación en runtime de `DemoClientCommand` en el servidor. |
| `packages/shared/src/demo/types.ts` | Definición | Tipos para guiones declarativos, definición de escenas, pasos, checkpoints de estado y mapeo de aliases. |
| `packages/shared/src/demo/catalog.ts` | Contenido | Definición declarativa inmutable de la demo `scripted_tactical_demo_v1` (Escenas A, B y C), incluyendo fixtures, posiciones, inventario, slots y secuencias de tiradas. |
| `packages/shared/src/index.ts` | Barrel | Re-exportar contratos, tipos y schemas de la demo. |
| `apps/server/src/commands/dispatcher.ts` | Servidor | Extender la firma interna con `CommandExecutionContext` opcional (`diceRoller`, `maneuverDiceSource`) para pasar dependencias a handlers existentes, manteniendo la entrada externa de WebSocket 100% aislada de inyección. |
| `apps/server/src/demo/sessionStore.ts` | Servidor | Registro efímero en memoria de sesiones de demo (`Map<string, DemoSession>`), control de propiedad por conexión, descarte de comandos obsoletos por secuencia y limpieza en desconexión. |
| `apps/server/src/demo/runner.ts` | Servidor | Orquestador autoritativo secuencial. Instancia la sala con control GM, mapea aliases a IDs generados, ejecuta un comando a la vez vía dispatcher interno, evalúa checkpoints asertivos, emite estado y maneja temporizadores de presentación. |
| `apps/server/src/demo/demoCommands.ts` | Servidor | Handlers para `DemoClientCommand` (`start-demo`, `pause-demo`, `resume-demo`, `step-demo`, `set-demo-speed`, `restart-demo`, `exit-demo`). |
| `apps/server/src/index.ts` | Servidor | Enrutar mensajes de control de demo hacia `demoCommands.ts` y registrar el hook de limpieza en `socket.on("close")`. |
| `apps/web/src/components/DemoPanel/DemoPanel.tsx` | UI | Panel visual de presentación: escena, paso, actor, intención, explicación mecánica y controles de reproducción. |
| `apps/web/src/components/App.tsx` | UI | Botón de acceso directo "Empezar demo" y montaje del `DemoPanel`. |
| `apps/web/src/hooks/useWebSocketRoom.ts` | UI | Escucha y suscripción al evento `demo-session-state`. |
| `tests/demo-contracts.test.mjs` | Tests | Validación de schemas Zod y serialización de mensajes de demo. |
| `tests/demo-runner.test.mjs` | Tests | Unit tests del runner: secuencia, checkpoints, pausas, errores, timeout y manejo de secuencia. |
| `tests/demo-isolation.test.mjs` | Tests | Verificación de aislamiento de sala, permisos GM, rechazo de comandos externos y limpieza tras salida/desconexión. |
| `tests/demo-rng.test.mjs` | Tests | Verificación de aislamiento estricto de RNG y consumo determinista de las fuentes inyectadas. |
| `tests/demo-e2e-websocket.test.mjs` | Tests | Integración E2E sobre WebSocket ejecutando las 3 escenas reales completas contra el servidor. |
| `tests/ui/demo.spec.ts` | Tests | Suite Playwright en navegador verificando la experiencia completa de usuario de punta a punta. |

---

## 2. Orden Incremental de Implementación y Validaciones

```text
[Etapa 1: Contratos y Schemas (@dnd-tactical/shared)]
    ↓ npm run build:shared && npm run typecheck:shared
[Etapa 2: Guion Declarativo y Fixtures (@dnd-tactical/shared)]
    ↓ node --test tests/demo-contracts.test.mjs
[Etapa 3: Extensión Interna del Dispatcher (@dnd-tactical/server)]
    ↓ npm test (asegurar cero regresión en comandos existentes)
[Etapa 4: Sesión Efímera y Runner Autoritativo (@dnd-tactical/server)]
    ↓ node --test tests/demo-runner.test.mjs tests/demo-isolation.test.mjs
[Etapa 5: Integración WebSocket y Handlers de Demo (@dnd-tactical/server)]
    ↓ node --test tests/demo-e2e-websocket.test.mjs
[Etapa 6: Interfaz de Usuario y Controles (@dnd-tactical/web)]
    ↓ npm run build:web && npm run typecheck:web
[Etapa 7: Validación Playwright y Gate Completo (End-to-End)]
    ↓ npm test && npm run typecheck && npm run build && node scripts/e2e-websocket.mjs && npm run test:ui
```

### Etapa 1: Contratos y Schemas compartidos
- Definir en `packages/shared/src/types.ts` la unión discriminada `DemoClientCommand` y `DemoServerEvent`.
- Implementar schemas Zod estrictos (`.strict()`) en `packages/shared/src/schemas/commands/demoCommands.ts`.
- *Validación:* `npm --workspace @dnd-tactical/shared run build` y `npm run typecheck:shared`.

### Etapa 2: Guion Declarativo y Fixtures
- Crear perfiles source-first en `packages/shared/src/demo/catalog.ts` para los participantes de las Escenas A, B y C.
- Definir pasos, explicaciones pedagógicas, parámetros de comandos y checkpoints observables.
- *Validación:* Test unitario `tests/demo-contracts.test.mjs` validando que el catálogo cumple los tipos y schemas.

### Etapa 3: Extensión Interna del Dispatcher y Transporte de RNG
- Definir en el servidor `interface CommandExecutionContext { diceRoller?: (sides: number) => number; maneuverDiceSource?: ManeuverDiceSource; }`.
- Exportar función interna de despacho autoritativo `dispatchInternalCommand(room, command, context)`.
- Propagar `context.diceRoller` a `handleResolveAttack`, `handleCastSpell`, etc., y `context.maneuverDiceSource` a `handleResolveSpecialManeuver`.
- Mantener la función pública `dispatchCommand(socket, command)` invocada en `index.ts` sin alterar (sin opciones), garantizando que clientes de red normales nunca puedan inyectar dependencias de dados.
- *Validación:* Ejecución completa de la suite de tests existente (`npm test`), verificando cero regresiones en comandos normales.

### Etapa 4: Sesión Efímera y Runner Autoritativo
- Implementar `apps/server/src/demo/sessionStore.ts` con control estricto de propiedad por `socket` y mapa `Map<string, DemoSession>`.
- Implementar `apps/server/src/demo/runner.ts`:
  - Instanciar la sala con `createRoomCode()` y clon defensivo de `Board`.
  - Crear todos los combatientes con control GM (`controlledBy: { type: "gm" }`).
  - Mapear aliases declarativos (`"cedrick"`, `"bane"`, `"guard"`, etc.) a los IDs dinámicos generados durante la preparación.
  - Ejecutar un comando a la vez, esperar retorno síncrono del handler, validar el checkpoint sobre el estado resultante.
  - Gestionar máquina de estados: `preparing` → `playing` / `paused` → `completed` / `failed`.
- *Validación:* Tests unitarios del runner y de aislamiento (`tests/demo-runner.test.mjs`, `tests/demo-isolation.test.mjs`).

### Etapa 5: Integración WebSocket y Handlers de Demo
- Implementar handlers para `start-demo`, `pause-demo`, `resume-demo`, `step-demo`, `set-demo-speed`, `restart-demo`, `exit-demo` en `demoCommands.ts`.
- Integrar despacho en `apps/server/src/index.ts` validando con Zod.
- Registrar evento `demo-session-state` enviado exclusivamente al socket propietario de la sesión demo.
- Hook `socket.on("close")` para pausar, cancelar y destruir la sesión y su sala si el cliente se desconecta.
- *Validación:* Test E2E WebSocket (`tests/demo-e2e-websocket.test.mjs`) ejecutando las 3 escenas completas.

### Etapa 6: Interfaz de Usuario y Controles
- Crear componente React `DemoPanel` con selector de velocidad (0.5x, 1x, 2x), indicador de paso/escena, texto explicativo y controles de transporte.
- Agregar botón "Empezar demo" en la vista inicial.
- Deshabilitar controles de combate manuales del cliente cuando la sala activa corresponda a una sesión demo.
- *Validación:* Compilación y typecheck limpio de la aplicación web (`npm run build:web`, `npm run typecheck:web`).

### Etapa 7: Validación Playwright y Gate Completo
- Implementar test de Playwright `tests/ui/demo.spec.ts` que simula la interacción del usuario: clic en "Empezar demo", verificación de actualización del panel en cada escena y llegada al estado `completed`.
- Ejecutar la suite de validación completa del DoD de DnD-TCA.

---

## 3. Contratos de Demo y Transporte

### A. Comandos de Cliente (`DemoClientCommand`)
```typescript
export type DemoClientCommand =
  | { readonly type: "start-demo"; readonly demoId: string }
  | { readonly type: "pause-demo"; readonly sessionId: string; readonly sequence: number }
  | { readonly type: "resume-demo"; readonly sessionId: string; readonly sequence: number }
  | { readonly type: "step-demo"; readonly sessionId: string; readonly sequence: number }
  | { readonly type: "set-demo-speed"; readonly sessionId: string; readonly sequence: number; readonly speedMultiplier: number }
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
  readonly speedMultiplier: number;
}

export type DemoServerEvent =
  | { readonly type: "demo-session-state"; readonly state: DemoSessionState };
```

### C. Schemas Zod Estrictos
- `startDemoSchema`: `{ type: z.literal("start-demo"), demoId: z.string().min(1) }`
- `pauseDemoSchema`: `{ type: z.literal("pause-demo"), sessionId: z.string(), sequence: z.number().int().nonnegative() }`
- `resumeDemoSchema`: `{ type: z.literal("resume-demo"), sessionId: z.string(), sequence: z.number().int().nonnegative() }`
- `stepDemoSchema`: `{ type: z.literal("step-demo"), sessionId: z.string(), sequence: z.number().int().nonnegative() }`
- `setDemoSpeedSchema`: `{ type: z.literal("set-demo-speed"), sessionId: z.string(), sequence: z.number().int().nonnegative(), speedMultiplier: z.number().positive() }`
- `restartDemoSchema`: `{ type: z.literal("restart-demo"), sessionId: z.string(), sequence: z.number().int().nonnegative(), scope: z.enum(["scene", "demo"]) }`
- `exitDemoSchema`: `{ type: z.literal("exit-demo"), sessionId: z.string(), sequence: z.number().int().nonnegative() }`

Todos los schemas aplican `.strict()` para rechazar payloads con propiedades sobrantes.

---

## 4. Aislamiento y Ciclo de Vida

1. **Instancia de Sala:**  
   Se genera un `roomCode` aleatorio de 5 letras mediante `createRoomCode()`. El `Board` se clona en profundidad (`structuredClone`), evitando compartir la referencia en memoria de `demoBoard`.
2. **Propiedad y Autorización:**  
   El cliente que invoca `start-demo` queda registrado como participante GM (`role: "gm"`). Todos los combatientes creados en la sala demo se instancian con `controlledBy: { type: "gm" }`. Esto garantiza que los checks autoritativos de `requireCombatantControl`, `requireTurnControl` y `requireGM` se cumplan sin requerir desvíos de permisos ni privilegios excepcionales.
3. **Bloqueo de Mutaciones Externas:**  
   Si el cliente intenta enviar un comando normativo directo (`move-combatant`, `resolve-attack`, etc.) sobre la sala demo, el despachador lo rechaza; solo el runner interno puede emitir comandos de combate para esa sala.
4. **Reinicio y Salida:**  
   - `restart-demo`: Detiene la ejecución activa, limpia los temporizadores de la sesión, remueve la sala anterior de `rooms` e inicializa una nueva instancia aislada.
   - `exit-demo`: Remueve la sala de `rooms`, cancela temporizadores y destruye la sesión en `sessionStore`.
   - **Prohibición estricta:** En ningún caso se invoca `/api/test/reset`, preservando intactas las demás salas del servidor y el almacenamiento local.
5. **Desconexión:**  
   Al detectar `socket.on("close")`, el servidor cancela el runner y elimina la sala asociada de forma inmediata, previniendo tareas huérfanas en memoria.

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
2. **Despacho interno:** El runner construye el `ClientCommand` normativo sustituyendo aliases por los IDs reales de la sala, y lo despacha mediante `dispatchInternalCommand` inyectando la fuente de dados correspondiente al paso.
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
| **Derribo: Toque atacante** | Tirada d20 de toque | `handleResolveSpecialManeuver` | Suministrado en el payload del comando (`command.maneuver.d20TouchRoll`). |
| **Derribo: Oposición atacante** | Tirada d20 de Fuerza | `handleResolveSpecialManeuver` | Suministrado en el payload del comando (`command.maneuver.d20OpposedRoll`). |
| **Derribo: Oposición defensor** | Tirada d20 de defensa | `resolveTripContest` | `maneuverDiceSource.d20("opposed-defender")`. |
| **Derribo: AdO defensivo** | Tirada d20 de AdO interruptivo | `resolveInterruptingOpportunityAttack` | `maneuverDiceSource.d20("opportunity-attack")`. |
| **Derribo: Daño de AdO** | Daño del arma en AdO | `resolveAttack` en interrupt | **Extensión requerida:** En `specialManeuverCommands.ts:78`, asegurar que `resolveAttack` reciba un `diceRoller` proveniente del contexto inyectado, evitando fallback a `rollDice`. |

---

## 7. Fixtures y Guion Detallado por Escena

### Escena A — La Emboscada
- **Tablero:** 12×8 despejado, celdas de 5 ft.
- **Actores:**
  - `cedrick`: Humano Guerrero Nivel 2, posición (3,3), espada larga (1d8, 19-20/x2), CA 18, HP 22.
  - `orc_leader`: Orco Bárbaro, posición (4,3), gran hacha (1d12, x3), CA 14, HP 35.
  - `bane`: Pícaro Nivel 3 (Ataque Furtivo +2d6), posición (6,3), estoque (1d6, 18-20/x2), CA 16, HP 18.
  - `elaen`: Exploradora Nivel 2, posición (1,6), arco largo (1d8, x3), 20 flechas, CA 15, HP 16.
- **Secuencia y Checkpoints:**
  1. `sort-initiative` con orden orco (20) → cedrick (18) → bane (15) → elaen (12). Checkpoint: sala en `active`, orco activo.
  2. Orco termina turno (`end-turn`). Checkpoint: expira `srd_flat_footed` del orco; turno pasa a cedrick.
  3. Cedrick ataca al orco a 5 ft (`resolve-attack` d20=12, daño=7) y termina turno. Checkpoint: orco HP = 28; turno pasa a bane.
  4. Bane se mueve de (6,3) a (5,3) (`move-combatant`). Checkpoint: posición (5,3), flanqueo activo contra orco opuesto a cedrick (3,3 vs 5,3 con orco en 4,3).
  5. Bane declara modo estándar y ataca al orco (`resolve-attack` d20=20 amenaza de crítico, daño base=4, sneak attack 2d6 inyectado [3, 4] = 7). Checkpoint: sala en fase `critical-confirmation`.
  6. Bane confirma crítico (`resolve-attack-confirmation` d20=18, daño crítico base=4). Checkpoint: crítico confirmado, daño total aplicado (4*2 + 7 = 15), orco HP = 13. Bane termina turno.
  7. Elaen declara modo estándar y dispara al orco a 15 ft (`resolve-attack` d20=14, daño=6) y termina turno. Checkpoint: orco HP = 7, flechas de elaen = 19. Fin de Escena A.

### Escena B — Posición, Cobertura y Espacio Estrecho
- **Tablero:** 16×8, celdas de 5 ft.
- **Zona 1 (Cobertura por Criatura):**
  - Elaen (1,1), aliado guardia (3,1), orco (5,1).
  - Paso 1: Elaen dispara al orco (`resolve-attack` d20=11). Checkpoint: orco recibe +4 CA por `creature-cover` (guardia colineal en 3,1).
  - Paso 2: Turno del guardia: se mueve de (3,1) a (3,2) (`move-combatant`).
  - Paso 3: Siguiente turno de Elaen: dispara al orco (`resolve-attack` d20=11). Checkpoint: sin interposición, sin bono de cobertura.
- **Zona 2 (Ataque de Oportunidad por Movimiento):**
  - Caminante (9,1), enemigo melee (9,2).
  - Paso 4: Caminante se mueve a (10,1) y luego (11,1) (`move-combatant`). Checkpoint: al salir de (9,1) provoca AdO; sala pasa a `opportunity-resolution`.
  - Paso 5: Enemigo resuelve AdO (`resolve-opportunity-attack` d20=10, daño=0 para no interrumpir). Checkpoint: caminante completa el movimiento en (11,1).
- **Zona 3 (Guardián Large y Squeezing):**
  - Guardián Large (2×2) en ancla (0,5). Celdas estrechas (1,5) a (5,5), muros en (2,6) a (5,6).
  - Paso 6: Guardián se mueve ortogonalmente a (1,5) y (2,5) (`move-combatant`). Checkpoint: huella comprimida a ancho 1, `spatialMode: "squeezing"`, efecto `srd_squeezing` aplicado, coste de movimiento duplicado por flujo productivo.
- **Zona 4 (Terreno Difícil):**
  - Explorador en (12,5) se mueve a (14,5) pasando por celda difícil (13,5).
  - Paso 7: `move-combatant`. Checkpoint: coste total = 15 ft (5 normal + 10 difícil). Fin de Escena B.

### Escena C — Maniobras y Magia
- **Tablero:** 12×8 despejado, celdas de 5 ft.
- **Actores:**
  - `cedrick`: (2,2).
  - `defensor`: (3,2).
  - `mago`: (8,5), preparado con slots de *Shocking Grasp* y *Hold Person*.
  - `enemigo_guardia`: (9,5), amenazando al mago a 5 ft.
- **Secuencia y Checkpoints:**
  1. Cedrick intenta Derribo contra defensor (`resolve-special-maneuver`, `trip`, d20Touch=14, d20Opposed=16, d20Defensor=8). Checkpoint: toque conecta, oposición ganada, `srd_prone` aplicado al defensor. Cedrick termina turno.
  2. Defensor se levanta (`use-tactical-action`, `stand-up`). Checkpoint: retira `srd_prone`, gasta 15 ft, Cedrick genera AdO (`opportunity-resolution`). Cedrick resuelve AdO (`resolve-opportunity-attack` sin daño). Defensor termina turno.
  3. Mago intenta *Shocking Grasp* contra guardia adyacente:
     - **3a:** Primer `cast-spell`: Guardia dispone de 1 AdO y amenaza a 5 ft. El handler registra AdO y retorna; sala en `opportunity-resolution`, slot intacto.
     - **3b:** Guardia resuelve AdO (`resolve-opportunity-attack` d20=9, daño=0). Sala retorna a `active`, guardia agota su AdO por ronda.
     - **3c:** Segundo `cast-spell`: Mago vuelve a emitir el comando; al no haber AdO disponible, resuelve toque melee contra Touch AC (d20=15, daño eléctrico inyectado 1d6 = 5), inflige daño y slot de *Shocking Grasp* se expende (`isExpended: true`). Mago termina turno.
  4. Siguiente asalto, turno del Mago: lanza *Hold Person* contra guardia:
     - **4a:** Primer `cast-spell`: Guardia recuperó su AdO al inicio de la ronda y vuelve a amenazar. El comando registra AdO y suspende el conjuro.
     - **4b:** Guardia resuelve AdO (`resolve-opportunity-attack` d20=7, daño=0). Sala retorna a `active`.
     - **4c:** Segundo `cast-spell`: Se ejecuta efectivamente; guardia realiza salvación de Voluntad (CD 14, tirada inyectada d20=5 + mod=1 = 6, fallo). Checkpoint: efecto `srd_paralyzed` aplicado al guardia (HELPLESS, DEX 0), slot de *Hold Person* gastado. Fin de Escena C y demo completada.

---

## 8. Tabla Completa de Tiradas Preparadas

| Escena | Paso | Acción | Propósito / Dado | Valor Preparado | Justificación Mecánica |
|---|---|---|---|---|---|
| **A** | 3 | Ataque Cedrick | d20 ataque / daño espada | d20: 12 / daño: 7 | 12 + mod 5 = 17 vs CA 14 (impacta). |
| **A** | 5 | Ataque Bane | d20 ataque / daño base / sneak | d20: 20 / base: 4 / sneak: [3, 4] | 20 natural amenaza crítico; sneak attack 2d6 = 7. |
| **A** | 6 | Confirmación Bane | d20 confirmación / daño crítico | d20: 18 / daño extra: 4 | 18 + mod 4 = 22 vs CA 14 (confirma). |
| **A** | 7 | Disparo Elaen | d20 ataque / daño flecha | d20: 14 / daño: 6 | 14 + mod 4 = 18 vs CA 14 (impacta). |
| **B** | 1 | Disparo con Cover | d20 ataque / daño flecha | d20: 11 / daño: 5 | 11 + mod 4 = 15 vs CA 14+4=18 (falla por cobertura). |
| **B** | 3 | Disparo sin Cover | d20 ataque / daño flecha | d20: 11 / daño: 5 | 11 + mod 4 = 15 vs CA 14 (impacta tras apartarse aliado). |
| **B** | 5 | AdO por salida | d20 ataque / daño melee | d20: 10 / daño: 0 | AdO no interrumpe el desplazamiento. |
| **C** | 1 | Derribo Cedrick | Toque d20 / Fuerza Atacante / Oposición Defensor | Toque: 14 / Atacante: 16 / Defensor: 8 | Toque conecta contra Touch AC; 16+4=20 vs 8+2=10 (gana derribo). |
| **C** | 2 | AdO al levantarse | d20 ataque Cedrick / daño | d20: 12 / daño: 0 | Demuestra AdO provocado al levantarse. |
| **C** | 3b | AdO en Shocking Grasp | d20 ataque Guardia / daño | d20: 9 / daño: 0 | Guardia no inflige daño, permitiendo segundo lanzamiento. |
| **C** | 3c | Toque Shocking Grasp | d20 toque Mago / daño 1d6 | d20: 15 / daño: 5 | Toque melee 15+1=16 impacta Touch AC; gasta slot. |
| **C** | 4b | AdO en Hold Person | d20 ataque Guardia / daño | d20: 7 / daño: 0 | Guardia no inflige daño en el AdO recuperado. |
| **C** | 4c | Salvación Hold Person | d20 Voluntad Guardia | d20: 5 | 5 + mod 1 = 6 vs CD 14 (fallo; aplica `srd_paralyzed`). |

*Nota metodológica:* Todos los valores de esta tabla son especificaciones normativas proyectadas que deberán certificarse mediante los tests de integración en la Etapa 5.

---

## 9. Especificación de UI y Controles

1. **Botón Principal:**  
   Montado en la pantalla de bienvenida / cabecera con etiqueta "Empezar demo".
2. **Panel de Control y Progreso (`DemoPanel`):**  
   - Encabezado: Escena actual y barra de progreso de pasos.
   - Cuerpo: Actor activo, intención declarada y recuadro explicativo de la regla/mecánica demostrada.
   - Barra de Transporte:
     - Botón "Pausar" / "Continuar".
     - Botón "Siguiente paso" (habilitado exclusivamente cuando la demo está pausada).
     - Selector de velocidad de presentación: `0.5x` (lento), `1x` (normal), `2x` (rápido).
     - Botón "Reiniciar" (con opciones para reiniciar la escena actual o la demo entera).
     - Botón "Salir de demo" (cierra la sesión y retorna a la vista principal).
3. **Protección de Interacción:**  
   Durante la demo, la grilla del tablero y el panel de acciones bloquean los botones de emisión de comandos manuales (`move-combatant`, `resolve-attack`, etc.), permitiendo únicamente la inspección pasiva de fichas y celdas.

---

## 10. Matriz de Verificación y Testing

| Suite de Test | Tipo | Alcance Verificado |
|---|---|---|
| `tests/demo-contracts.test.mjs` | Unitario | Validación de schemas Zod para todos los comandos y eventos de demo; rechazo de payloads con campos extraños. |
| `tests/demo-runner.test.mjs` | Unitario | Lógica del runner: secuenciación, checkpoints asertivos, detección de errores, timeouts y cambios de velocidad. |
| `tests/demo-isolation.test.mjs` | Integración | Aislamiento estricto de sala y socket; rechazo de comandos manuales externos; limpieza en desconexión. |
| `tests/demo-rng.test.mjs` | Integración | Independencia del RNG: partidas normales conservan pseudoaleatoriedad; la demo consume exclusivamente sus tiradas. |
| `tests/demo-e2e-websocket.test.mjs` | E2E Servidor | Ejecución completa por WebSocket de las Escenas A, B y C con handlers y salas reales. |
| `tests/ui/demo.spec.ts` | E2E Playwright | Test de extremo a extremo en navegador verificando clic inicial, renderizado del panel, transición de escenas y estado final completado. |

---

## 11. Riesgos y Criterios de Detención

1. **Desincronización de Handlers:** Si un handler existente rechaza un comando previsto en el guion, el runner detiene inmediatamente la ejecución marcando la sesión como `failed` con el error exacto; queda terminantemente prohibido reintentar comandos a ciegas.
2. **Fuga de RNG no controlado:** Si durante la implementación se detecta una llamada transitiva a `rollDice` que no pueda interceptarse sin alterar el Rule Engine global, se debe detener la tarea y reducir el alcance de la escena afectada.
3. **Criterio de Detención de Gobernanza:** Si aparece cualquier necesidad de modificar el pipeline de movimiento normativo (I4/I5) o de adelantar I6, la tarea se detiene de inmediato.

---

IMPLEMENTATION PLAN READY FOR ARCHITECTURE REVIEW
