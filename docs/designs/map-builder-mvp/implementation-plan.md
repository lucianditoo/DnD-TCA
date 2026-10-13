# Plan de Implementación — D-5 Editor Táctico de Mapas MVP (D-5R3 Final Closure Remediation)

> **Responsabilidad:** Plan de trabajo técnico para el Editor Táctico de Mapas (Hito 1.2 del Roadmap).
> **Estado:** CERRADO y TÉCNICAMENTE APROBADO (Architecture Review sobre commit `6fd385b42b4dc51b8dcbb195108d7051a600944f`).
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
   - `handleUpdateBoard`: validación pura y estricta sobre `candidateRoom = { ...room, board: candidateBoard }`. Construcción previa del `candidateBoard` con `cellSizeFeet: 5`. Validación de invariantes espaciales: límites y colisión con muros para todos los combatientes usando sus huellas efectivas derivadas en el candidate room. Validación de invariante de compresión (`srd_squeezing`): preservación estricta del conjunto de celdas efectivas `(x, y, zFeet)` de la criatura comprimida (sin mutar orientación, axis ni posición); ante cualquier alteración de la huella o invalidación de compresión se rechaza atómicamente con mensaje descriptivo y cero mutación. Conteo corregido de pilares (`loe-only`, excluyendo muros).
5. **`apps/server/src/commands/dispatcher.ts`**:
   - Enrutamiento de `update-board` a `handleUpdateBoard`.
6. **`apps/web/src/components/Board/presentationModel.ts`**:
   - Semántica visual canónica de muros y pilares: celdas con `impassable: true` (tengan o no bloqueo de LoE) resuelven `scenicProp: "barrier-block"` y `volume.kind: "wall"`. Celdas con bloqueo de LoE exclusivamente (`!impassable && loeBlocked`) resuelven `scenicProp: "loe-pillar"` y `volume.kind: "pillar"`.
7. **`apps/web/src/components/MapEditor/MapEditorToolbar.tsx`**:
   - Barra de herramientas con congelamiento de borrador durante guardado (`isSaving`), deshabilitación de inputs de ancho/alto, botón Redimensionar, radios de pinceles, Limpiar Todo, Guardar y Cancelar. Métrica de pilares corregida a `loe-only`. Utilidad pura `areBoardsSemanticallyEqual` para verificación profunda de igualdad de tableros.
8. **`apps/web/src/components/CombatantsPanel/CombatantsPanel.tsx`**, **`GmPanel.tsx`** y **`ActionsPanel.tsx`**:
   - Bloqueo completo de interacción de combate durante edición (`isInteractionLocked = isMapEditing`): deshabilitación de creación de perfiles, adición de héroes y enemigos del catálogo, inputs de iniciativa, botón Iniciar combate, botones de acciones de turno, botones tácticos, y acciones del GM.
9. **`apps/web/src/App.tsx`**:
   - Integración de ciclo de vida ACK: limpieza de errores previos al despachar guardado (`setError(null)`, `setMapEditorError(null)`), congelamiento de interacciones. Cierre del editor condicionado estrictamente a un `room-update` posterior al despacho y semánticamente idéntico al borrador guardado (`room !== roomAtSaveRef.current`). Preservación del borrador ante room-updates ajenos o rechazos de servidor. Gating del modal de confirmación crítica durante `isMapEditing`.
10. **`scripts/e2e-websocket.mjs`**:
    - Prueba E2E de WebSocket para `update-board`: validación de rechazo a jugadores no-GM, persistencia autoritativa de muros, pilares y escombros, normalización de `cellSizeFeet: 5` y broadcast a todos los clientes conectados.
11. **`tests/map-builder.test.mjs`** y **`tests/board-presentation-25d.test.mjs`**:
    - Tests unitarios y de servidor cubriendo candidate board validation, invariantes de squeezing con preservación estricta de coordenadas, rechazo atómico ante invalidación de pasajes angostos o rotación de huella, semántica visual de muros vs pilares, y comparación semántica de tableros.
12. **`tests-ui/map-builder.spec.ts`**:
    - Suite Playwright determinista cubriendo apertura, selección de pinceles, redimensionamiento, guardado, descarte mediante Cancelar, rechazo determinista del servidor con persistencia del borrador, recuperación y reintento exitoso tras error, aislamiento de borrador ante broadcasts ajenos, persistencia de semántica visual de muros y pilares, y bloqueo completo de interacción de combate.

---

## 2. Verificación Ejecutada

- `npm test`: 681 tests pasando (28 suites, 0 fallos).
- `npm run typecheck`: 0 errores en todos los workspaces (`shared`, `web`, `server`).
- `npm run build`: compilación limpia en todos los workspaces.
- `node scripts/e2e-websocket.mjs`: suite completa E2E WebSocket en verde (110/110).
- `npm run test:ui`: 16 tests Playwright UI pasando al 100% (demo + map-builder + smoke tests).
