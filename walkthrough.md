# Walkthrough — Corrección de Fichas y Prototipo de Presentación Táctica 2.5D

Responsabilidad: Resumen del último cierre ejecutado (motivos, archivos tocados, validaciones y estado final).
Autoridad: Registro rotativo
Lifecycle: Temporal (se reescribe en cada cierre)
Reemplaza: —
Complementa: [Estado](PROJECT_STATUS.md), [Diseño NDD Demo](docs/designs/scripted-combat-demo.md), [Evidencia de Pruebas](docs/testing/master-coverage.md)
Consumidores: Architecture Reviewer y agentes que retoman el repositorio.

---

## 1. Objetivo del Cierre

Corregir el defecto de presentación en el que las fichas del tablero y de las listas laterales mostraban literalmente los identificadores internos de iconos (`shield`, `swords`, `sparkles`, `skull`) e implementar el **Prototipo de Presentación Táctica 2.5D** sobre el estado compartido existente, manteniendo intacta la autoridad del servidor, los contratos normativos congelados y la simulación real de la demostración `scripted_tactical_demo_v1`.

> **Alcance arquitectónico explícito:** Esta entrega implementa exclusivamente una **capa de presentación táctica 2.5D local** (con modo de respaldo `2D` y cámara de 4 ángulos) sobre el grid autoritativo 2D con huellas multicasilla. **No constituye ni reemplaza el motor espacial 3D definitivo** ni el renderer normativo sobre superficies y volúmenes (D-4).

---

## 2. Arquitectura y Cambios Implementados

```text
Estado autoritativo del servidor
        ↓
Snapshot / CombatRoom compartido (sin cambios)
        ↓
Modelo visual derivado y efímero (presentationModel.ts)
        ↓
Renderer 2.5D o Renderer 2D (Board.tsx + sprites.tsx + styles.css)
        ↓
Cámara y presentación local (NO / NE / SE / SO + zoom acotado)
```

### 2.1 Alcance A — Corrección Inmediata de Fichas y Sprites SVG Locales
- [`apps/web/src/components/Board/sprites.tsx`](apps/web/src/components/Board/sprites.tsx):
  - Biblioteca local de 16 sprites SVG estáticos con fondo transparente y sin dependencias externas:
    - Héroes y aliados: `cedrick`, `bane`, `elaen`, `alaric`, `allied_guard`, `walker`, `explorer`, `guardian_large` (2×2 Large).
    - Enemigos: `orc_leader`, `orc_duelist`, `spear_guard`, `orc_sentinel`, `orc_archer`, `canocrock`.
    - Fallbacks gráficos seguros: `fallback_player` y `fallback_enemy`.
  - Función pura `resolveCombatantSprite(input)` que resuelve por arquetipo/nombre o identificador de icono y garantiza un fallback gráfico seguro sin exponer jamás los identificadores internos (`shield`, `swords`, `sparkles`, `skull`, `crosshair`, `footprints`, `compass`) como texto visible.
  - Componentes `<CombatantSprite />` (para fichas en el tablero) y `<CombatantAvatar />` (para la lista lateral de combatientes, iniciativa, selector de perfiles y pantalla de resultados).
- [`apps/web/src/components/CombatantsPanel/CombatantsPanel.tsx`](apps/web/src/components/CombatantsPanel/CombatantsPanel.tsx), [`apps/web/src/components/common.tsx`](apps/web/src/components/common.tsx), [`apps/web/src/components/ResultScreen/ResultScreen.tsx`](apps/web/src/components/ResultScreen/ResultScreen.tsx) y [`apps/web/src/components/ProfileForm/ProfileList.tsx`](apps/web/src/components/ProfileForm/ProfileList.tsx):
  - Reemplazo de `{combatant.icon}` y `{profile.icon}` textuales por `<CombatantAvatar />`.
  - Ocultación de los controles manuales de creación del catálogo durante la reproducción activa de una demo (`isDemoActive`).

### 2.2 Alcance B — Modelo Visual Derivado, Renderer 2.5D y Cámara V1
- [`apps/web/src/components/Board/presentationModel.ts`](apps/web/src/components/Board/presentationModel.ts):
  - Capa pura y efímera (`buildBoardPresentationModel`, `projectCellToCameraGrid`, `projectFootprintToCameraGrid`, `clampCameraZoom`) que proyecta biyectivamente celdas y footprints (`1×1`, `2×2` Large y `squeezing` 1×2/2×1) en los cuatro ángulos de cámara (`nw`, `ne`, `se`, `sw`) sin mutar `CombatRoom`, `Board`, `Position` ni `CombatRulesSnapshot`.
  - Derivación de elementos escénicos no normativos sobre las celdas existentes (`barrier-block` en `impassableCells` etiquetado `BLOQ` sin prometer Cover, `rubble` en `difficultTerrainCells` etiquetado `2x`, `narrow-corridor` en `narrowCells` etiquetado `5 FT`, y `loe-pillar` en `lineOfEffectBlockingCells` etiquetado `LOE`).
  - Derivación de badges de estado con símbolo + código (`PRN`, `SQZ`, `PAR`, `FF`, `STN`, `BLD`, `ENT`, `GRP`, `HLP`, `FAT`, `EXH`) y badges de cobertura de solo lectura (`COV +4`, `INTERP`) consumiendo `getAttackContextModifiers` del motor compartido.
- [`apps/web/src/components/Board/Board.tsx`](apps/web/src/components/Board/Board.tsx) y [`apps/web/src/styles.css`](apps/web/src/styles.css):
  - Barra de herramientas táctica con selector `VISTA 2.5D / 2D`, selector de cámara `NO / NE / SE / SO`, zoom acotado (`75%`–`135%`) y botón `Restablecer`.
  - Escenario 2.5D inclinado con paleta gris/gris oscuro de losas tácticas con espesor/zócalo (`.cell-plinth`), sombras de contacto (`.token-contact-shadow`), pedestales diferenciados aliado/enemigo (`.token-pedestal`), sprites erguidos en los 4 ángulos (`.token-figure`), etiquetas de nombre legibles con barra de HP (`.token-nameplate`) y tira de estados no superpuesta (`.token-badges`).
  - Soporte de `prefers-reduced-motion` y preservación íntegra de todos los overlays tácticos (movimiento alcanzable, ruta y coste por paso, alcance melee/ranged/conjuro, peligro de AdO) y selección por clic en todas las celdas de footprints `1×1` y `2×2`.
- [`apps/web/src/App.tsx`](apps/web/src/App.tsx), [`apps/web/src/hooks/useBoardSelection.ts`](apps/web/src/hooks/useBoardSelection.ts) y [`apps/web/src/components/DemoPanel/DemoPanel.tsx`](apps/web/src/components/DemoPanel/DemoPanel.tsx):
  - Supresión del modal manual de confirmación de crítico cuando `isDemoActive` es verdadero para no bloquear los controles de transporte de la demo durante `a-8-bane-attack-crit-threat`.
  - Habilitación de selección de cualquier combatiente en el tablero durante la demo para inspeccionar cobertura, condiciones y huellas sin emitir comandos al servidor.

---

## 3. Validaciones Ejecutadas

- `npm test`: **655/655 pruebas en verde** (incluyendo los 6 nuevos tests unitarios en `tests/board-presentation-25d.test.mjs`).
- `npm run typecheck`: **0 errores** (`shared`, `web`, `server`).
- `npm run build`: **0 errores** (`shared`, `web`, `server`).
- `node scripts/e2e-websocket.mjs`: **107/107 aserciones en verde** (exit 0).
- `npm run test:ui`: **10/10 escenarios Playwright en verde** (`tests-ui/demo.spec.ts` con 3 escenarios integrales + `tests-ui/smoke.spec.ts` con 7 escenarios), incluyendo inspección visual de las capturas generadas para los 4 ángulos `NO/NE/SE/SO`, vista `2D`, `Cobertura +4` y Guardián Large `2×2`, `Squeezing`, `Prone`, `Hold Person` (`Paralyzed`) y overlays de movimiento.

---

## 4. Gate Documental de Cierre (`AGENTS.md` §4.5.1)

1. **Enlaces**: Verificados los enlaces internos en `PROJECT_STATUS.md`, `TODO.md`, `docs/testing/master-coverage.md` y este `walkthrough.md`.
2. **Responsabilidad única**: No se crearon documentos duplicados ni huérfanos.
3. **Registry consistente**: No se modificó ninguna regla del motor ni ningún estado en `docs/rules/registry.md`.
4. **Snapshots sincronizados**: `PROJECT_STATUS.md`, `TODO.md`, `docs/testing/master-coverage.md` y `walkthrough.md` reflejan el estado exacto del repositorio y dejan explícito que se trata de una capa de presentación 2.5D y no del motor espacial 3D definitivo.
5. **Preservación de archivos locales ajenos**: `test.txt` (y cualquier archivo local ajeno) permaneció intacto y fuera de staging.
