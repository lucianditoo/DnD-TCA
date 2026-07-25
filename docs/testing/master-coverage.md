# Master Testing Coverage

> **Responsabilidad canónica:** evidencia global de pruebas automatizadas. No
> representa cobertura normativa completa del PHB ni reemplaza los checklists
> temáticos. Los estados oficiales de reglas viven en
> [`../rules/registry.md`](../rules/registry.md).

Este documento consolida las directrices y el reporte de cobertura de testing
del motor de combate D&D 3.5.

## Cobertura E2E (WebSocket)
Los scripts E2E (ej. `scripts/e2e-websocket.mjs`) actúan como la prueba de integración canónica del motor, emulando a clientes conectados que envían comandos tácticos.

Reglas cubiertas obligatoriamente en E2E:
- Setup inicial de sala y combatientes.
- Flujo de iniciativa.
- Sincronización de fases (`preparation` -> `active`).
- Resolución de Ataque Completo (`ATTACK-FULL`).
- Validación de Movimiento (`MOVE-BASIC`, `MOVE-5FT`).
- Ataques de Oportunidad y Flanqueo.
- Condiciones V1 y Esfuerzo (ej. `EFFORT-DISABLED`).
- Ataques de toque autoritativos: el cliente solo envía `abilityId`; Ray of Frost conserva DEX/desvío y omite armadura, escudo y armadura natural.
- Lanzamientos con salvación automática: el servidor deriva DC/tipo, reduce o niega el resultado y gasta el slot en el mismo `room-update`.
- Huellas Large: spawn 2×2 y rechazo autoritativo de movimiento ante solapamiento parcial.
- Diehard/Prone Eschewal: estabilización en negativos, conservación de turno, Stand Up por 0 pies sin AdO y ausencia de sangrado en la ronda siguiente.
- Entangled Core: fuente declarativa en snapshot, velocidad efectiva 30→15 y bloqueos autoritativos de Run/Charge.
- EFFECT-BLINDED (Core): fuente de Total Concealment perspectivo, pérdida de DEX a CA, -2 AC y mitigaciones mecánicas estáticas validada en Snapshot.
- DEFENSE-CONCEALMENT: el esquema WebSocket rechaza porcentaje o d100 suministrados por el cliente; los recorridos productivos sin fuentes conservan assessment `none` y el servidor mantiene autoridad exclusiva.
- DEFENSE-LINE-OF-EFFECT (Parcial): camino positivo (Line of Effect presente, tablero sin obstáculos) confirmado vía WebSocket. El camino de rechazo (Cobertura Total por `lineOfEffectBlockingCells`) **no** es representable en este E2E porque no existe comando ni editor para fijar el tablero de una sala viva; se cubre con integración directa de servidor en `tests/line-of-effect-server.test.mjs` (ver Sprint 052B abajo).
- DEFENSE-VISION (Parcial, Sprints 053B/053B.2): targeting directo rechazado para un atacante Cegado con `targetId` legado (Ocultación Total exige elegir casilla), y el mismo ataque resuelto vía `target: {kind:"square"}` con **proyección segura** — el log público del ataque por casilla es genérico ("ataca a una casilla… El ataque falla/impacta.") y se verifica la ausencia de cualquier log con d20/CA/d100 (Sprint 053B.2, Anti-Metagaming).
- DEFENSE-COVER/DEFENSE-LINE-OF-EFFECT/DEFENSE-CONCEALMENT (Sprint 055B): el escenario Blinded existente sigue en verde sin cambios (la legalidad de AdO se cubre por unitarios/integración de servidor — ver más abajo, sin un caso E2E dedicado nuevo en este sprint).

Último cierre validado (Sprint 055B): **100/100** verificaciones WebSocket.

## Cobertura Unitaria
Los test unitarios (ej. `tests/*.test.mjs`) evalúan casos límite aislados sin necesidad del servidor WS.

Reglas cubiertas obligatoriamente:
- Aritmética de ataques y dados (`critical-hits.test.mjs`).
- Mutaciones de vida puras (`disabled-rules.test.mjs`).
- Validación estricta de condiciones.
- Migración V0/V1→V2, cuarentena de perfiles opacos, derivación completa de las tres CA y rechazo de overrides de red.
- Amenaza derivada, oposición N/S y E/O, exclusión N/E, `NO_THREAT` frente a `CANNOT_MAKE_AOO`, daga arrojadiza y separación melee/ranged.
- `half` con redondeo hacia abajo, `negates`, 1/20 natural, inmunidad a mutaciones parciales y derivación de slots preparados.
- derivación determinista Large/Huge, colisión parcial, flanqueo por caras opuestas y celdas abandonadas que provocan AdO.
- proyección vital, normalización inmediata, economía Disabled en negativos, umbral fatal y perfil declarativo de Stand Up.

Último cierre validado (Sprint 025-R): **290/290** pruebas.

Sprint 030 eleva la cobertura a **303/303** pruebas e incorpora vínculo estricto de Presa, fórmulas de escape, mutación transaccional, restricción de armas y rechazo de payloads manipulados.

**Sprint 042.5 (Recuperación de Baseline, 2026-07-18)**: primera vez que la suite completa corre de verdad en esta máquina Windows sin bloqueos ambientales. Baseline recuperado a **430/430 pruebas, 0 fallos** (52 archivos de test). Se investigaron y corrigieron por causa raíz los 9 fallos previos (429 total, 420 pass, 7 casos reales): un bug real de producción en `cloneEffectInstances` (`targetCells` no propagado, ver DT-021) que dejaba inoperantes los hazards ambientales, un test de Sprint 011 (Ray of Frost) desactualizado frente a la regla posterior `ATK-RANGED-INTO-MELEE`, y un regex mal escrito en el test W22 de Retirada. `tests/dt-006-snapshot-integrity.test.mjs` se amplió con un caso de comportamiento (no de implementación) que detecta cualquier campo futuro no propagado por un clon de `EffectInstance`.

**Sprint 045**: **440/440 pruebas, 0 fallos** (53 archivos). `entangled-condition.test.mjs` cubre ataque, DEX, CA/Reflejos derivados, velocidades 30→15/20→10/15→7, stacking/deduplicación, armadura, terreno, Run, Charge, paso de 5 pies y snapshot. WebSocket asciende a **91/91** y Playwright a **6/6**.

**Sprint 046**: **450/450 pruebas, 0 fallos**. `concealment-core.test.mjs` cubre perspectivas atacante/objetivo, 20%/50%, partial/total, deduplicación y precedencia por `stackingKey`, trazas deterministas, validación de contratos, orden CA→d100, 20 natural, ausencia de segunda tirada en crítico, supresión de daño/consecuencias y bloqueo de Sneak Attack aun con d100 exitoso. No se crea una fuente productiva ni un API de test en red.

**Sprint 047**: `blinded-core.test.mjs` (6 casos) cubre `srd_blinded`: -2 AC, pérdida de Destreza, velocidad ×1/2 (stacking seguro con Entangled), `FORBID_RUN`/`FORBID_CHARGE`, y ocultación total automática vía `ConcealmentContribution`.

**Sprint 048 (Helpless Combat & Coup de Grace, cierre 2026-07-18)**: **457/457 pruebas, 0 fallos** (52 archivos) — número de tests sin cambios respecto de Sprint 047 porque Coup de Grace no agrega un archivo de test unitario dedicado; su cobertura real vive en la suite global (fixture de `dt-006-snapshot-integrity.test.mjs` extendida con `pendingCoupDeGrace`) y en el E2E WebSocket. `npm run typecheck`/`npm run build` verdes en los 3 workspaces. `node scripts/e2e-websocket.mjs`: **93/93** aserciones, exit 0 (sube desde 91/91 de Sprint 046 con los casos nuevos de Coup de Grace/interrupción por AdO). `npm run test:ui`: **6/6** escenarios Playwright.

**Sprint 049 (EFFECT-EXHAUSTED + corrección de `onStack`, 2026-07-23)**: **467/467 pruebas, 0 fallos** (53 archivos) — `exhausted-condition.test.mjs` (4 casos: STR/DEX -6, velocidad ×1/2, FORBID_RUN/FORBID_CHARGE, snapshot) más 7 casos nuevos en `active-effects.test.mjs` que cubren el consumo real de `onStack` en `EffectManager.add` (ignore descarta duplicados, upgrade_to escala Fatigued→Exhausted, una tercera fatiga contra un objetivo ya Exhausted no lo revierte, aplicar Exhausted directo sobre un Fatigued reemplaza la instancia débil). Corrección de infraestructura, no solo feature nueva: antes de este sprint `onStack` estaba declarado desde Sprint 003 pero ningún consumidor lo leía (DT-022, ver `docs/technical-debt.md`); el fix beneficia a toda condición existente (Prone incluido), no solo a Exhausted. `npm run typecheck`/`npm run build` verdes en los 3 workspaces. `node scripts/e2e-websocket.mjs`: **93/93** aserciones, exit 0 (sin regresión). `npm run test:ui`: **6/6** escenarios Playwright.

**Sprint 050.1 (Panel de Estados del GM, 2026-07-24)**: **478/478 pruebas, 0 fallos** (54 archivos) — nuevo `tests/gm-condition-panel.test.mjs` (11 casos): remoción por `instanceId` (rechazo no-GM, instanceId inexistente, remoción sin afectar otras instancias del mismo `effectId`), y verificación end-to-end de que los handlers administrativos delegan `onStack` a `EffectManager` sin lógica propia (reaplicar Fatigued produce Exhausted, Prone duplicado se ignora, una tercera fatiga contra un objetivo ya Exhausted no lo revierte, el GM puede remover un efecto que el motor generó automáticamente), más pruebas de schema (`gm-remove-effect` válido, `instanceId` requerido, `effectId` inyectado nunca es autoridad de remoción). `npm run typecheck`/`npm run build` verdes en los 3 workspaces. `node scripts/e2e-websocket.mjs`: **98/98** aserciones, exit 0 (sube desde 93/93 con el flujo completo aplicar→reaplicar→remover→rechazo no-GM). `npm run test:ui`: **7/7** escenarios Playwright (nuevo: aplicar/remover una condición desde el Panel GM real, sin bypass por WebSocket crudo).

**Sprint 052B (Line of Effect + Cobertura Total, 2026-07-24)**: **498/498 pruebas, 0 fallos** (56 archivos) — nuevo `tests/line-of-effect.test.mjs` (17 casos de geometría pura: línea despejada, uno/varios bloqueadores, obstáculo fuera del segmento, horizontal/vertical/diagonal, adyacencia sin punto interior posible, claves inválidas/duplicadas, footprints multicasilla con la regla "al menos un par despejado", independencia total de `impassableCells` respecto de `lineOfEffectBlockingCells`) y nuevo `tests/line-of-effect-server.test.mjs` (4 casos de integración de servidor: ataque con LoE se resuelve normal, ataque sin LoE se rechaza antes de cualquier tirada/mutación — con un `diceRoller` que lanza si se invoca, para probar que el RNG nunca se consume —, la autorización de control de turno sigue evaluándose antes que la Cobertura Total). `tests/cover-reach.test.mjs`/`tests/flanking.test.mjs` corregidos: 9 aserciones que dependían de `impassableCells` produciendo `terrain-cover` se reescribieron o sustituyeron por escenarios de criatura interpuesta, reflejando que Cover ahora es exclusivamente por interposición de criaturas. `npm run typecheck`/`npm run build` verdes en los 3 workspaces. `node scripts/e2e-websocket.mjs`: **99/99** aserciones, exit 0 (sube desde 98/98 con el caso positivo de Line of Effect; el caso de rechazo no es representable en este E2E — ver arriba). `npm run test:ui`: **7/7** escenarios Playwright sin cambios (no existe editor de tablero para construir un escenario visual de Cobertura Total).

**Sprint 052B.1 (Corrección geométrica de Line of Effect, 2026-07-24)**: **510/510 pruebas, 0 fallos** (56 archivos) — `tests/line-of-effect.test.mjs` reescrito por completo (17 → 29 casos): matriz obligatoria de 4 pendientes no triviales (`(0,0)→(2,1)`, `(0,0)→(3,1)`, `(0,0)→(3,2)`, `(1,1)→(4,3)`), cada una con "celda realmente atravesada bloquea" y "celda cercana pero no atravesada no bloquea"; política explícita de bordes (cruce ordinario de un solo eje) vs. vértices (diagonal exacta 45°, incluye conservadoramente ambas celdas vecinas del cruce); footprints 1×1/origen Large/objetivo Large/ambos Large con "al menos un par despejado" y "todos los pares bloqueados". Todos los fixtures se verificaron ejecutando la implementación real (script de sondeo descartado tras usarlo), no derivados a mano — la corrección anterior (Sprint 052B) sí tenía un fixture `(15,21)` derivado por búsqueda de mínimo común múltiplo, síntoma exacto del bug que este sprint corrige; ese test fue eliminado y reemplazado por escenarios a distancias normales. Se eliminó el bug real: `getLineOfEffect` probaba colinealidad exacta del ancla entera de una celda bloqueadora, no si el segmento atraviesa su área. `tests/line-of-effect-server.test.mjs`/`tests/cover-reach.test.mjs`/`tests/flanking.test.mjs` sin cambios (la corrección es interna a `getLineOfEffect`, no afecta Cover ni el camino de servidor). `npm run typecheck`/`npm run build` verdes en los 3 workspaces. `node scripts/e2e-websocket.mjs`: **99/99** aserciones, exit 0 (sin cambios). `npm run test:ui`: **7/7** escenarios Playwright (sin cambios).

**Sprint 053B/053B.1 (Vision, iluminación básica y targeting a ciegas, 2026-07-24)**: **544/544 pruebas, 0 fallos** (58 archivos) — `tests/vision-core.test.mjs` (19 casos: luz normal; luz tenue sin Darkvision, dentro de alcance y fuera de alcance; oscuridad sin/con/fuera-de-rango de Darkvision; ruta visual bloqueada; precedencias; trazas y transporte por Snapshot; composición Vision+Concealment con 7 casos) y `tests/blind-targeting-server.test.mjs` (15 casos: targeting directo/por casilla, footprints Large, casilla vacía y regresiones de Line of Effect, Cover y Blinded). La revisión 053B.1 corrigió que Darkvision solo suprima la ocultación parcial de luz tenue dentro de `darkvisionFeet`. `npm run typecheck`/`npm run build` verdes en los 3 workspaces. `node scripts/e2e-websocket.mjs`: **100/100** aserciones, exit 0. `npm run test:ui`: **7/7** escenarios Playwright.

**Sprint 053B.2 (Corrección del Blind Targeting, 2026-07-25)**: **547/547 pruebas, 0 fallos** (58 archivos) — `tests/blind-targeting-server.test.mjs` sube de 15 a 18 casos cerrando los tres defectos de la revisión de 053B: (1) el modo casilla se rechaza cuando el atacante puede ver la casilla (bypass prohibido), con mensaje idéntico esté ocupada o vacía, y la luz tenue no lo justifica; (2) Line of Effect se evalúa hacia la casilla con independencia de su ocupación (rechazo por Cobertura Total sin consumir acción, mensaje idéntico ocupada/vacía — antes la casilla vacía nunca pasaba por LoE, una asimetría que en sí filtraba ocupación); (3) el log público de un fallo contra casilla ocupada (por CA con 1 natural, o por Concealment con d100=1) es exactamente igual, palabra por palabra, al de una casilla vacía a la misma distancia — el desglose real (nombre/CA/d20/d100) queda solo en el estado autoritativo. El test previo que codificaba el comportamiento defectuoso ("modo casilla resuelve igual que directo contra objetivo visible") se reescribió para afirmar el rechazo. Nuevas funciones puras `getLineOfEffectToCell`/`isSquareTargetingJustified` en `rules.ts` (el helper supercover privado ahora acepta listas de celdas — refactor mecánico, cero cambios de comportamiento en `getLineOfEffect`/`getVisualPathAssessment`). `npm run typecheck`/`npm run build` verdes en los 3 workspaces. `node scripts/e2e-websocket.mjs`: **100/100** aserciones, exit 0 (la aserción Blinded ahora valida la proyección segura y la ausencia de logs con d20/CA/d100). `npm run test:ui`: **7/7** escenarios Playwright (sin cambios de UI).

**Sprint 055B (Opportunity Attacks bajo Cover y Ocultación Total, 2026-07-25)**: **559/559 pruebas, 0 fallos** (59 archivos) — nuevo `tests/opportunity-attack-legality.test.mjs` (12 casos): 5 unitarios sobre `getOpportunityAttackLegality` (sin Cover/Concealment con Line of Effect → `allowed`/`clear`; Line of Effect rota → `no-line-of-effect`; Cover por criatura interpuesta, cualquier grado → `cover`; Ocultación Total por oscuridad fuera de Darkvision → `total-concealment`; Ocultación parcial → `allowed`/`clear`, nunca bloquea); 5 de integración sobre `findTriggeredOpportunityAttacksForPath` (disparo por movimiento: regresión sin Cover/Concealment, Cover bloquea, Ocultación Total bloquea, Line of Effect rota bloquea, Ocultación parcial no bloquea); 2 de integración sobre `findTriggeredRangedOpportunityAttacks` (disparo por ataque a distancia/conjuro: regresión y Cover bloquea). Nueva función pura `getOpportunityAttackLegality` (`rules.ts`) compone, sin recalcular, `getLineOfEffect` + `getAttackContextModifiers` (Cover y Concealment ya compuestos en una sola llamada) — cero duplicación de geometría/percepción. Aplicada en generación en ambos call sites existentes (`findTriggeredOpportunityAttacksForPath`, `findTriggeredRangedOpportunityAttacks`), nunca en un tercer punto nuevo. `npm run typecheck`/`npm run build` verdes en los 3 workspaces. `node scripts/e2e-websocket.mjs`: **100/100** aserciones, exit 0 (sin regresión). `npm run test:ui`: **7/7** escenarios Playwright (sin cambios de UI).

## Cobertura UI

Sprint 011 cierra con **2/2** escenarios Playwright: el recorrido crítico de movimiento/AdO y el preview de flanqueo que diferencia arma melee, Shocking Grasp y Ray of Frost.

Sprint 025 conserva esos **2/2** escenarios en verde después de migrar Board y previews a la geometría multicelda.

Sprint 025-R amplía la cobertura a **3/3** con el preview `0 pies · SEGURO (Sin AdO)` y resolución real sin oportunidades pendientes.

Sprint 030 amplía la cobertura a **5/5** escenarios Playwright con restricción visible de arma pesada y Escape de Presa en modo AUTO. La regresión WebSocket permanece en **87/87**.

**Sprint 042.5**: **5/5** escenarios Playwright confirmados en verde real en esta máquina Windows (Chromium ya instalado localmente, 20.3s) — primera ejecución real de Playwright registrada en este documento fuera de un sandbox bloqueado. E2E WebSocket confirmado de nuevo en **87/87**, exit 0.

**Sprint 045**: **6/6** escenarios Playwright. El nuevo caso verifica el preview compartido `Velocidad efectiva: 15 ft (Entangled ×1/2)`, Run deshabilitado y paso de 5 pies disponible cuando la velocidad efectiva supera una casilla.

**Sprint 046**: **6/6** escenarios Playwright preservados. React consume el mismo `ConcealmentAssessment` que el servidor; por alcance aprobado no existe una fuente productiva que active el indicador, y los casos deterministas 20%/50% se cubren en la suite unitaria sin introducir flags de prueba ni RNG de cliente.

**Referencia a ADR**: `ADR-0006-testing-culture.md`
