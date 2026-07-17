# NDD — Retirada (Withdraw) · Rule ID: `MOVE-WITHDRAW` · Rev. 2 (verificada contra código)

## 0. Estado y método

Fase 2/3 — diseño formal + plan (`implementation_plan.md`). **Pendiente de ✅ `Proceed`; cero código de producción ni tests modificados.** Deriva de `docs/designs/withdraw-analysis.md`, pero **cada afirmación fue re-verificada contra el código actual**; donde el código contradijo al análisis, manda el código (dos correcciones: §2 y §7). Fuente RAW: corpus `combat/05:196`, `combat/08:134`. Nota de proceso: `AGENTS.md` (listado en la instrucción) no existe en el repositorio.

## 1. Contrato funcional

Retirada = intención explícita del cliente, validada y resuelta por el servidor: acción de **asalto completo**, movimiento hasta **2× velocidad**, la **huella inicial** no provoca AdO al abandonarla, el resto de la ruta provoca normal. Excluye paso de 5', ataques y cualquier otra acción del turno. Rama RAW "retirada limitada": `lifeStatus === "disabled"` puede retirarse a **1×** consumiendo su única acción (con el esfuerzo `EFFORT-DISABLED` existente).

## 2. Decisión principal (corregida por evidencia de código)

**Elegida: sub-acción `withdraw` dentro del comando existente `use-tactical-action`** — ni comando top-level nuevo (A original) ni modo dentro de `move-combatant` (B, la recomendación preliminar) ni flag de turno (C).

Evidencia que decide: **todas** las acciones de movimiento especiales del motor ya viven como sub-acciones de `use-tactical-action` — `charge` (`tacticalCommands.ts:27,109`; consume `usedStandardAction+usedMoveAction` y `usedFullAttack=true`, líneas 94-95/130), `five-foot-step` (línea 29/217, con `canUseFiveFootStep` + `validateMovePath` con presupuesto explícito), `stand-up`, `total-defense`. La Retirada es exactamente esa familia: una acción con economía propia que *contiene* movimiento.

| Criterio | A2. Sub-acción de `use-tactical-action` (ELEGIDA) | B. Modo en `move-combatant` | C. Flag en estado del turno |
|---|---|---|---|
| Superficie de red | Cero comandos nuevos: una variante más del esquema discriminado existente | Campo nuevo en payload de movimiento | Comando de declaración + estado |
| Duplicación de pipeline | Nula-baja: reutiliza `validateMovePath` (presupuesto por parámetro, como five-foot-step) y `findTriggeredOpportunityAttacksForPath` (pura, `rules.ts:826`) | Nula, pero a costa de bifurcar el handler | Duplica flujo en dos fases |
| Atomicidad | Alta: handler propio valida todo y comete economía+posición+log en un solo paso (patrón `handleCharge`) | Débil: `canUseMoveAction` (gate de acción de movimiento) debe *bypassearse* condicionalmente — la Retirada no ES una acción de movimiento | Nula (estado intermedio entre comandos) |
| Trazabilidad | Log/red explícitos ("se retira") | Inferida del flag | Dispersa |
| Impacto UI | Un botón táctico más (patrón Carga); preview reutiliza el precedente exacto de `viewModel.ts:133` (`totalSpeedFeet * 2` para carga) | Toggle modal sobre el flujo de movimiento | Dos interacciones |
| Reversibilidad | Alta: borrar variante+handler+botón | Media (rama entretejida) | Baja |
| Compatibilidad Run/Charge/mov. doble | **Máxima**: Run y movimiento doble serán nuevas sub-acciones del mismo comando con presupuestos ×4/×2 — el patrón ya escala (Charge lo demuestra) | Multiplexor de modos con economías heterogéneas | — |
| Estados imposibles | Prevenidos por pre-checks del handler propio | Posibles (withdraw con estándar consumida exige rama defensiva) | Garantizados (flag huérfano, reconexión) |

**B se rechaza** con dos evidencias: (1) el gate `canUseMoveAction` del handler de movimiento es semánticamente el de *otra* acción; (2) el precedente real del repositorio para "movimiento con economía especial" es Charge-como-sub-acción, no un modo del comando de movimiento. `isAcrobatic` no es contraejemplo: modula la *ejecución* dentro de la misma economía, no la economía.

## 3. Resolución del contrato obligatorio

### 3.1. Economía de acciones
- **Pre-checks** (rechazo antes de cualquier mutación): turno activo y ownership (`requireCombatantControl`, patrón vigente); `attackMode === "none"`; `!usedStandardAction && !usedMoveAction && !usedFiveFootStep && !usedFullAttack`; `attacksMade === 0`; `movementUsedFeet === 0`.
- **Momento de consumo**: la economía se comete **una sola vez, al aceptar el comando**, tras validar ruta y calcular AdO — nunca paso a paso ni al "iniciar" (no existe un estado intermedio de red). Caso normal: `usedStandardAction = usedMoveAction = usedFullAttack = true` (mismo trío que Charge) + `movementUsedFeet`. Caso Disabled: presupuesto 1×, consume la acción única y dispara el esfuerzo existente.
- **Acción estándar o de movimiento ya consumida** → rechazo con error explícito (pre-check), sin estado parcial.
- **Interrupción a mitad de ruta** (AdO que mata/derriba al que se retira, mecánica vigente del pipeline): la economía **no se reembolsa** — la acción se gastó; idéntico al comportamiento del movimiento normal interrumpido. La posición final es la última legal alcanzada (regla vigente).
- **Post-exclusiones**: con el trío consumido, los gates existentes (`canUseFiveFootStep`, `canStandardAttack`, `canUseMoveAction`) rechazan cualquier acción posterior sin código nuevo (verificación puntual en plan, paso 1).

### 3.2. Ataques de oportunidad
- Se exime **exclusivamente** el disparo por abandonar la huella inicial. Mecanismo: `findTriggeredOpportunityAttacksForPath` (`rules.ts:826`, función pura compartida) acepta un argumento opcional — el conjunto de celdas de salida exentas (claves `footprintCellKey`) — con default vacío: **aditivo, cero impacto en los call sites existentes**.
- Casillas posteriores: disparo normal. `canMakeOpportunityAttack` (AOO-03: límite, Reflejos de Combate, DT-007) queda **intacto y en su sitio** — la exención filtra el *disparo*, jamás toca el *gating* del reactor.
- **Armas de alcance**: cubiertas por construcción — la amenaza del reactor se calcula con `deriveMeleeThreatSources`/geometrías dentro de la propia función (verificado: `rules.ts:826-845` computa reactores con `canProjectMeleeThreat` + geometría por footprints); un enemigo con lanza larga que amenaza la huella inicial desde 10 ft queda igualmente exento en ese disparo.
- **Determinismo**: el conjunto exento es un `Set` de claves de celda; la evaluación por reactor no depende del orden del snapshot (test W20).
- No se deshabilita nada globalmente: un solo parámetro, un solo disparo afectado.
- El cliente **no** envía qué AdO se suprimen ni multiplicadores: envía `{ action: "withdraw", to, path }`; el servidor deriva huella inicial, presupuesto y exenciones (§3.6).

### 3.3. Footprints multicelda
- "Huella inicial" := `getCombatantOccupiedCells(combatant, snapshot)` en la posición de origen — **todas** las celdas para Large+ (justificación: en este motor el footprint ES la posición; anclar la protección a una sola celda produciría AdO dependientes de la orientación del token, indefendible ante el manual). No se depende de la celda ancla.
- Salida parcial: los disparos cuyas celdas de salida pertenezcan al conjunto inicial quedan exentos; al abandonar celdas amenazadas fuera del conjunto, provocación normal.
- Helpers reutilizados: `getCombatantOccupiedCells`, `footprintCellKey`, geometrías existentes. Cero geometría nueva.

### 3.4. Presupuesto de movimiento
- `validateMovePath` **ya recibe el presupuesto como parámetro explícito** (verificado: five-foot-step le pasa `room.board.cellSizeFeet`, el movimiento normal le pasa `totalSpeedFeet`): la Retirada pasa `2 × Rules.totalSpeedFeet` (1× en rama Disabled). **Decisión: presupuesto explícito, no intención semántica** — es el contrato vigente y es exactamente lo que Run (×4/×3) y el movimiento doble (×2) reutilizarán. Cero segunda lógica de rutas: terreno difícil, diagonales 5/10, esquinas MOVE-05 y límites del tablero se heredan sin tocar nada.

### 3.5. Visión y condiciones no modeladas (simplificaciones V1, declaradas)
- **Invisibles/no percibidos** (RAW: conservan AdO contra la huella inicial): sin modelo de percepción, V1 exime a **todos** los reactores del disparo inicial. **Favorece al defensor** (el que se retira). Deuda técnica explícita, registrada aquí y en el cierre.
- **Cegado** (RAW: no puede retirarse): sin condición Blinded, la precondición no se valida en V1. **Favorece al que se retira**. Deuda vinculada al backlog de condiciones ("Falta" de `PROJECT_STATUS.md`).
- **Actividad limitada genérica** (Slow/Staggered futuros): no se modela; solo la rama concreta Disabled (que sí existe). Cuando exista el modelo, reutiliza la rama 1×.
- **Prohibido** introducir una visión parcial falsa (p. ej. "exento solo si el reactor ve al que se retira" con una heurística): la exención V1 es incondicional y honesta.

### 3.6. Red y autoridad
- Variante nueva del esquema Zod discriminado de `use-tactical-action` (mismo archivo que charge/five-foot-step): `{ action: "withdraw", to, path? }` — payload inválido rechazado en runtime por `validateClientCommand`, como los 43 comandos actuales.
- El servidor deriva TODO (presupuesto, huella, exenciones, economía). Cero campos persistentes nuevos: la intención muere con el comando; `TurnState` usa solo sus campos existentes; `CombatRulesSnapshot` intacto.

### 3.7. UI (contrato, sin implementar)
- Selección: botón "Retirarse" en el panel táctico junto a Carga/Defensa Total, visible solo con turno virgen (mismos pre-checks reflejados como disponibilidad — la regla vive en shared, la UI solo consulta).
- Diferenciación: modo de trazado de ruta idéntico al movimiento, con presupuesto `totalSpeedFeet × 2` — **precedente exacto ya en producción**: el preview de Carga usa `Rules.totalSpeedFeet(...) * 2` (`viewModel.ts:133`) con revalidación autoritativa del servidor.
- Presupuesto comunicado: contador de pies restantes del preview existente, alimentado por el mismo `validateMovePath`.
- Errores: los mensajes del handler viajan por el canal de errores vigente (patrón de todos los comandos).
- Autoridad: la UI nunca decide AdO, exenciones ni economía — solo pinta lo que `validateMovePath` y el snapshot digan.

## 4. Design Review Checklist

- **Decisión más difícil de revertir en 20 sprints**: el parámetro de celdas exentas en `findTriggeredOpportunityAttacksForPath` — es la nueva juntura por la que pasarán todas las futuras modulaciones de provocación por movimiento (Piruetas G-02, arrastrarse). Mitigación: opcional, default vacío, semántica mínima ("celdas cuya salida no dispara"). La sub-acción en sí es borrable.
- **Complejidad accidental heredada**: el bucle de ejecución de `handleMoveCombatant` (Acrobacias, atravesar enemigos, interrupciones) no se generaliza en este sprint; la Retirada V1 **prohíbe Acrobacias y rutas a través de enemigos** (rechazo con error), evitando extraer un ejecutor compartido prematuramente. Si Run lo vuelve a necesitar, la extracción se hará entonces con dos consumidores reales (Regla de Tres aplicada a refactors).
- **Infraestructura reutilizada**: `use-tactical-action` (esquema+dispatcher), `validateMovePath` con presupuesto paramétrico, `findTriggeredOpportunityAttacksForPath` + AOO-03, `getCombatantOccupiedCells`/`footprintCellKey`, `commitSpatialTransition`, economía `TurnState`, esfuerzo Disabled, preview ×2 de Carga.
- **Impacto por subsistema**: shared (`rules.ts` un parámetro; esquema una variante), servidor (`tacticalCommands.ts` un handler + un case en su switch interno), UI (un botón + presupuesto del preview), tests. Sin impacto: efectos, catálogos, Tick Layer, `end-turn`, snapshot, `move-combatant` (cero cambios → sin riesgo de regresión del movimiento normal).
- **Regla de Tres**: (1) Correr — sub-acción con presupuesto ×4/×3 + pérdida de Des + gate `FORBID_RUN` ya declarado; (2) movimiento doble bajo restricciones — sub-acción ×2 sin exención; (3) modulaciones de provocación por movimiento (Piruetas, arrastrarse) — mismo parámetro de exención.
- **Fuera de alcance**: visión/percepción, Blinded, Acrobacias durante retirada, atravesar enemigos, actividad limitada genérica, monturas, reembolso de economía en interrupciones, apuntado a partes de huellas.
- **Deuda técnica aceptada**: exención pro-defensor ante invisibles; precondición de Cegado sin validar; ambas registradas en §3.5 y en la sincronización de cierre.
- **Estrategia de migración**: no aplica — cambio 100% aditivo; ni datos persistidos, ni perfiles, ni snapshots cambian de forma.
- **Rollback conceptual**: eliminar la variante del esquema, el case del handler y el botón; el parámetro de exención queda inerte con default vacío (o se elimina — un solo call site nuevo). Sin datos que migrar de vuelta.

## 5. Estrategia de testing (diseño; NO se implementan aún)

| # | Caso | Tipo |
|---|---|---|
| W1 | Retirada válida a exactamente 2× velocidad (borde del presupuesto) | Unitario puro (shared, `dist/`) |
| W2 | Rechazo por exceder 2× | Unitario puro |
| W3 | Salida de huella inicial amenazada → 0 AdO | Unitario puro (parámetro de exención) + Integración servidor (handler) |
| W4 | Segunda casilla amenazada → AdO normal | Unitario puro + Integración servidor |
| W5 | Múltiples enemigos amenazando la huella inicial → todos exentos del disparo inicial | Unitario puro |
| W6 | Reactor con arma de alcance (longspear a 10 ft) → exento en disparo inicial, normal después | Unitario puro |
| W7 | Combat Reflexes: reactor con AdO disponibles solo aplica en casillas posteriores; contadores AOO-03 intactos | Integración servidor |
| W8 | Footprint Large 2×2: protección de las 4 celdas; provocación correcta al salir del conjunto | Unitario puro |
| W9 | Terreno difícil: coste doble contra presupuesto ×2, aceptación/rechazo en el borde | Unitario puro |
| W10 | Ruta bloqueada (muro/esquina MOVE-05) → rechazo heredado | Unitario puro |
| W11 | Diagonales 5/10 dentro del presupuesto | Unitario puro |
| W12 | Paso de 5' previo → rechazo; retirada previa → paso de 5' posterior rechazado | Integración servidor |
| W13 | Acción estándar previa → rechazo | Integración servidor |
| W14 | Acción de movimiento previa → rechazo | Integración servidor |
| W15 | Interrupción a mitad de camino → posición última legal, economía consumida sin reembolso | Integración servidor |
| W16 | Payload con Acrobacias/ruta a través de enemigo → rechazo V1 | Integración servidor |
| W17 | `move-combatant` normal sin regresiones (byte-idéntico) | Unitario puro + suites existentes (`difficult-terrain`, `corners-geometry`) |
| W18 | Payload inválido (tipos/campos) → rechazo Zod runtime | Integración servidor |
| W19 | Ownership: actor sin control del combatiente → rechazo | Integración servidor |
| W20 | Determinismo: orden del snapshot irrelevante | Unitario puro |
| W21 | Flujo completo retirada + turno siguiente (`end-turn`/Tick intactos) | E2E WebSocket (máquina Windows) |
| W22 | Botón visible solo con turno virgen; preview ×2; error visible | UI/Playwright (máquina Windows) |

## 6. Inventario de archivos y contratos

| Archivo | Cambio | Contrato |
|---|---|---|
| `packages/shared/src/types.ts` | Variante `action: "withdraw"` en `use-tactical-action` | Red (aditivo) |
| `packages/shared/src/schemas/commands/tacticalCommands.ts` (+`index.ts` si aplica) | Variante del esquema discriminado | Validación runtime |
| `packages/shared/src/rules.ts` | Parámetro opcional de celdas exentas en `findTriggeredOpportunityAttacksForPath` | Función pura (aditivo) |
| `apps/server/src/commands/tacticalCommands.ts` | `handleWithdraw` + case | Interno servidor |
| `apps/web/src/components/ActionsPanel/ActionsPanel.tsx` + `apps/web/src/viewModel.ts` | Botón + presupuesto ×2 del preview (patrón Carga, línea 133) | UI sin reglas |
| `tests/withdraw.test.mjs` (nuevo) | W1-W20 ejecutables en sandbox | — |
| **Sin cambios** | `move-combatant`/`movementCommands.ts`, `CombatRulesSnapshot`, `TurnState` (campos), efectos, catálogos, Tick Layer | — |

## 7. Corrección respecto a la Rev. 1 de este NDD

La Rev. 1 proponía un comando top-level `withdraw` con extracción del ejecutor de `movementCommands.ts`. La inspección del código real (charge/five-foot-step como sub-acciones; preview ×2 ya existente) demostró una sede más pequeña y consistente, y la prohibición V1 de Acrobacias/atravesar-enemigos elimina la necesidad del refactor del ejecutor en este sprint. Diff neto menor, cero riesgo sobre `move-combatant`.

---

**Detención**: NDD y plan listos. A la espera de ✅ `Proceed`. Sin código, sin Concealment, sin Run.
