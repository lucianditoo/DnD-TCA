# Sprint 045 — Plan de implementación de Entangled Core

**Estado:** propuesta; requiere `Proceed`

**Recorte:** Opción B — núcleo táctico completo, Concentration pendiente

**Restricción actual:** este archivo no autoriza cambios funcionales

## 1. Resultado esperado

Incorporar la condición `srd_entangled` como modificador declarativo de Attack,
Dexterity, Movement, Run y Charge. El servidor y React usarán la misma proyección de
velocidad. El Rule Registry permanecerá explícitamente parcial hasta implementar
Concentration.

## 2. Orden de implementación

### Fase 1 — Contrato de velocidad especializado

Archivos:

- `packages/shared/src/effects/contracts.ts`
- `packages/shared/src/effects/reducer.ts`
- `packages/shared/src/rules.ts`
- `packages/shared/src/index.ts`, solo si hace falta exportar la nueva proyección

Acciones:

1. Añadir `MovementRateContribution` y el campo opcional
   `EffectDefinition.movementRateContributions`.
2. Validar factores racionales positivos y claves no vacías al construir/proyectar.
3. Proyectar contribuciones aplicadas/suprimidas por `stackingKey` sin alterar el
   reducer numérico existente.
4. Añadir `getMovementSpeedProjection` con trazas deterministas.
5. Hacer que `Rules.totalSpeedFeet` delegue en `projection.totalFeet`.
6. Conservar exactamente el orden actual de armadura y deltas planos; aplicar tasas
   después y redondear una sola vez hacia abajo.
7. No persistir la proyección ni enviarla por WebSocket.

Criterio de salida: un factor 1/2 funciona para cualquier speed, se deduplica por
clave y no modifica comportamiento cuando no existen contribuciones.

### Fase 2 — Catálogo Entangled

Archivos:

- `packages/shared/src/effects/catalog.ts`
- cualquier contrato cerrado de `ProductionEffectId` que derive del catálogo, solo
  donde el compilador lo exija

Acciones:

1. Registrar `srd_entangled` con:
   - ATTACK -2;
   - DEXTERITY -4;
   - factor de movimiento 1/2;
   - `FORBID_RUN`;
   - `FORBID_CHARGE`;
   - stacking numérico no acumulable entre instancias iguales.
2. No añadir trait `ENTANGLED` si ninguna regla lo consume.
3. No declarar duración, DC, escape, anclaje ni fuente universal.
4. Mantener instancias múltiples para ciclos de vida independientes; deduplicar solo
   sus consecuencias.

Criterio de salida: el catálogo basta para activar todas las consecuencias Core, sin
ramas por ID en reglas o handlers.

### Fase 3 — Movimiento y acciones

Archivos:

- `packages/shared/src/rules.ts`
- `apps/server/src/commands/tacticalCommands.ts`, solo para consumir la frontera
  compartida si alguna ruta no lo hace ya
- `apps/server/src/combat/chargeResolver.ts`, solo para preservar/normalizar consumo
  del override; no introducir lógica Entangled

Acciones:

1. Confirmar que Move y Run construyen presupuestos desde `Rules.totalSpeedFeet`.
2. Confirmar que difficult terrain y squeezing permanecen como costes de path.
3. Actualizar `canUseFiveFootStep` para aplicar la regla general de speed efectivo
   ≤ `board.cellSizeFeet`, además de sus restricciones actuales.
4. Validar que Run y Charge rechacen durante preflight y no muten la sala.
5. No implementar la acción de movimiento mínimo de asalto completo dentro de esta
   condición; registrar la desviación general si aún sigue ausente.

Criterio de salida: ninguna ruta de movimiento usa speed base cruda y Entangled no
se confunde con terreno difícil.

### Fase 4 — Preview y presentación UI

Archivos esperados, sujetos a confirmación durante implementación:

- `apps/web/src/viewModel.ts`
- `apps/web/src/components/SelectedInfo/SelectedInfo.tsx`
- `apps/web/src/components/ActionsPanel/ActionsPanel.tsx`

Acciones:

1. Consumir la proyección compartida para alcance y desglose de velocidad.
2. Mostrar `Entangled ×1/2` desde las trazas de proyección.
3. Mostrar la condición activa desde instancia + catálogo, incluyendo fuente y
   duración cuando existan.
4. Deshabilitar Run/Charge con evaluaciones compartidas y razón legible.
5. Mantener al servidor como autoridad; el preview no crea decisiones propias.
6. Etiquetar el soporte como Core/parcial mientras falte Concentration.

Criterio de salida: preview y resolución producen el mismo speed y la UI no consulta
`srd_entangled` para calcular reglas.

### Fase 5 — Tests focalizados

Archivos:

- nueva `tests/entangled-condition.test.mjs`
- `tests/effects-reducer.test.mjs`
- `tests/conditions-v3.test.mjs`
- `tests/run.test.mjs`
- `tests/five-foot-step.test.mjs`
- `tests/difficult-terrain.test.mjs`
- `tests/rules.test.mjs`
- `tests/opportunity-phase.test.mjs`
- `tests/run-server.test.mjs`
- `scripts/e2e-websocket.mjs`
- journey Playwright existente, solo si la UI crítica cambia

Casos obligatorios:

1. ATTACK -2 y DEX -4, aplicados una vez.
2. Propagación de DEX efectiva a AC y Reflex.
3. Speed 30→15, 20→10 y 15→7.
4. Composición racional y un único redondeo final.
5. Dos instancias Entangled: una consecuencia, dos ciclos de vida.
6. Fatigued, Prone, armor y penalizadores distintos se componen.
7. Difficult terrain altera coste, no speed.
8. Run y Charge rechazan sin mutación parcial.
9. 5-foot step permitido o rechazado por las reglas generales, no por ID.
10. Estado sin Entangled conserva resultados previos.
11. WebSocket demuestra ataque, movimiento, overrides, logs y no duplicación.
12. Playwright demuestra desglose y acciones deshabilitadas solo si se introduce la
    presentación visual.

Los tests de Concentration no se añaden en este recorte porque no habrá una
implementación que verificar.

### Fase 6 — Documentación y trazabilidad

Actualizar únicamente después de implementar y validar:

- `docs/rules/registry.md`: abrir `EFFECT-ENTANGLED` como
  `Parcial — falta Concentration`.
- `docs/testing/master-coverage.md`: mapear cada aserción al Rule ID.
- `docs/audits/combat-rules-deviations.md`: actualizar la ausencia de Entangled y
  registrar Concentration/movimiento mínimo con estado real.
- `docs/technical-debt.md`: registrar solo deuda inevitable aceptada, sin inventar ID
  antes de la decisión del Lead.
- `PROJECT_STATUS.md`
- `ROADMAP.md`
- `TODO.md`
- `.ai/PROJECT_MEMORY.md`
- `walkthrough.md`

No declarar Entangled completa ni cerrar su dependencia de spellcasting.

## 3. Migraciones

Entangled Core no requiere migración de perfiles, snapshots o localStorage:

- la definición vive en el catálogo;
- `movementRateContributions` es opcional;
- los valores derivados se calculan al vuelo;
- las salas sin la condición conservan sus resultados.

La futura vertical de Concentration requerirá una versión nueva de StoredProfile,
`SkillId`, schema Zod, migración explícita y fixtures actualizados. No mezclar esa
migración con este plan tras `Proceed` salvo una nueva aprobación de alcance.

## 4. Validación prevista tras implementación

Ejecutar secuencialmente:

```powershell
npm run typecheck
npm run build
npx tsx --test tests/entangled-condition.test.mjs
npx tsx --test tests/effects-reducer.test.mjs tests/conditions-v3.test.mjs tests/run.test.mjs tests/five-foot-step.test.mjs tests/difficult-terrain.test.mjs
npm test
node scripts/e2e-websocket.mjs
npm run test:ui
git diff --check
git status --short
```

Si la suite global contiene una regresión preexistente, reportarla separada y no
ocultarla. El gate canónico de Windows CI deberá confirmar el resultado real.

## 5. Controles de arquitectura

- No `if (effectId === "srd_entangled")` en matemática, resolvers o handlers.
- No delta fijo para representar mitad de velocidad.
- No multiplicador universal.
- No flags o velocidad efectiva persistidos.
- No DC de Concentration enviada por cliente o guardada en la instancia.
- No acción universal de escape.
- No duplicar Move, Attack, Run, Charge ni Spell Casting.
- No modificar Rule IDs fuera de la actualización aprobada del Registry.

## 6. Dependencias y bloqueantes

No bloquean Entangled Core:

- reducer numérico;
- overrides Run/Charge;
- cálculo de abilities, ataque, CA y Reflex;
- movimiento y path costs;
- ActiveEffects, fuente, duración y Tick.

Bloquean declarar Entangled completa:

- dominio oficial de Concentration;
- ranks persistidos y migrados;
- evaluación autoritativa de DC 15 + spell level;
- semántica de pérdida del conjuro/slot;
- orden con AdO y daño durante spellcasting.

Dependencia general expuesta, no absorbida:

- acción de movimiento mínimo de asalto completo para velocidades que no pagan una
  casilla ordinaria.

## 7. Pausa de aprobación

No ejecutar ninguna fase anterior hasta recibir la palabra formal `Proceed`. La
aprobación debe confirmar:

1. Opción B y estado parcial.
2. Contrato `MovementRateContribution`.
3. Redondeo hacia abajo una vez al final.
4. Concentration y movimiento mínimo como verticales separadas.
