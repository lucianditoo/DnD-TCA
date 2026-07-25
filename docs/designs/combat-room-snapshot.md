# Diseño Técnico: CombatRulesSnapshot

Este documento describe la especificación técnica revisada para la introducción de `CombatRulesSnapshot` como la vista inmutable y de solo lectura de la sala de combate. Resuelve los riesgos de mutabilidad a nivel de compilación y ejecución, previniendo el acoplamiento y optimizando el rendimiento.

---

## 1. Objetivo
Introducir un modelo inmutable y de solo lectura reducido (`CombatRulesSnapshot`) diseñado específicamente para alimentar al Rule Engine. Esto aislará las reglas y validaciones de efectos secundarios (side-effects), garantizando a nivel de ejecución que la evaluación táctica es 100% libre de mutaciones sin comprometer el rendimiento en producción.

---

## 2. El Problema del Estado Mutable de Sala
* **TypeScript Readonly es Solo Compilación**: El modificador `readonly` de TypeScript desaparece tras la transpilación a JavaScript. Si una función del servidor realiza una mutación directa en caliente, el compilador puede fallar en detectarla si hay coerciones de tipo (type casting), y en runtime no se arrojará ningún error, ocultando bugs de mutabilidad.
* **Costo de Clonación**: Usar `JSON.parse(JSON.stringify(room))` copia campos innecesarios como el historial de logs (que crece linealmente en cada asalto), impactando la CPU del servidor.
* **Falta de Trazabilidad en Pruebas**: No hay garantías en runtime de que una suite de tests detecte si un helper de reglas modifica inadvertidamente el estado de un fixture compartido.

---

## 3. Modelo Propuesto: `CombatRulesSnapshot`
En lugar de clonar toda la sala, crearemos un snapshot optimizado táctico denominado `CombatRulesSnapshot` en [types.ts](../../packages/shared/src/types.ts).

### Estructura de Datos Requerida por las Reglas
Las reglas tácticas de movimiento, ataques y AdO solo necesitan acceder a la geometría del tablero, a los combatientes y al estado del turno. Se excluye por completo el historial de logs y metadatos del código de sala.

```typescript
export interface CombatRulesSnapshot {
  readonly board: {
    readonly width: number;
    readonly height: number;
    readonly cellSizeFeet: number;
  };
  readonly combatants: ReadonlyArray<Readonly<CombatantSnapshot>>;
  readonly currentTurn: Readonly<TurnState>;
  readonly phase: EncounterPhase;
  readonly pendingOpportunityAttacks: ReadonlyArray<Readonly<OpportunityAttack>>;
}
```

### Campos Excluidos
- `log`: No afecta la validez de los movimientos ni ataques; consume alta memoria y se descarta del snapshot.
- `code`: Metadata de identificación.
- `completedAt`: Timestamp administrativo.
- `outcome`: Se computa después de la resolución, no influye en las condiciones previas.

---

## 4. Estrategia de Creación Inmutable (Rendimiento y Seguridad)
Para evitar el uso de JSON y asegurar inmutabilidad real en runtime, utilizaremos una copia estructural manual controlada combinada con `deepFreeze` opcional en desarrollo/tests.

Añadiremos en [combatSnapshot.ts](../../packages/shared/src/combatSnapshot.ts):

```typescript
export function createCombatRulesSnapshot(room: CombatRoom): CombatRulesSnapshot {
  // 1. Copia superficial controlada de los campos necesarios (Rendimiento Óptimo)
  const snapshot: CombatRulesSnapshot = {
    board: {
      width: room.board.width,
      height: room.board.height,
      cellSizeFeet: room.board.cellSizeFeet
    },
    combatants: room.combatants.map((c) => ({
      ...c,
      position: { ...c.position },
      buffs: c.buffs.map((b) => ({ ...b })),
      abilities: c.abilities.map((a) => ({ ...a })),
      stats: { ...c.stats }
    })),
    currentTurn: { ...room.currentTurn },
    phase: room.phase,
    pendingOpportunityAttacks: room.pendingOpportunityAttacks.map((o) => ({
      ...o,
      attackerPosition: { ...o.attackerPosition },
      origin: { ...o.origin },
      destination: { ...o.destination }
    }))
  };

  // 2. Congelamiento estricto en runtime para Entornos No Productivos
  if (process.env.NODE_ENV !== "production") {
    deepFreeze(snapshot);
  }

  return snapshot;
}

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const val = (obj as any)[prop];
    if (val && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  });
  return obj;
}
```

---

## 5. Estrategia de Testing contra Mutaciones
Para asegurar que los helpers de reglas (en [rules.ts](../../packages/shared/src/rules.ts)) no mutan el estado, la suite de pruebas unitarias (`tests/rules.test.mjs`) usará la siguiente estrategia:
1. Las pruebas crearán y congelarán explícitamente el objeto snapshot de la sala usando `createCombatRulesSnapshot(room)` (que activa `deepFreeze` automáticamente en el runner de Node).
2. Se pasarán estos snapshots congelados a funciones como `validateMovePath`, `canTakeTurn` y `findTriggeredOpportunityAttacksForPath`.
3. Si alguna función intenta mutar el objeto en runtime (ej. `roomSnapshot.currentTurn.movementUsedFeet = X`), JavaScript arrojará inmediatamente un `TypeError` bajo el modo estricto de ESM de Node, haciendo fallar el test de regresión.

---

## 6. Impacto en Commands e Integración Incremental
* **Validadores en Servidor**: Los manejadores de comandos (ej. `handleMoveCombatant` en [movementCommands.ts](../../apps/server/src/commands/movementCommands.ts)) generarán el `CombatRulesSnapshot` antes de validar:
  ```typescript
  const snapshot = createCombatRulesSnapshot(room);
  const check = validateMovePath(snapshot, mover, path);
  if (!check.ok) throw new Error(check.error);
  // Mutación en caliente de room solo tras validación exitosa
  room.combatants[i].position = to;
  ```
* **Contrato de Red**: Ninguno. La estructura `CombatRoom` transmitida por WebSockets permanece intacta.
