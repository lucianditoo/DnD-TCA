# Master Testing Coverage

Este documento consolida las directrices y el reporte de cobertura de testing del motor de combate D&D 3.5. 

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

Último cierre validado (Sprint 046): **91/91** verificaciones WebSocket.

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

## Cobertura UI

Sprint 011 cierra con **2/2** escenarios Playwright: el recorrido crítico de movimiento/AdO y el preview de flanqueo que diferencia arma melee, Shocking Grasp y Ray of Frost.

Sprint 025 conserva esos **2/2** escenarios en verde después de migrar Board y previews a la geometría multicelda.

Sprint 025-R amplía la cobertura a **3/3** con el preview `0 pies · SEGURO (Sin AdO)` y resolución real sin oportunidades pendientes.

Sprint 030 amplía la cobertura a **5/5** escenarios Playwright con restricción visible de arma pesada y Escape de Presa en modo AUTO. La regresión WebSocket permanece en **87/87**.

**Sprint 042.5**: **5/5** escenarios Playwright confirmados en verde real en esta máquina Windows (Chromium ya instalado localmente, 20.3s) — primera ejecución real de Playwright registrada en este documento fuera de un sandbox bloqueado. E2E WebSocket confirmado de nuevo en **87/87**, exit 0.

**Sprint 045**: **6/6** escenarios Playwright. El nuevo caso verifica el preview compartido `Velocidad efectiva: 15 ft (Entangled ×1/2)`, Run deshabilitado y paso de 5 pies disponible cuando la velocidad efectiva supera una casilla.

**Sprint 046**: **6/6** escenarios Playwright preservados. React consume el mismo `ConcealmentAssessment` que el servidor; por alcance aprobado no existe una fuente productiva que active el indicador, y los casos deterministas 20%/50% se cubren en la suite unitaria sin introducir flags de prueba ni RNG de cliente.

**Referencia a ADR**: `ADR-0006-testing-culture.md`
