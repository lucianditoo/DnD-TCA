# Walkthrough — D-5R3 Remediación y Cierre Final de Arquitectura del Editor Táctico de Mapas (MVP)

Responsabilidad: Resumen del último cierre ejecutado, sus decisiones, validaciones y límites.
Autoridad: Registro rotativo
Lifecycle: Temporal (se reescribe en cada cierre)
Reemplaza: Walkthrough — D-5R2 Remediación Final de Arquitectura del Editor Táctico de Mapas (MVP)
Complementa: [Estado](PROJECT_STATUS.md), [Roadmap](ROADMAP.md), [NDD D-5 canónico](docs/designs/map-builder-mvp/design.md)
Consumidores: Architecture Reviewer, propietario y agentes que retoman el repositorio.

---

## 1. Veredicto de Architecture Review y Cierre Formal (D-5 MVP)

- **Commit revisado**: `6fd385b42b4dc51b8dcbb195108d7051a600944f`
- **Veredicto**: `TECHNICALLY APPROVED`
- **Estado**: **D-5 CLOSED**. No se requiere D-5R4.

## 2. Resultado y Remediaciones Ejecutadas (D-5R3)

Se cerraron de forma exhaustiva todos los hallazgos restantes de Architecture Review de D-5R2, conforme al NDD canónico (`docs/designs/map-builder-mvp/design.md`) y sin alterar reglas del Rule Engine ni tocar D-1B / I5R1 / I6:

1. **MAJOR 1 — Conservación Estricta de la Huella Comprimida de Combatientes (`srd_squeezing`)**:
   - En `apps/server/src/commands/roomCommands.ts`, `handleUpdateBoard` compara los conjuntos canónicos de celdas `(x, y, zFeet)` ocupadas por cada combatiente en el estado actual (`currentOccupied`) y en el snapshot candidato (`candidateOccupied`).
   - Para cualquier combatiente bajo `srd_squeezing`:
     - Se valida que `candidateOccupied.length === 2` (huella legal comprimida).
     - Se valida que el conjunto `candidateOccupied` sea exactamente idéntico al conjunto `currentOccupied`, celda por celda e independiente del orden.
     - Si cualquier celda varía (por ejemplo, si el nuevo tablero forzaría una orientación vertical en lugar de horizontal, o desplazaría la huella comprimida), `update-board` se rechaza atómicamente con mensaje descriptivo al GM:
       `"No se puede actualizar el mapa: el cambio alteraría la huella comprimida actual de <Nombre>. Reubícalo o resuelve Squeezing antes de editar el corredor."`
   - Sin mutar `squeezingAxis`, sin reubicar combatientes, sin remover efectos y con cero mutaciones previas al commit.
   - Verificado con tests unitarios específicos en `tests/map-builder.test.mjs` (rotación horizontal->vertical rechazada, colisión derivada rechazada, conservación aceptada).

2. **MAJOR 2 — Máquina de Estados Save / Error / ACK Robusta**:
   - En `apps/web/src/App.tsx`, al despachar `handleSaveBoard`:
     - Se limpian errores previos (`setError(null)`, `setMapEditorError(null)`).
     - Se guardan referencias del room en el momento del envío (`roomAtSaveRef.current = room`) y del borrador pendiente (`pendingSavedBoardRef.current`).
   - El `useEffect` de ACK exige dos condiciones conjuntamente para cerrar el editor:
     1. Que haya llegado una actualización de sala posterior al despacho (`room !== roomAtSaveRef.current`).
     2. Que el tablero en la sala recibida sea semánticamente equivalente al borrador enviado (`areBoardsSemanticallyEqual(room.board, pendingSavedBoardRef.current)`).
   - Se añadieron tests Playwright en `tests-ui/map-builder.spec.ts`:
     - "Retry after rejection": redimensionamiento inválido es rechazado por el servidor, la barra de herramientas y el borrador permanecen abiertos mostrando el error, el GM ajusta a un tamaño válido y guarda exitosamente, cerrándose la barra de herramientas.
     - "Multi-client broadcast isolation": un segundo cliente uniéndose a la sala provoca un `room-update` legítimo; el borrador del GM que está editando permanece completamente intacto.

3. **MINOR 1 — Gating del Modal de Confirmación Crítica Durante la Edición del Mapa**:
   - En `apps/web/src/App.tsx`, se condicionó el renderizado del overlay de confirmación crítica con `!isMapEditing`:
     `{!isDemoActive && !isMapEditing && threat && room.phase === "critical-confirmation" && (...)}`
   - Evita solapamientos visuales y el despacho de acciones de ataque mientras el GM trabaja en el diseño del tablero.

4. **MINOR 2 — Semántica de Métricas y Logs de Muros vs Pilares**:
   - En `apps/server/src/commands/roomCommands.ts` y `apps/web/src/components/MapEditor/MapEditorToolbar.tsx`:
     - Se definió el conteo de pilares como casillas con bloqueo exclusivo de Line of Effect: `pillarCount = lineOfEffectBlockingCells.filter(k => !impassableCells.has(k)).length`.
     - El log de auditoría del servidor y el contador de la barra de herramientas muestran con precisión muros (impassable + LoE) y pilares (LoE only).

5. **MINOR 3 — Cobertura E2E WebSocket para `update-board`**:
   - En `scripts/e2e-websocket.mjs`, se implementó el escenario E2E completo:
     - Un jugador no-GM envía `update-board` y es rechazado con error autoritativo.
     - El GM envía `update-board` con muros, pilares y escombros válidos (`cellSizeFeet: 5`).
     - El GM recibe la confirmación vía `room-update` con el tablero modificado.
     - El jugador conectado recibe el broadcast simultáneo con el tablero idéntico.
     - Sockets cerrados limpiamente. Todas las 110 verificaciones de WebSocket en verde.

---

## 2. Archivos Modificados

- `apps/server/src/commands/roomCommands.ts`: Comparación canónica de coordenadas de celdas para Squeezing; conteo semántico de pilares `loe-only`.
- `apps/web/src/App.tsx`: Limpieza de errores en guardado; ACK condicionado a `room !== roomAtSaveRef.current`; modal de confirmación crítica con guarda `!isMapEditing`.
- `apps/web/src/components/MapEditor/MapEditorToolbar.tsx`: Métrica de pilares corregida a `loe-only`.
- `scripts/e2e-websocket.mjs`: Test WebSocket E2E de `update-board` (rechazo a no-GM, aceptación a GM, broadcast a clientes).
- `tests/map-builder.test.mjs`: Tests unitarios de invariante estricta de Squeezing y métricas de pilares.
- `tests-ui/map-builder.spec.ts`: Tests Playwright de reintento exitoso tras error y aislamiento ante broadcasts de terceros.
- `docs/testing/master-coverage.md`: Actualización de baseline a D-5R3 (681 unit, 110 WS, 16 Playwright) y aclaración sobre `update-board`.
- `docs/designs/map-builder-mvp/implementation-plan.md`: Cierre formal D-5R3.
- `PROJECT_STATUS.md`: Actualización a D-5R3 en revisión.
- `TODO.md`: Actualización a D-5R3.

---

## 3. Validación y Calidad

- `npm test`: 681/681 tests unitarios en verde (28 suites, 0 fallos).
- `npm run typecheck`: 0 errores en todos los workspaces (`shared`, `web`, `server`).
- `npm run build`: compilación limpia y exitosa en todos los workspaces.
- `node scripts/e2e-websocket.mjs`: suite completa E2E WebSocket en verde (110/110).
- `npm run test:ui`: 16/16 tests Playwright UI pasando al 100% en verde.
