# Auditoría Oficial de Reglas de Movimiento (D-1B-Research R2)

Este documento inventaría **exclusivamente las reglas oficiales del SRD 3.5 / PHB / DMG** relativas al movimiento táctico y de combate, evaluando su impacto en los sistemas del proyecto DnD-TCA y documentando qué reglas están cubiertas y cuáles constituyen huecos normativos, sin proponer algoritmos ni arquitectura nueva.

---

## 1. Inventario de Reglas Oficiales

### 1.1 Movimiento Táctico Básico y Diagonales
**RAW (SRD):**
El combate táctico se resuelve en una cuadrícula (grid). Moverse a un cuadrado adyacente cuesta 5 pies. Moverse en diagonal cuesta 5 pies el primer cuadrado, 10 pies el segundo, alternando (5-10-5-10).

**Estado actual del motor:**
El motor cuenta con la validación de movimiento paso a paso en 2D, donde la alternancia 5-10-5-10 se calcula matemáticamente para diagonales normales.

**Gap:**
Sin diferencias.

**Propietario:**
Sin acción requerida.

---

### 1.2 Terreno Difícil y Obstáculos
**RAW (SRD):**
Moverse hacia un cuadrado de terreno difícil cuesta el doble (10 pies normalmente). Cada movimiento diagonal sobre terreno difícil cuesta el equivalente a dos diagonales normales (es decir, el primer diagonal = 15 ft, el segundo diagonal = 15 ft, el tercero = 15 ft, el cuarto = 15 ft. No alterna). No se puede correr ni cargar a través de terreno difícil. No se pueden cruzar esquinas duras (diagonal cruzando una pared/obstáculo infranqueable).

**Estado actual del motor:**
El motor implementa el terreno difícil y bloquea las esquinas. Sin embargo, el costo diagonal sobre terreno difícil actualmente implementa una alternancia distinta (15 / 20) en lugar de un costo constante de 15 ft.

**Gap:**
El costo de diagonales en terreno difícil alterna incorrectamente en lugar de ser 15 ft constantes.

**Propietario:**
Implementación

---

### 1.3 Five-Foot Step
**RAW (SRD):**
Permite un Five-Foot Step como "No Action" si no se ha realizado ningún otro movimiento real en el asalto. No provoca Ataques de Oportunidad (AoO). No puede realizarse en terreno difícil.

**Estado actual del motor:**
El motor valida que no haya movimiento previo en el asalto y que el paso no consuma la acción de movimiento. Está validado para no cruzar terreno difícil y el handler no gatilla AdO.

**Gap:**
Sin diferencias.

**Propietario:**
Sin acción requerida.

---

### 1.4 Moverse a través de casillas ocupadas
**RAW (SRD):**
- **Friend:** Puedes moverte a través del espacio ocupado por un amigo, pero no puedes finalizar tu movimiento allí.
- **Opponent:** No puedes moverte a través del espacio de un oponente a menos que él esté Indefenso (Helpless), haya una diferencia de tamaño de 3 categorías (ej. Tiny vs Large), o uses Acrobacias (Tumble).

**Estado actual del motor:**
El motor rechaza el pathfinding si la celda está ocupada. No permite el paso transitorio por aliados durante el trazado de la ruta. El paso por enemigos mediante Acrobacias (Tumble) está implementado, pero no se contemplan el tamaño ni el estado Helpless como bypass automático.

**Gap:**
Falta la validación de ocupación temporal para atravesar aliados sin terminar allí, así como la regla pasiva de atravesar enemigos con diferencia de 3 tamaños o en estado Helpless.

**Propietario:**
D-1B (ocupación transitoria) / Implementación (regla de tamaño y Helpless).

---

### 1.5 Apretujarse (Squeezing)
**RAW (SRD):**
Una criatura puede moverse por un espacio hasta la mitad de su anchura natural. Al hacerlo, se mueve a mitad de velocidad, sufre -4 a las tiradas de ataque y -4 a la CA.

**Estado actual del motor:**
Implementado en el estado del combatiente y en los reductores (penalizadores -4 CA/-4 Ataque).

**Gap:**
Sin diferencias (en espacio 2D).

**Propietario:**
Sin acción requerida.

---

### 1.6 Retirada (Withdraw)
**RAW (SRD):**
Acción de asalto completo. Permite moverse hasta el doble de la velocidad. Abandonar el cuadrado de inicio NO provoca ataques de oportunidad por parte de los oponentes que amenacen ESE cuadrado específico. Casillas posteriores sí provocan.

**Estado actual del motor:**
El motor permite doble movimiento y suprime correctamente la provocación de AdO al abandonar el cuadrado de inicio.

**Gap:**
Sin diferencias.

**Propietario:**
Sin acción requerida.

---

### 1.7 Correr (Run)
**RAW (SRD):**
Acción de asalto completo. Movimiento en línea recta a ×4 de la velocidad (×3 si lleva armadura pesada). Pierde el bonificador de Destreza a la CA. Provoca AoO normalmente. Imposible en terreno difícil.

**Estado actual del motor:**
Implementado con multiplicadores correctos y pérdida de DEX. No se puede realizar en terreno difícil. Existen divergencias documentadas respecto a la fatiga multiasalto y ceguera.

**Gap:**
Sin diferencias frente al diseño acordado (las simplificaciones ya son divergencias aprobadas).

**Propietario:**
Sin acción requerida.

---

### 1.8 Carga (Charge)
**RAW (SRD):**
Acción de asalto completo. Movimiento de mínimo 10 pies (2 casillas) y máximo el doble de la velocidad, en línea recta y despejada hacia el oponente, terminando en la casilla más cercana desde donde se le pueda atacar. Otorga +2 a ataques melee y -2 a CA. La acción Charge NO provoca AoO por sí misma. El movimiento realizado durante la carga puede provocar AoO normalmente si abandona casillas amenazadas.

**Estado actual del motor:**
El motor aplica los bonificadores (+2 Atk, -2 CA). No obstante, la validación estricta de la trayectoria multicelda en línea recta es parcial.

**Gap:**
Restricción geométrica multicelda para línea recta estricta pendiente de pulir.

**Propietario:**
D-1B.

---

### 1.9 Acrobacias (Tumble)
**RAW (SRD):**
Moverse a mitad de velocidad (o velocidad normal con penalizador -10). CD 15 para no provocar AoO al moverse a través del área amenazada. CD 25 para moverse a través del espacio del oponente.

**Estado actual del motor:**
El comando de movimiento implementa las tiradas de Acrobacias (CD 15/25) y previene la generación de AdOs o bloqueos si son exitosas.

**Gap:**
Sin diferencias.

**Propietario:**
Sin acción requerida.

---

### 1.10 Movimiento y Ataques de Oportunidad (AoO)
**RAW (SRD):**
Un combatiente provoca un AoO al abandonar una casilla amenazada (no al entrar). Un Five-Foot Step o ejecutar Withdraw (solo la primera casilla) no provoca. Cobertura (Cover) y Ocultación Total impiden realizar el AdO.

**Estado actual del motor:**
El motor detecta el abandono de casilla amenazada. Considera los límites de AdO por ronda, y la función de legalidad verifica Cover y Concealment correctamente para bloquear el AdO.

**Gap:**
Sin diferencias.

**Propietario:**
Sin acción requerida.

---

### 1.11 Vuelo
**RAW (SRD):**
Existen 5 clases de Maniobrabilidad:
- Perfect
- Good
- Average
- Poor
- Clumsy
Estas restringen el ángulo de ascenso/descenso, el radio de giro, la velocidad mínima frontal obligatoria, y la capacidad de hacer Hover (mantenerse en el aire). Subir (Up) cuesta el doble de movimiento. Bajar (Down) cuesta la mitad.

**Estado actual del motor:**
El motor no implementa ninguna regla de vuelo, maniobrabilidad, ni coste en Z.

**Gap:**
Falta integrar las clases de vuelo y sus restricciones de movimiento espacial.

**Propietario:**
D-1B (Diseño).

---

### 1.12 Caídas
**RAW (SRD):**
Existen dos tipos principales de caída mecánica:
- Caída normal: Una criatura cae si pierde soporte físico (terreno).
- Pérdida de sustentación durante vuelo: Genera una caída bajo ciertas condiciones.
La caída es de 150 pies el primer asalto y 300 pies los asaltos subsecuentes. Daño por caída: 1d6 por cada 10 pies caídos.

**Estado actual del motor:**
El motor no evalúa pérdida de soporte ni calcula daño por caída.

**Gap:**
Falta el manejo del estado de caída, su partición por asalto y la aplicación de daño al colisionar.

**Propietario:**
D-1B.

---

### 1.13 Criaturas Grandes en el Movimiento
**RAW (SRD):**
Al mover una criatura que ocupa más de una casilla (Large, Huge, etc.), el coste de movimiento y las restricciones de terreno difícil / LoE se evalúan considerando todas las casillas que ocupa y que interseca durante la transición.

**Estado actual del motor:**
El motor valida todas las celdas ocupadas en XY a lo largo de la ruta.

**Gap:**
En 3D, el motor deberá extender esta validación al volumen completo (Z-axis).

**Propietario:**
D-1B.

---

## 2. Matriz de Auditoría

| Regla | Fuente | Estado | Gap | Propietario |
|---|---|---|---|---|
| Movimiento Táctico (Diagonales) | PHB/SRD | Completo | Sin diferencias en 2D. | Sin acción requerida |
| Terreno Difícil y Esquinas | PHB/SRD | Parcial | Coste diagonal alterna (15/20) en lugar de ser 15ft constantes. | Implementación |
| Five-Foot Step | PHB/SRD | Completo | Sin diferencias. | Sin acción requerida |
| Moverse por Aliados | PHB/SRD | Hueco | Falta validación de ocupación transitoria. | D-1B |
| Moverse por Enemigos | PHB/SRD | Parcial | Falta regla pasiva de 3 tamaños de diferencia y objetivo Helpless. | Implementación |
| Squeezing | PHB/SRD | Completo | Sin diferencias en 2D. | Sin acción requerida |
| Withdraw | PHB/SRD | Completo | Sin diferencias. | Sin acción requerida |
| Run (Correr) | PHB/SRD | Completo | Sin diferencias (divergencias documentadas). | Sin acción requerida |
| Charge (Cargar) | PHB/SRD | Parcial | Validación estricta de línea recta multicelda. | D-1B |
| Provocación de AoO | PHB/SRD | Completo | Sin diferencias. | Sin acción requerida |
| Vuelo | DMG/SRD | Hueco | Clases de vuelo (Perfect a Clumsy), coste Z y Hover. | D-1B |
| Caídas | DMG/SRD | Hueco | Resolución asalto a asalto y daño 1d6/10ft. Separación de vuelo y terreno. | D-1B |
| Large Footprints | PHB/SRD | Completo | Squeezing Z-axis excede la regla 2D original (pendiente D-1B). | D-1B |

---

## 3. Dependencias hacia otros NDD

El movimiento clásico interactúa con arquitecturas tridimensionales (D-1R1) y proyecciones censuradas que requieren resolución formal en otros NDD:

- **Movimiento sobre Múltiples Surfaces (D-1B):** Enrutar movimiento Z entre identidades `Anchored Spatial Position` y calcular coste a través de *Connections*.
- **Transición Anchored a Volumetric (D-1B):** Reglas para desacoplar a la entidad de la `Surface` (vuelo, caída) mutando su estado espacial.
- **Squeezing Tridimensional (D-1B/D-1):** Decisión arquitectónica sobre `Body Prisms` constreñidos verticalmente por techos.
- **Intersección Volumétrica (D-1B):** Garantizar que un `Body Prism` grande en movimiento no colisione su volumen aéreo con obstáculos.
- **Censura en el Pathfinding / FoW (D-2):** Manejo de colisiones sorpresa al intentar cruzar celdas bloqueadas ofuscadas por la *Participant Projection*.
- **Interrupción Múltiple de Movimiento (D-1B):** Computación de la "retroactividad" de la ruta cuando un movimiento provoca AdO y es interrumpido.

*(Fin del documento)*
