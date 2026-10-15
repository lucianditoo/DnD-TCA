# Walkthrough — D-1B-I11 Run Normative Preview Parity Design

Canonical responsibility: Auditoría y propuesta de diseño para llevar el preview web de Run al pipeline normativo compartido.
Supersedes: Walkthrough I10 Server Integration, preservado en Git.
Complements: [NDD Capítulo 13](docs/designs/normative-movement-design.md#capítulo-13--i11-run-normative-preview-parity), [Run Design](docs/designs/run-design.md), [Registry](docs/rules/registry.md).
Derived from: Baseline `98030357b857a66c1d1e0f860b46a97614c9b659` y auditoría directa del código productivo posterior a I10.
Lifecycle: Rotativo; diseño terminado, Awaiting Architecture Review and Proceed.

## Resultado

El Sprint D-1B-I11 quedó limitado a documentación arquitectónica. No modifica código, tests, contratos compartidos, schemas, Rule IDs ni comportamiento observable.

La auditoría confirmó una asimetría concreta: el servidor Run ya usa `buildStraightPath`, presupuesto efectivo, Movement Resolution y Authoritative Commit; el cliente todavía identifica el preview como `legacy-run`, permite construir una ruta arbitraria paso a paso y usa cálculos legacy para coste y resaltado.

El Capítulo 13 define la paridad futura sin duplicar autoridad:

- Run se previsualiza por destino sobre los ocho rayos ortogonales/diagonales válidos desde el origen.
- Cada candidato reconstruye exactamente la ruta recta canónica mediante `buildStraightPath`; no hay snapping, BFS, A* ni barrido exhaustivo del tablero.
- El adapter web especializado `buildRunMovementPreview` consume Route Validation, Movement Cost, presupuesto Run efectivo, Difficult Terrain, V1 y contexto diagonal real.
- La disponibilidad de la acción permanece separada de la legalidad de una ruta concreta.
- El cliente mantiene solo el destino elegido; ruta, coste, contexto proyectado, huellas y trazabilidad se derivan nuevamente en cada render relevante.
- El payload productivo continúa enviando únicamente `to`; el servidor sigue siendo la autoridad y reconstruye la ruta.
- Squeezing, terreno difícil, contribuciones de dotes, AoO y errores conservan las autoridades existentes; no se introducen excepciones Run ni lógica paralela.

## Auditoría trazable

Se inspeccionaron completamente las autoridades documentales requeridas y los consumidores reales en shared, web, server y tests. Se verificaron especialmente `apps/web/src/movementPreview.ts`, `useBoardSelection.ts`, `viewModel.ts`, `App.tsx`, `ActionsPanel.tsx`, `MovementPreviewSummary.tsx`, `Board.tsx`, el handler productivo `handleRun`, los módulos normativos de movimiento y las suites de preview/Run existentes.

Las 26 preguntas obligatorias del sprint quedaron respondidas explícitamente en el NDD. No se detectó un bloqueo arquitectónico ni fue necesario abrir una ODR.

## Alcance futuro condicionado

La sección 13.9 contiene un plan embebido de implementación futura, no autorizado por este sprint. Si recibe Proceed y permanece restringido a web, tests y documentación, corresponde Nivel B. Cualquier necesidad de modificar shared, server, schemas o protocolo obliga a detenerse y reclasificar antes de implementar.

La futura remediación deberá retirar exclusivamente la rama `legacy-run` y sus consumidores cuando la paridad esté demostrada; los helpers legacy todavía utilizados por otras acciones permanecen fuera de alcance. D-1B-I6 y cualquier nueva semántica de movimiento continúan separados.

## Validación documental

- Diff limitado a Markdown aprobado del sprint.
- Enlaces y referencias cruzadas comprobados.
- `git diff --check` comprobado antes del commit.
- No se ejecutaron suites de código ni CI: el sprint no contiene cambios ejecutables y no genera evidencia funcional nueva.
- `test.txt` se preservó sin seguimiento y fuera del commit.

Estado final: diseño listo para Architecture Review y Proceed explícito antes de cualquier implementación.
