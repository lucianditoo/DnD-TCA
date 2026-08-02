# Walkthrough — Sprint D-1B Capítulo 4R1

## Objetivo
Actualizar el NDD `docs/designs/normative-movement-design.md` para eliminar la ambigüedad detectada por el Gate Review sobre la continuidad del `Movimiento Diagonal` y el `Double Move`. Formalizar que el patrón diagonal pertenece al contexto del turno, definiendo su interacción con `Ataque Elástico`, interrupciones, terreno difícil y predicciones de cliente.

## Secciones modificadas (NDD)
- **3.4 Contexto diagonal por turno:** El contador diagonal pertenece al turno, no a la Route. Se reinicia al iniciar el turno.
- **3.6 Terreno difícil:** Se aclara que un Step diagonal en terreno difícil tiene coste fijo de 15 ft y conserva la paridad del contador diagonal.
- **3.13 Movement Cost Assessment:** Se precisa que el assessment recibe el estado diagonal inicial y proyecta el resultante sin mutarlo.
- **3.15 Invariantes normativos:** Se agregaron invariantes prohibiendo reiniciar el contador con acciones o Steps ortogonales.
- **4.5 Double Move:** Se define como una única dedicación del turno al movimiento, que no reinicia el contexto diagonal.
- **4.12 Movimiento segmentado e Interrupciones (Nueva):** Establece el soporte para `Ataque Elástico` (movimiento fragmentado) reutilizando el mismo contador.
- **4.13 Autoridad y previews:** Se detalla que el cliente proyecta y simula el coste a partir del contador autoritativo vigente.
- **4.14 Invariantes normativos:** Invariantes añadidos para segmentación y predicción.
- **4.15 Límites y ODR:** Se documenta la `Owner Decision` que resolvió la pertenencia del contador al turno, evitando la creación de una nueva ODR. La ODR `D-1B-C3-01` se actualizó ligeramente para reflejar que la diagonal difícil reemplaza el patrón normal.

## Archivos modificados
- `docs/designs/normative-movement-design.md`
- `PROJECT_STATUS.md`
- `walkthrough.md`
- `TODO.md` (Para registrar TurnState y Ataque Elástico).

READY FOR ARCHITECTURE REVIEW
