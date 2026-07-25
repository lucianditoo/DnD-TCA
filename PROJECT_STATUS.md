# Project Status

> **Responsabilidad canónica:** fotografía breve del último estado integrado y
> publicado. Los estados oficiales de reglas viven únicamente en
> [`docs/rules/registry.md`](docs/rules/registry.md).

## Estado actual

- Rama de integración: `master`.
- Última vertical funcional integrada: Sprint 053B.1, revisión de Vision e
  iluminación básica.
- Último saneamiento documental: Sprint 054A.
- Baseline funcional publicada: 544/544 pruebas unitarias, 100/100 aserciones
  WebSocket y 7/7 escenarios Playwright; typecheck y build verdes.
- GitHub Actions sobre Windows es el gate canónico de cierre para la revisión
  publicada.

## Capacidades integradas

El monorepo contiene:

- paquete compartido de tipos, catálogos, reglas y proyecciones;
- servidor Express/WebSocket autoritativo;
- cliente React/Vite que consume las mismas proyecciones compartidas;
- snapshots source-first sin estadísticas derivadas persistidas;
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
  ciegas por casilla.

## Límites vigentes

- `impassableCells` gobierna movimiento; no concede Cover.
- Los bloqueadores de Line of Effect viven en
  `lineOfEffectBlockingCells`.
- Cover, Line of Effect, Concealment y Vision son responsabilidades separadas.
- Vision y Line of Effect todavía tienen extensiones pendientes; su estado
  oficial se consulta en el Registry.
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
