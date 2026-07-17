# Combat Engine Architecture

## 1. Objetivo

El propósito del Combat Engine es resolver de manera autoritativa, consistente y testeable las mecánicas tácticas de Dungeons & Dragons 3.5. 

Sus objetivos principales son:
- Mantener un **único origen de la verdad (Single Source of Truth)** para el estado del combate y las reglas, alojado en el servidor.
- Prevenir que la lógica de juego se filtre o duplique en la capa de presentación (UI).
- Soportar simulaciones complejas (como flanqueo, críticos, ataques de oportunidad) mediante la composición de funciones puras fáciles de testear.

---

## 2. Principios Arquitectónicos

- **Servidor Autoritativo:** El cliente nunca decide el resultado de una acción. El cliente propone comandos, el servidor los valida, los ejecuta y hace un broadcast del estado resultante.
- **Cliente como Preview:** La UI asiste visualmente (colores, deshabilitados, overlays, previews) pero no toma decisiones finales. Las fórmulas de juego viven en los resolvers.
- **Resolvers Puros:** La matemática del sistema d20 (ej. cálculo de CA, tiradas de ataque) vive en funciones sin efectos colaterales (ej. `attackResolver.ts`, `threatensTarget`).
- **Mutaciones Centralizadas:** La modificación del estado del combate (`roomState`) solo puede ocurrir dentro de los *Command Handlers* autorizados y de manera explícita (ej. `attackCommands.ts`).
- **Snapshots:** El estado de un combatiente o del tablero se encapsula en estructuras estáticas e inmutables (ej. `CombatSnapshot`) para ser evaluadas en un momento dado, desacoplando los perfiles base temporales.
- **Regla → Contexto → Resolver → Mutación:** El flujo de diseño estricto exige que primero exista una función pura (Regla), luego se determine el estado aplicable (Contexto), se ejecute la matemática pura (Resolver) y finalmente el handler aplique los cambios (Mutación).
- **Sin duplicar reglas entre UI y servidor:** Si la UI necesita saber si un ataque es posible, debe usar la misma función compartida (`packages/shared/src/rules.ts`) que el servidor utiliza.
- **Documentación Sincronizada:** El código y la documentación deben representar exactamente el mismo sistema.
- **Definition of Done (DoD):** Ninguna tarea está terminada sin haber aprobado todos los tests, validaciones estáticas, actualizaciones de documentación y el resumen del proceso (*walkthrough*).

---

## 3. Capas del Motor

El flujo táctico se divide en las siguientes capas de responsabilidad:

**Player Input (React UI)**
Genera intenciones del jugador mediante clics o interacciones.
*NO debe:* Ejecutar lógica de reglas ni mutar estados de combate directamente.

↓

**Dispatcher (WebSocket / API)**
Recibe un payload de red, lo enruta según el tipo de comando y delega su procesamiento. Valida estructuralmente mediante schemas estáticos (Zod).
*NO debe:* Contener lógica de combate.

↓

**Command Handlers (Controladores de Dominio)**
Validan el ownership, permisos y viabilidad lógica del comando. Construyen el contexto necesario para los resolvers. Centralizan la mutación.
Ejemplos: `attackCommands.ts`, `movementCommands.ts`, `tacticalCommands.ts`.
*NO deben:* Calcular resultados matemáticos directamente ni resolver posicionamiento.

↓

**Rule Layer (Lógica Base Compartida)**
Provee las validaciones espaciales y mecánicas universales.
Ejemplos: `canUseFiveFootStep`, `isPathClear`, `threatensTarget`, `isFlanking`.
*NO debe:* Conocer detalles de la red o modificar el estado global del combate.

↓

**Context Layer (Constructores de Escenario)**
Traduce el estado del tablero y los combatientes involucrados a un set de modificadores numéricos aplicables para una acción específica.
Ejemplos: `getAttackContextModifiers`.

↓

**Pure Resolvers (Motores Matemáticos d20)**
Reciben entradas numéricas puras (stats, buffs, penalizadores) y devuelven un objeto inmutable con el resultado matemático de la acción.
Ejemplo: `resolveAttack` (`attackResolver.ts`).
*NO deben:* Iterar sobre el `roomState`, buscar aliados ni conocer el contexto del tablero.

↓

**Mutation Layer (Modificación de Estado)**
Aplica el resultado del resolver al estado en memoria de la sala. Registra logs, ajusta HP, consume acciones (`usedMoveAction`, `usedStandardAction`).

↓

**Room Synchronization (Sincronización de Fases)**
La función centralizada `syncEncounterPhase(room)` evalúa el estado del combate y transiciona la fase si corresponde (ej. activando `opportunity-resolution` o volviendo a `active`).

↓

**Broadcast (Red)**
El servidor emite el `roomState` actualizado a todos los clientes conectados a la sala.

↓

**React UI (Renderizado)**
Se actualiza reactivamente según el nuevo estado recibido del servidor.

---

## 4. Flujo Completo: Ejemplo Paso a Paso

*Escenario: Jugador selecciona Atacar contra un enemigo flanqueado.*

1. **Player Input:** El jugador pulsa el botón "Atacar" en la UI sobre un objetivo.
2. **Command Generation:** React genera un `ClientCommand` de tipo `attack-combatant`.
3. **Dispatcher:** El WebSocket del servidor recibe el JSON, lo valida con Zod en `validateClientCommand` y lo rutea hacia `handleAttackCombatant`.
4. **Command Handler:** `attackCommands.ts` verifica que sea el turno del jugador y que tenga permisos.
5. **Rule & Context Layer:** El handler llama a `getAttackContextModifiers(room, attacker, target)` que internamente usa la regla pura `isFlanking(room, attacker, target)`. El contexto devuelve un bonus táctico de `+2`.
6. **Pure Resolver:** El handler llama a `resolveAttack(...)` pasando las estadísticas base + el bonus de contexto. El resolver devuelve `{ hit: true, damage: 8, isThreat: false }`.
7. **Mutation Layer:** El handler aplica `target.hp -= 8`, marca `usedStandardAction = true`, e inserta el resultado en el log.
8. **Room Synchronization:** Se llama a `syncEncounterPhase(room)`. Como no hay críticos ni AdOs pendientes, la fase se mantiene en `active`. Si el objetivo murió, se llama a `rules.ts (lifeStatus)` para ajustar su estado.
9. **Broadcast:** Se envía el nuevo estado por WebSocket.
10. **React UI:** El navegador del jugador repinta el board reflejando el daño y deshabilitando el botón de ataque.

---

## 5. Componentes Principales

- **`rules.ts`**: El corazón del sistema. Contiene funciones puras exportadas universalmente para evaluar viabilidad de movimiento, adyacencia, flanqueo, alcance y estado vital.
- **`attackResolver.ts`**: Motor puro de resolución d20. No sabe qué es el tablero ni quién ataca, solo toma modificadores y devuelve resultados de impacto, amenaza, confirmación y daño.
- **`movementCommands.ts`**: Controlador de dominio que resuelve el comando de movimiento continuo, restando pie por pie, validando bloqueos y generando ataques de oportunidad.
- **`tacticalCommands.ts`**: Controlador de dominio para mecánicas espaciales sin ataque estándar, como el Paso de 5 pies, la Carga, Luchar a la defensiva y Defensa total.
- **`dispatcher`**: Archivo de enrutamiento principal. Intercepta los mensajes WebSocket, valida schemas y distribuye a los Command Handlers.
- **`roomState`**: Estructura en memoria (RAM) de la sala alojada en el servidor. Fuente de la verdad efímera de la sesión.
- **`CombatRoom` & `TurnState`**: Tipos TypeScript que modelan el estado general y el detalle preciso de acciones consumidas en el turno actual del combatiente activo.
- **`Snapshots`**: Instancias congeladas del combate usadas principalmente para retener información contextual pasada. (Ej. resolver un AdO evaluando la casilla de origen, o estandarizar perfiles base a combatientes dinámicos).
- **`viewModel / ActionsPanel`**: Capa frontend encargada de traducir el estado de la sala y del turno en botones interactivos deshabilitando opciones inválidas usando las reglas compartidas de `rules.ts`.

---

## 6. Conceptos Reutilizables

Estos son los primitivos tácticos que sustentan al motor:

- **Threat (Amenaza):** Función pura `threatensTarget`. Define si A puede golpear cuerpo a cuerpo a B desde su posición actual. Usado por Flanqueo y Ataques de Oportunidad. 
- **Flanking (Flanqueo):** Función matemática pura que proyecta líneas rectas para buscar aliados.
- **Attack Context:** Estructura que envuelve variables externas (flanqueo, cobertura futura, penalizadores de visión futura) aplanadas a modificadores numéricos antes del resolver.
- **Encounter Phase:** Máquina de estados de la sala (`active`, `opportunity-resolution`, `critical-confirmation`) que bloquea el flujo principal hasta resolver eventos intervinientes.
- **Snapshots:** `CombatantSnapshot` inicializa a las criaturas.
- **Pure Resolver:** Cualquier módulo matemático que dependa de dependencias explícitas en sus parámetros y retorne outputs sin alterar variables globales.

*Futuras reglas (como Cobertura o Condiciones) dependerán íntegramente de estos primitivos.*

---

## 7. Cómo agregar una nueva regla (Workflow Recomendado)

Toda nueva regla táctica en el Combat Engine debe seguir esta estructura escalonada:

1. **¿Es una regla universal?** 
   - *Implementación:* Escribir una función pura en `packages/shared/src/rules.ts` (ej. `hasCover`).
2. **¿Necesita aplicarse condicionalmente al ataque/defensa?**
   - *Implementación:* Evaluarla dentro de `getAttackContextModifiers()` para entregar modificadores estáticos.
3. **¿Necesita modificar cómo se resuelve la matemática?**
   - *Implementación:* Pasar el modificador al **Resolver** (`attackResolver.ts` o un resolver nuevo), sin pasar todo el combatiente ni la sala.
4. **¿Muta el estado global o lanza logs?**
   - *Implementación:* Programar el efecto y la respuesta visual en el **Command Handler** correspondiente (`attackCommands.ts`, `movementCommands.ts`).
5. **¿Afecta la selección del jugador?**
   - *Implementación:* Usar la regla pura exportada (paso 1) dentro de `App.tsx` o `ActionsPanel.tsx` para colorear o deshabilitar opciones.
6. **Validaciones obligatorias:**
   - Escribir tests unitarios para la función pura.
   - Escribir tests E2E para el comando.
7. **Documentación (DoD):**
   - Actualizar `TODO.md`, `PROJECT_STATUS.md` y `rules-coverage-checklist.md`.

---

## 8. Antipatrones Prohibidos

El éxito a largo plazo de este motor depende de **NO** introducir los siguientes antipatrones:

- ❌ **Resolvers iterando combatientes:** El resolver matemático no debe conocer el concepto de "board" ni iterar la lista de aliados/enemigos. 
- ❌ **Resolver modificando CombatRoom:** Ningún resolver debe reducir el HP, cambiar la posición o marcar acciones como usadas. Eso es tarea exclusiva del *Command Handler*.
- ❌ **UI implementando reglas distintas (Hardcoding):** La UI no puede definir por su cuenta si un ataque es posible. Debe importar la regla de `shared/src/rules.ts`.
- ❌ **`attackResolver` leyendo posiciones:** Las posiciones espaciales (X, Y) deben resolverse en la Capa de Contexto, aplanándose a un modificador matemático (ej. +2) antes de llegar al resolver.
- ❌ **Lógica táctica dentro del resolver matemático:** El resolver tira dados y suma modificadores. No decide si alguien puede o no lanzar un hechizo o qué tipo de ataque de oportunidad corresponde.
- ❌ **Mutaciones fuera de Command Handlers:** Las funciones en `rules.ts` o `combatSnapshot.ts` tienen prohibido alterar variables externas o alterar `TurnState`.

---

## 9. Estado Actual del Motor

| Capa del Motor | Estado | Descripción |
|----------------|--------|-------------|
| **Motor Base** | ✅ Maduro | Salas de red, roles, turnos, movimiento base y renderizado del tablero con prevención de colisiones. |
| **Motor Táctico** | ✅ Maduro | Sistema d20 (Críticos completos), Flanqueo, Carga, Paso de 5 pies, Ataques de Oportunidad por movimiento. |
| **Motor de Combate** | 🟡 En Desarrollo | Ataques simples implementados. Falta formalizar Ataques Iterativos, Dos Armas y Desglose de BAB. |
| **Motor de Estados** | 🔴 Inicial | Solo implementa vida (Disabled, Dying, Dead). Falta sistema formal de Condiciones (Prone, Stunned, Flat-footed). |
| **Motor Defensivo** | 🔴 Inicial | CA general implementada. Faltan CA desglosadas (Touch, Flat-footed), Cobertura, Ocultación y Reducciones. |
| **Motor de Magia** | 🔴 Pendiente | Sistema completamente sin diseñar (Saves, Spells, Concentración). |

---

## 10. Roadmap Arquitectónico

La evolución del motor prioriza las capas fundacionales antes que reglas específicas:

**Fase 1: Motor Base (Finalizada)**
Estabilidad de red, roles, persistencia local y sincronización de tablero.

**Fase 2: Motor Táctico (En Cierre)**
Posicionamiento, Flanqueo, AdOs básicos, pureza de resolvers y refactor arquitectónico.

**Fase 3: Motor de Combate (Próxima)**
- Ataque Completo Formal (Desglose de BAB).
- Ataques Iterativos (múltiples rolls).
- Combate con Dos Armas.
- Armas con Reach dinámico.
- Combat Reflexes (Cola de AdOs).

**Fase 4: Motor de Estados**
- Matriz de Condiciones tipada (`Condition[]`).
- Modificadores reactivos globales (Stunned, Flat-footed, Prone).
- Levantarse y provocar AdO.

**Fase 5: Motor Defensivo**
- Desglose de Touch AC y Flat-Footed AC.
- Cobertura estática por raycasting de esquinas.
- Ocultación (Concealment).
- Damage Reduction (DR) y Resistencias Elementales.

**Fase 6: Motor de Magia**
- Saving Throws (Fort, Ref, Will).
- Spell Resistance.
- Mecánica de Casteo y Concentration checks por daño.

**Fase 7: Motor Avanzado**
- Tokens Grandes (> 1 casilla).
- Impacto del Tamaño de criaturas en alcances y estadísticas.
- Terreno Difícil (costos de movimiento).
