# Walkthrough — Paneo de Cámara (Click Derecho) y Corrección de Oclusión en Toolbar 2D

Responsabilidad: Resumen del último cierre ejecutado, sus decisiones, validaciones y límites.
Autoridad: Registro rotativo
Lifecycle: Temporal (se reescribe en cada cierre)
Reemplaza: Walkthrough de oclusión 3D y Zoom
Complementa: [Estado](PROJECT_STATUS.md), [Roadmap](ROADMAP.md), [NDD D-4](docs/designs/tactical-renderer-2.5d/design.md)
Consumidores: Architecture Reviewer, propietario y agentes que retoman el repositorio.

---

## 1. Resultado

1. **Paneo con Click Derecho (Right-Click PAN)**:
   - Se activó `enablePan: true`, `screenSpacePanning: true` y `panSpeed: 1.0` en `OrbitControls` dentro de `TacticalScene3D.tsx`.
   - Se reasignaron los botones del ratón: Click izquierdo (`MOUSE.ROTATE`) orbita la cámara; Click derecho (`MOUSE.PAN`) traslada el foco de la escena táctica.
   - Se suprimió el menú contextual del navegador sobre el lienzo (`contextmenu.preventDefault()`) para evitar interrupciones al arrastrar.
   - Se blindó la interacción de celdas en `onPointerUp`: únicamente el botón principal (izquierdo, `button === 0`) puede seleccionar combatientes o marcar casillas; el botón derecho queda reservado exclusivamente para paneo.
   - Al pulsar "Restablecer", `controls.target` vuelve al centro geométrico del tablero `(0, 0.35, 0)` restaurando la vista canónica.

2. **Corrección de Oclusión de Toolbar en Vista 2D**:
   - En vistas 2D con zoom elevado (hasta 300%), la transformación CSS escalaba la cuadrícula cubriendo la barra de herramientas superior.
   - Se otorgó a `.board-toolbar` posicionamiento `position: sticky; top: 0; z-index: 50;` con fondo opaco y backdrop blur, asegurando que los controles de vista (2.5D / 2D), cámara (NO, NE, SE, SO) y zoom permanezcan siempre visibles e interactivos.
   - En `.board-stage.is-2d`, se fijó `transform-origin: top center` con margen inferior proporcional, y `.board-stage-viewport` se configuró con `overflow: auto; z-index: 1`, permitiendo desplazar el tablero 2D escalado sin solapamientos.

## 2. Archivos

- `apps/web/src/components/Board/renderer/TacticalScene3D.tsx`: soporte de paneo con click derecho, supresión de contextmenu, target reset y filtrado de selección.
- `apps/web/src/styles.css`: `.board-toolbar` sticky con z-index alto, y `.board-stage.is-2d` con origen y contención de scroll seguros.
- `walkthrough.md`: registro del sprint.

No se alteraron reglas mecánicas, snapshots, contratos de red ni autoridad del servidor.
`test.txt` permanece intacto y sin seguimiento en Git.

## 3. Validación

- `npm test`: 657/657 tests unitarios en verde.
- `npm run typecheck`: 0 errores en shared, web y server.
- `npm run build`: compilación de producción exitosa en todos los workspaces.
- `npx playwright test tests-ui/demo.spec.ts`: 3/3 suites completas en verde.
- `node scripts/e2e-websocket.mjs`: 107/107 pruebas de WebSocket aprobadas.
- `git diff --check`: limpio.

## 4. Estado

Ready for Architecture Review. Sprint de corrección de UI y controles de cámara completado al 100%.
