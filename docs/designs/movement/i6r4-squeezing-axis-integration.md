# D-1B-I6 Design Remediation R4 — integración completa de squeezingAxis

Responsabilidad: cerrar la integración del eje autoritativo antes de Proceed.
Autoridad: complemento normativo del [NDD §8.7](../normative-movement-design.md#87-resolución-normativa-de-odr-d1b-i5-1-sede-autoritativa-de-squeezingaxis).
Baseline auditado: `dc6b08db622013daaf4ddebe5ccd472913b7c9dd`.
Complementa: [implementation_plan](../../../implementation_plan.md), [walkthrough](../../../walkthrough.md).
Estado: diseño únicamente; pendiente de Architecture Review y Proceed. Ningún código ni test cambia en R4.

## 1. Contrato congelado

La matriz RAW de Movement Cost/paridad aprobada en R3 permanece sin cambios. R4 solo completa el ciclo de vida de `squeezingAxis`.

La única autoridad es la instancia de `srd_squeezing` en `room.effectInstances`. Para cada combatiente con footprint orientable comprimido existe una sola instancia espacial, con exactamente un eje `horizontal | vertical`, confirmado por la proyección validada de la transición. Actualmente la geometría soporta compresión orientable de huellas naturales 2×2 según escala del tablero, no simplemente una etiqueta de tamaño Large. No se amplía soporte geométrico.

Ningún productor nuevo puede insertar compresión orientable sin eje. Commit nunca elige un eje por orden de candidatos, heurística, destino o estado del cliente. El snapshot siguiente debe reproducir las mismas coordenadas `x,y,zFeet` de la huella confirmada. Eje faltante, inválido, instancia duplicada o eje que dejó de ser legal son errores de integridad: no retornar silenciosamente `legal[0]` ni huella natural.

## 2. Tipo y fronteras de copia

Se conserva la interfaz genérica `EffectInstance<TEffectId>` con campo escalar `readonly squeezingAxis?: SqueezingAxis`. Decisión: no convertir el genérico abierto por catálogo en una unión distributiva compleja ni introducir metadata genérica. La representación de entrada a la frontera espacial sí será discriminada: `{ spatialMode: "natural"; squeezingAxis?: never } | { spatialMode: "squeezing"; squeezingAxis: SqueezingAxis }`. El caller construye esa evidencia desde el paso confirmado; nunca desde el comando del cliente.

El campo opcional de almacenamiento permite efectos ordinarios y fixtures de modificadores con footprint no orientable. Guardas runtime de `EffectManager.add`, antes de cualquier retorno por colisión, rechazan un eje en efectos distintos de `srd_squeezing`, un eje fuera de la unión y una instancia orientable sin eje. Squeezing espacial productivo exige un único target existente; no se acepta compresión global, ambiental o multitarjet cuya orientación resulte ambigua. La comprobación de integridad no valida rutas ni escoge orientación. Los productores espaciales aportan la evidencia; el manager solo protege y copia el contrato.

`packages/shared/src/effects/manager.ts` debe copiar explícitamente el escalar en `safeInstance`. Una cadena se copia por valor; no requiere objeto mutable adicional. Targets, source, appliedAtEvent y duration mantienen las copias defensivas actuales. `remove`/`removeMany` eliminan eje e instancia juntos.

Hallazgo adicional: `packages/shared/src/combatSnapshot.ts:162-175`, `cloneEffectInstances`, también enumera campos manualmente y descartaría el eje. Debe incluirlo explícitamente tanto para `createCombatRulesSnapshot` como para los consumidores del clonador. Broadcast en `apps/server/src/room/roomStore.ts` usa `JSON.stringify` de room y no filtra campos; no requiere cambio de protocolo. Verificar round trip JSON, clon de snapshot y clones transaccionales. No basta corregir manager.

## 3. Auditoría completa de commitSpatialTransition

Búsqueda de todos los usos en baseline: 13 invocaciones productivas, además de definición/imports. Referencias de línea corresponden al baseline.

| Archivo / caller | Líneas | Modo actual / evidencia | Adaptación mínima futura |
|---|---|---|---|
| `movementCommands.ts`, preparación | 15 | natural explícito | Conserva colocación libre; variante natural sin eje |
| `movementCommands.ts`, Move activo | 122 | `steps[actualPath.length - 1]` | I6 lo reemplaza por Resolution/Commit ordinario; eje del último paso del prefijo re-resuelto |
| `tacticalCommands.ts`, Withdraw | 113 | `validation.value.steps` conserva eje | Propagar último paso validado que corresponde a `finalStep` |
| `tacticalCommands.ts`, Run | 209 | misma evidencia, ruta recta validada | Propagar último paso; entrar en squeezing solo si pipeline vigente lo permite |
| `tacticalCommands.ts`, Charge | 343 | natural explícito | Mantener pipeline y variante natural |
| `tacticalCommands.ts`, Five-Foot Step | 440 | `validation.value.steps` del único paso | Propagar evidencia si validación vigente permite squeezing; conservar presupuesto y prohibiciones |
| `gmCommands.ts`, teleport | 23 | natural explícito | Mantener variante natural |
| `specialManeuverCommands.ts`, bull rush | 355 | natural explícito | Mantener forced movement vigente |
| `attackCommands.ts`, resolveThreatOutcome | 364, 368 | natural explícito (origin/destination) | Mantener rollback/avance vigente |
| `attackCommands.ts`, handleResolveOpportunityAttack | 466, 470, 475 | natural explícito | Mantener tres ramas vigentes |

Los 9 sitios natural explícito no crean compresión y eliminan cualquier instancia previa y su eje como hoy. No inferir squeezing por el destino ni extender su semántica. Los 4 sitios de modo variable ya tienen evidencia: `validateMovePath` copia `squeezingAxis` de `legality.steps` a `MovementStepProjection` (`rules.ts:784-789`). No modificar `rules.ts`, Route Validation, Movement Cost, economía, AoO ni action semantics de tácticas. Five-Foot Step conserva `validateMovePath(..., true)`; Charge su pipeline vigente. Las 13 invocaciones quedan cubiertas.

Firma propuesta: mantener room/combatant/position y reemplazar el argumento de modo por la evidencia discriminada anterior. Validar correspondencia con el paso confirmado en el caller. Si falta el último paso, no coincide con el destino o falta eje para modo squeezing, rechazar antes de mutar posición, efectos, economía, logs o AdOs. No recalcular geometría dentro de Commit para recuperar evidencia perdida.

`spatialTransition.ts` y `movementCommit.ts` deben dejar de depender solo de `previousMode !== currentMode`. Natural elimina todas las instancias espaciales previas. Squeezing con eje igual y estado único válido puede preservar instancia; eje distinto reemplaza removeMany + add en estado candidato local. `onStack: "ignore"` de squeezing hace insuficiente un add directo para actualizar eje. Solo publicar candidato y posición una vez que todas las guardas terminan. Error/stale conserva room completo. Duplicados se rechazan en admisión de estado; no se selecciona la primera instancia como autoridad.

## 4. Otros productores y compatibilidad

Dos constructores espaciales explícitos: `spatialTransition.ts:35` y `movementCommit.ts:188`; ambos requieren adaptación. No se encontró otro literal constructor productivo de squeezing.

`gmCommands.ts:handleGmApplyEffect` admite cualquier ProductionEffectId y no tiene evidencia espacial. Decisión explícita: rechazar aplicación manual de `srd_squeezing` antes de construir/publicar el efecto; se obtiene por transición espacial validada. `handleGmApplyEnvironmentalHazard` ya exige bloque hazard, ausente en squeezing; mantiene rechazo. `abilityResolver.ts` y `environmentalHazardResolver.ts` aplican ids dinámicos: el catálogo actual no aporta squeezing por estas rutas; las guardas de manager impedirán futuros inserts sin contrato. No se agrega una entrada de eje cliente para legitimarlos.

Auditoría de fixtures sin eje:

- `tests/map-builder.test.mjs`: seis instancias manuales (398, 452, 501, 582, 640, 689); migrar con el eje explicitado por cada escenario/celdas esperadas. Cuando el test exige preservar compresión vertical, declarar vertical; no agregar horizontal indiscriminadamente.
- `tests/bull-rush-and-squeezing.test.mjs:169` e `tests/iterative-attacks-effective-routine.test.mjs:82`: fixtures manuales de modificadores. Si footprint no orientable, pueden permanecer axisless bajo excepción acotada; migrar a escenario espacial confirmado cuando se use ocupación orientable. No fingir un eje confirmado para una prueba puramente numérica.
- `tests/movement-commit.test.mjs` y casos de entrada/continuidad de bull-rush-and-squeezing generan squeezing vía código: ampliar aserciones de eje y huella, no solo presencia/count.
- `packages/shared/src/demo/catalog.ts:603,616`: explicación y expectativa `hasEffect`, no instancia manual; conservar datos y añadir verificación del estado generado en cobertura futura de demo.

`roomStore.ts` mantiene rooms en un Map en memoria; no se encontró loader de combates persistidos en el servidor. Snapshot usa clon explícito y distribución JSON. No se afirma haber auditado datos externos ajenos al repo. En despliegue, las salas en memoria creadas por código previo pueden contener compresión orientable sin eje: drenar/recrear esas salas antes de habilitar el contrato. Si se introduce restauración persistente, su admisión debe rechazar/quarantinar ese estado y pedir recreación o transición espacial explícitamente validada fuera del Commit. No migración silenciosa a partir de destino o candidatos. No hay fallback temporal de selección de eje aprobado.

Para geometría autoritativa: consultar instancia única, exigir eje en footprint orientable y usar `preferredAxis`; si proyección falla, error de integridad antes de uso de snapshot. La excepción no orientable solo soporta fixtures/reglas de modificadores sin autoridad espacial orientada; no habilita nuevas transiciones comprimidas no soportadas.

## 5. Implementation plan y pruebas futuras

Dependencias: tipo/guardas y copias → lectura autoritativa del snapshot → ambos commits → propagación callers y cierre de inyección GM → fixtures/integración. Todos los cambios son futuros tras Proceed.

Archivos necesarios: `packages/shared/src/effects/types.ts`, `effects/manager.ts`, `combatSnapshot.ts`, `movementGeometry.ts`, `movementCommit.ts`; `apps/server/src/combat/spatialTransition.ts`, `commands/movementCommands.ts`, `commands/tacticalCommands.ts`, `commands/gmCommands.ts`. Callers natural explícito de attackCommands y specialManeuverCommands solo adaptan firma si se adopta la unión. `rules.ts` y pipelines tácticos conservan comportamiento.

Cobertura requerida:

1. Manager preserva horizontal y vertical exactamente; mutar objeto/arrays originales no altera copia ni eje. remove/removeMany elimina eje y efecto. Efectos ordinarios no adquieren eje; payload ajeno/invalid axis/axisless orientable/multitarget se rechaza sin mutación, incluso con onStack ignore.
2. cloneEffectInstances/createCombatRulesSnapshot y round trip JSON preservan eje y copias defensivas. Huella inmediata = huella de siguiente snapshot en ambos ejes y cuando ambos son legales.
3. Move normal crea instancia completa; prefijo tras fallo CD25 usa su último paso confirmado, sin heredar eje del destino descartado. No cambio de matriz R3.
4. Withdraw entra horizontal/vertical mediante validación legacy y conserva coste, economía, AoO y semántica. Run entra solo en caso legal existente y conserva prohibiciones (terreno difícil, línea recta). Five-Foot Step: caso natural y propagación si squeezing es legal; si no, rechazo previo sin ampliar reglas.
5. Cubrir cada fila y rama de las 13 invocaciones: natural no crea eje y limpia previo; Charge/teleport/bull rush/ramas de AdO conservan comportamiento. GM manual squeezing rechazado antes de logs/mutación. Demo genera estado completo.
6. Squeezing → natural elimina instancia/eje; squeezing → squeezing mismo eje conserva orientación; cambio horizontal ↔ vertical reemplaza determinísticamente aun con onStack ignore. Sin duplicados.
7. Stale Commit no cambia posición, eje, efectos, economía, logs ni AdOs; cambio externo del eje invalida fingerprint mediante ocupación. Evidencia ausente/contradictoria rechazada sin mutación.
8. Estado legacy orientable axisless y eje ya ilegal producen error explícito, sin fallback legal[0]/natural; fixtures map-builder migrados preservan comparación exacta y rechazo de rotación. Colocación preparation conserva semántica natural.

Suites futuras: ampliar `tests/effects-engine.test.mjs` si corresponde al manager (confirmar suite vigente al implementar), `tests/movement-commit.test.mjs`, `tests/movement-integration.test.mjs`, `tests/regression-tactical-movement.test.mjs`, `tests/map-builder.test.mjs`, `tests/bull-rush-and-squeezing.test.mjs`, `tests/iterative-attacks-effective-routine.test.mjs` y cobertura de snapshot/GM/tácticas existente. No crear tests en esta fase.
