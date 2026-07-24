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
- DEFENSE-LINE-OF-EFFECT (Parcial): camino positivo (Line of Effect presente, tablero sin obstáculos) confirmado vía WebSocket. El camino de rechazo (Cobertura Total por `lineOfEffectBlockingCells`) **no** es representable en este E2E porque no existe comando ni editor para fijar el tablero de una sala viva; se cubre con integración directa de servidor en `tests/line-of-effect-server.test.mjs` (ver Sprint 052B abajo).
- DEFENSE-VISION (Parcial, Sprint 053B): targeting directo rechazado para un atacante Cegado con `targetId` legado (Ocultación Total ahora exige elegir casilla), y el mismo ataque resuelto exitosamente vía `target: {kind:"square"}` con el d100 de Concealment (50%) autoritativo del servidor.

Último cierre validado (Sprint 053B): **100/100** verificaciones WebSocket.

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

**Sprint 053B (Vision, iluminación básica y targeting a ciegas, 2026-07-24)**: **542/542 pruebas, 0 fallos** (58 archivos) — nuevo `tests/vision-core.test.mjs` (17 casos: luz normal, luz tenue, oscuridad sin/con/fuera-de-rango de Darkvision, ruta visual bloqueada, precedencia ruta-bloqueada-sobre-luz y oscuridad-sobre-luz-tenue, trazas y `dominantReason`, transporte por Snapshot; composición Vision+Concealment con 7 casos incluyendo múltiples fuentes totales sin sumar 50%, AdO bloqueado por Ocultación Total, y Blinded+Vision parcial vía pipeline real con `srd_blinded`) y nuevo `tests/blind-targeting-server.test.mjs` (15 casos: targeting directo permitido en luz normal/tenue con 20%, rechazado en oscuridad total; targeting por casilla ocupada, cualquier celda de una criatura Large, casilla vacía consumiendo intento/acción/munición sin revelar el motivo del fallo ni mutar HP ni generar amenaza de crítico; regresiones de Line of Effect, Cobertura +4, Blinded ahora exigiendo casilla, `targetId` legado sin cambios, tirada manual y AUTO). Hallazgo arquitectónico corregido durante la implementación: el gate de targeting directo por Vision debía ejecutarse después del gate de Line of Effect ya existente (ambos comparten hoy la misma fuente provisional de bloqueo geométrico), descubierto por una regresión real de "Cobertura Total" que rompió antes de la corrección. `npm run typecheck`/`npm run build` verdes en los 3 workspaces. `node scripts/e2e-websocket.mjs`: **100/100** aserciones, exit 0 (sube desde 99/99; el escenario Blinded existente se extendió con el rechazo de `targetId` legado y la resolución exitosa vía `target: {kind:"square"}` — se corrigió de paso un bug de posición obsoleta en el propio script, una variable de combatiente capturada antes de un `gm-move-combatant` posterior). `npm run test:ui`: **7/7** escenarios Playwright (sin cambios de UI en este sprint).

## Cobertura UI

Sprint 011 cierra con **2/2** escenarios Playwright: el recorrido crítico de movimiento/AdO y el preview de flanqueo que diferencia arma melee, Shocking Grasp y Ray of Frost.

Sprint 025 conserva esos **2/2** escenarios en verde después de migrar Board y previews a la geometría multicelda.

Sprint 025-R amplía la cobertura a **3/3** con el preview `0 pies · SEGURO (Sin AdO)` y resolución real sin oportunidades pendientes.

Sprint 030 amplía la cobertura a **5/5** escenarios Playwright con restricción visible de arma pesada y Escape de Presa en modo AUTO. La regresión WebSocket permanece en **87/87**.

**Sprint 042.5**: **5/5** escenarios Playwright confirmados en verde real en esta máquina Windows (Chromium ya instalado localmente, 20.3s) — primera ejecución real de Playwright registrada en este documento fuera de un sandbox bloqueado. E2E WebSocket confirmado de nuevo en **87/87**, exit 0.

**Sprint 045**: **6/6** escenarios Playwright. El nuevo caso verifica el preview compartido `Velocidad efectiva: 15 ft (Entangled ×1/2)`, Run deshabilitado y paso de 5 pies disponible cuando la velocidad efectiva supera una casilla.

**Sprint 046**: **6/6** escenarios Playwright preservados. React consume el mismo `ConcealmentAssessment` que el servidor; por alcance aprobado no existe una fuente productiva que active el indicador, y los casos deterministas 20%/50% se cubren en la suite unitaria sin introducir flags de prueba ni RNG de cliente.

**Referencia a ADR**: `ADR-0006-testing-culture.md`
