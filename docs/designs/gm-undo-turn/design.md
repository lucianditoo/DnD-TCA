# GM Undo Turn — Retroceder Turno

**Responsabilidad**: Diseñar la funcionalidad "Retroceder turno" como capacidad exclusiva del GM para partidas ordinarias. La restauración debe ser autoritativa del servidor, determinista, verificable por hash y sin fugas de estado efímero.

**Autoridad**: Canónica (Nivel C — cambio de contrato observable, requiere Architecture Review)
**Lifecycle**: Diseño — pendiente de Architecture Review independiente y autorización `Proceed`
**Complementa**: [`../normative-movement-design.md`](../normative-movement-design.md), [`../vision-and-line-of-effect-architecture.md`](../vision-and-line-of-effect-architecture.md), [`../combat-academy.md`](../combat-academy.md)
**Consumidores**: Servidor (`gm-undo-turn`, `RoomHistory`), UI (`Board.tsx`, `useWebSocketRoom.ts`), Tests de integridad

---

## 1. Problema y Objetivo Observable

El GM necesita retroceder uno o más turnos completados en partidas normales para corregir errores de reglas o de interpretación sin reiniciar el encuentro.

**Criterio de aceptación**:
El GM pulsa "Retroceder turno" → el servidor valida autorización (`role === "gm"`, `phase === "active"`, sala ordinaria) → restaura el estado autoritativo del inicio del turno objetivo (`board`, `combatants`, `turnOrder`, `activeTurnIndex`, `round`, `currentTurn`, `effectInstances`, `log`, `eventSequence`) → incrementa `stateVersion` → reemplaza la instancia de sala en `roomStore` → todos los clientes reciben `room-update` y continúan desde ese punto sin inconsistencias.

---

## 2. Alcance y Exclusiones Explícitas

- **Incluido**: Partidas multijugador ordinarias en `phase === "active"`.
- **Excluido**:
  - **Academia de Combate** (`isAcademyRoom(room.code)`): El usuario tiene rol `player` y dispone de `restart-academy`. `RoomHistory` no registra checkpoints ni `authorizeRoomCommand` permite `gm-undo-turn`.
  - **Demo Runner** (`isDemoRoom`): Dispone de `restart-demo` determinista. `RoomHistory` no registra checkpoints ni se modifica `DemoPanel`.

---

## 3. Contrato y Autorización

### 3.1 Comando `gm-undo-turn` (`packages/shared/src/types.ts`)

```typescript
// En ClientCommand:
| {
    type: "gm-undo-turn";
    roomCode: string;
    actorId: string;
    steps?: number; // 1..maxUndoSteps (default: 1)
  }
```

### 3.2 `stateVersion` en `CombatRoom` y `ClientCommand`

- `CombatRoom.stateVersion?: number` se inicializa en `0` en `handleCreateRoom`. Academia y Old Demo omiten el campo.
- Incrementa estrictamente en `+1` en cada restauración exitosa de `gm-undo-turn` (monotónico creciente durante toda la vida de la sala).
- `ClientCommand` admite `stateVersion?: number`. El cliente (`useWebSocketRoom.ts`) adjunta `room.stateVersion` en comandos ordinarios de salas versionadas, excepto `gm-undo-turn`. El validador procesa la versión como metadato y mantiene la validación estricta del payload.

### 3.3 Autorización Centralizada (`apps/server/src/auth/commandAuthorization.ts`)

La validación se realiza únicamente en `authorizeRoomCommand(room, command)` (sin duplicar `requireGM` en el handler):
- Requiere `participant.role === "gm"`.
- Requiere `room.phase === "active"`.
- Rechaza salas de Academia (`isAcademyRoom(room.code)`) o Demo. Solo las salas ordinarias reciben una versión al crearse. El historial, la autorización y el botón verifican esa marca del servidor.
- Valida `steps` entero en `[1, room.config?.maxUndoSteps ?? MAX_UNDO_STEPS]`.
- No requiere `confirmationToken` (confirmación vía modal en UI).

---

## 4. Diseño Técnico

### 4.1 Semántica de Checkpoints y Retroceso (`RoomHistory`)

Ubicación: `apps/server/src/room/roomHistory.ts`

Cada checkpoint representa el **estado limpio al inicio de un turno** (`TurnStarted`):
1. **Checkpoint inicial**: `handleSortInitiative` lo registra después de inicializar el combate y procesar `TurnStarted`.
2. **Checkpoints siguientes**: `handleEndTurn` los registra después de `advanceTurn` y de inicializar la economía del turno entrante, antes de emitir el snapshot.

**Semántica de `steps` y bifurcaciones temporales**:
- El tope de la pila (`stack[stack.length - 1]`) corresponde al inicio del **turno actual en curso**.
- Retroceder `steps` turnos requiere `stack.length >= steps + 1`.
- Al ejecutar `popTurnCheckpoints(roomCode, steps)`:
  - Se descartan los últimos `steps` checkpoints (el turno en curso y los `steps - 1` turnos previos).
  - Se retorna el nuevo tope (`stack[stack.length - 1]`), que permanece en la pila como punto de partida de la nueva línea temporal.
  - Si luego se ejecutan acciones y se avanza turno, los nuevos checkpoints se apilan desde ese punto (sin árbol de *redo*).

```typescript
export interface TurnCheckpoint {
  readonly room: CombatRoom;           // structuredClone(room) al inicio del turno
  readonly turnNumber: number;         // Contador monotónico de turnos
  readonly round: number;
  readonly activeTurnIndex: number;
  readonly stateHash: string;          // SHA-256 de canonicalJson(room)
  readonly timestamp: number;
  readonly stateVersion: number;
}

export class RoomHistory {
  private readonly history = new Map<string, TurnCheckpoint[]>();

  pushTurnCheckpoint(roomCode: string, room: CombatRoom): void;
  popTurnCheckpoints(roomCode: string, steps: number): TurnCheckpoint | null;
  canUndo(roomCode: string, steps?: number): boolean;
  prune(roomCode: string): void;
  clear(roomCode: string): void;
}
```

**Límites**:
- `MAX_HISTORY_DEPTH = 10` (evicción FIFO).
- `MAX_UNDO_STEPS = 3` (configurable por sala hasta `10`).
- `HISTORY_TTL_MS = 30 * 60 * 1000` (30 min).

### 4.2 Serialización Canónica y Hash SHA-256

Para evitar falsos fallos por orden de claves en `JSON.stringify`, `hashRoom(room)` ordena alfabéticamente las claves de cada objeto antes de calcular `createHash("sha256")`:

```typescript
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const v = (value as Record<string, unknown>)[key];
        if (typeof v !== "function" && typeof v !== "symbol" && v !== undefined) {
          acc[key] = canonicalize(v);
        }
        return acc;
      }, {});
  }
  return value;
}

export function hashRoom(room: CombatRoom): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(room))).digest("hex");
}
```

### 4.3 Restauración Segura en `handleGmUndoTurn` (`apps/server/src/commands/gmCommands.ts`)

Para evitar fugas de propiedades efímeras que `Object.assign` no elimina:
1. Obtener `checkpoint = roomHistory.popTurnCheckpoints(room.code, steps)`. Si es `null`, lanzar error.
2. La operación verifica el hash del destino antes de descartar los checkpoints futuros. Si el hash no coincide, rechaza el retroceso y conserva el historial.
3. Clonar `restoredRoom = structuredClone(checkpoint.room)`.
4. Limpiar explícitamente campos efímeros:
   - `restoredRoom.completedAt = null`
   - `restoredRoom.pendingStationaryAction = undefined`
   - `restoredRoom.pendingMovement = undefined`
5. Incrementar versión: `restoredRoom.stateVersion = (room.stateVersion ?? 0) + 1`.
6. Reparar `until_turn` anchors (`repairUntilTurnAnchors(restoredRoom)`) contra el `turnOrder` restaurado.
7. Registrar entrada de auditoría en `restoredRoom.log.unshift(...)`.
8. **Reemplazar la referencia en `roomStore`**: `rooms.set(room.code, restoredRoom)` (`apps/server/src/room/roomStore.ts`).
9. Emitir `broadcast(restoredRoom)`.

### 4.4 Invalidación de Comandos Obsoletos (`apps/server/src/commands/dispatcher.ts`)

En `dispatchCommandCore`, **antes** de `authorizeRoomCommand`:
```typescript
if (
  command.type !== "gm-undo-turn" &&
  room.stateVersion !== undefined &&
  (command.stateVersion ?? 0) !== room.stateVersion
) {
  if (socket) {
    send(socket, {
      type: "error",
      message: "Estado desactualizado (posible undo previo). Refresca estado."
    });
  }
  return;
}
```

### 4.5 Limpieza de Memoria

Se invoca `roomHistory.clear(roomCode)` en:
- Fin de combate (`handleEndTurn` / `handleGmForceOutcome`).
- Eliminación o cierre de sala en `roomStore`.
- Defensivamente en `closeAcademy()`, `restartAcademy()` y `destroyDemoSession()`.
- Job periódico cada 5 min ejecutando `prune()`.

---

## 5. UI y Sincronización Cliente

- **Toolbar GM (`Board.tsx`)**: Botón "Retroceder turno" visible únicamente para `participant.role === "gm"` fuera de Academia y Demo (`!academy && !isDemoActive`), deshabilitado si `phase !== "active"`.
- **Confirmación**: Modal simple para `steps = 1` (o selector `1..maxUndoSteps`).
- **Cliente (`useWebSocketRoom.ts`)**: Envía `stateVersion: room.stateVersion` en `roomCommand` y actualiza su estado local al recibir `room-update` con el nuevo `stateVersion`.

---

## 6. Plan de Pruebas Requerido (Previo a Cierre)

1. **Checkpoint inicial**: `start-combat` crea Checkpoint 0; `gm-undo-turn` falla en turno 1 si no hay turno previo.
2. **Undo simple y múltiple**: `steps = 1` y `steps = 3` restauran HP, posición, `currentTurn`, `effectInstances`, `log` truncado y `eventSequence`.
3. **Bifurcación temporal**: Tras undo, nuevas acciones sobrescriben la rama descartada sin corrupción.
4. **Monotonicidad de `stateVersion`**: Incrementa en cada undo y comandos con `stateVersion` anterior son rechazados.
5. **Integridad SHA-256**: `hashRoom` es determinista y detecta corrupción de snapshot.
6. **Exclusión Academia y Demo**: `gm-undo-turn` rechazado en sesiones de Academia o Demo y `RoomHistory` permanece vacío.
