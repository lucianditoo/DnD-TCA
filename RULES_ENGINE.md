# Rules Engine — Guía de responsabilidades

Responsabilidad: Orientar sobre las fronteras del motor sin duplicar su inventario de reglas.
Autoridad: Derivada
Lifecycle: Permanente
Reemplaza: —
Complementa: [Arquitectura del motor](docs/architecture/combat-engine.md)
Consumidores: Desarrolladores que necesitan localizar las responsabilidades del motor.

## Separación estable

- **Fuentes:** perfiles, características y referencias a catálogos.
- **Proyección:** snapshots defensivos y funciones compartidas que derivan estadísticas y assessments.
- **Resolución:** el servidor valida intenciones y resuelve las consecuencias; el cliente no es autoridad.
- **Presentación:** React consume las proyecciones compartidas para mostrar resultados y previews.

Un perfil permanente no es el estado vivo de combate. `CombatantSnapshot`
y `CombatRulesSnapshot` tienen responsabilidades distintas; su contrato se
consulta en [combatSnapshot.ts](packages/shared/src/combatSnapshot.ts) y en el
[NDD de snapshots](docs/designs/combat-room-snapshot.md).

## Autoridades que se deben consultar

- Reglas implementadas, parciales y limitaciones: [Rule Registry](docs/rules/registry.md).
- Estado de la integración actual: [PROJECT_STATUS.md](PROJECT_STATUS.md).
- Evidencia de pruebas: [master-coverage.md](docs/testing/master-coverage.md).
- Composición de reglas: [pipeline de modificadores](docs/designs/modifier-pipeline-architecture.md).
- ActiveEffects: [contratos y arquitectura](docs/architecture/active-effects/).
- Mapa de módulos: [.ai/FILE_INDEX.md](.ai/FILE_INDEX.md).

Este archivo no mantiene una segunda lista de capacidades o pendientes.

## Lectura del modelo espacial

El [NDD espacial](docs/designs/spatial-engine-2.5d.md), [D-1R1](docs/designs/normative-spatial-geometry.md),
[D-1A](docs/designs/normative-area-shape-projection.md) y [D-1B](docs/designs/normative-movement-design.md)
definen el destino normativo, no certifican por sí solos su implementación.
La existencia de esos diseños no significa que el Board productivo ya tenga
superficies superpuestas o prismas corporales. Para saber qué está conectado
al juego, consultar exclusivamente el estado de integración y el código
citado allí.

## Testing y trabajo

El Reader Pipeline y el Definition of Done viven en
[.agents/AGENTS.md](.agents/AGENTS.md). Los estados oficiales no se deducen
de ejemplos, del nombre de un sprint ni de la mera existencia de un NDD.
