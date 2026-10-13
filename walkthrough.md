# Walkthrough — Oclusión 3D de Sprites, Zoom 200% y Hoja de Ruta de Mesa Digital

Responsabilidad: Resumen del último cierre ejecutado, sus decisiones, validaciones y límites.
Autoridad: Registro rotativo
Lifecycle: Temporal (se reescribe en cada cierre)
Reemplaza: Walkthrough de normalización visual de sprites 2.5D
Complementa: [Estado](PROJECT_STATUS.md), [Roadmap](ROADMAP.md), [NDD D-4](docs/designs/tactical-renderer-2.5d/design.md)
Consumidores: Architecture Reviewer, propietario y agentes que retoman el repositorio.

---

## 1. Resultado

1. **Corrección de Oclusión 3D (`depthTest: true`)**:
   - En la Escena B, cuando el Guardián Coloso avanzaba en Squeezing por el corredor estrecho, los muros en primer plano se dibujaban detrás del sprite en lugar de ocluirlo.
   - Se restauró `depthTest: true` en `spriteMaterial` de `TacticalScene3D.tsx`.
   - La cuadrícula del suelo se ajustó con `depthWrite: false` a `y = 0.005`, garantizando que las líneas de la cuadrícula no perforen ni compitan con los pies de las figuras, mientras que los muros y pilares (`depthWrite: true`) ocluyen limpiamente a los combatientes cuando están delante de ellos según la perspectiva de la cámara.
   - Las placas de nombre e indicadores de estado mantienen `depthTest: false` con capas de renderizado superiores (`renderOrder: 50/60`), permaneciendo legibles por encima de los muros.

2. **Ampliación de Zoom Máximo al 300%**:
   - Se aumentó `CAMERA_ZOOM_MAX` de `2.0` a `3.0` (300%) en `presentationModel.ts`.
   - Se eliminaron números mágicos en `TacticalScene3D.tsx`, vinculando directamente los límites de OrbitControls y la rueda de desplazamiento a `CAMERA_ZOOM_MIN` y `CAMERA_ZOOM_MAX`.

3. **Gobernanza y Visión Estratégica (`ROADMAP.md`)**:
   - Se reestructuró `ROADMAP.md` alineándolo con el diseño de **Mesa Digital Táctica Híbrida (Pantalla de TV + Companion Móvil)** en 5 Fases evolutivas:
     - **Fase 1**: Combate Libre y Editor Básico de Mapas.
     - **Fase 2**: Creador / Gestor Guiado de Personajes SRD 3.5.
     - **Fase 3**: Mesa Híbrida (Display TV 2.5D + Cliente Móvil 2D Ligero).
     - **Fase 4**: Niebla de Guerra Dinámica y Ceguera Táctica (Visión compartida y reducción de visibilidad a 10 ft).
     - **Fase 5**: Cobertura Total SRD / PHB V1.0.

## 2. Archivos

- `apps/web/src/components/Board/renderer/TacticalScene3D.tsx`: `depthTest: true` en sprites y `depthWrite: false` en grid lines.
- `apps/web/src/components/Board/presentationModel.ts`: `CAMERA_ZOOM_MAX = 3.0`.
- `ROADMAP.md`: reestructuración canónica de las 5 fases estratégicas.
- `walkthrough.md`: registro del cierre del sprint.

No se alteraron reglas mecánicas, snapshots, contratos de red ni autoridad del servidor.
`test.txt` permanece intacto y sin seguimiento en Git.

## 3. Validación

- `npm test`: 657/657 tests unitarios en verde.
- `npm run typecheck`: 0 errores en shared, web y server.
- `npm run build`: compilación de producción exitosa en todos los workspaces.
- `npx playwright test tests-ui/demo.spec.ts`: 3/3 suites completas en verde (incluye validación de Escena B con captura visual verificada).
- `node scripts/e2e-websocket.mjs`: 107/107 pruebas de integración por WebSocket aprobadas.
- `git diff --check`: limpio.

## 4. Estado

Ready for Architecture Review. Sprint de remediación visual y gobernanza completado con validación visual y técnica al 100%.
