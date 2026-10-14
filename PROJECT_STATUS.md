# Project Status

> **Responsabilidad canónica:** fotografía breve del último estado integrado y
> publicado. Los estados oficiales de reglas viven únicamente en
> [`docs/rules/registry.md`](docs/rules/registry.md).

## Estado actual

- Rama de integración: `master`.
- Última vertical funcional implementada: D-5 Editor Táctico de Mapas (MVP), conforme a su [NDD canónico](docs/designs/map-builder-mvp/design.md) y [plan](docs/designs/map-builder-mvp/implementation-plan.md); **CERRADA y TÉCNICAMENTE APROBADA** (Architecture Review sobre commit `6fd385b42b4dc51b8dcbb195108d7051a600944f`).
- Última decisión arquitectónica: Sprint D-1B Capítulo 7 (Integration & Implementation Contracts) y NDD de Demo Táctica Automática (`f8c0e9d`).
- Implementación integrada: D-5 (remediado en D-5R1/R2/R3) cierra exhaustivamente todos los requisitos de arquitectura: Candidate Board validation pura sin mutación previa al commit, invariante estricta de compresión `srd_squeezing` (comparación canónica de coordenadas `x, y, zFeet` sin permitir rotación o desplazamiento de la huella comprimida); máquina de estados Save/Error/ACK con limpieza de errores viejos y verificación de `room-update` posterior a la petición; gating del modal de confirmación crítica durante la edición del mapa; métricas y logs de pilares corregidos a `loe-only` (excluyendo muros); y suite E2E WebSocket con cobertura de `update-board`.
- Última remediación de infraestructura: D-1B-I5R2 vincula la resolución a su actor canónico y verifica vigencia espacial, movilidad efectiva y fuentes de presupuesto; **READY FOR ARCHITECTURE REVIEW**. I5 no está cerrado e I6 permanece bloqueado.
- Baseline de código: 701 tests unitarios, `typecheck`, `build`, `e2e-websocket` (110/110) y 16 tests Playwright UI al 100% en verde.
  Conteos y evidencias se mantienen en [master-coverage.md](docs/testing/master-coverage.md), no como un segundo registro aquí.
- GitHub Actions sobre Windows es el gate canónico de cierre para la revisión
  publicada.

## Integración de D-1B

| Etapa | Estado comprobado en el código |
|---|---|
| I1 — Movement Context | Integrado en creación/reinicio de turno y snapshots; el flujo productivo todavía no incrementa el contador. |
| I2 — Movement Cost | Assessment puro implementado; soporte de Squeezing y separación base/coste agregados en I5R1; consumido por I4. |
| I3 / I3R1 — Route Validation | Integrado: `validateMovePath` delega legalidad a `validateRouteLegality`; extracción sin el ciclo detectado en I3. |
| I4 — Movement Resolution | Pipeline puro de validación/coste/verificación de presupuesto; I5R2 conserva combatantId y evidencia canónica espacial y de movilidad/presupuesto. |
| I5 / I5R1 / I5R2 — Movement Commit | Rechaza actor sustituido, clon detached y reglas obsoletas antes de mutar; mantiene guardas I5R1 y separación coste/base. READY FOR ARCHITECTURE REVIEW, sin cierre formal ni consumidores productivos. |

La presentación incorpora un **renderer WebGL táctico 2.5D** con respaldo `2D`, cámara orbital limitada, cuatro presets y sprites pixel-art, estrictamente desacoplado sobre el grid autoritativo 2D con huellas multicasilla. No es todavía el motor espacial 3D normativo: las alturas visuales son cosméticas y los NDD espaciales siguen siendo el destino de migración mecánica. CI verde no significa V1 completa.

## Capacidades del código

El monorepo contiene:

- paquete compartido de tipos, catálogos, reglas y proyecciones;
- servidor Express/WebSocket autoritativo;
- cliente React/Vite que consume las mismas proyecciones compartidas;
- capa de presentación táctica 2.5D (`TacticalScene3D.tsx`) con Three.js, cámara ortográfica orbital por arrastre, presets `NO/NE/SE/SO`, zoom acotado, sprites PNG pixel-art originales con filtrado nearest-neighbor, meshes volumétricos, picking y fallback 2D automático, sin alterar reglas ni autoridad del servidor;
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
