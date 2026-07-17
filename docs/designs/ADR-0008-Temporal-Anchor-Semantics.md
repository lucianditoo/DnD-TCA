# ADR-0008: Semántica Temporal y Monotónica en ActiveEffects

## 1. Contexto y Problema
En el diseño inicial de ActiveEffects (`docs/designs/effects-system-architecture.md`), la expiración temporal se definió de manera declarativa con tipos como `until_source_turn_start` o `rounds`. Durante el Sprint 004, se determinó que estas definiciones eran ambiguas y dependían de reconstruir el estado para saber cuándo ocurrían.

El problema principal de una declaración como `rounds: 1` usando solo el `round` de aplicación es que no distingue si el efecto fue aplicado *antes*, *durante* o *después* del turno ancla en esa misma ronda. Esto causaría que dos efectos aplicados en distintos momentos de la misma ronda expiren simultáneamente de manera prematura o tardía.

## 2. Decisiones
1. **Event Sequence Monotónica**: Introducir un contador monotónico `eventSequence: number` en el `CombatRoom` que se incremente en 1 cada vez que se despache un evento de dominio sincrónico (ej. `TurnStarted`). Este contador garantiza una identidad temporal global estricta.
2. **Anclas Explícitas con Identidad Temporal**: La `DurationPolicy` ya no usará inferencias. Obligatoriamente definirá:
   - `anchorCombatantId`: A quién está anclado el efecto.
   - `phase`: A qué momento ("start" o "end").
   - `appliedAtSequence`: En qué punto exacto del tiempo monotónico se aplicó el efecto.
3. **Contrato Multiobjetivo (Modelo A)**: Todo efecto cuya expiración dependa del turno del objetivo (`until_target_turn_start`) generará múltiples `EffectInstance` independientes (una por objetivo) al momento de aplicarse, en lugar de compartir una única instancia con array de `targets`.
4. **Modificación del NDD**: Esta decisión modifica normativamente el documento arquitectónico fundacional `effects-system-architecture.md`, el cual requirió esta enmienda para ser válido bajo el principio de Pure Functions y determinismo absoluto.

## 3. Consecuencias
- **Positivas**: La expiración es 100% determinista, puramente matemática y aislada. El Tick Layer no necesita adivinar el pasado.
- **Negativas**: Aumenta marginalmente el payload del `CombatRoom` con un contador global, y los efectos multiobjetivo (relativos al blanco) generarán más instancias (Modelo A).
