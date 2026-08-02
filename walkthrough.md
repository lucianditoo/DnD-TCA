# Walkthrough — Sprint D-1B Capítulo 6R1

## Objetivo
Actualizar el Capítulo 6 del NDD `docs/designs/normative-movement-design.md` para cubrir las dos dependencias estructurales exigidas por el Architecture Gate: agregar a `Move` y `Double Move` como consumidores primarios, y explicitar normativamente cómo todos los consumidores interactúan con el Turn-Scoped Diagonal Context. 

## Cambios realizados
- **6.1 Objetivo y alcance:** Se añadió `Move` y `Double Move` explícitamente a la lista de consumidores.
- **6.4 Move como consumidor (Nueva):** Se definió a Move como el consumidor base, confirmando que consume todos los contratos preaprobados sin redefinir geometría, contador ni resoluciones alternativas.
- **6.5 Double Move como consumidor (Nueva):** Se aclaró que reitera el contrato exacto de Move, sin reiniciar el contador y alterando únicamente la economía de acciones, sin crear topologías o matemáticas separadas.
- **6.13 Interacción con el contexto diagonal por turno (Nueva):** Detalla cómo Move, Double Move, el movimiento segmentado y demás consumidores emplean el contexto diagonal (que pertenece al turno y no se reinicia por las acciones).
- **6.15 Invariantes normativos:** Se sumaron explícitamente los 7 invariantes (12 al 18) correspondientes a la interacción con Move, Double Move y el contexto diagonal, protegiendo las decisiones de R1 previas (ej. "Las diagonales difíciles no modifican la paridad").

## Archivos modificados
- `docs/designs/normative-movement-design.md`
- `PROJECT_STATUS.md`
- `walkthrough.md`

## ODR / Decisiones
No se abrieron ODR nuevas y se respetó la Owner Decision previa que centraliza el contexto diagonal en el Turno.

READY FOR ARCHITECTURE REVIEW
