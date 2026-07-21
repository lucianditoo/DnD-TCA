# Walkthrough — Sprint 045 (Entangled Core)

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
