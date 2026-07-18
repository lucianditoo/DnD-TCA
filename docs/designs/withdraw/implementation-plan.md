# Plan de Implementación — Sprint MOVE-WITHDRAW (Retirada) · Rev. 2

> **Nota de migración (Sprint 040, Lote A)**: este archivo vivía en la raíz del repo como `implementation_plan.md` (gitignored). Tras la corrección de política de `docs/designs/document-architecture-cleanup.md` §1, se versiona y se co-ubica aquí junto a `design.md` y `analysis.md`. El contenido original no se alteró, solo la ruta de este archivo y la referencia relativa al NDD (línea siguiente).

## Estado

Fase 3 — plan técnico pendiente de aprobación formal ✅ `Proceed` **específica para este sprint**. No modificar archivos `.ts`, `.tsx`, `.json` ni tests antes de esa autorización. NDD: `docs/designs/withdraw/design.md` (Rev. 2 al momento de este plan; el NDD avanzó a Rev. 3 antes de la implementación final).

**Nota de gobernanza**: el plan anterior de este archivo (Sprint 038 — Full Attack V2) está preservado íntegro en `docs/designs/full-attack-v2-implementation-plan.md`; el Sprint 038 sigue en su propio gate, sin cambios de estado.

## Objetivo operativo

Sub-acción `withdraw` de `use-tactical-action` (NDD §2 — el precedente real es Charge como sub-acción, verificado en `tacticalCommands.ts:27,109`): asalto completo, presupuesto 2× (1× en rama Disabled con esfuerzo existente), huella inicial exenta del disparo de AdO, resto de la ruta provoca normal. Cero estado nuevo, cero cambios en `CombatRulesSnapshot` ni en `move-combatant`.

## Estrategia TDD y orden de modificación

### 1. Verificaciones previas (sin cambios de código)
1. Confirmar que los gates existentes (`canUseFiveFootStep`, `canStandardAttack`, `canUseMoveAction`) rechazan acciones posteriores con el trío `usedStandardAction+usedMoveAction+usedFullAttack` consumido (como hace Charge). Si alguno no, anotar ajuste mínimo para el paso 5.
2. Confirmar el enganche del esfuerzo Disabled para acciones disparadas desde `tacticalCommands`.

### 2. Tests primero (rojo contra `dist/` actual)
`tests/withdraw.test.mjs` con W1-W20 del NDD §5 (unitarios puros + integración servidor ejecutable en sandbox); W21 (E2E WebSocket) y W22 (Playwright) quedan especificados para la máquina Windows. Fixtures reutilizados: `test-utils.mjs`.

### 3. Contratos compartidos
1. `packages/shared/src/types.ts`: variante `action: "withdraw"` (con `to`, `path?`) en la unión de `use-tactical-action`.
2. `packages/shared/src/schemas/commands/tacticalCommands.ts` (+ registro si aplica): variante del esquema discriminado.
3. `packages/shared/src/rules.ts`: parámetro opcional de celdas de salida exentas (default vacío) en `findTriggeredOpportunityAttacksForPath` — aditivo, call sites existentes intactos.

### 4. Servidor
`apps/server/src/commands/tacticalCommands.ts`: case + `handleWithdraw` — pre-checks (NDD §3.1), presupuesto 2×/1×, `validateMovePath` con presupuesto explícito (contrato vigente, verificado en five-foot-step), rechazo V1 de Acrobacias/atravesar enemigos, huella inicial (`getCombatantOccupiedCells`+`footprintCellKey`), AdO con conjunto exento, commit atómico de economía+posición+log. **Sin tocar `movementCommands.ts`** (decisión Rev. 2: sin extracción de ejecutor — ver NDD §4 "complejidad accidental").

### 5. Ajustes de compatibilidad
Solo si 1.1 lo exige.

### 6. UI (sin lógica de reglas)
`ActionsPanel.tsx`: botón "Retirarse" (disponibilidad = pre-checks vía shared); `viewModel.ts`: preview con presupuesto ×2 (patrón exacto de Carga, `viewModel.ts:133`).

### 7. Validación (comandos) y cierre
1. `npm run typecheck` · `npm test` · `npm run build` · `node scripts/e2e-websocket.mjs` · `npm run test:ui` — suite completa en Windows; en sandbox, subconjunto `node --test` contra `dist/` + typecheck + `build:shared`/`build:server` (limitación de binarios documentada).
2. Sincronizar: `RULES_PHB_CHECKLIST.md` (Retirada → `[x]`, 62/96), `docs/rules/registry.md` (`MOVE-WITHDRAW`), dashboard, `PROJECT_STATUS.md`, `TODO.md`, `walkthrough.md`, `.ai/PROJECT_MEMORY.md`, deuda de visión (NDD §3.5) anotada.

## Criterios de aceptación

W1-W20 en verde (sandbox) + typecheck/builds tsc en verde; W21-W22 en Windows; `move-combatant` sin diff de comportamiento (W17 + suites `difficult-terrain`/`corners-geometry`); cero campos nuevos en `TurnState`/snapshot; documentación sincronizada.

## Riesgos y gates

| Riesgo | Gate |
|---|---|
| Exención de AdO más amplia que la huella inicial | W3-W6 fijan disparo inicial exento y posteriores normales |
| Ruptura de límites AOO-03/Reflejos de Combate | W7 + `tests/aoo-limit-regression.test.mjs` en verde |
| Economía parcial o explotable | W12-W15 (pre-checks, sin reembolso, atomicidad) |
| Regresión del movimiento normal | `move-combatant` intocado + W17 |
| Payload malicioso / autoridad | W18-W19 (Zod runtime + ownership); el cliente nunca envía presupuestos ni exenciones |

## Rollback

Cambio 100% aditivo: revertir la variante del esquema, el case del handler, el botón y (opcionalmente) el parámetro de exención — un solo call site nuevo. Sin migraciones de datos en ningún sentido.

## Criterio de detención

Con NDD y plan sincronizados, detener y esperar ✅ `Proceed`. No se autoriza ningún cambio de código o tests.
