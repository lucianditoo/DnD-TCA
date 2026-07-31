# Geometría Normativa Espacial (D-1)

Responsabilidad: Definir la matemática autoritativa y el modelo formal del espacio táctico tridimensional.
Autoridad: Canónica (Nivel D)
Lifecycle: Diseño Aprobado
Reemplaza: -
Complementa: `docs/designs/spatial-engine-2.5d.md` (SSOT Espacial)
Consumidores: Rules Engine, Movement, Cover, Vision, LoE, AoE, Threat, Flanking, Opportunity Attacks, Editor, FoW, Persistencia, Protocolo.

---

## 1. Modelo Espacial Formal

El motor opera sobre un espacio tridimensional cuantizado regido por las siguientes primitivas estrictas:

- **Spatial Cell (Celda):** La unidad volumétrica fundamental indivisible del tablero táctico. Mide matemáticamente 5 pies de ancho, 5 pies de largo y 5 pies de alto (5x5x5). No se admiten subdivisiones.
- **Column (Columna):** Una colección de todas las celdas que comparten una misma coordenada horizontal `(x, y)`. Las columnas estructuran la verticalidad pero no tienen autoridad topológica independiente de una superficie.
- **Surface (Superficie):** Una estructura topológica que agrupa celdas horizontales. Provee anclaje, soporte gravitatorio, y transitabilidad.
- **Spatial Position (Posición Espacial):** La identidad inmutable de una entidad anclada al espacio. Consta de `(x, y, surfaceId)`.
- **Vertical Profile (Perfil Vertical):** La extensión vertical intrínseca de una criatura u objeto. Determina cuántas celdas en el eje Z ocupará hacia arriba desde su celda de soporte.
- **Footprint (Huella):** La proyección puramente horizontal (2D) de celdas `(x, y)` ocupadas simultáneamente por una entidad de tamaño grande o superior.
- **Body Prism (Prisma Corporal):** El volumen táctico exacto que ocupa una entidad en el espacio tridimensional. Es la extrusión del Footprint a través del Vertical Profile, anclado a la elevación de su Surface.
- **Environmental Volume (Volumen Ambiental):** El conjunto de celdas ocupadas por un objeto o estructura del entorno (que no es terreno/Surface).
- **Hazard Volume (Volumen de Peligro):** Una región volumétrica sin solidez física que impone reglas al ser atravesada u ocupada (ej: fuego, ácido, niebla).
- **Empty Space (Espacio Vacío):** Celdas que no pertenecen a ninguna Surface, ni están ocupadas por Prismas, Volúmenes o Hazards. Representan el vacío tridimensional.

---

## 2. Identidad Espacial Canónica

Cualquier punto de anclaje táctico se identifica mediante la siguiente tupla estricta:

```typescript
SpatialPosition {
  x: number;
  y: number;
  surfaceId: string;
}
```

Esta identidad permite distinguir inequívocamente posiciones superpuestas verticalmente en la misma columna `(x,y)`. Un túnel bajo un puente en `(5, 5)` tendrá la tupla `(5, 5, "tunnel-surface")` y el puente tendrá `(5, 5, "bridge-surface")`. Ambos puntos coexisten y son independientes para efectos de ocupación, movimiento y targeting.

---

## 3. Surface (Superficie)

Una Surface es la entidad primaria de soporte:
- **Identidad:** `surfaceId` inmutable y único por mapa.
- **Extensión:** Una colección definida de coordenadas `(x, y)` pertenecientes a la superficie.
- **Elevación:** Un valor escalar `zFeet` (estrictamente múltiplo de 5) que define la cota inferior transitable.
- **Soporte:** Garantiza que una criatura en esta superficie no cae.
- **Solidez y Continuidad:** Una Surface es infinitamente delgada para la matemática del anclaje, pero proyecta obstrucción total descendente de LoE si las reglas de topología lo determinan.
- **Agujeros e Islas:** Una Surface *puede* tener agujeros (celdas no incluidas en su extensión x/y) y *puede* contener "islas" desconectadas (celdas x/y sin adyacencia contigua en la misma Surface).
- **Conexiones:** Puntos de transición declarativos que vinculan celdas específicas de una Surface con celdas de otra Surface (ej: escaleras, rampas, portales). Abandonar una Surface sin utilizar una conexión (o sin vuelo/salto explícito) equivale a abandonar el anclaje y desencadena caída.
- **Superposiciones:** Múltiples Surfaces pueden existir en la misma `(x, y)` siempre que su elevación o geometría sólida no intersequen celdas ya reservadas por otra Surface.

---

## 4. Footprints

El Footprint define estrictamente la extensión horizontal (X/Y) ocupada por una criatura en su Surface anfitriona. Formalizado:
- **Mediano / Pequeño / Diminuto:** 1 celda (5x5).
- **Grande:** Cuadrado de 2x2 celdas.
- **Enorme:** Cuadrado de 3x3 celdas.
- **Gargantuesco:** Cuadrado de 4x4 celdas.
- **Colosal:** Cuadrado de 6x6 celdas.

El Footprint carece de altura. Solo existe en el plano de su Surface.

---

## 5. Perfil Vertical

El Perfil Vertical es un escalar en incrementos de 5 pies que indica la altura de la entidad.
- **Origen y Autoridad:** No se deriva exclusivamente del SRD `sizeCategory`. La fuente de autoridad es el catálogo del `Equipment/Monster/Template`, permitiendo perfiles asimétricos (ej: criatura Grande pero alta (10ft), criatura Grande pero larga/baja (5ft), una criatura Mediana montada sobre una Grande).
- **Monturas:** Componen perfiles. La montura provee soporte, el jinete apila su perfil vertical sobre el de la montura.

---

## 6. Body Prism (Prisma Corporal)

El Prisma Corporal es la autoridad absoluta de volumen de una entidad.
- **Composición:** Resulta de la intersección del Footprint (X, Y) extruido uniformemente en Z a lo largo de su Perfil Vertical, originándose en el `zFeet` de la Surface.
- **Consumo:** Es consumido irrestrictamente por LoE, Cover, Threat, Flanking, AoE y Reach.
- **No presentacional:** El Body Prism es un poliedro táctico matemático; el Renderer dibujará su representación estética de forma independiente, pero jamás utilizará la malla visual para resolver reglas.

---

## 7. Distancia

Propiedades matemáticas del cálculo de distancia, sin imponer algoritmo específico:
- **Determinismo estricto:** Idénticos inputs garantizan idénticos outputs sin importar estado de memoria o plataforma.
- **Simetría:** La distancia de A a B debe ser matemáticamente idéntica a la distancia de B a A, independientemente del volumen de A o B.
- **SRD 5-10-5:** El costo del primer paso diagonal es 5, el segundo es 10, de forma alternada. En un espacio volumétrico, esto aplica a cualquier vector diagonal X-Y, X-Z o Y-Z.
- **Cuantización:** Toda distancia producida será siempre un múltiplo entero de 5 pies. No existe distancia 12.5.
- **Volumétrica:** La distancia entre dos entidades se mide como la distancia mínima entre cualquier par de celdas pertenecientes a sus respectivos Body Prism.

---

## 8. Reach (Alcance)

El Reach no es un número abstracto de 1D ni una grilla 2D. 
- **Volumen Alcanzable:** Se define como el conjunto matemático de celdas de Empty Space o Surface cuyo centro se encuentre dentro de la distancia de Reach permitida respecto a cualquier celda del Body Prism del agresor. 
- **Forma:** El alcance de 5 pies envuelve inmediatamente el Prisma. Alcances mayores forman envolventes poliédricas que simulan esferas (usando métrica 5-10-5).

---

## 9. Movimiento y Transiciones

- **Caminar:** Avanzar entre celdas adyacentes pertenecientes a la misma Surface, asumiendo costo normal o terreno difícil si la Surface o un Hazard lo dictan.
- **Conexiones (Trepar/Escaleras/Rampas):** El movimiento a través de un vínculo `connection` registrado transfiere el anclaje de `SurfaceA` a `SurfaceB`, cobrando el coste de distancia definido en la conexión y validando los prismas en destino.
- **Saltar:** Transición controlada que cruza Empty Space sin Surface de soporte subyacente. Inicia en un anclaje, fluye a través del aire, y finaliza validando otro anclaje legal, o resuelve en caída.
- **Caer:** Transición de movimiento involuntaria iniciada por perder anclaje. El prisma desciende sobre el Empty Space de su columna hasta colisionar con una Surface sólida, un Body Prism válido o un terreno terminal.
- **Volar:** Transición continua a través de Empty Space sin pérdida de anclaje, sostenida por estado del actor (reservado para diseño futuro).

---

## 10. Intersecciones

Las reglas que resuelven si dos volúmenes colisionan:
- **Body Prism vs Body Prism:** Prohibido por regla general al finalizar un movimiento. Permitido durante una transición temporal según mecánicas (movimiento por aliados) si las reglas superiores lo consienten. Intersección pura se detecta por compartición de al menos una Spatial Cell idéntica.
- **Body Prism vs Surface:** Un prisma jamás penetra una Surface transitable sólida bajo su nivel de origen.
- **Body Prism vs Object:** Un prisma no comparte celdas con un Object definido como sólido.
- **Body Prism vs Hazard:** Permitido. Detona callbacks del Hazard o afecta el coste.
- **Surface vs Surface:** Una Surface transitable no puede superponerse en la misma elevación `zFeet` exacta con otra Surface transitable dentro de la misma columna `(x, y)`.

---

## 11. Line of Effect (LoE)

Contratos de LoE volumétrico:
- LoE es un vector puro o cilindro trazado matemáticamente desde una celda de origen hasta una celda de destino (o entre Body Prism).
- LoE carece de propiedades visuales o lumínicas.
- Es bloqueado total y automáticamente por Surfaces opacas sólidas o Environmental Volumes definidos explícitamente con bloqueo absoluto (Paredes de Piedra).
- Una vez bloqueado el rayo, todo volumen subsecuente carece de LoE.

---

## 12. Cover

- **Partial Cover:** Se evalúa mediante la interposición parcial de un Body Prism, o de un objeto/superficie ambiental con el flag declarativo `providesCover`. No destruye el LoE, pero inserta un modificador estadístico. Cover Parcial **nunca** es otorgado automáticamente por cruzar el suelo (Surface) sin obstáculos de por medio.
- **Total Cover:** Resulta directamente de la pérdida total de Line of Effect. No es un estatus estadístico añadido, sino la invalidación legal del targeting o alcance.

---

## 13. Vision

Vision y Lighting operan en paralelo y totalmente desconectados del LoE de combate.
- **Vision:** Propiedad del observador para distinguir estados en una Spatial Cell.
- **Lighting:** Propiedad del espacio que califica la luminosidad de una celda.
- **Opacidad:** Obstruye los trazados visuales. Un vidrio bloquea LoE pero tiene Opacidad 0% (permite Vision completa). Una cortina de humo no bloquea LoE pero tiene Opacidad 100% (bloquea Vision).

---

## 14. Area of Effect (AoE)

El motor provee volúmenes base puros.
- **Volumen Afectado:** Esfera, Cilindro, Cono o Línea matemáticos en la grilla cuantizada.
- **Clip:** El AoE intersecta su volumen teórico contra el entorno topológico. Cualquier celda matemática cortada del origen por falta de Line of Effect pierde la inclusión en el área. 
- **Intersección:** Los entes dentro del Área son afectados si al menos una celda de su Body Prism reside dentro del Volumen Afectado final tras el clip.

---

## 15. Threat (Amenaza)

- Threat es un assessment topológico inmutable.
- Una entidad amenaza a otra si el Body Prism de la víctima contiene al menos una celda que pertenezca al Volumen Alcanzable (Reach) del atacante **y** existe Line of Effect libre en Z.
- Threat **ignora** si la víctima tiene Partial Cover, Total Concealment o es invisible. Solo se inhibe ante Total Cover (ausencia de LoE).
- No evalúa si un ataque es mecánicamente legal. Solo evalúa presencia amenazante espacial.

---

## 16. Flanking

- Flanking depende estrictamente de Threat legal de ambos flanqueadores.
- Requiere trazar una línea tridimensional teórica entre el centro exacto de ambos Prismas Corporales aliados pasando a través de bordes o caras opuestas del prisma de la víctima.
- Pierde validez si el vector es bloqueado por Total Cover.
- Flanking no subsume ni impone penalizadores adicionales al objetivo derivados de interposiciones menores, solo otorga el bonus táctico si la geometría exacta alinea opositores con Threat.

---

## 17. Opportunity Attack

El AdO es el consumidor final, acoplador de assessments:
- Consulta si se provocó (ej: abandono de celda).
- Consulta Threat desde la celda abandonada.
- Consulta LoE hacia esa celda.
- Consulta Cover y Concealment aplicables.
- Integra restricciones (invisible, destreza plana).
Opportunity Attack no recalcula geometría, solamente ensambla los veredictos de los módulos anteriores.

---

## 18. Objetos Ambientales

- Se limitan a declarar ocupación mediante un Environmental Volume.
- Exponen flags booleanos o atributos granulares: `blocksLoE`, `providesCover`, `blocksVision`, `movementCost`.
- La geometría los trata como piezas del tablero; no tienen comportamientos propios de combate (salvo que declaren Hazards).

---

## 19. Hazards

- Regiones o volúmenes incorpóreos de celdas persistentes.
- Carecen de solidez. Nunca otorgan Total Cover ni impiden solapamiento de Body Prisms.
- Operan como "listeners" espaciales pasivos que afectan el movimiento o aplican estados sobre la entidad que comparta celdas con ellos.

---

## 20. Invariantes Arquitectónicos (Geometría Normativa)

1. **Unicidad Celular:** Una Spatial Cell se define única e irrepetible por la tupla matemática `(x, y, z)`.
2. **Anclaje Único:** Toda entidad que no esté en caída/salto libre posee **exactamente una** Surface de apoyo designada en su Spatial Position.
3. **Exclusividad Estructural:** Una Spatial Cell volumétrica `(x,y,z)` jamás puede ser reclamada como parte integral de la cara sólida de más de una Surface simultáneamente.
4. **Pureza de Z:** Jamás existirá una Spatial Cell cuyo eje vertical no sea un entero estricto múltiplo de 5. No existe `z: 11` ni `z: 3.14`.
5. **No-concesión de Cover por Soporte:** Una Surface jamás concede Cover parcial hacia las entidades que ancla por el mero hecho de constituir el suelo debajo de ellas.
6. **No-Duplicación Z:** El Prisma Corporal excluye la ocupación simultánea de una misma celda por dos criaturas, y por transitividad, de cualquier túnel o piso si choca la cota vertical.
7. **Simetría de LoE Estática:** Si el centro geométrico de la celda A tiene LoE estricto hacia la celda B, entonces la celda B tiene LoE idéntico hacia la celda A.
8. **Blindaje de Threat:** Ningún atacante puede detentar Threat contra una casilla u objetivo si la línea geométrica es obstruida irremediablemente por Total Cover.
9. **Desacoplo Presentacional:** El cliente visual y renderer 2.5D nunca, bajo ningún caso, determinará una intercepción, cobertura, flanqueo, ni colisión. Todo resultado presentacional se deriva de un veredicto de geometría normativa resuelto en el servidor.
10. **Agnosticidad de LoE:** El algoritmo de LoE jamás lee o utiliza el módulo de Iluminación o Visibilidad para decidir si una pared es sólida.
11. **Superposición de Hazards:** Los Hazard Volumes pueden superponerse arbitrariamente en la misma Spatial Cell sin restricción, pues carecen de física sólida.

---

## 21. Casos Límite y Principios Gobernantes

- **Puente sobre criatura:**
  - *Principio:* Dos Surfaces distintas (`bridge`, `ground`) existen en el mismo `x/y` a distintas cotas `z`. La criatura en `ground` eleva su Prisma. Mientras el `z` máximo del Prisma de la criatura sea menor al `z` inferior de la Surface `bridge`, la convivencia espacial es legal y no genera obstrucción.
- **Criatura debajo:**
  - *Principio:* El movimiento a través de un puente no interseca con la criatura inferior siempre que exista al menos 1 celda de "Empty Space" o vacío vertical suficiente entre el límite superior de la criatura y el piso del puente.
- **Criatura enorme en entorno irregular:**
  - *Principio:* El Footprint de una criatura de gran tamaño debe asegurar que todas las celdas de su base sean anclables a Surfaces transitables continuas. Si parte del Footprint recae en vacío (caída) o colisiona verticalmente con un techo bajo, el anclaje central denegará el movimiento.
- **Escaleras y transiciones:**
  - *Principio:* Las escaleras no son "terreno inclinado" matemáticamente; son un `connection` entre la Surface inferior y la Surface superior. Entrar al connection desde un borde y salir por el otro ajusta atómicamente la tupla de SpatialPosition.
- **Caída parcial (Borde de abismo):**
  - *Principio:* A determinarse por D-1 algorítmico, pero matemáticamente: si más del 50% de un Footprint enorme pierde la validación de `Surface`, se desencadena la transición de "Caer".
- **Huecos, Pozos y Balcones:**
  - *Principio:* Múltiples Surfaces definen huecos simplemente omitiendo celdas `(x, y)` en su extensión. Tirar un objeto o caminar sobre esa celda sin `connection` implica vacío (Empty Space) y precipitación inmediata hacia la cota Z del obstáculo sólido más cercano de cualquier Surface inferior o Prisma.
- **Puertas y Pasillos Estrechos (Squeezing):**
  - *Principio:* Las puertas son Environmental Volumes (objetos) anclados. Al abrirse, su flag `blocksLoE` / `solid` pasa a falso y retiran su ocupación celular estricta, cediendo Empty Space transitable a los prismas de las criaturas.
- **Flanqueo vertical:**
  - *Principio:* Es matemáticamente posible flanquear desde un nivel superior a uno inferior siempre que la línea entre centros del Prisma atraviese caras opuestas (una de ellas la cara superior de la víctima) de forma limpia y legalmente apoyada en la geometría normativa.

---

## 22. No Objetivos de D-1

Este documento de arquitectura normativa declara explícitamente qué responsabilidades excluye, de forma que ninguna de estas definiciones deba aparecer aquí sino en sus respectivos dominios:
- **No define algoritmos:** Ningún pseudocódigo, Raycasting 3D, bresenham elevado, o matemáticas vectoriales han sido redactadas. D-1 fija reglas, la implementación la deducirá el motor.
- **No elige renderer:** Excluye cualquier sugerencia entre Three.js, Babylon, ortográfico, proyectivo o WebGL (delegado a D-4).
- **No dicta persistencia:** Omite completamente cómo las Surfaces y Environmental Volumes se serializan en JSON o Base de Datos (delegado a D-3).
- **No abarca Editor Táctico:** Excluye cómo el GM usará drag-and-drop para construir túneles (delegado a D-5).
- **No diseña Fog of War:** Excluye las heurísticas de censura de snapshots y ocultación visual client-side (delegado a D-2).
- **No prescribe UI/Red:** Sin atajos de teclado para subir plantas ni formato binario/JSON de WebSockets.
