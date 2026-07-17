# Sprint 025 — Large Footprints V1 (ocupación 2×2)

**Estado:** ✅ Implementado y validado (286/286 tests, 84/84 E2E, 2/2 Playwright).

## Estado

Diseño en curso. Este documento no autoriza cambios en archivos ejecutables. La implementación queda bloqueada hasta recibir la palabra formal `Proceed`.

## 1. Objetivo

Habilitar criaturas Large que ocupen realmente cuatro casillas de un tablero de 5 ft, manteniendo `combatant.position` como ancla superior izquierda. La misma geometría derivada debe gobernar alcance, amenaza, flanqueo, movimiento, colocación y presentación visual, sin introducir una segunda verdad persistida.

## 2. Mapeo del estado actual

### 2.1 Snapshot y tamaño

- `Position` ya contiene `{ x, y, zFeet }` y se copia defensivamente al crear el snapshot.
- `CombatantSnapshot` ya conserva `sizeCategory` como fuente mecánica.
- `SizeRulesCatalog` ya declara `spaceFeet`: Medium/Small ocupan 5 ft, Large 10 ft, Huge 15 ft y Colossal 30 ft.
- No existe ni se necesita un campo persistido `footprint`, `widthCells` o lista de celdas ocupadas.

### 2.2 Infraestructura espacial reutilizable

`rules.ts` ya incluye:

- `getFootprintCells`, que deriva un cuadrado desde `SizeRulesCatalog.spaceFeet`;
- `distanceBetweenFootprintsFeet`, que obtiene la distancia mínima entre celdas;
- `threatensCell` y `threatensTarget`, que ya consultan parcialmente esas huellas;
- `areOppositeForFlanking`, frontera geométrica cuya implementación todavía delega en oposición 1×1.

Esta preparación evita reimplementar alcance. Sin embargo, `getFootprintCells` usa un divisor rígido de 5 ft, acepta `any`, no recibe el snapshot y convive con numerosos consumidores que continúan comparando únicamente posiciones ancla.

### 2.3 Suposiciones 1×1 que permanecen

| Área | Suposición actual | Riesgo con Large |
|---|---|---|
| `validateMovePath` | comprueba solo la casilla del ancla | tres celdas pueden atravesar muros, enemigos o salir del tablero |
| diagonal/esquinas | comprueba dos puntos junto al ancla | el borde delantero de un 2×2 puede cortar obstáculos |
| flanqueo | aplica `Math.sign` contra el ancla del objetivo | no representa caras opuestas de un defensor 2×2 |
| `roomState` | reserva y busca una celda por combatiente | spawns y reposicionamientos pueden solaparse |
| carga y Acrobacias | poseen helpers locales `sameCell`/`isCellOccupied` | aceptan rutas incompatibles con el footprint real |
| `viewModel.ts` | previews usan anclas | UI puede ofrecer destinos o alcances que el servidor rechazará |
| `Board.tsx` | el token vive dentro de una única celda | las otras tres celdas no son visuales ni seleccionables |

No existe actualmente una función `isPathClear` canónica. Su responsabilidad está distribuida entre `validateMovePath`, `chargeResolver`, `movementCommands`, `roomState` y previews React. El sprint consolidará esas decisiones sobre primitivas compartidas en vez de añadir otro helper ambiguo.

## 3. Invariantes del diseño

1. `position` continúa siendo la coordenada ancla superior izquierda: mínimo `x`, mínimo `y` y el `zFeet` del combatiente.
2. La huella es siempre derivada; nunca se persiste ni se acepta desde el cliente.
3. `SizeRulesCatalog.spaceFeet` es la única fuente del espacio corporal.
4. Todas las celdas ocupadas comparten el mismo `zFeet` en V1.
5. El servidor recalcula legalidad con el snapshot autoritativo. La UI solo proyecta el mismo helper.
6. Ningún combatiente puede quedar parcialmente fuera del tablero.
7. Las APIs de alto nivel (`threatensTarget`, `isFlanking`, resolvers y comandos) conservan sus firmas públicas.

## 4. Modelo derivado de footprint

### 4.1 API canónica

La API pública requerida será:

```ts
getCombatantOccupiedCells(combatant, snapshot): Position[]
```

La cantidad de celdas por lado se deriva mediante:

```text
cellsPerSide = max(1, ceil(SizeRulesCatalog[size].spaceFeet / board.cellSizeFeet))
```

En el tablero actual de 5 ft:

| Tamaño | Espacio | Huella derivada |
|---|---:|---:|
| Fine–Medium | ≤ 5 ft | 1×1 |
| Large | 10 ft | 2×2 |
| Huge | 15 ft | 3×3 |
| Gargantuan | 20 ft | 4×4 |
| Colossal | 30 ft | 6×6 |

Para Large con ancla `(x,y)`, el orden determinista será `(x,y)`, `(x+1,y)`, `(x,y+1)`, `(x+1,y+1)`.

La evaluación de destinos necesita la misma derivación para un ancla candidata sin mutar al combatiente. Se diseñará una primitiva interna `getOccupiedCellsAtAnchor(snapshot, combatant, anchor)`; la API pública delegará en ella usando `combatant.position`. No habrá dos algoritmos de footprint.

`getFootprintCells` será sustituida, sus consumidores migrados y la exportación anterior retirada en el mismo cambio. Mantener un alias indefinido dejaría dos nombres para la misma regla y violaría Zero Orphan.

### 4.2 Índice efímero de ocupación

Las validaciones que consultan varias celdas construirán una proyección efímera:

```text
Map<"x,y,z", combatantId>
```

Se genera una vez por validación desde las huellas de los combatientes relevantes. No se incorpora a `CombatRoom`, no se serializa y no requiere migración. Las búsquedas posteriores son O(1) por celda.

## 5. Reglas geométricas

### 5.1 Distancia mínima y amenaza

`distanceBetweenFootprintsFeet` continuará siendo la frontera única. Para V1 puede comparar las celdas de ambos arrays; el resultado será el mínimo de `distanceFeet` entre cualquier par.

`threatensTarget` conservará su flujo actual:

1. validar facción, vida y traits;
2. obtener las huellas derivadas;
3. calcular la distancia mínima;
4. comprobar el intervalo `minReachFeet < distancia <= maxReachFeet` de cada fuente.

No se sumará el tamaño nuevamente al alcance. El espacio corporal determina desde dónde se mide y `ThreatProfile` determina cuánto se extiende la amenaza; mezclar ambos produciría doble conteo.

Para footprints rectangulares futuros, la distancia mínima puede optimizarse mediante separación entre bounding boxes en O(1) sin cambiar la API. Los tests compararán esa optimización contra el resultado exhaustivo de celdas.

### 5.2 Flanqueo sobre caras opuestas

`isFlanking` seguirá buscando un aliado que también amenace. Solo cambia `areOppositeForFlanking`.

El footprint del defensor se proyecta como un rectángulo inclusivo `[minX,maxX] × [minY,maxY]`. Para cada celda ocupada por el atacante se obtiene una firma de cara:

```text
dx = -1 si está al oeste, +1 si está al este, 0 si su x cae dentro del ancho
dy = -1 si está al norte, +1 si está al sur, 0 si su y cae dentro del alto
```

Atacante y aliado son opuestos cuando existe un par de sus celdas con firmas inversas en ambos ejes y al menos un eje no es cero. Esto conserva exactamente la fórmula `Math.sign` para 1×1, pero la aplica contra las caras del rectángulo y no contra una esquina arbitraria.

Ejemplos válidos para un defensor Large:

- norte `(0,-1)` frente a sur `(0,+1)`;
- oeste `(-1,0)` frente a este `(+1,0)`;
- noreste `(+1,-1)` frente a suroeste `(-1,+1)`.

Dos aliados situados frente a la misma cara no flanquean. Una celda que se solape con el defensor tampoco puede producir una firma válida; la ocupación legal impide ese estado.

### 5.3 Colisión y movimiento

Cada paso de una ruta sigue representando el movimiento del ancla en una casilla. Antes de aceptar el paso se deriva la huella completa en el ancla candidata.

La validación se divide en tres primitivas puras:

1. `isFootprintInsideBoard`: todas las celdas deben estar dentro de límites.
2. `getFootprintBlockers`: devuelve muros y combatientes intersectados mediante el índice efímero.
3. `validateFootprintTransition`: aplica las políticas existentes de facción, estado vital, destino final, Acrobacias y esquina diagonal.

Política V1:

- cualquier celda contra `impassableCells` bloquea;
- cualquier celda fuera del tablero bloquea;
- un enemigo consciente bloquea el tránsito salvo la rama autoritativa de Acrobacias ya existente;
- el destino final no puede solaparse con un combatiente consciente;
- se preserva la política histórica para aliados y criaturas indefensas, pero se evalúa sobre todas las celdas intersectadas;
- las celdas muertas no se convierten silenciosamente en obstáculos nuevos.

En un paso diagonal se validan también los dos desplazamientos ortogonales intermedios del ancla. Si la huella no cabe por cualquiera de los dos corredores, se rechaza el corte de esquina. Esto generaliza el chequeo actual de dos celdas a los bordes completos del footprint.

El coste de movimiento continúa calculándose desde la sucesión de anclas; una criatura Large no paga cuatro veces por trasladar cuatro celdas.

### 5.4 Colocación, carga y AdO

- `placeCombatantInFreeCell`, `ensureUniqueCombatantPositions` y `findNearestFreeCell` buscarán anclas cuyo footprint completo sea legal y no se solape.
- El movimiento GM y la preparación usarán la misma validación de destino que el movimiento normal, sin duplicar geometría.
- `chargeResolver` reutilizará distancia entre footprints y validación de cada footprint candidato; eliminará sus comparadores locales de ancla.
- `movementCommands` consultará combatientes intersectados por el footprint para las pruebas de Acrobacias.
- `findTriggeredOpportunityAttacksForPath` ya proyecta al mover en cada ancla histórica; al migrar al selector canónico, los AdO se calcularán desde todas las celdas abandonadas sin cambiar el payload de red.

### 5.5 Cobertura

`getAttackLineInterception` conserva su firma. Este sprint no implementa raycasting contra superficies completas, pero la fuente geométrica será el selector canónico de huellas. Una evolución posterior podrá probar segmentos contra los rectángulos derivados sin cambiar `AttackContext`, `totalArmorClass` ni los command handlers.

## 6. Simetría visual en React

`Board.tsx` dejará de renderizar el token dentro de la celda ancla. El tablero tendrá dos capas lógicas dentro del mismo CSS Grid:

1. botones de celda, responsables de interacción y highlights;
2. un token por combatiente, situado con `grid-column`/`grid-row` y `span` derivados de su footprint.

Un Large usa `span 2` en ambos ejes; Huge y superiores usarán el mismo cálculo. El token no captura eventos de puntero: cada botón de celda continúa siendo accesible.

Antes de renderizar, `Board` construirá un mapa celda→combatiente usando `getCombatantOccupiedCells`. Hacer click en cualquiera de las cuatro celdas de un Large seleccionará el mismo combatiente, mientras el token se dibuja una sola vez.

`viewModel.ts` reutilizará las mismas primitivas para:

- destinos de movimiento y reposicionamiento GM;
- previews de amenaza y alcance;
- carga;
- detección de celdas ocupadas.

El frontend no mantendrá una tabla propia `large = 2`. El tamaño visual y la legalidad derivan del snapshot compartido.

## 7. Frontera de red y persistencia

- `ClientCommand` continúa enviando posiciones ancla y rutas de anclas.
- `ServerMessage` continúa enviando combatientes con `position` y `sizeCategory`.
- No cambia la versión de `StoredProfile`; `sizeCategory` ya es obligatorio en V3.
- No se guardan arrays de footprint en perfiles, snapshots ni salas.
- El servidor rechaza anclas cuyo footprint no sea legal, incluso si un cliente modificado intenta enviarlas.

## 8. Design Review Checklist

### 8.1 Filtro de irreversibilidad a 20 sprints

La decisión difícil de revertir sería persistir cuatro coordenadas para Large o codificar `large ? 2 : 1` en cada consumidor. El diseño guarda solo ancla y tamaño, y deriva el lado desde `spaceFeet / cellSizeFeet`. Huge 3×3, Gargantuan 4×4 y Colossal 6×6 atraviesan el mismo selector, índice, distancia y clasificación de caras.

Flanqueo y cobertura conservan APIs de alto nivel. Flanqueo consume rectángulos derivados; cobertura mantiene `getAttackLineInterception` como adaptador estable. Extender la intersección de segmentos no modifica resolvers, CA contextual ni contratos WebSocket.

### 8.2 Complejidad accidental

El coste no se controla dispersando comparaciones de arrays. Una huella se deriva en O(F), donde F está acotado por el tamaño corporal (Large=4, Colossal=36). Para una validación completa se construye una sola vez un índice de ocupación en O(N·F); cada consulta de pared, límite u ocupante cuesta O(1) por celda candidata. Una ruta de P pasos cuesta O(N·F + P·F), no O(P·N·F²).

Las distancias entre dos footprints pequeños pueden usar comparación exhaustiva y migrar a bounding boxes O(1) detrás de la misma función. No se recorrerá el tablero completo para resolver alcance o flanqueo.

### 8.3 Matriz de reutilización

| Capa | Reutilización |
|---|---|
| ActiveEffects | no modela anatomía; `NO_THREAT`, estados y Squeezing siguen filtrando capacidades sin alterar footprint base |
| Pure helpers | reutiliza `SizeRulesCatalog`, `distanceFeet`, `threatensTarget`, `isFlanking`, `validateMovePath` y adaptadores de geometría |
| Resolvers | ataques, AdO, Derribo y conjuros reciben distancias/contextos ya calculados; no incorporan lógica de celdas |

### 8.4 Regla de tres

1. **Bull Rush/Embestida:** desplazar una masa grande validando todas las celdas barridas y el destino.
2. **Improved Trip, Grapple y estabilidad:** combinar modificadores de tamaño ya catalogados con contacto real entre footprints.
3. **Squeezing:** determinar si una criatura Large atraviesa un corredor menor que su espacio normal y qué celdas ocupa mientras se comprime.

También habilita áreas, auras, cobertura por cuerpos grandes y flanqueo contra Huge sin una nueva representación espacial.

### 8.5 Matriz de impacto

| Subsistema | Impacto previsto |
|---|---|
| Rule Engine | alto: selector canónico, distancia, caras, colisión y transición |
| CombatRoom / schema | sin campos nuevos; se formaliza la semántica del ancla |
| WebSocket | sin cambios de payload |
| Servidor | colocación, movimiento, Acrobacias, carga y GM consumen footprint |
| UI | Board multiposición, selección por cualquier celda y previews compartidos |
| Tests | nueva suite pura, regresión 1×1, E2E WebSocket y escenario visual |

## 9. Estrategia de pruebas para la implementación

### 9.1 Unitarias

- Medium devuelve una celda y Large exactamente cuatro en orden estable.
- Huge devuelve 3×3 como prueba de irreversibilidad, aunque el producto V1 solo habilite Large visualmente.
- una Large cabe con ancla `width-2,height-2` y falla en `width-1` o `height-1`;
- colisión en cualquiera de las cuatro celdas bloquea muro, enemigo o destino consciente;
- alcance usa el par de celdas más cercano y no el ancla;
- flanqueo N/S, E/O y esquinas opuestas funciona sobre defensor 2×2;
- dos atacantes en la misma cara o caras adyacentes no flanquean;
- movimiento diagonal no corta una esquina con el borde delantero;
- Medium 1×1 conserva todos los resultados existentes.

### 9.2 Integración y E2E

- un perfil Large entra en una sala sin solapar footprints existentes;
- movimiento y reposicionamiento GM rechazan un solapamiento parcial;
- carga y AdO usan la huella completa;
- el room-update conserva únicamente ancla y `sizeCategory`;
- hacer click en cualquiera de las cuatro celdas selecciona el mismo token Large;
- el token visual ocupa exactamente dos columnas y dos filas.

Validación DoD futura: `npm test`, `npm run typecheck`, `npm run build`, E2E WebSocket y escenario Playwright del Board.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| doble conteo entre espacio y alcance | footprint fija origen de medición; `ThreatProfile` fija extensión |
| divergencia servidor/UI | ambas capas consumen el selector shared; servidor siempre recalcula |
| spawns inválidos antes del combate | roomState valida footprint completo y busca anclas legales |
| click solo sobre ancla | mapa celda→combatiente y token visual separado de botones |
| regresiones 1×1 | pruebas de equivalencia para Medium en movimiento, amenaza, flanqueo y carga |
| coste repetido | índice efímero por evaluación y bounding boxes detrás de APIs estables |

## 11. Fuera de alcance

- footprints no cuadrados, rotación o criaturas largas;
- elevación volumétrica y colisiones entre distintos `zFeet`;
- reglas completas de Squeezing para cambiar temporalmente la huella;
- Bull Rush, Grapple o desplazamiento forzado;
- raycasting preciso de cobertura contra todas las caras;
- áreas de conjuros y auras multicelda;
- mounted combat y espacios compartidos voluntariamente.

V1 asume footprints cuadrados, alineados al grid y derivados de tamaños SRD. Esa restricción está encapsulada en el selector; no se copia a resolvers ni contratos.

## 12. Criterios de aceptación del diseño

- Existe una sola fuente de footprint y no persiste derivados.
- Large ocupa las cuatro celdas reglamentarias en reglas y UI.
- Alcance, amenaza y flanqueo dejan de depender del ancla 1×1.
- Movimiento, spawn, carga y GM rechazan cualquier intersección ilegal.
- Medium conserva comportamiento previo.
- No cambia el contrato WebSocket ni StoredProfile V3.
- La implementación no comienza sin `Proceed`.
