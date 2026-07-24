# Sprint 051 — Arquitectura de Vision & Line of Effect (Solo Diseño)

## Estado y alcance

**Estado:** diseño arquitectónico en revisión (Sprint 051.1 — correcciones
conceptuales tras primera revisión arquitectónica; todavía no aprobado para
commit). No autoriza código, tests, Rule IDs, cambios al catálogo, a
ActiveEffects, al Snapshot, al Attack Resolver ni comandos WebSocket. Sprint
052 (implementación) requiere su propio `Proceed` explícito después de
aprobar este documento.

**Precondition gate (Sprint 051.1)**: rama `master`, HEAD
`391311e7d7680cb345882b0900a20154d0bdd9a2`, sincronizado 0/0 con
`origin/master`, único archivo untracked (`docs/designs/vision-and-line-of-effect-architecture.md`,
este mismo documento) — verificado antes de aplicar cualquier corrección.

## 0. Método

Este documento se construyó en dos pasadas obligatorias:

1. **Auditoría de código real** (no de intención): `apps/server/src/combat/attackResolver.ts` completo, `packages/shared/src/rules.ts` (`getAttackLineInterception`, `getConcealmentAssessment`, `composeConcealmentAssessment`, `isCornerAnchorBlockedByTerrain`, `threatensTarget`), `packages/shared/src/types.ts` (`Board`, `CoverAssessment`, `ConcealmentAssessment`, `AttackContextModifiers`), `packages/shared/src/combatSnapshot.ts`, `packages/shared/src/effects/{catalog,contracts,manager,queries,reducer,tick}.ts`, `packages/shared/src/geometry/aoe.ts`, `packages/shared/src/creatureTypeCatalog.ts`, `docs/designs/modifier-pipeline-architecture.md`, `docs/designs/rule-and-modifier-classification.md`, `docs/designs/cover-and-dynamic-reach-design.md`, `docs/audits/combat-rules-deviations.md`.
2. **Investigación normativa SRD**, triangulada contra múltiples fuentes secundarias independientes (d20srd.org bloquea fetch directo — 403 — igual que en Sprint 049; se usó el mismo método de corroboración cruzada). Cada conclusión normativa de este documento cita su regla y, donde el modelo actual del motor no permite una generalización universal, queda acotada explícitamente en vez de afirmada como certeza (ver §11).

## 1. Auditoría del código existente (qué responsabilidad tiene hoy cada pieza)

### 1.1. Attack Resolver (`apps/server/src/combat/attackResolver.ts`)

`resolveAttack` recibe `options.concealment: ConcealmentAssessment` **ya resuelto por el caller** (línea 64, `AttackResolutionOptions`) y `options.cover?: CoverAssessment`. El resolver nunca calcula geometría: llama `resolveConcealment(attackRollHits, assessment, diceRoller)` (línea 188) que tira 1d100 **solo si `assessment.applies`** y compara contra `missChancePercent`. El resolver no conoce el tablero, `impassableCells`, posiciones de terceros ni iluminación.

Esta es la costura donde Vision entra en contacto con el flujo de ataque, pero **el resolver sigue consumiendo únicamente `ConcealmentAssessment` para resolver miss chance** — eso no cambia. Lo que sí debe quedar claro (corrección de esta revisión) es que `VisionAssessment` **no vive dentro** de `ConcealmentAssessment` como una pieza interna: es un assessment contextual independiente que, para el caso específico del flujo de ataque, **contribuye** a la construcción de `ConcealmentAssessment` antes de que el resolver la reciba. Vision también tiene consumidores propios fuera del ataque (legalidad de objetivo, futura UI de fog-of-war, futuras skills de percepción) que no pasan por Concealment en absoluto. Ver §3 (Corrección A) y el pipeline canónico en §7.

### 1.2. Threat System (`threatensTarget`, `isFlanking`, `MeleeThreatSource`)

`threatensTarget`/`isFlanking` derivan capacidad de amenaza desde vida, traits, footprints y fuentes melee (`packages/shared/src/rules.ts`). No consultan geometría de bloqueo alguna — en el modelo actual, un muro no interrumpe el amenazar/flanquear. Si Line of Effect debería interrumpir esta capacidad es una pregunta abierta (§8, pregunta 4), no una conclusión de este documento.

### 1.3. Cover (`getAttackLineInterception`, Sprint 013/042)

Documentado en `docs/designs/cover-and-dynamic-reach-design.md`. Es una función pura que detecta criaturas vivas (`active`/`disabled`) interpuestas en el segmento atacante-objetivo mediante colinealidad exacta (producto cruzado) y pertenencia al segmento (producto punto). Produce `CoverAssessment { applies, acBonus, kind, blockerIds, blockedCellKeys }`. El propio Sprint 013 declaraba **fuera de su alcance** (§10): "cobertura por muros, puertas, mobiliario o terreno del mapa" y "Cobertura Total y bloqueo efectivo de la acción".

**Corrección de esta revisión (Sprint 052A) a una afirmación falsa de la versión anterior de este documento**: aquí se afirmaba que `board.impassableCells` "no se consulta en `getAttackLineInterception`". Eso es **incorrecto**, confirmado por lectura directa del código real: `getAttackLineInterception` (`rules.ts:1699-1758`) **sí** consulta `room.board.impassableCells` (línea 1752) y produce `terrainBlockedCellKeys`; `buildCoverAssessment` (línea 1766) lo convierte en `kind: "terrain-cover"`, con exactamente el mismo efecto que `creature-cover`: **+4 CA, el ataque procede con tirada normal**. Esta extensión se introdujo en Sprint 042 (según los propios comentarios de código) ampliando silenciosamente el alcance que Sprint 013 excluía de forma explícita, sin ningún NDD dedicado que la autorice. (`getCellsIntersectedByAoE` sí sigue sin consultar ningún obstáculo — esa parte de la afirmación original era correcta y se mantiene.)

**Resuelto en Sprint 052B** (implementación real, ya no pendiente): se adoptó la
Opción A recomendada en `docs/designs/terrain-cover-line-of-effect-decision.md`
(Sprint 052A). `impassableCells` quedó restringido exclusivamente a movimiento;
`getAttackLineInterception` ya **no** consulta `impassableCells` y solo produce
`creatureBlockerIds` — `CoverKind: "terrain-cover"` y
`AttackLineInterception.terrainBlockedCellKeys` fueron retirados por completo
(no se conservaron por compatibilidad hipotética). Un nuevo campo
independiente, `Board.lineOfEffectBlockingCells`, alimenta exclusivamente
`getLineOfEffect` (ver §1.3.1 más abajo). "Total Cover" ahora **sí** existe en
el motor: ausencia de Line of Effect bloquea el intento de ataque antes de
cualquier tirada, para ataques físicos ordinarios (`DEFENSE-LINE-OF-EFFECT`,
Parcial — ver Rule Registry). `getAttackLineInterception` no se generalizó ni
se reescribió para resolver esto, tal como exigía la nota anterior de esta
sección: se corrigió en su lugar (dejó de hacer algo que nunca debió hacer) y
`getLineOfEffect` se implementó como función nueva e independiente. Ver
`walkthrough.md` (Sprint 052B) para el detalle completo de la implementación.

### 1.3.1. Line of Effect (`getLineOfEffect`, Sprint 052B, geometría corregida en Sprint 052B.1)

Función pura nueva en `rules.ts`, deliberadamente **no** una generalización de
`getAttackLineInterception`. Consulta únicamente `board.lineOfEffectBlockingCells`
— nunca `impassableCells`.

**Corrección geométrica (Sprint 052B.1)**: la versión original de Sprint 052B
modelaba cada celda bloqueadora como un único **punto** (su ancla entera) y
probaba colinealidad exacta de ese punto con el segmento centro-a-centro. Esto
fallaba para cualquier línea que atravesara el **área** de una celda
bloqueadora sin pasar exactamente por su ancla — un bug real, no solo una
laguna de tests (confirmado con casos concretos: `(0,0)→(3,1)` con bloqueador
en `(2,0)` no se detectaba, pese a que la línea sí cruza esa celda). La
implementación corregida trata cada celda como su área unitaria
`[x,x+1)×[y,y+1)` y usa un recorrido **"supercover"** (algoritmo estándar de
línea de visión en grillas, aritmética enteramente entera — sin coma
flotante): en cada paso avanza el eje que va "atrasado" respecto al otro
(comparación por multiplicación cruzada, sin dividir), y cuando el segmento
cruza exactamente un vértice compartido por 4 celdas (diagonal exacta),
incluye conservadoramente ambas celdas vecinas de esa esquina — una diagonal
no puede "colarse" entre dos bloqueadores que solo se tocan en la esquina.
Política de bordes explícita: un tramo recto (horizontal/vertical) atraviesa
el área completa de cada celda de su fila/columna (el centro de cada celda
intermedia está siempre estrictamente dentro de su área, nunca solo "roza" un
borde); una diagonal exacta que pasa por un vértice compartido se resuelve
incluyendo ambas celdas vecinas, como se describe arriba. Ver
`traversedCellKeysBetween` en `rules.ts` y `tests/line-of-effect.test.mjs`
(29 casos, incluida una matriz de 4 pendientes no triviales con verificación
empírica contra la implementación real, no derivada a mano).

Para footprints multicasilla (Large+), existe Line of
Effect si al menos un par de celdas ocupadas (una del atacante, una del
objetivo) tiene un recorrido sin bloqueadores; solo hay Cobertura
Total si todos los pares posibles están bloqueados — esto responde la
pregunta 6 de §8 para el caso de esta implementación (queda igual de abierta
para Line of *Sight*/Vision, que Sprint 052B no toca). `zFeet`/altura se
ignora deliberadamente (misma simplificación que ya tenía
`getAttackLineInterception`), respondiendo parcialmente la pregunta 9 de §8:
`lineOfEffectBlockingCells` reemplaza a `impassableCells` como fuente de
obstrucción física para este propósito específico, sin resolver la pregunta
más amplia de "opaco a efectos/percepción" en general (cristal, barrotes),
que sigue abierta para Vision/Line of Sight.

### 1.4. Concealment (`getConcealmentAssessment`, `ConcealmentContribution`, Sprint 046)

`getConcealmentAssessment(room, attacker, target)` llama `EffectReducer.reduceConcealmentContributions` sobre **únicamente** `ConcealmentContribution`s declaradas en `EffectDefinition` (ej. `srd_blinded`'s auto-ocultación). En el modelo actual no existe ninguna fuente de ocultación derivada de geometría, iluminación o distancia — toda la ocultación hoy proviene de un efecto activo sobre el atacante o el objetivo, nunca del tablero. `ConcealmentAssessment` ya declara `directTargetingAllowed`/`requiresTargetSquare` (`types.ts:90-99`), campos hoy siempre fijos en el único productor existente, pero **estructuralmente ya preparados** para la distinción SRD entre ocultación parcial (se ve la casilla) y ocultación total por ausencia de visión (hay que adivinar la casilla) — ver §3.

**Vision no es un componente interno de Concealment.** `ConcealmentAssessment` es uno de varios consumidores posibles de `VisionAssessment` (ver diagrama en §3, Corrección A). Que el flujo de ataque actual solo tenga, hoy, un consumidor visible (`ConcealmentAssessment`) no debe describirse como si Concealment fuera el contenedor natural de Vision — es, en el pipeline general, un consumidor entre varios futuros.

### 1.5. Active Effects / EffectManager / EffectQueries

Confirmado (Sprint 049/050.1): `EffectManager.add` es el único punto de aplicación/consumo de `onStack`; `EffectQueries.getByTarget` es la única vía de lectura por objetivo. `EffectInstance` ya soporta anclaje dual: `targets` (biológico) o `targetCells` (Sprint 034, peligros ambientales — `srd_wall_of_fire_hazard`, `srd_poison_gas_hazard`). Este segundo anclaje es un candidato fuerte para que una futura fuente de oscuridad/niebla de área lo reutilice — una `EffectInstance` anclada a `targetCells` que declare una zona de iluminación reducida, sin inventar un nuevo lifecycle. Esto **no convierte a Vision en un reducer de efectos**: ver Corrección G en §3.

### 1.6. Snapshot (`combatSnapshot.ts`)

`createCombatRulesSnapshot` congela `board` (incluye `impassableCells`, `difficultTerrainCells`, `narrowCells`), `combatants` (posición, `zFeet`, `sizeCategory`) y `effectInstances`. No deriva ni persiste ningún total de visión/iluminación — coherente con el invariante ya ratificado en Sprint 044.2 ("Snapshot persiste fuentes/estado, nunca totales efectivos ni contextos efímeros"). Ninguna responsabilidad de Vision/LoE debe romper este invariante: los assessments se recalculan por evaluación, nunca se guardan.

### 1.7. Movement Contributions (`MovementRateContribution`, Sprint 045)

Contrato multiplicativo con `stackingKey`, ya consumido por Entangled/Blinded/Exhausted para media velocidad. Relevante solo indirectamente: Blinded ya declara movimiento ×1/2 sin visión — la infraestructura de tasa de movimiento no necesita cambios para Vision.

### 1.8. Rule Classification / Modifier Pipeline (Sprints 044.2/045)

`docs/designs/modifier-pipeline-architecture.md` ya reserva expresamente el lugar de Vision: **Fase 5 — Contexto efímero** ("Se evalúan relaciones que no deben persistirse: target, delivery, distancia, flanqueo, Cover, amenaza, disparo a melé y **futuro Concealment/Vision**. Cada regla contextual produce un assessment especializado; no modifica directamente la sala.") y explícitamente: *"Vision: puede producir assessments de percepción/line of effect consumidos por contexto, sin convertirse en flags persistidos de hit."* — nótese que ese propio documento ya coordina "Concealment" y "Vision" como dos palabras distintas, no una relación de contención. `docs/designs/rule-and-modifier-classification.md` ya nombra la responsabilidad futura: *"Vision/Concealment: Percepción/line of sight y miss chance; Blinded aporta BLIND, pero no duplica el resolver de ocultación"* y explícitamente descarta un `VisionModifier` genérico prematuro, reservando el nombre **`VisionAssessment`** para cuando exista un consumidor real. Este documento adopta ese nombre por continuidad, no por preferencia nueva.

## 2. Investigación SRD (con cita normativa en cada conclusión)

No fue posible el fetch directo a d20srd.org (403, igual que en la auditoría de Sprint 049); se trianguló con múltiples fuentes secundarias independientes convergentes en el mismo texto. Las filas marcadas como generalización quedan explícitamente acotadas al alcance inicial, no como certeza universal (ver §11).

| Concepto | Regla SRD (resumen, con función citada) | Cita |
|---|---|---|
| **Line of Sight** | Se traza una línea imaginaria entre el espacio propio y el del objetivo; si esa línea está libre de obstrucción, hay línea visual. | SRD Combat Modifiers / Special Attacks — *"draw an imaginary line between your space and the target's space"* |
| **Line of Effect** | Igual que línea visual para armas a distancia, **pero no la bloquean niebla, oscuridad ni otros factores que limitan la vista normal** — solo obstrucción física sólida. Requerida para dirigir un conjuro/efecto a un objetivo o casilla. | SRD Magic — *"line of effect is like line of sight for ranged weapons, except that it's not blocked by fog, darkness, and other factors that limit normal sight"* |
| **Total Cover** | Para ataques y conjuros dirigidos ordinarios, si no hay línea de efecto hacia el objetivo, tiene **Cobertura Total**: no se le puede atacar en absoluto. | SRD Combat Modifiers — *"if you don't have line of effect to your target, they are considered to have total cover from you... you can't make an attack against a target that has total cover"* |
| **Total Concealment** | Si hay línea de efecto pero **no** línea visual, el objetivo tiene **Ocultación Total**: no puede atacarse directamente (hay que adivinar la casilla), y un ataque exitoso falla un 50% (en vez del 20% de ocultación normal). | SRD Combat Modifiers — *"if you have line of effect to a target but not line of sight, they are considered to have total concealment... you can't attack an opponent with total concealment, though you can attack into a square you think he occupies"* |
| **Concealment (parcial)** | Iluminación tenue/sombras u otros factores otorgan ocultación: 20% de fallo; el objetivo sigue siendo visible/localizable directamente. | SRD Combat Modifiers, tabla de miss chance por grado |
| **Darkness** | Sin visión en la oscuridad (sin Visión en la Oscuridad/Infravisión): el personaje queda efectivamente Cegado — ocultación total contra todos, sin Destreza a CA, -2 CA, media velocidad, -4 Buscar y la mayoría de pruebas de Fuerza/Destreza. | SRD Environment / Vision and Light |
| **Darkvision** | Ve normalmente en zonas iluminadas y también en oscuridad hasta su alcance (usualmente 60 ft); sin color. Una criatura no puede ocultarse (por oscuridad) dentro de ese alcance salvo invisibilidad o cobertura. | SRD Special Abilities — Darkvision |
| **Low-Light Vision** | Ve el doble de lejos que un humano en condiciones de luz tenue; no ayuda en oscuridad total. | SRD Special Abilities — Low-Light Vision |
| **Blindsight** | Sentido no visual (vibración, olfato, oído, ecolocalización) que hace irrelevantes invisibilidad y ocultación (incluso oscuridad mágica) **para las excepciones que el propio SRD declara**; aun así requiere línea de efecto, no percibe criaturas etéreas y no distingue color. No se asume aquí que cubra cualquier caso futuro no auditado (ej. formas gaseosas, planos alternativos). | SRD Special Abilities — Blindsight |
| **Blindsense** | Detecta sin precisión de Blindsight, con línea de efecto; el oponente **conserva** ocultación total (50%) contra la criatura con Blindsense y ésta sigue perdiendo Destreza a CA contra lo que no puede ver. | SRD Special Abilities — Blindsense |
| **Invisible creatures / Targeting** | Un objetivo invisible tiene Ocultación Total incluso si se acierta su casilla (50% de fallo); localizar la casilla no elimina la ocultación. | SRD Special Abilities — Invisibility |
| **Fog** (ej. *Obscuring Mist*, *Fog Cloud*) | Mecánicamente reduce la visión a un radio corto y otorga ocultación total más allá de él. En el modelo actual se trata como una fuente concreta de la misma familia mecánica que Darkness (ausencia de línea visual), sujeta a auditoría normativa específica por conjuro antes de implementarse — no debe asumirse que toda niebla, humo u oscuridad produce exactamente el mismo resultado mecánico sin verificar el conjuro/fuente concreto. | SRD Spells — *Obscuring Mist*/*Fog Cloud* |

**Conclusión normativa central**: LoS y LoE son conceptos normativos distintos con consecuencias distintas. En el modelo actual pueden reutilizar primitivas geométricas comunes para trazar segmentos y detectar intersecciones (colinealidad, pertenencia a un segmento), pero conservan assessments y políticas independientes — las fuentes que bloquean percepción (luz, niebla, oscuridad) y las que bloquean propagación física (obstrucción sólida) no son necesariamente idénticas, y obstáculos futuros (cristal, barrotes, barreras mágicas) podrían bloquear uno sin bloquear el otro. **Total Cover ≠ Total Concealment**: para ataques a distancia ordinarios, el primero bloquea el ataque por completo (falta de LoE); el segundo permite un ataque a ciegas con 50% de fallo (LoE presente, LoS ausente). Esta distinción es exactamente la que `docs/audits/combat-rules-deviations.md` (D-02) ya señaló como un error de etiqueta en el corpus local (`10_modificadores_de_combate.txt:101` llama "cobertura total" a lo que el manual define como ocultación total) — este diseño no debe repetir ese error, ni fusionar en sentido opuesto los dos conceptos.

## 3. Respuestas a las 15 preguntas obligatorias

### 1. Qué representa Vision

La **capacidad de un observador de percibir** un objetivo a una distancia y nivel de luz dados. No es geometría por sí sola: combina (a) el nivel de luz de la casilla/zona del objetivo, (b) la capacidad de percepción del observador (visión normal, en penumbra, Visión en la Oscuridad, Infravisión, Blindsight/Blindsense) y (c) si existe línea visual geométrica (`LineOfEffectAssessment` como insumo, no como identidad). El resultado es un `VisionAssessment` — un **assessment contextual independiente**, consumido por Concealment pero no definido dentro de él (ver diagrama de consumidores más abajo). Es un contexto efímero, nunca un flag persistido (ratificado por Sprint 044.2).

**Vision como assessment independiente, no como pieza interna de Concealment:**

```text
Geometry
    ↓
LineOfEffectAssessment
    ↓
VisionAssessment
    ↓
Consumidores contextuales
    ├─ ConcealmentAssessment   (miss chance del Attack Resolver)
    ├─ TargetingAssessment     (legalidad de objetivo, ver §4)
    ├─ UI / fog of war futuro  (fuera de alcance)
    ├─ Skills/percepción futuras (Spot/Listen/Search, fuera de alcance)
    └─ otras reglas futuras (Sneak Attack, Stealth, etc.)
```

No se inventan ni se implementan hoy todos esos consumidores ni sus contratos — el objetivo de esta lista es únicamente impedir que el documento encierre Vision dentro de Concealment. Para el flujo de ataque específico, la relación correcta es:

```text
VisionAssessment
    ↓
contribuye a la construcción de
ConcealmentAssessment
    ↓
Attack Resolver
```

Nunca: *"VisionAssessment vive dentro de Concealment"*.

### 2. Qué representa Line of Effect

Una comprobación **geométrica y física**: en el modelo actual, ¿existe un camino sin obstrucción sólida entre dos puntos? Ignora luz, niebla, ocultación y capacidad de percepción — pregunta si un obstáculo físico (aproximado hoy por `board.impassableCells`, con la salvedad de la §1.3 sobre superficies parcialmente transparentes) interrumpe el segmento. Es la base para Total Cover, para el objetivo de un conjuro y para futuras áreas de efecto que no deban atravesar muros. Puede compartir primitivas geométricas con Line of Sight, pero es una regla y un assessment independientes (ver Corrección B, §2 y Corrección C más abajo).

### 3. Qué representa Line of Sight

**Corrección (Sprint 053)**: la redacción anterior de esta sección describía
Line of Sight como "Line of Effect más la condición perceptual", fusionando
en un solo concepto la geometría visual y la capa de luz/percepción. Eso es
incorrecto y contradecía el propio principio de este documento ("Vision no
es Cover, y no vive dentro de Concealment") aplicado a LoS: **Line of Sight
es, igual que Line of Effect, una comprobación puramente geométrica** — ¿hay
un camino visual sin obstrucción opaca entre el espacio del observador y el
del objetivo? — sin luz, sin capacidades perceptivas, sin ocultación. Es un
assessment geométrico hermano de `LineOfEffectAssessment`, no un derivado
suyo ni una versión "con más cosas". La composición con luz y capacidad
perceptiva ocurre **después**, en `VisionAssessment`:

```text
Geometry
├─ LineOfEffectAssessment        (obstrucción física sólida — Sprint 052B/052B.1)
└─ futuro LineOfSightAssessment  (obstrucción visual/opaca — no implementado aún)

futuro LineOfSightAssessment + nivel de luz + capacidad perceptiva del observador
    ↓
VisionAssessment
```

`LineOfEffectAssessment` y el futuro `LineOfSightAssessment` **pueden**
compartir la misma primitiva geométrica pura (recorrido de celdas por área,
ver §1.3.1) y, mientras no exista ningún obstáculo real que deba bloquear uno
sin el otro, **pueden también compartir la misma fuente de datos** de forma
explícitamente provisional — pero son conceptos y assessments
independientes, nunca el mismo objeto ni un alias. Sprint 053 (auditoría,
sin código) confirmó que implementar `LineOfSightAssessment`/`getLineOfSight`
hoy sería infraestructura sin consumidor real (usaría la misma fuente y la
misma geometría que LoE, sin producir ninguna diferencia observable ni
consecuencia de juego) — se difiere deliberadamente hasta que exista su
primer consumidor real o una fuente que produzca una diferencia genuina
respecto de LoE (ver §8, pregunta 9).

### 4. Qué información debe contener Snapshot

**Ninguna nueva por evaluación derivada** — se mantiene el invariante de Sprint 044.2. Lo que el Snapshot ya transporta (posiciones, `zFeet`, `board.impassableCells`, `effectInstances` con `targetCells`) es suficiente como *fuente* para el alcance geométrico inicial. Lo que falta no es un campo de Snapshot sino **datos de origen** que hoy no existen en ningún lado (ver §8, preguntas abiertas): nivel de luz por celda/zona (fuente: `Board`) y capacidad de visión por combatiente (fuente: `Combatant`/catálogo de criatura). El Snapshot los transportará **una vez que existan como fuente**, tal como ya transporta `impassableCells`; no se inventa un segundo canal.

### 5. Qué consultas públicas necesitará el motor

- `getLineOfEffect(room, from: Position, to: Position): LineOfEffectAssessment` — geométrica pura, sin percepción. **No es una generalización de `getAttackLineInterception`**: es una función nueva y separada que responde una pregunta normativa distinta (obstrucción física sólida / Total Cover), aunque pueda reutilizar primitivas geométricas puras internas (ej. intersección de segmento con celda, colinealidad) que también usa `getAttackLineInterception`. Ver Corrección C.
- `getVisionAssessment(room, observer: Combatant, target: Combatant): VisionAssessment` — compone el futuro `LineOfSightAssessment` (geometría visual, **no** `LineOfEffectAssessment` — ver corrección de §3), nivel de luz de la casilla objetivo y capacidad de percepción del observador. Es un assessment independiente (§3, pregunta 1); para el flujo de ataque, su resultado contribuye a la construcción de `ConcealmentAssessment` sin fusionarse conceptualmente con él ni crear un segundo sistema de miss chance.
- Ambas siguen el patrón ya validado de `CoverAssessment`/`ConcealmentAssessment`: puras, snapshot-in/assessment-out, sin mutación, consumidas igual por servidor y UI.

### 6. Qué consultas utilizará Attack Resolver

**Ninguna directamente.** El resolver ya recibe `ConcealmentAssessment` resuelto (`AttackResolutionOptions.concealment`, línea 64 de `attackResolver.ts`) y ya tira la única miss chance autoritativa (`resolveConcealment`). El caller (servidor, en el mismo punto donde hoy construye `CoverAssessment`) es quien invocará `getVisionAssessment`/`getLineOfEffect`, resolverá la legalidad de objetivo (§4) y plegará la contribución resultante dentro del `ConcealmentAssessment` antes de llamar a `resolveAttack`. **Cero cambios de firma en el resolver.** El resolver sigue sin conocer tablero, geometría ni percepción; solo consume el assessment consolidado.

### 7. Qué consultas utilizarán los futuros Feats

Blind-Fight (repetir una miss chance fallida una vez) y variantes de Precise Shot que ignoren grados de cobertura/ocultación consumirán el **resultado** de `VisionAssessment`/`ConcealmentAssessment` para modificar la consecuencia (repetir tirada, ignorar aplicabilidad), nunca recalculan geometría ni luz por su cuenta — mismo patrón que Dodge/Mobility consumiendo `totalArmorClass` hoy.

### 8. Qué consultas utilizarán los futuros Spells

- Objetivo/área de un conjuro: `getLineOfEffect` decide legalidad de objetivo (Cobertura Total = objetivo/casilla inválida), igual que ya hoy `validateAttackRange` decide alcance. Esta es una decisión de **legalidad**, no de miss chance (ver §4).
- *Darkness*/*Fog Cloud*/*Obscuring Mist*: en el modelo propuesto no ejecutarían lógica propia — declararían una zona de iluminación reducida anclada a `targetCells` (mismo patrón que `srd_wall_of_fire_hazard`), que `getVisionAssessment` leería como una fuente más de nivel de luz. Esta equivalencia entre conjuros de niebla/oscuridad concretos está sujeta a auditoría normativa específica por conjuro antes de implementarse (ver §11) — no se asume aquí que todos produzcan idéntico resultado mecánico.
- *Invisibility*: aportaría directamente una `ConcealmentContribution` total (patrón ya usado por `srd_blinded`), sin necesidad de tocar Vision/LoE — hipótesis de diseño, no implementada en este sprint.
- Futuras AoE (`getCellsIntersectedByAoE`) que no deban doblar esquinas podrían consumir `getLineOfEffect` por celda para truncar el área — esto sería una extensión de `getCellsIntersectedByAoE` (que hoy no verifica ningún obstáculo), no de `getAttackLineInterception`.

### 9. Qué información pertenece al tablero

Datos **estáticos y declarativos**, mismo nivel que `difficultTerrainCells`/`impassableCells`/`narrowCells`: qué celdas son obstrucción física para efectos de Line of Effect (hoy aproximado por `impassableCells`, con la salvedad ya anotada en §1.3 y §11 sobre superficies parcialmente transparentes) y qué celdas tienen luz reducida por defecto (dato nuevo: análogo a `difficultTerrainCells`, ej. `dimLightCells`/`darknessCells`, o una estructura de zonas si el detalle por celda resulta insuficiente — decisión abierta, §8 pregunta 2). El tablero **no** decide quién ve a quién ni calcula miss chance ni legalidad de objetivo.

### 10. Qué información pertenece al Rule Engine

La composición: los algoritmos geométricos de LoE y de LoS (que pueden compartir primitivas puras internas sin ser la misma función ni depender semánticamente una de otra — ver Corrección C), la derivación de capacidad de percepción por combatiente (Visión en la Oscuridad/Infravisión/Blindsight/Blindsense — fuente en `Combatant`/catálogo, proyección en `rules.ts`), la composición de luz + percepción + geometría en `VisionAssessment`, la resolución de legalidad de objetivo (§4), y el plegado de la contribución de Vision dentro de `ConcealmentAssessment` para el caso específico del flujo de ataque. El Rule Engine nunca persiste ningún resultado — se recalcula por snapshot, igual que Cover.

### 11. Qué infraestructura nueva será necesaria

1. **Datos de luz en el tablero**: un nuevo campo declarativo en `Board` (fuente estática, análogo a `difficultTerrainCells`) para zonas de luz tenue/oscuridad por defecto del mapa.
2. **Capacidad de percepción por combatiente**: hoy no existe ningún campo de visión en `Combatant` ni en `CreatureTypeCatalog` (verificado — cero resultados). Se necesita una fuente nueva (probablemente en `Combatant`, ya que Visión en la Oscuridad/Infravisión varían por raza/individuo, no por `CreatureTypeDefinition` amplio como `humanoid`) con alcance de Visión en la Oscuridad (pies) y booleano de Visión en Penumbra.
3. **Función geométrica nueva `getLineOfEffect`**: comprueba obstrucción física sólida (aproximada por `board.impassableCells`) sobre un segmento. Es una **función nueva y separada** de `getAttackLineInterception`, no una generalización ni extensión de esta — puede compartir utilidades geométricas puras internas (ej. `segmentIntersectsCell`, `isPointOnSegment`, `traceGridSegment`) sin que una regla dependa semánticamente de la otra. Ver Corrección C (§6) y §8, pregunta 3.
4. **Geometría de footprints multicasilla para LoE/LoS**: pendiente de diseño propio, ver §8, pregunta 6 (gate de diseño previo a implementación).
5. **Contratos `LineOfEffectAssessment`/`VisionAssessment`**: nuevos tipos, mismo patrón que `CoverAssessment`/`ConcealmentAssessment` (`applies`/`kind`/trazas/fuentes). No se fija su forma exacta en este documento.
6. **Fuente declarativa de zona de iluminación reducida anclada a `targetCells`**: mismo patrón que `EnvironmentalHazard` (Sprint 034) — sin bloque `hazard` (no inflige daño), un nuevo bloque análogo y minúsculo, o una reutilización de `EffectDefinition` con un campo declarativo de "reduce nivel de luz en N grados" para instancias `targetCells`. La forma exacta es una decisión de Sprint 052 o posterior.
7. **Punto de plegado en `getConcealmentAssessment`**: para que la contribución de Vision se combine con las `ConcealmentContribution`s ya existentes de ActiveEffects, sin dos sistemas de miss chance paralelos, y sin que esto implique que Vision "pertenece" al reducer de efectos (ver Corrección G).
8. **Capa explícita de legalidad de objetivo** (conceptual, no contractual todavía): ver §4.

### 12. Qué infraestructura existente debe reutilizarse

`CombatRulesSnapshot` (posiciones, `zFeet`, `board.impassableCells`, `effectInstances`); primitivas geométricas puras de segmento/colinealidad ya probadas en `getAttackLineInterception` (reutilizables como utilidades internas compartidas, sin fusionar los assessments — ver Corrección C); `ConcealmentAssessment`/`CoverAssessment`/`AttackContextModifiers`/`TacticalModifierSummary` como patrón de assessment compartido servidor/UI; `EffectReducer.reduceConcealmentContributions` como mecanismo de composición existente (posible punto de plegado para una contribución adicional, sin convertirlo en un reducer universal de visión); el patrón `targetCells` de `EffectInstance` (Sprint 034) para zonas de luz de área; `Trait`/`RuleOverride` para clasificar estados (`BLIND` ya existe y seguirá siendo válido: Blinded aporta su propia ocultación total declarativa, independiente de Vision — un ciego no necesita el cálculo de luz para estar totalmente a oscuras); y el pipeline oficial de Sprint 044.2 (Fase 5 — Contexto efímero) como ubicación exacta en el flujo de ataque.

### 13. Riesgos arquitectónicos

Ver tabla en §5.

### 14. Alternativas consideradas

Ver §6.

### 15. Justificación de la solución elegida

La solución elegida (assessments puros independientes siguiendo el patrón Cover/Concealment, `getLineOfEffect` como función nueva que puede compartir primitivas geométricas con `getAttackLineInterception` sin fusionarse con ella, reutilización de `targetCells` para zonas de luz, contribución de Vision plegada dentro de `ConcealmentAssessment` para el flujo de ataque específico sin convertirse en un segundo sistema de miss chance ni en la única responsabilidad de Vision) es la opción auditada que: (a) no exige tocar la firma del Attack Resolver; (b) no duplica ni corrompe la geometría de Cover ya probada y con tests dependientes; (c) no persiste nada nuevo en Snapshot, respetando el invariante ya ratificado; (d) no introduce un `VisionModifier`/reducer universal, exactamente como `rule-and-modifier-classification.md` ya advirtió que sería prematuro; y (e) cierra el gap G-03 (`docs/audits/combat-rules-deviations.md`) sin inventar una mecánica nueva, formalizando una distinción (LoE vs LoS, Total Cover vs Total Concealment) que el propio corpus normativo ya necesitaba y confundía (D-02) — sin caer en el error inverso de fusionar Cover de criatura con Total Cover de terreno.

## 4. Target legality y orden de resolución

Line of Effect **no produce miss chance**. Determina si la acción puede
siquiera dirigirse al objetivo o a una casilla. Confundir "legalidad de
objetivo" con "ocultación/miss chance" sería repetir, en sentido inverso, el
mismo tipo de error de etiqueta que D-02 ya detectó en el corpus local.
`ConcealmentAssessment` por sí solo **no representa toda la legalidad de un
ataque** — representa únicamente la miss chance una vez que el ataque ya es
legal.

Vision puede afectar, en distintos puntos de esta cadena: si el objetivo
puede seleccionarse directamente, si en cambio debe seleccionarse una
casilla (ataque a ciegas), y el grado de ocultación aplicable. El orden de
resolución propuesto — conceptual, no contractual — es:

```text
1. ¿Existe Line of Effect?
2. ¿La regla permite seleccionar directamente al objetivo?
3. Si no puede seleccionarse directamente, ¿puede seleccionarse una casilla?
4. ¿Existe Cover?
5. ¿Existe Concealment (incluida la ocultación aportada por Vision)?
6. ¿Se permite resolver el ataque?
7. ¿Corresponde miss chance?
```

Los pasos 1-3 y 6 son de **legalidad** (¿puede intentarse la acción, y
contra qué?); los pasos 4-5 y 7 son de **consecuencia** (¿qué modificadores
aplican y con qué probabilidad falla?). Hoy el motor no tiene una sede
explícita para los pasos 1-3 y 6 — `validateAttackRange` es lo más cercano,
pero solo resuelve distancia, no obstrucción.

Se propone, conceptualmente y sin fijar su contrato ni convertirlo en
requisito de Sprint 052, un futuro `TargetingAssessment` como posible sede de
esos pasos de legalidad — análogo en espíritu a `CoverAssessment`/
`ConcealmentAssessment`, pero respondiendo "¿puedo siquiera intentar esto?"
en vez de "¿con qué modificador?". Su forma exacta, si se justifica con un
consumidor real, es una decisión de un sprint de diseño posterior.

## 5. Riesgos arquitectónicos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Confundir Cover (criatura, +4 CA, no bloquea el ataque) con Total Cover (terreno sólido, sin LoE, bloquea el ataque por completo) | Repetir el error D-02 ya detectado en el corpus local | Mantener `getAttackLineInterception` (criaturas) y `getLineOfEffect` (terreno sólido) como funciones y assessments distintos, con `kind` explícito; nunca fusionar sus resultados en un único booleano |
| Encerrar `VisionAssessment` dentro de `ConcealmentAssessment` como si fuera su único consumidor o su sede natural | Bloquearía futuros consumidores (legalidad de objetivo, UI de fog-of-war, skills de percepción) y confundiría a Sprint 052 sobre dónde vive Vision | Vision es un assessment contextual independiente que *contribuye* a Concealment para el flujo de ataque, sin definirse dentro de él (§3, pregunta 1) |
| Crear un segundo sistema de miss chance paralelo al de `ConcealmentAssessment` | Dos resoluciones de ocultación divergentes; el resolver tendría que aceptar dos parámetros | La contribución de Vision se pliega dentro de `getConcealmentAssessment`/`ReducedConcealment` para el flujo de ataque; el resolver sigue recibiendo un único `ConcealmentAssessment` |
| Persistir luz/visibilidad calculada en el Snapshot o en `CombatRoom` | Reabre la deuda ya purgada de totales cacheados (ver Sprint 044.2 §9.E) | Solo se persisten fuentes (nivel de luz por celda, capacidad de visión por combatiente); el assessment se recalcula siempre |
| Modelar Vision con un sistema de orientación/campo de visión (facing) no pedido por el SRD | Complejidad no normativa; el SRD 3.5 no exige facing por defecto | Vision es omnidireccional por defecto (360°) salvo que una regla futura y su propia NDD lo contradigan explícitamente |
| Ampliar el alcance de Sprint 052 más allá de Line of Effect y Total Cover | Repetir el patrón ya evitado en Sprint 049/050 (alcance disciplinado); mezclaría una decisión de geometría pendiente (footprints, §8 pregunta 6) con luz/percepción no auditadas todavía | Sprint 052 tentativo cierra **solo** Line of Effect + Total Cover + decisión de geometría multicasilla (ver §10); Vision, luz, LoS, Darkvision/Low-Light, Blindsight/Blindsense, Invisibility y conjuros de niebla/oscuridad quedan explícitamente fuera y quedan para sprints posteriores con su propio NDD |
| Que `getLineOfEffect` se implemente como una generalización o reescritura de `getAttackLineInterception` | Regresión en `DEFENSE-COVER`, ya Completo y con 457+ tests dependientes; además mezclaría dos reglas con consecuencias distintas | `getLineOfEffect` es una función nueva y separada; puede compartir utilidades geométricas puras (colinealidad/segmento) pero no debe reemplazar, envolver ni depender semánticamente de `getAttackLineInterception` |
| Resolver la geometría de footprints multicasilla (Large+) de forma implícita durante la implementación, sin auditoría normativa previa | Algoritmo elegido por conveniencia de código en vez de por evidencia SRD; alto costo de rehacer una vez que haya consumidores | Tratar la pregunta 6 de §8 como gate de diseño explícito, previo a cualquier código de Sprint 052 que dependa de LoE/LoS contra criaturas Large+ |
| Asumir que `impassableCells` es sinónimo definitivo de "opaco a efectos/percepción" | Modelar mal superficies parcialmente transparentes (cristal, barrotes) el día que aparezcan | Tratar `impassableCells` como la mejor aproximación disponible hoy, no como una equivalencia normativa cerrada (§1.3, §11) |
| Costo de rendimiento de otra pasada `O(n)` por par atacante-objetivo | Mismo orden que Cover ya acepta hoy; no es un riesgo nuevo | Ninguna mitigación adicional requerida — mismo patrón ya validado en producción |
| Definir "nivel de luz" por celda individual vs. por zona/polígono | Granularidad equivocada puede ser cara de mantener en mapas grandes | Decisión diferida a un sprint posterior a Sprint 052, con evidencia de casos de uso reales (§8 pregunta 2) |

## 6. Alternativas consideradas

### A. Vision/LoE como fog-of-war exclusivo de UI (sin autoridad de servidor)

Descartada. Viola el invariante no negociable "el servidor es autoritativo" (`CODEX_GUIDE.md`, `ADR-0001`). Cualquier ocultación/cobertura/legalidad debe resolverse en servidor con el mismo snapshot que ya usan Cover/Concealment.

### B. Modelar Darkness/Fog como ActiveEffect sobre cada criatura afectada, no sobre celdas

Descartada como mecanismo principal. La luz es una propiedad de una **región**, no de un individuo — una criatura que entra y sale de una zona oscura no debería "llevarse" un efecto consigo. El patrón candidato ya existe: `targetCells` (Sprint 034), reutilizable sin cambios de lifecycle. (Blinded sigue siendo la excepción correcta: es una condición del individuo, no de la zona.)

### C. Unificar `getAttackLineInterception` (Cover) y la nueva geometría de Line of Effect en una sola función

Descartada. Cover (criaturas vivas, +4 CA, no impide el ataque) y Total Cover (terreno sólido, impide el ataque) son mecánicas distintas con consecuencias distintas — fusionarlas reproduciría exactamente el error D-02 del corpus local, en sentido inverso. Ambas funciones pueden compartir primitivas geométricas puras internas (colinealidad, pertenencia a un segmento, intersección con celda), pero conservan assessments y firmas propias; ninguna depende semánticamente de la otra ni una "evoluciona" hacia la otra. Compartir primitivas no implica compartir el assessment ni fusionar las reglas.

### D. Un `VisionModifier`/`RuleModifier` universal, o forzar Vision dentro de `EffectReducer` como reducer genérico

Descartada. Exactamente el antipatrón ya rechazado dos veces (Sprint 044.2 §9, Sprint 045 §"No crear todavía"). Un ataque extra, media velocidad, inmunidad y miss chance por visión no comparten semántica seguible en un contrato universal. ActiveEffects puede seguir aportando *fuentes* declarativas de percepción/iluminación/ocultación (un `EffectInstance` de niebla ancla a `targetCells`, por ejemplo), pero la composición de Vision ocurre en funciones especializadas (`getVisionAssessment`, etc.), no todos sus consumidores son reducciones numéricas, y no debe forzarse un reducer universal de visión sin consumidores y semántica previamente definidos.

### E. Sistema de facing/campo de visión direccional

Descartada para este alcance. No hay regla base del SRD 3.5 que exija facing por defecto en combate táctico con grid; introducirlo sería homebrew no solicitado.

### F. Granularidad de luz por casilla individual desde el inicio

Diferida, no descartada. Es la opción más simple de implementar (mismo patrón que `difficultTerrainCells`) pero puede ser costosa de autorear en mapas grandes con muchas zonas. Un sprint posterior a Sprint 052 debe decidir con evidencia real si basta la granularidad por celda o si conviene una estructura de "zonas" (rectángulos/polígonos con nivel de luz) que se traduzca a celdas en el snapshot.

## 7. Pipeline canónico

### 7.1. Flujo general

```text
Snapshot sources
  (board.lineOfEffectBlockingCells, posiciones, zFeet, effectInstances/targetCells)
    ↓
Geometry primitives
  (recorrido de celdas por área — puras, sin reglas; ver §1.3.1)
    ↓
    ├─ LineOfEffectAssessment        (obstrucción física sólida; independiente de luz/percepción — implementado, Sprint 052B/052B.1)
    │     ↓
    │   Target legality (ausencia ⇒ Cobertura Total ⇒ ataque invalido)
    │
    └─ futuro LineOfSightAssessment  (obstrucción visual/opaca; geometría hermana de LoE, no un derivado suyo — NO implementado, ver §3)
          ↓
        futuro LineOfSightAssessment + nivel de luz + capacidad perceptiva
          ↓
        VisionAssessment (no implementado)
          ↓
        ConcealmentAssessment (efectos declarativos existentes + futura contribución de Vision)
    ↓
Target legality / contextual composition
    ├─ CoverAssessment       (criaturas interpuestas — getAttackLineInterception, sin cambios)
    └─ ConcealmentAssessment (efectos declarativos existentes; contribución de Vision pendiente)
    ↓
AttackContext
    ↓
Attack Resolver
  (consume assessments consolidados; no calcula tablero ni percepción)
```

**Corrección (Sprint 053)**: la versión anterior de este diagrama mostraba
`LineOfEffectAssessment → VisionAssessment` como una dependencia directa,
sugiriendo que Vision se construye a partir de LoE. Eso es incorrecto: Vision
se construye a partir de un futuro `LineOfSightAssessment` geométricamente
independiente (aunque hoy inexistente), no de LoE. `LineOfEffectAssessment`
solo alimenta la legalidad de objetivo (Cobertura Total), como ya implementa
Sprint 052B — nunca a Vision/Concealment. Ver §3 para el detalle completo de
esta corrección.

Principios que este diagrama debe conservar, incluso si una auditoría de
código posterior ajusta el orden exacto:

- Snapshot aporta fuentes, no respuestas derivadas.
- Geometry no decide reglas — son primitivas puras reutilizables.
- Line of Effect no es Concealment.
- Vision no es Cover, y no vive dentro de Concealment.
- La legalidad de objetivo se resuelve antes de llegar al resolver.
- Cover y Concealment conservan consecuencias distintas entre sí.
- Attack Resolver consume assessments; no calcula tablero ni percepción.

### 7.2. Flujo de Ocultación Total (LoE presente, LoS ausente)

```text
LoE presente
+ LoS ausente
+ casilla elegida (ataque a ciegas)
    ↓
Total Concealment
    ↓
50% miss chance (Attack Resolver, resolveConcealment)
```

### 7.3. Flujo de Cobertura Total (LoE ausente)

```text
LoE ausente
    ↓
Target invalid / attack not allowed
    ↓
No attack roll
```

## 8. Preguntas abiertas

1. ¿La capacidad de visión (Visión en la Oscuridad/Penumbra) vive en `Combatant` directamente o en un catálogo nuevo análogo a `SizeRulesCatalog`? Ambas opciones reutilizan el patrón fuente→proyección; ninguna se decide aquí.
2. ¿Granularidad de datos de luz: por celda (`Board.dimLightCells`/`darknessCells`, análogo a `difficultTerrainCells`) o por zona/polígono traducida a celdas en el snapshot?
3. ¿`getLineOfEffect` debe considerar criaturas como obstrucción parcial, o el bloqueo por criaturas queda exclusivamente en `getAttackLineInterception` (Cover)? La lectura SRD más simple sugiere que Total Cover es sobre terreno/objetos, no sobre criaturas, pero no se cierra aquí. **Resuelto en Sprint 052B**: `getLineOfEffect` consulta únicamente `lineOfEffectBlockingCells` (terreno/objetos); el bloqueo por criaturas interpuestas queda exclusivamente en `getAttackLineInterception`/Cover, sin solapamiento entre ambas mecánicas.
4. ¿Cómo interactúan `threatensTarget`/AdO con Total Cover? (Ej.: ¿un enemigo detrás de un muro sólido puede amenazar/flanquear?) Fuera de alcance de este documento, pero el diseño de implementación deberá decidir explícitamente si lo deja fuera o lo cierra.
5. ¿La forma declarativa de "zona de luz reducida" anclada a `targetCells` necesita su propio bloque en `EffectDefinition` (análogo a `hazard`) o basta una extensión mínima de `EnvironmentalHazard`?
6. **Geometría de Line of Effect / Line of Sight contra footprints multicasilla (gate de diseño previo a implementación, no un detalle a resolver durante el código)**: debe auditarse y decidirse explícitamente, con respaldo normativo y casos de prueba geométricos, antes de que Sprint 052 (o el sprint que implemente LoE) toque código, al menos:
   - cómo se evalúa LoE/LoS cuando el origen y/o el objetivo son criaturas Large o mayores (footprint multicasilla);
   - qué punto(s) o esquina(s) del footprint de origen se usan para trazar el/los segmento(s);
   - qué punto(s) o esquina(s) del footprint de destino se usan;
   - si basta con que exista **un** segmento válido entre cualquier par de puntos de ambos footprints para afirmar Line of Effect, o si se exige un criterio más estricto;
   - si, para declarar **ausencia total** de Line of Effect, deben estar bloqueados **todos** los segmentos posibles entre ambos footprints, o alguno más laxo;
   - cómo interactúa esto con `zFeet` (altura) cuando los footprints no comparten plano;
   - consistencia con el algoritmo ya existente de `getAttackLineInterception` (Cover, hoy 1×1 centro-a-centro) y con las reglas SRD de criaturas multicasilla, sin asumir que ambas mecánicas deban resolver footprints de la misma manera.
   **Resuelto en Sprint 052B, solo para Line of Effect** (Line of Sight/Vision
   sigue abierta): existe Line of Effect si al menos un par de celdas ocupadas
   (una del atacante, una del objetivo) tiene un recorrido sin bloqueadores;
   Cobertura Total exige que **todos** los pares posibles estén bloqueados.
   `zFeet` se ignora (misma simplificación que ya tenía Cover). **La geometría
   de cada recorrido individual (punto vs. área de celda) se corrigió en
   Sprint 052B.1** — ver §1.3.1 arriba. Ver `tests/line-of-effect.test.mjs`.
7. ¿Orden exacto de fases dentro de "Fase 5 — Contexto efímero" cuando coexistan Cover, Concealment por efecto declarativo y Concealment por Vision — se calculan independientemente y se componen al final, o existe precedencia (ej. Blinded ya implica ocultación total y no necesita evaluar luz)?
8. ¿Blindsight/Blindsense se modelan como traits (`Trait` ya es un union cerrado) o como capacidad de percepción con alcance, análoga a Visión en la Oscuridad? Ambos existen en el SRD con reglas ligeramente distintas (§2).
9. ¿`impassableCells` basta como aproximación de obstrucción física para Line of Effect, o se necesita un campo declarativo distinto que distinga "intransitable para movimiento" de "opaco a efectos/percepción" (cristal, barrotes, rejas)? Ver §1.3 y §11. **Resuelto en Sprint 052B**: se optó por el campo declarativo distinto — `Board.lineOfEffectBlockingCells`, independiente de `impassableCells` (que queda exclusivamente de movimiento). La distinción más fina "opaco a efectos" vs. "opaco a percepción" (cristal, barrotes) sigue abierta para cuando exista Vision/Line of Sight. **Auditado en Sprint 053 (sin código)**: se confirmó que hoy no existe ningún obstáculo real en el catálogo que deba bloquear Line of Sight sin bloquear Line of Effect (o viceversa) — casos SRD reales existen (cristal/pared transparente bloquea LoE no LoS; niebla/humo bloquea LoS no LoE) pero ninguno está implementado. Se decidió explícitamente NO crear `LineOfSightAssessment`/`getLineOfSight`/un campo `lineOfSightBlockingCells` todavía, para evitar infraestructura sin consumidor real; queda diferido hasta que exista una vertical de Vision con luz básica o una fuente concreta de obstrucción visual (ej. niebla) que justifique la separación. Ver §3.
10. Forma exacta de un futuro `TargetingAssessment` (§4) y si se justifica como contrato propio o como una composición de los assessments ya existentes — no se decide en este documento.

## 9. Impacto sobre la arquitectura

| Subsistema | Impacto |
|---|---|
| `packages/shared/src/rules.ts` | Nueva función pura `getLineOfEffect` (independiente de `getAttackLineInterception`, puede compartir utilidades geométricas internas); nueva función pura `getVisionAssessment`; extensión de `getConcealmentAssessment` para plegar la contribución de Vision en el flujo de ataque |
| `packages/shared/src/types.ts` | Nuevos tipos `LineOfEffectAssessment`, `VisionAssessment`; posible extensión de `Board` (luz) y `Combatant` (percepción) — no en este sprint |
| `packages/shared/src/effects/*` | Reutilización sin cambios conceptuales de `targetCells`/`EffectInstance`/`EffectManager`; posible extensión declarativa análoga a `EnvironmentalHazard`; sin convertir a Vision en un reducer universal |
| Attack Resolver | **Cero cambios de firma** — sigue consumiendo `ConcealmentAssessment` |
| Cover (`DEFENSE-COVER`) | **Actualizado (Sprint 052B)**: `getAttackLineInterception` se corrigió (ya no consulta `impassableCells`, retira `terrain-cover`); `getLineOfEffect` es una función nueva y separada, tal como preveía esta fila |
| Snapshot | **Actualizado (Sprint 052B)**: nuevo campo transportado, `Board.lineOfEffectBlockingCells` (ver `combatSnapshot.ts`); fuentes de luz/percepción para Vision siguen sin implementar |
| UI | Futuro preview compartido, mismo patrón que Cover/Concealment — fuera de alcance de este documento |
| Rule Registry | **Actualizado (Sprint 052B)**: `DEFENSE-LINE-OF-EFFECT` agregada (Parcial, solo ataques físicos ordinarios), siguiendo la política de Sprint 044.1 |

## 10. Alcance canónico de Sprint 052 (tentativo, no autorizado, sujeto a `Proceed` propio) — IMPLEMENTADO en Sprint 052B

Esta es la única versión válida del alcance tentativo de Sprint 052 — sustituye
cualquier mención más amplia en otras secciones de este documento (riesgos,
etc.), que deben leerse subordinadas a esta lista. **Los puntos 1-6 de
"Incluye" fueron implementados en Sprint 052B** (con un ajuste: el punto 4 usa
`Board.lineOfEffectBlockingCells`, no `impassableCells`, tras la decisión de
Sprint 052A — ver `docs/designs/terrain-cover-line-of-effect-decision.md`). La
lista de "Explícitamente fuera de alcance" permanece vigente sin cambios: sigue
describiendo trabajo futuro real, no ya completado.

**Incluye:**

1. Auditoría normativa final de Line of Effect y Total Cover (confirmación puntual, no una segunda investigación amplia).
2. Decisión de diseño sobre geometría multicasilla (§8, pregunta 6) — gate previo a cualquier código.
3. Contrato `LineOfEffectAssessment`.
4. Función pura `getLineOfEffect` contra terreno sólido (`impassableCells`, con la salvedad de §1.3/§11), separada de `getAttackLineInterception`.
5. Integración de la legalidad de objetivo (Total Cover) en una única ruta de ataque.
6. Tests unitarios e de integración correspondientes a los puntos 3-5.

**Explícitamente fuera de alcance de Sprint 052** (quedan para sprints posteriores con su propio NDD y `Proceed`):

- luz (niveles de iluminación, zonas de luz tenue/oscuridad);
- Vision como capacidad de percepción compuesta;
- Line of Sight;
- Darkvision;
- Low-Light Vision;
- Blindsight/Blindsense;
- Invisibility;
- conjuros de niebla/oscuridad (Fog Cloud, Obscuring Mist, Darkness);
- cualquier cambio visual/UI.

## 11. Notas sobre precisión normativa (alcance de las afirmaciones de este documento)

Ninguna afirmación de este documento debe leerse como regla nueva o
ampliación de conclusiones SRD más allá de lo citado en §2. En particular:

- La equivalencia "ausencia de Line of Effect ⇒ Total Cover" se afirma **para
  ataques y conjuros dirigidos ordinarios** (el caso citado del SRD), no como
  ley universal aplicable a cualquier interacción futura sin auditoría.
- No se afirma que toda niebla, humo u oscuridad producida por un conjuro
  concreto produzca exactamente el mismo resultado mecánico — cada fuente
  requiere su propia verificación normativa antes de implementarse (§2, fila
  Fog).
- La irrelevancia de la ocultación para Blindsight se afirma con las
  excepciones que el propio SRD declara (línea de efecto, criaturas
  etéreas, color); no se extiende a casos no auditados.
- No se afirma que las criaturas nunca puedan bloquear Line of Effect — es
  una pregunta abierta (§8, pregunta 3), no una conclusión.
- `impassableCells` se usa **en el modelo actual** como la aproximación
  disponible más cercana a "obstrucción física sólida", no como sinónimo
  normativo definitivo de opacidad — superficies parcialmente transparentes
  (cristal, barrotes) quedan como hipótesis de un sprint posterior pendiente
  de validación (§1.3, §8 pregunta 9).

Donde el modelo actual o el SRD no permiten una conclusión universal, este
documento usa formulaciones acotadas ("para el alcance inicial", "en el
modelo actual", "sujeto a auditoría específica", "hipótesis pendiente de
validación") en vez de afirmar certeza no verificada.

## 12. Fuera de alcance de este documento y de Sprint 051

Implementación de código, tests, Rule IDs, cambios a `EffectDefinition`/catálogo, cambios a Snapshot, cambios a Attack Resolver, comandos WebSocket nuevos, contratos TypeScript concretos (`LineOfEffectAssessment`, `VisionAssessment`, `TargetingAssessment`), Blindsight, Blindsense, Invisibility, Darkness/Fog Cloud como conjuros, facing/campo de visión direccional, Sneak Attack por Vision (ya cubierto parcialmente por `canApplySneakAttack` + Concealment existente), resolución unilateral de las preguntas abiertas de §8.

## 13. Sprint 053A — Diseño de Vision e iluminación básica

**Estado:** solo diseño, sin código. No autoriza implementación; Sprint 053B
requiere su propio `Proceed` explícito tras revisar esta sección. Continúa
directamente el trabajo de Sprint 053 (auditoría LoS vs LoE, sin código,
integrada en §3 y §7.1 más arriba) hacia la primera vertical funcional real:
Vision con iluminación básica.

### 13.1. Auditoría normativa SRD (Vision e iluminación)

Regla oficial (SRD 3.5, *Vision and Light*, tabla de niveles de luz):

- **Luz brillante**: visión normal, sin penalización.
- **Iluminación tenue** ("shadowy illumination" — luz de luna, antorcha lejana): criaturas/objetos en esa luz tienen **ocultación parcial (20% de fallo)** frente a cualquier observador sin capacidad adecuada — la ocultación es del objetivo, no del observador. Low-Light Vision o Darkvision anulan esta penalización para ese observador específico (ven la zona como si fuera luz brillante).
- **Oscuridad total**: sin ninguna fuente de luz, un observador sin Darkvision no puede ver en absoluto — el objetivo tiene **ocultación total (50%, debe elegirse una casilla objetivo, sin poder apuntar directamente)**, exactamente la misma consecuencia mecánica que invisibilidad. Darkvision permite ver con normalidad (sin ninguna penalización) dentro de su alcance declarado (típicamente 60 ft, variable por criatura); más allá de ese alcance, la oscuridad total aplica igual que sin Darkvision.
- **Low-Light Vision**: duplica la distancia a la que una criatura ve con normalidad bajo luz tenue (trata esa luz como brillante hasta el doble de alcance de la fuente). **No funciona en oscuridad total absoluta** — necesita algo de luz ambiental para duplicar.
- **Regla normativa central para este sprint** (RAW, *Combat Modifiers*): *"Si tienes Line of Effect a un objetivo pero no Line of Sight, el objetivo tiene ocultación total desde tu perspectiva."* Esto confirma exactamente el flujo que §7.2 de este documento ya boceteaba ("Flujo de Ocultación Total: LoE presente, LoS ausente") — Line of Sight bloqueada es, mecánicamente, un caso más de Ocultación Total, con la misma consecuencia (50%, elegir casilla) que la oscuridad o la invisibilidad.
- **Targeting directo vs. casilla**: SRD exige elegir una casilla (no un objetivo directo) cuando el atacante no puede ver al objetivo por ningún motivo (oscuridad, niebla, invisibilidad, LoS bloqueada); si la casilla elegida está vacía, el ataque falla automáticamente. Este proyecto **ya** modela esta distinción en `ConcealmentAssessment.directTargetingAllowed`/`requiresTargetSquare` (Sprint 046) — Vision no necesita un contrato de targeting nuevo, solo alimentar los campos ya existentes.
- **Blinded y condiciones ambientales — independencia deliberada**: la condición Blinded (SRD) impone -2 CA, pérdida de Destreza y ocultación total automática en los ataques que realiza la criatura cegada, **sin importar el nivel de luz** — un ciego no ve mejor en una habitación iluminada. Este proyecto ya implementa `srd_blinded` exactamente así desde Sprint 047: una `ConcealmentContribution` declarativa incondicional (perspectiva `attacks_by_target`), independiente de cualquier cálculo de luz. Vision e iluminación **no deben re-derivar ni sustituir** ese comportamiento — deben coexistir como una fuente de ocultación **adicional e independiente**, compuesta por precedencia de severidad máxima (ver §13.6), no por acoplamiento explícito entre ambos sistemas.

**Decisión de modelado explícita para esta vertical**: se modela únicamente el eje "luz ambiental estática + capacidad de percepción del observador", sin niebla, sin Blindsight/Blindsense, sin Darkvision-en-color-vs-blanco-y-negro (irrelevante mecánicamente), sin facing. Diferido explícitamente a sprints posteriores (no una omisión silenciosa).

### 13.2. Auditoría de repositorio (evidencia)

- `Board` (`types.ts:24-32`): ya tiene cuatro campos `string[]` de claves `"x,y"` (`difficultTerrainCells`, `impassableCells`, `narrowCells`, `lineOfEffectBlockingCells`), todos opcionales, todos ausentes en `demoBoard` (`demo-data.ts:6`, `{ width: 16, height: 8, cellSizeFeet: 5 }` — sin ningún campo de terreno declarado), todos sin editor de UI. Es el precedente establecido para "dato de tablero estático, declarativo, ausente por defecto".
- `Combatant`/`CombatantSnapshot` (`types.ts:180-224`): **no existe ningún campo de percepción** (no hay `darkvisionFeet`, `lowLightVision`, ni un concepto de "raza" separado de `creatureTypeId`). `creatureTypeId: CreatureTypeId` es demasiado grueso para esto (un enano y un humano son ambos `"humanoid"`; solo uno tendría Darkvision). `featureIds: CombatFeatureId[]` está tipado como plantilla literal cerrada exclusiva de dados de Sneak Attack (`` `srd_sneak_attack_${number}d6` ``, `types.ts:17`) — no sirve como bolsa genérica de rasgos raciales sin ensanchar ese tipo.
- `IntrinsicDefense` (`types.ts:145-150`): precedente exacto para lo que se necesita — un objeto plano de bonificadores permanentes e innatos, sourced desde catálogo, viviendo directamente en `Combatant` (no un `EffectContribution`, no derivado de tamaño/tipo). `baseSpeedFeet` es otro precedente de "estadística por criatura individual, no derivable de tamaño ni tipo".
- `SizeRulesCatalog`/`getSizeRule` (`sizeRules.ts`): precedente de "catálogo fuente→proyección" (`Record<EnumCerrado, Regla>` + accessor puro), pero **no aplica** a percepción porque no existe un enum cerrado equivalente a "raza" — la capacidad visual varía por criatura individual, no por una categoría pequeña y cerrada como `SizeCategory`.
- `ConcealmentContribution`/`ConcealmentTrace` (`effects/contracts.ts:150-157`, `effects/reducer.ts:69-92`): la reducción (`EffectReducer.reduceConcealmentContributions`) opera **exclusivamente sobre `EffectInstance`** — cada `ConcealmentTrace` exige `effectInstanceId`/`contributionId` (`reducer.ts:70-72`). Vision no tiene un `EffectInstance` que la origine (es geometría + luz + capacidad del observador, no un efecto aplicado a un combatiente) — **no puede inyectarse dentro de este reductor tal como existe hoy**.
- `getConcealmentAssessment`/`composeConcealmentAssessment` (`rules.ts:1936-1969`): capa fina que llama al reductor y arma `ConcealmentAssessment`. Es el punto de extensión natural para Vision — no el reductor mismo.
- `srd_blinded`: confirmado como `ConcealmentContribution` declarativa, perspectiva `attacks_by_target`, `kind: "total"` incondicional — coexiste con Vision sin acoplamiento (ver §13.1, último punto, y §13.6).
- `Trait` (`effects/contracts.ts:24-43`): union cerrado ya incluye `"BLIND"`; **no existe** ningún trait de percepción/visión (`DARKVISION`, `LOW_LIGHT_VISION`, etc.) — confirma que la capacidad de percepción no vive hoy en ningún lado del sistema de efectos.
- `EffectInstance.targetCells`: patrón ya usado por `EnvironmentalHazard` (Sprint 034, ej. `srd_wall_of_fire_hazard`) para anclar un efecto a celdas del tablero en vez de a un combatiente. Es el mecanismo correcto para una **futura** niebla/oscuridad mágica dinámica (fuera de alcance de esta vertical), no para iluminación **estática** del mapa.
- `traversedCellKeysBetween`/`getLineOfEffect` (`rules.ts`, Sprint 052B.1): primitiva de recorrido "supercover" pura, ya probada (29 casos), candidata a reutilización compartida con un futuro `getLineOfSight` (ver Sprint 053, §3 arriba) — sin tocarla en este sprint.

**Respuestas a las 7 preguntas de la Fase 3:**

1. **¿Dónde vive la capacidad visual base?** Directamente en `Combatant`/`CombatantSnapshot`/`CreatureTemplate`, como un objeto nuevo análogo a `IntrinsicDefense` (ver §13.4) — no en `EffectInstance`/ActiveEffects (es un rasgo permanente, no una condición temporal) ni derivado de `sizeCategory`/`creatureTypeId` (ninguno de los dos discrimina lo suficiente).
2. **¿Propiedad del combatiente, catálogo racial o fuente compuesta?** Propiedad del combatiente individual, sourced desde el catálogo de criaturas (`CreatureTemplate`) al instanciar — igual que `baseSpeedFeet`/`intrinsicDefense` ya funcionan hoy. No existe (ni se propone crear) un concepto de "raza" separado de la plantilla de criatura.
3. **¿Dónde viven las fuentes de iluminación estática?** En `Board`, como campos `string[]` de claves `"x,y"` — mismo patrón que los cuatro campos `*Cells` ya existentes (ver §13.3).
4. **¿Cómo se representan fuentes dinámicas o zonas de oscuridad?** Fuera de alcance de esta vertical (ver §13.3, Alternativas C/D) — cuando existan (antorchas portátiles, *Darkness*/*Fog Cloud*), se resolverían anclando un `EffectInstance` a `targetCells` (patrón de hazards ya establecido) que se traduzca a los mismos campos estáticos de `Board` al construir el Snapshot, sin cambiar el contrato de consumo de `getVisionAssessment`.
5. **¿Qué transporta Snapshot y qué falta?** Snapshot ya transporta posiciones, `zFeet`, `board.lineOfEffectBlockingCells`, `effectInstances`/`targetCells` (mismo invariante de Sprint 044.2: ninguna evaluación derivada nueva). Falta el campo *fuente*, no un campo de Snapshot: iluminación estática (`Board`) y capacidad perceptiva (`Combatant`). El Snapshot los transportará por el mismo whitelist-clone ya usado para `lineOfEffectBlockingCells` (ver `combatSnapshot.ts`), una vez que existan.
6. **¿Qué debe ser derivado y nunca persistido?** `LineOfSightAssessment`/`VisionAssessment` completos (igual que `LineOfEffectAssessment`/`CoverAssessment`/`ConcealmentAssessment` hoy: puros, calculados por request, nunca guardados en `CombatRoom` ni en `EffectInstance`). Solo las *fuentes* (iluminación estática del tablero, capacidad perceptiva del combatiente) se persisten — nunca el veredicto.
7. **¿Cómo evita Vision ser otro reducer universal?** Exactamente por el mismo principio ya aplicado a Cover/LoE/Concealment: assessments especializados con nombre y forma propios, sin un `UniversalModifier`/`VisionContribution` genérico. Vision compone **dos fuentes concretas y tipadas** (iluminación de la casilla del objetivo, capacidad del observador) mediante una función pura con nombre propio (`getVisionAssessment`), no mediante un reductor declarativo genérico — el único reductor declarativo que toca Concealment sigue siendo `EffectReducer.reduceConcealmentContributions`, reservado a `EffectInstance` (Blinded, futura niebla mágica), nunca a Vision.

### 13.3. Modelo mínimo de iluminación (decisión)

| Alternativa | Evaluación |
|---|---|
| A — Estado de luz por celda (`brightLightCells`/`dimLightCells`/`darknessCells`) | Consistente con el precedente exacto de `difficultTerrainCells`/`impassableCells`/`narrowCells`/`lineOfEffectBlockingCells`. Trivial de testear, sin editor necesario (los otros cuatro campos tampoco lo tienen), sin duplicar `targetCells`. |
| B — Nivel base + overrides (`ambientLight: "bright"\|"dim"\|"dark"` + overrides) | Obliga a decidir un nivel para *todo* el tablero incluso cuando hoy no hace falta ninguno; menos consistente con el patrón "ausente = sin efecto" ya establecido. |
| C — Zonas declarativas (`LightZone { cells; level }`) | Más flexible para mapas grandes con muchas regiones, pero sin ningún consumidor ni mapa real que lo justifique hoy (los mapas actuales son de 10×10 a 16×8 celdas) — sobreingeniería para el alcance actual. |
| D — Fuentes de luz con radio (`LightSource { origin; brightRadiusFeet; dimRadiusFeet }`) | El modelo más realista para luz dinámica (antorchas portátiles), pero requiere geometría de distancia/radio que hoy no tiene ningún consumidor (no hay objeto "antorcha", no hay UI para moverlo). Sobreingeniería para la primera vertical. |

**Decisión: Alternativa A, refinada a dos campos, no tres.** Luz brillante es
el estado por defecto (igual que "transitable" es el default implícito de
`impassableCells` — no existe un `passableCells` complementario). Solo se
necesitan los dos casos que se apartan del default:

```ts
// Board (Sprint 053B, no en este sprint)
dimLightCells?: string[];   // Claves "x,y": iluminación tenue (SRD "shadowy illumination")
darknessCells?: string[];   // Claves "x,y": oscuridad total
```

Una celda ausente de ambos arrays es luz brillante por defecto — compatible
retroactivamente con **todo** mapa/fixture existente sin ningún cambio (el
`demoBoard` seguirá siendo "todo luz brillante" sin declarar nada).

**Compatibilidad con fuentes dinámicas futuras (Alternativas C/D)**: no se
cierra la puerta — un futuro modelo de zonas o fuentes con radio podría
**derivar** estos mismos dos arrays al construir el Snapshot (o en el momento
de aplicar un `EffectInstance` de luz), sin cambiar el contrato de consumo de
`getVisionAssessment` (que seguiría preguntando "¿qué nivel de luz tiene esta
celda?", sin que le importe si la respuesta vino de un array estático o de
una fuente dinámica calculada). La migración, si llega, sería aditiva, no una
reescritura.

### 13.4. Modelo mínimo de capacidades visuales (decisión)

Nuevo objeto en `Combatant`/`CombatantSnapshot`/`CreatureTemplate`, mismo
patrón exacto que `IntrinsicDefense` (rasgo permanente, catálogo-fuente, no
`EffectContribution`, no derivado de `sizeCategory`/`creatureTypeId`):

```ts
// Combatant (Sprint 053B, no en este sprint)
interface IntrinsicPerception {
  readonly lowLightVision: boolean;
  readonly darkvisionFeet: number; // 0 = sin Darkvision
}
```

Explícitamente **no** se agrega todavía: Blindsight, Blindsense, Tremorsense,
True Seeing (fuera de alcance de esta vertical, ver §13.8).

**Alcance de la primera vertical (Sprint 053B): solo Darkvision.**
Low-Light Vision, bajo el modelo de campos estáticos de §13.3 (sin radio de
fuente que duplicar), resulta mecánicamente simple de expresar (trata
`dimLightCells` como luz brillante para ese observador) — pero se difiere de
todos modos para mantener acotado el alcance de 053B, tal como exige este
sprint ("Darkvision o Low-Light Vision, pero no ambos"). Darkvision se elige
como la primera capacidad por ser el caso SRD más frecuente y dramático en
juego (mazmorras sin luz) y por tener un parámetro numérico simple
(`darkvisionFeet`) fácil de verificar contra la tabla SRD (típicamente 60 ft).
`IntrinsicPerception.lowLightVision` puede quedar declarado en el tipo desde
053B (con efecto nulo) para no requerir una segunda migración de tipo, pero
su lógica de negocio queda fuera de alcance hasta un sprint posterior.

### 13.5. Contratos conceptuales (sin implementar)

```ts
// Geometría — hermano de LineOfEffectAssessment, nunca su alias ni derivado.
interface LineOfSightAssessment {
  readonly hasLineOfSight: boolean;
  readonly blockedCellKeys: readonly string[];
}

// Composición de luz + capacidad perceptiva + geometría — no vive dentro de
// ConcealmentAssessment ni de CoverAssessment (mismo principio ya establecido
// para Vision en §3/§7.1 de este documento).
interface VisionAssessment {
  readonly canPerceiveVisually: boolean;      // el objetivo puede percibirse visualmente en absoluto
  readonly kind: ConcealmentKind;             // "none" | "partial" | "total" — reutiliza el tipo ya existente
  readonly missChancePercent: number;
  readonly directTargetingAllowed: boolean;   // mismos nombres que ConcealmentAssessment, a propósito (ver §13.6)
  readonly requiresTargetSquare: boolean;
  readonly dominantReason: string;            // motivo dominante legible (no un enum cerrado todavía — sin consumidor real que fije las categorías finales)
  readonly traces: readonly VisionTrace[];    // mismo patrón que ConcealmentTrace: fuente + estado, sin effectInstanceId (Vision no viene de un EffectInstance)
}
```

Los nombres de campo de `VisionAssessment` (`kind`, `missChancePercent`,
`directTargetingAllowed`, `requiresTargetSquare`) se eligen **idénticos** a
los de `ConcealmentAssessment` deliberadamente: no por casualidad ni por
ahorro de diseño, sino porque son la misma pregunta conceptual respondida por
una fuente distinta, y esa simetría es lo que permite componerlos por
precedencia de severidad sin lógica especial (§13.6). No se fijan campos
adicionales sin consumidor real (ej. ningún campo de "distancia de
Darkvision restante" — eso es un detalle interno de `getVisionAssessment`,
no algo que el consumidor final necesite ver).

### 13.6. Pipeline funcional

```text
Snapshot sources
├─ geometría (board.lineOfEffectBlockingCells, reutilizado provisionalmente para LoS — ver Sprint 053 §3)
├─ iluminación (board.dimLightCells / board.darknessCells)
└─ capacidades perceptivas (combatant.intrinsicPerception)
        ↓
LineOfSightAssessment (geometría pura, independiente de luz — Sprint 053B)
        ↓
VisionAssessment (LineOfSightAssessment + iluminación de la casilla objetivo + capacidad del observador)
        ↓
Composición con Concealment existente (ver más abajo)
        ↓
ConcealmentAssessment (consumido igual que hoy por Attack Resolver/UI — sin cambios de firma)
```

**Regla de decisión de `VisionAssessment.kind` (orden de evaluación,
más restrictivo gana)**:

1. Si `LineOfSightAssessment.hasLineOfSight` es `false` (obstáculo opaco
   interpuesto) → `kind: "total"`, 50%, `requiresTargetSquare: true`. Esta es
   la regla RAW citada en §13.1: LoE presente + LoS ausente = Ocultación
   Total — el caso ya bosquejado en §7.2 de este documento.
2. Si la casilla del objetivo está en `darknessCells` y la distancia al
   observador supera su `darkvisionFeet` (o el observador no tiene
   Darkvision) → `kind: "total"`, 50%, `requiresTargetSquare: true`.
3. Si la casilla del objetivo está en `dimLightCells` y el observador no
   tiene Darkvision (Low-Light Vision queda fuera de alcance en 053B, ver
   §13.4) → `kind: "partial"`, 20%, `directTargetingAllowed: true`.
4. En cualquier otro caso → `kind: "none"`.

**Cuándo Vision aporta 20% vs. 50%**: 20% (parcial, targeting directo
permitido) solo en el caso 3 (luz tenue sin capacidad adecuada); 50% (total,
debe elegirse casilla) en los casos 1 y 2 (LoS bloqueada u oscuridad más allá
del alcance perceptivo) — coincide exactamente con las bandas ya
existentes en `ConcealmentKind`/`ConcealmentAssessment`, sin inventar una
tercera banda.

**Cuándo impide targeting directo vs. cuándo aún puede atacarse una
casilla**: exactamente cuando `kind === "total"` (casos 1 y 2) —
`requiresTargetSquare: true`, `directTargetingAllowed: false`, igual
semántica que `ConcealmentAssessment` ya implementa hoy para Total
Concealment.

**Composición con Concealment existente (y con Blinded)**: `getConcealmentAssessment`
(`rules.ts:1936`) seguirá llamando a `EffectReducer.reduceConcealmentContributions`
exactamente igual que hoy (Blinded y cualquier futura niebla mágica declarativa
siguen ahí, sin tocarse). `composeConcealmentAssessment` (o una capa
inmediatamente posterior, a decidir en la implementación de 053B) recibirá
además el `VisionAssessment` ya calculado y compondrá el resultado final
tomando la **severidad máxima** entre ambas fuentes (total > parcial > none),
igual que el reductor interno ya hace entre múltiples `ConcealmentContribution`
por precedencia — sin ninguna regla especial de interacción entre Blinded y
Vision: si el atacante está cegado, su contribución (`total`, incondicional)
ya domina cualquier resultado que Vision calcule para ese mismo ataque, sin
necesitar código que verifique explícitamente "si Blinded, ignorar Vision".

**Qué ocurre si una fuente ya produce ocultación total**: nada especial — la
composición por máxima severidad ya es idempotente ante múltiples fuentes en
`"total"` simultáneamente (ej. objetivo invisible **y** en oscuridad: sigue
siendo `"total"`, no se duplica el 50% ni se suma).

**Qué sigue fuera de alcance**: Blindsight/Blindsense (ignorarían Vision por
completo, vía su propio trait, sin pasar por este pipeline — diseño
diferido), Low-Light Vision (§13.4), niebla/oscuridad mágica dinámica
(§13.3), altura/`zFeet` en la geometría de LoS (misma simplificación
documentada que ya tiene LoE), facing.

### 13.7. Riesgos y alternativas descartadas

- **Riesgo**: introducir `IntrinsicPerception`/campos de `Board` sin
  consumidor completo si 053B queda a medio implementar. Mitigación: 053B
  debe entregar la vertical completa (geometría + luz + Darkvision +
  composición con Concealment + tests autoritativos) en un único sprint, no
  fragmentado — igual disciplina que ya se aplicó a Sprint 052B.
- **Alternativa descartada**: inyectar Vision directamente dentro de
  `EffectReducer.reduceConcealmentContributions` (ej. sintetizando un
  `EffectInstance` ficticio). Descartada: violaría la invariante de que ese
  reductor opera solo sobre efectos declarativos reales con
  `effectInstanceId` trazable (`reducer.ts:69-92`), y acoplaría geometría de
  tablero dentro del sistema de ActiveEffects sin necesidad.
- **Alternativa descartada**: derivar capacidad perceptiva de
  `creatureTypeId`/`sizeCategory`. Descartada en §13.2, pregunta 1 — ninguno
  de los dos discrimina razas dentro de un mismo tipo de criatura.
- **Riesgo aceptado y documentado**: la regla de "elegir una casilla" bajo
  Ocultación Total ya existe en el contrato (`requiresTargetSquare`) pero su
  UI/flujo de selección de casilla a ciegas no se audita en este documento —
  queda expresamente para la implementación de 053B decidir cómo el cliente
  presenta esa elección, sin bloquear el diseño del assessment.

### 13.8. Preguntas abiertas (heredadas o nuevas)

1. ¿`Low-Light Vision` se implementa como parte de 053B una vez que resultó
   mecánicamente simple bajo el modelo de §13.3, o se reserva para un
   micro-sprint propio inmediatamente posterior? No se decide aquí — es una
   decisión de alcance para el `Proceed` de 053B, no de este diseño.
2. ¿La "distancia" para comparar contra `darkvisionFeet` (regla 2 de §13.6)
   usa la misma función de distancia en pies ya existente
   (`distanceBetweenFootprintsFeet`/`distanceFeet`) o requiere una geometría
   propia? Hipótesis de trabajo: reutilizar la existente, sin auditoría
   adicional — a confirmar en la implementación.
3. ¿`dominantReason` (§13.5) debe convertirse en un enum cerrado una vez que
   053B tenga consumidores reales, o basta con un string libre indefinidamente
   (mismo patrón que `labelParts` en `ConcealmentAssessment`)? Diferido a la
   implementación.
4. Todas las preguntas ya abiertas en §8 de este documento que no fueron
   resueltas por Sprint 053A siguen abiertas sin cambios (granularidad de luz
   por zona vs. celda para mapas grandes, forma de `TargetingAssessment`,
   etc.).

### 13.9. Alcance exacto propuesto para Sprint 053B (implementación)

**Incluye:**

1. `Board.dimLightCells?`/`Board.darknessCells?` (§13.3, dos campos).
2. `Combatant.intrinsicPerception?: IntrinsicPerception` con
   `darkvisionFeet` funcional; `lowLightVision` puede declararse en el tipo
   sin lógica de negocio (ver §13.4).
3. `LineOfSightAssessment`/`getLineOfSight`, reutilizando
   `traversedCellKeysBetween` (extracción pequeña y pura, sin alterar el
   comportamiento ya probado de `getLineOfEffect`) y, provisionalmente,
   `board.lineOfEffectBlockingCells` como fuente de bloqueadores (decisión ya
   tomada en Sprint 053, §3 — no se reabre aquí).
4. `VisionAssessment`/`getVisionAssessment`, implementando la regla de
   decisión de §13.6.
5. Composición con `ConcealmentAssessment` existente por severidad máxima
   (§13.6), sin tocar `EffectReducer.reduceConcealmentContributions`.
6. Targeting directo vs. casilla, consumiendo los campos ya existentes de
   `ConcealmentAssessment` (`directTargetingAllowed`/`requiresTargetSquare`)
   — sin contrato de targeting nuevo.
7. Tests autoritativos: geometría de `getLineOfSight` (matriz reducida o
   compartida con `getLineOfEffect` solo si no acopla las reglas — ver
   restricción explícita de Sprint 053 de no duplicar ciegamente los 29
   casos), `getVisionAssessment` (luz × capacidad × geometría), composición
   con Blinded (regresión), integración de servidor si corresponde a un
   consumidor real (a decidir en 053B según si ya conecta a Attack Resolver).
8. Rule ID nueva **solo si** 053B efectivamente conecta esta vertical a un
   consumidor de juego real (ej. Attack Resolver vía Concealment) — si
   queda como infraestructura pura sin consecuencia observable, no se abre
   Rule ID todavía (misma política que Sprint 053 aplicó a Line of Sight).

**Excluye explícitamente:**

Blindsight, Blindsense, Tremorsense, True Seeing, invisibilidad, niebla,
conjuros concretos (*Darkness*, *Fog Cloud*, *Obscuring Mist*), UI de Fog of
War, editor de iluminación, AoE, altura/`zFeet`, facing, Low-Light Vision
(salvo que 053B decida explícitamente incluirlo, ver §13.8 pregunta 1),
fuentes de luz dinámicas/con radio (§13.3, Alternativa D), zonas
declarativas (§13.3, Alternativa C).
