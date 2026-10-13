# Plan de Implementación — D-5 Editor Táctico de Mapas MVP

> **Responsabilidad:** Plan de trabajo técnico para el Editor Táctico de Mapas (Hito 1.2 del Roadmap).
> **Estado:** Implementado y Validado (100% Tests Verdes).
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
   - `handleUpdateBoard`: verificación de rol GM y pertenencia de sala (`requireGM`), validación de dimensiones (6-40), integridad de coordenadas `"x,y"`, eliminación de jerarquía inventada de capas (muros conservan tanto bloqueo de paso como de LoE), detección de colisión de muros con combatientes vivos, rechazo atómico estricto (cero auto-clamping) si cualquier combatiente quedaría fuera de límites calculando su footprint canónico multicasilla, normalización autoritativa fija de `cellSizeFeet: 5`, y logging del sistema.
5. **`apps/server/src/commands/dispatcher.ts`**:
   - Enrutamiento de `update-board` a `handleUpdateBoard`.
6. **`apps/web/src/components/MapEditor/MapEditorToolbar.tsx`**:
   - Barra de herramientas con selector de dimensiones, estadísticas de obstáculos, botones de pincel (`wall`, `pillar`, `rubble`, `clear`), limpiar todo, guardar y cancelar.
7. **`apps/web/src/styles.css`**:
   - Estilos CSS para el editor, pinceles activos y botón de apertura en topbar.
8. **`apps/web/src/App.tsx`**:
   - Integración de estado (`isMapEditing`, `mapEditorStatus`, `draftBoard`, `activeBrush`, `mapEditorError`), aislamiento estricto de `rulesSnapshot` autoritativo frente al `presentationRoom` visual del borrador, bloqueo de comandos de combate durante la edición, preservación de borrador ante errores del servidor, cierre condicionado a igualdad semántica del tablero, intercepción de clicks en celdas, y toolbar interactivo.
9. **`tests/map-builder.test.mjs`**:
   - Tests unitarios y de servidor para el comando `update-board` (validaciones de permisos de GM y sala, dimensiones 6-40, normalización de `cellSizeFeet` a 5, preservación de capas sin jerarquía artificial, rechazo atómico sin mutaciones si combatientes Medium/Large/Huge quedan fuera, conservación exacta de posiciones en resize válido, rechazo de muro sobre entidad, validación de LoE y movimiento bloqueados).
10. **`tests-ui/map-builder.spec.ts`**:
    - Tests Playwright E2E validando apertura del editor, selección de pinceles, redimensionamiento, guardado, descarte mediante Cancelar, y retención del borrador ante errores de servidor.

---

## 2. Verificación Ejecutada

- `npm test`: 662 tests pasando (incluye los 5 tests de map-builder).
- `npm run typecheck`: 0 errores en todos los workspaces (`shared`, `web`, `server`).
- `npm run build`: compilación limpia en todos los workspaces.
- `node scripts/e2e-websocket.mjs`: suite completa E2E en verde.
- `npx playwright test`: 11 tests pasando (demo + map-builder + smoke tests).
