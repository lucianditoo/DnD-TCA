# Walkthrough — Sprint 053B.2 (Corrección del Blind Targeting)

## Objetivo

Cerrar los tres defectos arquitectónicos detectados en la revisión de Sprint
053B, sin agregar mecánicas nuevas ni tocar los contratos de
`VisionAssessment`/`VisualPathAssessment`/`LineOfEffectAssessment`.

## Corrección 1 — El modo casilla ya no es un bypass

Antes, el servidor aceptaba `target.kind = "square"` incluso cuando el
assessment final no exigía `requiresTargetSquare` — cualquier cliente podía
atacar por casilla a un objetivo perfectamente visible. Ahora
`isSquareTargetingJustified` (`rules.ts`) decide la legalidad del modo
casilla usando **solo información que el atacante posee legítimamente**: su
propia Ocultación Total declarativa sobre sus ataques (perspectiva
`attacks_by_target`, ej. `srd_blinded`) o la oscuridad total de la casilla
fuera del alcance de su Darkvision (misma matemática que las reglas 2/3 de
`getVisionAssessment`). Nunca consulta al ocupante — ni la aceptación ni el
rechazo filtran ocupación, y el mensaje de rechazo es idéntico esté la
casilla ocupada o vacía. La luz tenue (ocultación parcial, 20%) no justifica
el modo casilla, exactamente igual que no activa `requiresTargetSquare`
contra un objetivo real.

## Corrección 2 — Line of Effect hacia la casilla, no hacia el ocupante

Antes, la validación de Line of Effect solo corría cuando existía una
criatura en la casilla: una casilla vacía detrás de un muro "se podía
atacar" (consumiendo acción y munición) mientras que la misma casilla
ocupada se rechazaba — esa asimetría era en sí misma una filtración de
ocupación. Ahora la secuencia es: posición elegida → `getLineOfEffectToCell`
(nueva función pura en `rules.ts`, mismo recorrido supercover y misma fuente
de bloqueadores que `getLineOfEffect`, con la celda como destino) → si
falla, rechazo por Cobertura Total con un mensaje que jamás nombra a ningún
combatiente → recién después se resuelve en secreto la ocupación. La
legalidad geométrica ya no depende de que haya o no una criatura. El helper
privado `computeSupercoverPathAssessment` se refactorizó mecánicamente para
aceptar listas de celdas en vez de dos `Combatant` (cero cambios de
algoritmo; `getLineOfEffect` y `getVisualPathAssessment` producen
exactamente lo mismo que antes).

## Corrección 3 — Proyección pública indistinguible

Antes, un ataque por casilla contra una casilla **ocupada** emitía el log
público completo ("Bane realiza ataque simple contra Canocrock… d20… contra
CA… falla por ocultacion total (50%; d100 25)") — revelando presencia,
identidad, CA y el motivo exacto del fallo, mientras la casilla vacía emitía
el genérico "El ataque falla.". Ahora todo ataque en modo casilla usa la
proyección segura (NDD §13.8): en cualquier fallo (casilla vacía, fallo por
CA, fallo por Concealment, 1 natural) el log público es, palabra por
palabra, `"X ataca a una casilla a N ft. El ataque falla."`; un impacto
emite `"…El ataque impacta."` seguido del daño (la presencia revelada por un
impacto es una consecuencia observable legítima). El desglose real (nombre,
CA, d20, d100, motivo) queda solo en el estado autoritativo del servidor.
Para que ningún canal secundario divergiera entre ocupada y vacía, el modo
casilla ahora deriva distancia y tipo de ataque de la **casilla** (no del
footprint del ocupante), usa el mismo chequeo y mensaje de alcance máximo
que el camino vacío, y dispara los AdO por ataque a distancia con la misma
distancia.

## Sin cambios

`VisionAssessment`, `VisualPathAssessment`, `LineOfEffectAssessment`,
`ConcealmentAssessment`, el Snapshot, ActiveEffects, los schemas Zod y la UI
quedaron intactos. El camino de targeting directo (`combatantId`) no cambió
en nada: mismo orden de gates (LoE del objetivo → Vision), mismos mensajes,
mismo log detallado.

## Tests (Corrección 4)

`tests/blind-targeting-server.test.mjs` pasa de 15 a 18 casos:

- **Correcciones 1**: modo casilla rechazado con casilla visible, con
  mensaje idéntico ocupada/vacía (sin filtrar ocupación); la luz tenue no
  justifica el modo casilla.
- **Corrección 2**: Line of Effect evaluada hacia una casilla vacía detrás
  de un muro (rechazo por Cobertura Total sin consumir acción) y mensaje
  idéntico con la misma casilla ocupada.
- **Corrección 3**: el log público de un fallo por CA (1 natural) y de un
  fallo por Concealment (d100=1) contra casilla ocupada es exactamente igual
  al de una casilla vacía a la misma distancia, sin nombre/CA/d20/d100.
- El test previo que codificaba el comportamiento defectuoso ("no es un
  bypass: resuelve igual que targeting directo") se reescribió para
  afirmar el rechazo correcto.

`scripts/e2e-websocket.mjs`: la aserción del escenario Blinded ahora valida
la proyección segura (log genérico de casilla presente, y ausencia de
cualquier log con d20/CA/d100 del ataque por casilla).

## Validación (DoD completo, ejecutado de verdad)

| Comando | Resultado |
|---|---|
| `npm test` | ✅ **547/547**, 0 fallos (58 archivos) |
| `npm run typecheck` | ✅ 0 errores (3 workspaces) |
| `npm run build` | ✅ los 3 workspaces en verde |
| `node scripts/e2e-websocket.mjs` | ✅ **100/100** aserciones, exit 0 |
| `npm run test:ui` (Playwright) | ✅ **7/7** escenarios |
| `git diff --check` | ✅ sin problemas de espacio en blanco |

## Estado

`DEFENSE-VISION` sigue **Parcial** con el mismo alcance declarado; la fila
del Registry registra el cierre de los tres defectos (Sprint 053B.2). Sin
deuda técnica nueva.
