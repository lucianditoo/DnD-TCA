# Plan de Implementación — D-5 Editor Táctico de Mapas MVP (D-5R2 Final Remediation)

> **Responsabilidad:** Plan de trabajo técnico para el Editor Táctico de Mapas (Hito 1.2 del Roadmap).
> **Estado:** Implementado y Validado (100% Tests Verdes, D-5R2 remediado).
> **Nivel de Cambio:** Nivel C.

---

## 1. Archivos Afectados

1. **`packages/shared/src/types.ts`**:
   - Definir `UpdateBoardCommand` y agregar `{ type: "update-board"; roomCode: string; actorId: string; board: Board }` a `ClientCommand`.
2. **`packages/shared/src/schemas/commands/roomCommands.ts`**:
   - Esquema Zod `boardCellKeySchema` (`^\d+,\d+$`) y `updateBoardSchema` validando `type`, `roomCode`, `actorId`, `cellSizeFeet` (restringido a 5) y listas de celdas con el schema de coordenadas.
3. **`packages/shared/src/schemas/commands/index.ts`**:
   - Registro en `clientCommandSchema` y `commandSchemasMap`.
4. **`apps/server/src/commands/roomCommands.ts`**:
   - `handleUpdateBoard`: validación pura y estricta sobre `candidateRoom = { ...room, board: candidateBoard }`. Construcción previa del `candidateBoard` con `cellSizeFeet: 5`. Validación de invariantes espaciales: límites y colisión con muros para todos los combatientes usando sus huellas efectivas derivadas en el candidate room. Validación de invariante de compresión (`srd_squeezing`): si el nuevo tablero invalida las `narrowCells` requeridas para la compresión de una criatura, la actualización se rechaza atómicamente con mensaje descriptivo, sin mutar posiciones, efectos ni el tablero existente. Pre-chequeo de colisión de muros contra huellas actuales y candidatas.
5. **`apps/server/src/commands/dispatcher.ts`**:
   - Enrutamiento de `update-board` a `handleUpdateBoard`.
6. **`apps/web/src/components/Board/presentationModel.ts`**:
   - Semántica visual canónica de muros y pilares: celdas con `impassable: true` (tengan o no bloqueo de LoE) resuelven `scenicProp: "barrier-block"` y `volume.kind: "wall"`. Celdas con bloqueo de LoE exclusivamente (`!impassable && loeBlocked`) resuelven `scenicProp: "loe-pillar"` y `volume.kind: "pillar"`.
7. **`apps/web/src/components/MapEditor/MapEditorToolbar.tsx`**:
   - Barra de herramientas con congelamiento de borrador durante guardado (`isSaving`), deshabilitación de inputs de ancho/alto, botón Redimensionar, radios de pinceles, Limpiar Todo, Guardar y Cancelar. Utilidad pura `areBoardsSemanticallyEqual` para verificación profunda de igualdad de tableros (dimensiones, escala y conjuntos de celdas independientes del orden, incluyendo iluminación).
8. **`apps/web/src/components/CombatantsPanel/CombatantsPanel.tsx`**, **`GmPanel.tsx`** y **`ActionsPanel.tsx`**:
   - Bloqueo completo de interacción de combate durante edición (`isInteractionLocked = isMapEditing`): deshabilitación de creación de perfiles, adición de héroes y enemigos del catálogo, inputs de iniciativa, botón Iniciar combate, botones de acciones de turno, botones tácticos, y acciones del GM.
9. **`apps/web/src/App.tsx`**:
   - Integración de ciclo de vida ACK: transición a `mapEditorStatus = "saving"` con congelamiento de interacciones. Cierre del editor condicionado estrictamente a la recepción de un `room-update` semánticamente compatible con el borrador enviado. Room-updates ajenos no descartan el borrador ni cierran el editor. Ante errores de servidor, preservación íntegra del borrador abierto para corrección por el GM.
10. **`tests/map-builder.test.mjs`** y **`tests/board-presentation-25d.test.mjs`**:
    - Tests unitarios y de servidor cubriendo candidate board validation, invariantes de squeezing, rechazo atómico ante invalidación de pasajes angostos, semántica visual de muros vs pilares, y comparación semántica de tableros.
11. **`tests-ui/map-builder.spec.ts`**:
    - Suite Playwright determinista cubriendo apertura, selección de pinceles, redimensionamiento, guardado, descarte mediante Cancelar, rechazo determinista del servidor con persistencia del borrador, persistencia de semántica visual de muros y pilares, y bloqueo completo de interacción de combate.

---

## 2. Verificación Ejecutada

- `npm test`: 677 tests pasando (28 suites, 0 fallos).
- `npm run typecheck`: 0 errores en todos los workspaces (`shared`, `web`, `server`).
- `npm run build`: compilación limpia en todos los workspaces.
- `node scripts/e2e-websocket.mjs`: suite completa E2E WebSocket en verde (107/107).
- `npm run test:ui`: 15 tests Playwright UI pasando al 100% (demo + map-builder + smoke tests).
