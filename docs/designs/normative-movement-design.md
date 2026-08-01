# Normative Movement Design (D-1B)

Responsabilidad: Definir los contratos normativos comunes del movimiento, desde su modelo abstracto hasta la legalidad de una Route.
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
