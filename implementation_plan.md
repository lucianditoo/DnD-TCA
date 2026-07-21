# Implementation Plan — Sprint 046: Concealment Core

> Estado: diseño pendiente de `Proceed`. Este archivo no autoriza cambios funcionales.
>
> Alcance aprobado propuesto: Opción D — assessment y resolución porcentual 20%/50% sin fuentes productivas nuevas. `DEFENSE-CONCEALMENT` quedará como “Infraestructura solamente”/“Parcial”, nunca completo.

## 0. Gate de revalidación

Antes de código:

1. verificar `master`, HEAD, sincronización con `origin/master`, staged/unstaged/untracked;
2. preservar `.claude/settings.local.json` sin leer, tocar, stagear ni commitear;
3. releer `docs/designs/concealment-core.md`, el pipeline oficial y las respuestas aprobadas a sus preguntas abiertas;
4. detenerse ante cualquier cambio local ajeno;
5. confirmar que no apareció ya una implementación de Concealment desde este diseño.

## 1. Contratos especializados y reducción

Archivos reales:

- `packages/shared/src/effects/contracts.ts`
- `packages/shared/src/effects/reducer.ts`
- `packages/shared/src/types.ts`
- `packages/shared/src/effects/index.ts` y `packages/shared/src/index.ts`, solo si requieren export explícito

Trabajo:

1. introducir `ConcealmentContribution` con identidad, label, stacking key, perspectiva, kind y porcentaje;
2. agregar `concealmentContributions` opcional a `EffectDefinition`;
3. retirar la variante dormida `Modifier.mechanic/CONCEALMENT`; verificar por búsqueda que no existen productores;
4. introducir `ConcealmentTrace`, `ConcealmentKind` y `ConcealmentAssessment` en shared;
5. implementar `EffectReducer.reduceConcealmentContributions` siguiendo el precedente de `reduceMovementRateContributions`;
6. validar porcentaje `1..100`, campos no vacíos, catálogo conocido y orden determinista;
7. deduplicar por `stackingKey`, conservar suppressed traces y elegir máxima probabilidad; total vence a partial en empate;
8. no modificar `EffectInstance`, snapshot, perfiles, storage ni WebSocket.

Control arquitectónico:

- no `RuleModifier`/`GameModifier` universal;
- no callbacks ni RNG en `EffectDefinition`/reducer;
- no checks por `effectId`, `spellId`, condición o invisibilidad;
- no contrato viejo y nuevo en paralelo.

## 2. Assessment puro y contexto compartido

Archivos reales:

- `packages/shared/src/rules.ts`
- `packages/shared/src/types.ts`

Trabajo:

1. implementar `getConcealmentAssessment(snapshot, attacker, target, delivery)`;
2. separar colector contextual y compositor especializado para que futuras fuentes de terreno/Vision aporten candidatos sin duplicar stacking;
3. recoger contribuciones dirigidas al target y al attacker según `perspective`;
4. producir none/partial/total, porcentaje, targeting normativo, permiso normativo de AdO, labels y trazas;
5. extender `TacticalModifierSummary` para incluir `concealment`;
6. hacer que `getAttackContextModifiers` calcule assessments melee/ranged junto a Cover, sin fusionarlos;
7. mantener el assessment efímero y no serializado;
8. actualizar `canApplySneakAttack` para aceptar/reutilizar el assessment del intento y rechazar cualquier concealment.

Control arquitectónico:

- `totalArmorClass` no calcula ni tira Concealment;
- `getAttackContextModifiers` sigue siendo la sede única de contexto para servidor/UI;
- no introducir `AttackAttemptProjection` en este sprint;
- no implementar geometría, visión, target square o prohibición productiva de AdO.

## 3. Resolución porcentual autoritativa

Archivos reales:

- `apps/server/src/combat/diceRoller.ts`
- `apps/server/src/combat/attackResolver.ts`

Trabajo:

1. reutilizar `rollDice(100)` y la dependencia `diceRoller` ya existente;
2. crear una resolución server-side especializada que reciba assessment + roller y devuelva roll/miss con validación `1..100`;
3. insertar el check solo después de superar CA y antes de Sneak Attack, `DamageBundle` y amenaza crítica;
4. extender `AttackResult` con resultado efímero trazable, sin añadirlo a `Combatant` o perfil;
5. asegurar que fallo contra CA no llama d100;
6. asegurar que natural 20 no evita d100;
7. asegurar roll único por intento y ninguno durante confirmación;
8. reemplazar el fallback directo de `Math.random()` en esta ruta por el roller canónico, sin refactor general de RNG fuera del ataque.

## 4. Integrar todas las rutas con attack roll

Archivos reales:

- `apps/server/src/commands/attackCommands.ts`
- `apps/server/src/commands/abilityCommands.ts`
- `apps/server/src/commands/tacticalCommands.ts`
- `apps/server/src/commands/specialManeuverCommands.ts`
- `packages/shared/src/rules.ts` para profiles/resultados puros de maniobra

Orden:

1. Attack y cada entrada de Full Attack;
2. Opportunity Attack ordinario;
3. Charge;
4. `resolve-ability-attack` legacy;
5. `cast-spell` para ray/touch attack;
6. AdO interruptivo de maniobra (ya usa resolver; verificar roller);
7. toque inicial de Trip/Grapple, invocando la misma resolución server-side antes de prueba opuesta.

Detalles:

- propagar el mismo roller inyectable a las rutas que hoy lo pierden;
- contabilizar concealment miss como ataque consumido/miss, no hit;
- conservar consumo de acción, munición, slot y ayudas conforme al intento;
- impedir daño, precisión, save/on-hit, amenaza crítica y oposición posterior de Trip/Grapple;
- no aplicar miss chance a Bull Rush, automatic damage, effect spells ni AoE sin attack roll;
- no añadir d100/percentage/concealment a `ClientCommand` ni schemas Zod.

## 5. Logs, estadísticas y commit

Archivos reales:

- `apps/server/src/commands/attackCommands.ts`
- handlers anteriores solo donde produzcan logs propios

Trabajo:

1. loguear clase/porcentaje, d100 y resultado sin IDs internos;
2. hacer visible el resultado antes de publicar una amenaza crítica;
3. no persistir assessment/roller en `AttackThreatState`;
4. no revelar ocupación de casilla o información secreta de total concealment;
5. conservar commits transaccionales y evitar mutaciones si una invariante del roller falla.

## 6. Preview React

Archivos reales:

- `apps/web/src/components/ActionsPanel/ActionsPanel.tsx`
- otros componentes solo si la auditoría posterior demuestra un consumidor real

Trabajo:

1. consumir `attackContext.concealment` junto a Cover;
2. mostrar kind, porcentaje y label aplicable;
3. no tirar d100 ni añadir estado local/flags de red;
4. pasar el assessment a la elegibilidad de Sneak Attack para no mostrar un bonus inválido;
5. no deshabilitar targeting por total concealment en Opción D.

## 7. Fixtures de prueba aislados

Archivos previstos:

- `tests/concealment-core.test.mjs`
- suites existentes de ataque/crítico/furtivo/manoeuvre solo para regresiones estrictamente necesarias
- `scripts/e2e-websocket.mjs`
- `tests-ui/` para un journey focalizado
- harness/fixture bajo `tests/` o `tests-ui/`, nunca en catálogo productivo

Estrategia:

1. catálogo local shared para unitarios;
2. roller secuencial inyectado para d20/d100/damage;
3. harness `TEST_MODE` que aporte definiciones solo al proceso de prueba;
4. ninguna Rule ID o Effect ID de fixture en `effectsCatalog` productivo;
5. ninguna ampliación del contrato WS para controlar d100;
6. detener implementación si el fixture no puede aislarse sin una API productiva de test.

## 8. Matriz mínima de tests

### Shared

- none, 20, 50;
- 20+20, 20+50, empate partial/total;
- dedupe/stacking/trazas/orden;
- perspectiva attacker/target y remoción;
- Cover independiente;
- snapshot conserva instancias, no assessment;
- evaluación servidor/UI idéntica.

### Server

- hit CA + miss d100; hit CA + success d100;
- miss CA sin d100;
- natural 20 + miss d100;
- sin daño, Sneak Attack, on-hit, save o crítico al fallar;
- Sneak Attack suprimido aun con d100 exitoso;
- crítico con un solo d100;
- iterativos y AdO independientes;
- melee/ranged/touch/ray/Charge/Trip/Grapple;
- Bull Rush/AoE/automatic sin d100;
- rechazo preflight sin RNG/mutación;
- roll fuera de rango falla antes de commit.

### E2E/UI

- fixture 20 y 50, éxito/fallo, logs y Full Attack;
- schema rechaza campos extra del cliente;
- preview de porcentaje/label y resultado autoritativo;
- sin combinatoria de fuentes ni targeting total en Playwright.

## 9. Validación obligatoria posterior a código

Ejecutar en orden:

```powershell
npm test
npm run typecheck
npm run build
node scripts/e2e-websocket.mjs
npm run test:ui
git diff --check
```

Además:

- búsqueda negativa de checks directos por IDs/fuentes concretas;
- búsqueda de `Math.random()` en las rutas modificadas;
- verificación de que schemas WS no aceptan d100/porcentaje;
- revisión de diff y status, preservando `.claude/settings.local.json` fuera de alcance;
- GitHub Actions verde después del push de implementación.

## 10. Documentación posterior a verde

Solo después de implementación y gates verdes:

- `docs/rules/registry.md`: agregar `DEFENSE-CONCEALMENT` como “Infraestructura solamente”/“Parcial”;
- `docs/testing/master-coverage.md`;
- `docs/audits/combat-rules-deviations.md`: mantener `D-02` y registrar simplificación solo si la aprobación la exige;
- `docs/technical-debt.md`: únicamente si aparece deuda inevitable real;
- `PROJECT_STATUS.md`, `ROADMAP.md`, `TODO.md`, `.ai/PROJECT_MEMORY.md`, `walkthrough.md`.

No declarar completo ni cerrar targeting, Vision o AdO total.

## 11. Pausa de aprobación

No iniciar ningún paso funcional hasta recibir la palabra exacta `Proceed` y respuestas a las seis preguntas abiertas de `docs/designs/concealment-core.md`.

Si la arquitectura aprobada exigiera checks de IDs concretos, una fuente productiva inventada, RNG cliente, persistencia de assessment o fusión con Cover, detener el sprint y reportar la evidencia; no improvisar otra solución.
