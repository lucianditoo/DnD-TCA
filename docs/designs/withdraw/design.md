# NDD — Retirada (Withdraw) · Rule ID: `MOVE-WITHDRAW` · Rev. 3 (contrato de economía corregido)

## 0. Estado

Fase 2/3 — diseño formal. **Pendiente de ✅ `Proceed`; cero código de producción ni tests modificados.** Esta revisión responde a la auditoría externa que detectó una afirmación falsa en la Rev. 2 sobre la economía de Carga; la Fase 1 de esta revisión re-verificó el contrato completo campo a campo. Fuente RAW: corpus `combat/05:196`, `combat/08:134`.

## 1. Corrección de la Rev. 2 (auditoría aceptada)

La Rev. 2 afirmaba que `handleCharge` consume "`usedStandardAction+usedMoveAction+usedFullAttack`". **Falso**: las asignaciones de `usedStandardAction`/`usedMoveAction` citadas (líneas 94-95) pertenecen a `handleTotalDefense`. `handleCharge` (líneas 109+) escribe únicamente `movementUsedFeet += distancia` y `usedFullAttack = true` (líneas 129-130). El error nació de un grep sin delimitar el cuerpo de la función. Todas las conclusiones que dependían de ese trío quedan re-derivadas abajo del contrato real.

## 2. Contrato real de economía de acciones (Fase 1, verificado siguiendo cada consumidor)

| Campo | Quién lo escribe | Quién lo consume | Qué bloquea | Invariante real |
|---|---|---|---|---|
| `usedStandardAction` | `attackCommands.ts:140,166` (primer ataque resuelto en modo "standard"); `abilityCommands.ts:33,76,126,358` (habilidades/conjuros); `handleTotalDefense` (`tacticalCommands.ts:94`); `stand-up`? no (usa move) | `canStandardAttack` (leído también por habilidades/conjuros, `abilityCommands.ts:25,53,148`, y Defensa Total); `canDisabledCombatantTakeAction`; UI (`ActionsPanel.tsx:219-220`) | Segunda acción ofensiva estándar, conjuros, Defensa Total | "La acción estándar del turno ya fue gastada" |
| `usedMoveAction` | `movementCommands.ts:252` (movimiento normal); `handleTotalDefense:95` | `canUseMoveAction`; `canUseFiveFootStep`; `canCharge`; `canDisabledCombatantTakeAction`; UI (botón ataque completo) | Segundo movimiento, paso de 5', Carga | "La acción de movimiento del turno ya fue gastada" |
| `usedFullAttack` | `attackCommands.ts:141,167` (primer ataque resuelto en modo "full"); **`handleCharge` (`tacticalCommands.ts:130`)** | `canUseMoveAction` ("Ya uso una accion de asalto completo"); `canStandardAttack`; `canFullAttack`; `canDisabledCombatantTakeAction` | Movimiento normal, cualquier acción ofensiva/conjuro posterior | **Marcador genérico de "acción de asalto completo consumida"** — no solo "hizo ataque completo" |
| `usedFiveFootStep` | `handleFiveFootStep` (`tacticalCommands.ts:226`) | `canUseFiveFootStep` (propio); `canCharge`; `handleTotalDefense` | Segundo paso de 5', Carga, Defensa Total | "El paso de 5' del turno ya fue usado" |
| `movementUsedFeet` | Movimiento normal, `handleFiveFootStep:227`, `handleCharge:129` | `canUseFiveFootStep` (`>0` bloquea); `canFullAttack` (`>5` bloquea); `canCharge` (`>0` bloquea); presupuesto restante del preview (`viewModel.ts:80`) | Paso de 5' tras cualquier movimiento; ataque completo tras mover >5; Carga tras mover | "Pies de movimiento ya consumidos este turno" |
| `attacksMade` | `attackCommands.ts:147,173` (+1 por ataque resuelto) | Gating de rutina (`attacksMade >= routine.length`); `canUseMoveAction` (`>1` = asalto completo en curso); `cancel-attack-mode` (`>0` bloquea cancelar); `canDisabledCombatantTakeAction` | Exceso de ataques; cancelación tardía; movimiento en plena rutina | "Ataques ya resueltos dentro del modo declarado" |
| `attackMode` | `declare-attack-mode`/`cancel-attack-mode` | `movementCommands.ts` (bloquea movimiento normal con modo preparado); resolución de ataques; UI | Movimiento con ataque preparado | "Intención ofensiva declarada del turno" |
| *(reset)* | `turnManager.ts:93` reinicia TODOS los campos al crear el turno | — | — | Economía es por-turno, sin arrastre |

## 3. Resolución de la contradicción (Fase 2)

1. **`usedFullAttack` representa "se consumió una acción de asalto completo"** — lo escriben tanto la rutina de ataque completo como la Carga. La dualidad del nombre es accidental-por-acreción, pero la semántica en los gates es consistente. **Deuda semántica registrada** (nombre engañoso), no bug.
2. **Charge queda correctamente bloqueada sin el trío** porque los gates leen `usedFullAttack` (`canUseMoveAction`, `canStandardAttack`, `canFullAttack`) y `movementUsedFeet` (`canUseFiveFootStep >0`, `canCharge >0`). Las asignaciones extra habrían sido redundantes.
3. Gates posteriores tras Charge, todos verificados: movimiento normal ❌ (`canUseMoveAction`/usedFullAttack), ataque estándar ❌ (`canStandardAttack`), paso de 5' ❌ (`movementUsedFeet>0`), otra táctica ❌ (Defensa Total vía `canStandardAttack`+chequeo propio; segunda Carga vía `canCharge`), conjuros ❌ (`abilityCommands.ts:25,53,148` sí llaman `canStandardAttack` — verificado, no hay brecha).
4. **Combinaciones ilegales post-Charge: ninguna encontrada** en los flujos auditados.
5. **Withdraw sigue el patrón vigente de Charge** (no una representación nueva): el motor ya tiene un marcador funcional de asalto completo y los gates lo honran en todas las rutas. Opción D (abstracción genérica) **rechazada**: no hay evidencia de que Withdraw sea inexpresable con los campos actuales — crearla sería complejidad especulativa.

## 4. Decisión arquitectónica (Fase 3, confirmada con el contrato real)

**A — sub-acción `withdraw` de `use-tactical-action`** (sin cambios respecto a Rev. 2 en la sede; corregida en la economía):

- **Precedente arquitectónico** (forma): Charge/Five-Foot-Step/Stand-Up/Total-Defense como sub-acciones del mismo comando discriminado.
- **Precedente de economía** (contrato): el de Charge **real** — ver mutaciones abajo.
- **Deuda preexistente delimitada** (no se corrige aquí): nombre engañoso de `usedFullAttack`; candidata a renombrarse (`usedFullRoundAction`) en un sprint de saneamiento propio. **Withdraw depende del significado del campo, no del nombre** — si se renombra, es un rename mecánico.

**Mutaciones mínimas de Withdraw normal**: `movementUsedFeet += distancia` + `usedFullAttack = true`. Nada más — los gates existentes bloquean todo lo posterior (misma malla verificada en §3.3). Pre-checks de entrada: `canDisabledCombatantTakeAction(room, c, "full-round")` implícito vía patrón, `attackMode === "none"`, `!usedStandardAction && !usedMoveAction && !usedFullAttack && !usedFiveFootStep && !usedTotalDefense`, `attacksMade === 0`, `movementUsedFeet === 0`.

**Withdraw limitado (Disabled)**: RAW "retirada limitada" = acción estándar a 1× velocidad. Mutaciones: `movementUsedFeet += distancia` + `usedStandardAction = true` (NO `usedFullAttack` — los Disabled tienen prohibido el asalto completo por `canDisabledCombatantTakeAction("full-round")`, verificado). Gate de entrada: `canDisabledCombatantTakeAction(room, c, "standard")`, cuyo invariante de acción única (`alreadyUsedAction`, verificado en código) bloquea todo lo posterior. Esfuerzo vía `applyDisabledExertion({ actionKind: "standard", actionWasExerting: true })` — patrón exacto de Defensa Total.

**Atomicidad y secuencia real (verificada en implementación)**: handler síncrono único — validar todo (economía, ruta, ocupación, exenciones) antes de mutar; las AdO se calculan sobre el snapshot **previo** al movimiento y se encolan como pendientes **después** de confirmar la transición completa (`commitSpatialTransition`), exactamente como `handleCharge`. **No existe interrupción a mitad de ruta en este comando**: la posición final es siempre el destino validado, y las AdO pendientes se resuelven a continuación con la tirada manual (semántica vigente del pipeline táctico — la corrección de esta frase respecto al borrador es deliberada: el documento describe el comportamiento real observado, no el del bucle de `move-combatant`). Economía consumida sin reembolso. **Estados imposibles**: prevenidos por los pre-checks de entrada más la malla de gates existente; cero campos nuevos en `TurnState`.

## 5. Contrato funcional restante (sin cambios desde Rev. 2, decisiones ratificadas)

Sub-acción declarativa con servidor autoritativo (el cliente solo envía `{ action: "withdraw", to, path? }`; presupuestos y exenciones los deriva el servidor); presupuesto máximo **2×** `totalSpeedFeet` (1× en rama Disabled) pasado como argumento explícito a `validateMovePath` (contrato vigente — five-foot-step ya le pasa `cellSizeFeet`); exención de AdO **exclusiva del disparo por abandonar la huella inicial completa** (`getCombatantOccupiedCells` + `footprintCellKey`; todas las celdas para Large+; sin dependencia de la ancla), vía parámetro opcional con default vacío en `findTriggeredOpportunityAttacksForPath` (`rules.ts:826`); resto del camino provoca normal con AOO-03/Reflejos de Combate intactos; independiente del orden del snapshot; terreno difícil/diagonales/esquinas/límites heredados sin segunda lógica de rutas; V1 rechaza Acrobacias y rutas a través de enemigos; **cero estado persistente de Withdraw**. Simplificaciones documentadas: exención pro-defensor ante invisibles (sin modelo de visión) y precondición de Cegado sin validar (pro-retirante) — deuda técnica explícita, sin falsa implementación parcial de visión. UI: botón táctico junto a Carga, preview con presupuesto ×2 (precedente `viewModel.ts:133`), errores por el canal vigente.

## 6. Design Review Checklist (delta de la Rev. 3)

- **Decisión más difícil de revertir**: (sin cambio) el parámetro de exención en `findTriggeredOpportunityAttacksForPath`. La decisión de economía es ahora *más* reversible: cero escrituras nuevas, solo campos existentes con su semántica vigente.
- **Complejidad accidental heredada**: la dualidad de `usedFullAttack` — se hereda conscientemente, delimitada como deuda, no se propaga (Withdraw no añade un tercer significado: usa el genérico ya establecido por Charge).
- **Regla de Tres / reutilización / impacto / fuera de alcance / migración / rollback**: como Rev. 2 §4 (sub-acciones futuras Run ×4 y movimiento doble ×2; cambio 100% aditivo; rollback = revertir variante+case+botón+parámetro).
- **Estrategia de tests**: los 22 casos W1-W22 de Rev. 2 §5 siguen vigentes; W13/W14 ahora fijan además las mutaciones exactas (`usedFullAttack`+`movementUsedFeet` y ausencia del trío), y W9 fija la rama Disabled con `usedStandardAction`.

## Plan de implementación aprobado

*(Sección auditable embebida: la convención vigente del repositorio ignora `implementation_plan.md` en Git — regla preexistente del `.gitignore`, no alterada. El plan completo vive también en ese archivo local; esta sección es la copia canónica visible desde GitHub.)*

1. **Verificaciones previas** (sin código): confirmar `canFullAttack` incluye el chequeo Disabled "full-round"; confirmar el enganche de `applyDisabledExertion` desde `tacticalCommands`.
2. **Tests primero** (rojo, `node --test` contra `dist/`): `tests/withdraw.test.mjs` W1-W20 (unitarios puros + integración servidor); W21 E2E WebSocket y W22 Playwright especificados para Windows.
3. **Shared**: variante `action: "withdraw"` en `types.ts` + esquema Zod (`schemas/commands/tacticalCommands.ts`); parámetro de exención en `findTriggeredOpportunityAttacksForPath`.
4. **Servidor**: `handleWithdraw` en `apps/server/src/commands/tacticalCommands.ts` (case + handler; pre-checks §4, presupuesto 2×/1×, `validateMovePath`, exención por huella inicial, mutaciones mínimas §4, patrón de atomicidad de `handleCharge`). **`movementCommands.ts` intocado.**
5. **UI**: botón "Retirarse" (`ActionsPanel.tsx`) + presupuesto ×2 del preview (`viewModel.ts`, patrón Carga).
6. **Criterios de aceptación**: W1-W20 verdes en sandbox; typecheck + `build:shared`/`build:server` verdes; `move-combatant` sin diff (W17 + suites `difficult-terrain`/`corners-geometry`); cero campos nuevos en `TurnState`/snapshot.
7. **Validación**: `npm run typecheck` · `npm test` · `npm run build` · `node scripts/e2e-websocket.mjs` · `npm run test:ui` (suite completa en Windows; subconjunto sandbox documentado).
8. **Rollback**: revertir variante de esquema, case, botón y parámetro (un call site); sin migraciones.
9. **Sincronización documental**: `RULES_PHB_CHECKLIST.md` (62/96), `docs/rules/registry.md` (`MOVE-WITHDRAW`), dashboard, `PROJECT_STATUS.md`, `TODO.md`, `walkthrough.md`, `.ai/PROJECT_MEMORY.md`, registro de la deuda semántica de `usedFullAttack`.

---

**Detención**: NDD corregido y auditable. A la espera de ✅ `Proceed`. Sin código, sin Run, sin Concealment.
