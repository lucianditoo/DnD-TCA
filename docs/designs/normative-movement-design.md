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

### 3.8 Composición de múltiples contribuciones

Una misma Route puede quedar afectada por más de una fuente de coste. El assessment debe conservar cada contribución por separado y no puede ocultar su procedencia dentro de un total sin desglose.

El corpus aprobado permite identificar adiciones, multiplicaciones, reemplazos, costes fijos y prohibiciones, pero no establece una política única y exhaustiva para componer todas sus intersecciones posibles. Por ello, este capítulo no inventa un orden universal de operaciones ni una regla de stacking.

#### ODR D-1B-C3-01 — Composición simultánea de fuentes de coste

**Aclaración previa:** el coste fijo de 15 ft de una diagonal difícil sustituye al patrón diagonal normal de ese Step, resolviendo su interacción directa con el Movimiento Diagonal, pero no resuelve su combinación con otros multiplicadores (ej. Squeezing).

**Pregunta:** cuando un mismo Step recibe simultáneamente dos o más contribuciones de coste —por ejemplo, un coste fijo de terreno y un multiplicador por estado corporal—, ¿qué regla normativa determina su orden, acumulación y precedencia?

**Alternativas que requieren ratificación:**

1. aplicar la convención general de multiplicadores del corpus de D&D 3.5 a todas las contribuciones multiplicativas y definir por separado la precedencia de reemplazos y costes fijos;
2. establecer un orden cerrado por semántica —reemplazo o coste fijo, adición y multiplicación— para toda evaluación de coste;
3. exigir una política explícita únicamente para cada combinación normativa reconocida, sin imponer una precedencia global.

**Impacto:** la decisión determina el total de Routes donde coinciden terreno difícil, Squeezing, visibilidad obstaculizada u otras fuentes futuras. También gobierna la igualdad entre assessment autoritativo y preview.

**Carácter:** es bloqueante para implementar combinaciones simultáneas cuyo resultado dependa del orden o stacking, pero es diferible para Routes afectadas por una sola fuente o por contribuciones cuya composición ya esté explícitamente resuelta por una regla normativa.

### 3.9 Footprint efectivo y coste

El coste se evalúa sobre la entidad que recorre el Step, no solo sobre su ancla. Para cada Step deben considerarse todas las celdas del **Footprint efectivo** que la entidad ocupa en el destino o en la transición cuando la regla normativa aplicable así lo requiera.

Cuando distintas celdas del Footprint efectivo estén sujetas a costes de terreno diferentes, el Step adopta el coste de terreno aplicable más alto. Los costes no se suman una vez por cada celda corporal ocupada.

Esta evaluación usa la distinción canónica entre Footprint natural y Footprint efectivo. No define geometría corporal, no persiste huellas derivadas y no afirma que exista validación continua de **Swept Volume**; esa extensión permanece fuera de alcance.

### 3.10 Coste de Squeezing

Mientras una entidad se desplaza legalmente con un Footprint efectivo de Squeezing, cada espacio recorrido cuenta como el doble para Movement Cost.

Squeezing aporta una contribución multiplicativa de coste sobre los Steps afectados. El coste continúa acumulándose por Step de la Route, no por cantidad de celdas que componen la huella corporal.

Este capítulo no decide cuándo Squeezing es legal, cómo se deriva su Footprint efectivo, qué penalizadores aplica a ataques o defensa ni cómo se resuelve el tránsito por un espacio menor que la mitad de la anchura natural. La variante que requiere Escape Artist permanece como dependencia futura.

La combinación numérica de Squeezing con otras fuentes simultáneas queda sujeta a la ODR D-1B-C3-01.

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

La única ODR nueva es D-1B-C3-01. Las ODR preexistentes —incluida la métrica de `Spatial Distance 3D`— permanecen fuera de alcance y sin cambios.

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

La ODR preexistente D-1B-C3-01 sobre composición simultánea de fuentes de coste permanece abierta (el coste fijo de una diagonal difícil no participa del patrón diagonal normal, que fue la regla aclarada en el Capítulo 3).

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
- contratos TypeScript, pseudocódigo e implementación.

No se abre ninguna ODR nueva. La ODR D-1B-C3-01 permanece limitada a la composición simultánea de fuentes de coste y no altera el ciclo definido en este capítulo.

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

No se abre ninguna ODR nueva. La ODR D-1B-C3-01 conserva exactamente su alcance previo y no se amplía por la interacción con estos consumidores.


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