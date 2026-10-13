# Walkthrough — D-5R2 Remediación Final de Arquitectura del Editor Táctico de Mapas (MVP)

Responsabilidad: Resumen del último cierre ejecutado, sus decisiones, validaciones y límites.
Autoridad: Registro rotativo
Lifecycle: Temporal (se reescribe en cada cierre)
Reemplaza: Walkthrough — D-5R1 Remediación de Arquitectura del Editor Táctico de Mapas (MVP)
Complementa: [Estado](PROJECT_STATUS.md), [Roadmap](ROADMAP.md), [NDD D-5 canónico](docs/designs/map-builder-mvp/design.md)
Consumidores: Architecture Reviewer, propietario y agentes que retoman el repositorio.

---

## 1. Resultado y Remediaciones Ejecutadas (D-5R2)

Se cerraron de forma exhaustiva los hallazgos restantes de Architecture Review correspondientes a D-5R1, respetando estrictamente el NDD canónico (`docs/designs/map-builder-mvp/design.md`) y sin alterar reglas del Rule Engine ni tocar D-1B / I5R1 / I6:

1. **MAJOR 1 — Validación Pura sobre Candidate Board e Invariantes Espaciales**:
   - En `apps/server/src/commands/roomCommands.ts`, `handleUpdateBoard` construye en primer lugar el `candidateBoard` puro con `cellSizeFeet: 5` y las celdas validadas, y construye una vista/snapshot candidato no mutante `candidateRoom = { ...room, board: candidateBoard }`.
   - Todas las validaciones espaciales del estado resultante se derivan exclusivamente sobre `candidateRoom`.
   - Se valida que todos los combatientes conserven una huella autoritativa íntegramente dentro de los límites del `candidateBoard` (`getCombatantOccupiedCells(combatant, candidateRoom)`).
   - Se valida que ningún combatiente vivo quede sobre una celda `impassableCells` candidata.
   - **Invariante de Squeezing (`srd_squeezing`)**: Si una criatura está actualmente bajo el efecto `srd_squeezing`, se verifica que su huella derivada en `candidateRoom` mantenga la compresión legal. Si el `candidateBoard` elimina las `narrowCells` que sustentan la compresión, `handleUpdateBoard` rechaza atómicamente la actualización con mensaje descriptivo al GM (`No se puede actualizar el mapa: el nuevo tablero invalida la compresión (srd_squeezing) de <Nombre>...`), sin mover combatientes, sin remover efectos y sin alterar el tablero existente.
   - Se incorporó además pre-chequeo de colisión de muros contra la huella actual antes de evaluar compresión para garantizar mensajes descriptivos inmediatos ante colocación de muros sobre casillas ocupadas.

2. **MAJOR 2 — Semántica Visual de Muros y Pilares en el Presentation Model**:
   - En `apps/web/src/components/Board/presentationModel.ts`, se ajustó `buildBoardPresentationModel`:
     - Toda casilla con `impassable: true` (tenga o no `loeBlocked: true`, es decir, tanto muros duales del editor como muros impasables puros de datos legacy) resuelve `scenicProp: "barrier-block"` y genera un prisma volumétrico `volume.kind: "wall"`.
     - Toda casilla con `loeBlocked: true` pero `!impassable` (es decir, pilares puros que bloquean LoE pero no movimiento) resuelve `scenicProp: "loe-pillar"` y genera un prisma `volume.kind: "pillar"`.
     - Verificado mediante pruebas unitarias dedicadas en `tests/board-presentation-25d.test.mjs` y pruebas de integración Playwright en `tests-ui/map-builder.spec.ts`.

3. **MAJOR 3 — Congelamiento Total del Borrador Durante Guardado**:
   - En `apps/web/src/components/MapEditor/MapEditorToolbar.tsx`, se introdujo la prop `isSaving?: boolean` que deshabilita: inputs numéricos de ancho y alto, botón Redimensionar, botones radio de selección de pincel, botón Limpiar Todo, botón Guardar (mostrando la etiqueta `"Guardando..."`) y botón Cancelar.
   - En `apps/web/src/App.tsx`, las acciones `handleResizeBoard`, `handleClearAllObstacles`, `handleSaveBoard`, `handleCancelMapEditing` y `paintCell` aplican una guarda temprana `if (mapEditorStatus === "saving") return`, impidiendo cualquier mutación del borrador mientras hay un guardado en tránsito.

4. **MINOR 1 — Bloqueo Completo de Interacción de Combate Durante Edición del Mapa**:
   - Se extendió el bloqueo interactivo a todos los paneles laterales de combate mediante `isInteractionLocked = isMapEditing`:
     - En `CombatantsPanel.tsx`: se deshabilitan el botón "Agregar perfil", la adición de héroes y enemigos del catálogo, los selects de plantillas de héroes/enemigos, los inputs numéricos de iniciativa manual y el botón "Iniciar combate".
     - En `GmPanel.tsx`: se deshabilitan todos los controles administrativos del GM (mover token, curar, ajuste de HP actual/máximo, botones de estado de vida, limpiar AdO, forzar victoria/TPK, nota al log, y aplicación/remoción de efectos).
     - En `ActionsPanel.tsx`: se integró `isInteractionLocked` en `actionDisabled` para deshabilitar las acciones de turno, menús tácticos y resolución de AdO mientras el GM edita el mapa.

5. **Ciclo de Vida ACK e Igualdad Semántica Profunda de Tableros**:
   - Se implementó la función pura `areBoardsSemanticallyEqual(a, b)` que compara orden-independiente `width`, `height`, `cellSizeFeet`, y los conjuntos `impassableCells`, `lineOfEffectBlockingCells`, `difficultTerrainCells`, `narrowCells`, `dimLightCells` y `darknessCells`.
   - En `apps/web/src/App.tsx`, el editor solo se cierra cuando se recibe un `room-update` con un tablero semánticamente compatible con el borrador enviado. Actualizaciones ajenas de la sala (iniciativas, logs, notas) no descartan el borrador ni cierran el editor. Ante un rechazo del servidor, el borrador y la barra de herramientas permanecen abiertos con el error descriptivo visible.

6. **Tests UI Playwright Deterministas**:
   - En `tests-ui/map-builder.spec.ts`, se eliminaron todos los condicionales (`hasError`) sustituyéndolos por asertos deterministas sin ramas opcionales. Se agregaron tests de rechazo del servidor por límites con Canocrock, verificación de persistencia de semántica visual de muros vs pilares, y bloqueo completo de interacción de combate durante edición.

---

## 2. Archivos Modificados

- `apps/server/src/commands/roomCommands.ts`: Candidate Board validation, snapshot candidato, validación de huella e invariante de squeezing, pre-chequeo de colisión de muros.
- `apps/web/src/components/Board/presentationModel.ts`: semántica visual de muros (`barrier-block`/`wall`) vs pilares (`loe-pillar`/`pillar`).
- `apps/web/src/components/MapEditor/MapEditorToolbar.tsx`: prop `isSaving` para congelamiento del borrador y utilidad pura `areBoardsSemanticallyEqual`.
- `apps/web/src/components/CombatantsPanel/CombatantsPanel.tsx`: prop `isInteractionLocked` deshabilitando catálogo, iniciativas y arranque de combate.
- `apps/web/src/components/GmPanel/GmPanel.tsx`: prop `isInteractionLocked` deshabilitando todas las acciones de GM.
- `apps/web/src/components/ActionsPanel/ActionsPanel.tsx`: bloqueo interactivo en `actionDisabled` y resolución de AdO.
- `apps/web/src/App.tsx`: guarda `saving` en mutaciones de borrador, integración de `isInteractionLocked`, consumo de `areBoardsSemanticallyEqual`.
- `tests/map-builder.test.mjs`: tests para candidate board validation, invariantes de squeezing e igualdad semántica.
- `tests/board-presentation-25d.test.mjs`: test para semántica visual de Wall vs Pillar.
- `tests-ui/map-builder.spec.ts`: tests Playwright deterministas (rechazo, semántica visual, interaction lock).
- `docs/designs/map-builder-mvp/implementation-plan.md`, `PROJECT_STATUS.md`, `TODO.md`: documentación sincronizada.

`test.txt` permanece intacto y sin seguimiento en Git.

---

## 3. Validación y Calidad

- `npm test`: 677/677 tests unitarios en verde (28 suites, 0 fallos).
- `npm run typecheck`: 0 errores en todos los workspaces (`shared`, `web`, `server`).
- `npm run build`: compilación limpia y exitosa en todos los workspaces.
- `node scripts/e2e-websocket.mjs`: suite completa E2E WebSocket en verde (107/107).
- `npm run test:ui`: 15/15 tests Playwright UI pasando al 100% en verde.
