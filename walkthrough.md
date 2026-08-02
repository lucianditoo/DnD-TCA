# Walkthrough — Sprint D-1B Capítulo 3

## Objetivo

Definir normativamente cuánto presupuesto de movimiento consume una Route que ya fue declarada legal, sin diseñar acciones, ejecución ni contratos de implementación.

## Cambios realizados

- Se incorporó el concepto de **Movement Budget** y se separó de Speed, Route Cost, legalidad topológica y economía de acciones.
- Se formalizó el Base Step Cost para Steps ortogonales, verticales y diagonales en cualquier plano válido, conservando una única secuencia diagonal 5/10 por Route.
- Se fijó la corrección RAW de terreno difícil: 10 ft ortogonal y 15 ft constantes por Step diagonal, sin alternancia 15/20.
- Se clasificaron las contribuciones de coste como adición, multiplicación, reemplazo, coste fijo o prohibición, sin crear una abstracción universal de modificadores.
- Se integró el Footprint efectivo en la evaluación de coste y se mantuvo Swept Volume fuera de alcance.
- Se delimitó el coste de Squeezing, los presupuestos por modo de desplazamiento, las fuentes de movimiento obstaculizado y la autoridad servidor/UI.
- Se definió el contenido conceptual auditable de un Movement Cost Assessment.

## Decisión abierta

- **ODR D-1B-C3-01:** falta ratificar la política de composición cuando coinciden varias fuentes de coste con semánticas distintas. Es bloqueante solo para esas combinaciones; los casos de fuente única permanecen evaluables.

## Alcance preservado

No se modificaron código, tests, Registry ni los Capítulos 1–2. No se diseñaron acciones, pathfinding, AoO, vuelo, caída, renderer ni ejecución transaccional.

READY FOR ARCHITECTURE REVIEW
