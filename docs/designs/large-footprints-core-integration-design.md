# Sprint 027 — Large Footprints Core Integration & Caras Opuestas

**Estado:** ✅ Implementado y validado (283/283 tests, 87/87 E2E WebSocket y 3/3 Playwright).

## 1. Objetivo

Consolidar la geometría multiposición del motor alrededor de una única representación derivada de huella, de forma que alcance, amenaza, flanqueo, movimiento, Ataques de Oportunidad y tablero React interpreten igual a una criatura Large 2×2 y escalen sin bifurcaciones a tamaños superiores.

Sprint 027 no introduce una segunda implementación de Large Footprints. El mapeo del repositorio confirma que Sprint 025-A ya entregó el núcleo funcional; este sprint formaliza su integración, elimina trabajo geométrico repetido, fija las fronteras públicas y amplía la red de regresión.

## 2. Mapeo obligatorio del estado actual

### 2.1 Reglas compartidas verificadas

`packages/shared/src/rules.ts` ya contiene:

- `getCombatantOccupiedCells`, que deriva un cuadrado desde `SizeRulesCatalog.spaceFeet`, `board.cellSizeFeet` y la coordenada ancla superior izquierda;
- una primitiva interna para proyectar la misma huella en un ancla candidata sin mutar el combatiente;
- `distanceBetweenFootprintsFeet`, que compara todas las celdas y devuelve la distancia mínima;
- `threatensCell` y `threatensTarget`, que consideran la huella completa;
- flanqueo contra las caras del rectángulo defensor mediante firmas `dx/dy`;
- `validateMovePath`, que valida límites, muros, terreno, ocupantes y esquinas sobre cada celda de la huella candidata;
- `findTriggeredOpportunityAttacksForPath`, que compara huella de origen y destino y conserva las celdas concretas que provocaron el AdO.

Por tanto, la deuda real no es ausencia de soporte Large, sino dispersión de proyecciones y coste repetido: algunos helpers vuelven a derivar celdas o límites dentro de bucles, y las consultas de ocupación recalculan huellas de todos los combatientes para distintos pasos.

### 2.2 Board React verificado

`apps/web/src/components/Board/Board.tsx` ya:

- obtiene las celdas mediante el helper shared;
- construye un mapa celda→combatiente, por lo que cualquiera de las cuatro celdas selecciona el mismo Large;
- deriva filas y columnas del footprint y usa `span` de CSS Grid sin codificar `large ? 2 : 1`;
- mantiene el token visual con `pointer-events: none`, dejando la interacción en los botones de celda y preservando overlays y accesibilidad.

Sprint 027 conservará esta solución genérica. No se añadirá una tabla de tamaños propia en React.

### 2.3 Cobertura de regresión existente

`tests/large-footprints.test.mjs` ya cubre la derivación Large 2×2, la extensibilidad Huge 3×3, colisión parcial, flanqueo por caras y trazas de AdO. La implementación de Sprint 027 deberá preservar esos resultados y ampliar casos límite, no sustituirlos por fixtures menos exigentes.

## 3. Invariantes

1. `combatant.position` es el ancla superior izquierda y la única posición persistida.
2. La huella se deriva siempre de `sizeCategory`, `SizeRulesCatalog.spaceFeet` y `board.cellSizeFeet`.
3. No se persisten `footprint`, `widthCells`, `heightCells`, límites ni índices de ocupación.
4. `getCombatantOccupiedCells` es la única API pública de ocupación corporal.
5. El orden de celdas es determinista: filas de arriba abajo y, dentro de cada fila, columnas de izquierda a derecha.
6. El servidor recalcula legalidad y provocaciones desde su snapshot autoritativo; el cliente solo previsualiza los mismos helpers puros.
7. Ninguna regla de dominio se ramifica por `sizeCategory === "large"`.
8. Medium 1×1 conserva exactamente su semántica actual.
9. En V1 todas las huellas son cuadrados alineados al grid y todas sus celdas comparten `zFeet`.

## 4. Arquitectura propuesta

### 4.1 Fuente canónica y proyección geométrica efímera

Se mantiene la API pública:

```ts
getCombatantOccupiedCells(combatant, snapshot): Position[]
```

Sobre su resultado se construirá, solo durante una evaluación, una proyección privada equivalente a:

```text
FootprintGeometry = {
  cells,
  minX, maxX,
  minY, maxY,
  zFeet
}
```

Esta proyección no entra en `CombatantSnapshot`, `CombatRoom`, WebSocket ni persistencia. Su propósito es derivar una sola vez los límites que hoy se recalculan dentro de bucles. La lista de celdas sigue siendo la fuente; los límites son una vista optimizada y descartable.

Para Large en `(2,2)`, con tablero de 5 ft, el selector conserva el orden:

```text
(2,2), (3,2), (2,3), (3,3)
```

La cantidad por lado continúa siendo:

```text
max(1, ceil(spaceFeet / cellSizeFeet))
```

Así, Huge 15 ft produce 3×3 y Colossal 30 ft produce 6×6 sin alterar consumidores.

### 4.2 Distancia mínima y amenaza

`distanceBetweenFootprintsFeet` permanece como frontera única para distancia entre combatientes. Para huellas rectangulares alineadas puede obtener el desplazamiento mínimo entre límites:

```text
dx = max(0, B.minX - A.maxX, A.minX - B.maxX)
dy = max(0, B.minY - A.maxY, A.minY - B.maxY)
```

El par `(dx, dy)` se convierte a pies con la misma métrica táctica que `distanceFeet`. La operación posterior a construir las geometrías es O(1) y debe demostrar equivalencia con el mínimo exhaustivo actual mediante tests.

`threatensTarget` mantendrá primero sus filtros mecánicos —facción opuesta, estado vital, `NO_THREAT` y fuentes melee derivadas— y consultará después una sola distancia entre footprints. Una fuente amenaza cuando esa distancia cae dentro de su intervalo declarativo `minReachFeet < distancia <= maxReachFeet`.

No se suma `spaceFeet` al alcance: la huella ya desplaza el origen efectivo de la medición. Sumarlo otra vez duplicaría el beneficio de tamaño.

### 4.3 Flanqueo por caras opuestas

El defensor se proyecta como el rectángulo inclusivo `[minX,maxX] × [minY,maxY]`. La dirección relativa de otra huella se obtiene comparando sus límites completos contra los del defensor:

```text
dx = -1 si está completamente al oeste
dx = +1 si está completamente al este
dx =  0 si comparte el intervalo horizontal

dy = -1 si está completamente al norte
dy = +1 si está completamente al sur
dy =  0 si comparte el intervalo vertical
```

Atacante y aliado ocupan caras o esquinas opuestas si y solo si:

```text
dxA === -dxB && dyA === -dyB
```

y al menos un eje es distinto de cero. Esta formulación conserva `Math.sign` para 1×1, pero elimina cualquier dependencia de la esquina ancla del objetivo.

`isFlanking` no será recursiva:

1. comprueba que el atacante amenaza;
2. calcula una vez las geometrías del atacante y el objetivo;
3. recorre linealmente aliados de la misma facción;
4. exige que cada candidato amenace;
5. compara sus firmas de cara.

Norte/sur, este/oeste y esquinas verdaderamente opuestas son válidos. La misma cara, caras adyacentes o solapamiento no conceden flanqueo.

### 4.4 Índice efímero de ocupación

Las validaciones espaciales de una misma operación construirán una proyección local:

```text
Map<"x,y,z", combatantId[]>
```

Se genera una vez desde el snapshot y se descarta al terminar. Esto permite consultar en O(1) cada celda candidata sin recorrer nuevamente todos los combatientes y todas sus huellas por cada paso.

No es un cache de dominio: no se serializa, no sobrevive a la evaluación y nunca puede quedar obsoleto entre comandos.

### 4.5 Movimiento y colisión integral

Cada elemento de `path` continúa representando un ancla candidata. En cada tramo:

1. se deriva la huella completa en el ancla;
2. se comprueba que todas sus celdas estén dentro del tablero;
3. se rechaza si una sola celda intersecta `impassableCells`;
4. se consulta el índice de ocupación para detectar intersecciones;
5. se aplica la política ya existente para enemigos conscientes, aliados, criaturas indefensas, Acrobacias y destino final;
6. en diagonal se validan los dos corredores ortogonales sobre la huella completa para impedir cortes de esquina.

El coste se calcula por desplazamiento del ancla. Una criatura 2×2 no paga cuatro veces el movimiento de un único paso.

### 4.6 Ataques de Oportunidad multiposición

Para cada tramo se calculan:

```text
abandonedCells = originFootprint - destinationFootprint
```

Cada reactor elegible evalúa solo esas celdas con `threatensCell`. El resultado conserva `provokingCells` en orden determinista para auditoría, log y UI. Se mantiene una sola reacción por reactor para el mismo movimiento, aunque varias celdas corporales abandonadas hayan sido amenazadas.

La habitación no entra en un estado espacial intermedio: la ruta se analiza contra la posición inicial y el snapshot autoritativo; la mutación de posición ocurre según el pipeline transaccional ya existente.

### 4.7 React multiposición

`Board.tsx` seguirá separado en dos responsabilidades:

- los botones de celda resuelven selección, click y overlays mediante el mapa celda→combatiente;
- un único token visual por combatiente ocupa el rectángulo derivado con `grid-column-end: span N` y `grid-row-end: span N`.

La implementación debe auditar y reforzar, no reemplazar, el comportamiento actual:

- las cuatro celdas de un Large seleccionan el mismo ID;
- las clases de selección, objetivo y estado cubren visualmente el token completo;
- movimiento, amenaza y rutas se pintan por celdas usando helpers shared;
- Huge usa el mismo render de `span 3` como prueba de elasticidad;
- no existe lógica táctica duplicada en React.

## 5. Fronteras de capas

| Capa | Responsabilidad | Cambio de contrato |
|---|---|---|
| `SizeRulesCatalog` | fuente de `spaceFeet` por tamaño | ninguno |
| Rule Engine shared | celdas, límites, distancia, caras, colisión y provocación | se conservan firmas públicas |
| `CombatSnapshot` | ancla, tamaño, tablero y estado autoritativo | ningún campo nuevo |
| ActiveEffects | vida, capacidad de amenaza y excepciones mecánicas | ninguno |
| Servidor | validar y mutar usando helpers shared | sin nuevo comando |
| WebSocket | transportar ancla y `sizeCategory` existentes | ningún payload nuevo |
| React | render y preview desde las mismas celdas derivadas | sin modelo paralelo |
| Persistencia | guardar fuentes, nunca geometría derivada | sin migración |

EquipmentCatalog no determina espacio corporal. Solo continúa aportando alcance de armas y fuentes de amenaza, que se cruzan con la distancia entre huellas.

Ownership tampoco cambia: seleccionar cualquiera de las celdas resuelve el mismo `combatantId`, y el servidor conserva las verificaciones de control actuales.

## 6. Alternativas consideradas

### 6.1 Persistir las cuatro celdas del Large

Rechazada. Duplicaría `position + sizeCategory`, requeriría migración y permitiría snapshots incoherentes.

### 6.2 Codificar ramas exclusivas para Large

Rechazada. Resolvería 2×2 pero obligaría a reescribir Huge y Colossal, además de duplicar la tabla de tamaños en reglas y UI.

### 6.3 Mantener comparaciones exhaustivas en todos los consumidores

Funcional, pero no elegida como diseño final. Las huellas actuales son pequeñas, aunque repetir `Math.min`, arrays e intersecciones dentro de rutas y aliados genera complejidad accidental. Se conserva una comparación exhaustiva como oráculo de tests, mientras producción usa límites e índices efímeros.

### 6.4 Incorporar un motor de física o pathfinding nuevo

Rechazada para este sprint. La topología es un grid determinista; introducir otra abstracción fragmentaría los command handlers y excedería el alcance.

## 7. Design Review Checklist

### 7.1 Filtro de irreversibilidad a 20 sprints

La huella elástica se estructura como un array derivado de posiciones cuya escala procede exclusivamente de `spaceFeet / cellSizeFeet`. Todos los algoritmos consumen ese array o una proyección efímera de sus límites; ninguno pregunta si el tamaño es Large.

Por ello, Huge 3×3 y Colossal 6×6 atraviesan el mismo pipeline de distancia, amenaza, caras, movimiento, AdO y CSS Grid. Flanqueo y cobertura reciben geometría, no dimensiones codificadas. Si en el futuro aparecen footprints no cuadrados o `Squeezing`, el cambio se encapsula en el selector de celdas; las APIs de alto nivel permanecen estables.

### 7.2 Complejidad accidental

No se escanea el tablero completo. Una huella se deriva en O(F), sus límites en O(F) y distancia/oposición entre rectángulos se resuelve después en O(1). Una evaluación de movimiento construye el índice de ocupación en O(N·F) una sola vez y valida una ruta de P pasos en O(P·F), con consultas O(1) por celda.

Para Large `F=4` y para Colossal `F=36`, valores acotados. Los helpers reciben proyecciones ya calculadas dentro de la operación para evitar recomputaciones anidadas. No existen ciclos entre `threatensTarget` e `isFlanking`: amenaza es una hoja pura; flanqueo la consume linealmente.

### 7.3 Regla de tres

1. **Embestida/Bull Rush:** podrá empujar un cuerpo grande validando el volumen barrido y el footprint final.
2. **Derribo Mejorado y pruebas anatómicas:** tamaño, contacto real y caras corporales podrán alimentar las maniobras sin aproximar al objetivo como un punto.
3. **Squeezing:** podrá sustituir temporalmente la forma de celdas derivadas para atravesar corredores de 5 ft sin alterar movimiento, amenaza ni Board.

La misma base habilita además auras, áreas, cobertura contra cuerpos grandes y AdO de armas de asta.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| duplicar lo ya entregado en Sprint 025-A | inventario explícito de baseline y cambios limitados a consolidación, optimización y regresión |
| divergencia entre mínimo exhaustivo y límites | tests de equivalencia para 1×1, 2×2, 3×3, diagonales y distintas escalas de celda |
| doble conteo de tamaño y alcance | medir desde huellas y aplicar después el intervalo del arma/ataque natural |
| falso flanqueo por ancla o esquina | dirección relativa calculada con límites completos del defensor y de ambos aliados |
| índice de ocupación obsoleto | índice local por evaluación; nunca persistido ni reutilizado tras una mutación |
| click bloqueado por token visual | botones de celda autoritativos y token con `pointer-events: none` |
| regresiones Medium | matriz de equivalencia 1×1 para movimiento, amenaza, flanqueo, carga y AdO |

## 9. Estrategia de pruebas proyectada

### 9.1 Reglas puras

- Large en `(2,2)` devuelve exactamente cuatro celdas en orden estable.
- Huge produce 3×3 y Colossal 6×6 usando la misma función.
- la distancia optimizada coincide con el mínimo exhaustivo para Medium–Large, Large–Large y Large–Huge;
- amenaza usa el par más cercano y respeta `minReachFeet`/`maxReachFeet`;
- N/S, E/O y esquinas opuestas flanquean a un 2×2;
- misma cara, cara adyacente y oposición basada solo en anclas no flanquean;
- una sola celda fuera del mapa o sobre muro invalida toda la ruta;
- una sola celda intersectando un enemigo consciente bloquea el paso;
- un paso diagonal no corta una esquina con el borde delantero del footprint;
- `provokingCells` identifica exactamente las celdas abandonadas y amenazadas;
- un reactor obtiene como máximo una oportunidad por movimiento.

### 9.2 Integración y UI

- carga, movimiento normal, movimiento acrobático y reposicionamiento GM consumen la misma huella;
- un `room-update` conserva solo ancla y tamaño, sin datos derivados;
- cada una de las cuatro celdas de un Large selecciona el mismo combatiente;
- el token ocupa 2×2 y un Huge de prueba ocupa 3×3 sin ramas nuevas;
- overlays de ruta, amenaza, selección y objetivo permanecen simétricos.

### 9.3 Validación de Fase 6

Tras `Proceed` y la implementación:

1. `npm test`
2. `npm run typecheck`
3. `npm run build`
4. `node scripts/e2e-websocket.mjs`
5. `npm run test:ui`

Los conteos se documentarán únicamente con resultados reales.

## 10. Fuera de alcance

- footprints no cuadrados, rotados o volumétricos;
- reglas completas de `Squeezing`;
- desplazamiento forzado, Bull Rush o Grapple;
- elevación y colisiones 3D;
- raycasting avanzado de cobertura contra superficies multicelda;
- persistencia de índices espaciales;
- cambios de schema, comandos o payloads WebSocket.

## 11. Criterios de aceptación del diseño

- Existe una sola API pública para derivar ocupación.
- La geometría actual de Sprint 025-A se reutiliza y no se duplica.
- Distancia y flanqueo dejan de depender de anclas puntuales.
- Movimiento y AdO consideran cada celda del footprint en cada tramo.
- React no contiene tablas ni reglas de tamaño propias.
- Huge y Colossal quedan cubiertos por la misma arquitectura.
- No cambia Snapshot, persistencia, Ownership ni WebSocket.
- Ningún archivo ejecutable se modifica antes de `Proceed`.
