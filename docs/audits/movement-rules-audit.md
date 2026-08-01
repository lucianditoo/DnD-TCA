# Auditoría Oficial de Reglas de Movimiento (D-1B-Research R6)

Este documento inventaría **exclusivamente las reglas oficiales del SRD 3.5 / PHB / DMG** relativas al movimiento táctico y de combate, evaluando su impacto en los sistemas del proyecto DnD-TCA y documentando qué reglas están cubiertas y cuáles constituyen huecos normativos, sin proponer algoritmos ni arquitectura nueva.

---

## 1. Movimiento Táctico Básico y Diagonales
### RAW (SRD)
El combate táctico se resuelve en una cuadrícula (grid). Moverse a un cuadrado adyacente cuesta 5 pies. Moverse en diagonal cuesta 5 pies el primer cuadrado, 10 pies el segundo, alternando (5-10-5-10).

### Estado actual del motor
El motor cuenta con la validación de movimiento paso a paso en 2D (`validateMovePath`). La alternancia 5-10-5-10 se calcula matemáticamente para diagonales normales (`distanceFeet`).

### Gap
Sin diferencias (en espacio plano 2D).

### Propietario
Sin acción requerida.

---

## 2. Terreno Difícil y Obstáculos
### RAW (SRD)
Moverse hacia un cuadrado de terreno difícil cuesta el doble. Cada movimiento diagonal sobre terreno difícil cuesta el equivalente a dos diagonales normales (es decir, el primer diagonal = 15 ft, el segundo diagonal = 15 ft, el tercero = 15 ft, el cuarto = 15 ft. No alterna). No se puede correr ni cargar a través de terreno difícil. No se pueden cruzar esquinas duras. Los obstáculos pueden aumentar el coste sin bloquear. La mala visibilidad cuenta como movimiento obstaculizado.

### Estado actual del motor
El motor bloquea las esquinas (`isCornerAnchorBlockedByTerrain`). Sin embargo, el costo diagonal sobre terreno difícil implementa una alternancia distinta (15 / 20) en lugar de un costo constante de 15 ft. Además, la mala visibilidad y otros obstáculos no bloqueantes no modifican dinámicamente el coste de movimiento.

### Gap
El costo de diagonales en terreno difícil alterna (15/20) en lugar de ser 15 ft constantes. Faltan modificadores de coste por visibilidad y obstáculos.

### Propietario
Implementación futura.

---

## 3. Five-Foot Step
### RAW (SRD)
Permite un Five-Foot Step como "No Action" si no se ha realizado ningún otro movimiento en el asalto. No provoca Ataques de Oportunidad (AoO). No puede realizarse en terreno difícil.

### Estado actual del motor
`canUseFiveFootStep` valida la falta de movimiento previo, el consumo nulo de acción de movimiento y prohíbe el terreno difícil. No provoca AdO.

### Gap
Sin diferencias.

### Propietario
Sin acción requerida.

---

## 4. Minimum Movement
### RAW (SRD)
Acción de asalto completo que permite avanzar 5 pies cuando otros costes (terreno, carga) impedirían avanzar normalmente. No es un Five-Foot Step y provoca AdO normalmente cuando corresponde.

### Estado actual del motor
No existe comando ni regla específica para Minimum Movement. Cualquier movimiento de una sola casilla actualmente podría no provocar AdO debido a una exención errónea basada únicamente en recorrer una casilla (bug productivo).

### Gap
Falta implementar Minimum Movement como acción de asalto completo y corregir el bug que exime de AdO a los movimientos de 1 casilla.

### Propietario
Implementación futura.

---

## 5. Moverse a través de casillas ocupadas
### RAW (SRD)
- **Aliado:** Puede atravesarse el espacio de un aliado. No puede terminarse normalmente en su espacio.
- **Oponente:** No puede atravesarse, a menos que él esté Indefenso (Helpless), haya una diferencia de tamaño de 3 categorías (ej. Tiny vs Large), o se usen Acrobacias (Tumble).

### Estado actual del motor
- **Aliado:** El motor permite atravesar aliados conscientes durante la ruta y prohíbe terminar sobre ellos, contando con tests explícitos que lo verifican.
- **Enemigo:** El paso mediante Acrobacias está implementado. El motor permite atravesar y terminar sobre criaturas en estado Dying y Stable (verificando ocupación), e ignora las Dead. Sin embargo, no se contempla el tamaño pasivo ni la integración formal del trait HELPLESS.

### Gap
- **Aliado:** Sin diferencias.
- **Enemigo:** Falta la integración del trait formal HELPLESS, y la excepción pasiva por diferencia de 3 tamaños.

### Propietario
- **Aliado:** Sin acción requerida.
- **Enemigo:** Implementación futura.

---

## 6. Apretujarse (Squeezing)
### RAW (SRD)
- **General (Squeezing):** Una criatura puede moverse por un espacio hasta la mitad de su anchura natural. Coste de movimiento x2, sufre -4 a las tiradas de ataque y -4 a la CA.
- **Inferior a la mitad:** Requiere usar la habilidad Escape Artist, consume acciones adicionales, y conlleva pérdida de bonificador de Destreza a la CA y prohibición de atacar.

### Estado actual del motor
Implementado efectivamente el Squeezing general (penalizadores -4 CA/-4 Ataque, costo doble) para footprint 2x2.

### Gap
Falta el comportamiento para tamaños Huge+ y la mecánica para espacio inferior a la mitad (Escape Artist, pérdida de Destreza a la CA, prohibición de ataque).

### Propietario
Implementación futura.

---

## 7. Retirada (Withdraw)
### RAW (SRD)
Acción de asalto completo. Permite moverse hasta el doble de la velocidad. Abandonar la casilla inicial NO provoca ataques de oportunidad por parte de los oponentes que amenacen ESE cuadrado específico. Casillas posteriores sí provocan. Withdraw no puede utilizarse mientras el combatiente esté Blinded.

### Estado actual del motor
`handleWithdraw` permite doble movimiento y suprime la provocación de AdO al abandonar el cuadrado de inicio. No aplica la restricción de ceguera (Blinded) sobre las amenazas evadidas.

### Gap
El motor no impide utilizar Withdraw al estar Blinded ni restringe la supresión de AdO por amenazas no percibidas.

### Propietario
Implementación futura.

---

## 8. Correr (Run)
### RAW (SRD)
Acción de asalto completo. Movimiento en línea recta a ×4 de la velocidad (×3 con armadura pesada). Pierde el bonificador de Destreza a la CA. Provoca AoO normalmente. Imposible en terreno difícil.

### Estado actual del motor
`handleRun` aplica multiplicadores ×4/×3 y pérdida de DEX a la CA. No se puede realizar en terreno difícil. (Existen simplificaciones documentadas de fatiga multiasalto).

### Gap
Las divergencias respecto a la fatiga multiasalto y ceguera están registradas (DT-018 y DT-019 en el Registry).

### Propietario
Sin acción requerida (Divergencias pre-aprobadas).

---

## 9. Carga (Charge)
### RAW (SRD)
Acción de asalto completo. Movimiento en línea recta y despejada hacia el oponente, terminando en la casilla más cercana. Otorga +2 a ataques melee y -2 a CA. La acción Charge NO provoca AoO por sí misma. El movimiento realizado durante la carga puede provocar AoO normalmente si abandona casillas amenazadas.

### Estado actual del motor
Bonificadores (+2 Atk, -2 CA) están activos. El motor distingue correctamente la acción de su movimiento para AdO. La trayectoria recta se construye (`buildStraightPath`) y se evalúan footprints, límites y celdas bloqueadas.

### Gap
Faltan validaciones sobre:
- Terreno difícil en el trayecto bloqueando la carga.
- Criaturas Helpless en el trayecto no obstaculizan el paso (RAW: se puede cargar a través de ellas).
- Line of Sight requerida al objetivo en el momento de declarar la carga.

### Propietario
Implementación futura.

---

## 10. Acrobacias (Tumble)
### RAW (SRD)
- Moverse a mitad de velocidad con CD 15 para no provocar AdO al moverse a través del área amenazada, y CD 25 para moverse a través del espacio de un oponente.
- Variante: moverse a velocidad completa asumiendo un penalizador de -10 a la prueba.

### Estado actual del motor
Implementadas las tiradas de Acrobacias (CD 15/25) a mitad de velocidad, previniendo AdOs o bloqueos si son exitosas.

### Gap
Falta la variante RAW de moverse a velocidad completa con penalizador de -10.

### Propietario
Implementación futura.

---

## 11. Movimiento y Ataques de Oportunidad (AoO)
### RAW (SRD)
Se provoca AoO al abandonar una casilla amenazada. Un Five-Foot Step o ejecutar Withdraw (solo la primera casilla) no provoca. Cobertura (Cover) y Ocultación Total impiden el AdO.

### Estado actual del motor
El motor detecta el abandono de la casilla amenazada, considera el límite por ronda, y verifica Cover y Concealment a través de `getOpportunityAttackLegality`.

### Gap
El motor omite cualquier AoO cuando la distancia total recorrida es una sola casilla, aunque NO sea un Five-Foot Step.

### Propietario
Implementación futura.

---

## 12. Vuelo y Maniobrabilidad
### RAW (SRD)
Existen 5 clases de maniobrabilidad: Perfect, Good, Average, Poor, Clumsy. Las clases restringen la velocidad mínima frontal, el retroceso, la reversa, el radio de giro, la capacidad de hacer Hover, los ángulos de ascenso y descenso, y la velocidad de ascenso/descenso. Subir cuesta el doble; Bajar cuesta la mitad.

### Estado actual del motor
El motor no posee modos de movimiento completos ni maniobrabilidad aérea productiva.

### Gap
Faltan todas las reglas de maniobrabilidad por clase, el coste asimétrico vertical y el estado de vuelo.

### Propietario
D-1B (Contrato normativo), D-3 (Persistencia), Implementación futura.

---

## 13. Caídas
### RAW (SRD)

#### General Falling
Cualquier criatura que caiga sufre 1d6 de daño por cada 10 pies caídos, hasta un máximo de 20d6. La velocidad de caída durante el movimiento general equivale aproximadamente a 500 pies por ronda. Una criatura puede mitigar el daño con una tirada exitosa de Jump o Tumble.

#### Falling after Loss of Flight (Stall)
Una criatura que pierde sustentación en vuelo (por velocidad insuficiente u otra causa) cae 150 pies el primer asalto y 300 pies en cada asalto posterior. Las condiciones de recuperación de vuelo dependen de la clase de maniobrabilidad. Si la criatura impacta antes de recuperar el vuelo, aplica el daño por caída general.

### Estado actual del motor
El motor no evalúa pérdida de soporte físico (gravedad) ni pérdida de sustentación, y no calcula el daño por caída.

### Gap
- Falta la detección y activación de la caída por pérdida de superficie de apoyo.
- Falta el cálculo de daño por impacto (1d6 por 10 pies, máx. 20d6).
- Falta el Stall como estado de vuelo con distancias diferenciadas (150 / 300 pies).
- Falta la recuperación de vuelo durante el Stall.

### Propietario
D-1B.

---

## 14. Criaturas Grandes en el Movimiento (Large Footprints)
### RAW (SRD)
El espacio ocupado y el movimiento consideran el terreno más difícil entre las casillas ocupadas en la cuadrícula 2D.

### Estado actual del motor
El motor soporta `POSITION-LARGE-FOOTPRINT`, validando footprints discretos y cada ancla de la ruta. NO existe validación continua del volumen barrido.

### Gap
Falta incorporar el análisis de "Swept Volume" (extensión de diseño a futuro, no RAW).

### Propietario
D-1B (como trabajo futuro / extensión).

---

## 15. Inventario Normativo Omitido (Movimiento Avanzado)
### RAW (SRD)
- **Movimiento Doble:** Consumir dos move actions.
- **Modos:** Climb (y Accelerated Climb), Swim, Crawl (Crawl provoca AdO).
- **Impedimenta:** Carga transportada y armaduras reducen la velocidad base.
- **Movimiento Montado.**
- **Tamaños Menores:** Tiny, Diminutive y Fine tienen Reach 0 y deben entrar en el espacio del oponente, provocando AdO.
- **Finalización Ilegal:** Reglas de coocupación por finalización accidental de movimiento en posición inválida.

### Estado actual del motor
No implementados de forma oficial o sólo cubiertos parcialmente (ej. no existe Swim/Climb, la carga no reduce la velocidad aún, no hay monturas).

### Gap
Faltan las mecánicas listadas.

### Propietario
D-1B (Diseño de modos), D-6 (Obstáculos ambientales), Implementación futura.

---

## 2. Matriz de Auditoría de Cobertura

> **Nota sobre autoridad documental:** Las capacidades que no poseen Rule ID oficial en el Registry no forman parte del estado oficial del proyecto. Su evaluación dentro de esta matriz pertenece exclusivamente al alcance de este Research y no constituye una segunda autoridad documental. La columna *Registry Status* sólo puede mostrar un estado oficial (`Completo`, `Parcial`, etc.) cuando la regla posee un Rule ID en `docs/rules/registry.md`; en caso contrario, el único valor válido es `N/A (No Rule ID)`.

| Regla | Registry Status | Research Scope (RAW completo) | Outstanding RAW gaps | Propietario |
|---|---|---|---|---|
| Movimiento Táctico | Completo (`MOVE-BASIC`) | Alternancia 5-10-5-10 | Ninguno en 2D | Sin acción requerida |
| Terreno Difícil | Completo (`MOVE-DIFFICULT-TERRAIN`) | 15ft constantes por diagonal | Alternancia 15/20 incorrecta. Faltan modificadores. | Implementación futura |
| Five-Foot Step | Completo (`MOVE-5FT`) | No action, no AdO, no terreno difícil | Ninguno | Sin acción requerida |
| Minimum Movement | N/A (No Rule ID) | Acción completa, 5ft, provoca AdO | Falta acción que ignore límite de coste | Implementación futura |
| Aliados | N/A (No Rule ID) | Se puede cruzar, no terminar | Ninguno | Sin acción requerida |
| Enemigos | N/A (No Rule ID) | Atravesar por Helpless o 3 tamaños | Falta trait formal HELPLESS y excepción por tamaño | Implementación futura |
| Squeezing | Completo (`MOVE-SQUEEZING`) | Costo x2, -4 CA/Atk; <50% requiere Escape Artist | Falta regla para <50% (Escape Artist) y Huge+ | Implementación futura |
| Withdraw | Completo (`MOVE-WITHDRAW`) | Ignora AdO en 1ra casilla; prohibido al estar Blinded | El motor no impide Withdraw al estar Blinded | Implementación futura |
| Correr (Run) | Completo (`MOVE-RUN`) | x4, pierde DEX, no en terreno difícil | Divergencias registradas: DT-018, DT-019 | Sin acción requerida |
| Carga (Charge) | N/A (No Rule ID) | Línea recta, +2 Atk/-2 CA. Movimiento provoca AdO | Falta: terreno difícil bloquea; LoS inicial; Helpless no bloquea | Implementación futura |
| Acrobacias (Tumble) | Completo (`MOVE-ACROBATIC`) | Mitad vel o normal con -10 | Falta variante normal con penalizador -10 | Implementación futura |
| AdO por Movimiento | N/A (No Rule ID) | Provoca al abandonar. Cover bloquea | Bug: movimiento de 1 casilla omite AdO aunque no sea 5ft Step | Implementación futura |
| Vuelo | N/A (No Rule ID) | 5 clases con restricciones específicas | Faltan todas las mecánicas de vuelo | D-1B, D-3 |
| Caídas | N/A (No Rule ID) | Daño 1d6/10ft; Stall: 150/300 pies | Falta caída general y Stall por pérdida de vuelo | D-1B |
| Large Footprints | Completo (`POSITION-LARGE-FOOTPRINT`) | Considera todas las celdas ocupadas | Swept Volume: extensión del proyecto, no RAW | D-1B |

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
