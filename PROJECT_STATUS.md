# Project Status

> **Responsabilidad canónica:** fotografía breve del último estado integrado y
> publicado. Los estados oficiales de reglas viven únicamente en
> [`docs/rules/registry.md`](docs/rules/registry.md).

## Estado actual

- Rama de integración: `master`.
- Última vertical funcional integrada: Sprint 055B, Ataques de Oportunidad bajo Cover y Ocultación Total.
- Última decisión arquitectónica: Sprint D-1B Capítulo 7 (Integration & Implementation Contracts).
- Implementación en revisión: Sprint D-1B-I5R1, Movement Resolution / Commit Remediation.
  Remedia hallazgos de Architecture Review de I5: procedencia y vigencia estricta
  (actor/turno, ronda, origen, presupuesto, contexto diagonal y fingerprint
  canónico determinista del estado de reglas con `createMovementStateFingerprint`),
  coste normativo de Squeezing puro en `assessMovementCost` (duplicación ortogonal y diagonal
  respetando paridad 5/10), tipado explícito para combinaciones no soportadas
  (Squeezing + Difficult Terrain bajo ODR-D1B-C3-01) y separación estricta entre
  presupuesto consumido (`totalCostFeet` → `movementUsedFeet`) y distancia espacial
  recorrida (`totalBaseRouteCostFeet` → `distanceMovedFeet`). Aislamiento productivo
  intacto; ODR-D1B-I5-1 y ODR-D1B-C3-01 permanecen abiertas.
- Último saneamiento documental: consolidación del estado y roadmap posterior a D-1B-I5; no cambia el estado de aprobación de I5.
- Baseline de código: Sprint D-1B-I5R1, con validaciones locales completas (635 tests unitarios, typecheck, build y e2e websocket en verde).
  Conteos y evidencias se mantienen en [master-coverage.md](docs/testing/master-coverage.md), no como un segundo registro aquí.
- GitHub Actions sobre Windows es el gate canónico de cierre para la revisión
  publicada.

## Integración de D-1B

| Etapa | Estado comprobado en el código |
|---|---|
| I1 — Movement Context | Integrado en creación/reinicio de turno y snapshots; el flujo productivo todavía no incrementa el contador. |
| I2 — Movement Cost | Assessment puro implementado; soporte de Squeezing y separación base/coste agregados en I5R1; consumido por I4. |
| I3 / I3R1 — Route Validation | Integrado: `validateMovePath` delega legalidad a `validateRouteLegality`; extracción sin el ciclo detectado en I3. |
| I4 — Movement Resolution | Pipeline puro de validación/coste/verificación de presupuesto remediado en I5R1 con fingerprint de estado y propagación tipada. |
| I5 / I5R1 — Movement Commit | Aplicación autoritativa remediada (precondiciones robustas anti-stale, separación coste/distancia, squeezing); listo para Architecture Review. |

La presentación continúa siendo un grid 2D con huellas multicasilla. El
modelo de superficies y volúmenes de los NDD espaciales es el destino de
migración, no una capacidad ya integrada. CI verde no significa V1 completa.

## Capacidades del código

El monorepo contiene:

- paquete compartido de tipos, catálogos, reglas y proyecciones;
- servidor Express/WebSocket autoritativo;
- cliente React/Vite que consume las mismas proyecciones compartidas;
- snapshots source-first sin estadísticas derivadas persistidas;
- contexto autoritativo de movimiento por turno, inicializado y reiniciado, todavía sin mutación desde la resolución productiva;
- assessment compartido y puro de Movement Cost, con diagonales normales 5/10, costes fijos de terreno difícil y evidencia por Step, compuesto junto a Route Validation y Budget Verification por un Movement Resolution Pipeline puro (`resolveMovementPipeline`), con un Authoritative Movement Commit (`commitMovementResolution`) que aplica ese resultado bajo precondición de estado vigente — todavía aislado de la resolución productiva;
- ActiveEffects, EffectReducer, EffectManager, Tick Layer y Event Bus;
- economía de acciones, movimiento, amenaza, AdO y huellas multicasilla;
- ataques normales, completos, de toque, críticos, daño de precisión y
  salvaciones;
- maniobras Trip, Bull Rush, Grapple y Coup de Grace;
- inventario, equipo, munición, conjuros preparados y panel administrativo de
  condiciones;
- Cover por interposición de criaturas;
- Line of Effect independiente de Cover y del terreno de movimiento;
- Concealment como assessment defensivo independiente;
- Vision básica con luz tenue, oscuridad, Darkvision por alcance y targeting a
  ciegas por casilla;
- Ataques de Oportunidad que respetan Line of Effect, Cover (cualquier grado)
  y Ocultación Total como condiciones de legalidad, no solo de resolución.

## Límites vigentes

- `impassableCells` gobierna movimiento; no concede Cover.
- Los bloqueadores de Line of Effect viven en
  `lineOfEffectBlockingCells`.
- Cover, Line of Effect, Concealment y Vision son responsabilidades separadas.
- Vision y Line of Effect todavía tienen extensiones pendientes; su estado
  oficial se consulta en el Registry.
- La legalidad de un Ataque de Oportunidad (`getOpportunityAttackLegality`)
  consume Line of Effect/Cover/Concealment ya calculados; nunca los
  recalcula ni introduce una cuarta fuente de verdad.
- Persisten verticales funcionales y deuda técnica pendientes, enumeradas sin
  historial en [`TODO.md`](TODO.md) y ordenadas en [`ROADMAP.md`](ROADMAP.md).

## Fuentes relacionadas

- Operación y Definition of Done: [`.agents/AGENTS.md`](.agents/AGENTS.md)
- Rule IDs y estado: [`docs/rules/registry.md`](docs/rules/registry.md)
- Evidencia de pruebas: [`docs/testing/master-coverage.md`](docs/testing/master-coverage.md)
- Pendientes: [`TODO.md`](TODO.md)
- Orden futuro: [`ROADMAP.md`](ROADMAP.md)
- Deuda técnica: [`docs/technical-debt.md`](docs/technical-debt.md)
- Último cierre: [`walkthrough.md`](walkthrough.md)
