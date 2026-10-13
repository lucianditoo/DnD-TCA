# Walkthrough — D-5 Editor Táctico de Mapas (MVP)

Responsabilidad: Resumen del último cierre ejecutado, sus decisiones, validaciones y límites.
Autoridad: Registro rotativo
Lifecycle: Temporal (se reescribe en cada cierre)
Reemplaza: Walkthrough de Paneo y Toolbar 2D
Complementa: [Estado](PROJECT_STATUS.md), [Roadmap](ROADMAP.md), [NDD D-5](docs/designs/map-builder-mvp/design.md)
Consumidores: Architecture Reviewer, propietario y agentes que retoman el repositorio.

---

## 1. Resultado

Se implementó el **Editor Táctico de Mapas (D-5 MVP)** (Hito 1.2 de la Fase 1 del Roadmap), permitiendo al GM redimensionar el tablero y pintar o borrar obstáculos tácticos con reflejo volumétrico 3D en tiempo real:

1. **Contratos y Validación Autoritativa (`update-board`)**:
   - Nuevo comando de cliente `update-board` tipado con esquema Zod `updateBoardSchema` en `@dnd-tactical/shared`.
   - Control de acceso estricto en el servidor con `requireGM`: solo el Master puede emitir cambios de tablero.
   - Restricción de dimensiones dentro del rango normativo [6, 40] tanto para ancho como alto.
   - **Exclusividad estricta de capas**: Los pinceles limpian automáticamente capas inferiores tanto en cliente como en sanitización de servidor (Muro > Columna LoE > Terreno Difícil > Estrecho).
   - **Protección contra colisión de muros**: El servidor rechaza la colocación de un muro sobre una casilla ocupada por cualquier combatiente vivo.
   - **Auto-clamping de combatientes al achicar el mapa**: Si el mapa se encoge, los combatientes (incluyendo criaturas Grandes 2×2) son reubicados de forma segura a los nuevos bordes válidos sin error ni pérdida de datos.
   - **Mitigación de condición de carrera**: Si el servidor rechaza una actualización (ej. colisión), el modo de edición y el borrador local (`draftBoard`) permanecen abiertos y muestran un mensaje de error explicativo para no perder el trabajo de edición.

2. **Herramientas de Edición en el Cliente Web (`MapEditorToolbar`)**:
   - Barra de herramientas con inputs numéricos para redimensionar la sala (con botón "Redimensionar").
   - Contadores en vivo de obstáculos presentes: Muros (`impassableCells`), Columnas (`lineOfEffectBlockingCells`) y Escombros (`difficultTerrainCells`).
   - Pinceles activos con estados claros: 🧱 Muro, 🏛️ Columna LoE, 🪨 Escombros (2×) y 🧹 Borrador.
   - Acciones de "Limpiar Todo", "Guardar y Aplicar" y "Cancelar".
   - Botón en barra superior `"🗺️ Editor de Mapa"` exclusivo para el GM durante salas de combate activas.
   - Al pintar, `effectiveRoom` y `rulesSnapshot` se actualizan reactivamente, generando los meshes 3D en Three.js al instante.

## 2. Archivos Modificados / Creados

- `packages/shared/src/types.ts`: agregado comando `update-board` en `ClientCommand`.
- `packages/shared/src/schemas/commands/roomCommands.ts`: esquema Zod `updateBoardSchema`.
- `packages/shared/src/schemas/commands/index.ts`: registrado `updateBoardSchema`.
- `apps/server/src/commands/roomCommands.ts`: función `handleUpdateBoard` con sanitización, exclusividad, clamping y control de colisión.
- `apps/server/src/commands/dispatcher.ts`: enrutamiento del comando `update-board`.
- `apps/web/src/components/MapEditor/MapEditorToolbar.tsx`: componente visual de herramientas del editor de mapas.
- `apps/web/src/styles.css`: estilos de barra de herramientas, pinceles y botón de GM.
- `apps/web/src/App.tsx`: integración de estado de edición, pintura en celdas, feedback y renderizado reactivo del tablero.
- `docs/designs/map-builder-mvp/design.md`: NDD canónico de la funcionalidad.
- `docs/designs/map-builder-mvp/implementation-plan.md`: plan de implementación persistente.
- `tests/map-builder.test.mjs`: 5 pruebas unitarias del backend cubriendo permisos, dimensiones, capas y colisiones.
- `tests-ui/map-builder.spec.ts`: prueba Playwright E2E del editor y su ciclo de vida.
- `PROJECT_STATUS.md`, `TODO.md`, `INDEX.md`: documentación canónica sincronizada.

`test.txt` permanece intacto y sin seguimiento en Git.

## 3. Validación

- `npm test`: 662/662 tests unitarios en verde (incluye los 5 tests de `map-builder.test.mjs`).
- `npm run typecheck`: 0 errores en todos los workspaces (`shared`, `web`, `server`).
- `npm run build`: compilación de producción exitosa en todos los workspaces.
- `node scripts/e2e-websocket.mjs`: 107/107 pruebas de WebSocket aprobadas.
- `npm run test:ui`: 11/11 tests de Playwright UI pasando al 100%.
- `git diff --check`: limpio.

## 4. Estado

Ready for Architecture Review. Hito D-5 (Editor Táctico de Mapas MVP) implementado y validado en su totalidad.
