# Walkthrough — Sprint 046 (DEFENSE-CONCEALMENT)

## Resultado

La infraestructura oficial de `DEFENSE-CONCEALMENT` quedó implementada como regla base independiente de Cover. El pipeline acepta contribuciones declarativas, produce un assessment efímero compartido, resuelve el d100 en el servidor después de superar la CA y antes de cualquier daño, y bloquea Ataque Furtivo ante cualquier ocultación. La Rule ID queda **Infraestructura solamente** porque no se incorporaron fuentes productivas.

## Gate y revalidación

- Rama inicial: `master`; HEAD inicial: `a31eea850929b8ca9d4c5608a4d1dab9f626a24d`.
- Sincronización inicial con `origin/master`: 0 commits ahead / 0 behind.
- Sin cambios tracked o staged al comenzar.
- `.claude/settings.local.json` permaneció como excepción local no seguida: no se abrió, leyó, modificó, eliminó, auditó ni agregó a staging.
- Se releyeron el NDD de Concealment, la arquitectura del pipeline, la clasificación de reglas y el plan aprobado; la auditoría confirmó que ningún commit posterior había implementado Concealment parcialmente.

## Arquitectura implementada

- `ConcealmentContribution` es el único contrato especializado. El marker dormido `Modifier.mechanic/CONCEALMENT` fue eliminado al confirmarse que no tenía productores ni consumidores.
- `EffectReducer.reduceConcealmentContributions` valida porcentajes, ordena determinísticamente, deduplica semánticas por `stackingKey`, rechaza contradicciones, selecciona la mayor probabilidad sin sumar fuentes y conserva trazas `applied`/`suppressed`.
- `Rules.getConcealmentAssessment` compone un `ConcealmentAssessment` efímero desde las perspectivas del atacante y del objetivo. Cover se calcula en paralelo y permanece matemáticamente independiente.
- `resolveConcealment` usa el roller canónico del servidor. No tira si el ataque ya falló contra CA; un 20 natural todavía afronta ocultación; el d100 se compara inclusivamente con el porcentaje y no se repite para confirmar crítico.
- Ataques básicos/completos, aptitudes, conjuros, Carga, AdO y ataques de toque de maniobras consumen el mismo assessment. Daño, críticos, salvaciones y efectos on-hit solo ocurren tras superar CA y ocultación.
- `canApplySneakAttack` consume el assessment de ese mismo intento: cualquier ocultación impide daño de precisión aunque el d100 sea exitoso.
- React muestra tipo, porcentaje y trazabilidad usando la misma proyección compartida; no genera RNG ni envía flags de ocultación por WebSocket.
- Los campos futuros de targeting por casilla y AdO forman parte informativa del assessment, sin consumidores productivos en este sprint. No se agregó `AttackAttemptProjection` ni se persistió estado derivado.

## Pruebas y gates

- `tests/concealment-core.test.mjs` cubre ausencia de fuentes, perspectivas, 20%/50%, stacking, deduplicación, precedencia, trazas, validación, orden CA→d100, 20 natural, daño/consecuencias y bloqueo de Sneak Attack.
- Suite global: 450/450, 0 fallos.
- Typecheck: shared, web y server, 0 errores.
- Build: shared, web y server en verde; Vite transformó 1660 módulos.
- E2E WebSocket: 91/91 aserciones, exit 0; además rechaza porcentajes/d100 inyectados por cliente.
- Playwright: 6/6 escenarios. El primer intento dentro del sandbox fue bloqueado por `spawn EPERM`; la repetición autorizada fuera del sandbox ejecutó Chromium y pasó 6/6 en 15.4 s.
- `git diff --check`: sin errores.

## Estado y pendientes deliberados

- Registry: `DEFENSE-CONCEALMENT` = **Infraestructura solamente**.
- Sin fuentes productivas de ocultación, sin Blinded, Vision, Line of Effect ni targeting efectivo por casilla.
- Sin deuda técnica nueva. Se elimina el contrato paralelo dormido `Modifier.mechanic/CONCEALMENT`.

---

# Histórico — Sprint 045 (Entangled Core)

## Resultado

Entangled Core quedó implementado y validado sobre el pipeline oficial de modificadores. La condición aporta exclusivamente -2 a Attack, -4 a Dexterity, velocidad ×1/2, `FORBID_RUN` y `FORBID_CHARGE`. `EFFECT-ENTANGLED` permanece **Parcial — falta Concentration**.

## Gate inicial

- Rama: `master`.
- HEAD inicial: `7f9ba105dfa40835dc097adb2f452f3a6143a14e`.
- Sincronización inicial con `origin/master`: 0 commits ahead / 0 behind.
- Sin cambios tracked o staged al comenzar.
- `.claude/settings.local.json` permaneció como excepción local no seguida: no se leyó, modificó, eliminó, auditó ni agregó a staging.

## Implementación

- `MovementRateContribution` representa tasas racionales mediante numerador/denominador, etiqueta y `stackingKey`; no reutiliza deltas planos ni crea un modificador universal.
- `EffectReducer.reduceMovementRateContributions` ordena determinísticamente, deduplica aportes equivalentes, conserva trazas `applied`/`suppressed` y rechaza razones contradictorias bajo una misma clave.
- `Rules.getMovementSpeedProjection` aplica la tasa después de equipo, buffs de velocidad y deltas existentes; redondea hacia abajo una sola vez y nunca persiste el total.
- `Rules.totalSpeedFeet` consume esa proyección. Movimiento, Run, Charge, Stand Up, servidor y UI heredan la misma matemática sin ramas específicas.
- `canUseFiveFootStep` aplica la regla general: la velocidad efectiva debe superar el tamaño de una casilla. `validateMovePath` conserva el rechazo general por terreno difícil.
- React muestra el desglose de velocidad y consulta los gates compartidos de Run y paso de 5 pies.

## Pruebas

- `tests/entangled-condition.test.mjs`: 10/10 casos focales.
- Suite global: 440/440, 0 fallos.
- Typecheck: shared, web y server, 0 errores.
- Build: shared, web y server en verde; Vite transformó 1660 módulos.
- E2E WebSocket: 91/91 aserciones, exit 0.
- Playwright: 6/6 escenarios, incluido preview de 15 ft, traza `Entangled ×1/2`, Run bloqueado y paso de 5 pies habilitado.

## Auditoría arquitectónica

- No existe ningún `if (effectId === "srd_entangled")` en producción.
- El ID productivo solo aparece en `effects/catalog.ts`; las demás apariciones son diseño, plan o pruebas/integraciones.
- No se añadieron velocidad persistida, flags especiales, reglas base duplicadas ni Rule IDs ajenas; el único alta en Registry es `EFFECT-ENTANGLED`, exigida por el alcance aprobado.
- Concentration y fuentes concretas de Entangled permanecen deliberadamente fuera de alcance.

## Estado

Sprint 045 cerrado en su alcance aprobado. La Rule ID `EFFECT-ENTANGLED` queda **Parcial** hasta una futura vertical de Concentration.
