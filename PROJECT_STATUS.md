# Project Status

> **Responsabilidad canónica:** fotografía breve del último estado integrado y
> publicado. Los estados oficiales de reglas viven únicamente en
> [`docs/rules/registry.md`](docs/rules/registry.md).

## Estado actual

- Rama de integración: `master`.
- Última vertical funcional integrada: Remediación Visual R2 de Terreno Volumétrico y Sprites Billboard 2.5D sobre la Demostración Táctica Automática y Guionada (`scripted_tactical_demo_v1`), conforme a [`docs/designs/scripted-combat-demo.md`](docs/designs/scripted-combat-demo.md) y [`docs/designs/scripted-combat-demo/implementation-plan.md`](docs/designs/scripted-combat-demo/implementation-plan.md).
- Última decisión arquitectónica: Sprint D-1B Capítulo 7 (Integration & Implementation Contracts) y NDD de Demo Táctica Automática (`f8c0e9d`).
- Diseño en Architecture Review: D-4 Renderer táctico 2.5D y cámara propone reemplazar la proyección CSS/SVG por una escena Three.js con cámara ortográfica orbital, picking presentacional y sprites pixel-art, preservando el renderer 2D y la autoridad del servidor. No existe `Proceed` de implementación ni dependencia nueva instalada.
- Implementación en revisión: Remediación Visual R2 de Presentación Táctica 2.5D (plano continuo de losa de piedra con zócalo y espesor, cuadrícula sobria superpuesta, prismas volumétricos para muros, pilares y escombros con sombreado de caras orientado a cámara, sprites billboard erguidos de cuerpo completo perpendicular al suelo con sombra de contacto y base táctica, postura de derribo inclinada sobre el suelo y aura púrpura de parálisis, escala 1.85x para criaturas Large y badges flotantes discretos); Demostración Táctica Automática y Guionada (`a458732`, secuencia autoritativa `sequence`, salas efímeras `DM*`, RNG determinista por paso y 3 escenas completas); y Sprint D-1B-I5R1 (Movement Resolution / Commit Remediation, aún aislado del flujo productivo con ODR-D1B-I5-1 y ODR-D1B-C3-01 abiertas).
- Baseline de código: 657 tests unitarios, `typecheck`, `build`, `e2e-websocket` (107/107) y 10 tests Playwright UI en verde.
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

La presentación incorpora un **prototipo de presentación táctica 2.5D** (con respaldo `2D` y cámara local de 4 ángulos) estrictamente desacoplado sobre el grid autoritativo 2D con huellas multicasilla: **se trata exclusivamente de una capa de presentación 2.5D y no del motor espacial 3D definitivo**. El modelo normativo de superficies y volúmenes de los NDD espaciales sigue siendo el destino de migración futura, no una capacidad mecánica ya integrada. CI verde no significa V1 completa.

## Capacidades del código

El monorepo contiene:

- paquete compartido de tipos, catálogos, reglas y proyecciones;
- servidor Express/WebSocket autoritativo;
- cliente React/Vite que consume las mismas proyecciones compartidas;
- capa de presentación táctica 2.5D (`presentationModel.ts`, `sprites.tsx`, `Board.tsx`) con selector `2.5D / 2D`, cámara táctica local de 4 ángulos (`NO`, `NE`, `SE`, `SO`) y zoom acotado, sprites SVG estáticos por arquetipo con fallback gráfico seguro, sombras de contacto, losas con volumen/zócalo y elementos escénicos no normativos sin alterar reglas ni autoridad del servidor;
- demostración táctica automática y guionada (`scripted_tactical_demo_v1`) con 3 escenas reproducibles en salas efímeras aisladas, runner autoritativo sincronizado por confirmaciones de estado y panel de observación/transporte (`DemoPanel`);
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
