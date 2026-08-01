# Walkthrough — Sprint D-1B-Research R1 (Normative Corrections)

## Objetivo
Realizar únicamente la remediación del documento de investigación `movement-rules-audit.md` utilizando exclusivamente hallazgos normativos verificados del SRD 3.5. Al igual que en la pasada original, este sprint NO diseña arquitectura, NO modifica contratos, NO propone algoritmos, y NO implementa código. El objetivo es dejar el Research puramente alineado con el texto oficial para abrir posteriormente el NDD D-1B.

## Entregables
- **`docs/audits/movement-rules-audit.md`**: Remediado en las siguientes correcciones normativas obligatorias:
  1. **Terreno difícil diagonal**: Se eliminó la regla inventada de alternancia (15/20) y se restituyó la regla estricta del SRD (cada diagonal cuesta el equivalente a dos normales, es decir, 15 ft fijos por cada diagonal).
  2. **Five Foot Step**: Se eliminó la afirmación errónea de que no podía realizarse estando ciego (solo el terreno difícil lo prohíbe normativamente).
  3. **Charge**: Se aclaró explícitamente que la acción *Charge* no provoca AdO por sí misma, sino que el *movimiento realizado* durante la misma puede provocarlos normalmente si abandona casillas amenazadas.
  4. **Matriz de cobertura**:
     - Se vinculó a las entradas reales del *Registry* (`MOVE-BASIC`, `MOVE-DIFFICULT-TERRAIN`, `MOVE-5FT`, `MOVE-ACROBATIC`, `MOVE-SQUEEZING`, `MOVE-WITHDRAW`, `MOVE-RUN`, `POSITION-LARGE-FOOTPRINT`).
     - Se actualizó "Moverse por Enemigos" a **Parcial** documentando qué falta exactamente (Helpless, tamaño pasivo) contra lo ya implementado (Tumble).
     - Se actualizó "Charge" reconociendo la porción ya soportada en `tacticalCommands.ts` / `rules.ts` como Parcial.
     - Se ajustó Large Footprints a **Completo** en base a `POSITION-LARGE-FOOTPRINT` validado en el Registry; el squeeze vertical excede el SRD.
  5. **Dependencias Arquitectónicas**: Se separó claramente la lista de reglas, la matriz de estado actual del motor, los huecos normativos puros, y las *Dependencias hacia otros NDD* (donde se ubican las consideraciones como el pathfinding 3D, conexiones y Volumetric Spatial Coordinates).

- **`PROJECT_STATUS.md`**: Avanzado al término de D-1B-Research R1.

## Metodología
Se extrajo, analizó y aplicó el texto normativo exacto del manual (SRD 3.5), corrigiendo el documento `movement-rules-audit.md` a través de manipulación de texto en bloque. No se ejecutaron tests, ya que no se modificó el código de TypeScript subyacente de las reglas, respetando la directiva estricta de "No escribir código ni diseñar".

## Cierre Formal
El documento `movement-rules-audit.md` se ha estructurado como una auditoría normativa según las reglas del SRD 3.5, el estado del motor y el Registry vigente. Las responsabilidades de resolución de los gaps identificados han sido asignadas a los propietarios correspondientes, cumpliendo con los requisitos del Sprint D-1B-Research R2. Queda listo para la fase de diseño del **Sprint D-1B — Normative Movement Design**.
