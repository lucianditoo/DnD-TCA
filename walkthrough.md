# Walkthrough — Remediación Visual R2: Terreno Volumétrico y Sprites Billboard 2.5D

Responsabilidad: Resumen del último cierre ejecutado (motivos, archivos tocados, validaciones y estado final).
Autoridad: Registro rotativo
Lifecycle: Temporal (se reescribe en cada cierre)
Reemplaza: —
Complementa: [Estado](PROJECT_STATUS.md), [Diseño NDD Demo](docs/designs/scripted-combat-demo.md), [Evidencia de Pruebas](docs/testing/master-coverage.md)
Consumidores: Architecture Reviewer y agentes que retoman el repositorio.

---

## 1. Objetivo del Cierre

Remediar integralmente la presentación visual 2.5D tras el rechazo estético del commit `20de956`. El tablero ya no se percibe como una cuadrícula inclinada con pictogramas y texto dominante (`BLOQ`, `5 FT`), sino como un escenario táctico tridimensional coherente:
- **Suelo continuo:** Losa de piedra sólida continua con espesor de cimentación y zócalo exterior, sobre la que se proyecta una cuadrícula fina y sobria (no losas de botones independientes).
- **Terreno y obstáculos volumétricos:** Prismas tridimensionales con altura real y caras orientadas hacia la cámara con sombreado dinámico/determinista según el ángulo para muros, pilares y escombros.
- **Sprites billboard erguidos:** Figuras de cuerpo completo estilizadas (~1.8x altura de celda) erguidas verticalmente mediante contra-rotación 3D perpendicular al plano del suelo inclinado (`rotateX(-55deg)`), con sombras de contacto elípticas en los pies y marcadores de base táctica.
- **Diferenciación y condiciones:** Criaturas Large (2×2) a escala 1.85x visiblemente imponentes, compresión en espacio estrecho (Squeezing 0.75x), postura abatida sobre el suelo para *Derribado* (`Prone`) y aura rígida púrpura para *Paralizado* (`Hold Person`).
- **Placas flotantes discretas:** Nombres legibles y compactos con barras de HP bajo las figuras, y badges de cobertura/estado secundarios sin solapamientos.

---

## 2. Archivos Modificados y Decisiones Arquitectónicas

- [`apps/web/src/components/Board/sprites.tsx`](apps/web/src/components/Board/sprites.tsx):
  - Figuras humanoides completas SVG con silueta corporal reconocible (cabeza, torso, brazos, piernas, armas, armaduras, capas) para los 16 arquetipos del catálogo y bestia Canocrock.
  - Soporte de variante dual: `variant="full"` (viewBox `-4 -6 72 132` con pies en la base) para el tablero 2.5D, y `variant="portrait"` (viewBox `10 2 44 44`) para listas de combatientes, iniciativas y vista 2D.
  - Soporte de propiedad `mirrored` para reflejo en ángulos simétricos de cámara.
- [`apps/web/src/components/Board/presentationModel.ts`](apps/web/src/components/Board/presentationModel.ts):
  - Modelo efímero que deriva volúmenes escénicos (`wall`, `pillar`, `rubble-stone`, `ledge`) con `projectedGridColumn`, `projectedGridRow`, `paintDepth` y caras visibles calculadas puramente por ángulo (`getCameraFacingFaces`, `getFaceShade`).
  - Derivación de poses (`standing`, `prone`, `paralyzed`, `fallen`), factores de escala (`spriteScale: 1.85` para Large, `widthScale: 0.75` para Squeezing) y orden de pintura en pantalla (`paintIndex`).
- [`apps/web/src/components/Board/Board.tsx`](apps/web/src/components/Board/Board.tsx):
  - Jerarquía visual 3D: Viewport (`perspective: 1200px`) → Escenario con inclinación (`rotateX(55deg)`) y guiñada → Losa de piedra con zócalos frontales/laterales → Suelo continuo → Celdas transparentes con overlays tácticos planos → Prismas volumétricos ordenados por profundidad → Figuras billboard erguidas con contra-rotación.
- [`apps/web/src/styles.css`](apps/web/src/styles.css):
  - Estilos de prismas 3D con caras superiores y caras laterales sombreadas.
  - Transformación billboard `transform: translateX(-50%) rotateX(calc(-1 * var(--camera-tilt, 55deg)))` con origen `50% 100%` para anclar los pies a la celda mientras el cuerpo se yergue verticalmente en el eje Y de la pantalla.
  - Postura Prone abatida en el suelo y aura Paralyzed.
- [`tests/board-presentation-25d.test.mjs`](tests/board-presentation-25d.test.mjs):
  - 8 pruebas unitarias cubriendo resolución de sprites, protección anti icon IDs, proyección biyectiva de celdas y huellas Large, caras y sombreado determinista, generación de prismas volumétricos y poses de unidades.
- [`playwright.config.ts`](playwright.config.ts) & [`tests-ui/demo.spec.ts`](tests-ui/demo.spec.ts):
  - Viewport configurado a 1440×900 para capturas de alta resolución.
  - Validación de los 4 ángulos de cámara, vista 2D, controles de transporte, criatura Large 2x2, Squeezing, cobertura y condiciones.

---

## 3. Validaciones Ejecutadas

- `npm test`: **657/657 pruebas en verde** (incluyendo los 8 tests unitarios de presentación 2.5D).
- `npm run typecheck`: **0 errores** (`shared`, `web`, `server`).
- `npm run build`: **0 errores** (`shared`, `web`, `server`).
- `node scripts/e2e-websocket.mjs`: **107/107 aserciones en verde** (exit 0).
- `npm run test:ui`: **10/10 escenarios Playwright en verde** (`tests-ui/demo.spec.ts` + `tests-ui/smoke.spec.ts`).
- `git diff --check`: **0 advertencias ni espacios espurios**.

---

## 4. Capturas de Pantalla Generadas (1440×900)

1. `demo_25d_angle_nw.png` — Escena A desde el ángulo NO (figuras completas erguidas, losa de piedra con espesor, nombres discretos).
2. `demo_25d_angle_se.png` — Escena A desde el ángulo SE (rotación de cámara coherente, sombreado y perspectiva inversa).
3. `demo_25d_scene_b_cover_and_large.png` — Escena B con Guardián Coloso Large (2×2) a escala imponente, muros del corredor estrecho con volumen y sombreado de caras, pilares LoE y escombros.
4. `demo_25d_large_squeezing.png` — Escena B con Guardián Coloso comprimiéndose por el corredor de 5 pies (Squeezing 0.75x width).
5. `demo_25d_prone_condition.png` — Escena C con Duelista Orco derribado (Prone abatido en el suelo tras Trip).
6. `demo_25d_hold_person_condition.png` — Escena C con Guardia de Lanza paralizado (aura rígida púrpura tras Hold Person).
7. `demo_25d_movement_overlay.png` — Demostración de overlays tácticos de movimiento (celdas alcanzables, trazado de ruta con costes 5/10/15) proyectados planos en el suelo.
8. `demo_2d_fallback.png` — Vista 2D ortogonal de respaldo.

---

## 5. Gate Documental de Cierre (`AGENTS.md` §4.5.1)

1. **Enlaces**: Verificados los enlaces internos en `PROJECT_STATUS.md`, `TODO.md`, `docs/testing/master-coverage.md` y este `walkthrough.md`.
2. **Responsabilidad única**: Sin duplicación ni documentos huérfanos.
3. **Registry consistente**: Cero impacto en reglas del motor ni en `docs/rules/registry.md`.
4. **Snapshots sincronizados**: `PROJECT_STATUS.md`, `TODO.md`, `docs/testing/master-coverage.md` y `walkthrough.md` reflejan exactamente el estado final.
5. **Preservación de archivos locales ajenos**: `test.txt` (y cualquier archivo ajeno) permanece intacto y fuera de staging.
