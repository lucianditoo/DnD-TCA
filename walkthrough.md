# Walkthrough — Sprint D-1B-Research R3 (Final Evidence-Based Remediation)

## Objetivo
Realizar una remediación documental estricta del documento de investigación `movement-rules-audit.md` dirigida por hallazgos específicos (B-01 a B-08 y M-01 a M-05), consolidando el documento como una auditoría normativa pura.

## Estado Final
El documento `movement-rules-audit.md` ha sido reestructurado para separar cada regla en cuatro bloques: **RAW (SRD)**, **Estado actual del motor**, **Gap** y **Propietario**. Se ha eliminado toda afirmación absoluta o asunción no verificada, alineando las descripciones con el código y tests actuales del motor y asignando claramente la responsabilidad de resolución.

## Matriz de Hallazgos

| ID | Hallazgo | Decisión | Archivo/Sección Modificada | Evidencia Normativa | Evidencia Código/Test | Estado Final | Justificación |
|---|---|---|---|---|---|---|---|
| **B-01** | Movimiento entre aliados (Afirmación falsa de rechazo) | Corregido | 5. Moverse a través de casillas ocupadas | SRD: Puede atravesarse espacio aliado pero no terminar turno ahí. | Test permite ruta por aliados y prohíbe finalizar en ellos. | ACCEPTED | El motor en 2D ya soporta atravesar aliados sin terminar en su celda. |
| **B-02** | Five-Foot Step y Minimum Movement | Separados | 3. Five-Foot Step / 4. Minimum Movement | SRD: Minimum movement permite 5ft de asalto completo si los costes impiden avanzar. | `canUseFiveFootStep` no contempla Minimum Movement. | ACCEPTED | Son mecánicas distintas; Minimum movement provoca AdO y consume asalto completo. |
| **B-03** | Vuelo (Categorías) | Corregido | 12. Vuelo y Maniobrabilidad | SRD: 5 clases (Perfect, Good, Average, Poor, Clumsy) dictan ángulos, hover, reversa, etc. | Motor sin modos de movimiento ni maniobrabilidad aérea. | ACCEPTED | Se eliminaron generalizaciones falsas; el motor actual no soporta maniobrabilidad. |
| **B-04** | Caídas | Separado | 13. Caídas (Falling & Stall) | SRD: Diferencia caída por gravedad (1d6/10ft) de pérdida de sustentación (150/300ft). | Sin mecánicas de daño por caída en servidor. | ACCEPTED | Evita generalizar "150/300" a todas las caídas (solo aplica al vuelo). |
| **B-05** | Squeezing (Espacio < 50%) | Documentado | 6. Apretujarse (Squeezing) | SRD: Inferior a la mitad requiere Escape Artist y acciones extras. | Motor aplica coste doble y -4/-4 para 2x2. | ACCEPTED | El motor solo cubre la regla general para la mitad del ancho. |
| **B-06** | Inventario omitido (Mala visibilidad, obstáculos, etc.) | Añadido | 15. Inventario Normativo Omitido | SRD: Diversos modificadores de terreno, visibilidad, tamaños minúsculos y carga. | Motor no implementa Swim/Climb ni reducción por carga. | ACCEPTED | Se deben inventariar todas las reglas pertinentes para su futura asignación. |
| **B-07** | Withdraw (Ceguera / Invisibilidad) | Corregido | 7. Retirada (Withdraw) | SRD: Exenciones si no se ve al enemigo. | `handleWithdraw` ignora estados de visión. | ACCEPTED | No estaba "Sin diferencias", hay un gap real en la interacción de visión. |
| **B-08** | Large Footprints (Swept volume) | Desmentido | 14. Criaturas Grandes en el Movimiento | SRD: Terreno más difícil entre casillas ocupadas. | Motor usa swept volume (extensión D-1). | ACCEPTED | El cálculo volumétrico de ruta es una extensión del proyecto, no regla del SRD. |
| **M-01** | Charge (AdO y línea recta) | Corregido | 9. Carga (Charge) | SRD: La acción no provoca AdO, el movimiento sí. | `buildStraightPath` y evaluación de footprints existe. | ACCEPTED | Se reconoce el avance del motor (línea recta) pero se marcan gaps de terreno/LoS. |
| **M-02** | HELPLESS | Documentado | 5. Moverse a través de casillas ocupadas | SRD: Oponentes Helpless pueden ser atravesados. | Motor usa Helpless solo para Dying. | ACCEPTED | Falta aplicar Helpless pasivo al bypass de movimiento. |
| **M-03** | Tumble (Velocidad normal) | Documentado | 10. Acrobacias (Tumble) | SRD: Opción de moverse a velocidad normal con -10. | Motor solo soporta mitad de velocidad (CD 15/25). | ACCEPTED | Faltaba la variante de penalizador -10 para velocidad completa. |
| **M-04** | Propietarios | Asignados | Todo el documento | N/A | N/A | ACCEPTED | Cada gap tiene propietario claro (D-1B, Implementación futura, etc.). |
| **M-05** | Estado documental | Ajustado | `walkthrough.md`, `PROJECT_STATUS.md` | N/A | N/A | ACCEPTED | El Research no se declara "listo/aprobado", sólo reporta hallazgos objetivos. |

## Validaciones
Se verificó `git diff --check`, la Zero Orphan Policy y Single Source of Truth, y se buscó texto prohibido como "Sin diferencias" (sólo usado cuando corresponde estrictamente) o "aprobado".
