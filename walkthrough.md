# Walkthrough — Sprint 050.1 (Panel de Estados del GM, implementación)

## Objetivo

Implementar exactamente lo aprobado en `docs/designs/gm-condition-panel.md` e
`implementation_plan.md` (Sprint 050, diseño/auditoría): una superficie
administrativa para que el GM pueda ver, aplicar y remover ActiveEffects sobre
un combatiente, sin que la UI implemente ninguna regla de juego.

## Qué se reutilizó exactamente

`gm-apply-effect` no se tocó — ya era genérico, ya validaba GM, ya delegaba el
100% de la decisión de stacking a `EffectManager.add`/`severityChain` (Sprint
049). `EffectQueries.getByTarget` y `effectsCatalog` ya eran la única vía
autorizada para leer condiciones activas. No se reescribió ningún filtro ya
existente.

## Comando nuevo: `gm-remove-effect`

Único comando agregado, simétrico a `gm-apply-effect` pero remueve **por
`instanceId` exclusivamente** (nunca por `effectId`, que sería ambiguo con
múltiples instancias del mismo efecto, ni por `sourceId`, que no siempre está
poblado — ver auditoría en `docs/designs/gm-condition-panel.md`, §5).

- `packages/shared/src/types.ts`: nueva variante en `ClientCommand`.
- `packages/shared/src/schemas/commands/gmCommands.ts` + `index.ts`: `gmRemoveEffectSchema`, registrado en el mapa.
- `apps/server/src/commands/gmCommands.ts`: `handleGmRemoveEffect` — `requireGM`, busca la instancia exacta, rechaza si no existe, `EffectManager.removeMany`, un único log administrativo, `broadcast`. Cero ramas por `effectId`.
- `apps/server/src/commands/dispatcher.ts`: un solo `case` nuevo.

## UI: `GmPanel.tsx`

Nueva sección "Condiciones de {combatiente}" dentro del panel ya existente
(`Panel GM`), gateado por el mismo `participantRole === "gm"` que ya oculta
todo el resto del panel en `ActionsPanel.tsx` — sin permisos nuevos por
ownership de combatiente, tal como pedía el alcance.

- Listado: `EffectQueries.getByTarget(room, targetId)` + `effectsCatalog[instance.effectId]`, formateado por helpers puros nuevos en `viewModel.ts` (`getActiveEffectViews`, `formatEffectDuration`, `formatEffectSource`) — ninguno deriva reglas, solo relee campos ya existentes de `EffectInstance`/`EffectDefinition` para mostrarlos legibles. `instanceId` nunca se muestra como texto (solo se usa internamente para el comando de remoción).
- Selector de aplicación: `applicableEffectOptions` (`viewModel.ts`) — filtra `effectsCatalog` únicamente por ausencia del bloque `hazard` (13 de 15 entradas visibles; los 2 hazards de celda quedan fuera). Sin blacklist manual por ID: `__INFRASTRUCTURE_SAMPLE__` sigue siendo técnicamente seleccionable porque no hay ningún campo declarativo que lo distinga de una condición real, y excluirlo por nombre habría sido exactamente el patrón de blacklist que el alcance prohibía.
- Duraciones limitadas a los presets reales que el schema ya soporta: "Permanente" (omite `durationPreset`) y "Hasta fin de turno del objetivo" (`until_target_turn_end`). No se inventó ningún preset nuevo.
- La UI nunca anticipa el resultado de `onStack`: envía el `effectId` elegido y refleja el `room-update` que responde el servidor, igual que cualquier otro comando.

## Verificación de que el panel no implementa reglas

Auditoría estática antes del commit: cero ocurrencias de `effectId ===`,
`onStack`, `upgradeTo` o `severityChain` en ningún archivo tocado por este
sprint (handler, componentes, `viewModel.ts`). Verificado además mediante
tests reales que ejercitan los handlers dos y tres veces seguidas (reaplicar
Fatigued, reaplicar Prone, tercera fatiga contra un objetivo ya Exhausted) y
confirman que el resultado correcto emerge de `EffectManager`, no de ningún
código nuevo de este sprint.

## Tests

- `tests/gm-condition-panel.test.mjs` (nuevo, 11 casos): remoción por
  `instanceId` (rechazo no-GM sin mutación, instanceId inexistente rechazado,
  remoción no afecta otras instancias del mismo `effectId`, log administrativo
  único), onStack end-to-end vía los handlers reales (Fatigued→Exhausted,
  Prone duplicado ignorado, tercera fatiga redundante, remoción de un efecto
  generado automáticamente por el motor), y schema (`gm-remove-effect` válido,
  `instanceId` requerido, `effectId` inyectado nunca es autoridad).
- `scripts/e2e-websocket.mjs`: nuevo flujo de 5 aserciones — aplicar Fatigued,
  reaplicar y confirmar Exhausted (no dos Fatigued), no-GM rechazado al
  remover, remover por `instanceId` y confirmar ausencia, sala consistente.
- `tests-ui/smoke.spec.ts`: nuevo escenario Playwright que aplica y remueve una
  condición desde el Panel GM real (no bypass por WebSocket crudo, a
  diferencia de cómo se probó Entangled en Sprint 045 antes de que existiera
  esta UI).

## Documentación sincronizada

`PROJECT_STATUS.md`, `TODO.md`, `ROADMAP.md` (corregida la staleness que
todavía presentaba Blinded/Helpless/Exhausted como pendientes — ya cerrados en
047/048/049), `docs/testing/master-coverage.md`. Sin cambios en
`docs/rules/registry.md` (tooling administrativo, no regla de D&D — no abre
Rule ID) ni en `docs/technical-debt.md` (no apareció deuda nueva durante la
implementación).

## Validación (DoD completo, ejecutado de verdad)

| Comando | Resultado |
|---|---|
| `npm test` | ✅ **478/478**, 0 fallos (54 archivos) |
| `npm run typecheck` | ✅ 0 errores (3 workspaces) |
| `npm run build` | ✅ los 3 workspaces en verde (Vite compila 1660 módulos) |
| `node scripts/e2e-websocket.mjs` | ✅ **98/98** aserciones, exit 0 |
| `npm run test:ui` (Playwright) | ✅ **7/7** escenarios |

## Alcance explícitamente excluido (sin cambios)

Descanso/1h, Lesser Restoration, Restoration, clima, viajes, marcha forzada,
hambre/sed, conjuros, condiciones nuevas, edición manual de `duration`/
`source`/`stacks`, remoción por `effectId`, remoción masiva, categorías nuevas
de efectos, sistema de undo.

## Estado y próximo paso

Sprint 050.1 cerrado formalmente. El Panel de Estados del GM queda como base
reutilizable para cualquier condición oficial futura (conjuros, trampas,
efectos narrativos) sin lógica especial en la interfaz. Próximo sprint
funcional pendiente de nueva auditoría/recomendación.
