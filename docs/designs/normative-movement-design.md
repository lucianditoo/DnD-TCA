# Normative Movement Design (D-1B)

Responsabilidad: Definir los contratos normativos comunes del movimiento: su modelo abstracto, la legalidad de una Route y el coste que consume una Route legal.
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

### 3.4 Contador diagonal por Route

Cada Route mantiene conceptualmente su propia secuencia ordinal de Steps diagonales.

1. el primer Step diagonal cuesta 5 ft;
2. el segundo cuesta 10 ft;
3. el tercero vuelve a costar 5 ft;
4. el cuarto cuesta 10 ft;
5. el patrón continúa como **5 / 10 / 5 / 10...** hasta terminar la Route.

El contador depende exclusivamente de que el Step sea diagonal. No depende del plano, del número de ejes modificados ni de la dirección del desplazamiento. Un Step diagonal XYZ ocupa una sola posición dentro de la secuencia.

Los Steps ortogonales no consumen ni reinician la secuencia diagonal. Cada nueva Route inicia una secuencia propia; no hereda el ordinal de una Route anterior.

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
- un Step diagonal afectado cuesta **15 ft**;
- cada Step diagonal afectado cuesta 15 ft de forma constante;
- no existe una alternancia **15 / 20**;
- no se obtiene el resultado duplicando mecánicamente el valor final de la secuencia diagonal ordinaria.

Un Step diagonal sobre terreno difícil sigue siendo diagonal y ocupa una sola posición en el contador diagonal de su Route, aunque su coste aplicable sea el valor fijo de 15 ft.

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

El resultado conceptual de evaluar una Route legal debe contener, como mínimo:

1. el coste total de la Route en pies;
2. el coste de cada Step;
3. el Base Step Cost y las contribuciones aplicadas a cada Step;
4. el modo o los modos de desplazamiento requeridos;
5. la fuente y evidencia normativa de cada contribución;
6. el Movement Budget considerado para cada modo aplicable;
7. un veredicto de presupuesto suficiente o insuficiente;
8. cualquier prohibición normativa aplicable al consumidor evaluado.

El assessment es proyectivo, determinista y auditable. No ejecuta el Movement, no descuenta presupuesto, no cambia la posición y no muta el CombatRulesSnapshot. Si una combinación cae dentro de una ODR bloqueante todavía no ratificada, no debe fabricarse un total autoritativo para esa combinación.

### 3.14 Autoridad y previews

El servidor produce el assessment final sobre su Route y su CombatRulesSnapshot autoritativos.

La UI puede consumir las mismas reglas compartidas para anticipar costes, contribuciones y suficiencia de presupuesto. El preview debe mostrar el mismo desglose y usar el mismo cálculo, pero no puede confirmar de forma autoritativa el gasto, la ejecución ni el resultado final.

No se permiten fórmulas paralelas de coste por acción, resolver o frontend. Las operaciones futuras consumen el assessment común y agregan únicamente sus propias restricciones externas.

### 3.15 Invariantes normativos

1. Una Route legal puede ser demasiado costosa para el presupuesto disponible.
2. Movement Cost nunca cambia la topología ni la continuidad de una Route.
3. Un Step diagonal constituye una sola unidad ordinal aunque cambie dos o tres ejes.
4. Cada Step diagonal afectado por terreno difícil cuesta 15 ft constantes.
5. `Spatial Distance` y `Route Cost` son magnitudes distintas y no intercambiables.
6. El cliente no puede confirmar autoritativamente gasto ni ejecución.
7. Ninguna acción mantiene una fórmula paralela de Route Cost.
8. La evaluación es determinista, trazable y auditable.
9. El Footprint efectivo completo participa en la determinación del coste aplicable.
10. La insuficiencia de presupuesto y una prohibición contextual no se codifican como ilegalidad topológica.

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
