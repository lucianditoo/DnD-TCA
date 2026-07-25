# Walkthrough — Sprint 053B.1 (Revisión arquitectónica de Vision)

## Resultado de la revisión 053B.1

La arquitectura publicada en Sprint 053B queda aprobada: Vision permanece
como assessment contextual independiente, se compone con Concealment por
severidad máxima, Line of Effect conserva precedencia en la legalidad del
intento y el servidor sigue siendo la única autoridad para resolver una
casilla elegida a ciegas.

La revisión detectó y corrigió una desviación normativa acotada:
`getVisionAssessment` trataba cualquier Darkvision positiva como suficiente
para anular la ocultación parcial de luz tenue. Ahora la capacidad se aplica
solo si la distancia entre footprints es menor o igual a
`darkvisionFeet`, igual que en oscuridad total. Se añadieron casos explícitos
dentro y fuera de alcance. No se abrió ninguna Rule ID y
`DEFENSE-VISION` conserva estado **Parcial**.

## Objetivo

Implementar la primera vertical funcional de Vision descrita en el NDD
aprobado (`docs/designs/vision-and-line-of-effect-architecture.md` §13,
cerrado tras Sprint 053/053A/053A.1/053A.2): iluminación básica (luz tenue,
oscuridad total), Darkvision, y targeting a ciegas contra Ocultación Total
(objetivo por casilla en vez de por combatiente), sin filtrar información al
atacante sobre si la casilla elegida estaba vacía o si el fallo fue por CA o
por Concealment.

## Contradicción detectada en el precondition gate

El primer prompt de implementación recibido para este sprint redeclaraba
`VisionReason` con un conjunto distinto (`visible|darkness|blocked-visual-path|
unknown-target-square`) y prohibía explícitamente implementar Darkness y
Darkvision — contradiciendo directamente el NDD ya aprobado, que cierra
`VisionReason` como `clear|dim-light|darkness|blocked-visual-path|
darkvision-out-of-range` y exige exactamente esas dos mecánicas. Siguiendo la
instrucción explícita del propio prompt ("si aparece una contradicción,
detener inmediatamente, no improvisar, documentar evidencia"), el sprint se
detuvo, se presentó la evidencia citando las líneas exactas del NDD, y se
esperó resolución. El usuario confirmó que el NDD aprobado es la fuente de
verdad y reemplazó el prompt íntegramente por uno corregido — el trabajo real
de este sprint parte de ese segundo prompt.

## Decisiones de arquitectura seguidas del NDD

- **`VisualPathAssessment`** (capa geométrica interna) es hermana de
  `LineOfEffectAssessment`, nunca un alias ni una redefinición del término
  normativo "Line of Sight". Se extrajo mecánicamente el cuerpo de
  `getLineOfEffect` en un helper privado compartido
  (`computeSupercoverPathAssessment`), reutilizado por ambas funciones sin
  duplicar el recorrido "supercover" de Sprint 052B.1. Ambas comparten
  provisionalmente `Board.lineOfEffectBlockingCells` como fuente de datos,
  autorizado explícitamente por el NDD (§13.5) hasta que exista un modelo de
  obstrucción visual independiente.
- **`IntrinsicPerception`** es exactamente `{ darkvisionFeet: number }`, sin
  `lowLightVision` — infraestructura sin consumidor real es el mismo error
  que este proyecto ya evitó una vez con `impassableCells`/Cover.
- **`getVisionAssessment`** implementa las 5 reglas de precedencia exactas del
  NDD (ruta bloqueada → oscuridad sin Darkvision → oscuridad fuera de rango de
  Darkvision → luz tenue sin Darkvision → claro), con oscuridad dominando
  sobre luz tenue en celdas superpuestas.
- **Composición con `ConcealmentAssessment`**: severidad máxima nunca
  aditiva (`total > partial > none`), miss chance del severity ganador
  (nunca se suman 20%+50%), `traces` (efectos) y `visionTraces` (Vision) se
  conservan por separado sin sintetizar un `EffectInstance` falso.
- **`resolve-attack`** se extendió con `target: {kind:"combatant"}|
  {kind:"square"}` (unión discriminada con XOR en el schema Zod) — un solo
  comando, no comandos paralelos (`resolve-blind-attack` explícitamente
  descartado por el NDD sin evidencia arquitectónica fuerte).

## Hallazgo arquitectónico real durante la implementación

Una regresión existente (`tests/line-of-effect-server.test.mjs`, "ataque
rechazado por Cobertura Total") falló al implementar el gate de targeting
directo por Vision dentro de `resolveAttackIntent`: como `VisualPathAssessment`
comparte hoy la misma fuente de datos que `LineOfEffectAssessment`, cualquier
escenario sin Line of Effect también aparece sin Vision, y el mensaje de
error equivocado ("Ocultación Total... elija casilla" en vez de "Cobertura
Total") aparecía primero. Causa raíz: Cobertura Total es un bloqueador más
fundamental que Ocultación Total y debe evaluarse primero. Corregido moviendo
el gate de Vision fuera de `resolveAttackIntent` (que ahora solo resuelve
quién es el objetivo) hacia `handleResolveAttackDraft`, inmediatamente
después del gate de Line of Effect ya existente. Verificado con la suite
completa (510 tests previos, todos en verde de nuevo).

## Consecuencia correcta e intencional (no una regresión)

`ConcealmentAssessment.directTargetingAllowed`/`requiresTargetSquare` existen
como campos de tipo desde Sprint 046, pero ningún handler los hacía cumplir
hasta este sprint. Al aplicarlos por primera vez en `attackCommands.ts`, un
atacante Cegado (cuya propia Ocultación Total ya era declarativa desde
Sprint 047) también queda obligado a atacar por casilla en vez de por
`targetId` directo — consistente con la regla SRD (un atacante ciego tampoco
puede ver a su objetivo) y con el propio alcance aprobado del NDD. Un test de
regresión propio y el escenario "Blinded" de `scripts/e2e-websocket.mjs` se
actualizaron para reflejar este comportamiento correcto en vez de tratarlo
como un bug a evitar.

## Bug real corregido en el propio E2E script

Al actualizar el escenario "Blinded" de `scripts/e2e-websocket.mjs` para usar
`target: {kind:"square"}`, la variable `blindedEnemy` usada para leer la
posición del objetivo había sido capturada (`.find(...)`) **antes** de un
`gm-move-combatant` posterior que reposicionaba a ese mismo combatiente — al
usar `blindedEnemy.position` directamente se enviaba la posición de spawn
obsoleta, no la posición real tras el movimiento. Corregido re-obteniendo el
combatiente fresco (`gmBlinded.room.combatants.find(c => c.id ===
blindedEnemy.id)`) inmediatamente antes de construir el comando, siguiendo el
mismo patrón ya usado en otros escenarios del script (`stoppedBane`,
`diagonalStoppedBane`).

## Tests

- `tests/vision-core.test.mjs` (19 casos): 12 unitarios de `getVisionAssessment`
  (luz normal, luz tenue, oscuridad sin/con/fuera-de-rango de Darkvision, ruta
  bloqueada, ambas precedencias, trazas/`dominantReason`, transporte por
  Snapshot) + 7 de composición con `ConcealmentAssessment` (incluye Vision
  parcial + Blinded total vía pipeline real con `srd_blinded`, múltiples
  fuentes totales sin sumar 50%, AdO bloqueado).
- `tests/blind-targeting-server.test.mjs` (15 casos): targeting directo
  permitido en luz normal/tenue, rechazado en oscuridad total; targeting por
  casilla ocupada, cualquier celda de una criatura Large, casilla vacía
  (consume intento/acción/munición, sin revelar el motivo del fallo, sin
  mutar HP, sin amenaza de crítico); regresiones de Line of Effect, Cobertura
  +4, Blinded exigiendo casilla, `targetId` legado sin cambios, tirada manual
  y AUTO.

## Documentación sincronizada

`PROJECT_STATUS.md` (nueva sección "FASE ACTUAL"), `TODO.md` (nueva entrada en
Sprints Completados + bloque `Sprint 053B — COMPLETADO`), `ROADMAP.md`
(estado de base actualizado, conteo de Rule IDs 53→54, ítem 4 del roadmap
actualizado), `docs/testing/master-coverage.md` (nueva entrada E2E/unitaria),
`docs/rules/registry.md` (nueva Rule ID `DEFENSE-VISION`, Parcial;
`EFFECT-BLINDED` y `DEFENSE-LINE-OF-EFFECT` corregidas para reflejar que
Vision ya no está pendiente; `DEFENSE-CONCEALMENT` actualizada a Parcial con
Vision como nueva fuente productiva). Sin cambios en
`docs/designs/vision-and-line-of-effect-architecture.md` (el NDD ya estaba
cerrado antes de este sprint, per su propio §13.12) ni en
`docs/technical-debt.md` (no apareció deuda nueva).

## Validación (DoD completo, ejecutado de verdad)

| Comando | Resultado |
|---|---|
| `npm test` | ✅ **544/544**, 0 fallos (58 archivos) |
| `npm run typecheck` | ✅ 0 errores (3 workspaces) |
| `npm run build` | ✅ los 3 workspaces en verde |
| `node scripts/e2e-websocket.mjs` | ✅ **100/100** aserciones, exit 0 |
| `npm run test:ui` (Playwright) | ✅ **7/7** escenarios |
| `git diff --check` | ✅ sin problemas de espacio en blanco |

## Alcance explícitamente excluido (sin cambios respecto del NDD)

Low-Light Vision, Blindsight/Blindsense/Tremorsense, niebla/humo,
invisibilidad, fuentes de luz dinámicas con radio (antorchas), Fog of War,
editor de iluminación, AoE de luz, altura/`zFeet`, y las consecuencias
defensivas/de movimiento de la oscuridad (pérdida de Destreza a la CA, -2 CA,
velocidad mitad, penalizadores de habilidades, interacción con Correr/
Retirada) — ninguna aplicación automática de `srd_blinded` por oscuridad
contextual, ya que la oscuridad depende del observador y del Darkvision de
cada uno, a diferencia de Blinded que es una condición persistente del
combatiente.

## Estado y próximo paso

Sprint 053B.1 cerrado formalmente y arquitectura aprobada. `DEFENSE-VISION` queda **Parcial** con el
alcance exacto declarado en el NDD §13.12. Próximos candidatos bajo gates
propios: política efectiva de AdO bajo Ocultación Total, Low-Light Vision (una
vez exista un modelo de luz con radio), o retomar Line of Effect para
conjuros/AoE — cualquiera de los tres requiere su propio NDD y `Proceed`
explícito antes de implementarse.
