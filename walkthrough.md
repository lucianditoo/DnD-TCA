# Walkthrough — Sprint 055B (Opportunity Attacks: Cover & Concealment Enforcement)

## Objetivo

Implementar exactamente el NDD aprobado en Sprint 055A
(`docs/designs/vision-and-line-of-effect-architecture.md` §14): Line of
Effect, Cover (cualquier grado) y Ocultación Total ahora gatean la
**generación** de un Ataque de Oportunidad, consumiendo exclusivamente los
assessments ya existentes, sin recalcular ninguno.

## Implementación

### Nueva función pura: `getOpportunityAttackLegality`

`packages/shared/src/rules.ts` gana `getOpportunityAttackLegality(room,
reactor, provoker): OpportunityAttackLegality` (nuevo tipo en `types.ts`,
`{ allowed: boolean; reason: "clear"|"no-line-of-effect"|"cover"|
"total-concealment" }`). Responde exclusivamente "¿puede el reactor intentar
este AdO concreto contra este provocador?" — nunca calcula amenaza,
provocación ni daño. Compone, en este orden de precedencia (Line of Effect
primero, más fundamental — mismo orden ya establecido para ataques
declarados desde Sprint 052B/053B):

1. `getLineOfEffect(room, reactor, provoker)` — sin línea de efecto, no hay
   capacidad física real de atacar.
2. `getAttackContextModifiers(room, reactor, provoker)` — una sola llamada
   que ya trae Cover **y** Concealment compuestos; se lee
   `.byAttackType.melee.cover.applies` (cualquier grado bloquea el AdO,
   regla más estricta que para ataques normales) y
   `.byAttackType.melee.concealment.opportunityAttackAllowed` (ya deriva
   `!total` desde Sprint 053B — Ocultación parcial nunca bloquea, solo
   Ocultación Total).

Cero llamadas nuevas a `getConcealmentAssessment`/`getAttackLineInterception`
— todo pasa por las funciones canónicas ya existentes.

### Wiring en los dos call sites de generación

- `findTriggeredOpportunityAttacksForPath` (`rules.ts`, disparo por
  movimiento): antes de empujar una oportunidad, se evalúa
  `getOpportunityAttackLegality(room, reactor, moverAtOrigin)`, donde
  `moverAtOrigin` es un proxy efímero (`{ ...mover, position: origin }`) con
  la posición exacta de la casilla abandonada en ese paso del trayecto —
  `mover.position` en el snapshot es la posición inicial de todo el
  recorrido, no la casilla concreta de un paso intermedio. Un reactor
  rechazado en un paso **no** se marca como "ya disparado" — puede volver a
  intentarlo en un paso posterior si las condiciones cambian (ej. el
  provocador sale de detrás de un obstáculo), coherente con que un AdO
  rechazado nunca "se gasta".
- `findTriggeredRangedOpportunityAttacks`
  (`apps/server/src/combat/opportunityAttackResolver.ts`, disparo por ataque
  a distancia/conjuro): un `.filter()` adicional aplica el mismo gate sobre
  el snapshot ya existente, sin cambios de posición (escenario de snapshot
  único, sin aproximación de trayecto).

### Sin cambios

`CoverAssessment`, `ConcealmentAssessment`, `VisionAssessment`,
`LineOfEffectAssessment` y su fórmula quedan intocados. `srd_blinded`
conserva su trait `CANNOT_MAKE_AOO` sin cambios (decisión explícitamente
diferida en el NDD §14.9, no se resuelve en este sprint). No se toca
`handleResolveOpportunityAttack` (ejecución) — tras el gate en generación,
`pendingOpportunityAttacks` nunca contiene un AdO ilegal, y el encargo de
este sprint solo pedía el gate "antes de generarse".

## Tests (6 mínimos requeridos, 12 entregados)

Nuevo `tests/opportunity-attack-legality.test.mjs`:

- **Unitarios sobre `getOpportunityAttackLegality`** (5): sin Cover/sin
  Concealment/con LoE → `allowed`/`clear`; LoE rota → `no-line-of-effect`;
  Cover por criatura interpuesta → `cover`; Ocultación Total (oscuridad
  fuera de Darkvision) → `total-concealment`; Ocultación parcial (luz
  tenue) → `allowed`/`clear` (nunca bloquea).
- **Integración `findTriggeredOpportunityAttacksForPath`** (5): regresión
  sin Cover/Concealment (genera normal); Cover interpuesto (no genera); Total
  Concealment (no genera); LoE rota (no genera); Concealment parcial (sigue
  generando).
- **Integración `findTriggeredRangedOpportunityAttacks`** (2): regresión sin
  Cover/Concealment; Cover interpuesto (no genera).

Fixtures geométricas notables: para que un bloqueador de Cover/LoE no sea,
él mismo, un reactor válido con un tiro limpio, el reactor real necesita un
arma con alcance (lanza larga, 5–10 ft) para amenazar a 10 ft con el
bloqueador exactamente en el punto medio (5 ft) — a distancia adyacente no
existe ninguna casilla intermedia real donde colocar un bloqueador.

## Validación (DoD completo, ejecutado de verdad)

| Comando | Resultado |
|---|---|
| `npm test` | ✅ **559/559**, 0 fallos (59 archivos) |
| `npm run typecheck` | ✅ 0 errores (3 workspaces) |
| `npm run build` | ✅ los 3 workspaces en verde |
| `node scripts/e2e-websocket.mjs` | ✅ **100/100** aserciones, exit 0 (sin regresión) |
| `npm run test:ui` (Playwright) | ✅ **7/7** escenarios (sin cambios de UI) |
| `git diff --check` | ✅ sin problemas de espacio en blanco |

## Documentación sincronizada

`docs/rules/registry.md`: `DEFENSE-COVER`, `DEFENSE-LINE-OF-EFFECT` y
`DEFENSE-CONCEALMENT` actualizadas con su nuevo rol como gate de legalidad de
AdO; nota nueva explicando por qué **no** se abrió una Rule ID nueva (no es
una regla autónoma del SRD, es la integración de tres reglas ya
registradas — política de Sprint 044.1). `PROJECT_STATUS.md`/`TODO.md`/
`ROADMAP.md`: AdO retirado de la lista de pendientes de la vertical
Vision/Line of Effect/Concealment. `docs/testing/master-coverage.md`:
entrada nueva con el detalle de los 12 casos.

## Estado

Sin deuda técnica nueva. `srd_blinded.CANNOT_MAKE_AOO` sigue siendo
redundante-pero-inofensivo con el nuevo gate (decisión de si retirarlo queda
explícitamente diferida, NDD §14.9). Ninguna Rule ID nueva — ver
justificación en `docs/rules/registry.md`.
