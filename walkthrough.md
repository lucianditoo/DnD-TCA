# Walkthrough — D-4 Renderer táctico 2.5D y cámara

Responsabilidad: Resumen del último cierre ejecutado, sus decisiones, validaciones y límites.
Autoridad: Registro rotativo
Lifecycle: Temporal (se reescribe en cada cierre)
Reemplaza: —
Complementa: [Estado](PROJECT_STATUS.md), [NDD D-4](docs/designs/tactical-renderer-2.5d/design.md), [Plan D-4](docs/designs/tactical-renderer-2.5d/implementation-plan.md), [Evidencia](docs/testing/master-coverage.md)
Consumidores: Architecture Reviewer, propietario y agentes que retoman el repositorio.

---

## 1. Resultado

D-4 reemplaza la proyección CSS/SVG de la vista 2.5D por una escena Three.js
real: tablero con profundidad, cámara ortográfica orbital por arrastre,
depth buffer, meshes de obstáculos, picking de suelo y combatientes como
billboards pixel-art. Los nombres dejan de sustituir a las figuras: solo se
muestran como etiquetas contextuales para selección, turno o objetivo.

El renderer DOM 2D permanece disponible. Si WebGL no puede inicializarse, la
UI cambia automáticamente a 2D y muestra un aviso no bloqueante.

## 2. Arquitectura y archivos

- `apps/web/src/components/Board/renderer/TacticalScene3D.tsx`: lifecycle de
  Three.js, `OrthographicCamera`, `OrbitControls` sin pan, presets, zoom,
  raycasting, volúmenes, overlays, sprites y liberación de recursos.
- `apps/web/src/components/Board/Board.tsx`: fachada React, selector 2.5D/2D,
  controles y fallback automático.
- `apps/web/src/assets/sprites/*.png`: cuatro familias originales de pixel art
  transparente (caballero, maga, explorador y orco), filtradas con
  nearest-neighbor. Su procedencia se documenta en el README del directorio.
- `apps/web/src/styles.css`: viewport del canvas, avisos y accesibilidad.
- `tests-ui/demo.spec.ts`: cámara orbital, presets, sprites, escenas y estados.
- `tests-ui/smoke.spec.ts`: regresión funcional explícita sobre el fallback 2D.
- `apps/web/package.json` y `package-lock.json`: `three` y sus tipos.

No se modificaron reglas, snapshots, servidor ni contratos WebSocket. El
renderer consume el modelo presentacional existente y traduce el picking a la
callback ya autorizada; nunca decide legalidad ni consecuencias.

## 3. Validación

- `npm test`: 657/657.
- `npm run typecheck`: verde en shared, web y server.
- `npm run build`: verde en shared, web y server.
- `node scripts/e2e-websocket.mjs`: 107/107.
- `npm run test:ui`: 10/10.
- `git diff --check`: sin errores.

Vite advierte que el bundle principal supera 500 kB. No afecta corrección ni
el DoD; una división diferida del renderer queda condicionada a métricas reales
y no se registra como deuda automática.

## 4. Límites y estado

- Es presentación 2.5D sobre el Board V1; las alturas visuales no tienen
  autoridad mecánica ni sustituyen el futuro modelo espacial normativo.
- Los cuatro assets cubren familias visuales, no un atlas completo de todos los
  monstruos, poses o animaciones.
- D-4 queda implementado y listo para validación visual del propietario, pero
  no se declara cerrado hasta esa aceptación y Architecture Review.
- `test.txt` continúa intacto, sin seguimiento y fuera del commit.

## 5. Gate documental

Los enlaces tocados resuelven, D-4 conserva una única sede de diseño y plan,
el Registry no cambia porque no se agregó ninguna regla, y
`PROJECT_STATUS.md`, `TODO.md`, `ROADMAP.md` y `master-coverage.md` reflejan el
mismo estado: implementación completa, aceptación visual pendiente.
