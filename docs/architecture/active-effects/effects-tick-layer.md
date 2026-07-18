# Diseño del Sistema: Effects Tick Layer y Event Bus (Sprint 004)

## 1. Event Bus Sincrónico (Domain Events)
Se implementa un Composition Root explícito donde el servidor inyecta los listeners. El `EventBus` es un pipeline funcional, puro y sin estado global.

**Contrato del Bus:**
- Ejecuta listeners en el orden recibido.
- Entrega el resultado de un listener al siguiente.
- No modifica por sí mismo el estado.
- No captura excepciones (política de errores: propagación inmediata, detención del pipeline).
- No mantiene registros globales.

**Eventos de Dominio (Minimal Scope):**
Actualmente solo se emitirán los eventos necesarios para evaluar duraciones.
```typescript
export type CombatEvent =
  | { type: "TurnStarted"; combatantId: string; round: number }
  | { type: "TurnEnded"; combatantId: string; round: number };
```

## 2. DurationPolicy y Anclas Temporales Explicitas
Las duraciones no inferirán el turno leyendo el `source.id` ni requerirán bifurcaciones relativas a `target`. La aplicación del efecto deberá definir el "ancla" temporal explícita en la que expira el efecto.

**Modelo de Instancia Multiobjetivo:**
Adoptamos el **Modelo A (Instancia por objetivo)** para cualquier efecto cuya duración dependa del turno del objetivo. Esto significa que si un hechizo afecta a 3 objetivos y finaliza al término del turno de cada uno, se crearán 3 `EffectInstance` independientes con anclas distintas. Las instancias multiobjetivo se reservan para duraciones globales (ej. en rondas ancladas al caster).

**Contrato de DurationPolicy:**
```typescript
export type DurationPolicy =
  | { type: "until_turn"; anchorCombatantId: string; phase: "start" | "end" }
  | { type: "rounds"; count: number; anchorCombatantId: string; anchorPhase: "start" | "end"; appliedRound: number }
  | { type: "permanent" }
  | { type: "until_rest" }
  | { type: "until_dispelled" };
```

**Semántica de Expiración en Rondas:**
Un efecto con `type: "rounds"` y ancla en `TurnStarted` del combatiente `A`, aplicado en la ronda 2 con `count: 1`, expirará cuando el `EventBus` reciba `TurnStarted` para `combatantId: A` y `event.round - appliedRound >= count`. Esto asegura que el ciclo se complete respetando el momento exacto en la iniciativa original.

## 3. Tick Layer (`EFFECTS-SYS-TICK`)
El `Tick Layer` actuará como listener.
No mutará `room.effectInstances` de forma directa, ni lanzará `EffectManager.remove` en un bucle perjudicial para la inmutabilidad.
En su lugar, acumulará los IDs expirados y realizará una sola llamada a `EffectManager.removeMany(room, instanceIds)`.

## 4. Orden Normativo de Transición de Turno
El avance de turno orquestará el estado, el sistema legacy y el EventBus en un orden determinista inmutable:

1. Capturar el combatiente *saliente* (`outgoing`).
2. **[Legacy]** Ejecutar `expireEndOfTurnBuffs(room, outgoing)`.
3. **[EventBus]** Despachar `TurnEnded { combatantId: outgoing.id, round: room.round }`.
   - `TickLayer` evalúa expiraciones `until_turn (end)`.
4. Avanzar `activeTurnIndex` y actualizar `room.round` si el índice vuelve a 0.
5. Capturar el combatiente *entrante* (`incoming`).
6. **[Legacy]** Ejecutar `expireStartOfTurnBuffs(room, incoming)`.
7. **[EventBus]** Despachar `TurnStarted { combatantId: incoming.id, round: room.round }`.
   - `TickLayer` evalúa expiraciones `until_turn (start)` y `rounds`.
8. Publicar el estado (Broadcast).
