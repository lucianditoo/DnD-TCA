# Project Status

> **Responsabilidad canónica:** fotografía breve del último estado integrado y
> publicado. Los estados oficiales de reglas viven únicamente en
> [`docs/rules/registry.md`](docs/rules/registry.md).

## Estado actual

- Rama de integración: `master`.
- Última vertical funcional integrada: Sprint 055B, Ataques de Oportunidad bajo Cover y Ocultación Total.
- Última decisión arquitectónica: Sprint D-1B Capítulo 7 (Integration & Implementation Contracts).
- Implementación en revisión: Sprint D-1B-I5, Authoritative Movement Commit
  (`commitMovementResolution` en `movementCommit.ts`), que consume
  exclusivamente un `MovementResolutionResult` "ready" de I4 y muta
  posición/`movementUsedFeet`/`distanceMovedFeet`/contador diagonal/estado
  de Squeezing de forma atómica, solo si una precondición autoritativa
  (posición, presupuesto y contexto diagonal vigentes) se sostiene. Sin
  Publication; I5 no migró los comandos productivos. El nuevo pipeline de
  I4/I5 todavía no es llamado por esos comandos. ODR-D1B-I5-1
  (sede persistente de `squeezingAxis`) queda abierta.
- Último saneamiento documental: consolidación del estado y roadmap posterior a D-1B-I5; no cambia el estado de aprobación de I5.
- Baseline de código: `6dc34f2` (D-1B-I5), con Windows CI confirmado en verde.
  Conteos y evidencias se mantienen en [master-coverage.md](docs/testing/master-coverage.md), no como un segundo registro aquí.
- GitHub Actions sobre Windows es el gate canónico de cierre para la revisión
  publicada.

## Integración de D-1B

| Etapa | Estado comprobado en el código |
|---|---|
| I1 — Movement Context | Integrado en creación/reinicio de turno y snapshots; el flujo productivo todavía no incrementa el contador. |
| I2 — Movement Cost | Assessment puro implementado; consumido por I4, no por el cálculo productivo de `validateMovePath`. |
| I3 / I3R1 — Route Validation | Integrado: `validateMovePath` delega legalidad a `validateRouteLegality`; extracción sin el ciclo detectado en I3. |
| I4 — Movement Resolution | Pipeline puro de validación/coste/verificación de presupuesto; probado sin consumidores productivos. |
| I5 — Movement Commit | Aplicación autoritativa probada; sin consumidores productivos, pendiente de Architecture Review. |

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
