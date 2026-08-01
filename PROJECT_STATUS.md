# Project Status

> **Responsabilidad canónica:** fotografía breve del último estado integrado y
> publicado. Los estados oficiales de reglas viven únicamente en
> [`docs/rules/registry.md`](docs/rules/registry.md).

## Estado actual

- Rama de integración: `master`.
- Última vertical funcional integrada: Sprint 055B, Ataques de Oportunidad bajo Cover y Ocultación Total.
- Última decisión arquitectónica: Sprint D-1B-Research R6 (Auditoría de Reglas de Movimiento - SSOT Matrix Remediation).
- Último saneamiento documental: Sprint D-1B-Research R6 / Sprint D-1A-R1.
- Baseline funcional publicada: 559/559 pruebas unitarias, 100/100 aserciones
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
