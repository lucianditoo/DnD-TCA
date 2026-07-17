# NDD — Retirada (Withdraw) · Rule ID: `MOVE-WITHDRAW`

## 0. Estado

Fase 2/3 — diseño formal derivado de `docs/designs/withdraw-analysis.md`. **Pendiente de ✅ `Proceed`. Ningún código de producción se modifica con este documento.** Fuente normativa: PHB 3.5 (corpus `combat/05:196`, `combat/08:134`).

## 1. Contrato funcional

La Retirada es una **intención explícita y autoritativa de movimiento**: el cliente la declara, el servidor la valida y resuelve por completo. Efectos RAW:

1. **Acción de asalto completo**; movimiento hasta **2× velocidad**.
2. La **huella inicial** no se considera amenazada: salir de ella no provoca AdO.
3. Salir de cualquier **otra** casilla amenazada durante la ruta provoca AdO **normalmente** (con límites AOO-03 vigentes).
4. Sin **paso de 5'** en el mismo asalto; incompatible con cualquier otro movimiento/ataque del turno.
5. Personaje limitado a una sola acción (hoy: `lifeStatus === "disabled"`): puede retirarse como **acción estándar a 1× velocidad** (RAW "retirada limitada"), disparando la economía de esfuerzo de Disabled ya existente (`EFFORT-DISABLED`).

## 2. Decisión de sede: comando dedicado `withdraw`

**El análisis pasivo recomendaba preliminarmente el modo semántico en `move-combatant`; este NDD revierte esa recomendación con justificación** (el gate exigía no asumirla por el precedente `isAcrobatic`):

### 2.1. Alternativas comparadas

| Criterio | A. Comando `withdraw` dedicado (ELEGIDA) | B. Modo semántico en `move-combatant` | C. Flag transitorio del turno (declarar → mover) |
|---|---|---|---|
| Ventajas | Economía de asalto completo autocontenida y atómica; discriminación Zod gratuita; log/red explícitos; rama Disabled (estándar 1×) expresable sin contaminar el handler de movimiento normal | Diff de red mínimo; reutilización literal del handler | Ninguna neta |
| Acoplamiento | Bajo: consume los mismos bloques puros (`validateMovePath`, `findTriggeredOpportunityAttacksForPath`, `commitSpatialTransition`) vía un ejecutor compartido extraído | Alto: el handler de `move-combatant` debe *bypassear condicionalmente su propio gate* (`canUseMoveAction` no aplica a una acción de asalto completo) y multiplicar su matriz de interacción (`isAcrobatic` × `attackMode` × withdraw) | Altísimo: estado intermedio en `currentTurn` |
| Reversibilidad | Alta: borrar comando+handler; cero campos en estado | Media: la rama condicional queda entretejida | Baja: flag persistente y protocolo de dos pasos |
| Estados imposibles | Prevenidos por construcción (pre-checks del handler propio) | Posibles (withdraw declarado con estándar ya usada debe rechazarse por rama) | Garantizados (flag activo sin movimiento, expiración, reconexión) |
| Impacto en Run/Charge/mov. doble futuros | **Precedente decisivo**: el motor YA modela acciones de movimiento especiales como comandos dedicados — `charge`, `five-foot-step`, `total-defense`. Run y movimiento doble seguirán el mismo patrón con el mismo ejecutor compartido | Convertiría `move-combatant` en un multiplexor de modos con economías heterogéneas | — |

**C se descarta** de plano (estados imposibles, red de dos fases). **B se descarta** porque la Retirada NO es una acción de movimiento — es de asalto completo — y forzarla dentro del handler de la acción de movimiento invierte la semántica de su propio gate. El precedente relevante no es `isAcrobatic` (que modula *cómo* se mueve dentro de la misma economía) sino `charge` (que cambia *qué acción es*): las intenciones que alteran la economía del turno son comandos; las que modulan la ejecución son flags.

### 2.2. Mitigación del riesgo de duplicación (obligatoria)

El bucle de ejecución de pasos de `handleMoveCombatant` (proyección de huella, celdas ocupadas por enemigos, Acrobacias, interrupción, commit) se **extrae a un ejecutor interno compartido** dentro de `movementCommands.ts`, consumido por ambos handlers. Prohibido copiar el bucle. V1: la combinación `withdraw` + Acrobacias se rechaza (fuera de alcance; el ejecutor la recibe parametrizada).

## 3. Resolución explícita de los puntos del contrato

### 3.1. Economía de acciones
- Pre-checks del handler: turno activo del combatiente; `attackMode === "none"`; `!usedStandardAction && !usedMoveAction && !usedFiveFootStep`; `attacksMade === 0`; `movementUsedFeet === 0`.
- Consumo (caso normal): `usedStandardAction = true`, `usedMoveAction = true`, `movementUsedFeet = coste` — el asalto queda íntegramente consumido; el gate existente de `five-foot-step` (a verificar en plan, paso 1) debe rechazar el paso posterior.
- **Disabled (0 PG)**: presupuesto 1×, consume solo la acción única permitida y pasa por la ruta de esfuerzo existente (`lifeStatusEffects`) — 1 punto de daño por acción extenuante, sin código nuevo de vida.
- **Slow/Staggered futuros**: cuando exista "actividad limitada" genérica, reutilizan la misma rama 1× (Regla de Tres, §5).
- Interrupción a mitad de ruta (regla vigente del ejecutor): la economía consumida **no se reembolsa** (decisión: la acción se gastó; consistente con el comportamiento actual de movimiento interrumpido).

### 3.2. Ataques de oportunidad
- **Distinción central**: NO se suprime "toda generación de AdO durante la retirada"; se exime únicamente el disparo por **abandonar la huella inicial**. Implementación pura: `findTriggeredOpportunityAttacksForPath` (`rules.ts:826`) gana un parámetro opcional — un conjunto de celdas de salida exentas — con default vacío (aditivo, cero impacto en llamadas existentes).
- Múltiples enemigos amenazando la huella inicial: todos exentos para ese disparo (la protección es de la casilla, no por-enemigo).
- Casillas posteriores: disparo normal, gating `canMakeOpportunityAttack` (AOO-03) intacto.
- **Invisibles/no percibidos**: RAW los preserva; sin modelo de visión, V1 exime a todos los enemigos (simplificación pro-defensor, deuda documentada). Cegado como precondición de rechazo: diferido con la condición Blinded.

### 3.3. Footprints
- "Huella inicial" := `getCombatantOccupiedCells` del combatiente en su posición de origen (para Large/Huge: todas sus celdas). Justificación: en este motor el footprint ES la posición; proteger solo la ancla crearía AdO asimétricos según orientación.
- Salida parcial: mientras las celdas que se abandonan pertenezcan al conjunto inicial, el disparo está exento; en cuanto el paso abandona una celda amenazada NO perteneciente al conjunto inicial, provoca normal.
- Reutilización total: `getCombatantOccupiedCells`, geometrías de footprint, `footprintCellKey` para el conjunto.

### 3.4. Movimiento
- `validateMovePath` se reutiliza con presupuesto `2 × Rules.totalSpeedFeet` (o `1 ×` en la rama Disabled) **pasado como argumento** — la función ya recibe el presupuesto por parámetro; cero cambios en ella. Terreno difícil (coste doble), diagonales 5/10, esquinas (MOVE-05), límites del tablero y rutas bloqueadas se heredan sin código.
- Distancias ≤ presupuesto: válidas (no hay mínimo).
- Prohibiciones: incompatible con paso de 5' (pre-check + gate posterior), con `attackMode` preparado y con movimiento previo del turno (pre-checks §3.1). Correr/cargar no interactúan (comandos separados con sus propios gates).

### 3.5. Estado y red
- **Cero flags persistentes**: la intención vive solo en el comando; el consumo se expresa con los campos de economía **ya existentes** en `TurnState`. `CombatRulesSnapshot` permanece pasivo e intacto.
- Payload validado por el esquema Zod oficial: nuevo `withdrawSchema` (`{ type: "withdraw", roomCode, actorId, combatantId, to, path }`) registrado en `schemas/commands/index.ts` — payload inválido rechazado en runtime como los 43 comandos existentes.
- El cliente expresa intención; el servidor valida economía, ruta, AdO y commit — única autoridad.

## 4. Respuestas al Design Review Checklist

- **Filtro de Irreversibilidad (20 sprints)**: las dos decisiones duraderas son (a) el parámetro de exención en `findTriggeredOpportunityAttacksForPath` — aditivo con default, reversible; y (b) el ejecutor de movimiento compartido — refactor interno de un solo archivo que *reduce* irreversibilidad futura (Run/mov. doble lo necesitarán igual). Sin campos nuevos en estado ni snapshot.
- **Matriz de Reutilización**: `validateMovePath` (presupuesto parametrizado), `findTriggeredOpportunityAttacksForPath` + AOO-03, `getCombatantOccupiedCells`/`footprintCellKey`, `commitSpatialTransition`, economía `TurnState`, `lifeStatusEffects` (esfuerzo Disabled), patrón de comandos dedicados (`charge`).
- **Complejidad Accidental**: cero entidades nuevas, cero estado, un comando, un parámetro opcional puro, un refactor de extracción.
- **Matriz de Impacto por Subsistema**: shared (`rules.ts` parámetro de exención; esquema Zod), servidor (`movementCommands.ts` handler + ejecutor extraído; `dispatcher.ts` un case), UI (`ActionsPanel` botón + preview de presupuesto ×2 — el resaltado hereda de `validateMovePath` como en Sprint 037), tests. Sin impacto: efectos, catálogos, Tick Layer, `end-turn`.
- **Alternativas descartadas**: §2.1.
- **Regla de Tres**: (1) **Correr** — mismo comando-patrón con presupuesto ×4/×3, pérdida de Des a la CA y gate `FORBID_RUN` ya declarado; (2) **movimiento doble bajo restricciones** — presupuesto ×2 sin exención de AdO, mismo ejecutor; (3) **acciones de movimiento semánticas que alteran la provocación** (arrastrarse, futuros modos con Piruetas G-02) — mismo parámetro de exención/modulación de disparo.
- **Qué NO resuelve**: visión/invisibilidad (exención pro-defensor V1), precondición de Cegado, Acrobacias durante retirada, actividad limitada genérica (solo la rama Disabled concreta), monturas, modos de movimiento alternativos, reembolso de economía en interrupciones.

## 5. Estrategia de pruebas (diseño; no se escriben aún)

| # | Caso | Aserción |
|---|---|---|
| W1 | Retirada válida hasta 2× velocidad | Ruta de coste ≤ 2× aceptada; `movementUsedFeet` correcto |
| W2 | Huella inicial amenazada por enemigo adyacente | 0 AdO al salir |
| W3 | Casilla posterior amenazada (segundo enemigo en la ruta) | AdO normal, con gating AOO-03 |
| W4 | Múltiples enemigos amenazando la huella inicial | Todos exentos en el disparo inicial; los de ruta posterior no |
| W5 | Footprint Large 2×2 | Protección de las 4 celdas iniciales; provocación correcta al abandonar celdas amenazadas no-iniciales |
| W6 | Terreno difícil en ruta | Coste doble contra presupuesto ×2; aceptación/rechazo en el borde exacto |
| W7 | Ruta que excede 2× velocidad | Rechazo transaccional sin efectos parciales |
| W8 | Paso de 5' + retirada (ambos órdenes) | Rechazo en ambos sentidos |
| W9 | Personaje Disabled | Presupuesto 1×, consume la acción única, daño de esfuerzo aplicado |
| W10 | Limitado a acción estándar (cuando exista el modelo) | Diferido — documentado, sin test V1 |
| W11 | `end-turn` y Tick Layer | Sin cambios de comportamiento tras una retirada |
| W12 | `move-combatant` normal | Comportamiento byte-idéntico al previo (regresión del refactor del ejecutor) |
| W13 | Payload inválido (`to` ausente, tipos erróneos) | Rechazado por validación Zod runtime |
| W14 | Determinismo | Orden de combatientes en snapshot irrelevante |

## 6. Inventario exacto de archivos y contratos

| Archivo | Cambio | Contrato afectado |
|---|---|---|
| `packages/shared/src/types.ts` | Variante `withdraw` en la unión `ClientCommand` | Red (aditivo) |
| `packages/shared/src/schemas/commands/` (+`index.ts`) | `withdrawSchema` nuevo | Validación runtime (aditivo) |
| `packages/shared/src/rules.ts` | Parámetro opcional de celdas de salida exentas en `findTriggeredOpportunityAttacksForPath` | Función pura (aditivo, default vacío) |
| `apps/server/src/commands/movementCommands.ts` | Extracción del ejecutor compartido + `handleWithdraw` | Interno del servidor |
| `apps/server/src/commands/dispatcher.ts` | Un `case` | Interno |
| `apps/web/src/components/ActionsPanel/ActionsPanel.tsx` + `viewModel.ts` | Botón Retirada + preview con presupuesto ×2 | UI (sin lógica de reglas: consume `validateMovePath`) |
| `tests/withdraw.test.mjs` (nuevo) | W1-W14 | — |
| Sin cambios | `CombatRulesSnapshot`, `TurnState` (campos), efectos, catálogos, Tick Layer, `end-turn` | — |

## 7. Actualizaciones documentales previstas al cierre

`RULES_PHB_CHECKLIST.md` (fila Retirada → `[x]`, 62/96), `docs/rules/registry.md` (fila `MOVE-WITHDRAW`), dashboard, `PROJECT_STATUS.md`/`TODO.md`/`walkthrough.md`/`.ai/PROJECT_MEMORY.md`, y nota en `combat-rules-deviations.md` si la simplificación de visibilidad merece fila propia.

---

**Detención**: NDD completo junto a su `implementation_plan.md`. A la espera de ✅ `Proceed`. Sin código, sin Concealment.
