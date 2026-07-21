# Walkthrough — Sprint 044.2 (Arquitectura del Pipeline de Modificadores)

## Resultado

Se completó la auditoría documental y del código real sin modificar producción, tests, schemas, catálogos ni Rule IDs. El diseño canónico está en `docs/designs/modifier-pipeline-architecture.md`.

## Estado Git inicial

- Rama: `master`.
- HEAD auditado: `8d1c042a827613327187849e1e55d8e9a6d1d004`.
- Último commit: `8d1c042 docs(architecture): classify base rules and composable modifiers`.
- Sin commits locales pendientes respecto de `origin/master` al iniciar (`0/0`).
- Única excepción local autorizada: `.claude/settings.local.json`, archivo no seguido y expresamente fuera de alcance. No se leyó, modificó, agregó a staging ni incluyó en la auditoría.

## Auditoría

Se revisaron:

- `docs/designs/`, `docs/architecture/` y `docs/rules/`;
- `PROJECT_STATUS.md`, `ROADMAP.md`, `TODO.md`, `AGENTS.md` y `CODEX_GUIDE.md`;
- Attack Resolver, Movement, ActiveEffects/Reducer/Manager/Tick, `DamageBundle`, Cover, snapshot, threat, opportunities, catálogos, handlers y previews React.

## Hallazgos principales

1. El proyecto no tiene un solo pipeline de modificadores: conviven derivación source-first, ActiveEffects estáticos/contextuales, folds de dotes, assessments, sumas locales, lógica de resolver y `Buff`.
2. `EffectReducer` es una base sólida para deltas estáticos, pero no procesa stacking contextual, mechanics ni multiplicadores.
3. `getAttackContextModifiers` + `CoverAssessment` es el patrón compartido más maduro para reglas contextuales.
4. `DamageBundle` ya resuelve correctamente contribuciones de daño y multiplicación selectiva.
5. `Buff` duplica stacking, trazas y lifecycle; debe retirarse como bus general, regla por regla.
6. El servidor usa la rutina BAB cruda mientras la UI usa la rutina efectiva; esto debe consolidarse antes de ataques estructurales extra.
7. Persisten consultas directas por ID y números anónimos en fronteras handler/resolver.

## Decisiones

- Pipeline oficial: **Intención → Preflight → Operación base → Contribuciones estructurales → Contexto → Proyección efectiva → Resolver → Consecuencias → Commit**.
- Una regla base mantiene identidad única; un modificador aporta contribuciones especializadas.
- No se crea `RuleModifier`, `UniversalModifier` ni `GameModifier`.
- Se reutilizan snapshot, ActiveEffects, reducer, traits/overrides, catálogos, folds, assessments, `DamageBundle`, resolvers y transacciones.
- Se justifica una futura `AttackAttemptProjection` especializada; `AttackRoutineContribution` debe extenderse, no duplicarse.
- Concealment, tasa de movimiento y consecuencias one-shot conservan contratos especializados y NDD propios.
- Resolver sin conocimiento de board, IDs concretos o estado mutable; UI y servidor consumen la misma proyección.

## Decisiones postergadas

- forma TypeScript exacta de la proyección de ataque;
- reducción contextual y trazas runtime;
- orden de migración de Haste/Aid/Fighting Defensively/Total Defense/Charge fuera de `Buff`;
- composición exacta de Rapid Shot/Haste/TWF/naturales;
- `ConcealmentAssessment`, tasa racional de movimiento y consecuencias one-shot;
- posible partición futura de `rules.ts`.

## Documentación

- Creado: `docs/designs/modifier-pipeline-architecture.md`.
- Actualizados: `PROJECT_STATUS.md`, `ROADMAP.md`, `TODO.md`, `walkthrough.md`.
- No se creó `implementation_plan.md`.
- No se modificó `docs/rules/registry.md`.

## Validación

Solo se realizan verificaciones documentales, enlaces, referencias cruzadas y revisión de diff. No se ejecuta la suite porque no existen cambios de código o tests.
