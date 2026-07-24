# Sprint 052A — Decisión: semántica de terreno (`impassableCells` vs Cover vs Line of Effect)

## Resuelto e implementado en Sprint 052B

Las 5 preguntas de la última sección quedaron respondidas y ejecutadas: (1)
Opción A aprobada y adoptada; (2) el campo se llama
`Board.lineOfEffectBlockingCells`, celda por celda, mismo patrón que
`difficultTerrainCells`; (3) se autorizó retirar `terrain-cover` por completo
en el mismo sprint (no como fallback documentado — `CoverKind: "terrain-cover"`
y `AttackLineInterception.terrainBlockedCellKeys` fueron eliminados del código,
no conservados); (4) se abrió `DEFENSE-LINE-OF-EFFECT` como Rule ID separada de
`DEFENSE-COVER`, estado Parcial; (5) Sprint 052B implementó el plan completo en
un único sprint (no quedó pendiente de un sprint posterior). El detalle de la
implementación vive en `walkthrough.md` (Sprint 052B) y en
`docs/designs/vision-and-line-of-effect-architecture.md` §1.3/§1.3.1. El resto
de este documento se conserva sin cambios como registro histórico de la
auditoría y la comparación de alternativas que fundamentaron la decisión.

**Adenda (Sprint 052B.1)**: la implementación inicial de `getLineOfEffect`
(Sprint 052B) tenía un bug geométrico real, no cubierto por esta auditoría de
semántica de terreno — probaba colinealidad exacta del ANCLA entera de una
celda bloqueadora, en vez de si el segmento atraviesa el ÁREA de esa celda.
Corregido en Sprint 052B.1 (recorrido "supercover" por área de celda); ver
`docs/designs/vision-and-line-of-effect-architecture.md` §1.3.1 y
`walkthrough.md` (Sprint 052B.1) para el detalle. Esta decisión de semántica
de campos (`impassableCells` vs `lineOfEffectBlockingCells`) no se vio
afectada por esa corrección — solo cambió la geometría interna de
`getLineOfEffect`.

## Estado real (verificado en código, no en documentación)

`impassableCells` es un `string[]` de claves `"x,y"` en `Board` (`types.ts:29`),
sin ninguna metadata adicional (sin altura, material u opacidad declarada).
Hoy alimenta, sin distinción de tipo de obstáculo, **cuatro** consumidores
independientes:

1. **Movimiento** (`roomState.ts:171`, `viewModel.ts:74`): celda intransitable.
2. **Bull Rush** (`docs/designs/bull-rush-and-squeezing-design.md:410`): destino de empuje inválido.
3. **Corte de esquina diagonal** (`isCornerAnchorBlockedByTerrain`, Sprint 037): bloquea el vértice.
4. **Cover** (`getAttackLineInterception`, `rules.ts:1752`, Sprint 042): produce `terrain-cover`, **+4 CA**, el ataque procede.

El punto 4 es el hallazgo de Sprint 052: **ya existe**, no es hipotético.

## Evidencia

### Código (cita exacta)

`rules.ts:1751-1757`:
```ts
const terrainBlockedCellKeys: string[] = [];
for (const key of [...new Set(room.board.impassableCells ?? [])].sort()) {
  const [cx, cy] = key.split(",").map(Number);
  if (Number.isFinite(cx) && Number.isFinite(cy) && isExactInteriorPoint(cx, cy)) terrainBlockedCellKeys.push(key);
}
return { creatureBlockerIds, terrainBlockedCellKeys };
```
`rules.ts:1766-1778` (`buildCoverAssessment`): `terrainApplies` produce `kind: "terrain-cover"`, `acBonus: 4`, sin ninguna rama que trate `terrain-cover` distinto de `creature-cover`.

### ¿Qué documentación autorizó esto? Ninguna, de forma dedicada

`docs/rules/registry.md` cita como único Documento de `DEFENSE-COVER` a
`docs/designs/cover-and-dynamic-reach-design.md` (Sprint 013) — pero ese
documento excluye explícitamente en su §10 ("Fuera de alcance"): *"cobertura
por muros, puertas, mobiliario o terreno del mapa"* y *"Cobertura Total y
bloqueo efectivo de la acción"*. La extensión real (`impassableCells →
terrain-cover`) apareció en Sprint 042 (según los propios comentarios de
código: *"Sprint 042: geometría pura de intercepción..."*) sin ningún NDD
propio. Solo quedó documentada *después del hecho*, de forma descriptiva, en
`PROJECT_STATUS.md:286` y en la fila `DEFENSE-COVER` del Registry. Es una
ampliación de alcance no autorizada por ningún diseño dedicado — coherente
con el propio hallazgo de `docs/designs/corners-geometry-design.md:90`
(Sprint 037), que ya anticipaba *"Cobertura Total por Muros"* como trabajo
**futuro y distinto**, no como sinónimo de la Cover parcial actual.

### ¿Qué objetos representan hoy las `impassableCells`? ¿Solo muros sólidos?

Ninguno tipado — es un array homogéneo de coordenadas. El código no distingue
entre un muro sólido, un pilar, o mobiliario pesado: toda celda del array
recibe idéntico tratamiento en los cuatro consumidores listados arriba.

### ¿UI para declararlas?

**No existe ninguna.** `demoBoard` (`demo-data.ts:6`, el único `Board` real
usado en producción) no declara `impassableCells` en absoluto. El campo solo
se puebla manualmente en fixtures de test.

### ¿Qué tests fijan `impassableCells → terrain-cover +4`?

`tests/cover-reach.test.mjs` — 9 referencias, incluido el test dedicado
*"obstaculo de casilla completa entre atacante y objetivo produce
terrain-cover"* (línea 103) y sus variantes touch/flat-footed/ranged/con
criatura adicional.

### ¿Datos persistidos a migrar?

**No.** `demoBoard` no tiene `impassableCells`; no existe persistencia de
mapas/`Board` en perfiles (`profileStorage.ts` no referencia `Board`). El
único uso real está en ~15 casos de test, editables sin riesgo para datos de
usuarios.

## Semántica normativa (auditoría focalizada, sin investigar Vision/luz)

El SRD trata como **ejes independientes**:

- **Cover parcial** (+2 a +4 según el manual): un obstáculo que oculta
  parcialmente al defensor. No requiere que el obstáculo sea infranqueable —
  mobiliario bajo puede otorgar cover sin bloquear el movimiento en absoluto.
- **Total Cover**: ausencia de línea de efecto — el ataque no puede
  intentarse. Requiere obstrucción física completa entre origen y destino.
- **Bloqueo de movimiento** (terreno difícil, agua profunda, obstáculos
  infranqueables): un eje distinto, ya modelado aparte vía
  `difficultTerrainCells`/`impassableCells`, sin relación normativa directa
  con cover o con línea de efecto.

Conclusión: "intransitable para movimiento", "otorga cover" y "bloquea la
línea de efecto por completo" son, en el SRD, **tres hechos independientes**,
no una jerarquía derivable de un único booleano. El modelo actual —un solo
array sirviendo simultáneamente a los tres— es una conflación, confirmada
también por el propio hallazgo D-02 de `docs/audits/combat-rules-deviations.md`
(el corpus local ya confundió alguna vez cobertura total con ocultación
total; aquí el motor confunde cover parcial con intransitabilidad).

## Impacto de la contradicción

Mientras `getLineOfEffect`/Target Legality no se conecten a un flujo de
ataque real, la contradicción es **latente** (no visible en el juego). En el
momento en que se conecten, un muro produciría simultáneamente "+4 CA,
procede" (Cover) y "ataque inválido" (LoE) para el mismo par atacante/
objetivo — un resultado sin sentido que ningún test detecta hoy porque
ningún test ejercita ambos sistemas juntos.

## Alternativas comparadas

### Opción A — `impassableCells` solo como movimiento; campo nuevo dedicado a Line of Effect

Se introduce un array declarativo nuevo (ej. `lineOfEffectBlockingCells`) que
representa "obstrucción física sólida", independiente de `impassableCells`
("intransitable"). `impassableCells` conserva su significado actual
exclusivamente para movimiento/Bull Rush/esquinas. Cover parcial actual
(`terrain-cover`, +4) queda pendiente de decidir si se retira o se re-ancla
al nuevo campo (ver Preguntas abiertas).

- **Fidelidad SRD**: alta — separa los tres ejes ya identificados.
- **Migración**: mínima (confirmado arriba: cero datos de producción).
- **Costo**: mapas/fixtures de test deben poblar el nuevo campo cuando
  quieran un muro real; el código de movimiento no cambia.

### Opción B — Redefinir `impassableCells` como "obstáculo sólido"

Toda celda intransitable pasaría a bloquear también Line of Effect
automáticamente; se retira o redefine `terrain-cover` como consecuencia.

- **Fidelidad SRD**: baja — obliga a que todo lo intransitable sea también
  opaco, lo cual el propio catálogo de casos futuros contradice (barrotes,
  cristales son intransitables pero no opacos; mobiliario bajo es opaco a
  veces sin ser intransitable).
- **Migración**: reinterpreta silenciamente cualquier `impassableCells`
  existente (aunque hoy sea solo de test) como "muro sólido" sin haberlo
  declarado así.

### Opción C — Clasificación de obstáculo multi-propiedad

`TerrainObstacle { blocksMovement, providesCover, blocksLineOfEffect,
blocksLineOfSight }` por celda o por tipo de obstáculo catalogado.

- **Fidelidad SRD**: la más alta — modela los cuatro ejes reales por separado.
- **Costo**: la más alta — infraestructura nueva sin consumidor real
  todavía (Vision/LoS no se implementan este sprint; Cover parcial sin
  intransitabilidad no tiene ningún caso de uso pedido hoy). Violaría el
  principio ya establecido en Sprint 044.2/045: no construir una plataforma
  general antes de tener consumidores reales.

## Recomendación

**Opción A**, con un refinamiento: el nuevo campo dedicado a Line of Effect
debe, cuando exista, **superseder** el `terrain-cover` actual para esa misma
celda (una vez que una celda bloquea Line of Effect, el resultado correcto
para esa celda es Total Cover, no "+4 y además inválido") — pero esa
sustitución de comportamiento de Cover queda **fuera de esta auditoría** y
requiere su propia aprobación explícita antes de tocar `rules.ts`, tal como
exige el alcance de Sprint 052A. Opción C es sobreingeniería para el estado
actual (cero consumidores de "cover sin intransitabilidad" o de Line of
Sight); Opción B viola fidelidad SRD y el principio de no reinterpretar
silenciosamente el terreno existente.

## Plan mínimo de implementación (no autorizado; para el sprint que continúe)

1. Confirmar con el arquitecto las preguntas abiertas de más abajo.
2. Agregar el campo nuevo a `Board`/Snapshot (mismo patrón que
   `difficultTerrainCells`), sin tocar `impassableCells`.
3. Implementar `getLineOfEffect` consumiendo el campo nuevo (no
   `impassableCells`), como función independiente, sin generalizar
   `getAttackLineInterception`.
4. Decidir y ejecutar, en un paso explícitamente aprobado y separado, qué
   ocurre con `terrain-cover` para las celdas que ahora bloquean Line of
   Effect (retirarlo para esas celdas, o mantenerlo como fallback documentado
   mientras Total Cover no esté conectada a un flujo de ataque real).

## Archivos afectados por el plan (cuando se autorice; ninguno tocado en Sprint 052A)

`packages/shared/src/types.ts` (`Board`, `CombatRulesSnapshot`),
`packages/shared/src/combatSnapshot.ts`, `packages/shared/src/rules.ts`
(`getLineOfEffect` nueva; `buildCoverAssessment` solo si se aprueba el paso 4),
`tests/cover-reach.test.mjs` (si el paso 4 se aprueba), nuevo
`tests/line-of-effect.test.mjs`, `docs/rules/registry.md` (Rule ID nueva,
fuera de este documento).

## Riesgos de migración

Bajos: no hay datos de producción. El único costo real es reescribir los
fixtures de `tests/cover-reach.test.mjs` que hoy asumen `impassableCells`
como fuente de `terrain-cover`, y solo si se aprueba el paso 4 del plan.

## Preguntas que requieren decisión del arquitecto

1. ¿Se aprueba la Opción A como dirección definitiva?
2. ¿El nuevo campo debe llamarse `lineOfEffectBlockingCells` o algo
   distinto? ¿Vive en `Board` (celda por celda, como `difficultTerrainCells`)
   o en una estructura de zonas?
3. ¿Se autoriza, en un sprint separado, retirar/redefinir `terrain-cover`
   para las celdas que bloqueen Line of Effect (paso 4 del plan), o debe
   coexistir documentadamente como fallback hasta que Vision/Target Legality
   estén completas?
4. ¿Corresponde abrir ya una Rule ID `DEFENSE-LINE-OF-EFFECT` separada de
   `DEFENSE-COVER`, o Line of Effect es infraestructura sin Rule ID propia
   hasta tener un consumidor de reglas real?
5. Mientras no se resuelva lo anterior: ¿Sprint 052 continúa con
   `getLineOfEffect` como función completamente aislada (aceptando que
   `terrain-cover` seguirá dando +4 en paralelo, documentado como
   contradicción conocida y sin conectar a ataques reales), o queda
   formalmente pausado hasta esta decisión?
