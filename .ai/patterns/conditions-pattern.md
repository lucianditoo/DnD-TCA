# Patrón Arquitectónico: Condiciones (ActiveEffects)

Este documento sirve como la guía autoritativa sobre "Cómo diseñar e implementar una condición en el motor", basado en el aprendizaje obtenido durante la implementación de la vertical slice `srd_stunned` (Sprint 006).

## 1. La Estructura de Datos del Estado

Las condiciones no existen como flags estáticas (ej. `isStunned: boolean`) en la interfaz de `Combatant`. Se declaran de forma declarativa y neutra dentro del **Catálogo de ActiveEffects** (`effects/catalog.ts`).

- **ID Inmutable**: Cada condición tiene un identificador único con prefijo claro (ej. `srd_stunned`, `srd_flat_footed`).
- **Traits (Rasgos)**: El comportamiento binario se modela a través de strings semánticos inyectables. En lugar de preguntar "¿Está aturdido?", el sistema pregunta "¿Tiene el rasgo `CANNOT_ACT`?". Ejemplos: `NO_DEX_TO_AC`, `CANNOT_MAKE_AOO`.
- **Modifiers (Modificadores Numéricos)**: Cualquier alteración numérica se declara explícitamente en el catálogo con políticas de apilamiento claras (`stackingGroup`, `stackingPolicy`). Por ejemplo, Stunned impone un penalizador de -2 a la CA.
- **OnStack Policy**: Define cómo se comporta la condición si se aplica múltiples veces al mismo objetivo (ej. `ignore`, `accumulate`, `replace`).

## 2. El Ciclo de Vida

El ciclo de vida de una condición está completamente aislado del modelo del combatiente. Las condiciones viven en el arreglo `effectInstances` de la `Room` (o en su equivalente `CombatRulesSnapshot`).

- **Inyección**: Se inyectan mediante comandos específicos (ej. `gm-apply-effect` o eventos del sistema), generando una instancia `EffectInstance` con un `cryptoId` único.
- **Duración y Anclas**: Una instancia define su política de duración (ej. `until_target_turn_end`). La Tick Layer avanza el tiempo de las condiciones en función de los eventos de inicio y fin de turno, evaluando la fase de expiración.
- **Eliminación Segura**: La Tick Layer remueve automáticamente las instancias que expiran. Al ser extraídas del arreglo central (y reevaluadas puramente en el próximo Snapshot), no hay riesgo de dejar estados huérfanos (como ocurriría si hubiese que "restaurar" un valor de CA modificado manualmente).

## 3. La Evaluación de Reglas

El flujo del combate y los comandos del servidor **jamás** deben contener lógica condicional ad-hoc para condiciones específicas (`if (hasCondition('srd_stunned'))`).

En su lugar, el `RulesEngine` desacoplado extrae y proyecta las reglas:
- **Reducción Pura**: `EffectReducer.reduceEffectsForTarget` toma las instancias activas y genera un estado comprimido de `numericModifiers` y `traits`.
- **Fronteras de Decisión**: Las comprobaciones funcionales se centralizan en funciones como `evaluateActionAvailability(snapshot, combatant)` (que busca el trait `CANNOT_ACT`) o `canMakeOpportunityAttack` (que busca `CANNOT_MAKE_AOO`).
- **Modificadores Numéricos**: Se suman directamente en el cálculo final (ej. `totalArmorClass`) utilizando la salida determinista del reductor, sin que la función de cálculo conozca el origen específico de la condición.

---

## 4. Anclaje de Turnos y Ciclos de Vida con la Tick Layer

*(Aprendizaje de Sprint 007: `srd_flat_footed`)*

Las condiciones cuya duración depende de la estructura de turnos del encuentro utilizan la política de duración `until_turn`, que ancla la expiración a un evento específico del `EventBus`:

```typescript
duration: {
  type: "until_turn",
  anchorCombatantId: id,   // ID del combatiente afectado
  phase: "start",           // "start" | "end"
  appliedAtSequence: room.eventSequence,
}
```

**Patrón para condiciones de inicio de combate** (como `srd_flat_footed`):
- La inyección ocurre en el momento de ordenar iniciativas (`handleSortInitiative`), iterando sobre `room.turnOrder` para crear una instancia **por combatiente**, con el mismo `anchorCombatantId` que el target.
- La política `phase: "start"` garantiza que el `TickLayer` expire la condición exactamente cuando ese combatiente inicia su turno, sin intervención manual.
- Se utiliza `EffectManager.add` en bucle (en lugar de mutación directa) para preservar la inmutabilidad funcional del estado de sala.

**Regla invariante**: el `appliedAtSequence` debe capturarse del `room.eventSequence` antes de emitir cualquier evento `TurnStarted` — de lo contrario, el tick podría expirar la condición prematuramente en el mismo turno en que fue inyectada.

---

## 5. Supresión de Modificadores Positivos de Destreza (Patrón `NO_DEX_TO_AC`)

*(Aprendizaje de Sprint 006 y 007)*

Este patrón se aplica a condiciones de inmovilidad, sorpresa o indefensión que eliminen la capacidad reactiva del combatiente.

**Cómo funciona:**
1. El catálogo declara el trait `NO_DEX_TO_AC` en la condición.
2. La función `totalArmorClass` en `rules.ts` comprueba `hasEffectTrait(reduced, "NO_DEX_TO_AC")`.
3. Si el modificador de Destreza es **positivo**, se resta de `baseAC` y se registra en el breakdown como `"bono dex suprimido -N"`.
4. Si el modificador es **nulo o negativo**, no se suprime nada — el penalizador preexistente permanece.

**Condiciones que aplican este patrón:** `srd_stunned`, `srd_flat_footed`. En el futuro: Paralyzed, Helpless, Sleep.

**Extensibilidad**: Para añadir una condición futura que suprima DEX, basta con incluir `"NO_DEX_TO_AC"` en su array de `traits` en el catálogo. El evaluador lo detectará automáticamente sin modificar `rules.ts`.
