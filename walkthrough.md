# Walkthrough — Sprint 049 (EFFECT-EXHAUSTED + corrección de `onStack`)

## Objetivo

Implementar Exhausted (SRD 3.5) y, condición explícita del usuario antes de aprobar
la implementación, corregir de raíz un gap de infraestructura descubierto durante
la auditoría normativa: `EffectDefinition.onStack` estaba declarado desde el
diseño original de ActiveEffects (Sprint 003) pero ningún consumidor lo leía nunca.

## Auditoría normativa (Fase 1)

Sin acceso directo a d20srd.org/dandwiki.com (403/402 al hacer fetch), se
trianguló con múltiples fuentes secundarias independientes convergentes:

- **Fatigued**: -2 STR/-2 DEX, no corre ni carga. La regla de escalado ("hacer
  algo que causaría fatiga vuelve Exhausted a un Fatigado") vive en la definición
  de la condición misma, no en cada fuente — confirmado comparando la regla
  general contra el texto de *Ray of Exhaustion* (que la reafirma, no la inventa).
- **Exhausted**: -6 STR/-6 DEX, mitad de velocidad, no corre ni carga.
- Ninguna fuente oficial (Marcha Forzada, Inanición, Sed, *Ray of Exhaustion*) está
  implementada hoy en el motor. La única fuente real y ya existente que aplica
  Fatigued es `srd_poison_gas_hazard` (`onFailEffectId:"srd_fatigued"`).

Detalle completo en `docs/designs/exhausted-condition.md`.

## El hallazgo que amplió el alcance (DT-022)

Al leer `packages/shared/src/effects/manager.ts` y `reducer.ts` completos se
confirmó: `EffectManager.add` era puramente aditivo (nunca comparaba contra
instancias existentes) y `EffectReducer` solo resuelve `stackingGroup`/
`stackingPolicy` (un mecanismo distinto, a nivel de modificador numérico).
`tests/conditions-v3.test.mjs` ya documentaba el síntoma para `srd_prone` con un
comentario que afirmaba —incorrectamente— que `onStack:"ignore"` bloqueaba el
stacking "en el EffectManager"; en la práctica dos instancias sumaban el
penalizador dos veces (14-4-4=6).

Peor: `srd_poison_gas_hazard` reaplica `srd_fatigued` cada ronda que el objetivo
falla su salvación mientras permanece en la nube. Sin consumo de `onStack`, tres
fallos consecutivos producían -6 STR/-6 DEX (tres instancias sumadas), no la
transición a Exhausted que exige el RAW.

El usuario aprobó ampliar el alcance para corregir esto de forma **genérica**
(beneficia a Prone, Dazed, Paralyzed y cualquier condición futura), documentado
como corrección de infraestructura existente (DT-022), no como funcionalidad
nueva.

## Auditoría de valores de `onStack` (condición del usuario antes de implementar)

Se auditó si el dominio necesita `"replace"`/`"refresh_duration"` además de
`"ignore"`/`"upgrade_to"`: los 14 entries previos del catálogo usaban solo
`"ignore"`, ningún efecto con `duration` real modela "recast mientras sigue
activo", y la investigación SRD de Fatigued/Exhausted tampoco lo requiere. Sin
casos normativos reales, `EffectDefinition.onStack` se angostó de 4 a 2 valores
(`"ignore" | "upgrade_to"`) en `contracts.ts`.

## Implementación

- `packages/shared/src/effects/manager.ts`: `EffectManager.add` es ahora el único
  punto de consumo de `onStack` (cero lógica en fuentes/handlers/hazards). Nueva
  función `severityChain` resuelve la cadena de severidad de un `effectId`
  siguiendo sus punteros `upgradeTo`. La colisión se evalúa por cadena completa,
  no solo por `effectId` exacto: si el objetivo ya tiene un miembro más severo
  (ej. ya Exhausted cuando el gas venenoso insiste con Fatigued en la ronda 3+),
  la nueva aplicación es redundante y se descarta; si tiene solo un miembro más
  débil (ej. se aplica Exhausted directo sobre un objetivo solo Fatigued), la
  instancia débil se reemplaza. La detección solo compara `targets` (efectos
  anclados a criaturas) — los hazards anclados a `targetCells` nunca colisionan
  aquí, preservando el comportamiento ya probado de múltiples hazards
  solapados sobre la misma celda (`tests/environmental-hazards.test.mjs`).
- `packages/shared/src/effects/catalog.ts`: `srd_fatigued` ahora declara
  `onStack:"upgrade_to"` + `upgradeTo:"srd_exhausted"`. Nueva entrada
  `srd_exhausted` (-6 STR/-6 DEX, velocidad ×1/2, `FORBID_RUN`/`FORBID_CHARGE`,
  `onStack:"ignore"`) — mismo patrón declarativo que Fatigued/Entangled/Blinded.
- `packages/shared/src/effects/contracts.ts`: `onStack` angostado a
  `"ignore" | "upgrade_to"`.

## Tests

- `tests/active-effects.test.mjs`: 7 casos nuevos sobre `EffectManager.add`
  (ignore descarta duplicados intra/inter-objetivo, upgrade_to escala
  Fatigued→Exhausted, una tercera fatiga contra un objetivo ya Exhausted no lo
  revierte, ignore en Exhausted descarta duplicado directo, Exhausted directo
  sobre un Fatigued reemplaza la instancia débil).
- `tests/exhausted-condition.test.mjs` (nuevo, 4 casos): STR/DEX -6, velocidad
  ×1/2, FORBID_RUN/FORBID_CHARGE, snapshot — mismo patrón que
  `entangled-condition.test.mjs`.
- `tests/conditions-v3.test.mjs`: comentario corregido (ya no afirma que el bug
  de Prone duplicado sigue abierto; documenta que el test bypasea
  `EffectManager.add` a propósito para caracterizar que el evaluador en sí mismo
  no deduplica).

## Documentación sincronizada

- `docs/designs/exhausted-condition.md` (nuevo): auditoría normativa completa,
  hallazgo DT-022, diseño de `severityChain`, límites de alcance documentados.
- `docs/technical-debt.md`: nueva entrada DT-022, resuelta.
- `docs/rules/registry.md`: nueva fila `EFFECT-EXHAUSTED` (Completo);
  `EFFECT-FATIGUED` anotada con la transición.
- `docs/testing/master-coverage.md`, `PROJECT_STATUS.md`, `TODO.md`: entrada de
  Sprint 049 con números reales verificados.

## Validación (DoD completo, ejecutado de verdad)

| Comando | Resultado |
|---|---|
| `npm test` | ✅ **467/467**, 0 fallos (53 archivos) |
| `npm run typecheck` | ✅ 0 errores (3 workspaces) |
| `npm run build` | ✅ los 3 workspaces en verde (Vite compila 1660 módulos) |
| `node scripts/e2e-websocket.mjs` | ✅ **93/93** aserciones, exit 0 (sin regresión) |
| `npm run test:ui` (Playwright) | ✅ **6/6** escenarios |

## Alcance explícitamente excluido

- Recuperación Exhausted→Fatigued tras 1h de descanso (depende del paso del
  tiempo, no de aplicación de efectos).
- Marcha Forzada, Inanición, Sed, Calor/Frío como fuentes activas (ninguna
  implementada hoy).
- Frightened, Panicked, Vision, Line of Effect, Concentration.

## Estado y próximo paso

Sprint 049 cerrado formalmente. `EFFECT-EXHAUSTED` es Completo en el Registry.
DT-022 resuelto. Próximo sprint funcional pendiente de nueva auditoría/
recomendación.
