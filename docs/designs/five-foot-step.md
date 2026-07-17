# Diseño: 5-Foot Step (Paso de 5 pies)

## 1. Objetivo

Implementar el Paso de 5 pies como una **acción táctica explícita y diferenciada del movimiento normal**. El objetivo no es solo agregar un botón, sino introducir correctamente el concepto de **recurso táctico de posicionamiento libre de AdO**, que servirá como base para futuras reglas como Spring Attack, Tumble y comportamiento de retirada.

Al mismo tiempo, este diseño aprovecha que `TurnState` ya existe y tiene `usedFiveFootStep: boolean` — pero lo activa hoy de forma _implícita_ en `movementCommands.ts`. La tarea central de este diseño es hacer ese concepto **explícito, intencional y correctamente restringido**.

---

## 2. Reglas oficiales D&D 3.5

### ¿Qué es?
Un paso de 5 pies es un movimiento de exactamente 5 pies (1 casilla) que un combatiente puede realizar en su turno **sin provocar ataques de oportunidad**. No cuenta como usar la acción de movimiento.

### ¿Cuándo PUEDE usarse?
- En cualquier turno donde el combatiente **no se haya movido en absoluto** (cero pies de movimiento).
- También puede usarse **después** de un ataque completo si no se ha movido.
- Puede realizarse **antes o después** de cualquier acción estándar (incluyendo atacar, lanzar conjuros, prestar ayuda).
- Solo 1 paso de 5 pies por turno.

### ¿Cuándo NO puede usarse?
- Si el combatiente **ya se movió** en ese turno (aunque sea 1 pie).
- Si el combatiente **ya usó un paso de 5 pies** en ese turno.
- En **terreno difícil**: en terreno difícil, el primer paso diagonal ya cuesta 10 ft, por lo que técnicamente no puede hacerse un verdadero "5-foot step" sin provocar AdO (simplificación actual: terreno difícil no implementado).
- Si el combatiente está usando la acción de **correr** (Run).
- Si el combatiente está en condición **Entangled** (enmarañado).
- **Nota importante**: el paso de 5 pies **no bloquea** usar una acción estándar ni una acción de movimiento. Un combatiente puede: paso de 5 ft → acción estándar (ataque simple). O: ataque completo → paso de 5 ft. O: paso de 5 ft solo.

### Interacción con otras mecánicas
| Mecánica | Interacción |
|---|---|
| Movimiento normal | Mutuamente excluyentes. Si se movió, no hay paso. |
| Carga | La carga incluye movimiento real; imposible combinar. |
| Ataque completo | **Compatible**: permite paso antes o después del ataque. |
| Conjuros | Compatible (igual que acción estándar). |
| AdO | El paso NO genera AdO propios, pero sí abandona la casilla amenazada — el motor debe evaluarlo como "sin AdO". |
| Terreno difícil | No permitido en terreno difícil (regla oficial). Simplificado actualmente. |
| Criaturas grandes | Una criatura Grande puede dar un "paso de 5 pies" de 10 ft (1 casilla de su espacio). Fuera del alcance actual. |
| Condiciones | Entangled impide el paso. Blind/-prone permiten pero con restricciones. Fuera del alcance actual. |

---

## 3. Estado actual del motor

### `TurnState` (ya existe)
```ts
interface TurnState {
  combatantId: string | null;
  movementUsedFeet: number;      // pies gastados en movimiento real
  usedMoveAction: boolean;       // si se usó la acción de movimiento
  usedStandardAction: boolean;
  usedFullAttack: boolean;
  usedFiveFootStep: boolean;     // ← ya existe, pero se activa implícitamente
  usedSwiftAction: boolean;
  usedTotalDefense: boolean;
  usedStabilization: boolean;
}
```

### `movementCommands.ts` — comportamiento actual (PROBLEMA)
```ts
// Línea 32 — activa usedFiveFootStep de forma IMPLÍCITA e incorrecta:
if (movementDistance === room.board.cellSizeFeet
    && room.currentTurn.movementUsedFeet === movementDistance
    && !room.currentTurn.usedMoveAction)
  room.currentTurn.usedFiveFootStep = true;

if (movementDistance > room.board.cellSizeFeet)
  room.currentTurn.usedMoveAction = true;
```

**Problema**: el paso de 5 pies se detecta retrospectivamente al confirmar el movimiento como "si solo moví 1 casilla en el turno". Esto es incorrecto porque:
1. El jugador no declara **intención** de usar el paso de 5 pies.
2. Un movimiento de 5 pies por `move-combatant` sí debería generar AdO si proviene de la acción de movimiento normal.
3. No hay separación semántica entre "mover 5 ft como recurso de movimiento" y "mover 5 ft como Paso de 5 pies".

### `validateMovePath` — restricción existente (CORRECTA)
```ts
if (room.currentTurn.usedFiveFootStep && distance > 0)
  return { ok: false, error: "Ya uso paso de 5 pies este turno." };
```

### `canFullAttack` — restricción existente (CORRECTA)
```ts
if (room.currentTurn.movementUsedFeet > room.board.cellSizeFeet)
  return { ok: false, error: "No puede hacer ataque completo despues de moverse mas de 5 pies." };
```

Esta restricción es correcta: si el movimiento total es ≤ 5 ft (que podría ser un paso de 5 ft), permite el ataque completo. Pero si viene de `usedFiveFootStep`, debería ser aún más explícito.

### `findTriggeredOpportunityAttacksForPath` — AdO
```ts
if (distanceMovedFeet <= room.board.cellSizeFeet || path.length === 0) return [];
```

**Comportamiento actual**: el sistema ya NO genera AdO si el movimiento es de 5 ft o menos. Esto fue implementado como simplificación del paso de 5 pies. Sin embargo, la lógica no distingue si el movimiento de 5 ft fue intencional como paso libre o fue el primer paso de un movimiento normal antes de continuar.

---

## 4. Capas del Motor Afectadas

- ✔ **Movimiento** — nueva acción explícita `five-foot-step`
- ✔ **Acciones** — consume un nuevo tipo de recurso táctico, no la acción de movimiento
- ✔ **Ataques de oportunidad** — el paso no genera AdO (ya funciona por distancia; pero debe garantizarse semánticamente)
- ✔ **Ataque completo** — el paso antes/después de ataque completo debe habilitarse correctamente
- ✔ **UI (Preview)** — el panel de movimiento y tácticas debe mostrar la opción y su estado

No afectadas directamente: `attackResolver`, `flanqueo`, `snapshots`, `syncEncounterPhase`.

---

## 5. Decisiones Arquitectónicas

### 5.1 ¿El 5-foot Step es un movimiento o una acción distinta?

**Decisión: Es una acción táctica distinta.**

Justificación:
- Un paso de 5 pies NO consume la acción de movimiento.
- Un movimiento normal de 5 pies SÍ consume la acción de movimiento.
- Son semánticamente diferentes: uno es posicionamiento libre, el otro es recurso de movimiento.
- Modelarlos como el mismo comando `move-combatant` con detección implícita introduce ambigüedad imposible de resolver sin intención explícita.
- La intención del jugador debe ser declarada, no inferida.

**Solución propuesta**: nuevo valor en el discriminador de `use-tactical-action`:
```ts
{ type: "use-tactical-action"; action: "five-foot-step"; to: Position }
```

Alternativa descartada: nuevo command type `five-foot-step-combatant`. Descartado porque `use-tactical-action` ya es el punto de extensión canónico para acciones que no son ni movimiento ni ataque.

### 5.2 ¿Debe consumir movimiento (`movementUsedFeet`)?

**Decisión: Sí, debe sumar 5 ft a `movementUsedFeet` y marcar `usedFiveFootStep = true`, pero NO marcar `usedMoveAction = true`.**

Justificación:
- `movementUsedFeet` se usa en `canFullAttack` para verificar si el combatiente se movió más de 5 ft. El paso de 5 ft debe contabilizarse ahí para que la restricción funcione correctamente.
- `usedMoveAction = false` preserva la semántica: el jugador no gastó su acción de movimiento, puede seguir usando esa acción para otras cosas (aunque en la práctica, si ya hizo el paso, no podrá usar la acción de movimiento para mover más).
- Bloquear `usedMoveAction` es una simplificación válida pero incorrecta: el libro de reglas no dice que el paso "ocupa" la acción de movimiento; simplemente no puedes moverse más.

### 5.3 ¿Qué nueva información necesita `CombatRoom`?

**Ninguna nueva.** `TurnState` ya tiene `usedFiveFootStep: boolean`. Solo necesitamos que se active de forma **explícita** desde el nuevo handler, no implícita.

### 5.4 Corrección del código actual en `movementCommands.ts`

El bloque de línea 32 que activa implícitamente `usedFiveFootStep` debe ser **eliminado**. El paso de 5 pies ahora se activa únicamente desde `handleFiveFootStep`. Un movimiento de 5 ft por `move-combatant` pasa a ser siempre un uso de la acción de movimiento.

**Impacto**: la función `validateMovePath` en `rules.ts` también debe actualizarse para que un movimiento normal de 5 ft sí marque `usedMoveAction = true` — lo que ya hace `movementCommands.ts` condicionalmente en la línea 33.

### 5.5 ¿Cómo garantizar que el paso no genera AdO?

El sistema actual ya omite AdO si `distanceMovedFeet <= cellSizeFeet`. Esta lógica sigue siendo correcta para el paso de 5 pies explícito, porque el handler usará exactamente 5 ft. No se necesita cambio.

Sin embargo, para mayor claridad semántica, el handler del paso de 5 pies NO llamará a `findTriggeredOpportunityAttacksForPath` en absoluto — la omisión es parte del contrato de la acción, no un accidente de distancia.

---

## 6. Conceptos Reutilizables Introducidos

**Sí. Se introduce el concepto de "Acción Libre de Posicionamiento" (Free Positioning Action).**

Definición: una acción que mueve al combatiente sin consumir su acción de movimiento ni generar AdO.

Este concepto se reutilizará en:
- **Spring Attack** (D&D 3.5 feat): mover, atacar, mover — la segunda parte del movimiento es posicionamiento post-ataque.
- **Tumble** (habilidad): pasar por casilla amenazada sin AdO con tirada de Acrobacias.
- **Retirada (Withdraw)**: abandona la primera casilla sin AdO — primer paso libre.
- **Ready Action**: no genera movimiento propio pero interacciona con este estado.
- **Combat Reflexes**: los AdO de los enemigos deben evaluarse contra el paso de 5 pies (resultado: no se generan — es el punto exacto del contrato).

---

## 7. Arquitectura Propuesta

### Handler: `handleFiveFootStep` en `tacticalCommands.ts`

```
handleFiveFootStep(room, command):
  1. Validar fase active y turno activo.
  2. Validar que el combatiente puede actuar (canTakeTurn).
  3. Validar: !usedFiveFootStep → error "Ya usó paso de 5 pies."
  4. Validar: movementUsedFeet === 0 → error "Ya usó movimiento normal."
  5. Validar: !usedMoveAction → error "Ya usó acción de movimiento."
  6. Validar: !usedFullAttack (para paso POST-ataque completo: sí se permite; repensar).
  7. Validar: destino adyacente (1 casilla) y no ocupado por criatura consciente.
  8. Validar: destino dentro del tablero.
  9. Mover combatiente.
  10. Registrar: usedFiveFootStep = true, movementUsedFeet += 5.
  11. Log: "X usa paso de 5 pies hacia (a, b)."
  12. NO llamar a findTriggeredOpportunityAttacksForPath.
  13. broadcast.
```

**Nota sobre punto 6**: el paso de 5 pies es compatible con ataque completo. Un combatiente puede: `five-foot-step → full-attack` o `full-attack → five-foot-step`. La condición es que no haya movimiento normal previo. Por lo tanto, `usedFullAttack` NO bloquea el paso, pero `movementUsedFeet > 0` SÍ lo bloquea.

### Nueva función en `rules.ts`: `canUseFiveFootStep`

```ts
export function canUseFiveFootStep(room, combatant): RuleResult<true>
```

Reglas:
- Combatiente puede actuar (`canTakeTurn`).
- No hay amenaza de crítico ni AdO pendientes.
- `!room.currentTurn.usedFiveFootStep`
- `room.currentTurn.movementUsedFeet === 0`
- `!room.currentTurn.usedMoveAction`
- `!room.currentTurn.usedTotalDefense`
- NO bloqueado por `usedFullAttack` (el paso después del ataque completo es legal).

### Corrección en `movementCommands.ts`

Eliminar el bloque implícito de detección de paso de 5 ft (línea 32).
Un movimiento confirmado por `move-combatant` siempre establece `usedMoveAction = true` si `movementDistance > 0`.

### Actualización de `ClientCommand` en `types.ts`

Agregar:
```ts
| { type: "use-tactical-action"; roomCode: string; actorId: string; combatantId: string; action: "five-foot-step"; to: Position }
```

### Actualización del Zod schema en `schemas/commands/`

Agregar el nuevo discriminator con campo `to: PositionSchema`.

### UI: `ActionsPanel.tsx`

Agregar botón "Paso de 5 pies" en el panel de Movimiento o Tácticas.

Opciones de presentación:
- **Opción A** (recomendada): en el panel de Movimiento, como botón alternativo al movimiento normal. "En lugar de mover, haz click en una casilla adyacente para dar un Paso de 5 pies."
- **Opción B**: en Tácticas, como acción táctica adicional.

Se recomienda Opción A: el paso de 5 pies es conceptualmente una forma de posicionamiento; el usuario lo piensa en el contexto del movimiento.

Preview: mostrar casillas válidas para el paso (adyacentes, desocupadas) marcadas de forma diferente al movimiento normal (quizás con un icono de zapato o un color diferente).

---

## 8. Archivos a Modificar

| Archivo | Cambio |
|---|---|
| `packages/shared/src/types.ts` | Agregar variante `five-foot-step` a `ClientCommand` |
| `packages/shared/src/rules.ts` | Agregar `canUseFiveFootStep()` |
| `packages/shared/src/schemas/commands/index.ts` (o equivalente) | Actualizar Zod schema |
| `apps/server/src/commands/tacticalCommands.ts` | Agregar `handleFiveFootStep` |
| `apps/server/src/commands/movementCommands.ts` | Eliminar detección implícita de paso en línea 32; ajustar flag `usedMoveAction` |
| `apps/web/src/components/ActionsPanel/ActionsPanel.tsx` | Agregar UI del paso, callback, preview |
| `apps/web/src/viewModel.ts` (o equivalente) | Agregar estado y handler del paso en el view model |

---

## 9. Tests Propuestos

### Unitarios (`five-foot-step.test.mjs`)
- `canUseFiveFootStep` retorna `ok: true` al inicio del turno.
- `canUseFiveFootStep` retorna error si `usedFiveFootStep = true`.
- `canUseFiveFootStep` retorna error si `movementUsedFeet > 0`.
- `canUseFiveFootStep` retorna error si `usedMoveAction = true`.
- `canUseFiveFootStep` retorna `ok: true` aunque `usedFullAttack = true` (compatible con ataque completo).
- `canUseFiveFootStep` retorna error si `usedTotalDefense = true`.
- El paso de 5 ft NO activa `usedMoveAction` (preserva acceso a acción de movimiento en el estado).
- El paso de 5 ft SÍ activa `usedFiveFootStep`.
- El paso de 5 ft SÍ suma 5 a `movementUsedFeet`.
- Después del paso, `canFullAttack` sigue disponible si no hay otro movimiento.
- Después del paso, `canUseMoveAction` retorna error (no se puede mover después del paso).
- El movimiento normal de 5 ft NO activa `usedFiveFootStep` (corrección de comportamiento actual).

### E2E WebSocket (`scripts/e2e-websocket.mjs`)
- Paso de 5 ft posiciona al combatiente sin generar AdO pendientes.
- Paso de 5 ft seguido de ataque completo es válido.
- Paso de 5 ft seguido de movimiento normal falla con error correcto.
- Doble paso de 5 ft falla con error correcto.
- Movimiento normal seguido de intento de paso de 5 ft falla con error correcto.

### Playwright
- El botón de paso de 5 pies es visible y funcional.
- El estado del turno refleja el paso usado correctamente.

---

## 10. Simplificaciones Aceptadas

- Terreno difícil no implementado: el paso de 5 ft no verifica si la casilla destino tiene terreno difícil (regla oficial: en terreno difícil, el paso de 5 ft no es posible).
- Criaturas grandes: el paso equivale a 10 ft para criaturas Grandes (fuera del alcance del motor actual).
- Condiciones que bloquean el paso (`Entangled`, etc.) no implementadas (sistema de condiciones pendiente).
- El paso de 5 pies comparte la misma validación de ocupación que el movimiento normal.

---

## 11. Impacto sobre Reglas Futuras

| Regla | Dependencia |
|---|---|
| Ataque Completo | Compatible explícitamente con paso. `canFullAttack` ya verifica `movementUsedFeet`. |
| Combat Reflexes | Los AdO del paso son inexistentes por definición; el flag `usedFiveFootStep` puede usarse para tracing. |
| Spring Attack | Requiere modelar movimiento en dos segmentos con ataque en medio. El concepto de "acción libre de posicionamiento" sienta la base. |
| Tumble | Requiere tirada de habilidad antes del movimiento para suprimir AdO. El concepto de "movimiento sin AdO" ya existe aquí. |
| Retirada (Withdraw) | Solo el primer paso abandona la casilla inicial sin AdO. Similar al paso de 5 ft pero solo aplica a la casilla original. |

---

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| Romper el E2E existente al modificar `movementCommands.ts` | Los tests actuales de paso de 5 ft implícito deben revisarse antes de cambiar la lógica |
| Romper `canFullAttack` si `movementUsedFeet` cambia de semántica | La restricción usa `> cellSizeFeet`, por lo que 5 ft sigue pasando la validación |
| Confusión UI: dos formas de mover 5 ft | Resolver con UI clara que contextualice la diferencia |
| Paso de 5 ft hacia casilla ocupada | Usar la misma validación de `validateMovePath` para el destino |

---

## 13. Definition of Done

- Diseño aprobado antes de implementar.
- Código terminado sin TODOs injustificados.
- `canUseFiveFootStep` en `rules.ts` como función pura exportada.
- Corrección de detección implícita en `movementCommands.ts`.
- Handler en `tacticalCommands.ts` sin acoplar lógica de tablero en `attackResolver`.
- `npm test`, `npm run typecheck`, `npm run build`, `node scripts/e2e-websocket.mjs`, `npm run test:ui` finalizan correctamente.
- Documentación sincronizada: `TODO.md`, `rules-coverage-checklist.md`, `walkthrough.md`.
