# Diseño: DT-002 Validación de Movimiento a través de Aliados/Enemigos

## 1. Objetivo y Problema a Resolver
El objetivo de este diseño es alinear la validación de movimiento del cliente (UI) con las reglas tácticas de D&D 3.5 ya parcialmente implementadas en el servidor, asegurando una experiencia de usuario clara y una aplicación de reglas autoritativa.

Actualmente, el servidor (`validateMovePath` en `rules.ts`) permite a los combatientes atravesar casillas ocupadas por aliados, pero prohíbe terminar el movimiento en ellas. También prohíbe atravesar enemigos vivos. Sin embargo, **la UI (`isLegalNextPathStep` en `viewModel.ts`) prohíbe estrictamente hacer click en cualquier casilla ocupada**, lo que impide por completo en la práctica trazar rutas que atraviesen aliados. Además, el servidor considera a los enemigos inconscientes (`dying` / `stable`) como obstáculos intransitables, lo cual difiere de las reglas de D&D 3.5 (donde personajes indefensos no bloquean el movimiento).

## 2. Análisis de Reglas (D&D 3.5)
- **Movimiento a través de aliados:** Permitido. No se puede terminar el movimiento (la acción) en una casilla ocupada por un aliado.
- **Movimiento a través de enemigos:** Prohibido para enemigos activos o incapacitados (a menos que se use Acrobacias/Tumble, fuera del alcance actual).
- **Enemigos indefensos (Helpless):** Permitido. Un combatiente inconsciente (`dying`, `stable`) o muerto (`dead`) no bloquea el movimiento. Se puede terminar en su casilla.
- **Destino final:** Ningún combatiente puede terminar voluntariamente su movimiento en una casilla ocupada por un aliado consciente o un enemigo consciente. Se puede terminar el movimiento en casillas ocupadas por combatientes indefensos (dying, stable, dead). Las condiciones `paralyzed` y `unconscious` se implementarán cuando exista un sistema formal de condiciones.
- **Interacción con AdO:** Moverse a través de aliados no previene Ataques de Oportunidad si se abandona una casilla amenazada por un enemigo (el aliado otorga cobertura suave, pero no niega el AdO).

## 3. Arquitectura Propuesta y Componentes Afectados

### 3.1 Servidor Autoritativo (`packages/shared/src/rules.ts`)
La función `validateMovePath` debe relajarse para permitir atravesar enemigos que no representan una amenaza activa:
- **Cambio:** Un combatiente ocupando una casilla bloquea el paso **solo si** es un enemigo **Y** su estado de vida es `active` o `disabled`.
- Si el combatiente (aliado o enemigo) está `dying`, `stable` o `dead`, se puede atravesar y **se puede terminar el movimiento en su casilla**.
- El destino final **solo está bloqueado** si la casilla está ocupada por un combatiente consciente (aliado o enemigo).

### 3.2 Frontend - Preview UI (`apps/web/src/viewModel.ts`)
La función `isLegalNextPathStep` debe actualizarse para no bloquear aliados ni combatientes indefensos al trazar la ruta:
- **Cambio:** Permitir agregar una casilla a la ruta si está ocupada por un aliado, o por un enemigo `dying`/`stable`.
- Solo bloquear el paso (retornar `false`) si la casilla está ocupada por un enemigo `active` o `disabled`.

### 3.3 Frontend - Acción de Confirmación (`apps/web/src/components/ActionsPanel/ActionsPanel.tsx`)
Dado que el usuario ahora podrá hacer click en una casilla ocupada por un aliado para agregarla a su ruta, es posible que intente confirmar el movimiento estando en esa casilla.
- **Cambio:** El botón de `Confirmar movimiento` debe estar deshabilitado (`disabled`) si la última casilla de `movementPath` está ocupada por un combatiente consciente.
- De esta forma, el usuario puede trazar la ruta a través del aliado consciente, pero se le obliga a seguir haciendo click hasta una casilla válida para poder confirmar.

## 4. Riesgos y Alternativas Consideradas
- **Riesgo:** Confusión en la UI si el usuario hace click en un aliado y no sabe por qué el botón "Confirmar" se deshabilita.
  - **Mitigación:** Mostrar un mensaje en la UI (`ActionsPanel.tsx`) indicando que el destino final no puede estar ocupado, o simplemente deshabilitar el botón de validación. La UI actual tiene un `button` que ya puede estar deshabilitado por distancia excedida; se sumaría esta condición.
- **Alternativa:** Implementar A* pathfinding en el frontend para saltar automáticamente al aliado.
  - **Descartada:** La filosofía del proyecto es que el usuario dibuja la ruta paso a paso para tener control total de por dónde pasa (vital para esquivar/provocar AdOs intencionalmente). Modificar la validación de `isLegalNextPathStep` respeta esta filosofía.

## 5. Estrategia de Testing

- **Unit Tests (`tests/rules.test.mjs`):**
  - Moverse a través de un aliado hasta una casilla vacía (debe pasar).
  - Terminar el movimiento en un aliado consciente (debe fallar).
  - Moverse a través de un enemigo `active` (debe fallar).
  - Moverse a través de un enemigo `dying` o `stable` (debe pasar).
  - Terminar el movimiento en un combatiente `dying` o `stable` (debe pasar).
- **E2E WebSocket (`scripts/e2e-websocket.mjs`):**
  - Simular el comando `move-combatant` trazando una ruta a través de un aliado. Validar que el servidor lo acepta y devuelve ok.
- **Playwright UI (`tests-ui/smoke.spec.ts`):**
  - Opcional pero recomendado para luego: un test donde se intente hacer click en un aliado durante el movimiento.
