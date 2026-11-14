# GM Undo Turn — Retroceder Turno

**Responsabilidad**: Diseñar la funcionalidad "Retroceder turno" como capacidad exclusiva del GM, reutilizable en partidas normales y tutoriales. La restauración debe ser autoritativa del servidor, sin duplicar mecánicas ni generar inconsistencias.

**Autoridad**: Canónica (Nivel C — cambio de contrato observable, requiere Architecture Review)
**Lifecycle**: Diseño — pendiente de Proceed y Architecture Review
**Complementa**: [`../normative-movement-design.md`](../normative-movement-design.md), [`../vision-and-line-of-effect-architecture.md`](../vision-and-line-of-effect-architecture.md), [`../scripted-combat-demo.md`](../scripted-combat-demo.md)
**Consumidores**: Servidor (comando `gm-undo-turn`), UI (botón GM), Tests (verificación de integridad)

---

## 1. Problema y Objetivo Observable

El GM necesita poder deshacer el último turno (o una cantidad acotada de turnos) para:
- Corregir errores de reglas o interpretación en partidas normales
- Rebobinar tutoriales/demo a un estado previo conocido
- Experimentar ramas tácticas sin consecuencias permanentes

**Criterio de aceptación**: El GM pulsa "Retroceder turno" → el servidor restaura el estado autoritativo anterior (board, combatantes, turno, efectos, RNG, iniciativa, log) → todos los clientes reciben `room-update` con el estado restaurado → el juego continúa desde ese punto sin inconsistencias.

---

## 2. Análisis de la Arquitectura Actual

### 2.1 Estado Autoritativo (`CombatRoom`)
Ubicación: `packages/shared/src/types.ts:436`

```typescript
export interface CombatRoom {
  code: string;
  board: Board;                           // Tablero (dimensiones, celdas especiales)
  combatants: Combatant[];                // Combatantes con HP, posición, efectos, equipo
  turnOrder: string[];                    // Orden de iniciativa
  activeTurnIndex: number;                // Índice en turnOrder
  round: number;                          // Ronda actual
  phase: EncounterPhase;                  // preparation | active | opportunity-resolution | critical-confirmation | finished
  outcome: CombatOutcome;                 // ongoing | victory | tpk
  currentTurn: TurnState;                 // Estado del turno activo (ver abajo)
  pendingOpportunityAttacks: OpportunityAttack[];
  log: CombatLogEntry[];                  // Log inmutable (prepend-only)
  activeAttackThreat: AttackThreatState | null;
  pendingCoupDeGrace: PendingCoupDeGrace | null;
  effectInstances: EffectInstance<ProductionEffectId>[];  // Efectos activos
  eventSequence: number;                  // Monotónico, para sincronización
  stateVersion: number;                   // Versión de estado: incrementa en cada restauración
  // ... campos efímeros (pendingStationaryAction, pendingMovement, etc.)
}
```

### 2.2 Estado de Turno (`TurnState`)
```typescript
export interface TurnState extends MovementContext {
  combatantId: string | null;
  movementUsedFeet: number;
  usedMoveAction: boolean;
  usedStandardAction: boolean;
  usedFullAttack: boolean;
  usedFiveFootStep: boolean;
  usedSwiftAction: boolean;
  usedTotalDefense: boolean;
  usedStabilization: boolean;
  attacksMade: number;
  attackMode: "none" | "standard" | "full";
  defensiveFightingDeclared: boolean;
}
```

### 2.3 Flujo de Turno (`turnManager.ts`)
- `advanceTurn()`: Avanza `activeTurnIndex`, maneja fin/inicio de ronda, emite eventos `TurnEnded`, `RoundEnded`, `RoundStarted`, `TurnStarted`
- `emptyTurn()`: Crea `TurnState` inicial para nuevo combatiente
- `emitCombatEvent()`: Incrementa `eventSequence`, despacha eventos por Event Bus

### 2.4 RNG y Determinismo
- `rollDice(sides, context?)` en `diceRoller.ts` usa `Math.random()`
- Tests inyectan `diceRoller` custom via `InternalExecutionContext.diceRoller`
- Demo Runner usa `diceRoller: () => 1` para pasos determinísticos

### 2.5 Efectos Temporales
- `EffectManager` en `effects/manager.ts`: add/remove puro, inmutabilidad defensiva
- Duraciones: `until_turn` (anchorCombatantId, phase), `rounds`, `until_dispelled`
- `roundTickListener` y `effectsTickListener` procesan expiración en `TurnEnded`/`RoundEnded`

### 2.6 Event Bus y Snapshots
- `dispatchCombatEvent(room, event, listeners)` → compose funcional de reducers puros
- `createCombatRulesSnapshot(room)` → `CombatRulesSnapshot` (deepFreeze, copia defensiva de `effectInstances`)
- `eventSequence`: Monotónico, para sincronización cliente-servidor
- `stateVersion`: Incrementa en cada restauración (ver §4.3)

### 2.7 Autorización y Comandos
- `dispatchCommand` → `authorizeRoomCommand` → `executeCommand`
- `gm-*` commands bypass phase checks, requieren `requireGM`
- `TEST_MODE` habilita `/api/test/reset` para tests

### 2.8 Demo Runner
- `DemoSessionRecord` con `sequence` para control de secuencia
- `restart-demo` recrea sala desde escena objetivo
- `dispatchInternalDemoCommand` usa `InternalExecutionContext` con `diceRoller` custom
- **Nota**: La funcionalidad `gm-undo-turn` es independiente del Demo Runner; no modifica `DemoPanel` ni archivos de la rama de Sol.

---

## 3. Requisitos Funcionales

### 3.1 Comando Principal: `gm-undo-turn`
```typescript
// ClientCommand (shared/types.ts)
| { type: "gm-undo-turn"; roomCode: string; actorId: string; steps?: number }
```

**Restricciones**:
- Solo `actorId` con `role === "gm"` (validado en `authorizeRoomCommand`)
- Solo en `phase === "active"` (combate en curso)
- `steps` opcional, default 1, máx `MAX_UNDO_STEPS` (default 3, configurable por sala hasta 10)
- **Sin `confirmationToken`**: confirmación simplificada via UI (ver §7)

### 3.2 Límite de Historial
| Parámetro | Valor | Justificación |
|---|---|---|
| `MAX_HISTORY_DEPTH` | 10 checkpoints | Memoria acotada (~10 * ~50KB = 500KB/sala) |
| `MAX_UNDO_STEPS` | 3 turnos (configurable 1..10) | Uso típico: corregir último turno |
| `HISTORY_TTL_MS` | 30 min | Limpieza automática de salas inactivas |

### 3.3 Qué Se Restaura (Estado Completo)
| Componente | Restauración |
|---|---|
| `board` | Dimensiones, celdas especiales (impassable, LoE, etc.) |
| `combatants[]` | HP, posición, efectos, equipo, buffs, initiative |
| `turnOrder`, `activeTurnIndex`, `round` | Orden e índice exactos |
| `currentTurn` | `TurnState` completo (diagonales, acciones usadas, etc.) |
| `pendingOpportunityAttacks[]` | Array completo |
| `log` | **Truncar** entradas posteriores al punto de restauración |
| `activeAttackThreat` | `null` o estado exacto |
| `effectInstances[]` | Array completo (incluye durations, stacks, anchorCombatantId válidos) |
| `eventSequence` | Valor exacto anterior |
| `stateVersion` | Incrementa en 1 (ver §4.3) |
| `phase` | `active` (siempre, undo solo en fase activa) |
| `outcome` | `ongoing` |

### 3.4 Qué NO Se Restaura
- `completedAt` (siempre `null` tras undo)
- `pendingStationaryAction` / `pendingMovement` (siempre `undefined`)
- `gmSessions` tokens (se invalidan por seguridad)

---

## 4. Diseño Técnico

### 4.1 Checkpoints Coherentes por Turno (RoomHistory)
Ubicación nueva: `apps/server/src/room/roomHistory.ts`

```typescript
import { createHash } from "node:crypto";
import type { CombatRoom } from "@dnd-tactical/shared";

export interface TurnCheckpoint {
  readonly room: CombatRoom;              // Copia profunda (structuredClone) del estado AL FINAL del turno
  readonly turnNumber: number;            // Número de turno absoluto (incrementa en cada advanceTurn)
  readonly round: number;                 // Ronda del checkpoint
  readonly activeTurnIndex: number;       // Índice en turnOrder
  readonly stateHash: string;             // SHA-256 del checkpoint anterior (cadena de integridad)
  readonly checkpointHash: string;        // SHA-256 de JSON.stringify(room) para verificación de integridad
  readonly timestamp: number;             // Date.now()
  readonly stateVersion: number;          // stateVersion del room al momento del checkpoint
}

export class RoomHistory {
  private readonly history = new Map<string, TurnCheckpoint[]>();  // roomCode -> checkpoints[]
  
  // Push SOLO al final de cada turno (en advanceTurn, tras emitir TurnStarted)
  pushTurnCheckpoint(roomCode: string, room: CombatRoom): void
  
  // Pop N checkpoints (retroceder N turnos)
  popTurnCheckpoints(roomCode: string, steps: number): TurnCheckpoint | null
  
  canUndo(roomCode: string, steps: number): boolean
  
  prune(roomCode: string): void                    // Limpia por depth/TTL
  clear(roomCode: string): void                    // Limpia todo (salida GM, fin combate)
  
  // Obtiene el último checkpoint para verificación
  getLatestCheckpoint(roomCode: string): TurnCheckpoint | undefined
}
```

**Políticas**:
- **Push SOLO en `advanceTurn()`**, tras `emitCombatEvent(TurnStarted)` y antes de `broadcast()`. Un checkpoint = un turno completado.
- **No** push en comandos individuales (move, attack, cast, etc.)
- Profundidad: `MAX_HISTORY_DEPTH` (FIFO eviction)
- TTL: `HISTORY_TTL_MS` (limpieza pasiva en `push` o job periódico)

### 4.2 Integración en `turnManager.ts` (advanceTurn)

```typescript
// En advanceTurn, tras emitir TurnStarted y antes de broadcast:
import { roomHistory } from "../room/roomHistory.js";

// ... código existente de advanceTurn ...

// Tras emitir TurnStarted y antes de broadcast:
if (room.phase === "active") {
  roomHistory.pushTurnCheckpoint(room.code, structuredClone(room));
}
```

### 4.3 Handler `handleGmUndoTurn`

```typescript
// apps/server/src/commands/gmCommands.ts
export function handleGmUndoTurn(
  room: CombatRoom, 
  command: Extract<ClientCommand, { type: "gm-undo-turn" }>
): void {
  requireGM(command.actorId);  // Solo GM
  
  if (room.phase !== "active") throw new Error("Solo disponible en combate activo.");
  
  const maxSteps = room.config?.maxUndoSteps ?? MAX_UNDO_STEPS;
  const steps = Math.min(command.steps ?? 1, maxSteps);
  if (steps < 1) throw new Error("steps debe ser >= 1");
  
  const previous = roomHistory.popTurnCheckpoints(room.code, steps);
  if (!previous) throw new Error("No hay historial suficiente para retroceder.");
  
  // Verificación de integridad: hash del checkpoint almacenado
  const storedHash = previous.checkpointHash;
  const currentRoomHash = hashRoom(previous.room);
  if (storedHash !== currentRoomHash) {
    throw new Error("Checkpoint corrupto: hash no coincide.");
  }
  
  // Verificación de cadena: hash del checkpoint anterior coincide
  if (previous.turnNumber > 1) {
    const prevCheckpoint = roomHistory.getCheckpoint(room.code, previous.turnNumber - 1);
    if (prevCheckpoint && prevCheckpoint.checkpointHash !== previous.stateHash) {
      throw new Error("Cadena de checkpoints rota: hash previo no coincide.");
    }
  }
  
  // Restaurar estado completo (crear nuevo room limpio desde checkpoint)
  const restoredRoom = structuredClone(previous.room);
  
  // Incrementar stateVersion para invalidar comandos en vuelo
  restoredRoom.stateVersion = (restoredRoom.stateVersion ?? 0) + 1;
  
  // Limpiar campos residuales que no deben persistir tras undo
  restoredRoom.completedAt = null;
  restoredRoom.pendingStationaryAction = undefined;
  restoredRoom.pendingMovement = undefined;
  
  // Invalidar tokens GM de la sesión anterior
  // (gmSessions se maneja en roomStore, se limpia aparte)
  
  // Reparar anchorCombatantId en efectos until_turn contra turnOrder restaurado
  repairUntilTurnAnchors(restoredRoom);
  
  // Incrementar eventSequence para mantener monotonicidad
  restoredRoom.eventSequence = restoredRoom.eventSequence + 1;
  
  // Reemplazar room en el Map (referencia nueva para reactividad)
  rooms.set(room.code, restoredRoom);
  
  // Log de auditoría
  restoredRoom.log.unshift(makeLog("system", `GM retrocedió ${steps} turno(s). Ronda ${restoredRoom.round}, turno de ${currentCombatant(restoredRoom)?.name}.`));
  
  broadcast(restoredRoom);
}
```

### 4.4 Reparación de Anchors `until_turn`

```typescript
// En gmCommands.ts o utilidad compartida
function repairUntilTurnAnchors(room: CombatRoom): void {
  const validAnchors = new Set(
    room.turnOrder.filter(id => 
      room.combatants.some(c => c.id === id && lifeStatus(c) !== "dead")
    )
  );
  
  for (const effect of room.effectInstances) {
    if (effect.duration?.type === "until_turn" && effect.duration.anchorCombatantId) {
      if (!validAnchors.has(effect.duration.anchorCombatantId)) {
        // Re-asignar al combatiente actual o al siguiente vivo en turnOrder
        const newAnchor = room.turnOrder.find(id => 
          room.combatants.some(c => c.id === id && lifeStatus(c) !== "dead")
        );
        if (newAnchor) {
          effect.duration.anchorCombatantId = newAnchor;
        } else {
          // No hay anchor válido: convertir a rounds=1
          effect.duration = { type: "rounds", remaining: 1 };
        }
      }
    }
  }
}
```

### 4.5 Hash de Integridad y Cadena de Checkpoints

```typescript
// En roomHistory.ts
import { createHash } from "node:crypto";
import type { CombatRoom, TurnCheckpoint } from "@dnd-tactical/shared";

export function hashRoom(room: CombatRoom): string {
  // Serializar solo campos de estado, excluyendo campos que cambian por referencia
  const serializable = {
    code: room.code,
    board: room.board,
    combatants: room.combatants.map(c => ({
      id: c.id,
      name: c.name,
      hpCurrent: c.hpCurrent,
      hpMax: c.hpMax,
      position: c.position,
      initiative: c.initiative,
      // ... todos los campos de estado relevantes
    })),
    turnOrder: room.turnOrder,
    activeTurnIndex: room.activeTurnIndex,
    round: room.round,
    phase: room.phase,
    outcome: room.outcome,
    currentTurn: room.currentTurn,
    pendingOpportunityAttacks: room.pendingOpportunityAttacks,
    log: room.log,
    activeAttackThreat: room.activeAttackThreat,
    pendingCoupDeGrace: room.pendingCoupDeGrace,
    effectInstances: room.effectInstances,
    eventSequence: room.eventSequence,
    stateVersion: room.stateVersion,
  };
  
  const serializableStr = JSON.stringify(serializable, (_key, value) => {
    if (typeof value === "function" || typeof value === "symbol") return undefined;
    return value;
  });
  
  return createHash("sha256").update(serializableStr).digest("hex");
}

export function pushTurnCheckpoint(roomCode: string, room: CombatRoom): void {
  const history = roomHistory.get(roomCode) ?? [];
  
  // Calcular hash del estado actual
  const checkpointHash = hashRoom(room);
  
  // Calcular hash del checkpoint anterior (para cadena de integridad)
  const stateHash = history.length > 0 ? history[history.length - 1].checkpointHash : "genesis";
  
  const turnNumber = history.length + 1;
  
  const checkpoint: TurnCheckpoint = {
    room: structuredClone(room),
    turnNumber,
    round: room.round,
    activeTurnIndex: room.activeTurnIndex,
    stateHash,
    checkpointHash,
    timestamp: Date.now(),
    stateVersion: room.stateVersion,
  };
  
  history.push(checkpoint);
  
  // FIFO eviction
  if (history.length > MAX_HISTORY_DEPTH) {
    history.shift();
  }
  
  roomHistory.set(roomCode, history);
}

export function popTurnCheckpoints(roomCode: string, steps: number): TurnCheckpoint | null {
  const history = roomHistory.get(roomCode) ?? [];
  if (history.length < steps) return null;
  
  const target = history[history.length - steps];
  
  // Eliminar checkpoints poppeados
  history.splice(history.length - steps, steps);
  roomHistory.set(roomCode, history);
  
  return target;
}

export function getCheckpoint(roomCode: string, turnNumber: number): TurnCheckpoint | undefined {
  const history = roomHistory.get(roomCode) ?? [];
  return history.find(cp => cp.turnNumber === turnNumber);
}

export function getLatestCheckpoint(roomCode: string): TurnCheckpoint | undefined {
  const history = roomHistory.get(roomCode) ?? [];
  return history[history.length - 1];
}
```

### 4.6 Integración en `dispatchCommandCore` (Invalidación de Comandos Obsoletos)

```typescript
// En dispatchCommandCore, ANTES de authorizeRoomCommand:
if (command.stateVersion !== undefined && command.stateVersion < room.stateVersion) {
  if (socket) send(socket, { type: "error", message: "Estado desactualizado (posible undo previo). Refresca estado." });
  return;
}

// El comando gm-undo-turn NO incluye stateVersion (siempre se procesa)
```

### 4.7 Comando `gm-undo-turn` (ClientCommand)

```typescript
// shared/types.ts
| { 
  type: "gm-undo-turn"; 
  roomCode: string; 
  actorId: string; 
  steps?: number;           // 1..maxUndoSteps (default 1)
}
```

**Sin `confirmationToken`**: confirmación via UI modal (ver §7).

### 4.8 Validación en `authorizeRoomCommand`

```typescript
// En commandAuthorization.ts
{
  command: "gm-undo-turn",
  requireGM: true,
  phase: ["active"],
  maxSteps: (room) => room.config?.maxUndoSteps ?? MAX_UNDO_STEPS,
  // Sin requireConfirmationToken
  // Validación adicional: solo GM con rol "gm" en la sala
  validate: (cmd, room) => {
    const participant = findParticipant(cmd.actorId);
    return participant?.role === "gm" && participant.roomCode === room.code;
  }
}
```

---

## 5. RNG y Determinismo

- **No se reproduce RNG**: El undo restaura el estado *posterior* a los lanzamientos. Los d20 ya lanzados quedan en el log y en el estado (HP, efectos, etc.).
- Para tutoriales que requieren determinismo total: el Demo Runner usa `diceRoller: () => 1` y `restart-demo` (ya implementado, independiente).

---

## 6. Limpieza y Memoria

- `roomHistory.clear(roomCode)` en: `handleEndTurn` (si combate termina), `destroyDemoSession`, `handleGmForceOutcome`
- Job periódico cada 5 min: `prune()` elimina checkpoints > `HISTORY_TTL_MS` y salas sin clientes
- `MAX_HISTORY_DEPTH = 10` (FIFO eviction)

---

## 7. UI y UX

### 7.1 Botón GM (Partidas Normales)
- En `Board.tsx` toolbar GM: botón "Retroceder turno" (icono ↶)
- Click → modal confirmación simple: "¿Retroceder 1 turno?" (steps=1 default)
- Para steps > 1: input numérico + confirmación "Retroceder N turnos"
- Deshabilitado si `!roomHistory.canUndo(room.code, 1)`

### 7.2 Tutorial (Independiente)
- **No modifica `DemoPanel` ni archivos de Sol**
- Tutoriales usan `restart-demo` (ya implementado) para reinicio de escena
- Si un tutorial necesita undo fino, el GM/autor usa el botón GM estándar en la UI de la partida

---

## 8. Seguridad y Validación

### 8.1 Comando `gm-undo-turn` (ClientCommand)
```typescript
| { type: "gm-undo-turn"; roomCode: string; actorId: string; steps?: number }
```

### 8.2 Validación en `authorizeRoomCommand`
```typescript
{
  command: "gm-undo-turn",
  requireGM: true,
  phase: ["active"],
  maxSteps: (room) => room.config?.maxUndoSteps ?? MAX_UNDO_STEPS,
  validate: (cmd, room) => {
    const participant = findParticipant(cmd.actorId);
    return participant?.role === "gm" && participant.roomCode === room.code;
  }
}
```

### 8.3 Invalidación de Comandos en Vuelo
- `stateVersion` en `CombatRoom` (incrementa en cada undo)
- `ClientCommand` opcional `stateVersion: number`
- Servidor rechaza comandos con `stateVersion < room.stateVersion` (error: "Estado desactualizado")

---

## 9. Tests de Integridad (10+)

| Test | Descripción |
|---|---|
| `undo-turn-single` | Undo 1 turno restaura HP, posición, currentTurn, log truncado, stateVersion+1 |
| `undo-turn-multi` | Undo 3 turnos restaura ronda anterior, stateVersion+1 |
| `undo-turn-empty-history` | Falla si history vacía |
| `undo-turn-excess-steps` | Falla si steps > maxUndoSteps |
| `undo-turn-wrong-phase` | Falla en preparation/opportunity-resolution/finished |
| `undo-turn-integrity` | Hash coincide, HP/pos/efectos/log/eventSequence/stateVersion correctos |
| `undo-turn-rng` | d20 previos no se "re-lanzan" (estado restaurado incluye resultados) |
| `undo-turn-effects` | Efectos `until_turn`/`rounds` restaurados con anchors válidos |
| `undo-turn-stale-commands` | Comandos con stateVersion antiguo rechazados tras undo |
| `undo-turn-anchors` | Efectos `until_turn` reparan anchorCombatantId contra turnOrder |
| `undo-turn-checkpoint-chain` | Cadena de hashes de checkpoints verificada (genesis → último) |
| `undo-turn-no-residual-props` | Sin propiedades residuales (completedAt=null, pending*=undefined) |
| `undo-turn-gm-auth` | Solo GM con rol "gm" en la sala puede ejecutar |
| `undo-turn-academia-lifecycle` | Tutorial: undo no rompe restart-demo, stateVersion aislado |

---

## 10. Archivos a Crear/Modificar

| Archivo | Tipo | Descripción |
|---|---|---|
| `apps/server/src/room/roomHistory.ts` | **Nuevo** | Checkpoints por turno (push/pop/prune/clear + hash + cadena) |
| `apps/server/src/commands/gmCommands.ts` | **Modificar** | `handleGmUndoTurn` + `repairUntilTurnAnchors` |
| `apps/server/src/combat/turnManager.ts` | **Modificar** | Push checkpoint en `advanceTurn` |
| `apps/server/src/commands/dispatcher.ts` | **Modificar** | Validar `stateVersion` en `dispatchCommandCore` |
| `apps/server/src/auth/commandAuthorization.ts` | **Modificar** | Policy `gm-undo-turn` con validación GM |
| `packages/shared/src/types.ts` | **Modificar** | `gm-undo-turn` en `ClientCommand`; `stateVersion` en `CombatRoom` |
| `apps/server/src/commands/__tests__/gmUndoTurn.test.mjs` | **Nuevo** | Tests unitarios e integración |
| `tests/gm-undo-turn.test.mjs` | **Nuevo** | Tests de integridad (13+) |
| `tests-ui/gm-undo-turn.spec.ts` | **Nuevo** | Tests Playwright UI (no DemoPanel) |
| `docs/designs/gm-undo-turn/design.md` | **Actualizado** | Este documento |

---

## 11. Referencias

- `GOVERNANCE.md` §5.2 Nivel C (cambio de contrato observable)
- `AGENTS.md` (flujo diagnóstico → diseño → implementación → verificación)
- `docs/designs/normative-movement-design.md` (turnManager, MovementContext)
- `docs/designs/scripted-combat-demo.md` (Demo Runner, restart-demo — **independiente**)
- `docs/designs/vision-and-line-of-effect-architecture.md` (authority, snapshots)

---

## 12. Estado

**Estado**: DISEÑO CORREGIDO — LISTO PARA REVISIÓN INDEPENDIENTE  
**Próximo paso**: Architecture Review independiente → Proceed del propietario → Implementación en fases

---

## 13. Resumen de Cambios vs Versión Anterior (Corrección de Bloqueantes)

| Bloqueante | Corrección Aplicada |
|---|---|
| **1. Firma de checkpoints y estado inicial** | `TurnCheckpoint` incluye `stateHash` (hash del checkpoint anterior) y `checkpointHash` (hash del estado actual). Cadena verificada desde "genesis" hasta último checkpoint. `pushTurnCheckpoint` calcula ambos hashes. |
| **2. Restauración sin propiedades residuales** | `handleGmUndoTurn` crea `structuredClone(previous.room)`, limpia `completedAt=null`, `pendingStationaryAction/pendingMovement=undefined`, invalida tokens GM. Usa `rooms.set(room.code, restoredRoom)` para referencia nueva. |
| **3. Contrato completo de `stateVersion`** | `stateVersion` en `CombatRoom` (inicial 0), incrementa en cada undo. `ClientCommand.stateVersion` opcional. Servidor rechaza `stateVersion < room.stateVersion` en `dispatchCommandCore` ANTES de `authorizeRoomCommand`. `gm-undo-turn` no incluye `stateVersion`. |
| **4. Integración con roles y ciclo de Academia** | `authorizeRoomCommand` valida `participant.role === "gm" && participant.roomCode === room.code`. Independiente de DemoPanel/Sol: no modifica `DemoPanel`, usa botón GM estándar. Tutoriales usan `restart-demo` independiente; `stateVersion` aislado por sala. |
| **SHA-256** | `hashRoom` serializa solo campos de estado (excluye functions/symbols). `TurnCheckpoint` incluye `checkpointHash` (hash del estado) y `stateHash` (hash del checkpoint anterior para cadena). Verificación en `popTurnCheckpoints`: `storedHash === hashRoom(previous.room)` + verificación de cadena `previous.stateHash === prevCheckpoint.checkpointHash`. |
| **Autorización GM** | `authorizeRoomCommand` valida `participant.role === "gm" && participant.roomCode === room.code`. Policy en `commandAuthorization.ts` con `requireGM: true`, `phase: ["active"]`, `maxSteps` configurable por sala, validación de participación en la sala. |