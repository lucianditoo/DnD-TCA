# Walkthrough — Sprint 052B.1 (Corrección geométrica de Line of Effect)

## Objetivo

Corregir exclusivamente la geometría de `getLineOfEffect` (Sprint 052B). La
arquitectura de Sprint 052B se conserva intacta: `impassableCells` sigue
siendo independiente de movimiento, `lineOfEffectBlockingCells` sigue siendo
la fuente de Line of Effect, Cover sigue limitado a criaturas, Target
Legality sigue evaluándose antes del Attack Resolver, y
`LineOfEffectAssessment` sigue siendo un contrato independiente. Ninguna de
esas decisiones se reabrió.

## El bug confirmado

La implementación original (Sprint 052B) modelaba cada celda de
`lineOfEffectBlockingCells` como un único **punto** — su ancla entera
`(x, y)` — y probaba si ese punto era exactamente colineal con el segmento
centro-a-centro entre la celda de origen y la de destino (producto cruzado
== 0, producto punto estrictamente entre 0 y la longitud al cuadrado). Esto
bloqueaba correctamente una línea que pasara **exactamente** por ese punto,
pero fallaba para cualquier línea que atravesara el **área** de esa celda sin
pasar por su ancla — por ejemplo, `(0,0)→(3,1)` con un bloqueador en `(2,0)`
no se detectaba como bloqueado, pese a que la línea sí cruza esa celda. El
síntoma más visible de este bug en el propio código de Sprint 052B era un
test con un fixture `(15,21)` obtenido por búsqueda numérica de mínimo común
múltiplo — necesario únicamente para forzar que las 4 esquinas de un
footprint Large compartieran un punto lattice exacto con el objetivo, algo
que no representa ninguna escala de juego real.

## Auditoría geométrica (Fase 1)

- **Representación de celdas en el repositorio**: cada combatiente ocupa
  celdas discretas por índice entero `(x, y)` (`getCombatantOccupiedCells`,
  `getNaturalCombatantOccupiedCellsAt`). No existe en ningún punto del código
  una convención de "centro" con offset (`+0.5`); el resto del motor
  (movimiento, distancia, Cover) trata directamente el índice entero como
  coordenada para su propia aritmética de grilla. Sin embargo, campos como
  `impassableCells`/`difficultTerrainCells`/`lineOfEffectBlockingCells`
  representan inequívocamente **áreas** (una celda completa, no un punto)
  cuando se usan como obstrucción de movimiento o terreno.
- **Conclusión de la auditoría**: el origen y destino de cada trazado se
  mantienen en el mismo índice de celda ya usado en todo el motor (consistente
  con Cover y con la arquitectura ya cerrada de Sprint 052B — no se inventó
  una nueva convención de "centro elegida por conveniencia" para los
  extremos). Lo que debía corregirse es exclusivamente cómo participa una
  celda **bloqueadora** en la prueba: como área, no como punto.
- **Criterio SRD**: el método canónico 3.5 (elegir una esquina del espacio
  del atacante, trazar líneas a las 4 esquinas del espacio del objetivo;
  Cobertura Total si todas están bloqueadas) es más fino que la aproximación
  centro-a-centro de una sola línea por par de celdas que ya usaba Cover
  desde Sprint 013/042. Reabrir esa aproximación para Cover está fuera de
  alcance de este sprint (no se reabre esa decisión). Para `getLineOfEffect`
  específicamente, se adoptó un algoritmo de **recorrido de celdas** ("línea
  supercover", estándar en líneas de visión de grillas tácticas) que
  determina qué celdas atraviesa realmente el segmento centro-a-centro entre
  cada par de celdas ocupadas — evitando tanto el bug de "punto exacto" como
  la complejidad combinatoria de un modelo de 4 esquinas por celda.

## Geometría correcta (Fase 2): recorrido "supercover"

Nueva función local `traversedCellKeysBetween` en `rules.ts`. Modela cada
celda como su área unitaria `[x,x+1)×[y,y+1)` y camina desde la celda de
origen hasta la de destino avanzando, en cada paso, el eje que va "atrasado"
respecto al otro — comparación por multiplicación cruzada
`(2·ix+1)·ny` vs `(2·iy+1)·nx`, aritmética enteramente entera, sin coma
flotante ni división. Cuando el segmento cruza exactamente un vértice
compartido por 4 celdas (diagonal exacta — "línea por vértice"), el
algoritmo incluye conservadoramente ambas celdas vecinas de esa esquina
además de la celda de destino de ese paso: una diagonal no puede "colarse"
entre dos bloqueadores que solo se tocan en la esquina.

**Política de bordes explícita**: un tramo recto (horizontal/vertical)
atraviesa el área completa de cada celda de su fila/columna — nunca "roza"
un borde sin entrar, porque el centro de cada celda intermedia está siempre
estrictamente dentro de su propia área ("línea por borde": el paso ordinario
de un solo eje, avance por una arista compartida). Una diagonal exacta que
pasa por un vértice compartido se resuelve incluyendo ambas celdas vecinas
("línea por vértice", ver arriba). Es una función pura, determinista,
independiente de Cover, sin lógica por ID de efecto ni raycasting visual.

`getLineOfEffect` usa este recorrido para cada par (celda ocupada de origen,
celda ocupada de destino), excluyendo siempre las celdas propias de ambos
combatientes de la lista de bloqueadores (tu propia casilla nunca bloquea tu
propia línea de efecto, sin importar de qué par se trate).

## Footprints (Fase 3): criterio sin cambios, geometría interna corregida

El criterio aprobado en Sprint 052B se mantiene intacto: existe Line of
Effect si **al menos un** par de celdas ocupadas (una del atacante, una del
objetivo) tiene un recorrido sin bloqueadores; hay Cobertura Total solo si
**todos** los pares posibles están bloqueados. Lo único que cambió es que
cada "recorrido" ahora es el conjunto real de celdas atravesadas (supercover),
no una prueba de colinealidad de un único punto. Esto tiene una consecuencia
práctica importante: escenarios de footprint Large que antes requerían
coordenadas artificiales (el fixture `(15,21)`) para lograr "todos los pares
bloqueados" ahora se logran con bloqueadores adyacentes a distancias
normales de juego (ej. origen Large en `(0,0)`, objetivo en `(5,0)`,
bloqueadores en `(2,0)`/`(2,1)`).

## Tests

`tests/line-of-effect.test.mjs` reescrito por completo (17 → 29 casos), todos
verificados ejecutando la implementación real (se usó un script de sondeo
temporal, descartado antes de este commit, para confirmar cada fixture en vez
de derivarlo a mano — la causa raíz de este sprint fue precisamente un test
anterior derivado a mano de forma incorrecta):

- Matriz obligatoria de 4 pendientes no triviales — `(0,0)→(2,1)`,
  `(0,0)→(3,1)`, `(0,0)→(3,2)`, `(1,1)→(4,3)` — cada una con "celda realmente
  atravesada bloquea" y "celda cercana pero no atravesada no bloquea".
- Política de bordes explícita: un caso de cruce ordinario ("por borde") y
  tres casos de cruce diagonal exacto ("por vértice": el vértice mismo y sus
  dos celdas vecinas conservadoramente incluidas), más un caso de celda
  fuera de cualquier vértice del cruce que no bloquea.
- Horizontal, vertical y diagonal 45° como orientaciones básicas.
- Adyacencia (celdas propias listadas como bloqueadoras nunca bloquean),
  claves inválidas/mal formadas, claves duplicadas, independencia de
  `impassableCells`/`lineOfEffectBlockingCells` en ambos sentidos, y
  transporte del campo por `createCombatRulesSnapshot`.
- Footprints: 1×1 (baseline), origen Large, objetivo Large, ambos Large —
  cada uno con "al menos un par despejado" y "todos los pares bloqueados".

`tests/line-of-effect-server.test.mjs`, `tests/cover-reach.test.mjs` y
`tests/flanking.test.mjs` no requirieron cambios: la corrección es interna a
`getLineOfEffect` y no altera el contrato `LineOfEffectAssessment`, el camino
de servidor, ni Cover.

## Regresión funcional confirmada

- Cobertura Total sigue rechazando antes de cualquier tirada/consumo/mutación
  (`tests/line-of-effect-server.test.mjs`, con `diceRoller` que lanza si se
  invoca).
- No se consume munición, no se muta HP, no queda amenaza de crítico
  pendiente en el rechazo.
- `impassableCells` sigue sin bloquear Line of Effect;
  `lineOfEffectBlockingCells` sigue sin conceder Cover +4; una criatura
  interpuesta sigue dando exactamente +4 CA (`tests/cover-reach.test.mjs`).

## Documentación sincronizada

`docs/designs/vision-and-line-of-effect-architecture.md` §1.3.1 corregido
(describe el algoritmo real, no la colinealidad de punto ya retirada) y §8
pregunta 6 actualizada. `docs/designs/terrain-cover-line-of-effect-decision.md`
recibe una adenda breve aclarando que esta corrección es puramente geométrica
y no reabre la decisión de semántica de campos. `docs/rules/registry.md`:
`DEFENSE-LINE-OF-EFFECT` mantiene su alcance declarado (**Parcial**, sin
cambios), solo se actualiza la columna de Sprint/implementación. Sin cambios
en `docs/technical-debt.md` (no apareció deuda nueva).

## Validación (DoD completo, ejecutado de verdad)

| Comando | Resultado |
|---|---|
| `npm test` | ✅ **510/510**, 0 fallos (56 archivos) |
| `npm run typecheck` | ✅ 0 errores (3 workspaces) |
| `npm run build` | ✅ los 3 workspaces en verde |
| `node scripts/e2e-websocket.mjs` | ✅ **99/99** aserciones, exit 0 (sin cambios) |
| `npm run test:ui` (Playwright) | ✅ **7/7** escenarios (sin cambios) |

## Alcance explícitamente excluido (sin cambios)

Todo lo ya excluido en Sprint 052B (conjuros/AoE, amenaza de AdO, Coup de
Grace, Visión/Línea de Visión, altura/`zFeet`, editor de tablero). Además,
específico de este sprint: no se adoptó el modelo completo de 4-esquinas-por-
celda del SRD (se mantuvo el recorrido centro-a-centro por par de celdas, ya
establecido); no se tocó la geometría de Cover (`getAttackLineInterception`
sigue usando su propia prueba de colinealidad de un único punto, sin cambios,
por decisión explícita de no reabrir esa arquitectura).

## Estado y próximo paso

Sprint 052B.1 cerrado formalmente. `DEFENSE-LINE-OF-EFFECT` sigue **Parcial**
con el mismo alcance declarado en Sprint 052B — este sprint fue una
corrección de bug, no una ampliación de alcance.
