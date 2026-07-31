# Auditoría Oficial de Reglas de Movimiento (D-1B-Research)

Este documento inventaría **exclusivamente las reglas oficiales del SRD 3.5 / PHB / DMG** relativas al movimiento táctico y de combate, evaluando su impacto en los sistemas del proyecto DnD-TCA y documentando qué reglas están cubiertas y cuáles constituyen huecos normativos, sin proponer algoritmos ni arquitectura nueva.

---

## 1. Inventario de Reglas Oficiales

### 1.1 Movimiento Táctico Básico y Diagonales
- **Nombre oficial:** Tactical Movement / Measuring Distance
- **Fuente exacta:** SRD 3.5 (Movement, Exploration, and Distance) / PHB Cap. 8
- **Texto resumido:** El combate táctico se resuelve en una cuadrícula (grid). Moverse a un cuadrado adyacente cuesta 5 pies. Moverse en diagonal cuesta 5 pies el primer cuadrado, 10 pies el segundo, alternando (5-10-5-10).
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, Charge, Run, AoE, Reach
- **Cobertura en el proyecto:** `docs/designs/movement-validation.md` (Completo: `MOVE-BASIC`)

### 1.2 Terreno Difícil y Obstáculos
- **Nombre oficial:** Difficult Terrain / Obstacles
- **Fuente exacta:** SRD 3.5 (Movement / Terrain and Obstacles)
- **Texto resumido:** Moverse hacia un cuadrado de terreno difícil cuesta el doble (10 pies normalmente, o 15 pies el primer diagonal, 20 pies el segundo). No se puede correr ni cargar a través de terreno difícil. No se pueden cruzar esquinas duras (diagonal cruzando una pared/obstáculo infranqueable).
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, Run, Charge, 5-Foot Step
- **Cobertura en el proyecto:** `docs/designs/difficult-terrain-and-corners-design.md` (Completo: `MOVE-DIFFICULT-TERRAIN`)

### 1.3 Paso de 5 pies
- **Nombre oficial:** 5-Foot Step / Take 5-Foot Step
- **Fuente exacta:** SRD 3.5 (Action Types / Movement)
- **Texto resumido:** Permite moverse 5 pies como "No Action" (no consume acción) si no se ha realizado ningún otro movimiento real en el asalto. No provoca Ataques de Oportunidad (AoO). No puede realizarse en terreno difícil o ciego.
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, AoO
- **Cobertura en el proyecto:** `docs/designs/five-foot-step.md` (Completo: `MOVE-5FT`)

### 1.4 Moverse a través de casillas ocupadas
- **Nombre oficial:** Moving Through a Square
- **Fuente exacta:** SRD 3.5 (Movement)
- **Texto resumido:** 
  - **Friend:** Puedes moverte a través del espacio ocupado por un amigo, pero no puedes finalizar tu movimiento allí.
  - **Opponent:** No puedes moverte a través del espacio de un oponente a menos que él esté Indefenso (Helpless), haya una diferencia de tamaño de 3 categorías (ej. Tiny vs Large), o uses Acrobacias (Tumble).
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, Charge, Run, Withdraw
- **Cobertura en el proyecto:** Parcialmente abordado en `MOVE-ACROBATIC`. La validación pura de "atravesar aliado pero no terminar ahí" es un Hueco Normativo en el estado inmutable final.

### 1.5 Apretujarse (Squeezing)
- **Nombre oficial:** Squeezing
- **Fuente exacta:** SRD 3.5 (Movement)
- **Texto resumido:** Una criatura puede moverse por un espacio hasta la mitad de su anchura natural. Al hacerlo, se mueve a mitad de velocidad, sufre -4 a las tiradas de ataque y -4 a la CA.
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, Attack, Defense
- **Cobertura en el proyecto:** `docs/designs/acrobatic-movement-squeezing-design.md` (Completo: `MOVE-SQUEEZING`)

### 1.6 Retirada (Withdraw)
- **Nombre oficial:** Withdraw
- **Fuente exacta:** SRD 3.5 (Full-Round Actions)
- **Texto resumido:** Acción de asalto completo. Permite moverse hasta el doble de la velocidad. Abandonar el cuadrado de inicio NO provoca ataques de oportunidad por parte de los oponentes que amenacen ESE cuadrado específico. Casillas posteriores sí provocan.
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, AoO
- **Cobertura en el proyecto:** `docs/designs/withdraw/design.md` (Completo: `MOVE-WITHDRAW`)

### 1.7 Correr (Run)
- **Nombre oficial:** Run
- **Fuente exacta:** SRD 3.5 (Full-Round Actions)
- **Texto resumido:** Acción de asalto completo. Movimiento en línea recta a ×4 de la velocidad (×3 si lleva armadura pesada). Pierde el bonificador de Destreza a la CA. Provoca AoO normalmente. Imposible en terreno difícil.
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, Defense, AoO
- **Cobertura en el proyecto:** `docs/designs/run-design.md` (Completo: `MOVE-RUN` con divergencias documentadas de fatiga multiasalto)

### 1.8 Carga (Charge)
- **Nombre oficial:** Charge
- **Fuente exacta:** SRD 3.5 (Special Attacks)
- **Texto resumido:** Acción de asalto completo. Movimiento de mínimo 10 pies (2 casillas) y máximo el doble de la velocidad, en línea recta y despejada hacia el oponente, terminando en la casilla más cercana desde donde se le pueda atacar. Otorga +2 a ataques melee y -2 a CA. Provoca AoO.
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, Attack, Defense, AoO
- **Cobertura en el proyecto:** `docs/designs/combat-engine-mvp.md` (Parcial/Completo según el backend, pero su validación multicelda recta es un desafío pendiente).

### 1.9 Acrobacias (Tumble)
- **Nombre oficial:** Tumble (Skill)
- **Fuente exacta:** SRD 3.5 (Skills)
- **Texto resumido:** Moverse a mitad de velocidad (o velocidad normal con penalizador -10). CD 15 para no provocar AoO al moverse a través del área amenazada. CD 25 para moverse a través del espacio del oponente.
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, AoO, Skill Checks
- **Cobertura en el proyecto:** `docs/designs/acrobatic-movement-squeezing-design.md` (Completo: `MOVE-ACROBATIC`)

### 1.10 Movimiento y Ataques de Oportunidad (AoO)
- **Nombre oficial:** Attacks of Opportunity (Provoking)
- **Fuente exacta:** SRD 3.5 (Combat)
- **Texto resumido:** Un combatiente provoca un AoO al *abandonar* una casilla amenazada (no al entrar). Moverse 5 pies o ejecutar Withdraw (solo la primera casilla) no provoca. Cobertura (Cover) y Ocultación Total impiden realizar el AdO.
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, AoO, Cover
- **Cobertura en el proyecto:** Documentado y completado a través de `POSITION-THREAT`, `ROUND-AOO-LIMIT`, y Sprint 055B (`getOpportunityAttackLegality`).

### 1.11 Movimiento Vertical y Vuelo
- **Nombre oficial:** Moving in Three Dimensions / Tactical Aerial Movement
- **Fuente exacta:** DMG 3.5 (Cap. 3: Adventures) / SRD 3.5 (Movement)
- **Texto resumido:** Subir (Up) cuesta el doble de movimiento (ej: volar 5 pies hacia arriba cuesta 10 pies). Bajar (Down) cuesta la mitad. Existen 5 clases de Maniobrabilidad (Clumsy, Poor, Average, Good, Perfect) que restringen el ángulo de ascenso/descenso, el radio de giro, la velocidad mínima frontal obligatoria, y la capacidad de hacer *Hover* (mantenerse en el aire).
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, Flight, Shapes, Fall
- **Cobertura en el proyecto:** Hueco normativo. D-1R1 definió `Volumetric Spatial Coordinate` pero no hay reglas mecánicas de maniobrabilidad.

### 1.12 Caída (Falling)
- **Nombre oficial:** Falling
- **Fuente exacta:** DMG 3.5 (Cap. 8: Glossary / Environment)
- **Texto resumido:** Una criatura cae si pierde soporte. La caída es de 150 pies el primer asalto y 300 pies los asaltos subsecuentes. Daño por caída: 1d6 por cada 10 pies caídos. Terminar una caída sobre terreno u otra criatura tiene impactos específicos (Acrobatics CD 15 para suavizar).
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, Damage, Position
- **Cobertura en el proyecto:** Hueco normativo diferido en `normative-spatial-geometry.md` (D-1R1).

### 1.13 Criaturas Grandes en el Movimiento
- **Nombre oficial:** Big Creatures and Movement
- **Fuente exacta:** SRD 3.5 (Movement)
- **Texto resumido:** Al mover una criatura que ocupa más de una casilla (Large, Huge, etc.), el coste de movimiento y las restricciones de terreno difícil / LoE se evalúan considerando todas las casillas que ocupa y que interseca durante la transición. No puede eximirse de una esquina obstruida "encogiendo" su huella asimétricamente a menos que entre en *Squeezing*.
- **Tipo:** Obligatoria
- **Sistemas que afecta:** Movement, Large Footprints, Squeezing
- **Cobertura en el proyecto:** `docs/designs/large-footprints-core-integration-design.md` (`POSITION-LARGE-FOOTPRINT`).

---

## 2. Matriz de Auditoría

| Regla | Fuente | Estado | Cubierta | Pendiente | Contradicción | Observaciones |
|---|---|---|---|---|---|---|
| Movimiento Táctico (Diagonales) | PHB/SRD | Completo | `movement-validation.md` | - | Ninguna | Métrica 5-10-5 en 2D validada. |
| Terreno Difícil y Esquinas | PHB/SRD | Completo | `difficult-terrain-and-corners-design.md` | - | Ninguna | - |
| Paso de 5 Pies | PHB/SRD | Completo | `five-foot-step.md` | - | Ninguna | Restricción de "único movimiento" operativa. |
| Moverse por Aliados | PHB/SRD | Hueco | - | Validación pura paso a paso y bloqueo al final | Reglas 2.5D | Requiere validación de ocupación temporal. |
| Moverse por Enemigos | PHB/SRD | Parcial | `MOVE-ACROBATIC` | Diferencia de tamaño | Ninguna | Tumble implementado. Falta la regla pasiva de 3 tamaños de diferencia. |
| Squeezing | PHB/SRD | Completo | `acrobatic-movement-squeezing-design.md` | - | Ninguna | Penalizadores activos. |
| Withdraw | PHB/SRD | Completo | `withdraw/design.md` | - | Ninguna | - |
| Run (Correr) | PHB/SRD | Completo | `run-design.md` | - | Fatiga multiasalto (Aprobada) | Simplificaciones de visión aprobadas. |
| Charge (Cargar) | PHB/SRD | Parcial | `combat-engine-mvp.md` | Línea recta estricta | Ninguna | Restricción geométrica multicelda pendiente de pulir. |
| Provocación de AoO | PHB/SRD | Completo | Sprints 032, 055B | - | Ninguna | Abandono de casilla amenaza; Cover bloquea. |
| Maniobrabilidad Vuelo | DMG/SRD | Hueco | - | Completo | Ninguna | Faltan restricciones angulares, Hover y coste asimétrico Z. |
| Caída (Falling) | DMG/SRD | Hueco | D-1R1 (mencionado) | Velocidad terminal y daño | Ninguna | Abordaje físico vs por asalto pendiente. |
| Large Footprints | PHB/SRD | Parcial | `POSITION-LARGE-FOOTPRINT` | Squeezing Z-axis | Ninguna | - |

---

## 3. Huecos Normativos (No documentados mecánicamente en DnD-TCA)

1. **Atravesar espacio aliado (Co-ocupación Temporal):** El SRD permite cruzar el prisma de un aliado siempre que no se termine el turno allí. El proyecto actualmente prohíbe el pathfinding si la celda está ocupada en el frame inmutable, requiriendo un desacople de validación de ruta (transitoria) vs validación de destino (estable).
2. **Atravesar enemigos por tamaño:** Cruzar el espacio de un oponente que sea tres categorías de tamaño más pequeño o más grande que el actor, sin requerir Tumble.
3. **Mecánicas de Vuelo (Maneuverability):** Coste vertical (Up = x2, Down = x0.5). Restricciones de giro (45°, 90°, 180°), avance mínimo (Half speed para Poor/Average, stall and fall), y capacidad de levitar (Hover).
4. **Caída Mecánica:** Resolución de daño 1d6/10ft, tope de 20d6. División de 150 ft en el primer asalto y Acrobatics CD 15 para daño no letal/ignorar 10ft.
5. **Gateo / Prone Movement:** Moverse estando derribado (Crawl 5 pies) como move action, provocando AoO masivo, más allá del simple `Stand Up`.

---

## 4. Preguntas Abiertas (Criterio del DM / Ambigüedad SRD)

1. **Caída Parcial de Criaturas Grandes:** El DMG asume un token 2D. Si una criatura Gargantuan (20x20) abandona una Surface pero el 25% de su base sigue apoyada, ¿cae? El manual de miniaturas o DMG no es matemático aquí; es decisión pura del DM o regla de casa (ej: centro de gravedad).
2. **Volumen de Squeezing en Altura:** El PHB dice "la mitad de la anchura natural". Nunca legisla si una criatura de 10 pies de alto puede apretujarse para pasar por un túnel de 5 pies de alto (Squeezing Vertical).
3. **Trayectoria Exacta de Caída Diabólica:** Si un objetivo cae adyacente a una pared inclinada o en el borde de un terreno escarpado, la colisión durante los 150 pies iniciales queda a criterio interpretativo del DM.
4. **Interrupción Múltiple de Movimiento:** Si un combatiente en medio de su ruta provoca un AoO, recibe un golpe y un efecto que le reduce la velocidad (ej. Entangled o daño a 0 HP), la adaptación computacional exacta de "retroactividad" de la ruta restante es terreno de ruling de mesa.

---

## 5. Extensiones Necesarias del Proyecto (Listado)

Para adaptar el movimiento SRD 3.5 a la arquitectura estricta del proyecto (D-1R1), se requerirá extender las siguientes normas sin proponer algoritmos:

- **Movimiento sobre Múltiples Surfaces:** El pathfinding deberá integrar *Connections* (escaleras, bordes) para enrutar el movimiento Z entre identidades `Anchored Spatial Position` y calcular el *Route Cost*.
- **Transición Anchored a Volumetric:** El acto de volar o caer requerirá desacoplar a la entidad de la `Surface`, mutando su estado a `Volumetric Spatial Coordinate` en medio del recorrido.
- **Squeezing Tridimensional:** Se deberá declarar una regla propia para la extrusión Z del `Body Prism` cuando los techos son más bajos que el *Vertical Profile*, decidiendo si cuenta mecánicamente como Squeezing o simplemente bloqueo.
- **Censura en el Pathfinding (Participant Projection):** Debido a FoW, el jugador no puede trazar una ruta sobre casillas bloqueadas u ocupadas por enemigos invisibles. El servidor deberá manejar la colisión sorpresa (interrupción de ruta) cuando el cliente intente un pathfinding que choca contra un obstáculo ofuscado.
- **Intersección Volumétrica durante el Movimiento:** El paso a paso debe garantizar que un `Body Prism` grande desplazándose en Z o inclinándose no "roza" el prisma de otro techo/criatura durante el inter-frame temporal del movimiento.
