# PROJECT_MEMORY — Contexto compacto

> Estado vigente: [`PROJECT_STATUS.md`](../PROJECT_STATUS.md) · Rule IDs:
> [`docs/rules/registry.md`](../docs/rules/registry.md) · Pendientes:
> [`TODO.md`](../TODO.md)

## Producto y autoridad

Aplicación web local para dirigir combates tácticos de D&D 3.5. React envía
intenciones por WebSocket; el servidor valida ownership, reglas y mutaciones,
y publica el único estado autoritativo.

```text
apps/server/      autoridad, comandos y commits de sala
apps/web/         interacción y preview sin autoridad
packages/shared/  contratos, catálogos, snapshots y reglas puras
tests/            regresión unitaria/integración
scripts/          E2E WebSocket
combat/           corpus normativo funcional
docs/             arquitectura, NDD, Registry y evidencia
```

## Fronteras que no deben confundirse

- Un perfil guarda fuentes permanentes; un combatiente guarda estado temporal
  de encuentro; `CombatRulesSnapshot` es una proyección inmutable para reglas.
- El cliente nunca aporta estadísticas derivadas, porcentajes defensivos ni
  resultados RNG como autoridad.
- Catálogos declaran fuentes. ActiveEffects declara contribuciones.
  `EffectReducer` reduce; las reglas proyectan valores efectivos; los
  resolvers calculan; los handlers realizan el commit.
- Cover, Line of Effect, Vision y Concealment son assessments distintos.
  `impassableCells` pertenece a movimiento. Cover surge de criaturas
  interpuestas; los obstáculos completos viven en Line of Effect.
- La UI y el servidor consumen helpers/proyecciones compartidas, pero el
  servidor siempre recalcula antes de mutar.

## Pipeline transversal

La arquitectura canónica vive en
[`docs/designs/modifier-pipeline-architecture.md`](../docs/designs/modifier-pipeline-architecture.md):

```text
Intención → Preflight → Operación base → Contribuciones → Contexto
→ Proyección efectiva → Resolver → Consecuencias → Commit
```

No crear modificadores universales, variantes `-V2` de Rule IDs ni ramas por
`effectId` dentro de handlers/resolvers para implementar condiciones.

## Validación

La evidencia del último baseline vive únicamente en
[`docs/testing/master-coverage.md`](../docs/testing/master-coverage.md).
Los gates operativos están definidos en
[`.agents/AGENTS.md`](../.agents/AGENTS.md) y resumidos en
[`WORKFLOW.md`](WORKFLOW.md). GitHub Actions es el gate canónico cuando el
sandbox local no puede ejecutar procesos de navegador o servicios.

## Memoria estable

- Servidor autoritativo: [`ADR-0001`](../docs/adr/ADR-0001-server-authoritative.md).
- Ownership: [`ADR-0002`](../docs/adr/ADR-0002-ownership-in-server.md).
- EquipmentCatalog: [`ADR-0003`](../docs/adr/ADR-0003-equipment-catalog-source-of-truth.md).
- Perfil vs. combate: [`ADR-0004`](../docs/adr/ADR-0004-profile-vs-combat-state.md).
- Separación de Rule Engine: [`ADR-0005`](../docs/adr/ADR-0005-rule-engine-separation.md).
- Testing: [`ADR-0006`](../docs/adr/ADR-0006-testing-culture.md).
- ActiveEffects: [`ADR-0007`](../docs/adr/ADR-0007-active-effects-core.md).
- Anclas temporales: [`ADR-0008`](../docs/adr/ADR-0008-temporal-anchor-semantics.md).
