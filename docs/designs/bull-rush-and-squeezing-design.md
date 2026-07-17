# Sprint 031 — Bull Rush & Dynamic Squeezing (consolidación source-first)

**Estado:** Fase 2 — diseño pendiente de aprobación formal `Proceed`.

Este documento no autoriza cambios en archivos ejecutables. La implementación queda bloqueada hasta la aprobación explícita del Lead Architect.

## 0. Decisión de alcance tras el mapeo obligatorio

La solicitud de Sprint 031 coincide materialmente con una capacidad ya implementada en Sprint 028. El repositorio actual ya contiene:

- `getCombatantOccupiedCells`, `FootprintGeometry` privada y huellas Large 2×2;
- `projectForcedMovement` con parada ante tablero, terreno y masas conscientes;
- el discriminante WebSocket estricto `bull_rush` dentro de `resolve-special-maneuver`;
- resolución de Embestida con AdO interruptivo, oposición de Fuerza/tamaño y distancia por margen;
- `Board.narrowCells`, proyección Large 2×1/1×2 y coste doble;
- `srd_squeezing`, reconciliación mediante `EffectManager` y `commitSpatialTransition`;
- preview compartido en ActionsPanel y overlay de trayectoria/footprint;
- la suite `tests/bull-rush-and-squeezing.test.mjs`.

Por tanto, Sprint 031 no creará una segunda Embestida, otro resolvedor de colisiones ni un nuevo comando. Su objetivo legítimo es **consolidar la implementación existente contra la especificación actual**, cerrar los bypasses espaciales residuales y ampliar la red de regresión. El diseño original de Sprint 028 se conserva íntegramente como anexo histórico en este mismo documento.

### 0.1 Delta comprobado

| Área | Estado actual | Decisión Sprint 031 |
|---|---|---|
| comando `bull_rush` | ya registrado, validado y despachado | contrato estable; no se modifica el payload |
| desplazamiento forzado | puro, pero proyecta siempre la huella natural | proyectar el footprint efectivo por paso y devolver el modo espacial final |
| commit de Bull Rush | fuerza `"natural"` al terminar | reconciliar desde la proyección final, nunca desde una constante del handler |
| frontera espacial | existe, pero sobreviven asignaciones permanentes directas de `position` | auditar y migrar solo commits autoritativos; las posiciones temporales de simulación de AdO se mantienen efímeras y documentadas |
| idempotencia Squeezing | elimina y recrea la instancia incluso si el modo no cambia | conservar identidad cuando ya coincide; añadir/eliminar solo al cambiar de modo |
| etiqueta del penalizador | actualmente `"apretujarse -4"` | adoptar exactamente `"squeezing -4"` en el breakdown |
| preview de colisión | expone ruta y ancla final, no la causa estructurada | propagar `blocked`, `blockedAt` y `blockedReason` desde shared |
| pruebas | cubren entrada 2×1, penalizador melee, muro parcial y AdO abortivo | añadir umbrales de margen, salida/limpieza, composición de costes, etiqueta exacta, masas y schema estricto |

## 0.2 Objetivo de arquitectura

Consolidar una sola tubería espacial:

```text
intención autoritativa
  → preview/proyección pura por pasos
  → resultado espacial estructurado
  → commitSpatialTransition idempotente
  → posición + srd_squeezing reconciliados en el mismo commit
```

Bull Rush únicamente calcula dirección y distancia teórica. El proyector decide hasta dónde puede avanzar la masa. La frontera de commit decide posición y efecto a partir del resultado, sin volver a interpretar geometría.

## 0.3 Embestida consolidada

La secuencia normativa permanece:

1. preflight de fase, ownership, turno, economía, objetivo y alcance;
2. AdO autoritativo del defensor; daño mayor que cero aborta;
3. oposición `1d20 + FUE efectiva + getSpecialManeuverSizeModifier(size)`;
4. si gana el atacante, `5 ft + 5 ft × floor(margen / 5)`;
5. `projectForcedMovement` recorre cada ancla y detiene antes de la primera huella ilegal;
6. un único commit consume la acción, aplica el resultado del AdO, mueve/reconcilia y registra logs.

La dirección sigue derivándose de las geometrías de ambos footprints. El cliente no envía dirección, distancia, margen, tirada defensora, casillas ni modo espacial.

### Resultado puro de desplazamiento

La firma pública requerida se conserva:

```text
projectForcedMovement(snapshot, target, direction, maxDistanceFeet)
```

Su resultado se eleva para contener, además de ruta y bloqueo, pasos con:

- ancla;
- celdas ocupadas;
- `spatialMode: "natural" | "squeezing"`;
- eje derivado cuando aplique;
- posición y modo finales;
- primera ancla bloqueada y causa cerrada.

No se persisten footprints, ejes ni límites. El índice de ocupación y `FootprintGeometry` continúan siendo efímeros.

Una criatura consciente constituye masa física con independencia de facción. Esto satisface el bloqueo mínimo requerido para enemigos y evita permitir solapamientos con aliados. Cadáveres conservan la política existente.

## 0.4 Squeezing reactivo e idempotente

`Board.narrowCells` permanece como fuente declarativa. Para Large V1:

- horizontal proyecta 2×1;
- vertical proyecta 1×2;
- no se guarda orientación;
- intersecciones ambiguas y diagonales comprimidas continúan fuera de alcance.

Cada paso comprimido duplica su coste. El multiplicador se compone con terreno difícil y otras políticas de paso sobre el coste base, sin reemplazarlas ni aplicar el número de celdas corporales como multiplicador adicional.

`commitSpatialTransition` recibirá la proyección final, o posición y modo derivados de ella. Su postcondición será:

- modo natural: cero instancias `srd_squeezing` para el objetivo;
- modo squeezing: exactamente una instancia;
- modo sin cambio: no recrear la instancia ni alterar su identidad;
- posición y efecto quedan reconciliados antes del broadcast.

Las asignaciones temporales de posición usadas para calcular un AdO sobre la casilla abandonada no son commits y deben restaurarse dentro del mismo bloque de resolución. Movimiento normal, paso de 5 pies, carga, GM move y desplazamiento forzado sí deben atravesar la frontera común cuando consolidan una posición.

## 0.5 ActiveEffects y breakdown exacto

`srd_squeezing` sigue siendo la única fuente de penalizadores:

- AC circunstancial `-4`;
- ataque melee circunstancial `-4`;
- ataques ranged sin ese penalizador;
- etiqueta exacta del modificador de ataque: `squeezing -4`.

La geometría nunca se calcula desde el efecto. El efecto describe el estado mecánico; la proyección espacial demuestra si ese estado debe existir.

## 0.6 UI compartida

ActionsPanel y Board consumen el mismo `BullRushManeuverPreview` compartido. El preview añadirá información estructurada de bloqueo para mostrar:

- trayectoria potencial;
- footprint final;
- primera colisión y su categoría;
- advertencia de AdO;
- modificadores de Fuerza y tamaño.

React decide colores y texto, pero no calcula huellas, margen, dirección o colisión. No se introduce ningún campo nuevo enviado por el cliente.

## 0.7 Impacto por subsistema

| Subsistema | Impacto Sprint 031 |
|---|---|
| Rule Engine | refina el resultado de forced movement y usa footprint efectivo por paso |
| CombatRoom / Snapshot | sin campos persistidos nuevos |
| ActiveEffects | corrige etiqueta y fortalece reconciliación idempotente |
| WebSocket | sin cambio de contrato; `bull_rush` ya existe |
| Server | Bull Rush consume el modo final; auditoría de commits espaciales permanentes |
| UI | muestra causa de colisión desde preview shared |
| Tests | caracterización y regresión adicional; no se borran pruebas de Sprint 028 |

## 0.8 Design Review Checklist Sprint 031

### Filtro de irreversibilidad a 20 sprints

La decisión más costosa sería convertir `projectForcedMovement` en una función de Bull Rush o codificar dirección/distancia en comandos de red. Se conserva como proyector puro de movimiento lineal sobre footprints y se separa del productor de la intención. Telequinesis, gravedad, explosiones, empujes o atracciones podrán construir una dirección y distancia en sus resolvers existentes y consumir la misma proyección y el mismo commit espacial, sin crear handlers dedicados al movimiento.

La frontera estable es `proyección pura → commit espacial`, no `comando Bull Rush → mutación de position`.

### Complejidad accidental

El riesgo de `srd_squeezing` huérfano no requiere Tick Layer ni limpieza periódica. Surge cuando una ruta autoritativa asigna `position` directamente o cuando el caller impone `"natural"`. La solución es reconciliar el efecto desde la proyección final en la misma frontera de commit y hacerla idempotente. Salir del corredor elimina el efecto en ese mismo frame; permanecer dentro conserva exactamente una instancia.

### Matriz de reutilización

| Capa | Reutilización |
|---|---|
| ActiveEffects | `srd_squeezing`, `SQUEEZING`, `EffectManager` y modifiers contextuales |
| Pure helpers | footprints, geometría rectangular, índice de ocupación, proyección de paso y forced movement |
| Resolvers | AdO interruptivo, oposición común, economía estándar, commit y broadcast existentes |

### Regla de tres

1. **Arrollar / Overrun:** reutiliza oposición, colisión de masas y recorrido por pasos.
2. **Empuje hacia trampas o terreno peligroso:** cada paso permite disparadores espaciales sin confiar en una posición final opaca.
3. **Improved Bull Rush:** elimina el AdO o modifica la oposición desde `FeatCatalog` sin cambiar el desplazador.

También quedan habilitados Telequinesis, efectos de gravedad y atracciones lineales.

## 0.9 Alternativas rechazadas

- **Reimplementar Sprint 028:** duplicaría helpers, schemas, handlers y UI; rechazado.
- **Nuevo comando `bull-rush`:** rompe el envelope de maniobras ya consolidado; rechazado.
- **Persistir orientación o footprint:** duplica topología derivada; rechazado.
- **Limpiar Squeezing al inicio de ronda:** deja ventanas de estado inválido; rechazado.
- **Calcular el obstáculo en React:** viola servidor autoritativo y crea previews divergentes; rechazado.

## 0.10 Pruebas y aceptación proyectadas

Tras un futuro `Proceed`, la implementación deberá demostrar:

- margen 1–4 = 5 ft y margen 5–9 = 10 ft;
- AdO con daño aborta antes de la oposición y sin desplazamiento;
- footprint Large se detiene ante cualquier colisión parcial;
- masa consciente bloquea y se reporta con causa estructurada;
- entrar en narrowCells deriva 2×1/1×2 y coste doble;
- coste Squeezing se compone determinísticamente con terreno difícil;
- salir por cualquier commit autoritativo elimina el efecto en el mismo frame;
- permanecer comprimido no recrea la instancia;
- AC y melee reciben `-4`, ranged no, y el breakdown contiene exactamente `squeezing -4`;
- schema sigue rechazando dirección, distancia o resultado inyectados;
- Board y ActionsPanel muestran la misma colisión que el servidor;
- regresión global: `npm test`, `npm run typecheck`, `npm run build`, E2E WebSocket y Playwright.

## 0.11 Fuera de alcance

- contra-embestida y seguimiento voluntario del atacante;
- daño por choque, caídas, empuje en cadena o trampas reales;
- Improved Bull Rush como dote implementada;
- Huge/Gargantuan, formas no cuadradas, giros o cruces angostos;
- movimiento curvo, radial o vertical;
- persistir ejes, footprints o geometría en perfiles/snapshots;
- cambiar el contrato WebSocket existente.

---

## Anexo A — Diseño base de Sprint 028

Las secciones siguientes se conservan como registro histórico del diseño que originó la implementación actual. Las menciones a “pendiente de Proceed” pertenecen a esa fase histórica y no describen el estado del código al inicio de Sprint 031.

## 1. Objetivo

Incorporar la maniobra especial de Embestida y convertir Apretujarse en una proyección espacial reactiva para criaturas Large, reutilizando las huellas multicelda de Sprint 027, el pipeline transaccional de Derribo y ActiveEffects como única representación de penalizadores persistentes.

El sprint debe resolver dos problemas relacionados sin mezclarlos:

1. una Embestida calcula una oposición autoritativa y proyecta un desplazamiento forzado hasta la última huella legal;
2. un movimiento voluntario puede sustituir temporalmente la huella natural 2×2 por una franja comprimida dentro de un corredor declarativamente angosto.

## 2. Mapeo obligatorio del estado actual

### 2.1 Geometría reutilizable de Sprint 027

`packages/shared/src/rules.ts` ya aporta:

- `getCombatantOccupiedCells` como única API pública de ocupación;
- derivación natural desde `sizeCategory`, `SizeRulesCatalog.spaceFeet` y `board.cellSizeFeet`;
- `FootprintGeometry` privada y efímera;
- distancia O(1) entre límites rectangulares;
- índice local celda→combatientes para validar rutas;
- colisión integral contra tablero, muros y masas conscientes;
- `provokingCells` exactas para Ataques de Oportunidad.

La Embestida debe consumir estas primitivas. No se creará un segundo algoritmo de colisión ni un footprint persistido.

### 2.2 Pipeline transaccional de Derribo

`apps/server/src/commands/specialManeuverCommands.ts` ya centraliza:

1. preflight de fase, ownership, turno, acción y regla pura;
2. resolución del AdO interruptivo y dados enfrentados;
3. commit único de acción, daño, efecto, estadísticas y logs.

El contrato WebSocket ya usa un envelope único `resolve-special-maneuver`, pero el discriminante interno solo acepta `trip`. Sprint 028 ampliará ese discriminante a `bull_rush`; no añadirá un comando superior ni un handler WebSocket separado.

### 2.3 Squeezing parcial heredado de Sprint 023

La base existente evita partir de cero:

- `Board.narrowCells` ya marca suelo angosto;
- `srd_squeezing` ya declara el trait `SQUEEZING`, `-4 AC` y `-4 ATTACK`;
- el coste de ruta ya duplica pasos cuya coordenada ancla está en `narrowCells`;
- `movementCommands.ts` añade o elimina manualmente el efecto al terminar el movimiento.

Sin embargo, esa implementación no satisface Large Footprints:

- inspecciona solo el ancla, no el cuerpo ocupado;
- no proyecta una forma comprimida, por lo que un 2×2 sigue chocando con el muro;
- muta `effectInstances` mediante `push`/`splice` fuera de `EffectManager`;
- solo el movimiento normal reconcilia el efecto; paso de 5 pies, carga, movimiento GM, rollback de AdO y desplazamiento forzado pueden dejarlo huérfano;
- el modificador `ATTACK -4` es incondicional y penaliza también ataques ranged, contrario a la especificación melee;
- UI y servidor calculan costes desde la casilla ancla, no desde una proyección espacial común.

Sprint 028 reemplazará esa lógica ad hoc; no coexistirán ambos mecanismos.

## 3. Invariantes

1. El servidor deriva dirección, distancia posible, colisiones y efectos; el cliente solo expresa intención y tiradas manuales permitidas.
2. Ningún comando acepta una ruta de empuje, dirección o distancia final elegida por el cliente.
3. `position` continúa siendo el ancla persistida; ni límites ni celdas ocupadas se guardan.
4. Todo desplazamiento termina en la última huella completamente legal o no desplaza.
5. Una maniobra y su AdO interruptivo son atómicos desde el punto de vista de `CombatRoom`.
6. `srd_squeezing` existe exactamente una vez mientras la proyección final esté comprimida y cero veces fuera de ella.
7. `validateMovePath` y sus proyecciones son puras: nunca mutan sala ni efectos.
8. Los penalizadores de Squeezing provienen exclusivamente de `effectsCatalog`.
9. La UI consume los mismos previews shared; no reproduce geometría, margen de oposición ni colisiones.
10. Medium, Large no comprimido y todas las reglas de Sprint 027 conservan su comportamiento.

## 4. Arquitectura de maniobras especiales

### 4.1 Contrato discriminado

`SpecialManeuverId` pasa a ser:

```text
"trip" | "bull_rush"
```

El envelope permanece estable:

```text
resolve-special-maneuver {
  maneuver: TripIntent | BullRushIntent
}
```

`BullRushIntent` contiene únicamente:

- `attackerId`;
- `targetId`;
- `d20OpposedRoll: number | null`;
- `isAutoRoll?: boolean`.

No contiene dirección, casillas, margen, modificadores, resultado defensor ni distancia de empuje. El schema Zod será estricto y el servidor generará la tirada del defensor.

### 4.2 Orquestador único

El handler actual se divide internamente en fronteras reutilizables:

1. `preflightSpecialManeuver`: fase, ownership, turno, economía y preview puro;
2. `resolveInterruptingOpportunityAttack`: AdO compartido con etiqueta de maniobra;
3. `resolveOpposedCheck`: dados, atributo, tamaño y desempate determinista;
4. resolver específico que produce un resultado inmutable de Trip o Bull Rush;
5. `commitSpecialManeuver`: aplica una sola vez acción, daño, efectos, desplazamiento, estadísticas y logs.

El dispatcher discrimina el subtipo, pero no duplica autenticación, economía, dados, AdO ni commit.

### 4.3 Preflight de Bull Rush

`validateSpecialManeuver(..., "bull_rush")` devuelve un `BullRushManeuverPreview` con:

- distancia actual entre footprints;
- alcance legal de contacto;
- si provoca y si el defensor puede ejecutar AdO;
- modificadores efectivos de Fuerza y tamaño de ambos participantes;
- dirección autoritativa de empuje;
- máximo teórico por margen antes de colisiones;
- celdas de los primeros pasos proyectados y primer bloqueo físico, si existe.

La maniobra requiere enemigos distintos, atacante y defensor conscientes (`active` o `disabled`), contacto melee y una dirección no nula.

La dirección se deriva de los centros de los límites completos:

```text
dx = Math.sign(targetCenterX - attackerCenterX)
dy = Math.sign(targetCenterY - attackerCenterY)
```

El vector se normaliza a un paso de grid y nunca se confía al cliente. V1 admite las ocho direcciones del tablero; cada paso mantiene la misma dirección lineal.

### 4.4 AdO interruptivo

Intentar Bull Rush provoca un AdO del defensor si este está activo, amenaza al atacante y puede reaccionar. Si el ataque impacta e inflige daño, la maniobra se aborta inmediatamente.

El preflight contempla `FeatCatalog.avoidsOpportunity(attacker.featIds, "bull_rush")` aunque Sprint 028 no necesita catalogar Improved Bull Rush. Esto deja la excepción futura declarativa y evita otro `if` en el handler.

Un fallo, impacto sin daño o incapacidad del defensor permite continuar. La confirmación crítica permanece autoritativa y reutiliza la rutina de Derribo.

### 4.5 Prueba enfrentada

Tras superar el AdO:

```text
Atacante = 1d20 + FUE efectiva + modificador especial de tamaño
Defensor  = 1d20 + FUE efectiva + modificador especial de tamaño
```

Ambos modificadores de tamaño provienen de `getSpecialManeuverSizeModifier`. La Fuerza efectiva proviene de `getEffectiveAbilityModifier`, por lo que fatiga, drenaje y otros efectos se reflejan en caliente.

Se extrae una infraestructura común de prueba opuesta:

- mayor total gana;
- en empate gana el mayor modificador;
- si total y modificador empatan, el servidor repite ambos d20 con límite defensivo, igual que Derribo.

El cliente jamás envía la tirada del defensor ni rerolls.

### 4.6 Distancia teórica de empuje

Si el atacante gana:

```text
margin = attackerTotal - defenderTotal
theoreticalSteps = 1 + floor(margin / 5)
theoreticalDistanceFeet = theoreticalSteps * board.cellSizeFeet
```

Con tablero de 5 ft, ganar por 1–4 desplaza 5 ft; por 5–9 desplaza 10 ft, y así sucesivamente.

Si pierde, el resultado no contiene desplazamiento. El contra-empuje queda fuera de alcance.

## 5. Resolver genérico de desplazamiento forzado

### 5.1 Contrato puro

Se introduce una primitiva shared conceptualmente equivalente a:

```text
projectForcedMovement(snapshot, target, {
  kind: "push" | "pull",
  direction: { dx, dy },
  maximumDistanceFeet,
  collisionPolicy: "stop-before-blocker",
  allowSqueezing
}) -> ForcedMovementProjection
```

El resultado contiene:

- ruta legal de anclas;
- huella ocupada por paso;
- distancia teórica y real;
- posición final;
- primer paso bloqueado y causa (`board`, `impassable`, `combatant`);
- IDs de masas bloqueantes cuando corresponda.

No muta el objetivo ni la sala.

### 5.2 Colisión de masa

Por cada paso se proyecta la huella completa del defensor y se valida contra:

1. límites del tablero;
2. `impassableCells`;
3. footprints de otros combatientes conscientes.

El primer paso ilegal no se incluye. El objetivo queda en la última ancla legal. Si el primer paso está bloqueado, la oposición puede haberse ganado pero la distancia real es cero; el log distingue resistencia de obstrucción.

Criaturas muertas o indefensas conservan la política de ocupación vigente hasta que una regla específica de apilamiento corporal la reemplace. Daño por choque, derribo secundario o empujar otra masa en cadena quedan fuera de alcance.

### 5.3 Reutilización futura

Bull Rush solo calcula el máximo y llama a `projectForcedMovement`. Telequinesis, efectos de empuje/atracción, explosiones y dotes futuras podrán producir el mismo intent desde sus resolvers actuales —conjuros, aptitudes o maniobras— sin crear un command handler de movimiento forzado.

El resolvedor recibe una política explícita: Bull Rush V1 usa `allowSqueezing: false`. No comprime involuntariamente a una criatura que estaba en modo natural. Una criatura que ya está válidamente comprimida conserva su footprint efectivo al ser desplazada dentro del mismo corredor.

## 6. Dynamic Squeezing

### 6.1 Fuente declarativa del corredor

`Board.narrowCells` sigue siendo la fuente autoritativa del suelo angosto. El motor no adivina pasillos a partir de cualquier pareja de muros, porque eso permitiría atravesar geometrías no declaradas por el mapa.

Para Large V1, un corredor válido ofrece una franja continua de una casilla de ancho y dos casillas de largo. Su eje se deriva de la conectividad de `narrowCells`:

- horizontal: huella comprimida 2×1;
- vertical: huella comprimida 1×2.

La proyección natural 2×2 siempre se intenta primero. Solo se usa Squeezing cuando la huella natural no cabe por límites/muros, la franja comprimida completa está marcada como angosta y no colisiona con masas.

Intersecciones donde ambos ejes sean simultáneamente válidos, giros dentro del corredor y diagonales comprimidas se rechazan en V1 con un error explícito. Así no se persiste orientación ni se introduce una elección arbitraria.

### 6.2 Proyección por paso

La validación de movimiento produce metadatos estructurados:

```text
MovementStepProjection {
  anchor,
  occupiedCells,
  spatialMode: "natural" | "squeezing",
  squeezingAxis?: "horizontal" | "vertical",
  baseCostFeet,
  multipliers,
  totalCostFeet
}
```

`validateMovePath` delega en esta proyección y devuelve también los pasos evaluados. Servidor y React consumen los mismos datos para coste, colisiones, overlays y estado final.

`calculatePathStepCostsFeet` y `calculatePathCostFeet` dejan de decidir Squeezing mirando solo el ancla. Los consumidores que mueven combatientes migran al resultado de la proyección canónica; no se mantiene un segundo cálculo incompatible.

### 6.3 Coste acumulable

Cada paso comprimido incorpora el multiplicador `squeezing ×2`. Terreno difícil y movimiento acrobático conservan sus multiplicadores independientes, aplicados de forma determinista al coste base del paso.

La lista `multipliers` forma parte del breakdown, permitiendo comprobar y mostrar combinaciones como terreno difícil + Squeezing sin inferirlas desde un total opaco.

El coste se calcula por paso de ancla, no por número de celdas corporales.

### 6.4 Footprint efectivo

`getCombatantOccupiedCells` continúa siendo la única API pública. Internamente selecciona:

- huella natural cuando no existe `SQUEEZING` válido;
- franja comprimida derivada de `narrowCells` cuando el efecto aplica y el eje es inequívoco.

La función pura usada para validar una posición candidata puede solicitar explícitamente modo natural o comprimido sin mutar al combatiente. Ni orientación ni límites se guardan en `CombatantSnapshot`.

Board React ya deriva filas, columnas y mapa celda→combatiente desde esta API, por lo que un Large comprimido se representa como 2×1 o 1×2 sin una tabla visual paralela.

### 6.5 ActiveEffect correcto

`srd_squeezing` conserva:

- trait `SQUEEZING`;
- penalizador circunstancial `AC -4`;
- `onStack: "ignore"`.

El actual `ATTACK -4` incondicional se reemplaza por un `conditionalModifier` con `attack_type: "melee"`. Los ataques ranged no reciben penalizador.

La geometría no se deduce del modificador. El efecto describe el estado mecánico; la proyección espacial determina si ese estado debe existir.

### 6.6 Reconciliación y eliminación automática

Se crea una única frontera de commit espacial en servidor, conceptualmente `commitSpatialTransition(room, combatant, projection)`, responsable de:

1. asignar la posición final;
2. añadir `srd_squeezing` mediante `EffectManager` si el modo final es comprimido y no existe;
3. eliminar todas las instancias de Squeezing del objetivo si el modo final es natural;
4. emitir logs solo cuando cambia el modo;
5. preservar inmutabilidad y sincronizar fase.

Normal move, five-foot step, charge, GM move, rollback/finalización de AdO y Bull Rush deben pasar por esta frontera. La reconciliación es idempotente y basada en la proyección final, no en el estado anterior supuesto.

Si una ruta entra y sale del pasillo dentro del mismo comando, paga los pasos comprimidos pero termina sin efecto. Si termina dentro, queda exactamente una instancia. Al salir por cualquier vía autoritativa, se elimina en el mismo commit que cambia la posición.

## 7. Atomicidad de Bull Rush

El handler sigue la secuencia:

1. validar todo contra snapshot;
2. resolver AdO y confirmación sin mutar sala;
3. si no aborta, resolver oposición;
4. si gana, proyectar todo el desplazamiento y sus colisiones;
5. construir un draft de cambios;
6. commit único de acción, daño interruptivo, HP, posición, efecto espacial, estadísticas y logs;
7. comprobar resultado del combate y broadcast.

Ninguna excepción posterior al preflight puede dejar daño aplicado sin consumir acción, posición parcial o efecto Squeezing huérfano.

## 8. UI y preview compartido

### 8.1 ActionsPanel

`TacticMode` incorpora `bull-rush`. La tarjeta muestra:

- objetivo enemigo;
- si provocará AdO;
- modificadores FUE + tamaño de ambos;
- dirección derivada;
- casillas potenciales de empuje para los márgenes visibles;
- primer obstáculo y distancia libre actual;
- control de d20 manual/AUTO y botón `Maniobra: Embestir`.

El cliente envía solo el intent discriminado. El servidor recalcula el preview antes de resolver.

### 8.2 Board

El preview devuelve celdas clasificadas, no colores. React decide presentación:

- trayectoria potencial de empuje;
- footprint final posible;
- primer bloqueador en rojo;
- pasos comprimidos de movimiento voluntario con overlay específico.

La selección, spans y celdas interactivas continúan derivando de `getCombatantOccupiedCells`.

## 9. Impacto por subsistema

| Subsistema | Impacto |
|---|---|
| Rule Engine | alto: oposición común, forced movement, proyección natural/comprimida y breakdown de coste |
| CombatRoom | sin campos nuevos; solo usa `effectInstances` existente |
| ActiveEffects | corrige `srd_squeezing` a ataque melee contextual |
| Snapshot | sin propiedades persistidas nuevas; consume `narrowCells` y efectos existentes |
| EquipmentCatalog | sin cambios |
| FeatCatalog | amplía `SpecialManeuverId`; queda preparado para Improved Bull Rush |
| Ownership | reutiliza `requireCombatantControl` y turno activo |
| WebSocket | mismo comando, nuevo subtipo estricto `bull_rush` |
| Server | orquestador de maniobras y commit espacial central |
| UI | nueva tarjeta, preview de empuje y overlays de compresión |
| Tests | unitarios geométricos/transaccionales, schemas, E2E y Playwright |

## 10. Alternativas consideradas

### 10.1 Comando `bull-rush` independiente

Rechazado. Duplicaría ownership, economía, AdO, dados, logs y dispatch. El envelope discriminado ya existe.

### 10.2 Enviar dirección o ruta desde React

Rechazado. Permitiría manipular distancia y atravesar obstáculos. La dirección deriva de footprints y la ruta del snapshot servidor.

### 10.3 Tratar al Large comprimido como 1×1

Rechazado. Reduce simultáneamente ancho y largo, pierde masa corporal y produce alcance/colisión incorrectos. V1 usa franja 2×1 o 1×2.

### 10.4 Persistir orientación del Squeezing

Rechazado. Duplicaría topología del mapa y exigiría migración. El eje se deriva de `narrowCells`; topologías ambiguas se rechazan explícitamente.

### 10.5 Mantener `push`/`splice` en movementCommands

Rechazado. Solo cubre una ruta de movimiento y deja estados huérfanos. La reconciliación pertenece al commit espacial común y usa `EffectManager`.

## 11. Design Review Checklist

### 11.1 Filtro de irreversibilidad a 20 sprints

La decisión difícil de revertir sería acoplar el empuje a `bull_rush` o al payload WebSocket. El diseño separa `projectForcedMovement` como una proyección pura parametrizada por dirección, distancia, política de colisión y capacidad de compresión. Bull Rush es únicamente un productor de ese intent después de su oposición.

Telequinesis puede producir `push` o `pull` desde el resolver de conjuros; una dote de Embestida alucinante puede aumentar distancia o cambiar política; una explosión puede generar intents radiales. Todos reutilizan el mismo desplazador y el commit espacial sin crear nuevos command handlers de movimiento.

### 11.2 Complejidad accidental

El efecto huérfano actual existe porque `movementCommands.ts` comprueba solo `destination.x/y` y muta el array manualmente. Sprint 028 elimina ese bloque y hace que toda mutación posicional atraviese `commitSpatialTransition`.

La proyección pura determina el modo final. El reconciliador añade una instancia si termina comprimido, elimina todas si termina natural y no hace nada si ya coincide. Al ejecutarse también en 5-foot step, carga, GM move, rollback de AdO y forced movement, salir del pasillo elimina el efecto inmediatamente sin Tick especial, polling ni limpieza diferida.

### 11.3 Matriz de reutilización

| Capa | Reutilización |
|---|---|
| ActiveEffects | `srd_squeezing`, `SQUEEZING`, `EffectManager`, modificadores AC/ATTACK contextuales |
| Pure helpers | footprints, límites, tamaño, distancia, amenaza, índice de ocupación y proyección de ruta |
| Resolvers | AdO interruptivo, opposed check, economía estándar, draft/commit y broadcast únicos |

### 11.4 Regla de tres

1. **Arrollar / Overrun:** reutiliza oposición, colisión de masas y desplazamiento lineal.
2. **Empujes hacia terreno o trampas:** el forced movement devuelve cada paso y posición final para disparadores de pinchos, fosos o terreno difícil.
3. **Dotes de embestida como Embestida Agresiva o Improved Bull Rush:** modifican AdO, margen o consecuencia sin sustituir el resolver.

También habilita Telequinesis, explosiones, atracciones y Squeezing de Huge mediante otra política de forma.

## 12. Estrategia de pruebas proyectada

### 12.1 Bull Rush

- schema acepta `bull_rush` y rechaza dirección/distancia inyectadas;
- ownership, turno y economía se validan antes de dados;
- AdO con daño aborta sin oposición ni desplazamiento;
- oposición usa Fuerza efectiva y modificadores de tamaño;
- margen 1–4 empuja 5 ft, 5–9 empuja 10 ft;
- muro en el primer paso produce desplazamiento cero;
- muro posterior conserva la última posición legal;
- defensor Large valida sus cuatro celdas en cada paso;
- otro combatiente consciente bloquea toda intersección parcial;
- fallo de oposición no mueve ni deja estado intermedio;
- cliente no controla tirada defensora, dirección ni rerolls.

### 12.2 Squeezing

- Large natural 2×2 sigue bloqueado donde no hay corredor declarado;
- corredor horizontal deriva 2×1 y vertical 1×2;
- topología ambigua o diagonal se rechaza en V1;
- cada paso comprimido duplica coste y combina el breakdown con terreno difícil;
- terminar dentro añade exactamente un `srd_squeezing`;
- atravesar y salir en el mismo comando termina sin efecto;
- salir mediante movimiento, 5-foot step, carga, GM move o desplazamiento lo elimina;
- `-4 AC` siempre aplica mientras está comprimido;
- `-4 ATTACK` aplica a melee y no a ranged;
- Board y servidor muestran las mismas celdas y costes.

### 12.3 Regresión y DoD futura

Tras `Proceed`:

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. `node scripts/e2e-websocket.mjs`
5. `npm run test:ui`

Los conteos se documentarán solo con resultados medidos.

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| doble implementación de desplazamiento | Bull Rush consume `projectForcedMovement`; no calcula rutas en el handler |
| efecto Squeezing huérfano | commit espacial único e idempotente para toda mutación posicional |
| divergencia UI/servidor | previews y pasos estructurados provienen de shared |
| penalizar ranged por error | modifier condicional `attack_type: melee` y test explícito |
| footprint circular respecto al efecto | validación candidata recibe modo explícito; API pública deriva modo actual válido |
| intersección de pasillos sin orientación | V1 la rechaza; no persiste un eje arbitrario |
| rollback parcial tras AdO | resolución completa sobre snapshot/draft antes del commit |
| empuje fuera del tablero o a través de masa | primera huella ilegal detiene la proyección |

## 14. Fuera de alcance

- contra-embestida, seguimiento voluntario del atacante y reglas completas de charge + bull rush;
- Improved Bull Rush como dote catalogada;
- estabilidad racial, más de dos patas u otros bonos defensivos especiales;
- daño por colisión, empujar masas en cadena o caer por precipicios;
- forced movement que comprime involuntariamente a una criatura natural;
- Huge/Gargantuan squeezing, formas no cuadradas, giros e intersecciones de corredor;
- rotación persistida, volumen 3D y elevación;
- Overrun, Grapple, Telekinesis y trampas reales.

## 15. Criterios de aceptación del diseño

- Bull Rush usa el comando y orquestador de maniobras existente.
- Fuerza, tamaño, AdO, margen y desplazamiento son autoritativos.
- Forced movement es puro, genérico y detiene la masa en la última huella legal.
- Large puede proyectarse 2×1/1×2 solo en corredores declarados válidos.
- Squeezing se añade y elimina mediante una frontera espacial central.
- El efecto penaliza CA y únicamente ataques melee.
- UI y servidor consumen los mismos previews.
- No se añaden campos persistidos a perfiles, snapshots o salas.
- La implementación no comienza sin `Proceed`.
