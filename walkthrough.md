# Walkthrough — Cierre de Sprint 048 (Helpless Combat & Coup de Grace)

## Estado final

Al iniciar el gate de precondición del Sprint 049 (`EFFECT-EXHAUSTED`), el working tree **no estaba limpio**: 14 archivos con cambios sin commitear (código de producción, un test y documentación) más una carpeta `scratch/` sin versionar. El usuario confirmó que ese trabajo pendiente correspondía a Sprint 048 (Helpless Combat & Coup de Grace), ya diseñado en un commit previo (`337ebb9 docs(design): refine helpless combat transaction`). Este documento cierra ese trabajo: auditado, limpiado, validado con el DoD completo y comiteado de forma atómica.

## Auditoría del diff pendiente

Revisado archivo por archivo contra el alcance declarado (Helpless Combat + Coup de Grace):

- `apps/server/src/combat/attackResolver.ts` (+47): nueva `resolveAutomaticCritical` — daño base × multiplicador de crítico, con Ataque Furtivo plegado si aplica. Sin tirada de ataque (Coup de Grace RAW no requiere impactar).
- `apps/server/src/commands/dispatcher.ts` (+3): nuevo caso `resume-coup-de-grace`.
- `apps/server/src/commands/tacticalCommands.ts` (+~200): `handleCoupDeGrace` (validación de objetivo `HELPLESS`, inmunidad a críticos, alcance/adyacencia, provocación de AdO interrumpible), `handleResumeCoupDeGrace` (reanudación tras resolver AdO pendientes, con cancelación segura si el estado cambió), `_executeCoupDeGrace` (crítico automático + salvación de Fortaleza CD 10+daño o muerte instantánea).
- `packages/shared/src/rules.ts`: `isValidCoupDeGraceTarget` (trait `HELPLESS`, no objetivo muerto) y `getDefensiveAbilityProjection`, que **reemplaza** el parche ad-hoc de "diferencial de Destreza" que existía en `totalArmorClass` por un cálculo declarativo único (Destreza 0/-5 para `HELPLESS`, supresión para `NO_DEX_TO_AC`/Flat-Footed, normal en el resto) — sin introducir `if (effectId === ...)`.
- `packages/shared/src/types.ts`/`combatSnapshot.ts`/`demo-data.ts`: nuevo `PendingCoupDeGrace` en `CombatRoom`/`CombatRulesSnapshot`, clonado defensivamente, inicializado en `createEmptyRoom`.
- `packages/shared/src/schemas/commands/*`: Zod para `action: "coup-de-grace"` y el nuevo tipo de comando `resume-coup-de-grace`.
- `tests/dt-006-snapshot-integrity.test.mjs`: fixture extendida con `pendingCoupDeGrace: null`.
- `scripts/e2e-websocket.mjs`: ajuste de un caso previo de Blinded (Sprint 047) — el refactor de `getDefensiveAbilityProjection` unifica la supresión de Destreza para `HELPLESS`/`NO_DEX_TO_AC`, y este ajuste (d20Roll 20→15, reordenamiento del assert) es un efecto colateral esperado de tocar el mismo cálculo de CA que usa Blinded, no una ampliación de alcance.

**Conclusión de la auditoría**: todo el diff pertenece a Helpless Combat/Coup de Grace, con una única excepción menor (el ajuste del caso Blinded en el E2E) que es un efecto colateral directo y esperado de refactorizar código compartido (`totalArmorClass`), no scope creep.

## `scratch/` — revisado y eliminado

Contenía `patch_rules.mjs`, `patch_tacticalCommands.mjs` (scripts Node que aplicaron programáticamente los cambios de arriba — confirmado línea por línea que coinciden con el diff real) y `rules.old.ts` (backup pre-patch en UTF-16). Sin contenido único no aplicado. Eliminada la carpeta completa.

## Correcciones aplicadas

- **`git diff --check`**: 18 líneas con espacio en blanco al final corregidas en 4 archivos, cuidando de no tocar líneas preexistentes ajenas a este sprint (verificado comparando contra `HEAD` línea por línea antes de aceptar cada cambio).
- **`docs/rules/registry.md`**: nueva fila `MANEUVER-COUP-DE-GRACE` (Completo), con desglose de qué reutiliza (trait `HELPLESS` ya existente desde Sprint 014, sin catálogo nuevo) y qué es genuinamente nuevo. De paso, se corrigió una fila `EFFECT-BLINDED` duplicada y mal formada (fuera de la tabla, sin backticks, nombre de test truncado) que había quedado de un cierre anterior.
- **`docs/testing/master-coverage.md`**: entradas de Sprint 047 y 048 con números reales verificados.
- **`PROJECT_STATUS.md`/`TODO.md`**: reemplazadas las afirmaciones genéricas ("100% exitosas") por los números exactos de esta validación.
- **`docs/audits/combat-rules-deviations.md`**: revisado — Coup de Grace no introduce ninguna divergencia respecto del RAW (impacto automático sin tirada, crítico automático, salvación de Fortaleza CD 10+daño), no se modificó.

## Validación (DoD completo, ejecutado de verdad tras las correcciones)

| Comando | Resultado |
|---|---|
| `npm test` | ✅ **457/457**, 0 fallos |
| `npm run typecheck` | ✅ 0 errores (3 workspaces) |
| `npm run build` | ✅ los 3 workspaces en verde (Vite compila 1660 módulos) |
| `node scripts/e2e-websocket.mjs` | ✅ **93/93** aserciones, exit 0 |
| `npm run test:ui` (Playwright) | ✅ **6/6** escenarios |

## Archivos en el commit

`PROJECT_STATUS.md`, `TODO.md`, `docs/rules/registry.md`, `docs/testing/master-coverage.md`, `apps/server/src/combat/attackResolver.ts`, `apps/server/src/commands/dispatcher.ts`, `apps/server/src/commands/tacticalCommands.ts`, `packages/shared/src/combatSnapshot.ts`, `packages/shared/src/demo-data.ts`, `packages/shared/src/rules.ts`, `packages/shared/src/schemas/commands/index.ts`, `packages/shared/src/schemas/commands/tacticalCommands.ts`, `packages/shared/src/types.ts`, `scripts/e2e-websocket.mjs`, `tests/dt-006-snapshot-integrity.test.mjs`, `walkthrough.md`. `scratch/` eliminado (no versionado, no aparece en el commit).

## Estado y próximo paso

Sprint 048 cerrado formalmente. **No se inició Sprint 049** (`EFFECT-EXHAUSTED`) — queda pendiente de su propio gate de precondición y auditoría normativa, ahora sí sobre un working tree limpio.
