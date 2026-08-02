# Walkthrough — Sprint D-1B-I4 (Movement Resolution Pipeline)

## Objetivo

Implementar el Movement Resolution Pipeline puro aprobado en
`docs/designs/normative-movement-design.md` Capítulo 5, hasta Budget
Verification inclusive, completamente aislado del flujo productivo legacy
(`validateMovePath`/`calculatePathStepCostsFeet`). No se integra todavía
Commit, Publication ni ninguna mutación autoritativa; no se migra ningún
comando ni `commitSpatialTransition`.

## Estrategia de aislamiento

```
Producción actual (sin cambios):        Pipeline normativo nuevo:
validateMovePath                        validateRouteLegality
        ↓                                       ↓
calculatePathStepCostsFeet               assessMovementCost
        ↓                                       ↓
bridge legacy                            Budget Verification
```

`packages/shared/src/movementResolution.ts` expone `resolveMovementPipeline`,
que compone `validateRouteLegality → assessMovementCost → Budget
Verification` sin recalcular geometría ni coste. Ningún archivo productivo
(`tacticalCommands.ts`, `movementCommands.ts`, `commitSpatialTransition`,
`validateMovePath`) fue modificado.

## Contrato de resultado discriminado

`MovementResolutionResult` distingue tres estados mutuamente excluyentes
(TypeScript impide leer campos de coste/presupuesto en una ruta ilegal):

- **`illegal-route`**: `reason` + `failedStepIndex`, sin ningún campo de
  coste o presupuesto — el pipeline se corta en Route Validation.
- **`insufficient-budget`**: conserva `steps` validados, el
  `costAssessment` completo, `requiredCostFeet`/`availableBudgetFeet`, y el
  contexto diagonal/posición final proyectados, pero no se marca ejecutable.
- **`ready`**: igual evidencia que el anterior, más `remainingBudgetFeet`
  proyectado. Budget Verification se limita estrictamente a comparar
  `totalCostFeet <= availableBudgetFeet`; nunca descuenta ni reserva
  presupuesto, y la insuficiencia nunca vuelve ilegal una Route legal.

## Footprint efectivo y terreno difícil (Capítulo 3.9 del NDD)

`movementResolution.ts` nunca reproyecta footprints ni determina terreno
difícil por ancla/centro/`destination.x,y`. Para cada Step ya validado,
reutiliza las `occupiedCells` que `validateRouteLegality` ya produjo
(naturales, Large o Squeezing) y marca el Step como afectado por terreno
difícil si **cualquiera** de esas celdas lo está — "el Step adopta el coste
de terreno más alto entre las celdas de su footprint efectivo".

## Ampliación de `assessMovementCost` (evidencia por Step)

`MovementCostAssessment` gana un campo `steps:
ReadonlyArray<MovementCostStepAssessment>` (`stepIndex`, `stepCostFeet`,
`cumulativeCostFeet`, `resultingContext`), calculado dentro del mismo bucle
existente sin recalcular nada. `totalCostFeet` y `resultingContext` se
preservan exactamente igual que en D-1B-I2. El único test de I2 con
comparación estricta de forma completa (`assert.deepEqual` del assessment
íntegro) se amplió para incluir la nueva evidencia; el resto de los 7 casos
de I2 pasan sin modificación.

## Tests

`tests/movement-resolution.test.mjs` (12 casos nuevos): ruta legal con
presupuesto exacto; ruta ilegal corta el pipeline; presupuesto insuficiente
conserva evidencia; contexto diagonal inicial distinto de cero; terreno
difícil mixto (ortogonal 10, diagonal 15 sin alterar paridad, diagonal
normal siguiente usa la paridad previa); footprint Large (una celda difícil
del footprint 2×2 encarece el Step completo); Squeezing (footprint efectivo
de 2 celdas decide terreno, conserva `spatialMode`/`squeezingAxis`);
evidencia por Step (suma de `stepCostFeet` = `totalCostFeet`, último
`cumulativeCostFeet` = `totalCostFeet`); pureza (context/combatant/path/
contexto inicial congelados con `deepFreeze`, sin mutación); y tres casos de
equivalencia/divergencia frente al legacy `calculatePathStepCostsFeet`:

- equivalencia en ruta ortogonal simple;
- **divergencia intencional conocida**: diagonales difíciles consecutivas
  cuestan 15+15=30 ft en el pipeline normativo (Capítulo 3.6), pero
  15+20=35 ft en el legacy (que conserva, sin corregir en este sprint, una
  alternancia 15/20 ya documentada en sprints de auditoría previos);
- **divergencia intencional conocida**: el pipeline normativo recibe y
  respeta el contexto diagonal ya acumulado del turno (contador inicial 1 →
  la diagonal siguiente cuesta 10 ft), mientras que `calculatePathStepCostsFeet`
  no acepta un contexto inicial y siempre reinicia su contador local en 0
  por invocación (la misma diagonal cuesta 5 ft bajo el legacy).

`tests/movement-cost.test.mjs` gana un caso de evidencia por Step además de
la actualización del assert de forma completa ya mencionada.

`packages/shared/src/index.ts` gana una única línea (`export * from
"./movementResolution.js"`) para exponer el contrato público del resolver;
no se expuso ningún helper interno adicional.

## Validación

```
npm test                       -> 603/603
npm run typecheck               -> shared + web + server, sin errores
npm run build                   -> shared + web + server, sin errores
node scripts/e2e-websocket.mjs  -> 100/100 aserciones
npx playwright test              -> 7/7
git diff --check                 -> limpio
madge --circular                 -> mismos 4 ciclos preexistentes de
                                     types.ts/effects/*, ninguno nuevo
```

## Cierre

Legacy productivo intacto (`validateMovePath`, `calculatePathStepCostsFeet`,
comandos y `commitSpatialTransition` sin modificar). Sin Commit, sin
Publication, sin mutación de `movementUsedFeet`/`normalDiagonalStepsThisTurn`
autoritativos. Sin Rule ID afectada — `docs/rules/registry.md` no requirió
actualización, verificado por grep (no referencia estos contratos).

READY FOR ARCHITECTURE REVIEW
