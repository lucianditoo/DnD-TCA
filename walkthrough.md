# Walkthrough — D-5R1 Remediación de Arquitectura del Editor Táctico de Mapas (MVP)

Responsabilidad: Resumen del último cierre ejecutado, sus decisiones, validaciones y límites.
Autoridad: Registro rotativo
Lifecycle: Temporal (se reescribe en cada cierre)
Reemplaza: Walkthrough — D-5 Editor Táctico de Mapas (MVP)
Complementa: [Estado](PROJECT_STATUS.md), [Roadmap](ROADMAP.md), [NDD D-5 canónico](docs/designs/map-builder-mvp/design.md)
Consumidores: Architecture Reviewer, propietario y agentes que retoman el repositorio.

---

## 1. Resultado y Remediaciones Ejecutadas (D-5R1)

Se remediaron íntegramente los hallazgos de Architecture Review sobre el D-5 Map Builder MVP restaurando la fidelidad total al NDD canónico (`docs/designs/map-builder-mvp/design.md`):

1. **MAJOR 1 — Eliminación Total de Auto-Clamp y Validación Atómica de Límites**:
   - Se eliminó del servidor toda lógica de mutación tipo `combatant.position = clampedPosition` y el hardcode `sizeCategory === "large" ? 2 : 1`.
   - Se implementó la verificación de límites atómica usando la autoridad espacial canónica del proyecto (`getCombatantOccupiedCells(combatant, room)`).
   - Si cualquier celda ocupada por un combatiente queda fuera del rango `[0..width-1, 0..height-1]`, la operación se rechaza atómicamente antes de mutar ninguna propiedad con el mensaje explicativo: `No se puede reducir el mapa a <W>x<H>: <Nombre> quedaría fuera de los límites. Reubícalo antes de redimensionar.`
   - No hay traslados colaterales, no hay colisiones sobre muros por achicamiento ni creación de overlaps. En un resize válido, todas las posiciones se conservan exactamente intactas.

2. **MAJOR 2 — cellSizeFeet No Editable y Fijo en 5**:
   - `cellSizeFeet` está fijado autoritativamente en `5` por el servidor (`normalizedBoard.cellSizeFeet = 5`), ignorando cualquier valor recibido del cliente.
   - En el schema Zod (`updateBoardSchema`), `cellSizeFeet` se restringió a `z.literal(5).optional()`, rechazando en el boundary cualquier escala mecánica arbitraria.

3. **MAJOR 3 — Eliminación de la Jerarquía Inventada de Capas**:
   - Se eliminó la jerarquía arbitraria `Muro > LoE > Terreno Difícil > Estrecho`.
   - Los muros guardados conservan explícita y simultáneamente tanto `impassableCells` (bloqueo de movimiento) como `lineOfEffectBlockingCells` (bloqueo de LoE).
   - `lineOfEffectBlockingCells` y `difficultTerrainCells` operan como capas independientes.
   - Las reglas productivas de Movement y Line of Effect (`validateMovePath`, `getLineOfEffect`) validan correctamente los obstáculos guardados sin requerir inferencias artificiales.

4. **MAJOR 4 y MINOR 2 — Aislamiento del Borrador de Presentación y Bloqueo de Acciones de Combate**:
   - En `apps/web/src/App.tsx`, `rulesSnapshot` se calcula estrictamente a partir de la sala autoritativa (`createCombatRulesSnapshot(room)`). El borrador `draftBoard` alimenta exclusivamente a `presentationRoom` para el renderizado visual de `<Board />`.
   - Mientras `isMapEditing` está activo, se bloquea el control de combatientes, selección, fin de turno y emisión de comandos de combate.
   - Se introdujo `mapEditorStatus: "idle" | "editing" | "saving"`. Si el servidor rechaza una actualización o emite un error, el borrador y la barra de herramientas permanecen abiertos con el mensaje de error visible para no perder el trabajo del GM.
   - El cierre del editor tras guardar se condiciona a la confirmación semántica del tablero (`areBoardsSemanticallyEqual`).

5. **MINOR 1 — Esquema Específico para Claves de Celda**:
   - Se exportó `boardCellKeySchema = z.string().regex(/^\d+,\d+$/)` en `@dnd-tactical/shared`, garantizando que únicamente se acepten coordenadas `"x,y"` con enteros no negativos.

6. **Autorización y Pertenencia de Sala**:
   - `handleUpdateBoard` verifica tanto el rol GM como que el participante pertenezca a la misma sala (`participant.roomCode === room.code`), evitando que un GM de otra sala pueda alterar el tablero.
   - Se identificó como deuda técnica preexistente del proyecto que varios otros comandos de sala aún no validan pertenencia estricta de sala (solo rol GM global), quedando registrado formalmente.

## 2. Archivos Modificados

- `packages/shared/src/schemas/commands/roomCommands.ts`: exportación de `boardCellKeySchema`, tipado de arrays con el schema y restricción de `cellSizeFeet: z.literal(5).optional()`.
- `apps/server/src/commands/roomCommands.ts`: normalización fija `cellSizeFeet: 5`, eliminación de auto-clamp y hardcoding de tamaño, verificación de footprint canónico con rechazo atómico, eliminación de jerarquía de capas (muros conservan impassable + LoE), verificación de pertenencia de sala.
- `apps/web/src/App.tsx`: aislamiento de `rulesSnapshot` autoritativo frente a `presentationRoom` de presentación, bloqueo de acciones durante edición, manejo de ciclo de vida con retención de borrador ante errores, comparador semántico de tableros.
- `tests/map-builder.test.mjs`: reescrito con 15 pruebas unitarias y de integración exhaustivas cubriendo todos los hallazgos y contratos.
- `tests-ui/map-builder.spec.ts`: pruebas Playwright agregadas para cancelación y retención de borrador ante rechazo del servidor.
- `docs/designs/map-builder-mvp/implementation-plan.md`, `PROJECT_STATUS.md`, `TODO.md`: documentación sincronizada eliminando referencias a auto-clamp y jerarquía de capas.

`test.txt` permanece intacto y sin seguimiento en Git.

## 3. Validación y Calidad

- `npm test`: 672/672 tests unitarios en verde (incluye los 15 tests de `map-builder.test.mjs`).
- `npm run typecheck`: 0 errores en todos los workspaces (`shared`, `web`, `server`).
- `npm run build`: compilación limpia y exitosa en todos los workspaces.
- `node scripts/e2e-websocket.mjs`: 107/107 pruebas de WebSocket aprobadas contra el servidor autoritativo.
- `npm run test:ui`: 13/13 tests de Playwright UI pasando al 100% (demo + map-builder + smoke tests).
- `git diff --check`: limpio, sin errores de espaciado ni conflictos.

## 4. Estado

Ready for Architecture Review.
