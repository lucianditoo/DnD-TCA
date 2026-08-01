# Auditoría Oficial de Reglas de Movimiento (D-1B-Research R3)

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
No existe comando ni regla específica para Minimum Movement.

### Gap
Falta implementar Minimum Movement como acción de asalto completo y su consecuente provocación de AdO.

### Propietario
Implementación futura.

---

## 5. Moverse a través de casillas ocupadas
### RAW (SRD)
- **Aliado:** Puede atravesarse el espacio de un aliado. No puede terminarse normalmente en su espacio.
- **Oponente:** No puede atravesarse, a menos que él esté Indefenso (Helpless), haya una diferencia de tamaño de 3 categorías (ej. Tiny vs Large), o se usen Acrobacias (Tumble).

### Estado actual del motor
El motor (y sus tests) permite atravesar aliados conscientes durante la ruta, pero prohíbe terminar sobre ellos. Para enemigos, el paso mediante Acrobacias está implementado. Sin embargo, no se contemplan el tamaño pasivo ni el estado Helpless (que existe para Dying pero no se vincula aquí) como bypass automático.

### Gap
Falta la regla pasiva de atravesar enemigos con diferencia de 3 tamaños o en estado Helpless.

### Propietario
Implementación futura.

---

## 6. Apretujarse (Squeezing)
### RAW (SRD)
- **General:** Una criatura puede moverse por un espacio hasta la mitad de su anchura natural. Coste de movimiento x2, sufre -4 a las tiradas de ataque y -4 a la CA.
- **Inferior a la mitad:** Requiere usar la habilidad Escape Artist, consume acciones adicionales, y conlleva pérdida de bonificador de Destreza a la CA y prohibición de atacar.

### Estado actual del motor
Implementado efectivamente el Squeezing general (penalizadores -4 CA/-4 Ataque, costo doble) en el footprint 2x2. No existe implementación de la regla de Escape Artist para espacios inferiores a la mitad. El comportamiento para Huge+ no está documentado en tests.

### Gap
Falta la mecánica para espacio inferior a la mitad (Escape Artist, pérdida de Destreza a la CA, prohibición de ataque) y cobertura de tamaños Huge+.

### Propietario
Implementación futura (Regla avanzada). D-1B (Squeezing vertical / Z-axis).

---

## 7. Retirada (Withdraw)
### RAW (SRD)
Acción de asalto completo. Permite moverse hasta el doble de la velocidad. Abandonar la casilla inicial NO provoca ataques de oportunidad por parte de los oponentes que amenacen ESE cuadrado específico. Casillas posteriores sí provocan. Si el combatiente no puede ver a su atacante (ej. Blinded, invisibilidad), la regla general de Withdraw puede no aplicarse.

### Estado actual del motor
`handleWithdraw` permite doble movimiento y suprime la provocación de AdO al abandonar el cuadrado de inicio. No considera restricciones de visión ni estados como Blinded respecto a las amenazas evadidas.

### Gap
Falta la interacción de Withdraw con penalizadores de visión o enemigos no detectados/invisibles.

### Propietario
Implementación futura.

---

## 8. Correr (Run)
### RAW (SRD)
Acción de asalto completo. Movimiento en línea recta a ×4 de la velocidad (×3 con armadura pesada). Pierde el bonificador de Destreza a la CA. Provoca AoO normalmente. Imposible en terreno difícil.

### Estado actual del motor
`handleRun` aplica multiplicadores ×4/×3 y pérdida de DEX a la CA. No se puede realizar en terreno difícil. (Existen simplificaciones documentadas de fatiga multiasalto).

### Gap
La falta de fatiga multiasalto es una divergencia aprobada. Restricciones menores pueden aplicar a futuro.

### Propietario
Sin acción requerida.

---

## 9. Carga (Charge)
### RAW (SRD)
Acción de asalto completo. Movimiento en línea recta y despejada hacia el oponente, terminando en la casilla más cercana. Otorga +2 a ataques melee y -2 a CA. La acción Charge NO provoca AoO por sí misma. El movimiento realizado durante la carga puede provocar AoO normalmente si abandona casillas amenazadas.

### Estado actual del motor
Bonificadores (+2 Atk, -2 CA) están activos. El motor distingue correctamente la acción de su movimiento para AdO. La trayectoria recta se construye (`buildStraightPath`) y se evalúan footprints.

### Gap
Falta validar la ausencia de terreno difícil o bloqueos por criaturas Helpless en el trayecto de la carga, y la Línea de Visión (LoS) inicial al declarar.

### Propietario
Implementación futura.

---

## 10. Acrobacias (Tumble)
### RAW (SRD)
Moverse a mitad de velocidad. Alternativa: moverse a velocidad normal con un penalizador de -10 a la tirada. CD 15 para no provocar AdO al moverse a través del área amenazada. CD 25 para moverse a través del espacio de un oponente.

### Estado actual del motor
Implementadas las tiradas de Acrobacias (CD 15/25) a mitad de velocidad, previniendo AdOs o bloqueos si son exitosas.

### Gap
Falta la variante de moverse a velocidad normal asumiendo el penalizador de -10 a la prueba.

### Propietario
Implementación futura.

---

## 11. Movimiento y Ataques de Oportunidad (AoO)
### RAW (SRD)
Se provoca AoO al abandonar una casilla amenazada. Un Five-Foot Step o ejecutar Withdraw (solo la primera casilla) no provoca. Cobertura (Cover) y Ocultación Total impiden el AdO.

### Estado actual del motor
El motor detecta el abandono de la casilla amenazada, considera el límite por ronda, y verifica Cover y Concealment.

### Gap
Sin diferencias.

### Propietario
Sin acción requerida.

---

## 12. Vuelo y Maniobrabilidad
### RAW (SRD)
Cinco clases de maniobrabilidad: Perfect, Good, Average, Poor, Clumsy. Las clases restringen la velocidad mínima frontal, el retroceso, la reversa, el radio de giro, la capacidad de hacer Hover, los ángulos de ascenso y descenso, y la velocidad de ascenso/descenso. Subir cuesta el doble; Bajar cuesta la mitad.

### Estado actual del motor
No posee modos de movimiento completos ni maniobrabilidad aérea productiva.

### Gap
Faltan todas las reglas de maniobrabilidad por clase, el coste asimétrico vertical y el estado de vuelo.

### Propietario
D-1B (Contrato normativo), D-3 (Persistencia), Implementación futura.

---

## 13. Caídas (Falling & Stall)
### RAW (SRD)
- **Caída general:** Daño de 1d6 por cada 10 pies caídos. Existe un límite de daño. Posibilidad de mitigar daño con Tumble o Jump.
- **Pérdida de sustentación (Stall):** En vuelo, falla en mantener velocidad mínima genera caída. Caída de 150 pies el primer asalto y 300 pies los posteriores. Hay oportunidades de recuperación.

### Estado actual del motor
El motor no evalúa pérdida de soporte físico (gravedad) ni pérdida de sustentación, y no calcula el daño por caída.

### Gap
Faltan las mecánicas de inicio de caída (por terreno o vuelo), el daño por colisión y la recuperación en vuelo.

### Propietario
D-1B.

---

## 14. Criaturas Grandes en el Movimiento (Large Footprints)
### RAW (SRD)
El espacio ocupado y el movimiento consideran el terreno más difícil entre las casillas ocupadas en la cuadrícula 2D.

### Estado actual del motor
El motor soporta `POSITION-LARGE-FOOTPRINT`, evaluando las celdas ocupadas. Utiliza lógicas de volumen de barrido (swept volume) o intersección de todas las celdas de la ruta.

### Gap
El uso de swept volume y line of effect en cada transición son extensiones propias del proyecto (D-1/D-1R1), no reglas RAW del SRD.

### Propietario
D-1B (Como consumidor de la arquitectura del proyecto).

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

| Regla | Estado | RAW | Motor | Gap | Propietario |
|---|---|---|---|---|---|
| Movimiento Táctico | Completo (2D) | Alternancia 5-10-5-10 | `validateMovePath` 2D con alternancia | Ninguno en 2D | Sin acción requerida |
| Terreno Difícil | Parcial | 15ft constantes por diagonal | Alternancia 15/20 | Coste diagonal alterna en vez de 15ft. Faltan modificadores extra. | Implementación futura |
| Five-Foot Step | Completo | No action, no AdO, no en terreno difícil | `canUseFiveFootStep` valida correctamente | Ninguno | Sin acción requerida |
| Minimum Movement | Hueco | Acción completa, 5ft, provoca AdO | No existe | Falta acción que ignore límite de coste | Implementación futura |
| Aliados | Completo | Se puede cruzar, no terminar | Motor permite ruta, prohíbe finalizar | Ninguno | Sin acción requerida |
| Enemigos | Parcial | Atravesar por Helpless o 3 tamaños | Solo soporta Tumble | Falta regla pasiva de Helpless y tamaño | Implementación futura |
| Squeezing | Parcial (Completo 50%) | Costo x2, -4 CA/Atk; <50% requiere Escape Artist | Cubre la regla de 50% con penalizadores | Falta regla para <50% (Escape Artist) y Huge+ | Implementación / D-1B |
| Withdraw | Parcial | Ignora AdO en 1ra casilla; fallas por ceguera | Ignora AdO siempre en 1ra casilla | Falta restringir AdO evadido por visión/ceguera | Implementación futura |
| Correr (Run) | Completo | x4, pierde DEX, no en terreno difícil | Funciona según lo diseñado (Divergencias pre-aprobadas) | Ninguno mecánicamente crítico | Sin acción requerida |
| Carga (Charge) | Parcial | Línea recta, +2 Atk/-2 CA. Movimiento provoca AdO | `buildStraightPath` y bonificadores activos | Falta verificar terreno difícil/LoS/Helpless en ruta | Implementación futura |
| Acrobacias (Tumble) | Parcial | Mitad de vel o normal con -10 | Implementada mitad de velocidad | Falta variante normal con penalizador -10 | Implementación futura |
| AdO por Movimiento | Completo | Provoca al abandonar. Cover bloquea | `getOpportunityAttackLegality` lo verifica | Ninguno | Sin acción requerida |
| Vuelo | Hueco | 5 clases con restricciones específicas | Sin implementar | Faltan todas las mecánicas de vuelo | D-1B, D-3 |
| Caídas | Hueco | Daño por gravedad; pérdida de sustentación | Sin implementar | Falta caída por gravedad y vuelo | D-1B |
| Large Footprints | Completo (Ext.) | Considera todas las celdas ocupadas | Validado vía `POSITION-LARGE-FOOTPRINT` | El "swept volume" es extensión, no RAW | D-1B |

---

## 3. Dependencias hacia otros NDD

El movimiento clásico interactúa con arquitecturas tridimensionales (D-1R1) y proyecciones censuradas que requieren resolución formal en otros NDD:

- **Movimiento sobre Múltiples Surfaces (D-1B):** Enrutar movimiento Z entre identidades `Anchored Spatial Position` y calcular coste a través de *Connections*.
- **Transición Anchored a Volumetric (D-1B):** Reglas para desacoplar a la entidad de la `Surface` (vuelo, caída) mutando su estado espacial.
- **Squeezing Tridimensional (D-1B/D-1):** Decisión arquitectónica sobre `Body Prisms` constreñidos verticalmente por techos.
- **Intersección Volumétrica (D-1B):** Garantizar que un `Body Prism` grande en movimiento no colisione su volumen aéreo con obstáculos.
- **Censura en el Pathfinding / FoW (D-2):** Manejo de colisiones sorpresa al intentar cruzar celdas bloqueadas ofuscadas por la *Participant Projection*.
- **Ocupación Transitoria (D-1B):** Resolver la regla de atravesar aliados sin terminar el movimiento en dicha casilla (desacople validación de ruta vs destino).
- **Interrupción Múltiple de Movimiento (D-1B):** Computación de la "retroactividad" de la ruta cuando un movimiento provoca AdO y es interrumpido.

*(Fin del documento)*
