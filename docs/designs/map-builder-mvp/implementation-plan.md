# Plan de Implementación — D-5 Editor Táctico de Mapas MVP

> **Responsabilidad:** Plan de trabajo técnico para el Editor Táctico de Mapas (Hito 1.2 del Roadmap).
> **Estado:** Implementado y Validado (100% Tests Verdes).
> **Nivel de Cambio:** Nivel C.

---

## 1. Archivos Afectados

1. **`packages/shared/src/types.ts`**:
   - Definir `UpdateBoardCommand` y agregar `{ type: "update-board"; roomCode: string; actorId: string; board: Board }` a `ClientCommand`.
2. **`packages/shared/src/schemas/commands/roomCommands.ts`**:
   - Esquema Zod `updateBoardSchema` validando `type`, `roomCode`, `actorId` y `board`.
3. **`packages/shared/src/schemas/commands/index.ts`**:
   - Registro en `clientCommandSchema` y `commandSchemasMap`.
4. **`apps/server/src/commands/roomCommands.ts`**:
   - `handleUpdateBoard`: verificación de rol GM con `requireGM`, validación de dimensiones (6-40), integridad de coordenadas `"x,y"`, exclusividad de capas (muro > LoE > difícil > estrecho), detección de colisión de muros con combatientes vivos, auto-reubicación (clamp) de combatientes al achicar el mapa, y logging del sistema.
5. **`apps/server/src/commands/dispatcher.ts`**:
   - Enrutamiento de `update-board` a `handleUpdateBoard`.
6. **`apps/web/src/components/MapEditor/MapEditorToolbar.tsx`**:
   - Barra de herramientas con selector de dimensiones, estadísticas de obstáculos, botones de pincel (`wall`, `pillar`, `rubble`, `clear`), limpiar todo, guardar y cancelar.
7. **`apps/web/src/styles.css`**:
   - Estilos CSS para el editor, pinceles activos y botón de apertura en topbar.
8. **`apps/web/src/App.tsx`**:
   - Integración de estado (`isMapEditing`, `draftBoard`, `activeBrush`, `mapEditorError`), cálculo de `effectiveRoom` y `rulesSnapshot` reactivos, intercepción de clicks en celdas para pintar con exclusividad de capas, botón en topbar para el GM, y toolbar interactivo.
9. **`tests/map-builder.test.mjs`**:
   - Tests unitarios y de servidor para el comando `update-board` (validaciones de permisos de GM, dimensiones 6-40, exclusividad de capas, rechazo de muro sobre entidad, auto-clamping al encoger).
10. **`tests-ui/map-builder.spec.ts`**:
    - Test Playwright E2E validando apertura del editor, selección de pinceles, redimensionamiento, guardado y feedback en el log.

---

## 2. Verificación Ejecutada

- `npm test`: 662 tests pasando (incluye los 5 tests de map-builder).
- `npm run typecheck`: 0 errores en todos los workspaces (`shared`, `web`, `server`).
- `npm run build`: compilación limpia en todos los workspaces.
- `node scripts/e2e-websocket.mjs`: suite completa E2E en verde.
- `npx playwright test`: 11 tests pasando (demo + map-builder + smoke tests).
