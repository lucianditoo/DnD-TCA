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

Último cierre validado (Sprint 025-R): **87/87** verificaciones WebSocket.

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

## Cobertura UI

Sprint 011 cierra con **2/2** escenarios Playwright: el recorrido crítico de movimiento/AdO y el preview de flanqueo que diferencia arma melee, Shocking Grasp y Ray of Frost.

Sprint 025 conserva esos **2/2** escenarios en verde después de migrar Board y previews a la geometría multicelda.

Sprint 025-R amplía la cobertura a **3/3** con el preview `0 pies · SEGURO (Sin AdO)` y resolución real sin oportunidades pendientes.

Sprint 030 amplía la cobertura a **5/5** escenarios Playwright con restricción visible de arma pesada y Escape de Presa en modo AUTO. La regresión WebSocket permanece en **87/87**.

**Referencia a ADR**: `ADR-0006-testing-culture.md`
