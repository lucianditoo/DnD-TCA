# Walkthrough — Sprint 052B (Line of Effect + Cobertura Total)

## Objetivo

Corregir la contradicción confirmada en Sprint 052/052A: `getAttackLineInterception`
(Sprint 042) consultaba `board.impassableCells` y otorgaba Cover (+4 CA) por
obstáculos de terreno, aunque ese uso nunca tuvo un NDD dedicado (Sprint 013 lo
excluyó explícitamente) y confundía dos mecánicas independientes del SRD:
Cover parcial (obstruye parte de la línea, +2 a +4 CA, el ataque igual se
intenta) y Cobertura Total (ninguna línea llega al objetivo, el ataque no
puede intentarse en absoluto). Ver
`docs/designs/terrain-cover-line-of-effect-decision.md` (Sprint 052A) para la
auditoría y la comparación de alternativas que llevó a la Opción A elegida
aquí.

## Qué se separó: `impassableCells` vs `lineOfEffectBlockingCells`

`Board.impassableCells` queda restringido exclusivamente a movimiento (Bull
Rush, corte de esquinas, pathing) — su semántica original. Se agrega un campo
independiente `Board.lineOfEffectBlockingCells` que representa obstrucción
física real para Line of Effect/Cobertura Total. No existe inferencia entre
ambos campos: una celda puede estar en uno, en el otro, en ambos o en
ninguno, y cada campo se consulta solo por la función que le corresponde. La
migración no tenía datos de producción que depender: `demoBoard` no declara
`impassableCells`, no existe editor de tablero en la UI, y los únicos usos
previos eran ~15 fixtures de test (confirmado en la auditoría de Sprint 052A).

## Corrección de Cover: solo interposición de criaturas

`getAttackLineInterception` ya no consulta `impassableCells`; solo calcula
`creatureBlockerIds`. `buildCoverAssessment` se simplifica: `kind` es
`"creature-cover"` o `"none"`, nunca más `"terrain-cover"`. Se retiran por
completo (no se conservan por compatibilidad hipotética):
`CoverKind: "terrain-cover"`, `CoverAssessment.blockedCellKeys` y
`AttackLineInterception.terrainBlockedCellKeys`. `ActionsPanel.tsx` (3 sitios)
y `tests/cover-reach.test.mjs`/`tests/flanking.test.mjs` se corrigieron para
reflejar que Cover ya no puede originarse en terreno.

## `getLineOfEffect` — implementación independiente

Nueva función en `rules.ts`, deliberadamente **sin reutilizar** la geometría de
`getAttackLineInterception` (son preguntas distintas: Cover pregunta "¿hay un
+4 disponible?", Line of Effect pregunta "¿se puede siquiera intentar el
ataque?"). Reimplementa el mismo tipo de matemática de colinealidad (producto
cruzado/punto para detectar un punto interior exacto de un segmento) como un
closure local separado.

Regla de footprints multicasilla (Fase 1, aplicable a huellas Large/Huge):
**existe Line of Effect si al menos un par de celdas ocupadas (una del
atacante, una del objetivo) tiene un segmento sin bloqueadores interiores**.
Solo hay Cobertura Total si **todos** los pares posibles están bloqueados —
generalización directa del principio SRD "puede elegir cualquier casilla que
ocupa". Para las criaturas 1×1 del catálogo actual esto colapsa al mismo par
único que Cover ya usaba. `zFeet`/altura se ignora deliberadamente (misma
simplificación que ya tenía `getAttackLineInterception`; queda como pregunta
abierta documentada, no como omisión silenciosa).

`LineOfEffectAssessment` es un contrato mínimo:
`{ hasLineOfEffect: boolean; blockedCellKeys: readonly string[] }` — sin un
campo `applies` ambiguo.

## Legalidad de objetivo en el ataque real

`handleResolveAttackDraft` (`attackCommands.ts`) gana un chequeo nuevo
inmediatamente después de `createCombatRulesSnapshot(room)` y antes de
cualquier tirada, consumo de munición o mutación: si `getLineOfEffect` reporta
`hasLineOfEffect: false`, se lanza un `Error` (misma convención que el resto
del archivo, sin inventar un segundo formato de respuesta) y el ataque nunca
llega a `resolveAttack`. Alcance de este sprint: **solo** el camino ordinario
de `resolve-attack`; ataques de oportunidad, Cargas, conjuros/aptitudes y
Coup de Grace quedan fuera — de ahí que `DEFENSE-LINE-OF-EFFECT` se registre
como **Parcial**.

## Tests

- `tests/line-of-effect.test.mjs` (nuevo, 17 casos): línea despejada, un
  bloqueador, varios bloqueadores, obstáculo fuera del segmento,
  horizontal/vertical/diagonal, adyacencia (sin punto interior posible),
  claves inválidas/duplicadas, dos escenarios de footprint multicasilla Large
  (al menos un par despejado → LoE; todos los pares bloqueados → Cobertura
  Total, usando un destino calculado por búsqueda numérica de mínimo común
  divisor para que las 4 esquinas del footprint compartan un punto lattice
  interior real), independencia de `impassableCells` en ambos sentidos, y
  transporte correcto del campo por `createCombatRulesSnapshot`.
- `tests/line-of-effect-server.test.mjs` (nuevo, 4 casos de integración de
  servidor, mismo patrón que `tests/attack-rules.test.mjs`): ataque con LoE
  se resuelve normal; ataque sin LoE se rechaza antes de cualquier tirada o
  mutación (verificado con un `diceRoller` que lanza si llega a invocarse,
  probando que el RNG nunca se consume); la Cobertura Total no oculta ni
  reemplaza el control de turno existente (un actor no autorizado sigue
  siendo rechazado por autorización, con o sin bloqueadores de LoE).
- `tests/cover-reach.test.mjs`/`tests/flanking.test.mjs`: 9 aserciones que
  dependían de `impassableCells` produciendo `terrain-cover` se reescribieron
  (algunas sustituyendo el obstáculo por un aliado interpuesto, para conservar
  la intención original del test de ejercitar un Cover real no trivial).
- `scripts/e2e-websocket.mjs`: nuevo bloque que confirma el camino positivo
  (Line of Effect presente, tablero demo sin obstáculos) resuelve el ataque
  normalmente. El camino de rechazo **no** se agrega aquí — no existe comando
  ni editor para fijar `board.lineOfEffectBlockingCells` sobre una sala viva,
  y construir uno solo para este caso habría sido el "editor de mapas" que
  este sprint excluye explícitamente. Ese camino queda cubierto con rigor por
  integración directa de servidor (ver arriba), documentado en el propio
  script.

## Documentación sincronizada

`docs/rules/registry.md`: nueva fila `DEFENSE-LINE-OF-EFFECT` (Parcial) y
corrección de la fila `DEFENSE-COVER` (ya no menciona "obstáculos completos").
`PROJECT_STATUS.md`, `TODO.md`, `docs/testing/master-coverage.md`: entradas
nuevas para Sprint 052A/052B y corrección de la afirmación histórica de
Sprint 042 sobre `impassableCells` y Cover. `docs/designs/vision-and-line-of-effect-architecture.md`
y `docs/designs/terrain-cover-line-of-effect-decision.md`: contradicción y
decisión marcadas como resueltas/implementadas. Sin cambios en
`docs/technical-debt.md` (no apareció deuda nueva ni se cerró ninguna
existente).

## Validación (DoD completo, ejecutado de verdad)

| Comando | Resultado |
|---|---|
| `npm test` | ✅ **498/498**, 0 fallos (56 archivos) |
| `npm run typecheck` | ✅ 0 errores (3 workspaces) |
| `npm run build` | ✅ los 3 workspaces en verde (Vite compila 1660 módulos) |
| `node scripts/e2e-websocket.mjs` | ✅ **99/99** aserciones, exit 0 |
| `npm run test:ui` (Playwright) | ✅ **7/7** escenarios (sin cambios: no existe editor de tablero para un escenario visual nuevo de Cobertura Total) |

## Alcance explícitamente excluido (sin cambios)

Conjuros/AoE, amenaza de Ataques de Oportunidad, Coup de Grace, Visión y
Línea de Visión (perspectiva del observador, iluminación, `blindsight`),
altura/`zFeet` en la geometría de Line of Effect, editor de tablero/mapas,
persistencia de `lineOfEffectBlockingCells` fuera del `Board` ya existente.

## Estado y próximo paso

Sprint 052B cerrado formalmente. `DEFENSE-LINE-OF-EFFECT` queda **Parcial**:
cubre únicamente ataques físicos ordinarios. Conjuros/AoE, amenaza de AdO y
la arquitectura completa de Visión (`docs/designs/vision-and-line-of-effect-architecture.md`)
siguen pendientes de sprints propios.
