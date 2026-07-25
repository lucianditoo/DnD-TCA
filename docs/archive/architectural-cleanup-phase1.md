# Diseño Arquitectónico: Limpieza Habilitante (Fase 1)

## 1. Objetivo y Problema que Resuelve
Actualmente, el motor de combate táctico D&D 3.5 acumula deuda técnica (documentada en `docs/technical-debt.md`) que dificulta la implementación segura de nuevas reglas (como flanqueo, condiciones y ataques iterativos).
Los principales problemas son:
- **DT-001**: `attackResolver.ts` muta el estado (`room.log`, `combatant.hpCurrent`, `combatant.stats`) directamente en lugar de ser una función pura.
- **DT-003**: El bloqueo por ataques de oportunidad o amenazas de crítico se maneja con condicionales ad-hoc en el dispatcher (`isBlockedByPendingOpportunity`, `isBlockedByActiveAttackThreat`), lo que escala mal al agregar nuevas fases.
- **Falta de Versionado (DT-004)**: Los perfiles guardados en `localStorage` no tienen versión, impidiendo migraciones seguras si el esquema de datos cambia.
- **Frontera UI/Servidor**: Existen funciones en `viewModel.ts` (como `rollWeaponDamage` o validaciones de movimiento) que pueden confundir sobre dónde reside la autoridad de las reglas.
- **App.tsx Inflado**: `App.tsx` centraliza la emisión de comandos WebSocket, mezclando UI con lógica de red.

## 2. Arquitectura Propuesta

### 2.1. Formalización de Fases de Combate (DT-003)
En lugar de depender de campos implícitos (`pendingOpportunityAttacks.length > 0`, `activeAttackThreat != null`), transformaremos `EncounterPhase` de D&D en una máquina de estados explícita:

```typescript
export type EncounterPhase = 
  | "preparation"
  | "active" 
  | "critical-confirmation" 
  | "opportunity-resolution" 
  | "finished";
```

El dispatcher validará comandos basándose en la `phase` actual, evitando condicionales ad-hoc.
- Si la sala entra en `opportunity-resolution`, solo se aceptan comandos de resolución de oportunidad o del GM.
- Si entra en `critical-confirmation`, solo comandos de confirmación o cancelación de amenaza.
Esto centraliza la lógica de bloqueo de forma nativa en la fase de la sala.

### 2.2. Pureza en `attackResolver.ts` (DT-001)
`resolveAttack` y `resolveCriticalConfirmation` dejarán de recibir la `room` entera y callbacks.
Pasarán a tomar un subset inmutable y retornarán un objeto `AttackResult` descriptivo. El handler (`attackCommands.ts`) se encargará de aplicar los daños (`applyDamage`), actualizar el HP y generar el `makeLog()`.

### 2.3. Frontera UI preview y reglas autoritativas
Se agregará documentación explícita en `viewModel.ts` (JsDoc) definiendo que funciones como `rollWeaponDamage` son comodidades visuales y pre-rolls para el jugador, y que el cliente UI nunca dicta daño autoritativo sin que el servidor lo verifique.

### 2.4. Versionado de Perfiles Persistidos
Modificaremos `profileStorage.ts` para que pase de usar un array plano `StoredProfile[]` a una estructura migrada:
```typescript
{
  version: 1,
  profiles: StoredProfile[]
}
```
Si al leer se detecta un Array (v0), se migra automáticamente a v1.

### 2.5. App.tsx
No se realizará una refactorización masiva ahora (restringido por la directiva de la tarea), pero se documentará como deuda técnica futura extraer un hook `useCombatDispatcher`.

## 3. Alternativas Consideradas
- **Eliminar `rollWeaponDamage` de la UI**: Descartado, porque los jugadores valoran las sugerencias de tiradas o pre-rolls para facilitar su rol manual en la mesa.

## 4. Componentes Afectados y Riesgos
- **Shared (`types.ts`)**: Se expande `EncounterPhase`.
- **Server (`dispatcher.ts`, `roomState.ts`, handlers)**: Adaptación a las nuevas fases explícitas y asignación correcta de `room.phase`.
- **Server (`attackResolver.ts`, `attackCommands.ts`, `opportunityAttackResolver.ts`)**: Extracción de mutaciones de ataque a los handlers.
- **Shared (`profileStorage.ts`)**: Cambio en persistencia de datos y guardado automático como v1.
- **Web (`App.tsx`)**: Reaccionar a las nuevas fases para mostrar u ocultar la UI correcta (ej. el overlay modal para críticos).

## 5. Compatibilidad
- **Rule Engine**: Las reglas ganan pureza y se acercan al ideal inmutable.
- **UI**: Continúa funcionando igual, pero dependiendo de `phase` estricto.
- **E2E**: Seguirá pasando ya que los flujos de red y los payloads `ClientCommand` no cambian.
