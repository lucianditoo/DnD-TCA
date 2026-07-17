# ADR-0006: Bugs Become Automated Tests

## Estado

Aceptado

## Contexto

El proyecto crece con reglas tacticas complejas. Muchos bugs aparecen por interacciones: AdO, buffs, movimiento, ownership, equipo derivado o flujo de turnos. Si se corrigen solo manualmente, pueden volver en cualquier refactor.

## Decision

Cada bug importante debe convertirse en un test automatizado.

Para logica pura, preferir tests en `tests/*.test.mjs` usando helpers compartidos. Para multiplayer, permisos o flujo real de combate, agregar cobertura en `scripts/e2e-websocket.mjs`.

## Alternativas consideradas

- Probar solo manualmente: util para UX, pero insuficiente para regresiones.
- Agregar tests solo al final del proyecto: demasiado tarde para una base cambiante.
- Testear solo la UI: valioso, pero no reemplaza pruebas de reglas y servidor.

## Consecuencias

Beneficios:

- Refactors mas seguros.
- Bugs documentados como casos ejecutables.
- Mejor continuidad para asistentes de IA.
- Menos miedo a tocar reglas existentes.

Costos:

- Cada cambio importante tarda un poco mas.
- Los tests deben mantenerse cuando cambie una regla deliberadamente.
- Hace falta decidir el nivel correcto: unitario, E2E o UI.

