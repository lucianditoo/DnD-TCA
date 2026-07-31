# Normative Area Shape Projection (D-1A-R1)

Responsabilidad: Definir la representación autoritativa, formas geométricas y modos de propagación de las áreas de efecto sobre la grilla táctica tridimensional, de acuerdo al SRD 3.5.
Autoridad: Canónica (Nivel D)
Lifecycle: Diseño Aprobado (Remediation)
Reemplaza: Reemplaza parcialmente a `docs/designs/spell-aoe-geometry-design.md` (supersede las definiciones geométricas y de inclusión, pero no su pipeline interno en backend).
Complementa: `docs/designs/normative-spatial-geometry.md` (D-1R1).
Consumidores: Rules Engine, Spells, Targeting.

---

## 1. Separación: Forma y Propagación

El SRD no colapsa la forma de un área con la forma en la que se propaga. Este documento separa normativamente ambas dimensiones.

### 1.1 Geometric Shape (Forma Geométrica)
El volumen puro a proyectar:
- **Cone:** Un volumen que se ensancha conforme avanza.
- **Line:** Un volumen rectilíneo o trazado de anchura definida.
- **Sphere:** Un volumen esférico o circular.
- **Cylinder:** Un cilindro con radio y altura.
- **Shapeable Cubes:** Múltiples cubos unidos para formar volúmenes irregulares.
- **Other:** Cualquier forma irregular dictada por el efecto específico.

### 1.2 Propagation Mode (Modo de Propagación)
Cómo la forma interactúa con el entorno y el espacio:
- **Burst:** Afecta a todo en su área (excepto aquello con Cobertura Total desde su origen). No dobla esquinas.
- **Emanation:** Funciona idénticamente a un Burst, pero el efecto continúa radiando durante su duración.
- **Spread:** Puede doblar esquinas y rodear paredes. No requiere `Line of Effect` directo al origen (utiliza distancia recorrida).
- **Direct Line Progression:** Avanza en la dirección designada hasta su límite o una barrera (usado por Lines).
- **Effect-specific behavior:** Propagaciones híbridas declaradas explícitamente en el efecto (ej. Cylinder).

> **Nota SRD:** Burst, Emanation y Spread NO son sinónimos de Sphere. Un conjuro puede ser un *cone-shaped burst*, *spherical spread*, etc.

---

## 2. Punto de Origen (Point of Origin)

El origen normativo de un área jamás es el centro de una casilla.
- **Grid Intersection (SRD):** El origen de un área es una intersección de la cuadrícula.
- **Cones y Lines (SRD):** Comienzan estrictamente desde una esquina (intersección) del espacio del originador (el `Body Prism`).
- **Excepciones (SRD):** Solo existen si la descripción concreta del efecto lo declara explícitamente.
- **Generalización 3D (Extensión del Proyecto):** En el espacio tridimensional `(Volumetric Spatial Coordinate)`, una *grid intersection* es topológicamente el vértice exacto compartido por hasta 8 celdas cúbicas espaciales (o 4 celdas en el plano Z para áreas planas).

---

## 3. Inclusión de Casillas (Inclusion Contract)

El modelo **rechaza categóricamente** la regla del "50% de volumen/Half-Square" para calcular la inclusión en D&D 3.5 en grillas.

La regla normativa (SRD):
- Se mide desde el punto de origen de intersección a intersección.
- Se cuentan las diagonales con la métrica vigente (5-10-5 en 2D).
- **Far Edge Rule:** Si el borde lejano (*far edge*) de una casilla está dentro del área (del radio o límite), la casilla queda incluida.
- **Near Edge Rule:** Si el límite del área solo toca el borde cercano (*near edge*) o no llega al lejano, la casilla queda excluida.
- **Line:** Afecta las casillas por las que pasa la línea trazada. No utiliza el "centro geométrico" de la celda como verificador.

> **ODR Bloqueante (Z-Axis):** La traducción exacta de la regla de *far-edge/near-edge* a la altura vertical 3D, caras superiores/inferiores y distancia volumétrica estricta depende de la ODR abierta de Distancia Tridimensional en D-1R1. El motor no implementará una regla arbitraria de caras Z hasta cerrar dicha ODR.

---

## 4. Definiciones de Formas (Geometric Shapes)

### 4.1 Cone
- **SRD:** Parte de una esquina del espacio del originador, se proyecta en la dirección designada y se ensancha conforme avanza. Funciona normalmente como un *Burst* o *Emanation*. No dobla esquinas (salvo regla específica).
- **Extensión del Proyecto:** La orientación puramente XYZ (ej. un cono disparado estrictamente hacia abajo 45 grados) es una extensión del proyecto (ya que el PHB 3.5 trata normalmente el combate en un plano 2D, aunque permite apuntar al aire).

### 4.2 Line
- **SRD:** Parte de una esquina del espacio del originador, avanza en la dirección designada y termina al alcanzar su límite o encontrar una barrera que bloquee *Line of Effect*. Afecta las criaturas en las casillas por las que pasa.
- **Aclaración:** El ancho normativo y otras dimensiones proceden del efecto; no se universaliza un prisma 5x5.
- **Extensión del Proyecto:** La orientación XYZ de la línea.

### 4.3 Sphere
- **SRD:** Forma geométrica (no un modo de propagación). Puede combinarse con *Burst*, *Emanation* o *Spread*. Su inclusión depende del radio, originado en una intersección.
- **Dependencia:** Consume la métrica autoritativa 3D pendiente de D-1R1 (ODR abierta) para determinar qué casillas cubre en el espacio 3D real, utilizando la Far-Edge Rule.

### 4.4 Cylinder
- **SRD:** El origen es el **centro de un círculo horizontal**. El cilindro se proyecta **hacia abajo** desde ese círculo, poseyendo radio y altura definidos.
- **SRD:** Ignora las obstrucciones dentro de su área. Para calcular *Line of Effect* y Cobertura Total hacia las víctimas, el origen relevante es el círculo completo del cilindro (o un punto de él), no un único centro puntual lejano.
- **Restricción:** No proyecta "hacia arriba" por defecto. Un efecto solo proyectará hacia arriba o hacia otra orientación si su texto normativo lo exige explícitamente. No aplica el pipeline genérico de "origen a centro de celda".

### 4.5 Shapeable Cubes
- **SRD:** Algunos efectos "Shapeable" se construyen alineando múltiples cubos de tamaño base (ej. bloques de 10 pies). Los cubos son unidades de composición para formar volúmenes irregulares. Ninguna dimensión puede ser menor a la permitida por el SRD.
- **Extensión del Proyecto:** La alineación exacta a la grilla y la orientación 3D de estas construcciones libres es una decisión discreta del motor, atada a la interfaz táctica 2.5D. No operan como "equivalentes" a los Conos/Líneas simples.

---

## 5. Area Projection y Spatial Trace

El documento D-1R1 introdujo `Spatial Trace`. Este documento establece que **no existe un pipeline único y universal** que aplique ciegamente `Spatial Trace` a toda área desde un origen puntual.

Las estrategias normativas de combinación Forma + Propagación son:
- **Burst / Emanation:** Proyección de forma teórica + evaluación de Total Cover mediante `Spatial Trace` (LoE) desde el punto de origen a la víctima/casilla.
- **Spread:** Propagación progresiva que consume distancia de recorrido (ruta). Dobla esquinas. No exige LoE recto desde el origen al objetivo. Se cuenta alrededor de las paredes, pero no se trazan diagonales a través de esquinas bloqueadas (SRD).
- **Line:** Avanza a través del `Spatial Trace` direccional hasta agotar la longitud del efecto o colisionar con una barrera física (Total Cover / LoE block).
- **Cylinder:** Posee una regla especial. Proyecta su círculo horizontal de origen, viaja hacia abajo e ignora obstáculos internos. No utiliza el clipping genérico de Burst.
- **Other:** Reservado para excepciones explícitas del texto de un conjuro.

---

## 6. Spatial Distance y Métricas de Propagación

- La métrica XYZ (distancia espacial tridimensional) **NO está validada**. D-1R1 mantiene una ODR bloqueante al respecto.
- Las formas esféricas, *Bursts* y *Emanations* deberán consumir la **futura métrica autoritativa** de distancia para determinar qué *far edges* alcanzan.
- El modo *Spread* no utiliza distancia recta; consume **distancia recorrida** (Route Cost / pathfinding métrico).
- La medición plana (2D) continúa obedeciendo rígidamente la regla SRD: contar desde intersección a intersección alternando el coste de diagonales 5-10-5. Ninguna proyección tridimensional dependiente de XYZ se implementará hasta cerrar la ODR.

---

## 7. Cover y Resolución Mecánica

El pipeline de áreas **no determina semántica defensiva automática**.
`Area Projection` detiene su responsabilidad al devolver la colección de *Candidatos Afectados* (Prismas o Celdas). A partir de ahí, delega al *Rule Engine* del efecto concreto decidir:
- Si se tiran salvaciones o hay daño.
- **Cover:** Solo si el efecto lo declara (ej. un ataque de área que conceda reflejos extra por Cover parcial, o si D-1R1 dictamina que un objeto interrumpió el *Spatial Trace* sin causar Total Cover). `DEFENSE-COVER` no se muta por este documento.
- No hay una "fase de Cover obligatoria universal" subsumida en la geometría del área.

---

## 8. Matriz Obligatoria de Trazabilidad

| Concepto | Tipo | Fuente Normativa (SRD 3.5) | Extensión del Proyecto / Notas | ODR / Estado |
|---|---|---|---|---|
| Point of Origin | Intersección | PHB "Aiming a Spell" | - | Resuelto |
| Grid Intersection | Topología | PHB "Area" | Vértice 3D (8 celdas compartidas) | Decisión Arquitectónica (D-1A-R1) |
| Far Edge | Inclusión | PHB "Area" | - | Resuelto (SRD) |
| Near Edge | Exclusión | PHB "Area" | - | Resuelto (SRD) |
| Diagonal Counting | Métrica | PHB "Movement / Distance" | 5-10-5 en 2D | Resuelto para 2D |
| Cone | Shape | PHB "Area - Cone" | Orientación y vector libre en XYZ | Extensión del Proyecto |
| Line | Shape | PHB "Area - Line" | Orientación 3D | Extensión del Proyecto |
| Sphere | Shape | PHB "Area - Sphere" | - | Resuelto |
| Cylinder | Shape | PHB "Area - Cylinder" | - | Resuelto |
| Burst | Propagation | PHB "Area - Burst" | - | Resuelto |
| Emanation | Propagation | PHB "Area - Emanation" | - | Resuelto |
| Spread | Propagation | PHB "Area - Spread" | - | Resuelto |
| Shapeable Cubes | Shape | PHB "Area - Shapeable" | Alineamiento y anclaje a grid 3D | Extensión del Proyecto |
| LoE | Primitiva | PHB "Line of Effect" | Consumido por Burst/Line/Emanation | D-1R1 / Resuelto |
| Orientación XYZ | Dirección | - | Libertad de 360° direccional | Extensión del Proyecto |
| Múltiples Surfaces | Topología | - | Cilindros/Conos/Esferas las penetran (si LoE lo permite) | D-1R1 / Resuelto |
| Volumetric Coord | Identidad | - | Celdas puras en el vacío | D-1R1 / Resuelto |
| UI Previews | Presentación | - | El cliente calcula pero sin autoridad | D-1A-R1 / Resuelto |
| Distancia XYZ | Métrica 3D | - | Fórmula 3D para radios y far-edges | **ODR Bloqueante (D-1R1)** |
