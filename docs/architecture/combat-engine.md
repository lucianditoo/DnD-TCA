# Arquitectura del Combat Engine

## Responsabilidad

Describe las fronteras estables del motor táctico. No gobierna estados de
Rule IDs, prioridades futuras ni evidencia de tests:

- Rule IDs: [`../rules/registry.md`](../rules/registry.md)
- roadmap: [`../../ROADMAP.md`](../../ROADMAP.md)
- evidencia: [`../testing/master-coverage.md`](../testing/master-coverage.md)

## Principios

- El servidor es autoritativo.
- La UI expresa intenciones y consume previews compartidos.
- Catálogos y perfiles guardan fuentes, no resultados derivados.
- `CombatRulesSnapshot` ofrece una vista efímera e inmutable.
- Reglas y assessments compartidos son puros.
- Resolvers matemáticos no recorren ni mutan la sala.
- Command Handlers validan autoridad, orquestan consecuencias y realizan el
  commit transaccional.
- Una regla no se duplica para representar sus modificadores.

## Pipeline oficial

La definición detallada vive en
[`../designs/modifier-pipeline-architecture.md`](../designs/modifier-pipeline-architecture.md):

```text
Intención
  → Preflight
  → Operación base
  → Contribuciones estructurales
  → Contexto efímero
  → Proyección efectiva
  → Resolver
  → Consecuencias
  → Commit
```

### Intención y preflight

El comando WebSocket expresa qué quiere hacer el actor. Zod valida la forma;
auth valida ownership y control; el handler verifica fase, economía,
recursos y legalidad antes de RNG o mutación.

### Operación base y contribuciones

La regla base conserva identidad propia. Efectos, condiciones, feats, equipo,
tamaño y contexto aportan contratos especializados; no crean versiones de la
regla ni un `UniversalModifier`.

### Contexto y assessments

Los helpers de `packages/shared/src/rules.ts` proyectan el escenario concreto.
Cover, Line of Effect, Vision y Concealment son assessments independientes:

- Cover: criatura consciente interpuesta, +4 CA.
- Line of Effect: obstáculo completo; puede impedir el intento.
- Vision: geometría visual, iluminación y percepción.
- Concealment: miss chance y targeting, compuesto desde fuentes declarativas
  y Vision.

`impassableCells` es una fuente de movimiento; no produce Cover.

### Resolver y commit

El resolver recibe valores y assessments ya construidos, usa RNG inyectable y
devuelve un resultado. El handler aplica HP, recursos, efectos, turno y logs
en una transacción, sincroniza la fase y publica la sala.

## Capas y sedes

| Capa | Sede | Responsabilidad |
|---|---|---|
| Contratos | `packages/shared/src/types.ts`, `schemas/` | datos y comandos |
| Fuentes | catálogos, perfiles, `EffectDefinition` | datos declarativos |
| Estado | `CombatRoom`, `EffectInstance` | estado temporal autoritativo |
| Snapshot | `combatSnapshot.ts` | proyección inmutable |
| Reducción | `effects/reducer.ts` | stacking y contribuciones |
| Reglas | `rules.ts` | proyecciones y legalidad pura |
| Resolver | `apps/server/src/combat/` | matemática/RNG sin commit |
| Handler | `apps/server/src/commands/` | auth, orquestación y commit |
| Preview | `apps/web/src/` | consumo de proyecciones compartidas |

## Ejemplo: ataque físico

1. React envía `resolve-attack` con intención de objetivo.
2. El servidor valida schema, control, turno y rutina.
3. El handler crea el snapshot.
4. Evalúa Line of Effect, Vision/Concealment, Cover y modificadores
   contextuales.
5. `attackResolver.ts` calcula impacto, ocultación, crítico y daño sin mutar
   la sala.
6. El handler aplica consecuencias en el draft y confirma el commit.
7. `syncEncounterPhase` y broadcast exponen el nuevo estado.

## Antipatrones

- ramas por `effectId`, `spellId` o condición en handlers/resolvers;
- fórmulas distintas en React y servidor;
- valores derivados persistidos o aceptados desde la red;
- resolvers leyendo posiciones, catálogos globales o `CombatRoom`;
- mutaciones parciales antes de completar preflight/resolución;
- `ATTACK-FULL-V2` u otra Rule ID de versión;
- usar Cover como sustituto de Line of Effect o Vision.

## Cómo agregar una regla

Seguir [`../../GOVERNANCE.md`](../../GOVERNANCE.md) y
[`../../.agents/AGENTS.md`](../../.agents/AGENTS.md). Antes de diseñar:

1. localizar la regla normativa en `combat/`;
2. buscar su Rule ID en el Registry;
3. identificar la operación base y contratos especializados reutilizables;
4. diseñar servidor, shared, UI y tests como una sola vertical;
5. documentar cualquier divergencia en
   [`../audits/combat-rules-deviations.md`](../audits/combat-rules-deviations.md).
