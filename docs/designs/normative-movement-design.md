# Normative Movement Design (D-1B)

Responsabilidad: Definir los contratos normativos comunes del movimiento: modelo abstracto, legalidad, coste, acciones consumidoras y ciclo lógico de resolución.
Autoridad: Canónica
Lifecycle: Diseño
Reemplaza: —
Complementa: `docs/designs/normative-spatial-geometry.md`, `docs/designs/normative-area-shape-projection.md`, `docs/designs/spatial-engine-2.5d.md`
Consumidores: Capítulos posteriores de D-1B y cualquier sistema que necesite expresar movimiento sin depender de acciones, pathfinding o presentación.

---

## Capítulo 1 — Modelo abstracto de movimiento

### 1.1 Propósito y alcance

Este capítulo define el vocabulario mínimo con el que el motor representa un movimiento. Responde exclusivamente a la pregunta:

> ¿Qué significa “moverse” dentro del motor?

La respuesta es conceptual. No establece contratos de código, estructuras persistidas, algoritmos, validaciones ni consecuencias de reglas. Las posiciones que participan del movimiento son identidades provistas por el modelo espacial canónico; este capítulo no redefine su representación.

### 1.2 Vocabulario normativo

- **Movement (Movimiento):** cambio ordenado de posición de una entidad, expresado mediante una Route.
- **Step (Paso):** relación ordenada entre dos posiciones adyacentes: una posición de origen y una posición de destino.
- **Route (Ruta):** secuencia ordenada y contigua de Steps que expresa un Movement completo.
- **Movement Cost (Coste de Movimiento):** magnitud en pies consumida por un Step o acumulada por una Route.

Estos conceptos describen el movimiento en sí. No determinan quién lo origina, qué acción lo permite, si es legal ni qué consecuencias produce.

### 1.3 Movement

Un Movement existe cuando una entidad cambia de posición siguiendo una Route.

Normativamente:

1. tiene una posición de origen;
2. tiene una posición de destino;
3. conserva el orden de todos los Steps recorridos;
4. posee un Movement Cost acumulado;
5. no incorpora por sí mismo economía de acciones, modo de desplazamiento, legalidad ni efectos secundarios.

El Movement es, por tanto, una descripción ordenada de desplazamiento. Los sistemas consumidores pueden evaluarlo o utilizarlo, pero no alteran su significado básico.

### 1.4 Step

Un Step conecta exactamente dos posiciones adyacentes:

- la posición desde la que se parte;
- la posición adyacente a la que se llega.

La adyacencia es una precondición provista por el modelo espacial. Este capítulo no define cómo se representa ni cómo se comprueba.

Un Step puede modificar uno o varios ejes espaciales simultáneamente:

- es **ortogonal** cuando modifica exactamente un eje;
- es **diagonal** cuando modifica más de un eje en el mismo Step.

No existen categorías de coste diferentes según cambien dos, tres o más ejes. Para este modelo, todo Step que modifica más de un eje es diagonal. Esta clasificación no determina por sí sola que el Step sea legal ni establece un modo de desplazamiento.

### 1.5 Regla de Movimiento Diagonal

El proyecto adopta la siguiente regla normativa para el coste no modificado de los Steps:

- cada Step ortogonal cuesta **5 ft**;
- los Steps diagonales de una Route siguen, en su orden de aparición, el patrón **5 / 10 / 5 / 10... ft**;
- el primer Step diagonal cuesta 5 ft, el siguiente Step diagonal cuesta 10 ft y la alternancia continúa durante la Route;
- los Steps ortogonales no consumen ni reinician la alternancia diagonal;
- el coste diagonal depende exclusivamente de que el Step sea diagonal y de su lugar entre los Steps diagonales de la Route;
- el coste no depende de cuántos ejes cambien simultáneamente dentro del Step.

Este capítulo fija la regla, pero no prescribe la representación interna del conteo ni el algoritmo que la evaluará.

### 1.6 Route

Una Route contiene:

1. una posición de origen;
2. una secuencia ordenada de Steps;
3. una posición de destino;
4. un Movement Cost acumulado.

La secuencia es contigua: el destino de cada Step coincide con el origen del Step siguiente. El origen de la Route coincide con el origen de su primer Step y el destino de la Route coincide con el destino de su último Step.

Una Route describe el recorrido elegido; no lo descubre. Por ello, no es un algoritmo de búsqueda, no selecciona alternativas y no declara que el recorrido sea válido.

### 1.7 Movement Cost

El Movement Cost total de una Route es la suma del coste de cada uno de sus Steps, respetando el orden de la Route y la Regla de Movimiento Diagonal.

En este capítulo, Movement Cost significa exclusivamente coste de desplazamiento no modificado. No incorpora multiplicadores, recargos, reducciones ni prohibiciones procedentes de otras reglas.

Movement Cost y Spatial Distance conservan responsabilidades distintas:

- Movement Cost mide cuánto cuesta recorrer una Route concreta;
- Spatial Distance mide separación espacial con independencia de una Route.

Este capítulo no redefine ni resuelve Spatial Distance.

### 1.8 Principios arquitectónicos

El modelo abstracto de movimiento es:

- **Determinista:** la misma Route ordenada produce el mismo Movement Cost no modificado.
- **Independiente del renderer:** ninguna decisión visual participa en su significado o coste.
- **Independiente del pathfinding:** un buscador puede producir Routes candidatas, pero no define Movement, Step ni Movement Cost.
- **Independiente de las acciones:** las acciones pueden consumir o restringir Movement, pero no lo redefinen.
- **Independiente de la legalidad:** describir una Route no implica que pueda ejecutarse.
- **Consumible:** cualquier sistema puede usar la misma Route y su mismo coste sin reconstruir el movimiento desde otra representación.
- **Ordenado:** el orden de los Steps es parte normativa del Movement y no puede descartarse.
- **Agnóstico al origen:** el concepto no cambia según qué sistema solicite o produzca el desplazamiento.

### 1.9 Límites del capítulo

Quedan expresamente fuera de este capítulo las acciones, los modos y modificadores de desplazamiento, el movimiento forzado, las reacciones, la topología de soporte, la búsqueda de rutas, la ocupación corporal, las validaciones, la persistencia y las evaluaciones de percepción o trazado.

Los capítulos posteriores podrán consumir Movement, Step, Route y Movement Cost, pero no deberán crear definiciones alternativas de estos cuatro conceptos.

### 1.10 ODR

Este capítulo no abre ninguna ODR nueva. La ODR preexistente sobre Spatial Distance tridimensional permanece fuera de alcance y sin cambios, porque Movement Cost y Spatial Distance no son intercambiables.

---

## Capítulo 2 — Normative Route Validation

### 2.1 Propósito y alcance

Este capítulo responde exclusivamente a la pregunta:

> ¿Cuándo una Route es legal?

Una Route es legal cuando su secuencia completa conserva continuidad y cada uno de sus Steps constituye, en su orden, una transición legal desde la posición alcanzada por el Step anterior.

La legalidad definida aquí es un veredicto normativo sobre una Route ya expresada. No descubre recorridos, no calcula su coste, no consume economía de acciones y no produce consecuencias sobre el estado del combate.

### 2.2 Bases normativas

Este contrato se apoya en tres autoridades existentes sin redefinirlas:

- **[D-1R1](normative-spatial-geometry.md)** aporta las identidades espaciales explícitas que este contrato consume como dependencia normativa (Anchored Spatial Position, Volumetric Spatial Coordinate, Surface y Connection) y exige evaluación pura sobre estado inmutable. No se redefine ninguna de estas primitivas.
- **[D-1A](normative-area-shape-projection.md)** preserva la distinción entre una progresión ordenada por ruta y una proyección geométrica directa.
- **[D-1B-Research](../audits/movement-rules-audit.md)** confirma que la validación de movimiento se evalúa incrementalmente y que la legalidad del recorrido no puede deducirse únicamente de sus extremos.

Este capítulo toma esas premisas como entradas. No amplía sus modelos espaciales ni sus reglas particulares.

### 2.3 Route bajo validación

Para validar una Route se consideran normativamente:

1. su posición de origen;
2. su secuencia ordenada de Steps;
3. su posición de destino;
4. la entidad cuyo movimiento describe;
5. un único CombatRulesSnapshot de referencia.

La Route permanece siendo la secuencia ordenada y contigua definida en el Capítulo 1. La validación no altera su orden, no inserta Steps omitidos y no sustituye el recorrido declarado por otro.

### 2.4 Validación incremental Step-by-Step

La legalidad se determina recorriendo conceptualmente los Steps en su orden declarado.

Para cada Step:

1. su origen debe coincidir con la posición alcanzada hasta ese punto de la Route;
2. su destino debe ser adyacente a su origen;
3. la transición entre ambas posiciones debe ser legal bajo el mismo CombatRulesSnapshot de referencia;
4. solo un Step legal permite considerar alcanzada su posición de destino para evaluar el Step siguiente.

La validación incremental no implica ejecución parcial. Es una forma de componer el veredicto de la Route sin mutar el estado del combate.

### 2.5 Legalidad de un Step

Un Step es legal dentro de una Route cuando satisface simultáneamente estas condiciones:

- **Origen esperado:** comienza exactamente en la posición que la Route ha alcanzado antes de ese Step.
- **Adyacencia:** conecta posiciones adyacentes según el modelo espacial canónico.
- **Continuidad:** no omite ninguna posición intermedia ni presupone un desplazamiento no expresado.
- **Transición permitida:** el cambio de posición está permitido por las restricciones normativas aplicables al movimiento en el CombatRulesSnapshot de referencia.
- **Rol ordinal válido:** satisface las restricciones que correspondan a su lugar dentro de la Route, incluida su condición de Step intermedio o final.

Este capítulo define cómo se compone la legalidad, no el inventario de restricciones concretas que capítulos posteriores puedan aplicar a un Step.

### 2.6 Continuidad y ausencia de saltos

Una Route es continua si, para cada par consecutivo de Steps, el destino del primero coincide exactamente con el origen del segundo.

Por lo tanto:

- ningún Step puede comenzar desde una posición distinta de la última posición alcanzada;
- ninguna posición intermedia necesaria puede quedar implícita;
- la legalidad del destino no vuelve legales Steps omitidos;
- dos extremos válidos no bastan para demostrar que la Route entre ellos sea legal.

Una discontinuidad vuelve ilegal la Route completa.

### 2.7 Reachability mediante transiciones legales

Una posición de destino es reachable por una Route si y solo si existe una secuencia continua de Steps legales que parte del origen de la Route y termina en ese destino.

Reachability es, en este capítulo, una propiedad demostrada por la Route concreta. No equivale a cercanía, distancia espacial ni posibilidad abstracta de llegar por algún recorrido diferente.

Si un Step es ilegal, su destino no se considera alcanzado y ningún Step posterior puede apoyarse normativamente en él. La Route presentada recibe entonces un veredicto de ilegalidad como unidad completa.

### 2.8 Inmutabilidad sobre CombatRulesSnapshot

Toda la Route se valida contra un único CombatRulesSnapshot de referencia, que permanece inmutable durante la evaluación.

La posición alcanzada después de cada Step es una proyección local de la propia Route, no una mutación del CombatRulesSnapshot. En consecuencia:

- validar una Route no desplaza a la entidad;
- validar un Step no compromete ni aplica los Steps anteriores;
- una Route ilegal no deja movimiento parcial ni estado residual;
- repetir la validación con la misma Route y el mismo CombatRulesSnapshot produce el mismo veredicto.

La ejecución y cualquier cambio efectivo de estado pertenecen a una responsabilidad posterior y separada.

### 2.9 Independencia respecto de Movement Cost

La legalidad de una Route no depende de su Movement Cost.

Una Route puede ser legal aunque su coste acumulado supere un límite disponible, y puede ser ilegal aunque su coste sea bajo. El cálculo de coste definido en el Capítulo 1 y la validación definida en este capítulo son evaluaciones separadas que pueden consumir la misma secuencia ordenada de Steps.

Este capítulo no calcula, modifica ni compara Movement Cost.

### 2.10 Independencia respecto de la economía de acciones

La legalidad de una Route no determina si una entidad puede dedicar recursos de turno a recorrerla ni qué clase de operación podría solicitarla.

La economía de acciones puede decidir si una Route legal puede ejecutarse en un contexto concreto, pero no redefine continuidad, adyacencia, legalidad de Step ni Reachability.

Por ello, el mismo contrato de Route Validation permanece consumible por cualquier sistema sin incorporar reglas propias de una acción.

### 2.11 Veredicto normativo

Una Route es **legal** únicamente cuando:

1. su origen corresponde a la posición de partida observada en el CombatRulesSnapshot;
2. todos sus Steps son continuos;
3. todos sus Steps son legales en su orden;
4. su destino coincide con la posición alcanzada por el último Step;
5. la evaluación completa no requiere mutar el CombatRulesSnapshot.

Si cualquiera de estas condiciones falla, la Route presentada es **ilegal**. Un prefijo legal puede explicar hasta dónde se sostuvo la evaluación incremental, pero no convierte la Route completa en una ejecución parcial.

### 2.12 Autoridad y previews

La validación normativa de una Route pertenece exclusivamente al modelo autoritativo del servidor, ya definido por la arquitectura general (`RULES_ENGINE`).

Los clientes pueden reutilizar helpers compartidos para calcular predicciones locales (previews), pero dichos previews nunca sustituyen ni evaden la validación autoritativa final que realiza el servidor sobre su propio snapshot inmutable.

### 2.13 Límites y ODR

Este capítulo no define reglas particulares de coste, modos de desplazamiento, acciones, reacciones, percepción, trazado ni generación de rutas. Tampoco prescribe contratos de software o algoritmos de evaluación.

No se abre ninguna ODR nueva. Las ODR preexistentes de los documentos complementarios permanecen fuera de alcance y sin cambios.

---

## Capítulo 3 — Normative Movement Cost & Modifiers

### 3.1 Propósito y alcance

Este capítulo responde exclusivamente a la pregunta:

> ¿Cuánto presupuesto de movimiento consume una Route que ya fue declarada legal?

La entrada normativa es una Route legal conforme al Capítulo 2. El resultado es una evaluación de coste expresada en pies, desglosada por Step y contrastable con uno o más Movement Budgets aplicables.

Este capítulo no vuelve a validar la topología de la Route, no autoriza una acción, no ejecuta el Movement y no muta el CombatRulesSnapshot. `Spatial Distance` y `Route Cost` permanecen como magnitudes distintas: la primera mide separación espacial; la segunda acumula el coste normativo de transiciones concretas.

Sus bases son los Capítulos 1–2, [D-1R1](normative-spatial-geometry.md), [D-1A](normative-area-shape-projection.md) y el [Research D-1B](../audits/movement-rules-audit.md). D-1R1 y D-1A aportan identidad y geometría espacial sin convertirse en una fórmula alternativa de Route Cost; el Research aporta las reglas RAW de coste auditadas.

### 3.2 Movement Budget

Un **Movement Budget (Presupuesto de Movimiento)** es una cantidad de pies que un consumidor tiene disponible para costear Movement dentro de un contexto normativo determinado.

Normativamente:

1. el presupuesto se expresa en pies;
2. su fuente puede ser una velocidad efectiva u otra autorización externa al cálculo de Route Cost;
3. el presupuesto existe antes de comparar el coste de la Route y no se deriva de ese coste;
4. el cálculo de Route Cost no consume ni modifica materialmente el presupuesto;
5. la comparación informa si el presupuesto es suficiente, pero no decide por sí misma economía de acciones ni aplica gasto alguno.

**Speed** y **Route Cost** no son sinónimos. Speed aporta capacidad de movimiento; Route Cost expresa cuánto de esa capacidad requeriría una Route concreta. Una Route legal puede resultar demasiado costosa para el presupuesto disponible. Esa insuficiencia impide costearla bajo el presupuesto evaluado, pero no la vuelve topológicamente ilegal.

### 3.3 Base Step Cost

El **Base Step Cost** es el coste inicial de un Step antes de considerar contribuciones aplicables.

Con la celda táctica canónica de 5 pies:

- un Step ortogonal cuesta **5 ft**;
- un Step puramente vertical es ortogonal y cuesta **5 ft**;
- un Step diagonal aplica **Movimiento Diagonal**, nombre normativo único de la regla adoptada por el proyecto;
- una diagonal en cualquier plano válido sigue la misma regla;
- un Step que cambia dos o tres ejes simultáneamente sigue siendo una única diagonal.

El coste no se obtiene sumando costes independientes por eje. Un cambio simultáneo en `x`, `y` y `z` no representa tres unidades de coste: representa un único Step diagonal.

Este contrato no utiliza `Spatial Distance 3D` para calcular Route Cost y no altera la ODR preexistente sobre la métrica de distancia espacial.

### 3.4 Contexto diagonal por turno

Cada combatiente mantiene durante su turno un estado conceptual equivalente a `normalDiagonalStepsThisTurn`. El contador de pasos diagonales normales pertenece al contexto de movimiento del turno, no a una Route individual ni a una acción.

1. El contador comienza en 0 al iniciar el turno del combatiente.
2. Persiste entre diferentes Routes, acciones (Move, Double Move, etc.) y segmentos de movimiento.
3. Se reinicia únicamente al comenzar un nuevo turno del combatiente.
4. Solo los pasos diagonales que utilizan el patrón ordinario modifican el contador.

Para cada diagonal normal ejecutada, el contador se incrementa en uno:
- si el contador es impar, el Step cuesta **5 ft**.
- si el contador es par, el Step cuesta **10 ft**.

Ejemplo:
- Diagonal normal del turno 1: 5 ft
- Diagonal normal del turno 2: 10 ft
- Diagonal normal del turno 3: 5 ft
- Diagonal normal del turno 4: 10 ft

El contador depende exclusivamente de que el Step sea diagonal normal. No depende del plano, del número de ejes modificados (X/Y, X/Z, Y/Z, X/Y/Z) ni de la dirección del desplazamiento. Un Step diagonal sigue siendo una sola unidad y no se calcula un coste separado por eje.

Los pasos puramente ortogonales cuestan 5 ft en terreno normal y no modifican el contador diagonal. Esto aplica a desplazamientos horizontales y verticales legales.

### 3.5 Contribuciones al coste de Step

El coste de un Step puede recibir contribuciones normativas después de determinar su Base Step Cost. Una contribución describe por qué una regla afecta el coste; no constituye por sí misma una regla base de movimiento ni una fórmula universal.

Las familias conceptuales de contribuciones son:

- **entorno:** terreno, visibilidad obstaculizada u otras propiedades externas que encarezcan el tránsito;
- **modo de desplazamiento:** requisitos de coste propios del modo empleado para recorrer el Step;
- **estado de la criatura:** condiciones o configuraciones corporales que alteren cuánto movimiento consume;
- **restricción de una operación futura:** una operación consumidora puede limitar o prohibir una Route sin reescribir su coste base.

Toda contribución aplicable debe ser determinista, indicar su fuente normativa, delimitar los Steps afectados y conservar evidencia suficiente para explicar el resultado. Ninguna contribución puede cambiar retrospectivamente la continuidad, adyacencia o Reachability ya resueltas por Route Validation.

### 3.6 Terreno difícil

Para una Route ordinaria afectada por terreno difícil, el coste se determina por tipo de Step y por el terreno cruzado:

- un Step ortogonal afectado cuesta **10 ft**;
- un Step diagonal afectado cuesta **15 ft**.

Una diagonal sometida al coste fijo de terreno difícil no participa del patrón ordinario de Movimiento Diagonal. Su coste normativo es siempre 15 ft y conserva sin cambios la paridad previa del contador de diagonales normales del turno.

Sigue siendo un Step diagonal (a diferencia de un ortogonal), pero utiliza una categoría de coste especial que:
- no utiliza el patrón 5/10;
- no incrementa el contador de diagonales normales;
- no modifica su paridad;
- no existe alternancia 15/20.

Ejemplo:
- Step 1 (Diagonal difícil): 15 ft. Contador posterior: 0.
- Step 2 (Diagonal normal): 5 ft. Contador posterior: 1.
- Step 3 (Diagonal normal): 10 ft. Contador posterior: 2.
- Step 4 (Diagonal difícil): 15 ft. Contador posterior: 2.
- Step 5 (Diagonal normal): 5 ft. Contador posterior: 3.

Este capítulo fija la norma de coste. No declara corregido el comportamiento de ninguna implementación existente ni define prohibiciones particulares de acciones que atraviesen terreno difícil.

### 3.7 Semánticas de alteración de coste

Las reglas que afecten Movement Cost deben conservar la semántica normativa con la que alteran el Step. Este capítulo distingue:

- **adición:** añade una cantidad explícita de pies al coste aplicable;
- **multiplicación:** escala un coste o conteo conforme al alcance declarado por su fuente;
- **reemplazo:** sustituye una regla de cálculo aplicable por otra regla;
- **coste fijo:** establece una cantidad absoluta para el Step afectado;
- **prohibición:** declara que el tránsito no puede costearse bajo la operación o contexto evaluados.

Una prohibición no es un coste infinito ni una cifra artificial. Tampoco convierte por sí sola una Route topológicamente legal en ilegal: expresa que el consumidor evaluado no puede recorrerla bajo esa restricción.

No existe una conversión automática entre estas semánticas. En particular, un multiplicador no debe degradarse a un delta opaco, y un coste fijo no debe reinterpretarse como un multiplicador si la regla normativa no lo dice.

### 3.8 Composición de fuentes de coste y regla RAW de Double Movement Cost

Una misma Route puede quedar afectada por más de una fuente de coste. El assessment debe conservar cada contribución por separado y no puede ocultar su procedencia dentro de un total sin desglose.

#### 3.8.1 Excepción RAW para multiplicaciones de Movement Cost (Double Movement Cost)
D&D 3.5 establece una regla de cálculo general (PHB pág. 304 / SRD) según la cual dos duplicaciones se combinan como una triplicación (×2 + ×2 = ×3). Sin embargo, **las reglas de movimiento y terreno (PHB pág. 148 / SRD "Hampered Movement") contienen una excepción explícita para Movement Cost**:

> *Movement Cost Doubling Exception (D&D 3.5 RAW):*
> Cuando el coste de movimiento se duplica por dos o más factores simultáneos (como terreno difícil, visibilidad pobre, obstáculos o acrobacias), cada duplicación multiplica sucesivamente por dos el coste en casillas:
> - Una duplicación: cada casilla cuenta como 2 casillas (×2).
> - Dos duplicaciones: cada casilla cuenta como 4 casillas (×4).
> - Tres duplicaciones: cada casilla cuenta como 8 casillas (×8).
> - Cuatro duplicaciones: cada casilla cuenta como 16 casillas (×16).

**NO se aplica la regla de adición de multiplicadores (×2 + ×2 = ×3) a Movement Cost.** Las duplicaciones de movimiento se multiplican entre sí.

#### 3.8.2 Movimiento diagonal bajo condiciones obstaculizadas (Hampered Diagonal Movement) vs Acrobacias
Conforme a D&D 3.5 RAW (PHB pág. 148 / SRD):
- Una casilla diagonal normal cuenta como 1 casilla (5 ft) o 2 casillas (10 ft) alternadas, incrementando la paridad del turno.
- **Fuentes reales de movimiento obstaculizado (True Hampering Sources):**
  - **Terreno Difícil (DT):** ortogonal 10 ft; diagonal cuenta exactamente como **3 casillas fijas (15 ft)** y **no altera la paridad** (`normalDiagonalStepsThisTurn` intacto).
  - **Compresión (Squeezing):** ortogonal 10 ft; diagonal cuenta exactamente como **3 casillas fijas (15 ft)** y **no altera la paridad** (`normalDiagonalStepsThisTurn` intacto).
- **Acrobacias / Tumble aislado (Tumble-only):**
  - RAW formula Tumble como restricción de velocidad ("one-half normal speed").
  - Su representación isomórfica mediante coste en el motor duplica el coste normal del paso sin alterar la regla geométrica/ordinal de las diagonales:
    - Ortogonal: 5 ft × 2 = **10 ft**.
    - Diagonal normal: 5 ft / 10 ft alternado se duplica a **10 ft / 20 ft**, y **continúa participando e incrementando la paridad** (`normalDiagonalStepsThisTurn`).
    - Tumble aislado **NO es una diagonal hampered fija de 15 ft**.
- **Composición de Tumble con fuentes de movimiento obstaculizado (Tumble + Hampering):**
  - Cuando Tumble coincide con una fuente real que ya obstaculiza el movimiento (DT o Squeezing), la restricción equivalente de mitad de velocidad vuelve a duplicar el coste impedido resultante:
    - **Tumble + Terreno Difícil:** ortogonal **20 ft**; diagonal **30 ft** fijos (6 casillas); paridad: NO.
    - **Tumble + Squeezing:** ortogonal **20 ft**; diagonal **30 ft** fijos (6 casillas); paridad: NO.
    - **Terreno Difícil + Squeezing:** ortogonal **20 ft**; diagonal **30 ft** fijos (6 casillas); paridad: NO.
    - **Tumble + Terreno Difícil + Squeezing:** ortogonal **40 ft**; diagonal **60 ft** fijos (12 casillas); paridad: NO.

Cuando un Step diagonal involucra al menos una fuente real de movimiento obstaculizado (DT o Squeezing), su coste es fijo (15 ft, 30 ft, 60 ft) y preserva sin alterar el contador `normalDiagonalStepsThisTurn`.

#### 3.8.3 Resolución formal de ODR D-1B-C3-01
Habiéndose ratificado formalmente mediante Owner Decision la primacía de D&D 3.5 RAW sobre el stacking de duplicaciones de Movement Cost:
- **ODR D-1B-C3-01 queda RESUELTA y CERRADA** para todas las combinaciones compuestas por múltiples duplicaciones de coste de movimiento (Difficult Terrain, Squeezing, Tumble-equivalent, etc.).
- Las combinaciones que impliquen adiciones no multiplicativas, reemplazos heterogéneos o prohibiciones categóricas no cubiertas por RAW continúan delimitándose por sus respectivas reglas específicas sin reabrir esta ODR.

### 3.9 Footprint efectivo y coste

El coste se evalúa sobre la entidad que recorre el Step, no solo sobre su ancla. Para cada Step deben considerarse todas las celdas del **Footprint efectivo** que la entidad ocupa en el destino o en la transición cuando la regla normativa aplicable así lo requiera.

Cuando distintas celdas del Footprint efectivo estén sujetas a costes de terreno diferentes, el Step adopta el coste de terreno aplicable más alto. Los costes no se suman una vez por cada celda corporal ocupada.

Esta evaluación usa la distinción canónica entre Footprint natural y Footprint efectivo. No define geometría corporal, no persiste huellas derivadas y no afirma que exista validación continua de **Swept Volume**; esa extensión permanece fuera de alcance.

### 3.10 Coste de Squeezing

Mientras una entidad se desplaza legalmente con un Footprint efectivo de Squeezing, cada espacio recorrido cuenta como el doble (2 casillas) para Movement Cost (D&D 3.5 RAW).

Por tanto, Squeezing aporta exactamente **una duplicación (×2) de Movement Cost** sobre los Steps afectados.
- En pasos ortogonales puros: base 5 ft × 2 = **10 ft**.
- En pasos diagonales bajo Squeezing sin otros impedimentos: Squeezing constituye una condición de movimiento obstaculizado (Hampered Movement) conforme a RAW; la diagonal cuenta como 3 casillas fijas (**15 ft**) y **no altera la paridad ni el contador `normalDiagonalStepsThisTurn`**.
- Cuando Squeezing coincide con otras fuentes de duplicación (Terreno Difícil o Tumble-equivalent), se compone conforme a la regla RAW de Double Movement Cost (§3.8.1 y §3.8.2):
  - Ortogonal con 2 duplicaciones: base 5 ft × 4 = **20 ft**.
  - Diagonal con 2 duplicaciones: 6 casillas = **30 ft** (coste fijo, no altera paridad normal).
  - Ortogonal con 3 duplicaciones: base 5 ft × 8 = **40 ft**.
  - Diagonal con 3 duplicaciones: 12 casillas = **60 ft** (coste fijo, no altera paridad normal).

Este capítulo no decide cuándo Squeezing es legal, cómo se deriva su Footprint efectivo, qué penalizadores aplica a ataques o defensa ni cómo se resuelve el tránsito por un espacio menor que la mitad de la anchura natural. La variante que requiere Escape Artist permanece como dependencia futura.

### 3.11 Modos de desplazamiento y presupuestos

Los modos terrestres, Climb, Swim, Fly y Burrow representan capacidades de desplazamiento distintas. Cada modo puede tener su propia fuente de Speed y, por tanto, su propio Movement Budget aplicable.

Una Route puede requerir uno o varios modos a lo largo de sus Steps. El assessment debe identificar qué modo o modos requiere cada tramo y comparar el coste con el presupuesto correspondiente, sin asumir que los presupuestos de modos diferentes son intercambiables.

La existencia de presupuesto no autoriza una transición. La legalidad del modo, el cambio entre posiciones ancladas y volumétricas y el uso de Connections pertenecen a Route Validation o a capítulos futuros. Este capítulo no define maniobrabilidad aérea, pruebas de habilidad, transiciones entre modos ni fórmulas particulares de Climb, Swim, Fly o Burrow.

### 3.12 Obstáculos y movimiento obstaculizado

El modelo de coste debe poder recibir hechos normativos que encarezcan el movimiento sin convertirlos automáticamente en bloqueadores topológicos. Entre las fuentes reconocidas por el Research se encuentran:

- obstáculos no bloqueantes que añaden coste;
- mala visibilidad que produce movimiento obstaculizado;
- impedimenta, carga transportada y armadura cuando alteran la Speed disponible;
- Hazards cuyo contrato normativo establezca un coste de tránsito;
- propiedades de terreno o de una transición espacial que afecten Steps concretos.

La responsabilidad se mantiene separada:

- D-6 y el modelo espacial determinan qué obstáculos o volúmenes ambientales existen y qué Steps afectan;
- Vision y su arquitectura futura aportan el hecho perceptivo aplicable, sin calcular Movement Cost por separado;
- Equipment y las reglas de características aportan la Speed efectiva o sus restricciones, sin recalcular la Route;
- este capítulo consume esos hechos como presupuesto o contribuciones trazables y produce un único assessment de coste.

No se definen aquí objetos ambientales concretos, sensores, cargas, armaduras, checks ni reglas de interacción.

### 3.13 Movement Cost Assessment

El Cost Assessment debe poder recibir conceptualmente el estado diagonal inicial del turno y proyectar el estado resultante sin mutarlo. El resultado conceptual de evaluar una Route legal debe contener, como mínimo:

1. el coste total de la Route en pies;
2. el coste de cada Step;
3. el Base Step Cost y las contribuciones aplicadas a cada Step;
4. el modo o los modos de desplazamiento requeridos;
5. el estado proyectado del contador diagonal tras la Route;
6. la fuente y evidencia normativa de cada contribución;
7. el Movement Budget considerado para cada modo aplicable;
8. un veredicto de presupuesto suficiente o insuficiente;
9. cualquier prohibición normativa aplicable al consumidor evaluado.

El assessment es proyectivo, determinista y auditable. No ejecuta el Movement, no descuenta presupuesto, no cambia la posición y no muta el CombatRulesSnapshot. Si una combinación cae dentro de una ODR bloqueante todavía no ratificada, no debe fabricarse un total autoritativo para esa combinación.

### 3.14 Autoridad y previews

El servidor produce el assessment final sobre su Route y su CombatRulesSnapshot autoritativos.

La UI puede consumir las mismas reglas compartidas para anticipar costes, contribuciones y suficiencia de presupuesto. El preview debe mostrar el mismo desglose y usar el mismo cálculo, pero no puede confirmar de forma autoritativa el gasto, la ejecución ni el resultado final.

No se permiten fórmulas paralelas de coste por acción, resolver o frontend. Las operaciones futuras consumen el assessment común y agregan únicamente sus propias restricciones externas.

### 3.15 Invariantes normativos

1. Una Route legal puede ser demasiado costosa para el presupuesto disponible.
2. Movement Cost nunca cambia la topología ni la continuidad de una Route.
3. Un Step diagonal constituye una sola unidad ordinal aunque cambie dos o tres ejes.
4. Cada Step diagonal afectado por terreno difícil cuesta 15 ft constantes y conserva la paridad del contador.
5. `Spatial Distance` y `Route Cost` son magnitudes distintas y no intercambiables.
6. El cliente no puede confirmar autoritativamente gasto ni ejecución.
7. Ninguna acción mantiene una fórmula paralela de Route Cost.
8. La evaluación es determinista, trazable y auditable.
9. El Footprint efectivo completo participa en la determinación del coste aplicable.
10. La insuficiencia de presupuesto y una prohibición contextual no se codifican como ilegalidad topológica.
11. El contador de diagonales normales pertenece al turno, no a la Route. Varias Routes en el mismo turno comparten la misma paridad.
12. Solo diagonales normales ejecutadas incrementan el contador. Los pasos ortogonales no lo modifican.
13. El contador se reinicia al comenzar el nuevo turno del combatiente.

### 3.16 Límites del capítulo

Quedan expresamente fuera de este capítulo:

- economía completa de acciones;
- Move Action y Double Move;
- Run, Charge y Withdraw;
- Five-Foot Step y Minimum Movement;
- Attacks of Opportunity;
- Forced Movement;
- commit transaccional o mutación de estado;
- pathfinding y generación de Routes;
- Fog of War;
- renderer y presentación;
- caída;
- maniobrabilidad aérea;
- implementación, contratos TypeScript, nombres de API y pseudocódigo.

La ODR D-1B-C3-01 queda resuelta formalmente mediante la adopción de la regla RAW de Double Movement Cost (§3.8). Las ODR preexistentes —incluida la métrica de `Spatial Distance 3D`— permanecen fuera de alcance y sin cambios.

---

## Capítulo 4 — Normative Movement Actions

### 4.1 Propósito y alcance

Este capítulo responde exclusivamente a la pregunta:

> ¿Cómo consumen las distintas acciones el sistema abstracto de Route Validation y Movement Cost?

El capítulo define normativamente el contrato conceptual que cada acción de movimiento debe cumplir respecto al motor espacial. No diseña la implementación, no modifica Route Validation, no redefine Movement Budget y no crea nuevas primitivas espaciales. Las acciones son tratadas aquí únicamente como consumidoras de los contratos definidos en los Capítulos 1, 2 y 3.

### 4.2 Concepto de Movement Action

Una **Movement Action** (acción de movimiento) es una operación autorizada por la economía de turno que permite a una entidad desplazarse.

Normativamente, toda acción de movimiento:
1. selecciona una Route candidata;
2. exige que la Route seleccionada supere Route Validation (Capítulo 2);
3. consume Movement Budget (Capítulo 3) para costear la Route;
4. puede poseer restricciones propias (ej. trayectoria recta, límite visual);
5. nunca redefine la geometría espacial, ni el coste de los pasos, ni la topología.

### 4.3 Action Consumers: Reutilización obligatoria

Todas las acciones formales que involucran desplazamiento voluntario (Move Action, Run, Charge, Withdraw, etc.) comparten un núcleo contractual inquebrantable:
- **Route Validation:** la legalidad topológica y la continuidad se delegan siempre al contrato del Capítulo 2.
- **Movement Cost:** el cálculo de coste, incluyendo la Regla de Movimiento Diagonal, se delega al contrato del Capítulo 3.
- **Movement Budget:** el presupuesto disponible se obtiene y contrasta usando el mismo sistema.

Queda estrictamente prohibido que cualquier acción implemente cálculos propios, fórmulas de coste ad-hoc o reglas paralelas de validación de ruta.

### 4.4 Move Action ordinaria

La **Move Action** (acción de movimiento ordinaria) es la operación estándar de desplazamiento.
Conceptualmente:
- consume una Route;
- requiere que la Route sea topológicamente legal;
- requiere que el coste total de la Route no exceda el Movement Budget normal aportado por la Speed de la entidad.

No se diseña aquí la economía completa de acciones (si requiere una Standard Action o Move Action real), limitándose a describir su consumo de presupuesto.

### 4.5 Double Move

Un **Double Move** (movimiento doble) es una opción explícita mediante la cual el combatiente renuncia al uso ofensivo normal de su acción estándar para dedicar el turno al desplazamiento adicional. La economía de acciones exacta será formalizada posteriormente.
- puede contener más de una porción o segmento de movimiento;
- todas sus porciones utilizan el mismo contexto diagonal del turno, el contador no se reinicia entre dichas porciones;
- no existe un cálculo de coste exclusivo para Double Move;
- continúa consumiendo de manera inalterada Route Validation, Movement Cost y Movement Budget.

El documento no decide todavía la representación concreta en TurnState ni el comportamiento exacto de la interfaz.

### 4.6 Run

**Run** (Correr) es una operación avanzada con un propósito abstracto de avance acelerado.
- **Route Validation:** la ruta debe ser validada como legal bajo el Capítulo 2.
- **Movement Budget:** consume un presupuesto modificado (típicamente multiplicado).
- **Restricciones propias:** la acción exige una trayectoria en línea recta y prohíbe ejecutarse a través de terreno difícil o sin visibilidad (excepciones documentadas en el Research). Estas restricciones actúan como filtros adicionales a la legalidad básica.

### 4.7 Withdraw

**Withdraw** (Retirada) es una operación diseñada para escapar del combate cercano.
- **Propósito:** alejarse de las posiciones amenazadas minimizando los ataques de oportunidad (AoO).
- **AoO:** interactúa conceptualmente suprimiendo la provocación del AdO al abandonar la casilla inicial.
- **Route Validation y Budget:** consume una Route legal y un presupuesto (hasta el doble del Movement Budget), bajo las mismas reglas de validación y coste.

El pipeline de interrupción del combate no se diseña en este capítulo.

### 4.8 Charge

**Charge** (Carga) es una operación agresiva que combina movimiento y ataque.
- **Propósito:** cerrar distancia rápidamente hacia un oponente.
- **Trayectoria especial:** requiere una Route legal en línea recta que termine en la casilla válida más cercana al objetivo.
- **Line of Sight:** depende de la línea de visión inicial ininterrumpida hacia el objetivo al momento de declarar.
- **Costes:** depende de Movement Budget y Route Validation, pero falla si la ruta encuentra obstáculos o terreno difícil, restricciones aplicadas sobre la misma validación de coste.

El diseño de Attack Resolution (resolución de ataque) queda fuera de alcance.

### 4.9 Five-Foot Step

El **Five-Foot Step** (paso de 5 pies) posee una naturaleza excepcional dentro del movimiento táctico.
- **Naturaleza:** permite ajustar la posición táctica sin provocar AoO.
- **Presupuesto:** no consume el presupuesto habitual de Movement Budget, constituyendo su propia autorización.
- **AdO:** exime a su consumidor de provocar ataques de oportunidad por el desplazamiento.
- **Restricciones:** exige que no se haya realizado ningún otro movimiento en el turno y está prohibido en terreno difícil. No debe mezclarse funcional ni arquitectónicamente con el movimiento ordinario.

### 4.10 Minimum Movement

**Minimum Movement** (movimiento mínimo) permite avanzar una casilla cuando los costes excesivos (como terreno difícil o penalizadores) excederían el Movement Budget disponible.
- **Diferencia conceptual:** a diferencia del Five-Foot Step, el Minimum Movement es un desplazamiento ordinario que consume recursos completos de turno, provoca AoO normalmente y no está exento de penalizadores por entorno.
- **Naturaleza:** opera como una excepción al límite de Movement Budget estricto, no como un Five-Foot Step, y requiere ser validado explícitamente separado de aquel.

### 4.11 Forced Movement

**Forced Movement** (movimiento forzado, como ser empujado o caer) pertenece a otro contrato arquitectónico.
- no consume Movement Budget normal;
- no se origina por elección activa de una Movement Action ordinaria;
- sus validaciones y colisiones quedan fuera del alcance de este capítulo.

### 4.12 Movimiento segmentado e Interrupciones

Capacidades que permitan dividir el movimiento durante el turno (por ejemplo, moverse antes y después de un ataque con Ataque Elástico) deben reutilizar el mismo contexto diagonal del turno. Intercalar un ataque no reinicia el contador. Crear varias Routes no reinicia el contador. Únicamente los Steps realmente ejecutados y confirmados aumentan el contador.

**Interrupciones futuras:** Si una Route proyectada se ejecuta solo parcialmente, únicamente los Steps diagonales normales efectivamente confirmados modifican el contador. No se diseñan todavía las interrupciones por AoO, hazards, rollback o commit transaccional.

### 4.13 Autoridad y previews

Se mantiene estrictamente el contrato aprobado en el Capítulo 2:
- el servidor actúa como autoridad normativa exclusiva;
- el cliente puede mostrar en tiempo real un preview predictivo: coste de cada Step, coste acumulado de la Route, presupuesto proyectado y paridad diagonal proyectada;
- el preview opera sobre una copia predictiva, comenzando desde el contador autoritativo actual del turno;
- planear, editar o cancelar una Route no consume presupuesto ni incrementa el contador autoritativo;
- al confirmar la intención, el servidor reconstruye la Route, recalcula partiendo del contador vigente, y solo actualiza el contador después de la resolución autoritativa;
- un preview cliente jamás confirma autoritativamente una acción. La solicitud se envía al servidor, que la valida inmutablemente contra el `RULES_ENGINE`.

### 4.14 Invariantes normativos

1. Ninguna acción redefine la geometría espacial.
2. Ninguna acción redefine el cálculo de costes ni la regla diagonal.
3. Todas las acciones de movimiento consumen el mismo Route Validation.
4. Todas las acciones ordinarias consumen Movement Budget.
5. Five-Foot Step no es movimiento ordinario y sigue reglas segregadas.
6. Minimum Movement no es un Five-Foot Step y no evita ataques de oportunidad.
7. Forced Movement queda fuera de este contrato.
8. La ejecución y mutación de estado pertenecen a capítulos posteriores.
9. El cliente nunca confirma autoritativamente una acción; el servidor es soberano.
10. Double Move no reinicia el patrón diagonal.
11. Intercalar ataques o acciones permitidas (movimiento segmentado) no reinicia el patrón diagonal.
12. Los previews proyectan el contador, pero no mutan el estado.
13. Solo los Steps confirmados autoritativamente afectan el contador.

### 4.15 Límites y ODR

Quedan expresamente fuera de este capítulo el diseño de: la economía completa de acciones (TurnState), el pipeline de AoO, el commit transaccional, el manejo de interrupciones, la persistencia, la arquitectura de red y el renderer. No se diseñan acciones de maniobra espacial pura (bull rush, grapple, fall, flight) más allá de reconocer la existencia de Forzado/Vuelo como contextos futuros. No se implementa código, UI, TurnState ni Ataque Elástico.

**Owner Decision (Decisión Normativa del Propietario):** El patrón de Movimiento Diagonal pertenece al turno del combatiente, no a una Route ni a una acción individual. Se formaliza que Double Move y el movimiento segmentado (como Ataque Elástico) comparten la misma paridad diagonal durante el turno, eliminando la ambigüedad detectada previamente sin requerir ODR adicional.

La ODR D-1B-C3-01 sobre composición simultánea de fuentes de coste queda formalmente resuelta y cerrada conforme a la regla RAW de Double Movement Cost (§3.8).

---

## Capítulo 5 — Normative Movement Resolution Lifecycle

### 5.1 Objetivo del capítulo

Este capítulo responde exclusivamente a la pregunta:

> ¿Mediante qué ciclo normativo una intención de movimiento se convierte en un desplazamiento confirmado?

La respuesta define un contrato lógico de resolución. Ordena responsabilidades ya establecidas por los capítulos anteriores, pero no introduce algoritmos, estructuras de datos, contratos de software ni mecanismos de transporte.

El ciclo no redefine Movement, Route, Step, Route Validation, Movement Cost ni Movement Budget. Tampoco prescribe cómo una acción concreta obtiene autorización para iniciarlo.

### 5.2 Fases de resolución

El ciclo normativo sigue este orden:

> **Intent → Preview → Validation → Cost Assessment → Budget Verification → Resolution → Commit → Publication**

Cada fase posee una responsabilidad exclusiva:

1. **Intent:** expresa la voluntad de desplazar una entidad mediante una Route candidata. No contiene veredictos autoritativos de legalidad, coste, presupuesto ni resultado.
2. **Preview:** proyecta informativamente el resultado esperable a partir del estado conocido. No concede autorización y no modifica estado.
3. **Validation:** determina autoritativamente si la Route candidata satisface Route Validation.
4. **Cost Assessment:** calcula cuánto Movement Cost requeriría la Route legal y proyecta el contexto diagonal resultante.
5. **Budget Verification:** compara el coste calculado con el Movement Budget aplicable.
6. **Resolution:** determina qué Steps legales quedan confirmados como resultado del intento.
7. **Commit:** aplica al estado autoritativo únicamente el desplazamiento y consumo correspondientes a los Steps confirmados.
8. **Publication:** expone el nuevo estado confirmado a sus consumidores después del Commit.

Las fases se mantienen separadas aunque una futura ejecución pueda coordinarlas dentro de una misma operación. Ninguna fase puede asumir la responsabilidad normativa de otra.

Este ciclo es la vista especializada de Movement dentro del [pipeline general de modificadores](modifier-pipeline-architecture.md); no lo reemplaza ni crea un segundo orquestador. Validation, Cost Assessment y Budget Verification refinan para Movement las responsabilidades generales de preflight y proyección; Resolution expresa su resolución y consecuencias de desplazamiento; Commit conserva la única frontera de mutación. Preview es una proyección predictiva sin autoridad y Publication es la exposición lógica posterior al Commit, no una segunda resolución ni un segundo commit.

### 5.3 Validation

La frontera de validación del ciclo consume únicamente los tres contratos canónicos de movimiento:

- **Route Validation**, que determina la legalidad topológica de la Route;
- **Movement Cost**, que será evaluado por Cost Assessment sin alterar la legalidad;
- **Movement Budget**, que será contrastado por Budget Verification sin alterar la Route.

Dentro de la fase **Validation**, solo Route Validation produce el veredicto de legalidad. Movement Cost y Movement Budget atraviesan el ciclo como contratos separados para sus fases posteriores; no se fusionan con la topología.

Validation:

- evalúa la Route completa contra el estado autoritativo vigente;
- no descubre ni reemplaza la Route declarada;
- no calcula un coste alternativo;
- no decide suficiencia de presupuesto;
- no consume presupuesto;
- no mueve a la entidad;
- no modifica estado.

Una Route que no supera Validation no alcanza Cost Assessment, Budget Verification, Resolution ni Commit como desplazamiento confirmable.

### 5.4 Cost Assessment

Cost Assessment consume una Route que ya superó Validation y aplica exclusivamente el contrato de Movement Cost del Capítulo 3.

Normativamente:

1. calcula el coste de cada Step y el coste acumulado de la Route;
2. recibe el estado inicial del contexto diagonal del turno cuando corresponde;
3. proyecta el estado diagonal que resultaría de recorrer los Steps evaluados;
4. conserva el desglose y la evidencia de las contribuciones aplicables;
5. no consume Movement Budget;
6. no cambia posición;
7. no modifica el contexto diagonal autoritativo;
8. no modifica ningún otro estado.

El mismo Cost Assessment puede alimentar Preview y la resolución autoritativa. Su carácter proyectivo no cambia según el consumidor y no autoriza por sí solo el desplazamiento.

### 5.5 Budget Verification

Budget Verification compara el total producido por Cost Assessment con el Movement Budget vigente y aplicable al intento.

Su único veredicto es si existe presupuesto suficiente para costear el desplazamiento evaluado bajo el contrato correspondiente.

Budget Verification:

- no recalcula Route Validation;
- no recalcula Movement Cost;
- no vuelve legal una Route ilegal;
- no vuelve ilegal una Route legal;
- no mueve a la entidad;
- no descuenta presupuesto;
- no modifica estado.

La insuficiencia de presupuesto detiene el ciclo antes de Resolution y Commit, salvo que un contrato normativo futuro y explícito autorice una excepción. Este capítulo no define ninguna excepción.

### 5.6 Resolution

Resolution consume una Route legal cuyo coste ya fue evaluado y cuyo presupuesto ya fue considerado suficiente.

Su responsabilidad es determinar cuáles de los Steps legales de esa Route quedan **confirmados** para el desplazamiento resultante.

Normativamente:

1. nunca confirma un Step que no haya superado Route Validation;
2. conserva el orden de los Steps;
3. no sustituye la Route por otra;
4. una resolución completa confirma todos los Steps de la Route;
5. si la ejecución termina antes de completar la Route, solo el prefijo ordenado de Steps efectivamente confirmado forma parte del resultado.

El principio de confirmación parcial habilita futuras causas de terminación sin diseñarlas. Este capítulo no define ataques de oportunidad, hazards, interrupciones, rollback ni condiciones que puedan producir ese resultado parcial.

### 5.7 Commit

Commit es la única fase del ciclo autorizada para aplicar el resultado confirmado al estado autoritativo.

Commit actualiza exclusivamente, y en correspondencia con los Steps confirmados:

- la posición autoritativa alcanzada;
- el consumo de Movement Budget;
- el contador de diagonales normales del turno.

Los Steps proyectados pero no confirmados no producen desplazamiento, no consumen presupuesto y no modifican el contador diagonal.

Commit no vuelve a definir la Route, su legalidad ni su coste. Aplica el resultado de las fases anteriores y no puede ampliar el conjunto de Steps confirmados por Resolution.

Este contrato describe la frontera lógica de mutación. No diseña representación de TurnState, rollback, transacciones, almacenamiento ni mecanismos de recuperación.

### 5.8 Publication

Publication ocurre después de un Commit exitoso y pone el nuevo estado autoritativo confirmado a disposición de los consumidores del combate.

El estado publicado refleja únicamente:

- la posición alcanzada por los Steps confirmados;
- el presupuesto efectivamente consumido;
- el contexto diagonal del turno efectivamente actualizado;
- cualquier resultado normativo ya confirmado por las fases anteriores que corresponda exponer.

Publication no recalcula, corrige ni amplía el resultado del Commit. Tampoco concede autoridad al consumidor que recibe el estado.

Este capítulo no define networking, WebSocket, wire protocol, serialización, mensajes, eventos ni frecuencia de publicación.

### 5.9 Autoridad

El servidor es la única autoridad sobre Validation, Cost Assessment final, Budget Verification, Resolution, Commit y Publication del estado confirmado.

El cliente puede producir Preview predictivo mediante los mismos contratos compartidos, mostrando Route, coste, presupuesto y contexto diagonal proyectados. Ese Preview:

- no sustituye ninguna fase autoritativa;
- no confirma Steps;
- no consume presupuesto;
- no modifica estado;
- puede quedar obsoleto antes de la resolución final.

Al recibir una intención, el servidor reconstruye el ciclo desde su estado autoritativo vigente y publica únicamente el resultado que haya confirmado y aplicado.

### 5.10 Invariantes normativos

1. Ninguna fase redefine la topología espacial.
2. Ninguna fase redefine Route Validation.
3. Ninguna fase redefine Movement Cost.
4. Ninguna fase redefine Movement Budget.
5. Preview nunca modifica estado ni concede autoridad.
6. Validation nunca consume presupuesto ni mueve entidades.
7. Cost Assessment calcula y proyecta; nunca consume ni muta.
8. Budget Verification compara; nunca consume ni muta.
9. La suficiencia o insuficiencia de presupuesto nunca modifica la legalidad topológica.
10. Resolution confirma únicamente Steps legales y conserva su orden.
11. Commit aplica únicamente Steps confirmados.
12. Solo Steps confirmados consumen presupuesto y modifican el contador diagonal del turno.
13. Publication refleja el Commit y no produce una resolución alternativa.
14. El servidor conserva la autoridad final; el cliente conserva únicamente capacidad predictiva.

### 5.11 Límites y ODR

Quedan expresamente fuera de este capítulo:

- ataques de oportunidad;
- hazards y sus consecuencias;
- causas y orquestación de interrupciones;
- rollback;
- commit transaccional;
- networking, WebSocket y wire protocol;
- serialización y persistencia;
- representación de TurnState;
- pathfinding;
- renderer y presentación;
No se abre ninguna ODR nueva. La ODR D-1B-C3-01 sobre composición simultánea de fuentes de coste queda formalmente resuelta mediante la adopción de la regla RAW de Double Movement Cost (§3.8) y no altera el ciclo definido en este capítulo.

---

## Capítulo 6 — Normative Interaction Model

### 6.1 Objetivo y alcance

Este capítulo responde exclusivamente a la pregunta:

> ¿Cómo interactúan las operaciones que producen desplazamiento con los contratos normativos comunes de Movement?

Move, Double Move, Run, Withdraw, Charge, Five-Foot Step, Minimum Movement y Forced Movement aparecen únicamente como **consumidores**. Sus reglas, requisitos, excepciones y consecuencias continúan perteneciendo a sus respectivos contratos normativos; este capítulo no los redefine, completa ni corrige.

El Interaction Model establece fronteras de responsabilidad. No agrega reglas de juego, no crea variantes de Movement y no introduce un mecanismo alternativo de Validation, coste, Resolution, Commit o Publication.

### 6.2 Principio de consumidor

Una operación consumidora conserva la autoridad sobre:

- su identidad normativa;
- su elegibilidad y autorización;
- sus restricciones propias;
- la política de presupuesto que ya le corresponda;
- sus consecuencias ajenas al desplazamiento.

Para producir desplazamiento, la operación expresa una Intent compatible con el ciclo del Capítulo 5 y entrega únicamente el contexto que su propio contrato ya haya autorizado. A partir de esa frontera, consume sin redefinir:

- Route y Step, conforme al Capítulo 1;
- Route Validation, conforme al Capítulo 2;
- Movement Cost y Movement Budget, conforme al Capítulo 3;
- las fronteras de acciones consumidoras del Capítulo 4;
- Resolution, Commit y Publication, conforme al Capítulo 5.

El núcleo de Movement no descubre qué operación originó la Intent para cambiar su matemática. Las diferencias legítimas llegan desde el contrato propietario de la operación y permanecen trazables como contexto de consumo, no como ramas paralelas de la regla base.

### 6.3 Frontera común de interacción

Toda interacción sigue tres responsabilidades conceptuales:

1. **Antes del ciclo común:** la operación propietaria determina su elegibilidad, sus selecciones permitidas y las restricciones específicas que autorizan la Intent.
2. **Dentro del ciclo común:** Movement procesa la Route mediante Preview, Validation, Cost Assessment, Budget Verification, Resolution, Commit y Publication sin conocer ni reimplementar la regla particular de la operación.
3. **Después del resultado de Movement:** la operación propietaria puede consumir el desplazamiento confirmado para resolver consecuencias que no pertenecen a Movement.

La frontera evita dos duplicaciones:

- una operación no mantiene su propia versión de geometría, coste o commit;
- Movement no absorbe la economía, los efectos ofensivos, las exenciones o las consecuencias particulares de la operación.

Un resultado parcial continúa siendo un prefijo ordenado de Steps confirmados conforme al Capítulo 5. El consumidor recibe ese resultado; no puede declarar confirmados Steps adicionales.

### 6.4 Move como consumidor

Move constituye el consumidor normativo base del sistema de movimiento. Como consumidor, produce una Intent y una Route candidata que consumen exactamente los contratos ya definidos:
- Route Validation;
- Movement Cost;
- Movement Budget;
- ciclo de resolución del Capítulo 5.

Move no redefine geometría, topología, Movement Cost, Route, ni el contador diagonal. No crea una pipeline alternativa y no diseña implementación ni TurnState.

### 6.5 Double Move como consumidor

Double Move únicamente modifica la economía de acciones (renunciando a la acción estándar), pero como consumidor de movimiento:
- consume exactamente el mismo contrato que Move;
- reutiliza Route Validation, Movement Cost, Movement Budget y Movement Resolution;
- comparte el mismo contexto diagonal del turno;
- no reinicia el contador diagonal;
- no redefine ninguna regla del contrato.

No modifica la geometría, topología, validación, cálculo de coste, presupuesto o commit. No diseña aquí la economía completa de acciones.

### 6.6 Run como consumidor

Run conserva la propiedad de su elegibilidad, autorización, restricciones y política de presupuesto.

Al interactuar con Movement:

- produce una Intent y una Route candidata bajo su propio contrato;
- consume Route Validation sin crear una validación de geometría paralela;
- consume Movement Cost sin introducir una fórmula propia por Step;
- aporta la política de Movement Budget que su contrato haya autorizado;
- consume Resolution, Commit y Publication comunes;
- recibe el desplazamiento confirmado para cualquier consecuencia posterior que siga perteneciendo a Run.

Este capítulo no define velocidad, trayectoria, visibilidad, terreno, duración ni consecuencias defensivas de Run.

### 6.7 Withdraw como consumidor

Withdraw conserva la propiedad de su elegibilidad, autorización, restricciones y cualquier interacción especial que su contrato establezca con otros subsistemas.

Al interactuar con Movement:

- produce una Intent y una Route candidata bajo su propio contrato;
- consume los mismos Route Validation, Movement Cost y Movement Budget;
- consume el ciclo común hasta Publication;
- utiliza únicamente los Steps confirmados como evidencia del desplazamiento ocurrido;
- deja fuera del núcleo de Movement cualquier exención o consecuencia que pertenezca a Withdraw o al sistema de Opportunity.

Este capítulo no define exenciones, alcance, economía de acciones ni comportamiento de ataques de oportunidad para Withdraw.

### 6.8 Charge como consumidor

Charge conserva la propiedad de su elegibilidad, sus restricciones y sus consecuencias ofensivas.

Su interacción con Movement queda limitada a:

- producir la Intent de desplazamiento y la Route candidata autorizada por su propio contrato;
- consumir Route Validation, Movement Cost y la política aplicable de Movement Budget;
- consumir Resolution y Commit para determinar el desplazamiento realmente confirmado;
- ofrecer ese resultado confirmado a las responsabilidades posteriores de Charge sin incorporar resolución de ataque dentro de Movement.

Este capítulo no define trayectorias, objetivos, visibilidad, terreno, ataques, bonificadores ni penalizadores de Charge.

### 6.9 Five-Foot Step como consumidor

Five-Foot Step conserva su naturaleza y autorización excepcionales según su contrato propietario.

Como consumidor:

- produce una Intent de desplazamiento limitada por su propia autorización;
- consume Route y Route Validation comunes;
- utiliza Movement Cost y Budget Verification únicamente bajo la política presupuestaria que su contrato ya determine;
- consume Resolution, Commit y Publication comunes;
- no crea una topología, un contador diagonal ni una frontera de mutación alternativos.

Este capítulo no define su coste, elegibilidad, relación con otros movimientos ni interacción con Opportunity.

### 6.10 Minimum Movement como consumidor

Minimum Movement conserva la propiedad de cualquier excepción normativa que permita continuar frente a una insuficiencia ordinaria de presupuesto.

Como consumidor:

- produce una Intent y una Route candidata;
- exige Route Validation común;
- conserva el Movement Cost calculado por el contrato común;
- aporta a Budget Verification únicamente la autorización excepcional que su propio contrato establezca;
- consume Resolution, Commit y Publication sin sustituir el coste real por una fórmula particular.

Una excepción presupuestaria no convierte una Route ilegal en legal y no crea un Movement Cost alternativo. Este capítulo no define cuándo existe la excepción, qué recursos exige ni qué consecuencias produce.

### 6.11 Forced Movement como consumidor

Forced Movement es un consumidor no voluntario del desplazamiento común. La fuente que origina la fuerza conserva la autoridad sobre la causa, la dirección permitida, la magnitud autorizada y las consecuencias propias.

Al interactuar con Movement:

- la fuente produce una Intent de desplazamiento conforme a su contrato;
- el desplazamiento consume las identidades de Route y Step y la legalidad aplicable a sus transiciones;
- consume Movement Cost cuando otro contrato necesite medir el recorrido, sin inferir por ello un gasto voluntario;
- consume Resolution, Commit y Publication comunes;
- aplica posición y contexto diagonal únicamente por Steps confirmados;
- no convierte la ausencia de Movement Budget voluntario en una segunda geometría o un segundo commit.

Este capítulo no define empujes, arrastres, caídas, colisiones, resistencia, daño, presupuesto forzado ni excepciones de transición.

### 6.12 Resultado compartido y consecuencias externas

Todos los consumidores reciben el mismo significado de resultado de Movement:

- un conjunto ordenado de Steps confirmados;
- la posición autoritativa alcanzada;
- el consumo de presupuesto que resulte aplicable;
- el contexto diagonal del turno actualizado por los Steps confirmados;
- el estado publicado después del Commit.

Ese resultado no contiene una resolución duplicada de la operación consumidora. Ataques, exenciones de Opportunity, efectos defensivos, daño, duración, checks y otras consecuencias permanecen en sus contratos propietarios.

Una operación puede usar el resultado confirmado como entrada para su siguiente responsabilidad, pero no puede reinterpretar retroactivamente qué Steps fueron legales, cuánto costaron o cuáles fueron aplicados.

### 6.13 Interacción con el contexto diagonal por turno

Esta sección documenta explícitamente cómo interactúan los consumidores con el contexto diagonal del turno aprobado en el Capítulo 4R1, sin redefinir la autoridad de dicho contador:

- **Move:** utiliza el contexto diagonal vigente.
- **Double Move:** reutiliza exactamente el mismo contexto.
- **Movimiento segmentado (ej. Ataque Elástico):** reutiliza exactamente el mismo contexto.
- **Varias Routes:** comparten el mismo contexto del turno.
- **Intercalar ataques:** no reinicia el contador diagonal.
- **Preview:** utiliza una copia predictiva del contador para no mutar el estado.
- **Commit:** únicamente actualiza el contador mediante los Steps ejecutados.
- **Diagonal difícil:** utiliza el coste fijo de 15 ft; no altera la paridad ni incrementa el contador de diagonales normales.

### 6.14 Autoridad y previews

El servidor conserva la autoridad sobre la operación consumidora y sobre todo el ciclo autoritativo de Movement.

El cliente puede previsualizar la interacción combinando la información permitida de la operación con Preview del Capítulo 5. Esa predicción:

- no autoriza la operación;
- no modifica la Route autoritativa;
- no confirma restricciones propias de la operación;
- no confirma Steps ni presupuesto;
- no evita la reconstrucción completa del resultado por el servidor.

La UI no implementa fórmulas particulares para Run, Withdraw, Charge, Five-Foot Step, Minimum Movement o Forced Movement. Renderiza las proyecciones compartidas y las decisiones autoritativas publicadas.

### 6.15 Invariantes normativos

1. Cada operación permanece propietaria de su regla; Movement permanece propietario del desplazamiento común.
2. Ningún consumidor redefine Movement, Route o Step.
3. Ningún consumidor redefine Route Validation.
4. Ningún consumidor redefine Movement Cost ni mantiene una fórmula paralela por Step.
5. Ningún consumidor crea una frontera alternativa de Resolution, Commit o Publication.
6. Una política presupuestaria especial modifica únicamente la autorización de consumo; no modifica topología ni coste.
7. Las restricciones particulares de una operación no se convierten en reglas generales de Movement.
8. Las consecuencias no espaciales permanecen fuera del núcleo de Movement.
9. Solo Steps confirmados afectan posición, presupuesto aplicable y contexto diagonal.
10. Un resultado parcial conserva el mismo significado para todos los consumidores.
11. El servidor es autoritativo y el cliente es únicamente predictivo.
12. Move consume el contrato común.
13. Double Move consume el contrato común.
14. Ninguna acción reinicia el contexto diagonal; el contexto diagonal pertenece al turno.
15. Varias Routes reutilizan el mismo contexto diagonal.
16. Los previews no mutan el estado.
17. El Commit únicamente actualiza Steps confirmados.
18. Las diagonales difíciles no modifican la paridad del contador normal.

### 6.16 Límites y ODR

Este capítulo no define ni modifica las reglas de Move, Double Move, Run, Withdraw, Charge, Five-Foot Step, Minimum Movement o Forced Movement.

También quedan fuera de alcance:

- economía de acciones y TurnState;
- ataques y resolución ofensiva;
- ataques de oportunidad y sus exenciones;
- hazards, colisiones e interrupciones;
- rollback y commit transaccional;
- condiciones, dotes y conjuros concretos;
- networking, WebSocket y wire protocol;
- persistencia, renderer y UI concreta;
- contratos TypeScript, pseudocódigo e implementación.

No se abre ninguna ODR nueva. La ODR D-1B-C3-01 sobre composición de costes queda formalmente resuelta mediante la adopción de la regla RAW de Double Movement Cost (§3.8) y no se reabre por la interacción con estos consumidores.


## Capítulo 7 — Normative Integration & Implementation Contracts

### 7.1 Objetivo

El propósito de este capítulo es consolidar el contrato final de integración del sistema de movimiento normativo. Este documento:
- integra todos los componentes definidos en los Capítulos 1 al 6;
- establece los límites arquitectónicos previos a la fase de implementación de código;
- no redefine ningún contrato, topología o regla ya fijada;
- no amplía el alcance más allá de lo establecido en este NDD.

### 7.2 Consumo de contratos

El sistema integrado opera bajo un flujo estricto donde los componentes son consumidores ordenados de contratos preaprobados:
- **Movement Actions (Move, Double Move, Run, Withdraw, Charge, Five-Foot Step, etc.):** consumen Route Validation, Movement Cost y Movement Budget sin proveer fórmulas o topologías propias.
- **Route Validation:** consume las primitivas de D-1R1 y D-1A para determinar topología y continuidad.
- **Movement Cost:** consume la Route legal y proyecta el contexto diagonal del turno.
- **Budget Verification:** consume el coste proyectado y lo compara contra el presupuesto.
- **Resolution:** consume la validación integral para emitir un listado ordenado de Steps confirmados.
- **Commit:** consume la resolución final para mutar el estado.
- **Publication:** consume el resultado del Commit para exponerlo a los sistemas dependientes.

### 7.3 Responsabilidades

La arquitectura asigna responsabilidades exclusivas, asegurando una única autoridad por cada dominio:
- **Validar:** Responsabilidad exclusiva de `Route Validation` para determinar legalidad topológica y reglas de transición.
- **Calcular coste:** Responsabilidad exclusiva de `Movement Cost`, manteniendo el desglose normativo por Step.
- **Verificar presupuesto:** Responsabilidad exclusiva de `Budget Verification`, evaluando la suficiencia sin mutar estado ni anular la legalidad topológica.
- **Resolver:** Responsabilidad exclusiva de `Movement Resolution`, confirmando la totalidad o un subconjunto prefijo de los Steps.
- **Confirmar (Commit):** Responsabilidad exclusiva del ciclo de resolución servidor, mutando la posición, presupuesto y el contador diagonal del turno.
- **Publicar:** Exposición autoritativa pos-Commit a los sistemas dependientes o clientes.

### 7.4 Dependencias

El diseño de movimiento normativo mantiene dependencias explícitas:

**Consume como dependencias normativas:**
- **D-1R1:** Geometría Normativa Espacial (identidad espacial, primitivas 2.5D, distancia).
- **D-1A:** Normative Area Shape Projection (volúmenes, ocupación).
- **Research:** `docs/audits/movement-rules-audit.md` (evidencia y reglas RAW de Movement).

**Será consumido por:**
- **Rules Engine:** quien orquestará su ciclo lógico.
- **Commands:** capa de táctica y despachadores de acciones.
- **Preview:** predicción local del cliente antes de enviar la intención.
- **UI:** presentación de rutas, costes proyectados y animaciones de movimiento.
- **Futuras acciones de movimiento y TurnState:** economía completa de acciones, Movement Actions y AoO pipeline.

No se modificarán estas dependencias durante la implementación del movimiento.

### 7.5 Autoridad

Se reafirma la frontera de autoridad:
- **Servidor:** Mantiene la autoridad normativa exclusiva. Es la única entidad capaz de ejecutar la validación, procesar el commit y determinar el estado final inmutable.
- **Cliente:** Conserva capacidad predictiva para el preview en tiempo real mediante helpers matemáticos compartidos, pero carece de toda autoridad normativa. Ningún evento, botón o cálculo del cliente confirma un movimiento o gasto localmente.

### 7.6 Invariantes globales

La integración de los capítulos anteriores resulta en los siguientes invariantes supremos:
1. Existe una sola autoridad normativa: el servidor.
2. Existe una sola topología espacial para todas las acciones.
3. Existe una sola validación de Route.
4. Existe un solo cálculo de coste que todos los consumidores acatan.
5. Existe un solo presupuesto normativo por acción.
6. El contador de Movimiento Diagonal pertenece al turno y persiste entre acciones (Move, Double Move, movimiento segmentado).
7. Los previews son estrictamente predictivos y no mutan el estado.
8. Los commits son autoritativos y actúan únicamente sobre Steps confirmados.
9. Las diagonales difíciles poseen coste fijo y no alteran la paridad del contador diagonal.
10. Las Movement Actions operan únicamente como consumidoras; ninguna posee matemática propia.

### 7.7 Límites

Quedan explícitamente fuera del alcance de este NDD, y por ende de su inmediata implementación:
- diseño de código, interfaces o arquitectura de clases;
- implementación o pseudocódigo TypeScript;
- TurnState y economía completa de acciones;
- networking, persistencia o wire protocols;
- pipeline de AoO y mecanismos de interrupción;
- sistema de colisiones por Hazards;
- motor de renderizado 2.5D o UI del cliente;
- algoritmos de pathfinding automáticos;
- diseño e implementación del editor de escenarios;
- tests (ya que pertenecen a la etapa de código).

### 7.8 Checklist de implementación

Durante el futuro sprint de código, la implementación deberá acatar el siguiente checklist documental:
- [ ] **Respetar contratos:** cada fase (Validation, Cost, Budget, Resolution) debe implementarse en una frontera inyectable, testeable y separada.
- [ ] **No duplicar validadores:** Run, Charge y otros consumidores deben utilizar el validador principal, añadiendo solo restricciones.
- [ ] **No recalcular costes fuera del módulo:** ninguna UI o helper externo implementará una fórmula de coste ajena al módulo central.
- [ ] **No crear pipelines paralelas:** todas las Intents fluyen a través del mismo flujo de ciclo normativo común.
- [ ] **Reutilizar helpers compartidos:** el preview del cliente consumirá la misma matemática subyacente determinista que el servidor.
- [ ] **Preservar autoridad del servidor:** el código del cliente jamás deberá despachar mutaciones de movimiento directas, solo intenciones de consumo.

---

## Capítulo 8 — Integración Productiva de la Acción de Movimiento (Sprint D-1B-I6)

### 8.1 Propósito y Alcance de I6
Este capítulo especifica la integración productiva autoritativa de la **Move Action ordinaria** (`move-combatant` -> `handleMoveCombatant`) conectándola al pipeline normativo consolidado en los Capítulos 1–7 (Route Validation -> Movement Cost -> Resolution -> Commit -> Publication).

**Frontera de Aislamiento Estricto:**
- Solo migra `handleMoveCombatant` en fase activa (`room.phase === "active"`).
- **NO migra la semántica táctica** de `handleWithdraw`, `handleRun`, `handleCharge` ni `handleFiveFootStep`; R4 permite únicamente propagar evidencia de eje y adaptar la firma de Commit. Esas acciones continúan consumiendo sus implementaciones vigentes en `tacticalCommands.ts`.
- **NO altera** la fase de preparación (`room.phase === "preparation"`): la colocación inicial de tokens permanece como colocación libre gobernada por sus validaciones existentes fuera de I4/I5.
- Los helpers legacy compartidos (`validateMovePath`, `calculatePathStepCostsFeet`, `calculatePathCostFeet`) se conservan sin alteración para sustentar las acciones tácticas no migradas y el preview del cliente.
- **ODR D-1B-C3-01** (composición de duplicaciones de Movement Cost) ha quedado **resuelta formalmente** mediante la regla RAW de Double Movement Cost (§3.8); la ODR normativa **ODR-D1B-I5-1** (sede autoritativa de `squeezingAxis`) queda **formalmente resuelta y cerrada** en este diseño (§8.7) situando la autoridad del eje en `EffectInstance<ProductionEffectId>` para el efecto `srd_squeezing`, garantizando la reconstrucción determinista de huellas tras Commit.
- **Sin asunción de Double Move ni movimiento segmentado productivo:** I6 migra únicamente la Move Action ordinaria. La economía productiva vigente (`canUseMoveAction`) rechaza tajantemente un segundo `move-combatant` si `usedMoveAction === true`. Cualquier soporte futuro para gastar la acción estándar en un segundo movimiento pertenece al diseño formal de economía de acciones y Double Move, no a I6.

### 8.2 Autoridad y Responsabilidad del Action Consumer (`handleMoveCombatant`)
El handler `handleMoveCombatant` retiene la responsabilidad de:
1. **Control y Turno:** Verificar pertenencia del actor (`requireCombatantControl`), fase activa (`ensureActiveTurn`) y disponibilidad general de acción (`Rules.evaluateActionAvailability`).
2. **Economía de Acción y Gating Exacto de Ataque:**
   - Evaluar `canUseMoveAction(snapshot, combatant)`.
   - Preservar con exactitud el gating vigente de modo de ataque:
     ```ts
     if (
       room.currentTurn.attackMode === "full" ||
       (room.currentTurn.attackMode === "standard" && !room.currentTurn.usedStandardAction)
     ) {
       throw new Error(
         "No puede realizar un movimiento normal mientras tenga preparado un modo de ataque (Estandar o Completo). Cancele la preparacion primero."
       );
     }
     ```
     *(Nótese: si `attackMode === "standard"` pero `usedStandardAction === true`, el ataque estándar ya fue ejecutado y la Move Action ordinaria subsiguiente es legal según la semántica productiva actual).*
3. **Derivación Autoritativa del Presupuesto:** Calcular el presupuesto disponible de la acción sin admitir inputs del cliente ni duplicar fórmulas:
   ```ts
   const effectiveSpeedFeet = Rules.totalSpeedFeet(snapshot, combatant);
   const availableBudgetFeet = Math.max(0, effectiveSpeedFeet - room.currentTurn.movementUsedFeet);
   ```
4. **Contexto Inicial:** Extraer `initialContext = { normalDiagonalStepsThisTurn: room.currentTurn.normalDiagonalStepsThisTurn }`.

### 8.3 Tumble / Acrobacias (RAW vs Representación del Motor) y Matriz Canónica de Costes

#### 8.3.1 Regla RAW de Tumble y su Representación Isomórfica en el Motor
1. **Regla RAW (D&D 3.5 PHB pág. 84 / SRD):**
   > *Tumble:* "You can land softly when you fall or tumble past opponents. You can also tumble through an area occupied by an enemy. […] Accelerated Tumbling: You can try to tumble at greater than normal speed (see below). […] Normal Tumble: You can move at up to one-half your normal speed as a move action without provoking attacks of opportunity from squares you leave."

   RAW expresa formalmente que realizar Piruetas ordinarias se efectúa a **mitad de velocidad** (*one-half normal speed*).

2. **Representación en el Motor de DnD-TCA:**
   - Para no crear economías paralelas de velocidad por acción ni fragmentar el Movement Budget del turno, el motor modela la restricción de mitad de velocidad de forma equivalente como **una duplicación del Movement Cost (×2)** por cada Step recorrido acrobáticamente.
   - *Justificación de equivalencia matemática y autoritativa:* Recorrer casillas al doble de coste consume exactamente la mitad de la velocidad disponible en pies (`availableBudgetFeet`), logrando la misma distancia máxima alcanzable y la misma contabilidad de `movementUsedFeet` que exige el pipeline normativo de I4/I5.
   - *Tumble Aislado (Tumble-only) NO es Diagonal Hampered:* La mitad de velocidad no altera por sí misma la regla ordinal o geométrica de las diagonales ordinarias. Por tanto, Tumble solo duplica el coste normal del paso (ortogonal: 5 -> 10 ft; diagonal normal: 5/10 -> 10/20 ft) y sus pasos diagonales **continúan participando e incrementando la paridad diagonal** (`normalDiagonalStepsThisTurn`). NO se aplica un coste fijo de 15 ft a Tumble aislado.
   - *Tumble combinado con fuentes reales de movimiento obstaculizado (Hampering):* Cuando Tumble coincide con una fuente real que ya impone coste impedido (Terreno Difícil o Squeezing con diagonal fija de 15 ft), la restricción equivalente de mitad de velocidad vuelve a duplicar el coste impedido a 30 ft fijos (o 60 ft con 3 duplicaciones), sin alterar la paridad normal.
   - *Variante de Accelerated Tumbling (movimiento a velocidad completa con penalizador de -10 a la tirada):* Queda registrada como gap normativo de PHB para un sprint específico posterior; I6 modela exclusivamente el Tumble ordinario a mitad de velocidad.

#### 8.3.2 Matriz Canónica de Costes de Movimiento y Paridad Diagonal
Queda congelada de forma canónica la siguiente matriz de costes y paridad:

| Condición del Step | Factores / Duplicaciones | Coste Ortogonal | Coste Diagonal | Paridad `normalDiagonalStepsThisTurn` |
|---|---|---|---|---|
| **Normal** | Ninguno (base 1x) | 5 ft | 5 / 10 ft (alternado) | **SÍ** (incrementa paridad normal) |
| **Tumble Aislado** | Restricción velocidad (x2) | 10 ft | 10 / 20 ft (alternado) | **SÍ** (incrementa paridad normal) |
| **Terreno Difícil Aislado** | 1 duplicación real (x2) | 10 ft | 15 ft (fijo) | **NO** (preserva paridad normal intacta) |
| **Squeezing Aislado** | 1 duplicación real (x2) | 10 ft | 15 ft (fijo) | **NO** (preserva paridad normal intacta) |
| **Tumble + Terreno Difícil** | 2 duplicaciones (x4) | 20 ft | 30 ft (fijo) | **NO** (preserva paridad normal intacta) |
| **Tumble + Squeezing** | 2 duplicaciones (x4) | 20 ft | 30 ft (fijo) | **NO** (preserva paridad normal intacta) |
| **Terreno Difícil + Squeezing** | 2 duplicaciones (x4) | 20 ft | 30 ft (fijo) | **NO** (preserva paridad normal intacta) |
| **Tumble + DT + Squeezing** | 3 duplicaciones (x8) | 40 ft | 60 ft (fijo) | **NO** (preserva paridad normal intacta) |

- La autoridad central de cálculo reside exclusivamente en `assessMovementCost` (`movementCost.ts`), la cual evalúa las fuentes activas del Step y aplica la regla general RAW sin fórmulas hardcodeadas en `handleMoveCombatant`.
- **ODR D-1B-C3-01 queda resuelta y cerrada** para todas estas combinaciones multiplicativas.

#### 8.3.3 Secuencia Transaccional de Tiradas y confirmedPath
1. **Resolución Candidata Completa:** Se invoca `resolveMovementPipeline` sobre la ruta candidata completa con `isAcrobatic = !!command.isAcrobatic`.
   - Si el resultado NO es `ready`, se rechaza el comando inmediatamente. Cero tiradas de dados y cero mutación.
2. **Detección de Pasos a Través de Enemigos:** Se inspecciona `resolution.steps`. Si un step atraviesa casillas ocupadas por un enemigo vivo y `isAcrobatic` es true:
   - Se realiza la tirada de Acrobacias (CD 25).
   - Los resultados de las tiradas se acumulan en un búfer local de publicación (`pendingLogs`).
   - Si la tirada falla, la ruta se corta: `confirmedPath` es el prefijo de posiciones previas a la casilla fallida.
   - Si `confirmedPath` queda vacío (fallo en el primer step), se lanza error ("Movimiento interrumpido en el primer paso") sin Commit.
3. **Re-resolución Normativa del Prefijo Confirmado:**
   - Si hubo interrupción pero existe un prefijo válido, se re-ejecuta `resolveMovementPipeline` **exclusivamente sobre `confirmedPath`**, reutilizando el mismo `snapshot`, `initialContext`, `availableBudgetFeet` e `isAcrobatic = true`.
   - La nueva resolución del prefijo es la única que avanza al Commit. Sus `resultingContext` y costes reflejan con exactitud los steps efectivamente transitados.

### 8.4 Ataques de Oportunidad (AoO) y Métrica Consumida
1. **Métrica Entregada al Helper de AoO:**
   - En `findTriggeredOpportunityAttacksForPath(room, mover, path, distanceMovedFeet, ...)`:
     - El parámetro histórico `distanceMovedFeet` se utiliza internamente para dos propósitos:
       1. Gate de paso mínimo: `if (distanceMovedFeet <= room.board.cellSizeFeet || path.length === 0) return [];`
       2. Asignación a cada AdO: `movementCostFeet: Math.max(0, distanceMovedFeet - costBeforeOrigin)`.
     - Por lo tanto, este parámetro representa **Movement Cost de la ruta**, no distancia euclidiana ni Spatial Distance.
     - En I6, se pasa explícitamente `resolution.totalCostFeet` a `findTriggeredOpportunityAttacksForPath`.
2. **Tiradas CD 15 de Acrobacias:**
   - Se evalúan las tiradas CD 15 para evadir AdO sobre las oportunidades disparadas en el camino confirmado.
   - Los logs de las tiradas se acumulan en el búfer local.
   - Si hubo interrupción por Acrobacias fallida (CD 25), se genera el AdO correspondiente del enemigo interceptor.
3. **Encolado Post-Commit:**
   - Las oportunidades resultantes se conservan localmente y **solo se encolan** en `room.pendingOpportunityAttacks` tras un Commit exitoso.

**Aclaración factual de integración I6:** el helper legacy de AdO acepta opcionalmente las huellas/mode/eje ya confirmados por Resolution o por validation.value.steps. La lectura de posiciones hipotéticas con el eje inicial almacenado puede ser ilegal al salir/girar en compresión; por eso las celdas abandonadas y la vista local del origen consumen evidencia validada sin inferir ni recalcular eje. Se preservan gates de provocación, exención de Withdraw, selección de reactores, coste histórico y CD15; los callers sin evidencia mantienen el comportamiento por defecto. validateMovePath y los dos calculadores legacy no cambian. Preparación y teleport validan una vista candidata natural explícita, coherente con el modo que confirman, sin mutar el estado previo ni extender squeezing.

### 8.5 Compromiso Atómico (Commit) y Frontera de Publicación

1. **Precondiciones:** Se construye `preconditions`:
   - `expectedTurnCombatantId: combatant.id`
   - `expectedRound: room.round`
   - `expectedOrigin: combatant.position`
   - `expectedMovementUsedFeet: room.currentTurn.movementUsedFeet`
   - `expectedDiagonalContext: initialContext`
2. **Ejecución de Commit:** Se invoca `commitMovementResolution({ room, combatant: authoritativeCombatant, resolution, preconditions })`.
   - Si el Commit retorna `rejected`: se aborta la ejecución arrojando un error descriptivo. El búfer local de logs y AdOs se descarta íntegramente. `room` y `combatant` quedan con **cero mutaciones** (sin `usedMoveAction`, sin logs de dados y sin AdOs).
3. **Publicación Transaccional (Solo si `committed`):**
   - **Economía:** `room.currentTurn.usedMoveAction = true`.
   - **Logs de Dados:** Se vuelcan los logs acumulados en el búfer local a `room.log`.
   - **Log de Movimiento:**
     - Consume `resolution.totalCostFeet` como el coste de movimiento consumido.
     - Consume `commitResult.movementUsedFeetAfter` como el total consumido en el turno.
     - Documentación de deuda semántica: la frase histórica `combatant.name + " avanza " + distance + " pies..."` ha reflejado históricamente el coste de ruta (`totalCostFeet`). I6 mantiene la coherencia de este log informando el coste consumido (`resolution.totalCostFeet`), y reporta `commitResult.distanceMovedFeet` únicamente si se requiere trazar la longitud base de la ruta, sin confundirlo con Spatial Distance.
   - **Transición Espacial (Squeezing):**
     - Se captura `wasSqueezing` inmediatamente antes del Commit consultando la presencia real de `srd_squeezing` en `room.effectInstances`:
       ```ts
       const wasSqueezing = room.effectInstances.some(
         (instance) => instance.effectId === "srd_squeezing" && instance.targets?.includes(combatant.id)
       );
       ```
     - Tras un Commit exitoso: `isSqueezingNow = commitResult.finalSpatialMode === "squeezing"`.
     - Si `!wasSqueezing && isSqueezingNow`: emite log `"X se ha metido en un espacio estrecho y esta Apretujandose."`
     - Si `wasSqueezing && !isSqueezingNow`: emite log `"X dejo el espacio estrecho."`
     - Si no hubo cambio (`wasSqueezing === isSqueezingNow`): no emite log de transición espacial.
     - Si el Commit fue rechazado: cero logs de Squeezing.
   - **AdOs y Fase:** Se encolan las oportunidades en `room.pendingOpportunityAttacks`, se ejecuta `syncEncounterPhase(room)` y se difunde mediante `broadcast(room)`.

### 8.6 Divergencia Temporal con UI / Preview
Aclaración factual tras I7: Move ordinario activo consume ahora Resolution shared mediante el adapter web y deja de usar estos costes legacy. La divergencia histórica de I6 descrita abajo permanece aplicable a las familias tácticas fuera de I7; no cambia la matriz ni el contrato de §9.
Dado que en I6 el frontend continuará consumiendo temporalmente los helpers legacy:
1. **Diagonales en Terreno Difícil:**
   - Servidor I4/I5: coste fijo normativo de 15 ft sin consumir paridad normal.
   - Preview legacy (`calculatePathStepCostsFeet`): aplica 15 ft (impar) / 20 ft (par) alternado.
   - *Impacto:* Rutas con múltiples diagonales en terreno difícil pueden mostrar en la UI un coste ligeramente mayor o menor que el computado autoritativamente por el servidor. El servidor es la única autoridad y rechazará o aceptará según el valor normativo exacto.
2. **Squeezing:**
   - Servidor I4/I5: deriva huellas multicasilla con compresión `srd_squeezing` y duplica el coste base.
   - Preview legacy: calcula coste mirando anclas individuales (`narrowCells.includes`).
3. **Acrobacias:**
   - Servidor: aplica x2 sobre ortogonales y diagonales normales (10/20 ft con paridad), o duplica el coste impedido a 30 ft fijos en DT/Squeezing.
4. *Estrategia:* No se modifica el cliente en I6. La migración del preview a helpers isomórficos derivados de I4 se abordará en un sprint posterior de Presentation/Preview.

### 8.7 Resolución Normativa de ODR-D1B-I5-1: Sede Autoritativa de squeezingAxis

#### 8.7.1 Hallazgo Arquitectónico y Diagnóstico de la Brecha
Movement Resolution produce `squeezingAxis = "horizontal" | "vertical"`, y Commit devuelve dicho eje. Sin embargo, en el estado integrado de I5R2, ese eje **no se persiste**.
Posteriormente, cuando cualquier subsistema (Board update, AoO, validación de ruta siguiente, fingerprinting o cálculo de ocupación) invoca `getCombatantOccupiedCellsAt()`, este helper detecta `srd_squeezing` y llama a `getSqueezedFootprintAt(combatant, snapshot, position)` sin proveer `preferredAxis`.
En consecuencia, `getSqueezedFootprintAt` recurre a la lista fija de candidatos `[horizontal, vertical]` y selecciona arbitrariamente `legal[0]`. Si en esa posición ambos ejes resultan legalmente válidos, se selecciona invariablemente `"horizontal"`, **provocando footprint drift posterior al Commit** cuando la resolución confirmó un eje `"vertical"`. Esto quiebra la invariante:
`occupiedCellsImmediatelyAfterCommit == occupiedCellsDerivedFromNextAuthoritativeSnapshot`

#### 8.7.2 Auditoría de Alternativas Evaluadas

1. **Alternativa A — Estado espacial explícito en `CombatantSnapshot` (`combatant.squeezingAxis` o `combatant.spatialState`):**
   - *Evaluación:* Quiebra el principio de Single Source of Truth (SSOT). Squeezing es una condición temporal con modificadores de ataque y defensa administrada por ActiveEffects (`srd_squeezing`). Alojar el eje en `Combatant` divide la autoridad en dos entidades independientes: si un efecto se disipa, expira o es retirado administrativamente en el panel de condiciones, `combatant.squeezingAxis` quedaría huérfano. Además, vulnera la política de diseño contra mutaciones escalares derivadas en `CombatantSnapshot`.
2. **Alternativa B — Sede autoritativa en `EffectInstance<ProductionEffectId>` para `srd_squeezing` (`instance.squeezingAxis?: SqueezingAxis`):**
   - *Evaluación:* **SELECCIONADA COMO AUTORIDAD ÚNICA.** Squeezing existe en el combate si y solo si existe una instancia activa de `srd_squeezing` vinculada al combatiente. Al almacenar `squeezingAxis` como atributo declarativo de dicha instancia, la existencia de la compresión y su orientación espacial nacen, mutan y mueren de forma estrictamente atómica dentro de `room.effectInstances`.
3. **Alternativa C — Registro espacial independiente en la sala (`room.spatialStates`):**
   - *Evaluación:* Introduce una colección adicional en `CombatRoom` sin justificación normativa, creando una segunda fuente de verdad que debe sincronizarse bidireccionalmente con `EffectManager`.

#### 8.7.3 Evaluación Multidimensional de la Alternativa B Seleccionada

- **Snapshot y Serialización:** `room.effectInstances` es un campo estándar serializable de `CombatRoom` y `CombatRulesSnapshot`. Requiere añadir el campo a EffectInstance y copiarlo explícitamente en safeInstance de EffectManager y cloneEffectInstances de combatSnapshot; WebSocket distribuye room por JSON.
- **Room State y EffectManager:** Las transiciones de Squeezing se gestionan exclusivamente mediante `EffectManager.add` y `EffectManager.removeMany`. Cuando la criatura entra en compresión o cambia de eje, la instancia se inserta o actualiza atómicamente; cuando abandona la compresión, la instancia se elimina y el eje desaparece automáticamente sin dejar residuos huérfanos.
- **Client Projection y Render:** El snapshot distribuido al cliente contiene la instancia con su `squeezingAxis`, permitiendo que el renderer 2.5D y el overlay proyecten la orientación exacta confirmada por el servidor sin heurísticas.
- **Persistencia Futura:** Los efectos activos de una sala forman parte de su snapshot persistente; no se altera el esquema de plantillas o perfiles de criaturas en catálogo.
- **Fingerprint y Stale Protection:** `createMovementStateFingerprint` en `movementResolution.ts` calcula las celdas ocupadas de cada combatiente mediante `getCombatantOccupiedCells`. Al consultar `instance.squeezingAxis`, cualquier alteración del eje produce una huella distinta en `occupiedCells`, invalidando de forma determinista cualquier resolución stale calculada sobre el eje previo.
- **Fase de Preparación y D-5 Board Editing:** Durante la edición del tablero (`handleUpdateBoard`), `candidateRoom` preserva las `effectInstances` existentes. Al derivar `getCombatantOccupiedCells(combatant, candidateRoom)`, se consume `instance.squeezingAxis`, garantizando que `isExactlySameFootprint` verifique con precisión matemática que la compresión no rota ni se altera.

#### 8.7.4 Invariante global y contrato autoritativo

La matriz RAW de Movement Cost/paridad aprobada en R3 permanece sin cambios. R4 solo completa el ciclo de vida de `squeezingAxis`.

La única autoridad es la instancia de `srd_squeezing` en `room.effectInstances`. Para cada combatiente con footprint orientable comprimido existe una sola instancia espacial, con exactamente un eje `horizontal | vertical`, confirmado por la proyección validada de la transición. Actualmente la geometría soporta compresión orientable de huellas naturales 2×2 según escala del tablero, no simplemente una etiqueta de tamaño Large. No se amplía soporte geométrico.

Ningún productor nuevo puede insertar compresión orientable sin eje. Commit nunca elige un eje por orden de candidatos, heurística, destino o estado del cliente. El snapshot siguiente debe reproducir las mismas coordenadas `x,y,zFeet` de la huella confirmada. Eje faltante, inválido, instancia duplicada o eje que dejó de ser legal son errores de integridad: no retornar silenciosamente `legal[0]` ni huella natural.

ODR-D1B-I5-1 queda formalmente resuelta y cerrada en este NDD. Lifecycle y auditoría R4 aprobados conceptualmente; R5 consolida autoridad documental y responsabilidades. Este NDD es la única autoridad normativa de D-1B; el plan deriva tareas y walkthrough registra historia/auditoría.

#### 8.7.5 Propiedad del tipo y frontera genérica de efectos

`SqueezingAxis` tendrá una única definición en el nuevo módulo hoja `packages/shared/src/movementContracts.ts`, sin imports ni dependencias de runtime. Este contrato inferior será reutilizado por `effects/types.ts`, `movementGeometry.ts`, Resolution/Commit y SpatialTransition mediante `import type`. No duplicar la unión literal en efectos ni en servidor. La exportación existente de movementGeometry se conserva como re-export de tipo para compatibilidad; index.ts expone la misma autoridad. No importar movementGeometry desde effects/types ni manager. Grafo: effects/types → movementContracts; movementGeometry → types + movementContracts; ningún retorno desde el módulo hoja. La evidencia discriminada también vive en ese módulo, sin importar Position, Combatant ni reglas.

Se conserva `EffectInstance<TEffectId>` con `readonly squeezingAxis?: SqueezingAxis`, sin metadata genérica ni unión distributiva compleja por catálogo. La optionalidad permite efectos ordinarios y fixtures effect-only/no orientables; no autoriza compresión espacial orientable incompleta.

EffectManager conserva infraestructura genérica de efectos:

- Copia explícitamente el escalar en safeInstance; cadena por valor. Mantiene copias defensivas de targets, source, appliedAtEvent y duration.
- Si existe el campo, valida su pertenencia a SqueezingAxis y rechaza el campo en efectos distintos de srd_squeezing antes de retornos por collision/onStack.
- Conserva collision/onStack y remove/removeMany; eliminar instancia elimina su eje.
- No exige eje ausente por tamaño/footprint ni decide cardinalidad espacial del target. No calcula footprints, importa MovementGeometry/size rules, consulta board/narrow terrain, elige/infiere eje, decide compresión ni valida rutas.

cloneEffectInstances de combatSnapshot.ts también enumera campos manualmente y debe copiar el eje para createCombatRulesSnapshot y consumidores del clonador, incluidos clones transaccionales. Broadcast de roomStore serializa room con JSON.stringify sin filtrar el campo; no cambia protocolo.

#### 8.7.6 Productores espaciales y geometría autoritativa

commitMovementResolution consume el último paso confirmado de Resolution; commitSpatialTransition consume evidencia discriminada de su caller:

```ts
type ConfirmedSpatialTransition =
  | { readonly spatialMode: "natural"; readonly squeezingAxis?: never }
  | { readonly spatialMode: "squeezing"; readonly squeezingAxis: SqueezingAxis };
```

El último paso con eje opcional de Resolution debe estrecharse/validarse a esa evidencia antes de cualquier mutación. Una transición a squeezing orientable exige eje válido antes de cambiar posición, efectos, economía, logs o AdOs. La evidencia procede de la proyección validada y corresponde al destino/prefijo confirmado; no recalcularla en Commit ni inferir desde destination, legal[0], heurística o estado cliente. Los productores espaciales exigen un único target existente; no crean compresión global, ambiental o multitarjet ambigua. Esa garantía espacial no pertenece a EffectManager.

Natural elimina efecto/eje. Squeezing con instancia única válida y mismo eje puede preservarla; cambiar eje hace removeMany/reinsert en candidato local porque onStack:"ignore" impide actualizar con add directo. Publicar candidato y posición tras todas las guardas. Rejected/stale conserva room completo: posición, efectos/eje, economía, logs y AdOs. Duplicados se rechazan como integridad espacial; nunca seleccionar primera instancia.

En getCombatantOccupiedCellsAt, la frontera geométrica determina si el footprint requiere orientación (soporte actual: natural 2×2 según escala del tablero). Si existe srd_squeezing, exige exactamente una instancia, eje válido obligatorio y proyección con preferredAxis todavía legal. Si falla: ERROR DE INTEGRIDAD antes de consumir/publicar snapshot. Nunca legal[0], fallback horizontal ni fallback natural para ese estado. Sin squeezing se deriva huella natural. Fixtures no espaciales/no orientables pueden mantener axisless únicamente porque no representan autoridad espacial orientada; no habilitan nuevas transiciones comprimidas no soportadas.

Se cumple occupiedCellsImmediatelyAfterCommit == occupiedCellsDerivedFromNextAuthoritativeSnapshot en x,y,zFeet, incluso con ambos ejes legales. Fingerprint consume esa ocupación: cambiar eje invalida resoluciones stale. Edición de tablero preserva eje y compara huella exacta sin rotaciones silenciosas.

#### 8.7.7 Integración de callers legacy

Búsqueda de todos los usos en baseline: 13 invocaciones productivas, además de definición/imports. Referencias de línea corresponden al baseline.

| Archivo / caller | Líneas | Modo actual / evidencia | Adaptación mínima futura |
|---|---|---|---|
| `movementCommands.ts`, preparación | 15 | natural explícito | Conserva colocación libre; variante natural sin eje |
| `movementCommands.ts`, Move activo | 122 | `steps[actualPath.length - 1]` | I6 lo reemplaza por Resolution/Commit ordinario; eje del último paso del prefijo re-resuelto |
| `tacticalCommands.ts`, Withdraw | 113 | `validation.value.steps` conserva eje | Propagar último paso validado que corresponde a `finalStep` |
| `tacticalCommands.ts`, Run | 209 | misma evidencia, ruta recta validada | Propagar último paso; entrar en squeezing solo si pipeline vigente lo permite |
| `tacticalCommands.ts`, Charge | 343 | natural explícito | Mantener pipeline y variante natural |
| `tacticalCommands.ts`, Five-Foot Step | 440 | `validation.value.steps` del único paso | Propagar evidencia si validación vigente permite squeezing; conservar presupuesto y prohibiciones |
| `gmCommands.ts`, teleport | 23 | natural explícito | Mantener variante natural |
| `specialManeuverCommands.ts`, bull rush | 355 | natural explícito | Mantener forced movement vigente |
| `attackCommands.ts`, resolveThreatOutcome | 364, 368 | natural explícito (origin/destination) | Mantener rollback/avance vigente |
| `attackCommands.ts`, handleResolveOpportunityAttack | 466, 470, 475 | natural explícito | Mantener tres ramas vigentes |

Los 9 sitios natural explícito no crean compresión y eliminan cualquier instancia previa y su eje como hoy. No inferir squeezing por el destino ni extender su semántica. Los 4 sitios de modo variable ya tienen evidencia: `validateMovePath` copia `squeezingAxis` de `legality.steps` a `MovementStepProjection` (`rules.ts:784-789`). No modificar `rules.ts`, Route Validation, Movement Cost, economía, AoO ni action semantics de tácticas. Five-Foot Step conserva `validateMovePath(..., true)`; Charge su pipeline vigente. Las 13 invocaciones quedan cubiertas.

Firma propuesta: mantener room/combatant/position y reemplazar el argumento de modo por la evidencia discriminada anterior. Validar correspondencia con el paso confirmado en el caller. Si falta el último paso, no coincide con el destino o falta eje para modo squeezing, rechazar antes de mutar posición, efectos, economía, logs o AdOs. No recalcular geometría dentro de Commit para recuperar evidencia perdida.

`spatialTransition.ts` y `movementCommit.ts` deben dejar de depender solo de `previousMode !== currentMode`. Natural elimina todas las instancias espaciales previas. Squeezing con eje igual y estado único válido puede preservar instancia; eje distinto reemplaza removeMany + add en estado candidato local. `onStack: "ignore"` de squeezing hace insuficiente un add directo para actualizar eje. Solo publicar candidato y posición una vez que todas las guardas terminan. Error/stale conserva room completo. Duplicados se rechazan en admisión de estado; no se selecciona la primera instancia como autoridad.

#### 8.7.8 Otros productores y compatibilidad de estado

Dos constructores espaciales explícitos: `spatialTransition.ts:35` y `movementCommit.ts:188`; ambos requieren adaptación. No se encontró otro literal constructor productivo de squeezing.

`gmCommands.ts:handleGmApplyEffect` admite cualquier ProductionEffectId y no tiene evidencia espacial. Decisión explícita: rechazar aplicación manual de `srd_squeezing` antes de construir/publicar el efecto; se obtiene por transición espacial validada. `handleGmApplyEnvironmentalHazard` ya exige bloque hazard, ausente en squeezing; mantiene rechazo. `abilityResolver.ts` y `environmentalHazardResolver.ts` aplican ids dinámicos: el catálogo actual no aporta squeezing por estas rutas; sus productores deben exigir evidencia espacial validada antes de crear squeezing orientable; no delegar esa garantía geométrica a EffectManager. No se agrega una entrada de eje cliente para legitimarlos.

`roomStore.ts` mantiene rooms en un Map en memoria; no se encontró loader de combates persistidos en el servidor. Snapshot usa clon explícito y distribución JSON. No se afirma haber auditado datos externos ajenos al repo. En despliegue, las salas en memoria creadas por código previo pueden contener compresión orientable sin eje: drenar/recrear esas salas antes de habilitar el contrato. Si se introduce restauración persistente, su admisión debe rechazar/quarantinar ese estado y pedir recreación o transición espacial explícitamente validada fuera del Commit. No migración silenciosa a partir de destino o candidatos. No hay fallback temporal de selección de eje aprobado.

Para geometría autoritativa: consultar instancia única, exigir eje en footprint orientable y usar `preferredAxis`; si proyección falla, error de integridad antes de uso de snapshot. La excepción no orientable solo soporta fixtures/reglas de modificadores sin autoridad espacial orientada; no habilita nuevas transiciones comprimidas no soportadas.

## Capítulo 9 — I7: Normative Movement Preview Parity

### 9.1 Alcance, autoridad y nivel

Baseline auditado: `650f22dd514fac56b033acb6e937b3aabe5cdc3d`. I6 está TECHNICALLY APPROVED por Architecture Review externa, según el owner. Este capítulo es diseño, no Proceed: no modifica el código, tests, protocolo ni reglas implementadas.

I7 migra únicamente el preview de Move ordinario activo. El servidor conserva resolución, tiradas, Commit y Publication; el cliente calcula una predicción local pura. Legalidad predictiva no es autorización de acción ni garantía de éxito. Matriz RAW: §8.3.2, sin otra tabla ni fórmulas React. Eje/lifecycle: §8.7. Contador: §6.13; autoridad: §6.14 y Capítulo 7.

Quedan fuera: migración semántica de Withdraw/Run/Charge/Five-Foot Step, colocación Preparation/GM, Forced Movement, Double Move, Spring Attack, D-7/TurnState, FoW, Accelerated Tumbling y preview normativo de AoO. Las superficies visuales compartidas reciben un discriminante de origen y conservan la rama legacy para esas operaciones.

Esta entrega es documental (Nivel A con auditoría/diseño de fronteras). La implementación diseñada es **Nivel B**: exclusivamente apps/web y cobertura asociada consumen APIs shared existentes, sin modificar contratos/shared TS, reglas, servidor ni wire protocol. No se rebaja una extracción C/D: se decide explícitamente no hacerla. Si al implementar apareciese necesidad objetiva de modificar shared/contracts/protocolo/servidor, ese cambio queda fuera de este plan B, exige reclasificación C/D y revisión/Proceed correspondientes. El owner exige Architecture Review y Proceed antes de implementar este diseño, incluso bajo el alcance B elegido.

### 9.2 Auditoría del repositorio real

Búsqueda exhaustiva en apps/web/src y helpers shared usados por web: nombres de coste/validación/resolver/comando, isAcrobatic, movementUsedFeet, contador, path, overlays, rangos, hooks y renderers. Líneas referidas al baseline, no a documentos antiguos.

| Archivo / componente o función | Matemática / responsabilidad actual | Fuente | ¿Duplica o diverge de I6? | ¿Presentación pura? | I7 | Rama que permanece legacy |
|---|---|---|---|---|---|---|
| `apps/web/src/hooks/useBoardSelection.ts:28-31` — displayedPath/movementPathCost/displayedPathCosts | Dos llamadas: coste total de draft y costes acumulados del path mostrado | Snapshot y selected; helpers legacy, sin Tumble | Sí, contra coste normativo | No: el hook decide fuente matemática | Ordinary usa proyección única | Charge, bull rush, Withdraw/Run/5ft conservan fuentes actuales |
| mismo hook:20-32 — highlightedCells/getChargePreviewPath/bullRushPreviewPath | Selección de rutas/highlights; bull rush deriva validateSpecialManeuver | Room/snapshot, modos/flags | Ordinary comparte selector con tácticas | Orquestación, no renderer | Discriminar previewKind antes de calcular | Preview de charge y forced movement no migrado |
| `apps/web/src/viewModel.ts:78-121` — getHighlightedCells | Presupuesto effective speed × factor de acción − movementUsedFeet; escanea tablero; usa isLegalNextPathStep | Room, snapshot, path, flags Withdraw/Run | Sí: ordinary acaba en validator/coste legacy; no contador recibido | No | Ordinary consulta pipeline para candidatos adyacentes | Factores Withdraw 2x/Disabled 1x, Run 4x/3x, ataque/ability/preparation |
| `apps/web/src/viewModel.ts:315-323` — isLegalNextPathStep | Guardas manuales de adyacencia/repetición y validateMovePath sobre path extendido | Nuevo snapshot creado por candidato; maxDistance + gasto previo | Sí: validación/coste legacy, no isAcrobatic ni paridad inicial | No | Deja de gobernar ordinary; no borrar función compartida | Validación visual táctica existente |
| `apps/web/src/viewModel.ts:43-75,123-170` — isFootprintInsideBoard/isCombatantDestinationOccupied/isFootprintPreviewLegal/getGmMoveHighlightedCells/getChargePreviewPath | Bounds, muros, ocupación; charge calcula speed ×2, coste legacy y mínimo 10 ft | Huellas shared, Room/snapshot; actor reanclado | Duplicación visual de chequeos; eje inicial puede no ser legal en destino hypothetical | No | Ordinary deja de reanclar actor para autorizar destino | Preparation, teleport GM y Charge permanecen existentes |
| `apps/web/src/viewModel.ts:173-188` — buildStraightPath | Construcción geométrica de ruta recta | Anclas | No autoridad de coste; uso Charge legacy | No, utility de autoría de ruta | Sin migración | Charge/Run según uso actual |
| `apps/web/src/App.tsx:46-48,103-105` — draft y rulesSnapshot | Estado de autoría; snapshot memoizado de Room | WebSocket Room | No matemática RAW | Orquestación | Propagar intención Tumble y previewKind; snapshot único | Flags tácticos/selección siguen locales |
| `apps/web/src/App.tsx:262-293` — handleCellClick | Filtra highlights y tokens; append/undo; Preparation y GM envían colocación | highlightedCells y clicks del Board | Ordinary depende de filtro legacy; token enemigo bloquea autoría CD25 | No | Ordinary usa resultados predictivos y editor de draft de §9.6 | Placement, tácticas y D-5 conservar routing |
| `apps/web/src/App.tsx:151-153,465-520` — moveSelected/confirmMovementPath/fiveFootStep | Intent ordinario con to/path; tácticas separadas; limpia draft | Draft local y flags | No coste enviado; ordinary omite isAcrobatic | No, transporte/orquestación | Ordinary añade boolean existente y no transmite resultados derivados | Run envía solo to; Withdraw to/path; 5ft to |
| `apps/web/src/App.tsx:761-763` — wiring Board/ActionsPanel/isMoveDestinationOccupied | Props de route/cost; chequea ocupación del actor reanclado en último destino | Room/snapshot y draft | Sí: chequeo paralelo puede ignorar huella predictiva/eje nuevo | No | Ordinary usa status pipeline para destino; misma proyección para Board y panel | Props/checks legacy tácticos separados |
| `apps/web/src/components/ActionsPanel/ActionsPanel.tsx:148-176,182-218` | Speed shared, presupuesto restante de acción y total de ruta recibido; disponibilidad Run/5ft; confirmación compartida | Rules.getMovementSpeedProjection, props y currentTurn | Duplica resta de presupuesto; hoy no distingue exceso/illegal | Mixto | Ordinary lee valores/status; selector Tumble y origen 5ft | Disponibilidad/economía y confirmación tácticas permanecen legacy |
| mismo panel:337 — preview Charge | Recalcula coste legacy para texto | chargePreviewPath + snapshot | Coste táctico fuera de I7 | No | No migrar | Charge |
| mismo panel:474 — alcance de conjuro | Usa calculatePathCostFeet como targetDistance | Target y snapshot | Uso de métrica movement para spell range; hallazgo ajeno a I7 | No | No corregir ni borrar helper por este uso | Spell range, follow-up separado |
| `apps/web/src/components/Board/presentationModel.ts:434-451,506-564` — buildBoardPresentationModel | Ocupación actual shared; ruta por anclas; footprint final solo charge/forced; etiqueta routeStepCost toma coste acumulado | Snapshot y props de paths/costs/highlights | Ordinary no tiene huella por Step; nombre stepCost es valor acumulado | Mixto: proyección visual + consultas shared, sin coste RAW | Ordinary consume occupiedCells/mode/eje/costes ya resueltos | Huella actual, terrain, cover/AoE/badges y rutas tácticas vigentes |
| `apps/web/src/components/Board/Board.tsx` — Board / rama 2D | Pasa props a presentationModel; pinta celdas/ruta/tokens/cámara | Un BoardPresentationModel | No fórmula de Movement Cost | Sí | Renderizar nuevos estados/huellas/labels recibidos | Toda presentación no ordinaria |
| `apps/web/src/components/Board/renderer/TacticalScene3D.tsx:300,446-462,560` | Hit testing, geometría de cámara, footprint visual y labels | El mismo presentation del Board | No norma de movimiento ni coste; escala del sprite de squeezing es cosmética | Sí | Consumir la misma semántica que 2D, sin resolver movimiento | Renderer 2.5D/WebGL, cámara y sprites |
| `apps/web/src/hooks/useWebSocketRoom.ts:40-66,100-107` — connect/room-update/send | Reemplaza Room recibido; JSON de Intent; invalidación de turno | hello/room-update/errores servidor | No coste; no preview request | Transporte | Mantener protocolo; recomputar en cada Room nuevo desde hook consumidor | Demo y demás comandos |
| `apps/web/src/components/SelectedInfo/SelectedInfo.tsx:20,41` y `CombatantsPanel/CombatantsPanel.tsx:94` | Presentan velocidad efectiva, no coste/budget de Route | Rules.getMovementSpeedProjection y snapshot | No fórmula RAW ni ruta paralela | Sí, consume regla shared | Sin cambio previsto | Información de ficha/GM/jugador |
| `apps/web/src/hooks/useBoardSelection.ts:17-18`, `viewModel.ts` — getRangePreview | Distancia entre footprints y penalizador de alcance de arma | Helpers shared de distancia y perfil de arma | No Movement Cost ordinary; preview de otra operación | Mixto, regla de alcance existente | Sin cambio previsto | Ataques/habilidades/alcance |
| `apps/web/src/hooks/useCombatActions.ts` | Dados cliente de ataques/daño, no movimiento | Opciones de ataque | No interviene en CD25/CD15 del movimiento | No, otra operación | No usar para Tumble | Ataques/daño |
| `apps/web/src/styles.css` | Clases de rutas/highlights y terrain | Datos presentacionales | Sin cálculo normativo | Sí | Estados distinguibles sin estética nueva completa | Estilo/cámara/map editor |
| `packages/shared/src/rules.ts` — calculatePathStepCostsFeet/calculatePathCostFeet/validateMovePath | Un cuerpo legacy de costes: diagonales locales, DT alternado 15/20, narrow por ancla, multiplicadores; wrapper total y validación | Snapshot, path; isAcrobatic opcional no enviado desde web | Sí vs I6: reinicia paridad y coste/geometría diferente | No | Ordinary web deja de llamarlos | Servidor táctico/UI táctica; no tocar shared |
| `packages/shared/src/movementResolution.ts` — resolveMovementPipeline | Route Validation → assessMovementCost → budget; steps, context y fingerprint | Snapshot/path/actor/budget/context/isAcrobatic explícitos | Misma autoridad matemática I6 | No, cálculo puro shared | Consumo directo, sin extracción | Servidor sigue re-resolviendo y comiteando |
| `packages/shared/src/routeValidation.ts`, `movementCost.ts`, `movementGeometry.ts` | Footprints/celdas legales, modo/eje, costes RAW y ocupación actual | Snapshot; eje persistido para ocupación inicial | Autoridad compartida, no duplicación web | No, contratos puros | Consumo por resolver; getCombatantOccupiedCells para actual/CD25 | Sin cambios a contratos/implementación |
| `packages/shared/src/combatSnapshot.ts`, `types.ts`, `movementContracts.ts`; `apps/server/src/room/roomStore.ts` | Snapshot defensivo, TurnState y axis; Room enviado por JSON completo | Sala autoritativa publicada | Ya contienen todos los inputs | Transporte/tipos/copias | Reutilizar tal cual | Sin endpoint/mapping/fingerprint cliente nuevo |

Inventario cuantificado, sin confundir llamada con fórmula:

- **Cero implementaciones RAW de coste en React/web**; **un cuerpo de fórmula legacy** en shared/rules.ts, consumido por cinco llamadas ejecutables de coste web: useBoardSelection ×2, getChargePreviewPath ×1, ActionsPanel Charge ×1 y spell range ×1. Wrapper total no es una segunda fórmula. La importación calculatePathStepCostsFeet en viewModel no se usa; no contar como llamada.
- Una llamada web a validateMovePath (isLegalNextPathStep); cero llamadas web a resolveMovementPipeline en baseline. No hay lectura del contador normalDiagonalStepsThisTurn en web ni estado/isAcrobatic/Tumble de movimiento.
- Tres expresiones web de presupuesto/rango de movimiento: getHighlightedCells (incluye factores Withdraw/Run), getChargePreviewPath y lectura disponible en ActionsPanel. Dos selectores locales de factor táctico (Withdraw/Run) y guardas manuales de adyacencia/repetición/footprint; no son fórmulas RAW adicionales.
- Dos vistas del mismo Board (2D y 2.5D), no dos engines. GM/jugador/demo comparten árbol; no se encontró tablero mobile/companion independiente, hook/store/selector adicional de coste ni indicador de rango normativo separado. El verde actual significa siguiente extensión que el validator legacy admite, no un flood-fill de destinos alcanzables. ProfilesPage/useStoredProfiles no hacen preview de movimiento.

### 9.3 Decisión de reutilización y snapshot de entrada

**Seleccionada A:** ejecutar directamente resolveMovementPipeline desde web. B (extraer otro compositor inferior) descartada porque el resolver actual es puro, portable y expone toda evidencia necesaria. No hay RNG ni node:crypto; fingerprint es string determinista y no añade autoridad al cliente. Calcularlo y no mostrar/transmitirlo es aceptable; no alterar shared para evitar esa metadata.

El Room recibido por hello/room-update es CombatRoom completo: board (incluidos difficult/narrow/impassable), combatants/perfiles/equipo/efectos, currentTurn.movementUsedFeet y normalDiagonalStepsThisTurn, phase y constraints. createCombatRulesSnapshot ya copia currentTurn y squeezingAxis en effectInstances. Rules.totalSpeedFeet deriva velocidad efectiva de esas fuentes como en I6. No falta ningún input. No nuevo endpoint ni preview request-response.

El hook consume el snapshot memoizado de App basado exclusivamente en Room recibido, nunca presentationRoom con draftBoard de D-5. Actor: proyección del combatiente identificado por selected.id dentro de snapshot.combatants; no mezclar posición de otra revisión ni usar un clon reanclado como autoridad. No necesita referencia LIVE de servidor: esa condición pertenece a Commit y el cliente nunca lo llama. Ordinary solo proyecta el actor del turno actual; para otro seleccionado no se mezcla su speed con el budget/context de otro turno y se muestra unavailable.

Inputs para cada ruta candidata: path copiado con x/y/zFeet, copia `initialContext.normalDiagonalStepsThisTurn` del snapshot (nunca cero fijo), availableBudgetFeet = max(0, Rules.totalSpeedFeet(snapshot, actor) − snapshot.currentTurn.movementUsedFeet), isAcrobatic de intención local. No reducir speed/budget otra vez por Tumble. Vacío se presenta como draft vacío sin invocar una Route ilegal vacía. La paridad proyectada nunca se escribe a Room/cache autoritativa.

### 9.4 Fuente presentacional única y contrato mínimo

Se elige `apps/web/src/movementPreview.ts`: adapter puro web, no segunda autoridad. Ejecuta el resolver y deriva etiquetas/discriminantes de presentación. `useBoardSelection` memoiza esta proyección y candidatos; Board/ActionsPanel reciben la misma instancia/evidencia. No React state paralelo de costes ni cómputos por renderer.

Contrato conceptual web `MovementPreviewProjection` discriminado:

- `empty`: sin steps, total 0, presupuesto disponible y contexto inicial sin consumo; no implica ready.
- `legal`: resultado shared ready, steps completos y totalCostFeet/remainingBudgetFeet/projectedContext exactos.
- `over-budget`: resultado insufficient-budget, steps completos, total desde requiredCostFeet, availableBudgetFeet y contexto proyectado exactos; remainingBudgetFeet firmado = availableBudgetFeet − requiredCostFeet, excessFeet = su magnitud negativa. Presentación de saldo, no fórmula de Movement Cost nueva.
- `illegal`: reason y failedStepIndex del resultado illegal-route; conserva path intentado, no tiene total/remaining/projectedContext de ruta evaluada. Shared no devuelve steps válidos en esa variante: no fabricar coste cero ni prefix Resolution ni truncar ruta para obtener un total.
- `unavailable`: faltan Room/actor, el actor no coincide con currentTurn.combatantId para preview ordinary activo, o hay error de integridad espacial reportado por shared. Mostrar diagnóstico y bloquear confirmación; no convertir en legal/illegal por fallback natural/eje inventado.

Para legal/over-budget, conservar steps del resultado por referencia de solo lectura (position, occupiedCells con zFeet, spatialMode, squeezingAxis, isDifficultTerrain, stepCostFeet, cumulativeCostFeet y resultingContext). Fingerprint/combatantId/base route metadata pueden quedarse privados en el resultado compartido; no nuevas copias normativas. Una envoltura presentacional basta: no cambiar MovementResolutionResult para UI.

Autoría/availability es una dimensión separada: acción bloqueada por permisos/turno/canUseMoveAction/Rules.evaluateActionAvailability/5ft/attackMode no convierte una Route geométricamente legal en illegal. Mostrar razón de acción no disponible y deshabilitar Confirmar. Reutilizar guards shared existentes y condiciones congeladas de I6 (full, o standard aún no consumido); no implementar nueva economía. Pendientes/demo/D-5 no habilitan envío. `ready` del resolver nunca se muestra como éxito confirmado.

### 9.5 Representación visual y métricas

| Estado | Ruta/coste/saldo | Confirmación ordinaria |
|---|---|---|
| legal | «Ruta prevista: X ft; quedarían Y ft»; pasos/huellas confirmados predictivamente | Habilitada solo si acción/control disponibles; envía Intent |
| over-budget | Mantener todos los steps; destacar desde primer cumulativeCostFeet > availableBudgetFeet; saldo negativo y exceso explícito | Deshabilitada; servidor también rechaza toda la ruta, no un prefijo por presupuesto |
| illegal | Anclas intentadas; failedStepIndex marcado; suffix no evaluado. Motivo exacto; coste/saldo de ruta «no evaluado» | Deshabilitada; no asumir huella/coste legal del paso fallido |
| empty/unavailable | Sin proyección válida; empty muestra presupuesto sin gasto; unavailable diagnóstico | Deshabilitada |

Normative step overlays usan occupiedCells, no actor reanclado en destino ni eje inferido por dirección visual. Mostrar modo/eje de cada step y footprint final predictivo como overlay/ghost; el token actual permanece en la posición publicada. Inicial: getCombatantOccupiedCells del snapshot respeta eje persistido. Cambiar cámara solo proyecta las mismas celdas.

isDifficultTerrain viene del step (toda huella, no ancla). Squeezing viene de spatialMode/eje; Tumble se etiqueta desde isAcrobatic. Terrain de fondo actual se sigue pintando como hoy; no usa esos badges para calcular coste.

En baseline la etiqueta `routeStepCost` contiene acumulados de displayedPathCosts. I7 mantiene la etiqueta de coste acumulado sobre ancla para continuidad; puede mostrar stepCostFeet individual en tooltip/panel, etiquetándolo explícitamente. No confundir ninguno con Spatial Distance ni base-route stats. ActionsPanel lee total/saldo del adapter, no vuelve a restar/recostear. No replicar matriz RAW en JSX.

### 9.6 Autoría de ruta, Tumble y separación táctica

Se congela previewKind en capa web: ordinary-move, placement, gm-placement, legacy-withdraw, legacy-run, legacy-five-foot-step, legacy-charge, legacy-forced o none. Solo ordinary-move con phase active ejecuta la nueva rama. Selección GM/jugador no cambia la matemática; permisos solo controlan interacción. Demo de solo lectura no habilita comandos.

La UI actual no tiene fiveFootStepArmed: comparte draft y botón directo de confirmación con ordinary. Para evitar que el nuevo status/confirmación ordinario cambie esa operación, añadir selector local explícito de preview Five-Foot Step en el panel Move (estado de presentación, no nuevo comando/semántica). Su edición, coste/validación y confirmación conservan el branch legacy y canUseFiveFootStep. El control existente Confirmar Paso sigue enviando solo to. Withdraw/Run mantienen flags exclusivos y rutas/confirmaciones actuales. Cambiar previewKind limpia el draft como hoy al armar Withdraw/Run; no introduce Double Move. El modo 5ft no hereda Tumble ni status ordinario.

Autoría ordinary:

1. Una sola proyección para el draft actual. Evaluar por el mismo adapter las extensiones adyacentes del último ancla (o del origen si vacío), como máximo ocho candidatos; no rescanning de todo tablero con resolver por celda.
2. Mapa de candidatos guarda status/razón, no solo verde=true. Extensiones legal/over-budget se pueden añadir; confirmar over-budget sigue prohibido. Añadir una extensión illegal está permitido únicamente como edición de draft inválido, nunca como aceptación predictiva. Esto permite construir tránsito Tumble por enemigo cuando una ruta provisional termina en su casilla y es illegal hasta añadir una salida libre. No convertir la razón de shared en una excepción de legalidad local.
3. El renderer comunica estado por texto/marker/clase, no solo color. Click no se bloquea por token enemigo en el branch ordinary de autoría; endpoint ocupado sigue illegal según resolver. La ruta debe acabar libre para ser legal. Muros/duplicados/ruta inválida pueden visualizarse como draft invalidado; Deshacer/Limpiar siguen disponibles sin validación. No fórmulas de colisión/ocupación/adyacencia para otorgar legalidad: la enumeración de vecinos es gesto de editor, resultado siempre shared.
4. El mapa no promete destinos alcanzables a múltiples pasos ni pathfinding automático. No añade BFS/A*/rango táctico nuevo. Snapshot cambiado puede invalidar draft existente; mostrar resultado nuevo y conservar draft corregible, no recortar/silenciar error.
5. Click 2D/2.5D suministra x/y; para ordinary construir Position preservando zFeet actual del actor salvo posición explícita de draft. Baseline presentationModel crea celdas a zFeet 0: no permitir que un click ordinario cambie altura inadvertidamente. No diseñar movimiento vertical ni interpretar altura cosmética de 2.5D.

Tumble: nuevo boolean local, default false, limitado a ordinary. Cambiarlo reevalúa draft/candidatos; no muta Room. No llamar useCombatActions ni tirar dados de movimiento. Con legal/over-budget, detectar necesidad CD25 por intersección entre steps.occupiedCells y huellas shared de enemigos, con misma exclusión de dead/dying/stable que I6. Esta comparación es una anotación de evidencia, no cálculo de Route/Movement Cost ni determinación RNG. Mostrar step y enemigo: «requiere prueba CD25; el servidor puede interrumpir la ruta». Si illegal no hay steps y no se fabrica esa anotación.

CD15/AoO: no nueva simulación de amenazas. No se encontró un overlay predictivo de AdO de Move ordinario: panel muestra pendientes ya publicados y mensajes de tácticas (p. ej. Prone Eschewal seguro). Mantenerlos. Tumble puede advertir genéricamente que el servidor determina evitación CD15 cuando haya provocación; no declarar seguro ni contar AdOs a partir de la predicción. CD25/CD15 pueden cambiar ruta efectiva y coste gastado; X es coste previsto de la ruta completa, no promesa de Commit.

Preparation permanece free placement, sin costes normativos ni contexto proyectado. Desactivar/hide bloque de saldo de Move y Tumble en placement; conservar helpers/routing actuales, sin ampliar reglas de colocación. D-5 draftBoard no alimenta preview activo y bloquea interacción como hoy. Charge/bull rush/spell range/ataques no adoptan el adapter.

### 9.7 Staleness, Intent y wire contract

Payload auditado: ClientCommand y moveCombatantSchema ya admiten to, path opcional e isAcrobatic opcional; no incluyen coste, budget, validez, modo/eje ni paridad. App hoy omite el boolean. Futuro envío ordinary: mismo comando, to = último path, path íntegro copiado, isAcrobatic actual. Si path ausente se conserva fallback servidor [to]. No fingerprint/preview-id/version cliente confiable, ningún campo normativo derivado, sin cambio de schema/endpoint.

Preview desde snapshot N; confirmación expresa intención, no locking. Servidor re-resuelve desde N+1 y puede rechazar o resolver distinto; su CD25 puede confirmar solo prefijo. El cliente no comitea ni hace optimistic update de posición, effects, budget/context ni stats. Room solo cambia por WebSocket. onActiveTurnChanged mantiene limpieza existente; room-update con mismo actor invalida memo/recalcula ruta sin borrar silenciosamente. Un snapshot de servidor incompatible/axisless muestra error de integridad, nunca orientación normativa inventada.

Después de send, se conserva el comportamiento actual de clearActionOverlays y error de comando; no cambiar acknowledgement/protocolo para previews. Toggle Tumble vuelve a default al cambiar actor, entrar placement/táctica/demo/map-editor o limpiar ciclo de overlays tras envío. No se transmite metadata de la resolución al servidor.

### 9.8 Estrategia de pruebas futuras y decisiones cerradas

Pruebas futuras, sin modificar tests en esta entrega:

- Paridad adapter cliente == server resolveMovementPipeline para el mismo snapshot/actor/path/isAcrobatic/budget/context. Comparar status, steps/celdas xyz, costes, contexto y presupuesto; no tomar Commit como predictor.
- Casos RAW de §8.3.2, ortogonales y diagonales, inicial != 0, normal → hampered → normal, preview repetido/edición/cancelación sin mutación y presupuesto exacto/excedido. Para combinaciones squeezed diagonales que geometría actual no permita, comprobar rechazo del resolver y validar matriz en assessment shared existente; no fingir una ruta legal por perseguir cobertura numérica.
- Eje persistido horizontal/vertical inicial y proyección en giros/ambigüedad/salida; no mutation de EffectInstance/currentTurn/Room. Estado corrupto => unavailable explícito. Illegal no expone un total/prefijo ni eje inventado.
- UI: una fuente de total y saldo; step/cumulative labels correctos; illegal distinto de exceso; Tumble toggle, CD25 contingente sin RNG; autoría a través de endpoint provisional enemigo y salida libre; ruta inválida corregible. Ambos renderers/cámaras muestran mismas huellas/axis/status, sin cálculo de coste.
- Separation: preparation/GM/demo/D-5 no activa adapter ordinario; snapshot no usa draftBoard; modo 5ft explícito mantiene su preview/confirmación legacy; Withdraw/Run/Charge/forced/spell previews idénticos al baseline. Intent contiene solo campos existentes; isAcrobatic presente según intención, ningún coste/axis/fingerprint. Sin optimistic Room update.
- E2E: preview X y server movementUsedFeet aumenta X cuando snapshot/tiradas contingentes no cambian; tras room-update recalcular, tras cambio entre preview/click el servidor decide. Para Tumble CD25 success/failure usar dados autoritativos preparados en tests, no promesa cliente.
- Regresión completa: Move servidor I6, acciones tácticas, D-5, demos y presentación 2.5D. Gates de implementación: npm test, typecheck, build, WebSocket y Playwright. Conteos reales y CI registrados entonces, sin reclamar tests implementados ahora.

Respuestas explícitas de cierre:

1. Archivos/componentes actuales: tabla §9.2; hook y viewModel calculan ordinary, panel mezcla budget/legacy, Board presenta.
2. Fórmulas/calls reales: un cuerpo shared legacy, cinco llamadas de coste web, una validación web y tres expresiones de presupuesto/rango; cero resolver web/costes RAW React. Selectores/chequeos distinguidos en inventario.
3. Web puede ejecutar directamente resolver puro; opción A seleccionada, sin extracción B.
4. Room/snapshot ya tiene todos los inputs; no requiere protocolo nuevo.
5. ViewModel mínimo web presentacional por estados/consumidores; conserva evidencia del MovementResolutionResult sin nuevo pipeline.
6. Illegal carece de steps/coste; insufficient-budget conserva ruta/coste/context, exceso visible y sin truncado; unavailable cubre integridad.
7. Tumble local ×2 por shared; CD25 como anotación de evidencia y resultado contingente; CD15/AoO definitivo servidor.
8. Preparation branch placement puro fuera del adapter activo.
9. Previews tácticos permanecen legacy con previewKind, incluido selector local 5ft para aislar draft/confirmación.
10. Wire sin cambios; activar isAcrobatic ya existente, no transmitir derivados.
11. Implementación elegida Nivel B estrictamente web; cualquier expansión shared/protocolo/servidor exige C/D y revisión nueva. Este diseño espera Review/Proceed.
12. Después de implementación se elimina exclusivamente el uso ordinary de legacy cost/validate/destination reprojection y resta redundante del panel; import no usado de viewModel puede limpiarse. **No** borrar helpers shared ni rutas tácticas/Charge/spell range/preparation. AoO predictivo, rango de conjuro basado en movement y preview táctico normativo son follow-ups fuera de I7, no ODR bloqueantes de este diseño.

## Capítulo 10 — I8: Tactical Movement Consumers Migration Sequencing

### 10.1 Estado, autoridad y baseline

**Registro de la entrega de diseño I8 (anterior a implementación).** Baseline inspeccionado: `67f6c3659e3e6be5b3111b8f1855d8c44dc212c9`, master limpio y coincidente con origin/master. I6 e I7 TECHNICALLY APPROVED según el owner; Windows CI I7 SUCCESS. Este capítulo selecciona **solo Withdraw servidor** como siguiente implementación. No autoriza código, tests ni migración de los otros consumidores.

Este NDD posee la integración con Movement; las reglas particulares pertenecen a [Withdraw Rev. 3](withdraw/design.md), [Run](run-design.md) y [Five-Foot Step](five-foot-step.md). No se encontró NDD dedicado a Charge en docs/designs: el comportamiento auditado se localiza en chargeResolver/tacticalCommands, tests y corpus de combate; no se inventa un contrato aprobado ausente. Los pasajes antiguos que dicen «pendiente de implementación» en NDD específicos describen sus entregas originales, no HEAD. El [plan ejecutado](movement/withdraw-implementation-plan.md) deriva exclusivamente de §10.5. Aclaración factual posterior: diseño aprobado sobre 61c7e96 y ejecutado con Proceed del owner; Withdraw servidor consume ahora Resolution/Commit existentes, conserva políticas propias y deja preview legacy. DoD local verde, Ready for Architecture Review de implementación. Las tareas futuras conservadas abajo registran el diseño original, sin autorizar otros consumidores.

### 10.2 Auditoría real por consumidor

Rutas relativas a la raíz; referencias a símbolos, verificadas en el baseline, no números históricos de línea. `TC` = apps/server/src/commands/tacticalCommands.ts; `R` = packages/shared/src/rules.ts; `ST` = apps/server/src/combat/spatialTransition.ts. Los cuatro entran por handleUseTacticalAction (phase, ownership, turno, snapshot y Rules.evaluateActionAvailability).

| Aspecto exigido | Five-Foot Step | Withdraw | Run | Charge |
|---|---|---|---|---|
| Handler productivo | TC.handleFiveFootStep | TC.handleWithdraw | TC.handleRun | TC.handleCharge; combat/chargeResolver.ts |
| Validator/path actual | canUseFiveFootStep; validateMovePath([to], cellSizeFeet, true), que delega geometría a validateRouteLegality | canUseMoveAction + guards propios; path recibido o [to]; validateMovePath(..., budget, false, false) + ocupación V1 adicional | canRun; buildStraightPath servidor, solo ortogonal/45°; validateMovePath + prohibición DT y ocupación V1 | canCharge/canFullAttack; findChargePath busca destinos en todo el tablero y ordena por distancia; buildStraightPath; NO usa validateMovePath/Route Validation |
| Fuente de coste | R.calculatePathStepCostsFeet dentro de validateMovePath; una sola ancla | Mismo calculador legacy; distanceFeet mezcla coste con distancia | Mismo calculador legacy; distanceFeet mezcla coste con distancia | chargeResolver.calculatePathDistanceFeet, 5/10 local, sin Movement Cost |
| Budget | cellSizeFeet menos movementUsedFeet; speed efectiva debe superar una casilla por canUseFiveFootStep | speed efectiva ×2, o ×1 si gate Disabled full-round falla y standard acepta; turno exige gasto previo cero | runSpeedBudgetFeet = Rules.totalSpeedFeet ×4/×3 según armadura pesada | findChargePath limita distancia local a 2× speed y mínimo 10 ft; destino a meleeReach del perfil equipado |
| Mutación espacial | ST(command.to, finalSpatialMode/eje validado) | ST(última ancla, modo/eje validado) | ST(última ancla, modo/eje validado) | ST(última ancla, natural forzado) |
| TurnState/stats | usedFiveFootStep=true; movementUsedFeet y stats.distanceMovedFeet += distanceFeet; no usedMoveAction | gasto y stats += distanceFeet; normal usedFullAttack=true, limitada usedStandardAction=true; sin trío redundante | gasto/stats += distanceFeet; usedFullAttack=true; sin trío redundante | gasto/stats += distancia local; usedFullAttack=true; consecuencias de ataque/threat posteriores |
| AoO | No llama helper: exención propia de la acción | findTriggeredOpportunityAttacksForPath con huella inicial completa exenta, false y validation.steps; pendientes después de transición completa | Mismo helper sin exención, false y validation.steps; sin interrupción durante ruta | Mismo helper sin confirmedSteps ni exención; pendientes antes del ataque; pruneInvalidOpportunityAttacks al final |
| Squeezing | Legacy devuelve modo/eje; ST persiste srd_squeezing; narrowCells puede encarecer/rechazar el único paso | Geometría común ya produce steps/axis; ST conserva/cambia/elimina efecto | Igual; no existe rechazo absoluto específico de squeezing (DT sí) | Huella actual reanclada en búsqueda; no transición natural↔squeezing por Route; fuerza natural al confirmar |
| Diagonal context | No lee/escribe normalDiagonalStepsThisTurn; el único paso reinicia paridad local | Legacy reinicia diagonales por ruta, no actualiza contexto del turno; DT alterna 15/20 | Mismo reinicio; DT se rechaza, diagonales normales siguen paridad local | Contador privado de calculatePathDistanceFeet empieza cero; no lee/publica contexto canónico |
| Preview actual | I7 legacy-five-foot-step, selector local; hook calcula costes legacy, canUseFiveFootStep y botón de un paso | I7 legacy-withdraw; getHighlightedCells escala ×2/×1, path/costes legacy, panel turnVirgin | I7 legacy-run; rango ×4/×3 y costes legacy, canRun; servidor reconstruye línea desde to | I7 legacy-charge; viewModel.getChargePreviewPath busca ruta local; panel calculatePathCostFeet; intención targetId/tiradas |
| Engine ya reutilizable | Route/footprints; Resolution ordinario no expresa por sí solo la excepción táctica | Resolver completo con budget caller y contexto; Commit; helper AdO acepta Resolution.steps estructuralmente | Resolver/Commit con budget caller y ruta construida; restricciones Run externas | Route/Resolution/Commit para una ruta candidata; selección de destino y ataque siguen fuera |
| Bridge/refactor pendiente | Excepción de coste/contabilidad y paridad, restricciones origen/destino DT; no fabricar ready ni compensar gasto tras Commit | Sustituir validateMovePath/ST/escrituras de gasto; conservar ocupación V1, exención, economía/esfuerzo/logs en caller | Conservar línea/DT/ocupación, postura/dote y economía alrededor del engine; revisar entrada desde squeezing | Separar selección, elegibilidad de ruta y movimiento del ataque; geometría/terreno y snapshot de ataque; sin rollback global automático |
| Shared requerido | No demostrado que APIs actuales basten para excepción 5ft; requiere diseño propio antes de elegir forma | **No**: APIs actuales suficientes; tampoco schema/protocolo | No parece necesario para integración de slice actual; confirmar en su propio diseño | No decidible sin diseño del selector y frontera de ataque; no preautorizar extensiones |
| D-7/nueva economía | No exige D-7 para paso aislado; la excepción de coste sí debe cerrarse aparte | **No**: una ruta, turno virgen, economía existente | No para Run actual aislado; resistencia multi-asalto es DT-018, no D-7 | Una carga aislada no exige D-7; Spring Attack/fragmentación sí quedan fuera |
| Riesgo | Alto para una sustitución ingenua pese al handler pequeño | Medio y acotado; cobertura específica de exención y ambas economías | Medio/alto: full-round + postura/efecto/dote + prohibición DT | Alto: selector propio, ataque/amenaza crítica, modifiers y commit previo al ataque |

Evidencia adicional y límites del inventario:

- R.validateMovePath contiene gates activeAttackThreat/canTakeTurn/usedFiveFootStep que **no** pertenecen al resolver. No se pierden al eliminar esa llamada: Withdraw ya los cubre mediante guards propios/canUseMoveAction; no confiar en el fingerprint para autorización de acciones.
- R.calculatePathStepCostsFeet/calculatePathCostFeet mantienen matemática legacy. movementCost.assessMovementCost y movementResolution.resolveMovementPipeline usan la matriz I6, contexto entrante y evidencia espacial, sin economía de acción. movementCommit.commitMovementResolution aplica coste, distancia base y contexto, y valida actor vivo/turno/ronda/origen/gasto/paridad/fingerprint antes de escribir. No hace broadcast ni marca acciones.
- ST solo confirma posición/efecto/eje; no valida vigencia de una Resolution, gasto ni contador. No se debe llamar además de Commit para la misma ruta.
- findTriggeredOpportunityAttacksForPath admite las huellas de Resolution como octavo argumento. Conserva internamente un contador 5/10 local para metadata movementCostFeet remanente, y el early return distanceMovedFeet <= cellSizeFeet. **No consume** stepCostFeet/cumulativeCostFeet para esa metadata. I6 ya usa este bridge. I8 no lo describe falsamente como coste normativo por paso ni lo transforma en presupuesto: la futura slice Withdraw conserva esta semántica del helper y cambia solo su total de entrada al totalCostFeet confirmado. No corregir globalmente AdO dentro de esta migración.
- Charge no comprueba DT/narrow como prohibición específica ni esquinas vía Route Validation; comprueba huella/bounds/impassable y ocupación (incluso helpless/dead bloquean en su selector). Esto es un gap registrado, **no** una regla RAW nueva ni autorización para corregirlo ahora. No hay rollback explícito del movimiento si falla el ataque posterior: movimiento, gasto y pendientes se escriben antes de resolveAttack; el broadcast ocurre al final.
- Tests reales: withdraw.test.mjs W-S1…W-S9 cubren exención, Large, múltiples reactores, reach, orden y default neutro; withdraw-server.test.mjs W10…W27 cubren budget, Disabled/esfuerzo, economía exacta, DT, bloqueos, control/schema y AdO post-transición. W26/W27 se titula Charge pero su cuerpo solo ejercita Move ordinario: no atribuirle cobertura Charge que no ejecuta. Run tiene run.test.mjs R-U1…R-U21 y run-server.test.mjs R1…R18, incluida postura/dote. five-foot-step.test.mjs prueba gates y parte de economía con estado simulado, no un test integral de Commit normativo. Charge aparece en rules.test.mjs (ruta bloqueada por aliado/helpless/dead), opportunity-phase.test.mjs, conditions-v3/entangled/exhausted y scripts/e2e-websocket.mjs; cobertura dispersa, sin suite dedicada encontrada.
- Fixtures antiguos de withdraw-server y run-server construyen TurnState sin normalDiagonalStepsThisTurn. Al migrar el seleccionado habrá que inicializarlo en fixtures, sin fallback productivo a cero. Ningún test se modifica/ejecuta en esta entrega documental; evidencia histórica I7 permanece en master-coverage.
- El NDD histórico five-foot-step.md aún describe detección implícita en Move, terreno difícil «no implementado», bloqueo Entangled y una nota Large de 10 ft. HEAD ya declara la acción explícita, valida DT en huellas de origen/destino, usa cellSizeFeet como budget y canUseFiveFootStep no contiene un veto nominal Entangled (consume velocidad efectiva/traits). Estas frases históricas no se usan para inventar equivalencia RAW ni para escoger 5ft por tamaño del handler; su reconciliación pertenece al diseño específico posterior. La autoridad de integración no convierte esas afirmaciones en reglas del core.

### 10.3 Budget, excepción 5ft y D-7 gate

El resolver ya acepta **un número disponible provisto por caller**: no necesita RunMovementResolver, WithdrawMovementResolver ni ChargeMovementResolver. Withdraw y Run pueden suministrar sus máximos propios tras autorización; Charge debe además separar el criterio de mínimo/selección de destino del coste de la ruta. No crear una interfaz shared de Budget Policy: para Withdraw una variable local numérica basta.

Five-Foot Step **sí** puede compartir Route Validation sin generalizar su excepción. **No** se demuestra que pueda compartir Resolution/Commit ordinarios sin diseño adicional: con contexto diagonal impar el resolver cobra 10 ft a una diagonal normal, mientras el legacy de un paso cobra 5; en squeezing el coste impedido y la contabilidad fija del recurso tampoco son intercambiables. Dar budget 5, budget infinito, resetear contexto a cero, modificar una Resolution o restar gasto después de Commit no resuelve legítimamente esa frontera. Sus restricciones de DT en origen/destino y su no-AdO seguirán en el consumidor. No se elige hasta cerrar una política explícita sin convertir la excepción en regla general. Esta decisión diferida del consumidor no seleccionado no es ODR bloqueante de Withdraw.

Withdraw/Run actuales exigen un turno sin movimiento; la ruta completa puede reutilizar contexto canónico aunque habitualmente sea cero. Una prueba con contexto no cero y gasto cero verifica que el caller no lo resetea. Esto no habilita múltiples Routes voluntarias, Double Move, estándar convertida en Move, movimiento fragmentado, Spring Attack, reserva/continuación de budget ni TurnState nuevo. Esas decisiones pertenecen a D-7 y no son prerrequisitos de Withdraw aislado. No renombrar usedFullAttack; conservar su significado vigente de full-round consumido. Run multi-asalto/visión siguen sus divergencias DT-018/019 aprobadas, independientes de esta secuenciación.

### 10.4 Decisión comparada y orden recomendado

| Criterio | Five-Foot Step | Withdraw — **seleccionado** | Run — segundo recomendado | Charge |
|---|---|---|---|---|
| Complejidad / reglas específicas | Handler pequeño; excepción de coste/contabilidad no expresada | Media: dos budgets/economías, ocupación y exención ya aisladas | Media/alta: línea, DT absoluto, armadura, dote, efecto defensivo | Alta: búsqueda, mínimo/reach, blockers, ataque +2/CA -2 y crítico |
| Shared / server / UI futuros | Shared por determinar; server pequeño; preview separado | Ningún shared; TC.handleWithdraw y tests; **cero UI** | Shared posiblemente ninguno; handler y pruebas; preview separado | Frontera shared por revisar; selector/handler/ataque; preview distinto |
| Dependencia D-7 | No para aislado; sí si se mezcla con fragmentación | Ninguna | Ninguna para slice actual | No para carga única; fuera Spring Attack |
| Cobertura útil existente | Gates/simulación + E2E, insuficiente para excepción nueva | Suite de helper y suite servidor con casos de presupuesto/exención/economía | Suites específicas comparables; añade efecto defensivo | Dispersa; huecos de geometría/terreno/ataque |
| Riesgo / reutilización I6 sin extensión | Alto / no directo para coste especial | Medio / directo, sin Tumble ni RNG precommit | Medio/alto / directo para movimiento, más consecuencias | Alto / parcial |
| Beneficio de retirar legacy | Un paso, ganancia pequeña hasta cerrar excepción | Costes DT/stacking, huellas/eje, contexto y stale de rutas completas | Contexto/commit de rutas largas; DT prohibido reduce la divergencia de coste expuesta | Alto, pero fusiona más fronteras y cambios observables |

**Única migración futura seleccionada: Withdraw servidor.** Run es recomendación segunda, no un segundo plan aprobado. Five-Foot Step queda condicionado por su política especial; Charge por el contrato de selección/terreno/ataque. Ninguno queda artificialmente bloqueado por D-7 si su slice aislada puede conservar la economía vigente. No se diseña aquí su implementación.

### 10.5 Diseño completo del consumidor seleccionado — Withdraw servidor

**Scope futuro: Nivel C**, porque GOVERNANCE §5.2 incluye resolvers/commands de servidor aun usando APIs existentes. Diseño y Proceed explícito obligatorios; no rebajar a B por no tocar shared. No es D mientras no cambien contratos, snapshots, arquitectura de comandos ni Commit. Si surge necesidad objetiva de ello, detener y reclasificar con nueva Review; no ampliar scope durante ejecución.

1. **Guardas y snapshot.** Conservar entrada de handleUseTacticalAction (active/control/ensureActiveTurn/snapshot/availability). Conservar pendingOpportunityAttacks vacío; canUseMoveAction (activeAttackThreat, canTakeTurn, CANNOT_MOVE, total defense y economía); attackMode none, !usedStandardAction, !usedFiveFootStep, attacksMade=0 y movementUsedFeet=0. canUseMoveAction preserva !usedMoveAction/!usedFullAttack. Capturar actor desde el mismo snapshot por id para resolver y la referencia viva de room para Commit. Validar estructura/contexto finito recibido; no inventar contexto si falta. Antes de Commit, ninguna mutación autoritativa.
2. **Variante/budget.** Conservar exactamente canDisabledCombatantTakeAction(full-round); si falla, exigir standard como hoy. El caller calcula speedFeet con Rules.totalSpeedFeet(snapshot, actor) y availableBudgetFeet = speedFeet × (limitada ? 1 : 2). Como las guardas exigen gasto cero, no reutilizar el budget de Move ordinario ni descontar dos veces. Ninguna política de acción entra en Movement core.
3. **Route y contexto.** Copiar command.path si no vacío, de lo contrario [command.to], como hoy; el último path es destino efectivo (no introducir un nuevo chequeo de igualdad con to). Conservar xyz recibido; no pathfinding, recorte, línea recta ni movimiento vertical nuevo. initialContext copia normalDiagonalStepsThisTurn del snapshot, aunque no sea cero. isAcrobatic=false obligatorio; no Tumble/CD25/CD15 ni nuevo campo wire.
4. **Resolution.** resolveMovementPipeline({context:snapshot, combatant:snapshotActor, path:candidatePath, availableBudgetFeet, initialContext, isAcrobatic:false}). illegal-route: error reason, cero publicación. insufficient-budget: error requiredCostFeet/availableBudgetFeet, cero publicación; no prefijo aceptado. ready es la única entrada a Commit; conservarlo íntegro, sin fabricar/modificar fingerprint, steps, coste o contexto. Sin validateMovePath ni calculatePath* en esta rama.
5. **Reglas V1 adicionales.** Después de ready y antes de Commit, conservar el loop actual de ocupación Withdraw: comparar cada steps[].occupiedCells con huellas de otros, ignorar solo dead; tránsito bloquea enemigos incluso dying/stable; destino bloquea cualquier no-dead. Route Validation general permite excepciones helpless que Withdraw V1 prohíbe: no borrar este gate ni añadirlo al núcleo. No reanclar actor ni fallback de footprints; usar evidencia de steps. Ante corrupción espacial, error sin mutación.
6. **AdO precommit.** Construir exemptDepartureCellKeys de la huella inicial completa del snapshot, incluidos z/eje persistido. Llamar helper existente con snapshot, snapshotActor, candidatePath, resolution.totalCostFeet, callback Rules.canMakeOpportunityAttack(snapshot,...), false, exemptDepartureCellKeys y resolution.steps. Bufferizar pendientes/logs. Mantener early return, AOO-03/Reflejos, LoE/Cover/Concealment y limitación de metadata descrita en §10.2; no nueva simulación, corrección global ni resolución durante la ruta. El resto del camino provoca con semántica actual; no convertir exención de origen en safe global.
7. **Vigencia/Commit.** Capturar preconditions al crear snapshot: expectedTurnCombatantId, expectedRound, expectedOrigin xyz, expectedMovementUsedFeet y expectedDiagonalContext. Usar commitMovementResolution({room,combatant:liveActor,resolution,preconditions}) sin cambios. Guardas de acción se mantienen en el caller; fingerprint no las cubre. Flujo síncrono sin await entre guardas/Resolve/Commit; si se introduce separación temporal, volver a autorizar antes de Commit y no confiar solo en fingerprint. Rejected: throw result.reason, descartar buffers; no logs/gasto/efectos/pendientes extra ni broadcast de éxito/retry. No utilizar commitSpatialTransition en esta rama.
8. **Contabilidad y squeezing.** Commit es el único que escribe posición, stats.distanceMovedFeet += totalBaseRouteCostFeet, movementUsedFeet += totalCostFeet, normalDiagonalStepsThisTurn = projectedContext y srd_squeezing/eje. **No** repetir escrituras actuales del handler. El stats legacy incluía recargos; la migración adopta deliberadamente contabilidad base I6, no promete equivalencia numérica con legacy en DT/squeezing. Budget/log de gasto usan coste total. Guardar wasSqueezing antes, comparar con result.finalSpatialMode para logs; cambios de eje sin cambio de modo no inventan un evento de entrada/salida. Naturaleza/compresión y H/V provienen de Resolution/Commit exclusivamente.
9. **Economía y consecuencias posteriores.** Solo tras committed: normal usedFullAttack=true; limitada usedStandardAction=true. No usedMoveAction, usedStandardAction normal ni usedFullAttack limitada redundantes. Publicar buffers de logs/pendientes, aplicar applyDisabledExertion conservando wasDisabledAtActionStart y actionKind correspondiente, logStatusChange y checkCombatOutcome exactamente según rama vigente. No mutar TurnState antes de Commit ni resolver AdO antes de confirmar toda la ruta. Sin reembolso, interrupción, clon transaccional total ni rollback espacial al resolver después un AdO.
10. **Publication/errores/logs.** Distinguir Commit espacial de publicación externa: escribir economía, logs, pendientes y esfuerzo postcommit síncronos antes del único broadcast(room), como hoy; no emitir un estado intermedio. Texto de Retirada conserva rama/exención e informa totalCostFeet; si se expone distancia, etiquetarla base separadamente. Sincronización de outcome de esfuerzo permanece; no introducir syncEncounterPhase extra sin evidencia. Errores de guards/Resolution/Commit usan el canal actual del dispatcher. No nuevo protocolo/ack; no prometer rollback de errores de infraestructura posteriores al commit.
11. **Preview y regresión.** Migración **solo servidor**. legacy-withdraw sigue excluido del adapter I7; UI puede sobreestimar DT/stacking y el servidor decide. La divergencia se documenta, no se soluciona con un segundo cálculo cliente ni resulta inseparable del servidor. Sprint posterior de preview Withdraw tras su aceptación. No cambiar Move I6, preview I7, Run, 5ft, Charge, forced/GM/preparation, spells, shared helpers ni effect lifecycle global.

### 10.6 Verificación futura y fronteras de regresión

No se ejecutan ni modifican tests en I8 Design. Gates del próximo sprint: npm test, npm run typecheck, npm run build, node scripts/e2e-websocket.mjs y npm run test:ui; observar Windows CI tras push. No usar conteos previos como objetivo ni afirmar cobertura futura ya lograda.

| Pruebas futuras | Evidencia exigida |
|---|---|
| Handler Withdraw frente a resolver común | Mismo snapshot/path/budget/context; gasto == totalCostFeet, stats == totalBaseRouteCostFeet, contexto/posición/huella/eje == ready/committed. Actualizar únicamente fixtures antiguos sin contexto; nunca default productivo. |
| Presupuesto/economía | W10…W27 vigentes; exacto/exceso ×2 y ×1, speed efectiva por armadura/efecto, gasto cero previo, gates de phase/control/turno/pendientes/crítico/CANNOT_MOVE/attackMode/acciones. Rechazo deep-equal sin log/effect/gasto/pending/broadcast exitoso. |
| Contexto/coste | Inicial 0 y no cero; ortho/diagonales, DT dos diagonales (30, no 35), normal→DT→normal y squeezing/DT acumulados con oracle shared. Si geometría rechaza diagonal comprimida, probar rechazo sin fabricar ready. Sin Tumble. |
| Espacial | Large H/V persistido, entrada/salida/cambio de eje, límites/esquinas/obstáculos, corrupción axisless/duplicada, xyz conservado. Solo Commit cambia efecto; no doble ST/gasto/stats. |
| Ocupación V1 | Enemigo active/dying/stable en tránsito rechazado; aliado intermedio permitido cuando shared lo permite; final aliado/enemigo no-dead rechazado incluso helpless; dead conserva excepción actual. |
| AdO | W-S1…W-S9 y W25: origen completo exento, pasos posteriores/reach/múltiples reactores/orden, Large y huellas comprimidas desde steps. Resultado final ya confirmado al encolar; conservar metadata/early return del bridge, no adjudicar coste local como budget. |
| Stale/no publicación parcial | Precondiciones anti-stale actor/turno/ronda/origen/gasto/contexto/fuentes de movilidad como I5R2/I6; inyectar rechazo en test de integración del handler sin API productiva. Cambiar estado entre Intent y recepción: servidor re-resuelve desde estado nuevo. Buffers no sobreviven rechazo. |
| Disabled/consecuencias | W12/W13/W15, HP 0 y life projection pertinente; esfuerzo una sola vez tras committed, estándar sí/full-round no; efectos/outcome/logs y broadcast único coherente. |
| E2E y no regresión | Añadir Withdraw real a WebSocket (no asumir que W26/W27 prueba Charge), aceptación/rechazo/coste/contexto/exención; UI smoke conserva envío legacy. Ejecutar suites Move I6/preview I7, Run, 5ft, Charge/opportunity-phase, geometría/commit/effects, D-5/demo sin modificar sus reglas. |

### 10.7 Respuestas de cierre — 17 preguntas

1. **Primero:** Withdraw servidor, único consumidor seleccionado.
2. **Por qué:** caller/budget/economía/exención ya aislados y suites específicas; resolver/Commit sin extensión y beneficio real sobre DT/stacking (§10.4).
3. **Segundo recomendado:** Run, sujeto a diseño propio y Review posterior, no incluido en el plan activo.
4. **Otros:** 5ft necesita contrato de excepción coste/contabilidad/paridad; Charge necesita selector/terreno y frontera ataque. No implementar esos gaps ahora.
5. **Resolver sin cambios:** sí para Withdraw; consumer-specific gates y ocupación quedan fuera.
6. **Commit sin cambios:** sí, ready genuino y referencia viva; no doble ST ni ajustes posteriores de gasto.
7. **Budget:** handleWithdraw calcula speed efectiva ×2/×1 después de guards; no nueva Budget Policy shared.
8. **Diagonales:** initialContext real, Commit publica projectedContext; no reset local.
9. **Eje:** snapshot inicial, steps y Commit; room.effectInstances/srd_squeezing/squeezingAxis siguen siendo la autoridad.
10. **AdO:** helper actual con steps y exención inicial completa, buffer precommit; pendientes postcommit; limitación de metadata explícita.
11. **Economía:** después de committed, antes del único broadcast; full-round o estándar limitada, sin nueva TurnState.
12. **Legacy retirado del seleccionado:** validateMovePath y commitSpatialTransition; escrituras manuales de posición/efecto/gasto/stats. El coste legacy indirecto desaparece solo de Withdraw servidor.
13. **Legacy que permanece:** validateMovePath/calculatePath* para otros consumidores y UI; ST para productores restantes; buildStraightPath/chargeResolver y helper AdO con semántica vigente.
14. **Preview:** después, sprint separado; cero web en implementación seleccionada.
15. **D-7:** no depende; no múltiples Routes voluntarias/Double Move/fragmentación/Spring Attack.
16. **Governance:** C por integración de resolver servidor; elevar a D si se requirieran contratos/infraestructura, con nueva Review.
17. **Tests:** matriz §10.6; equivalencia de políticas conservadas y oracle normativo para las diferencias intencionales de coste/contexto/stats. **Cero ODR bloqueantes de Withdraw**; pendientes de otros consumidores delimitados, sin autoaprobación.

## Capítulo 11 — I9: Withdraw Normative Preview Parity

### 11.1 Estado, alcance y SSOT

**IMPLEMENTACIÓN Y DoD LOCAL COMPLETADOS; READY FOR ARCHITECTURE REVIEW EXTERNA.** Diseño técnicamente aprobado y Proceed explícito sobre `041bee05f6f4a5aa571dea778827eb51cbccbdb0`. La auditoría y las tareas futuras conservadas abajo registran el diseño original ejecutado, sin autorizar trabajo adicional. Baseline auditado limpio en master, coincidente con origin/master: `791fb4bacfe82bddb1bc3af1324de2e9b74e622b`. I6/I7 aprobados; I8 TECHNICALLY APPROVED tras I8R1 según el owner. Windows CI del código I8 SUCCESS sobre `af60111c843aac3ed23922f6fba30173edebdbaf`; I8R1 solo corrigió lifecycle documental. En la entrega de diseño no se implementaron ni ejecutaron tests; esta ejecución incorpora la evidencia real en master-coverage y walkthrough.

Único alcance futuro: preview **web** de Withdraw activo, con las APIs shared y el servidor I8 intactos. Este capítulo posee integración/presentación; [Withdraw Rev. 3](withdraw/design.md) conserva reglas particulares, §10.5 documenta el caller servidor y §8.3/§8.7/§6.13 conservan coste/eje/contexto. No duplicar matriz RAW. Run/5ft/Charge/forced/GM/preparation/spell range, AoO predictivo completo, D-7/Double Move/Spring Attack quedan fuera. No nuevos contratos, schemas, comandos ni protocolo.

### 11.2 Auditoría del baseline real

Referencias relativas a raíz, por símbolos/call sites vigentes; no trasladar como actuales números históricos de I7.

| Superficie inspeccionada | Comportamiento verificado y gap Withdraw | Cambio futuro acotado |
|---|---|---|
| apps/web/src/movementPreview.ts — MovementPreviewKind/getMovementPreviewKind | withdrawArmed produce legacy-withdraw. buildMovementPreview resuelve solo ordinary, resta gasto a speed, anota Tumble/CD25; candidates llama ese adapter. getOrdinaryMoveBlockedReason usa la economía Move, no Withdraw | Nuevo kind withdraw y wrapper propio, sin reutilizar presupuesto/guardas/Tumble ordinarios |
| hooks/useBoardSelection.ts — movementPreview/movementCandidates | Ambas memos se activan solo para ordinary-move; Withdraw no tiene proyección. movementPathCost usa calculatePathCostFeet, displayedPathCosts calculatePathStepCostsFeet, highlightedCells getHighlightedCells | Rama Withdraw normativa y snapshot único; pasos/texto/candidatos desde la misma proyección |
| viewModel.ts — getHighlightedCells/isLegalNextPathStep | withdrawFactor usa lifeStatus disabled ? 1 : 2. maxDistance resta gasto a speed×factor; recorre width×height y delega candidate draft a isLegalNextPathStep/validateMovePath. No usa contexto real | Retirar parámetro/factor y uso de esta rama para Withdraw; no escaneo de tablero normativo |
| App.tsx — handleCellClick | Solo ordinary acepta candidatos illegal/over-budget y preserva altura con ordinaryGridPosition. Para Withdraw el token ajeno bloquea click antes de construir draft | Aplicar autoría normativa también a withdraw, sin bloquear por token ni reanclar huella |
| App.tsx — confirmMovementPath | Primera rama withdrawArmed envía use-tactical-action/withdraw con to/path y limpia overlays; retorna antes del guard ordinary. No verifica aún proyección Withdraw | Guard específico legal + disponibilidad antes del mismo payload; no añadir metadata |
| App.tsx — ActionsPanel props | isMoveDestinationOccupied solo se evita en ordinary; Withdraw usa isCombatantDestinationOccupied que reancla actor para la huella final | Evitar ese chequeo para ambos previews normativos; usar policy desde steps para Withdraw |
| App.tsx — resets | onToggleWithdraw ya limpia draft, run/5ft e isAcrobatic; efecto por previewKind/selected id desactiva Tumble. clearActionOverlays/toggleGM limpian flags; cambio de turno limpia draft/Tumble/5ft pero no explicita withdrawArmed/runArmed en ese callback | Mantener resets y hacer explícita limpieza Withdraw en cambio de actor/turno; no conservar una intención del actor anterior. Demo/editor desactivan preview por kind none |
| ActionsPanel.tsx — bloque Move/Withdraw | Solo ordinary recibe MovementPreviewSummary/Tumble. turnVirgin local no usa todas las guardas shared. Texto/botón anuncia siempre full-round ×2 y «turno completo»; no distingue limitada Disabled aunque el rango legacy sí usa ×1 | Disponibilidad compartida web del seleccionado, variante/etiqueta correctas y summary común; no dos budgets en panel |
| MovementPreviewSummary.tsx | Renderiza cinco estados, saldo/contexto/eje/CD25 y blockedReason separado. El nombre del prop superior ordinaryMoveBlockedReason no sirve como guarda Withdraw | Contexto de etiqueta/disponibilidad por acción; Tumble solo ordinary; razón de error identificable |
| Board/presentationModel.ts — buildBoardPresentationModel | Acepta MovementPreviewProjection; variable local ordinary significa realmente movementPreview != null. Usa steps occupiedCells/axis/cumulative y ghost final; sin projection usa reanclado legacy para maniobras. Illegal no tiene pasos evaluados | Reutilizar misma evidencia para Withdraw, renombrar variable local a significado presentacional si ayuda; no duplicar ramas geométricas |
| Board/Board.tsx | Recibe preview; unavailable corta presentación con alerta; cells usan routeLabel/status/axis/ghost/aria. Grid crea posiciones a z=0 y App corrige solo ordinary | Mismas props/evidencia, autoría Withdraw preserva z en App; no reglas nuevas en Board |
| Board/renderer/TacticalScene3D.tsx | Consume presentation.cells: colores, sprite routeLabel y spans scene-cell con status/axis/ghost/coste; sin resolver ni fórmulas | Mismo pipeline, misma evidencia; cámara no altera predicción |
| server/commands/tacticalCommands.ts — handleWithdraw | Guards propios; full-round/standard Disabled; budget speed×2/×1; snapshotActor, contexto real, resolveMovementPipeline(false), rechaza budget antes de policy; V1 desde occupiedCells; Commit vivo, economía/esfuerzo/AdO/logs/broadcast posteriores | Oracle de paridad, **sin cambios de servidor** |
| shared movementResolution/movementCost/routeValidation/movementCommit/rules | Resolver portable puro compone geometría/coste/budget; legality permite ciertos helpless que V1 restringe. Commit escribe estado/gasto/base/contexto/eje; no es preview. Rules provee speed, disponibilidad y gates Disabled/Move; helper AoO tiene metadata legacy deliberadamente conservada | Consumo de APIs existentes; cero Commit/AdO helper/efectos/RNG en cliente |

Tests inspeccionados: tests/movement-preview.test.mjs compara I7/resolver y presentación; tests-ui/movement-preview.spec.ts intercepta transporte y ejecuta handler Move real, con publish/hold/release para stale. tests/withdraw-server.test.mjs prueba handler I8 frente al resolver, V1 helpless/Large, budgets/guardas, ejes, stale y esfuerzo/outcome; tests/withdraw.test.mjs cubre exención AdO. scripts/e2e-websocket.mjs tiene diez aserciones I8 reales (DT, budget/economía/ocupación, AdO y Disabled), **no** preview Withdraw. Son bases reutilizables; no existe paridad UI Withdraw implementada. master-coverage no se modifica ni se atribuyen pruebas futuras como ejecutadas.

### 11.3 Decisión de adapter y contrato presentacional

Se elige **B: buildWithdrawMovementPreview separado con proyección común de Resolution** en movementPreview.ts. Su input público es snapshot/actorId/path, sin opción isAcrobatic; buildWithdrawCandidates recibe esos mismos inputs. buildMovementPreview conserva su API/semántica ordinary. Extraer únicamente privados pequeños para validar precondiciones estructurales, proyectar resultado shared y enumerar ocho vecinos. Cada wrapper determina inputs explícitos y llama resolveMovementPipeline una vez por ruta; no llamar al wrapper ordinary y reemplazar su budget después. El mapper común no posee reglas de Withdraw ni coste propio. Withdraw aplica su comprobación V1 explícitamente entre resultado ready y mapper; ordinary conserva sus anotaciones de Acrobacias sin heredar V1.

Opción A (generalizar todo con budget, isAcrobatic y callback post-policy configurables) descartada: permite combinaciones inválidas de intención/capacidad y parece un framework táctico antes de contar tres casos. Se reutiliza proyección/mecánica de vecinos, no un registry de Run/Charge/5ft ni un segundo MovementResolver. No extracción shared necesaria: la matemática/huella ya es portable.

Reutilizar **MovementPreviewProjection** con extensión web mínima: en illegal, añadir reasonSource: movement | withdraw-policy (también asignar movement en el wrapper ordinary). No nuevo contrato shared. Mantener draft copiado, cinco estados y todos los datos evaluados solo en legal/over-budget; Withdraw siempre isAcrobatic=false y acrobaticsChecks vacío. Variante y disponibilidad se entregan **separadamente**, no como flags normativos de la ruta, mediante WithdrawPreviewAvailability con variant normal | limited, actionLabel, budgetFeet y blockedReason. Si faltan precondiciones para derivar esos datos, availability puede ser unavailable con reason, sin budget ficticio.

Estados:

- empty: ruta vacía; sin Resolution ni pasos. Budget de evaluación solo si snapshot/actor/contexto/movilidad son válidos. Validar también huella inicial para no ocultar corrupción de eje.
- legal: ready y policy V1 aceptada; conserva evidencia original. Significa predicción de ruta compatible, **no** autorización ni Commit exitoso.
- over-budget: insufficient-budget; conservar toda la ruta/steps/coste/contexto/saldo firmado/exceso. **No** ejecutar V1 después: I8 rechaza por presupuesto antes de ese loop. Para Withdraw texto «Ruta evaluada por Movement; excede el límite de Retirada. Policy V1 no completada»; no «Retirada legal» ni falsa prueba de ocupación. Ghost describe evidencia espacial, no autorización V1. Probar ruta simultáneamente over-budget y helpless para fijar esta precedencia.
- illegal/movement: illegal-route de shared; reason/failedStepIndex/draft, sin steps, coste ni contexto inventados.
- illegal/withdraw-policy: ready bloqueado por V1; reason y stepIndex del primer bloqueo, reasonSource withdraw-policy; descartar evidencia evaluada en la proyección pública igual que illegal I7. No exponer un coste 0 ni re-resolver prefijo. La UI distingue «Regla de Retirada V1» de «Movement» sin otra autoridad geométrica.
- unavailable: snapshot/actor ausente, fase/actor de turno incompatible o estado espacial/contexto estructuralmente inseguro. Catch de integridad, sin orientación por defecto ni fallback legacy. Restricción de control/economía no se disfraza de illegal.

### 11.4 Budget, variante y disponibilidad separados

El wrapper Withdraw deriva un **límite total de evaluación** usando Rules.totalSpeedFeet(snapshot, snapshotActor) y los mismos gates que I8: canDisabledCombatantTakeAction(full-round); si falla, la variante es limitada y el permiso exige además standard. Normal ×2, limitada ×1. No usar vida nominal como sustituto del gate (Diehard también puede usar economía Disabled), ni speed−gasto, ni restar gasto al límite. Copiar normalDiagonalStepsThisTurn real, incluso no cero; nunca fórmula de diagonales ni reset cliente.

Definir getWithdrawBlockedReason(snapshot, actorId, canControl) usando APIs existentes. Comprobar control, snapshot/fase activa/actor del turno y Rules.evaluateActionAvailability; luego pendingOpportunityAttacks, canUseMoveAction, attackMode none, !usedStandardAction, !usedFiveFootStep, attacksMade==0, movementUsedFeet==0 y autorización full-round/standard limitada. canUseMoveAction conserva activeAttackThreat, canTakeTurn, CANNOT_MOVE, total defense, usedMoveAction y usedFullAttack. Guardas/razones siguen el orden productivo tras las precondiciones UI. Los locks demo/editor bloquean interacción/kind sin cambiar reglas. Ningún fingerprint sustituye estos gates.

Decisión explícita para **movementUsedFeet != 0**: availability **action-blocked**, no budget residual y no illegal geométrico. Con estado válido se puede conservar/recalcular el draft usando el límite completo hipotético ×2/×1, y mostrar su route status más el bloqueo. En tal caso el panel dice «Límite de evaluación: X ft; acción bloqueada»; no «Disponible»/«Quedarían X para actuar», ni permite armar por primera vez/confirmar. Otros bloqueos económicos o de control siguen la misma separación. Si el bloqueo llega mientras estaba armada, conservar draft editable para diagnóstico/Undo/Clear/cancelación; confirmar nunca. Snapshot estructuralmente inválido es unavailable, no hipótesis.

La metadata de variante/budget se calcula una vez por snapshot/actor y se comparte entre draft/candidatos/panel. La función de disponibilidad puede bloquear standard en limitada mientras aún identifica variant limited para explicar el intento; no transforma un fallo de permiso en una variante normal. Errores de integridad no fabrican metadata. Textos:

- Normal: «Retirada — hasta 2× velocidad — acción de asalto completo».
- Limitada: «Retirada limitada — hasta 1× velocidad — acción estándar».
- Ambas: «Tu huella inicial completa está exenta; el resto de la ruta puede provocar AdO. El servidor resolverá los AdO definitivos».

No computar amenazas, cantidad/seguridad de AdO, CD15/CD25 ni usar findTriggeredOpportunityAttacksForPath en web. El texto no promete evitar todo AdO y no oculta el esfuerzo Disabled del servidor; puede indicar «la retirada limitada puede causar esfuerzo; el servidor aplica sus consecuencias», sin preaplicar daño/outcome.

### 11.5 Thin V1 policy: frontera y control de drift

Privado web acotado, solo para Withdraw y **solo después de ready**: iterar resolution.steps ordenados; crear keys con footprintCellKey de occupiedCells; para otros combatientes excluir actor y solo lifeStatus==dead; en tránsito bloquear other.type!=actor.type; en último step bloquear cualquier otro no-dead. Intersección con getCombatantOccupiedCells(other,snapshot), autoridad shared también para altura/eje/huella enemiga. Primer bloqueo determina reason/failedStepIndex. No construir actor-at-position, no inferir modo/eje, no segunda validación de esquinas/bounds/adherencia ni recalcular coste.

Esto conserva literalmente la policy I8: dying/stable enemigo en tránsito o destino bloquea, aliado intermedio puede pasar, final aliado no-dead bloquea; dead conserva excepción. Shared puede rechazar primero un enemigo consciente; reasonSource será movement en ese caso. Helpless es el caso que demuestra el post-check V1. No distinguir por una lista local de HP: lifeStatus compartido incluye Disabled/Diehard y es la única clasificación vital.

Se acepta **web-only** porque no cambia la regla ni la autoridad, solo presenta una intersección sobre evidencia y predice una restricción ya implementada. Riesgo real: dos sedes de la policy de consumidor y de sus gates/budget. Mitigación obligatoria: tabla de fixtures común de **inputs**, nunca un oracle V1 web compartido con el servidor; ejecutar adapter y handler I8 real en rooms independientes y comparar aceptación/rechazo/no mutación. El handler real es oracle adicional al resolver, no solo tests unitarios de una copia del loop. Incluir casos discriminantes helpless no-anchor Large, aliado, dead, budget combinado y tipo/altura. Si no puede lograrse paridad con estas APIs o surge cambio de regla/shared/server, detener: reclasificación C por policy shared/reglas, D si contratos/infraestructura; nueva Review/Proceed. No extraer anticipadamente para mantener un B ficticio.

### 11.6 Wiring, autoría y presentación

Kind **withdraw** sustituye exclusivamente legacy-withdraw; legacy-run/legacy-five-foot-step/legacy-charge/legacy-forced quedan idénticos. Hook selecciona wrapper ordinary o Withdraw explícitamente antes de coste/candidatos. Memo de draft + buildWithdrawCandidates sobre el mismo primitive privado de vecinos que I7, desde última ancla o actor; preparar snapshot/actor/budget/contexto/variant una vez y reutilizarlos. Máximo ocho extensiones completas, una resolución por extensión y otra para el draft, cero BFS/A*/range scan. Dependencias: snapshot, actor, path, kind y metadata relevante; ordinary conserva isAcrobatic, Withdraw fuerza false aunque el estado local todavía no se haya reseteado.

App extiende la ruta de autoría normativa a ordinary-move **y withdraw**: candidate status legal/over-budget/illegal es editable; unavailable no extiende. No filtrar token enemigo antes de adapter. Preservar zFeet del último draft o actor mediante helper I7 existente (puede renombrarse internamente de forma descriptiva, sin cambiar semántica ordinary). No usar z=0 del grid como nueva altura normativa. Undo/Clear/cancelación disponibles también cuando el draft/acción están bloqueados; no truncar por presupuesto, no permitir confirmación de illegal/exceso/empty/unavailable. No se da excepción local «Tumble permite enemigo» a Withdraw.

Al armar Withdraw: limpiar path, run/5ft y Tumble; ocultar checkbox/CD25, sin isAcrobatic en payload. Mantener limpieza por kind/actor y hacer explícito reset Withdraw en cambio de turno/actor, cambio a tácticas/GM/preparation/demo/editor/fin de combate o clearActionOverlays tras envío, según lifecycle existente. Un room-update del **mismo actor/turno** solo invalida memo/recompone ruta y disponibilidad, sin borrar el draft ni simular éxito. Si cambia economía a bloqueada, mostrar bloqueo separado; si cambia terreno/efectos/ocupación, evaluar ruta íntegra actual. No mutar Room/currentTurn/stats/effects/logs/posición durante dibujo, toggle, cámara o cancelación.

ActionsPanel reutiliza summary para ambos, pero recibe razón de disponibilidad de la acción seleccionada, no ordinaryMoveBlockedReason para Withdraw. Una prop presentacional de etiqueta/variante/budget caption basta; no nuevo componente con fórmulas. Sustituir el turnVirgin duplicado de Withdraw y sus textos ×2 incondicionales por metadata/blockedReason; Run mantiene su disponibilidad. Botón armar exige disponibilidad; cancelar sigue habilitado si ya está armada aunque llegue bloqueo. Confirmar Retirada exige kind withdraw, projection legal y ningún bloqueo/control/lock. Repetir ese guard en **la primera rama Withdraw de confirmMovementPath**, antes del envío; no confiar solo en disabled del botón. Ordinary conserva getOrdinaryMoveBlockedReason y Run/5ft/Charge no reciben gates normativos Withdraw.

Eliminar para Withdraw el prop isMoveDestinationOccupied reanclado, puesto que policy/Resolution son la fuente. BoardPresentationModel ya admite proyección común: suministrar la misma al panel y Board; interpretar su variable ordinary como «tiene proyección normativa», no añadir un branch de reglas Withdraw. Ghost final legal/over-budget y etiquetas acumuladas/axis/cells desde Resolution; illegal solo anclas intentadas/índice fallido sin pasos inventados. Board 2D y TacticalScene3D consumen las mismas cells/labels/status; no resolver/coste ni inferencia de eje en renderer. Cámara/presets no cambian cálculo; token publicado y srd_squeezing/eje permanecen intactos hasta room-update.

**Intent/stale:** payload existente exacto type use-tactical-action, action withdraw, roomCode, actorId, combatantId, to último step y path íntegro copiado. No cost/budget/context/mode/axis/status/fingerprint/proof/exemptions/isAcrobatic. No cambiar schemas/WebSocket ni acknowledgements. Tras envío, clearActionOverlays/error actual; ningún movimiento/gasto/efecto optimista ni retry. Preview N no bloquea servidor: al recibir Intent en N+1 I8 reautoriza/resuelve y puede rechazar aunque N fuese legal.

### 11.7 Verificación futura de paridad y E2E

Dos oracles complementarios: resolveMovementPipeline para evidencia de Movement sobre mismos inputs, y **handleUseTacticalAction real I8** para gates/variante/V1/aceptación/Commit. No usar fórmula propia ni sustituir handler por un mock que devuelva la proyección cliente. Ambos operan en clones independientes del mismo room inicial; registrar broadcasts/estado final y errores. Con action disponible y preview legal, esperar Commit equivalente en posición/coste/contexto/eje y stats base. Con action bloqueada, servidor rechaza aunque la ruta hipotética sea legal. No exigir igualdad de mensajes localizados si reasonSource/categoría y aceptación son las mismas; no exigir side effects del servidor a un preview puro.

| Grupo futuro | Casos y evidencia mínima |
|---|---|
| Coste/contexto | Ortho/diagonal, dos normales, contexto inicial no cero, DT diagonal y dos DT=30, normal→DT→normal; adapter evidencia == resolver, handler gasta totalCostFeet y actualiza projectedContext. Sin duplicar matriz en React. |
| Budget/variante | Normal ×2 exacto/exceso, limitada ×1 exacto/exceso, speed efectiva por efecto/equipo; Diehard con economía Disabled. full-round/standard gates, nunca presupuesto residual cuando gasto!=0. |
| Separación de acción | Control, fase/actor, availability, pending/critical, canUseMoveAction/CANNOT_MOVE/total defense, standard/move/full/5ft/attacks/attackMode/gasto previo. Ruta legal con acción bloqueada conserva estado de ruta y no confirma. Limitar unavailable a estructura/integridad/precondiciones de actor/fase. |
| V1 | Enemigo active/disabled/dying/stable tránsito/final, aliado intermedio/final, dead, Large no-anchor y xyz. Distinguir movement vs withdraw-policy; razón/índice correcto; illegal sin coste/steps. Over-budget+helpless no afirma V1 aprobada y coincide con rechazo por budget del servidor. |
| Squeezing | H/V entrada/persistencia/giros/salida natural, squeezing+DT si geometría admite, eje corrupto/duplicado/axisless → unavailable. Steps/ghost/axis desde shared, no logs/efectos cliente. |
| Pureza/edición | Deep-freeze snapshot/path cuando proceda, repeticiones/draft/cancel/Undo/Clear/cámara sin mutación ni RNG. Máximo ocho candidatos, misma altura/contador/budget; legal/exceso/illegal editables, sin recorte. |
| Presentación | Una proyección panel/Board, dos modos/cuatro cámaras, acumulados y saldo, bloqueo separado, etiqueta normal/limitada y esfuerzo no aplicado, texto de exención inicial sin amenaza calculada. Tumble/CD25 ausentes en Withdraw y conservados ordinary. |
| Intent/stale | Claves exactas de intención; room-update mismo actor recompone terreno/economía sin borrar ruta; turno nuevo limpia. Intent retrasado se evalúa en N+1, sin optimistic state ni retry ni derivados enviados. |

E2E propuestos (tests-ui/withdraw-preview.spec.ts nuevo, o casos bien aislados en movement-preview.spec.ts):

A. Dos diagonales DT: panel/labels 30 ft, confirmar Withdraw y handler I8/room-update gasta 30; payload solo intención.
B. Contexto inicial !=0: primera diagonal usa contador real y coincide con servidor. Transporte controlado como I7 permite fixture difícil de crear por protocolo sin añadir API productiva.
C. Disabled: UI identifica limitada estándar ×1, exacto/exceso correctos; al confirmar handler consume estándar, no full-round, esfuerzo posterior solo servidor. Variante de HP negativos Diehard en tests de paridad.
D. Helpless en tránsito/endpoint: mostrar illegal/withdraw-policy y bloquear Confirmar. **Separadamente**, enviar el mismo Intent por transporte de test al handler real para probar rechazo aunque se omita UI; no habilitar botón ni nueva API productiva para forzarlo. Incluir enemigo consciente con illegal/movement, aliado/dead y Large no-anchor.
E. Stale: N legal; publish N+1 con DT cambia exceso y con economía bloquea acción; draft se conserva. En caso separado, hold/release Intent N mientras el estado autoritativo cambia a N+1; servidor rechaza/resuelve N+1 sin optimismo. No publicar economy y esperar que la ruta se vuelva geométricamente illegal.
F. Large squeezed: dos modos muestran mismo ghost/axis y cuatro cámaras no cambian cálculo; confirmar persiste eje idéntico en servidor. Token original inmóvil antes del room-update.

Fixtures UI controlan **solo transporte/estado inicial** y ejecutan handler real sin cambios (como harness I7); no hay dados de Tumble para Withdraw ni necesidad de mockear RNG normativo. La suite WebSocket real I8 sigue siendo regresión de transporte/servidor, no se presenta como prueba de preview. Suites I6/I7/I8, Run/5ft/Charge, D-5/demo y renderer deben seguir verdes. Gates al implementar: npm test, typecheck, build, WebSocket, Playwright completos y CI Windows observado después de push; conteos reales entonces, ninguno nuevo en I9 Design.

### 11.8 Plan de implementación ejecutado — referencia I9

**Referencia ejecutada; implementación y DoD local completados. Nivel B** por wiring/presentación web de reglas existentes usando contratos shared actuales, sin alterar la autoridad ni el comportamiento del consumidor. La thin V1 policy no define RAW nuevo; su riesgo de copia se acota mediante paridad con servidor real (§11.5). Si requiere nuevo helper shared/regla/servidor → C; contratos/infraestructura → D y nueva Review antes de ampliar. No rebajar esos cambios a B por conveniencia.

En el diseño aprobado se utilizó la opción de .agents/AGENTS.md Fase 3 para Nivel B: plan completo embebido sin archivo separado. No se creó root implementation_plan.md. Esta sección conserva el plan aprobado como referencia ejecutada, no como plan activo pendiente de Proceed; las instrucciones históricas siguientes no autorizan trabajo adicional. I7/I8 permanecen cerrados como referencias independientes. No se requiere un nuevo Proceed para I9; se espera únicamente Architecture Review externa de la implementación publicada.

| Orden / archivo futuro | Trabajo autorizado solo después de Proceed | Frontera/aceptación |
|---|---|---|
| 1 — baseline/lectura | Reader Pipeline; confirmar servidor I8 aprobado y origen limpio, localizar callers actuales si cambia HEAD | No sobrescribir unrelated ni cambiar baseline en silencio |
| 2 — movementPreview.ts | Wrapper Withdraw, mapper/estructura común mínimos, metadata de budget/variante y blocked reason, thin V1 post-ready, reasonSource, kind withdraw; enumerador común + buildWithdrawCandidates | Sin ordinary budget para Withdraw, matemática/Commit/RNG propios ni framework Run |
| 3 — tests/movement-preview.test.mjs y/o nuevo tests/withdraw-preview.test.mjs | Matriz de inputs comparada con resolver y handler real, pureza, disponibilidad separada, V1 y precedencia budget | Tests de policy cliente con oracle servidor independiente; no modificar servidor/shared para fixtures |
| 4 — hooks/useBoardSelection.ts | Memo current draft y ocho candidatos, preparar misma metadata/snapshot; rutas/coste/labels compartidos panel/Board | Ni calculatePathCostFeet ni calculatePathStepCostsFeet/getHighlightedCells para Withdraw |
| 5 — App.tsx | Autoría normativa/click z, reset exclusivo de familia/actor/turno, props de disponibilidad específicas, guard en confirmación Withdraw, mismo Intent | Sin reanclado destino, isAcrobatic heredado, optimistic mutation ni nuevos campos wire |
| 6 — ActionsPanel/ActionsPanel.tsx y MovementPreviewSummary.tsx | Textos ×2/full-round vs ×1/standard, límite hipotético cuando blocked, V1 source, cancelar/editar; Tumble solo ordinary | No usar turnVirgin local ni coste/saldo matemático JSX paralelo |
| 7 — viewModel.ts | Quitar exclusivamente parámetro withdrawArmed/factor ×2/×1 del helper legacy y su caller (un único caller auditado); maxDistance conserva Run/otros | No borrar helpers usados por Run/5ft/Charge/spell/GM/preparation |
| 8 — Board/presentationModel.ts y, solo si wiring lo exige, Board.tsx/renderer/TacticalScene3D.tsx | Compartir proyección/labels; aclarar variable ordinary presentacional | Sin branch de geometría/coste Withdraw; estilos solo si estados existentes no bastan |
| 9 — tests-ui/withdraw-preview.spec.ts (preferido nuevo) | A…F de §11.7 con handler I8 y captura de Intent; preservar tests-ui/movement-preview.spec.ts ordinary | No test API productiva; room-update stale y bloqueo/route separados |
| 10 — validación/cierre | Gates completos y regresiones; master-coverage solo con resultados ejecutados, estado/TODO/walkthrough/INDEX; registrar ejecución de este plan sin dejar activo duplicado; commit único/push/CI | Ready for Architecture Review externa, sin autoaprobación |

Retirada legacy exacta: branch/calls Withdraw del hook a calculatePathCostFeet y calculatePathStepCostsFeet, getHighlightedCells→isLegalNextPathStep→validateMovePath para autoría Withdraw, factor/rango Withdraw en viewModel, kind legacy-withdraw, turnVirgin/texto full-round universal y chequeo reanclado de destino para Withdraw. Helpers/shared legacy, aritmética de Run, costos Charge/spell y placement siguen intactos. Ningún archivo apps/server, packages/shared, schema/protocolo, scripts/e2e-websocket.mjs ni .claude/settings.local.json necesita cambio. Tests de servidor existentes se ejecutan como oracle/regresión; no migrar fixtures/reglas para acomodar al cliente.

Riesgos cerrados: drift V1/guards → tests con handler real; post-policy vs exceso → precedencia explícita I8; blocked con budget → límite hipotético etiquetado, sin residual; altura de grid → helper I7; Tumble transitorio → false hardcoded en wrapper; renderer variable ordinary → evidencia común; refactor mapper → regresión I7. Rollback operativo: revertir commit web, sin migración de datos ni wire. No hay dependencia D-7 ni ODR bloqueante.

### 11.9 Respuestas explícitas — 22 preguntas

1. Legacy actual: tabla §11.2 (kind/hook cost-step-highlight, viewModel factor/validator, panel budget/texto, App destino y confirmación).
2. Retiro futuro: último párrafo §11.8, solo Withdraw; no eliminación de helpers compartidos.
3. Projection: sí, misma union con reasonSource en illegal; metadata de acción aparte.
4. Adapter: opción B, buildWithdrawMovementPreview separado; mapper/validación estructural/vecinos privados comunes, API ordinary preservada.
5. Budget: wrapper web prepara speed efectiva ×2/×1 del mismo snapshot siguiendo gates Disabled; no nueva policy shared.
6. Limited: variante limitada ×1 estándar, también con Diehard, bloqueo explicado sin falsa exigencia full-round.
7. V1: thin policy solo post-ready sobre steps occupiedCells y huellas shared de otros, primer índice, no reanclado.
8. Web-only: suficiente para predictor existente; no cambia autoridad. Necesidad shared/server obliga reclasificación, no implementación aquí.
9. Drift: fixtures discriminantes y aceptación/error contra handler I8 real independiente, no solo resolver ni un mock de policy.
10. Contexto: copiar normalDiagonalStepsThisTurn real, sin reset/fórmula y con tests no cero.
11. Exceso: ruta completa, saldo firmado/coste shared, sin truncado; V1 no completada, no prometer Retirada legal.
12. Bloqueo: reason separado; con gasto previo se evalúa límite total hipotético claramente etiquetado y se bloquea acción, no ruta geométrica.
13. Axis: evidencia de steps desde snapshot/shared; no efectos ni inferencia cliente.
14. Board 2D: misma proyección/cells/ghost/labels, token publicado sin mover.
15. TacticalScene3D: mismo presentation model, sin cálculo ni reglas por cámara.
16. Tumble: reset/oculto, wrapper false, checks CD25 vacíos; no nuevo AoO predictor.
17. Envío: use-tactical-action/withdraw con ids, to y path existentes.
18. No envío: coste/budget/contexto/axis/mode/status/fingerprint/proofs/exenciones/isAcrobatic.
19. Legacy restante: Run/5ft/Charge/forced/spell/GM/preparation y sus helpers; Move I7 se preserva normativo.
20. Evidencia ejecutada: adapter/resolver/handler I8 real, pureza, V1, gates, stale, payload y ambos renderers; resultados concretos en master-coverage y walkthrough.
21. Governance: futuro B estrictamente web; C/D si alcance exige shared/reglas/server/contratos; plan único embebido permitido por Fase 3.
22. **Cero ODR bloqueantes. IMPLEMENTACIÓN COMPLETADA; Ready for Architecture Review externa. No se requiere un nuevo Proceed.**

## Capítulo 12 — I10 Run Server Normative Integration

### 12.1 Estado, autoridades y alcance

**DESIGN ONLY. Awaiting Architecture Review and Proceed.** Auditoría sobre master/origin/master `9b8f8dd58bba9b79d18bcd3fcdf38dc97708e3a8`, limpio. I6/I7/I8/I9 técnicamente aprobados según el owner; Windows CI I9 SUCCESS informado por el owner. Este capítulo no afirma implementación I10 ni ejecución nueva de tests/CI.

La integración pertenece a Movement; las reglas y decisiones D-1 a D-5 permanecen exclusivamente en [Run](run-design.md). Este capítulo documenta su adaptación a APIs existentes, sin redefinir RAW. El único [plan activo](../../implementation_plan.md) detalla ejecución futura. Entrega documental Nivel A; futura implementación **Nivel C** por tocar orquestación/resolver servidor (§5.2 Governance). Si aparece necesidad de contratos, EffectManager/Reducer o infraestructura, detener y reclasificar D antes de implementarla.

### 12.2 Auditoría verificable del baseline

| Fuente inspeccionada | Hallazgo relevante |
|---|---|
| `apps/server/src/commands/tacticalCommands.ts`, `handleUseTacticalAction` | Phase active, actor existente, ownership, turno activo, snapshot y evaluateActionAvailability anteceden al dispatch Run. |
| Mismo archivo, `handleRun` | Pendientes AdO → attackMode none → canRun → buildStraightPath → runSpeedBudgetFeet → validateMovePath(false,false) → DT → V1 → AdO → commitSpatialTransition → stats manual → gasto manual → usedFullAttack → movement/spatial logs → pendientes/logs AdO → contribución dote → efecto/status log si corresponde → broadcast. No esfuerzo Disabled ni syncEncounterPhase en esta rama. |
| `apps/server/src/combat/spatialTransition.ts` | Valida evidencia modo/eje, mantiene srd_squeezing y posición; no presupuesto/contexto/stats. Continúa necesario para otros callers. |
| `packages/shared/src/rules.ts` | validateMovePath delega geometría, usa coste legacy con paridad local y rechaza exceso antes de DT del caller. canRun delega canFullAttack (incluye Disabled full-round, amenaza crítica y flags de economía), rechaza movimiento/move/5ft y consume FORBID_RUN reducido. No existe Limited Run. |
| `packages/shared/src/equipmentStats.ts`, `rules.ts` | getEquippedArmorEntry selecciona categoría; getArmorAdjustedSpeedFeet aplica tabla de armadura una vez en projectMovementSpeed. totalSpeedFeet consume proyección con buffs/efectos/rates. runSpeedBudgetFeet multiplica ese resultado por runSpeedMultiplier, sin aplicar de nuevo tabla de armadura. |
| `packages/shared/src/movementResolution.ts` | API existente acepta budget numérico y contexto inicial; legalidad → coste → comparación. illegal-route no tiene steps; insufficient-budget sí tiene evidencia completa; ready es consumible por Commit. No contiene policies Run ni economía. |
| `packages/shared/src/routeValidation.ts` | Adyacencia, límites, huella, terreno, esquinas, no repetición y ocupación genérica. Enemigo no helpless bloquea tránsito sin Acrobacias; endpoint no helpless bloquea. dying/stable pueden superar esta capa; V1 Run sigue necesaria. |
| `packages/shared/src/movementCost.ts` | Diagonal normal 5/10 contextual; squeezing/DT son hampering, diagonal fija 15 con duplicaciones adicionales. Base de ruta separada de coste. Run usa false para Acrobacias; no hay otro flag hampering genérico que inventar. |
| `packages/shared/src/movementCommit.ts` | Referencia viva canónica, turno/ronda/origen/gasto/contexto/fingerprint y evidencia espacial antes de escribir; mantiene squeezing/eje y confirma posición, stats base, gasto total y contexto. No economía ni publicación. |
| `packages/shared/src/effects/manager.ts`, `catalog.ts`, `reducer.ts`, `tick.ts`, `types.ts`, `contracts.ts`, `queries.ts`, `index.ts` | add es puro; valida id y eje; copia instancia, evalúa colisiones/cadena y devuelve room. running_exposed usa NO_DEX_TO_AC, onStack ignore, sin upgrade; reducer aporta overrides; tick expira until_turn solo con secuencia posterior y actor/fase coincidentes. |
| `packages/shared/src/featCatalog.ts` | runContribution conserva Destreza solo por contribución declarativa, actualmente srd_run; ningún otro beneficio. |
| `docs/designs/run-design.md`, este NDD | D-1/D-3/D-5 implementadas históricamente; D-2/D-4 diferidas. I8 fija patrón servidor y no autoriza migrar otros consumers sin diseño. |
| `tests/run.test.mjs`, `tests/run-server.test.mjs` | R-U1..21: guards, presupuesto efectivo/armadura, geometría y dote. R1..R18: exacto/exceso ×4, heavy exacto, pendiente inválida, DT, Disabled/Fatigued, economía, escrituras, origen AdO, efecto/dote, ownership/schema y Move regresión. No demuestran todavía integración normativa Run. Fixture servidor carece de normalDiagonalStepsThisTurn: completarla en futura implementación, sin fallback productivo. |
| `tests/withdraw-server.test.mjs` | Patrón I8 de integración real: contexto/coste, V1, ejes, guards, stale inyectado y ausencia de publicación parcial; reutilizar patrón, no semánticas limited/exención. |
| `tests/movement-resolution.test.mjs`, `tests/movement-commit.test.mjs` | Evidencia shared de contexto inicial no cero, diferencias legacy, coste/base, identidad y precondiciones stale; no sustituye pruebas del caller Run. |
| `scripts/e2e-websocket.mjs` | Escenario existente Run bajo Entangled rechaza; no constituye cobertura real de toda la migración. Escenarios I8 son regresión. No se ejecutó ni modificó script en diseño. |
| `apps/web/src/movementPreview.ts`, `hooks/useBoardSelection.ts`, `viewModel.ts`, `components/ActionsPanel/ActionsPanel.tsx` | Kind legacy-run; hook normativo para ordinary/withdraw. Run conserva highlights/validación legacy, factor ×4/×3 y gating/panel propios. No hay paridad normativa Run demostrada. |

### 12.3 Frontera y APIs sin extensiones

**Sí**, resolveMovementPipeline y commitMovementResolution sirven sin cambios. No RunMovementResolver ni RunBudgetPolicy shared. Snapshot actor (buscado por id dentro del snapshot) para resolver/policies; actor canónico vivo de room para Commit. Capturar precondiciones del snapshot antes de cálculos. No pasar el actor vivo como sustituto accidental del actor snapshot.

El caller construye `candidatePath = buildStraightPath(snapshotActor.position, command.to)` desde rules.ts, autoridad compartida ya usada por Run/Carga. Acepta horizontal/vertical/45°, rechaza otra pendiente y longitud cero. Cada paso conserva origin.zFeet; **destination.zFeet se ignora actualmente**, incluso un destino de igual xy y otra altura es inválido por cero desplazamiento. Preservar este comportamiento, sin vuelo/escalada ni nueva validación vertical o cambio del wire. Resolution recibe la ruta; no la elige, trunca ni busca otra.

El caller entrega `runSpeedBudgetFeet(snapshot, snapshotActor)` como availableBudgetFeet total. canRun exige gasto previo cero: no restar otra vez ni hacer budget residual. La armadura ya redujo velocidad efectiva; ×3 heavy frente a ×4 resto es el límite de acción, no multiplicador del coste de cada step. Speed 30 → 120; heavy speed efectiva 20 → 60; efectos de velocidad entran solo por proyección existente. No usar baseSpeedFeet crudo.

initialContext copia `snapshot.currentTurn.normalDiagonalStepsThisTurn` real aunque no sea cero; Commit publica projectedContext. Turno virgen normalmente produce cero, no autoriza reset ni default artificial. Fixtures completos; no D-7.

### 12.4 Precedencia de rechazos y policies

Orden cerrado: guards → construcción straight path → **illegal-route → insufficient-budget → Run DT → V1**. Conservar precedencia actual del caller aunque cambie el cálculo normativo que determina exceso. Si Resolution es insufficient-budget, **no ejecutar DT ni V1**, aun teniendo steps; gana presupuesto si también existe DT. illegal-route gana antes de comparar budget, incluida ocupación genérica que rechace la ruta. Esta elección preserva la estructura legacy y el patrón I8; alternativa DT primero descartada por alterar el error autoritativo sin necesidad.

Solo sobre ready, DT inspecciona `resolution.steps[].occupiedCells` con isDifficultTerrain(snapshot,x,y), incluyendo celdas no ancla Large. El booleano isDifficultTerrain de cada step ya es equivalente; conservar una sola inspección de evidencia. No reconstruir huella, reanclar actor ni usar fallback. DT no se convierte en prohibición genérica de Movement. Se evalúan footprints de pasos, no se añade prohibición nueva sobre origen abandonado.

V1, también solo sobre ready sin DT: intersección footprintCellKey de pasos confirmados con huellas shared de otros en snapshot; ignorar dead; tránsito bloquea todo enemy non-dead, endpoint cualquier non-dead. Ally transit permitido por esta policy, sujeto a legalidad genérica. dying/stable enemigos quedan rechazados aquí si superaron core; active/disabled suelen rechazarse antes por core. No unificar error de core y V1 artificialmente. Respetar zFeet mediante keys/geometría shared. No TacticalOccupancyPolicy nueva; seguir patrón I8 local sin extraer framework.

### 12.5 Squeezing, coste y contabilidad

No hay prohibición Run nueva por squeezing. Geometría shared decide natural→H/V, H/V persistido, H↔V y salida natural. Consumir sus steps; no inferir eje por dirección en servidor. Corrupción de instancia/eje puede lanzar error de integridad durante proyección: propagar rechazo sin mutación ni recuperación heurística.

Precisión de contrato: **MovementResolutionResult no expone finalSpatialMode ni squeezingAxis de nivel superior**. La evidencia final está en el último `resolution.steps` (spatialMode/squeezingAxis), y el resultado committed sí expone finalSpatialMode/squeezingAxis. Usar esos campos reales sin ampliar API. Commit mantiene efecto srd_squeezing y eje, incluso cambio H↔V; log de entrada/salida compara modo anterior capturado con final confirmado, sin inventar log de cambio de modo al solo rotar eje.

| Ruta a evaluar con budget Run | Coste / base / contexto esperados |
|---|---|
| Un ortogonal normal | 5 / 5 / sin cambio |
| Dos diagonales normales, inicial 0 | 15 / 15 / 2 |
| Una diagonal normal, inicial 1 | 10 / 10 / 2 |
| Ortogonal squeezing | 10 / 5 / sin cambio |
| Diagonal squeezing | 15 / 5 / sin consumir paridad normal |
| Squeezing + DT | Se calcula evidencia shared; si excede gana budget, si ready rechaza DT; nunca Commit. |
| Modificadores de speed | Cambian budget proyectado, sin alterar fórmula de coste. |

Única escritura de contabilidad: Commit suma totalCostFeet a movementUsedFeet y totalBaseRouteCostFeet a stats.distanceMovedFeet, y publica contexto. El caller no vuelve a sumar ni copia distancia legacy. No agregar hampering nuevo ni Acrobacias.

### 12.6 AdO, economía y publicación

Bufferizar findTriggeredOpportunityAttacksForPath(snapshot,snapshotActor,candidatePath,resolution.totalCostFeet, callback Rules.canMakeOpportunityAttack, **false, undefined, resolution.steps**). Sin exemptDepartureCellKeys propio; undefined usa conjunto vacío existente. No AdO adicional por comenzar Run. Mantener early return actual de distancia ≤ cellSizeFeet y metadata movementCostFeet calculada con contador local 5/10 del helper; esta integración cambia input total/evidencia, no corrige globalmente metadata. Origen completo puede provocar; reglas de reactor/AOO-03, amenaza, LoE/Cover/ocultación y múltiples reactores siguen en helper. Pendientes se resuelven manualmente tras ruta confirmada, sin interrupción/predictor web nuevo.

Antes de Commit: capturar modo previo, calcular policy/effect intent, oportunidades y datos/textos de logs en buffers; ninguna escritura a posición, efectos, gasto, stats, contexto, economía, log ni pending. IDs locales pueden prepararse sin publicarlos; ningún RNG de reglas ni tirada de esfuerzo. Crear entradas makeLog solo para publicación o mantenerlas descartables en buffer.

Tras committed: `usedFullAttack = true` solamente; no escribir usedMoveAction/usedStandardAction/usedFiveFootStep, ni renombrar marcador. Aplicar efecto Run si procede conforme §12.7; publicar movement/spatial/status logs y pendientes/logs AdO respetando orden visible previo (unshift invierte inserciones; reordenar aplicación de efecto no obliga a cambiar orden visible). Un solo broadcast al terminar. No añadir syncEncounterPhase ni esfuerzo Disabled a Run.

Guards conservan canRun, attackMode, full-round, Disabled prohibition, FORBID_RUN (Fatigued y cualquier fuente declarativa), pending, ownership/phase/turn. Ataques ordinarios previos bloquean por usedStandardAction/usedFullAttack en estados válidos; canRun/canFullAttack no inspeccionan attacksMade directamente. Una fixture con solo attacksMade inconsistente no autoriza introducir un guard nuevo. Fingerprint no autoriza acción ni sustituye estos gates; no añadir variante ×1 ni usar canUseMoveAction como reemplazo de autorización full-round.

### 12.7 Efecto Run y garantía de atomicidad

Sin contribución keepsDexBonusWhileRunning, preparar una instancia tipada existente: effectId srd_running_exposed, instanceId único local, source creature con actor.id, targets [actor.id], appliedAtEvent ActionResolved con round capturado (preservar contrato actual), duration until_turn con anchorCombatantId actor.id, phase start y appliedAtSequence del room previo. Commit no incrementa eventSequence. Tick exige un TurnStarted posterior de ese actor y sequence mayor; no expira al inicio de otro actor ni en evento de misma secuencia. Con srd_run no se construye/aplica exposición ni status log correspondiente; no beneficios adicionales de dote. onStack ignore evita duplicar una exposición ya existente, sin renovar silenciosamente su duración.

**Riesgo auditado:** add puede lanzar por id desconocido, squeezingAxis inválido y cadena upgrade_to de catálogo inválida (también al inspeccionar efectos existentes con targets solapados). No valida genéricamente schema completo, source/targets/duration ni es API de transacción. No afirmar un validate inexistente ni ausencia absoluta de fallos de infraestructura.

**Decisión concreta, sin shared nuevo:** una vez preparado el intent y buffers, antes de Commit ejecutar preflight puro `EffectManager.add(room, instance)` y **descartar por completo** el room devuelto. add no muta entradas; esto ejercita validaciones reales y stacking sobre colección vigente, sin aplicar efecto. Si lanza, abortar sin Commit ni publicación. No persistir esa colección ni el room precomputado. Sin feat no hay excepción a este preflight; con feat no se requiere add.

Después de Commit, ejecutar add otra vez **sobre room actual** y publicar únicamente `room.effectInstances = returnedRoom.effectInstances`. Nunca Object.assign con resultado de preflight ni reemplazar room/actor/currentTurn desde snapshot anterior. Así preserva posición, stats, contador y srd_squeezing recién confirmados. Commit solo puede cambiar colección mediante squeezing válido conocido; running_exposed y squeezing no son cadena de severidad relacionada ni upgrade. Catálogo estático y flujo síncrono sin callbacks externos mutantes entre preflight/Commit/add hacen deterministas las validaciones de la segunda llamada. Source/targets/duration provienen de constructor tipado del caller y se prueban explícitamente, no de wire.

Garantía: los rechazos de negocio/validación deterministas del efecto se detectan antes del Commit, y el add posterior usa estado vigente; no se promete rollback frente a OOM, monkeypatch arbitrario o excepción de transporte. Si en implementación se descubre validación dependiente de estado postmovimiento distinta de squeezing, o necesidad de efecto con callbacks/async, parar y revisar diseño/reclasificar; no hacer catch que publique movimiento sin consecuencia ni introducir transacción genérica a escondidas. Prueba discriminante futura: preflight falla → cero Commit/escrituras; Commit rechaza → ningún efecto aplicado; Commit entra/rota squeezing y add posterior mantiene eje/posición/contabilidad, con una exposición como máximo.

### 12.8 Stale y modelo síncrono

Precondiciones copiadas: expectedTurnCombatantId, expectedRound, expectedOrigin xyz, expectedMovementUsedFeet, expectedDiagonalContext; Resolution lleva fingerprint. Commit recibe actor vivo exacto de room, no clon. Rechazo stale/invalid descarta todos los buffers; no economía, efecto, logs, pending ni broadcast. Comparar estado inmediatamente anterior a Commit cuando el test inyecta una modificación externa: no deshacer esa modificación ajena.

Fingerprint cubre estado espacial/huellas (incluido eje), tablero/terreno/ocupación, speed efectiva y sus componentes, CANNOT_MOVE y gasto. No garantiza categoría heavy si speed coincide, Run feat, FORBID_RUN ni todos los flags de economía/attackMode. Handler actual es síncrono, sin await; helpers productivos son puros y callback AdO solo consulta Rules. No hay ventana de otro comando entre Resolve y Commit. No extender fingerprint para esas reglas.

La garantía depende de mantener ese modelo y guards al inicio. Tests stale pueden inyectar cambio de dependencias Movement en el callback AdO como I8; eso no prueba autorización Run ante mutación arbitraria fuera del modelo. Si se introduce await, callback mutante o reentrada, repetir guards Run y reconstruir presupuesto/intents/resolución sobre snapshot fresco antes de Commit; detener/revisar alcance si cambia el modelo actual. No aprobar silenciosamente resultados cacheados con feat/armadura/FORBID/economía obsoletos.

### 12.9 Retirada legacy, impacto y alternativas

handleRun dejará validateMovePath, commitSpatialTransition, distanceFeet legacy, sumas manuales y fallback de footprints. Mantener imports/helpers mientras otros consumidores (5ft, Charge y otros) los usen; buildStraightPath y runSpeedBudgetFeet siguen fuentes actuales. No borrar calculadores globales por migrar una rama.

Rule Engine/catálogos/CombatSnapshot/equipment/ownership/wire mantienen contratos: cambiar caller servidor, pruebas y docs. Sin TurnState nuevo, schema, protocolo, dependencia npm ni extensión shared. Web queda **legacy-run**, con divergencias conocidas de preview hasta sprint separado recomendado **I11 Run Preview**; no diseñarlo ni tocar apps/web en futura I10. Un bloqueo web imposible exige detener/reclasificar, no ampliación implícita. No dependencia de D-7. D-2 resistencia/Constitución/descanso (DT-018) y D-4 visión (DT-019) permanecen según Run/registro de deuda.

Alternativas descartadas: resolver/budget policy Run en shared (number basta); recalcular huellas (duplica autoridad); DT antes de budget (altera precedencia); prohibir squeezing (nueva regla); actualizar room precomputado (pisaría Commit); confiar solo en tipado para add (no ejercita cadena real); migrar preview o metadata AdO aquí (otro alcance).

### 12.10 Diseño de pruebas futuras, no ejecutadas

Usar handler real y rooms independientes; oracle shared para coste/contexto, expectativas explícitas para policies. No crear helper V1 de test que replique producción. Completar fixture de contador y comparar room completo/broadcasts en rechazo.

| Grupo | Casos de aceptación/rechazo obligatorios |
|---|---|
| A — Route/cost | Orthogonal 5, diagonal 5, dos diagonales 15, initial parity 1→10; ×4 exacto120/exceso125, heavy ×3 exacto60/exceso65; speed buff/rate sobre armadura una vez. Stats base y gasto total distinguibles. |
| B — Straight | Horizontal, vertical, 45°, pendiente inválida, zero xy, origin.zFeet conservado y destination.zFeet ignorado; sin path cliente. |
| C — DT/precedencia | Primer/medio step, no-ancla Large, squeezing+DT; illegal+DT gana ilegal, legal overbudget+DT gana budget, ready+DT gana DT antes V1; ningún fallback/reanclado. |
| D — Squeezing | Natural→H/V, H persist, V persist, H↔V con fixtures geométricamente válidos, salida natural; eje ausente/inválido/duplicado aborta sin publicación; gasto10/base5 y diagonal15/base5. Efecto Run conserva squeezing confirmado. |
| E — Occupancy | Enemy active/disabled/dying/stable tránsito/final; ally tránsito/final; dead; Large no-ancla y alturas. Distinguir rechazo core del adicional V1. |
| F — AdO | Origen amenazado con ruta >5 provoca; pasos posteriores, Large/eje confirmado, varios reactores, sin exención; verificar helper recibe totalCostFeet y steps; preservar early return y metadata local vigente. |
| G — Guards | Pending, attackMode, gasto previo, usedStandard/Move/FullAttack/5ft, attacksMade, Disabled/Diehard economy full-round, FORBID_RUN, wrong actor/control/phase/turn. Solo usedFullAttack cambia tras éxito. |
| H — Efecto | Sin feat aplica, con feat ausente; source/target/duration/sequence correctos, siguiente turno propio expira, otro actor no; stacking exactamente una instancia; preflight puro y add posterior solo tras Commit; fallo preflight deja room intacto. |
| I — Stale/atomicidad | Referencia viva, turno, ronda, origen xyz, gasto, contexto, fingerprint de movilidad/terreno/ocupación, eje; rechazo conserva estado precommit, sin economía/efecto/log/AdO/broadcast. Éxito conserva Commit tras segundo add. |

Shared Resolution/Commit y Withdraw I8 quedan como regresión; añadir asserts del consumer en run-server y geometría/budget en run.test si faltan, sin duplicar suites core ni relajar reglas para fixtures.

E2E WebSocket futuro, servidor real: (1) ×4 accepted verifica posición/gasto/usedFullAttack; (2) heavy ×3 exacto y exceso; (3) dos diagonales normales con coste15/contexto2; (4) DT rechaza sin room-update de éxito ni cambio de estado; (5) reactor amenaza origen y se publica pending sin exención; (6) sin/con feat comprueba efecto correcto/ausente y duración; (7) invalid/actor/turn rechazo sin publicación parcial. Stale entre Resolve/Commit no es reproducible enviando dos comandos síncronos por socket: probarlo mediante inyección de integración, sin hook productivo nuevo. En socket corroborar rechazo observable y estado autoritativo posterior; no fingir concurrencia inexistente.

### 12.11 Respuestas de cierre y ODR

1. Resolve sin cambios: sí (§12.3).
2. Commit sin cambios: sí, actor vivo y precondiciones (§12.8).
3. candidatePath: caller mediante buildStraightPath de rules.ts.
4. ×4/×3: runSpeedBudgetFeet/velocidad efectiva, fuera de core.
5. DT vs overbudget: gana budget; illegal primero (§12.4).
6. DT: occupiedCells confirmadas, sin reanclado.
7. Contexto: contador real copiado, Commit publica proyección.
8. Squeezing: steps/último step y Commit; no campos top-level ficticios.
9. V1: ready después de DT, policy local no-dead.
10. AdO: helper actual, totalCostFeet/steps, sin exención.
11. Buffer: intent efecto, oportunidades y evidencia/textos de logs, sin escrituras.
12. Publicación: economía/efecto/logs/pending y broadcast único tras committed.
13. usedFullAttack: exclusivamente tras committed.
14. Exposición: intent existente, preflight puro descartado y add sobre room postcommit.
15. Fallo add: validaciones deterministas ejercitadas antes; garantía síncrona y catálogo fijo, sin rollback ficticio (§12.7).
16. srd_run: conserva Destreza, no efecto ni beneficios nuevos.
17. Stale: descartar buffers y rechazar sin publicación.
18. Retirar de Run: validateMovePath/spatialTransition/contabilidad y footprint fallback legacy.
19. Mantener: straight path, budget y helpers usados por otras ramas.
20. Preview: legacy-run; I11 separado recomendado.
21. D-7: no dependencia ni implementación.
22. D-2/D-4: DT-018/DT-019 intactas.
23. Governance futura: C; D si cambia infraestructura/contratos.
24. **Cero ODR bloqueantes de diseño. Awaiting Architecture Review and Proceed.** No autoriza implementación ni declara aprobación externa.
