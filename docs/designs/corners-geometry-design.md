# Sprint 037 — Restricción de Esquinas y Obstáculos Diagonales (Rule ID: MOVE-05)

## Estado

Diseño en revisión. **A la espera de aprobación `Proceed` específica para este sprint.** No se ha modificado ningún archivo ejecutable.

## Nota sobre la instrucción recibida

La instrucción llegó marcada como "FASE 2 & 5" (diseño e implementación simultáneas), sin una revisión previa del NDD en esta conversación. Este proyecto opera bajo metodología estricta Diseño-Primero (`.ai/WORKFLOW.md`): ningún código se escribe sin un `Proceed` explícito emitido *después* de revisar el documento de diseño correspondiente. Este NDD completa Fase 1 (investigación) y Fase 2 (diseño); la implementación (Fase 5) queda pausada hasta recibir esa aprobación puntual.

A diferencia de los Sprints 035/036, donde la instrucción asumía incorrectamente que cierta infraestructura no existía, **esta vez la investigación de Fase 1 confirma que el problema descrito es real y ya está en el código**:

- `validateMovePath` (`packages/shared/src/rules.ts`, línea ~730) ya detecta pasos diagonales (`dx === 1 && dy === 1`) y ya invoca `isFootprintHardBlocked` sobre las dos anclas perpendiculares (`horizontalAnchor`, `verticalAnchor`).
- `isFootprintHardBlocked` (línea ~1261) hoy comprueba **dos cosas**: (a) que las celdas de la huella en esa ancla no sean intransitables ni salgan del tablero (correcto, permanece), y (b) que ningún combatiente enemigo `"active"`/`"disabled"` ocupe esas celdas (línea 1269-1273) — **y esto último es una divergencia real respecto al manual**, no un bug de esta sesión: fue una decisión **deliberada** documentada en `docs/designs/difficult-terrain-and-corners-design.md` (Sprint 015, sección D.2: *"Una criatura enemiga que esté consciente y activa... bloquea el paso diagonal"*), pero el manual (Cap. 8, pág. 147) solo bloquea el corte de esquina por **obstáculos sólidos**; las criaturas nunca bloquean el vértice diagonal (sí bloquean terminar/atravesar la casilla que ocupan, que es una regla distinta y ya correctamente separada en las líneas 719-728 de `validateMovePath`).
- El test `tests/difficult-terrain.test.mjs` (línea 51-70, "*validateMovePath bloquea diagonales cruzando esquinas con impassableCells o enemigos*") **codifica y verifica activamente el comportamiento incorrecto** — es el mismo test que hay que actualizar, no solo un test nuevo que hay que sumar.
- La UI (`ActionsPanel.tsx`, `Board.tsx`) **ya no necesita ningún cambio**: `apps/web/src/viewModel.ts::isLegalNextPathStep` (línea 218) ya llama a `validateMovePath` directamente, y `getHighlightedCells` (línea 71) ya usa `isLegalNextPathStep` para decidir qué celdas se muestran como destino válido de movimiento (`move-highlight`). Corregir `isFootprintHardBlocked` en `rules.ts` alcanza para que el preview isomórfico dibuje correctamente los dos casos (esquina de muro sigue bloqueada y sin resaltar; esquina junto a un enemigo pasa a resaltarse como destino válido) sin tocar una sola línea de React — es el mismo patrón de "una sola función pura, dos consumidores" que ya documentó el propio NDD de Sprint 015 (sección C).

## Objetivo

Corregir `isFootprintHardBlocked` para que el corte de esquina diagonal solo se bloquee por obstáculos sólidos (`board.impassableCells` o límites del tablero), nunca por la presencia de una criatura (aliada o enemiga) en la celda de anclaje — alineando el motor con Cap. 8 pág. 147 del manual, y corrigiendo la divergencia deliberada de Sprint 015 ahora identificada como incorrecta.

## 1. Decisión: ajustar la función existente, no crear una nueva

`isFootprintHardBlocked` es privada (`function`, no `export`) y **tiene un único punto de consumo**: las dos llamadas en el bloque diagonal de `validateMovePath` (líneas 734-735). No participa en ninguna otra validación (colocación inicial, movimiento recto, cargas, Bull Rush). Esto significa que el fix es un cambio quirúrgico y aislado: eliminar la rama de bloqueo por combatiente (líneas 1269-1273) y dejar únicamente la comprobación de terreno/límites del tablero (línea 1268). No hace falta una segunda función, ni tocar la firma, ni sus llamadores.

Se **renombra** la función a `isCornerAnchorBlockedByTerrain` para que el nombre deje de sugerir (incorrectamente) que cualquier obstáculo -incluida una criatura- la activa; esto es puramente cosmético (mismo cuerpo simplificado, mismos dos call-sites), pero evita que un futuro lector repita el error de Sprint 015 por un nombre engañoso.

## 2. Arquitectura Propuesta

### A. `packages/shared/src/rules.ts`

```typescript
// Antes (Sprint 015): también bloqueaba por combatiente enemigo activo/disabled en la celda ancla.
// Ahora (Sprint 037): un obstáculo diagonal es exclusivamente terreno sólido, nunca una criatura.
function isCornerAnchorBlockedByTerrain(
  snapshot: CombatRulesSnapshot,
  combatant: Combatant,
  anchor: Position
): boolean {
  const cells = getCombatantOccupiedCellsAt(combatant, snapshot, anchor);
  return cells.some((cell) => !isPositionInsideBoard(snapshot, cell) || isImpassable(snapshot, cell.x, cell.y));
}
```

- Se elimina el parámetro `occupancyIndex` (ya no se necesita — no se consulta ocupación por combatientes) y, en consecuencia, las dos llamadas en `validateMovePath` dejan de pasarlo:
```typescript
if (dx === 1 && dy === 1) {
  const horizontalAnchor = { x: step.x, y: current.y, zFeet: step.zFeet ?? current.zFeet ?? 0 };
  const verticalAnchor = { x: current.x, y: step.y, zFeet: step.zFeet ?? current.zFeet ?? 0 };
  if (
    isCornerAnchorBlockedByTerrain(context, combatant, horizontalAnchor) ||
    isCornerAnchorBlockedByTerrain(context, combatant, verticalAnchor)
  ) {
    return { ok: false, error: "No puedes moverte en diagonal a traves de una esquina bloqueada por un obstaculo solido." };
  }
}
```
- El mensaje de error se actualiza (`"...un obstaculo solido"` en vez de `"...un muro o enemigo"`) para no seguir prometiendo una restricción que ya no existe.
- **No se toca** la lógica de las líneas 719-728 (bloqueo por ocupación al *atravesar o terminar* en una celda), que ya distingue correctamente aliado/enemigo/indefenso/acrobacia — esa es la regla "no puedes terminar/atravesar la casilla de un enemigo", distinta de la regla de esquinas, y ya está bien implementada.
- **No se toca** `getCombatantOccupiedCellsAt`, `isImpassable`, `isPositionInsideBoard`, `createFootprintOccupancyIndex` — se reutilizan exactamente como están. La huella multi-celda (Large 2×2, Sprint 025/027) del combatiente en movimiento se sigue proyectando correctamente sobre la celda ancla mediante `getCombatantOccupiedCellsAt`, preservando el comportamiento ya correcto para criaturas grandes.

### B. Test existente a actualizar (`tests/difficult-terrain.test.mjs`)

El test "*validateMovePath bloquea diagonales cruzando esquinas con impassableCells o enemigos*" (línea 51) se divide en dos casos honestos:
1. **Bloqueo por muro** (se mantiene, ajustando el mensaje esperado): esquina con `impassableCells` sigue fallando.
2. **Permiso junto a enemigo** (invierte la aserción original): el mismo escenario, pero sin `impassableCells` y solo con un enemigo activo en la celda ancla, ahora debe **tener éxito** (`validation.ok === true`).

Este es un cambio de aserción intencional documentado aquí y en el `walkthrough.md` del sprint — no una regresión accidental.

### C. UI (`apps/web/src/`)

Sin cambios de código. `isLegalNextPathStep`/`getHighlightedCells` ya son consumidores directos de `validateMovePath` y heredan la corrección automáticamente (ver hallazgo de Fase 1).

## 3. Design Review Checklist

### Filtro de Irreversibilidad a 20 Sprints
La pieza más difícil de revertir sería acoplar la detección de esquinas a una estructura de datos distinta de `board.impassableCells`. Este diseño no lo hace: reutiliza exactamente el mismo array indexado (claves `"x,y"`) que ya consume `isImpassable`. Cuando en el futuro se implemente Cobertura Total por Muros o line-of-sight por raycasting, ese trabajo podrá reutilizar el mismo `Set`/array de `impassableCells` como fuente única de "qué celdas son sólidas" — el corte de esquinas y el raycasting comparten la misma pregunta ("¿hay un obstáculo sólido en (x,y)?"), solo que aplicada a pares de celdas distintos. Vale la pena dejar registrado que `impassableCells` usa el formato 2D `"x,y"` (una clave por celda de tablero), **distinto** del formato 3D `"x,y,zFeet"` de `footprintCellKey`/`parseCellKey` introducido en Sprint 034 para `EffectInstance.targetCells` — son dos vocabularios de claves con propósitos distintos (geometría estática del tablero vs. anclaje de efectos dinámicos) y no deben confundirse si un sprint futuro intenta unificarlos.

### Complejidad Accidental
Simplificación real lograda: `isFootprintHardBlocked` deja de necesitar el `occupancyIndex` (dejará de construirse innecesariamente para este chequeo, aunque `validateMovePath` lo sigue necesitando para la validación de ocupación de casillas atravesadas/finales en las líneas 719-728, así que la construcción del índice no desaparece del todo, solo un consumidor menos). La complejidad accidental identificada es la inversa: el nombre `isFootprintHardBlocked` sugería una única noción de "bloqueo duro" que en realidad mezclaba dos reglas distintas del manual (obstáculo sólido vs. ocupación por criatura) bajo una sola función — separar conceptualmente (aunque el código para ocupación de criaturas ya vivía aparte, en las líneas 719-728) y renombrar deja cada función con una única responsabilidad nombrada con precisión.

### Matriz de Reutilización de Infraestructura
1. **ActiveEffects:** no aplica; los obstáculos son parte del `Board` estático, no `EffectInstance`.
2. **Pure Helpers (`rules.ts`):** se reutilizan `getCombatantOccupiedCellsAt`, `isImpassable`, `isPositionInsideBoard` sin cambios; se simplifica `isFootprintHardBlocked` → `isCornerAnchorBlockedByTerrain` eliminando la rama de ocupación por combatientes.
3. **Resolvers:** ninguno se toca; `chargeResolver.ts` y demás consumidores de `validateMovePath` heredan la corrección automáticamente al llamar a la misma función pura.

### La Regla de Tres
1. **Carga (Charge):** `findChargePath`/`canCharge` (`chargeResolver.ts`) construyen la trayectoria recta apoyándose en la misma geometría de tablero; si la ruta de carga alguna vez necesita pasar en diagonal junto a un obstáculo, se beneficia directamente de que la regla de esquinas ya no confunda enemigos con muros.
2. **Paso de 5 pies (5-foot step) eludiendo enemigos en esquinas:** ya soportado hoy mismo por este fix — un combatiente podrá dar un paso de 5 pies en diagonal pasando junto a un enemigo sin que el motor lo rechace incorrectamente.
3. **Cobertura Total por Muros / futuros efectos de línea de visión (LoS):** cualquier raycasting futuro que pregunte "¿esta celda es sólida?" reutiliza `board.impassableCells`/`isImpassable` tal cual, sin heredar la confusión entre terreno y criaturas que este sprint corrige.

### Matriz de Impacto de Subsistemas
- [x] **Rule Engine:** `isFootprintHardBlocked` se simplifica y renombra a `isCornerAnchorBlockedByTerrain`; el mensaje de error de `validateMovePath` se actualiza.
- [ ] **CombatRoom / State Schema:** sin cambios. `board.impassableCells` ya existe desde Sprint 015.
- [ ] **WebSocket Contract:** sin cambios. `move-combatant`/`resolve-special-maneuver` no cambian de payload.
- [ ] **UI Presentation:** sin cambios de código (ver hallazgo de Fase 1 — heredado automáticamente vía `validateMovePath`).
- [x] **Tests:** `tests/difficult-terrain.test.mjs` se actualiza (el caso de esquina se divide en bloqueo-por-muro y permiso-junto-a-enemigo); nuevo `tests/corners-geometry.test.mjs` con casos adicionales (Large footprint en la esquina, límite de tablero).

## 4. Qué NO resuelve este sprint
- **Cobertura por muros en diagonal para línea de visión/ataques a distancia:** el helper de intercepción existente (`getAttackLineInterception`, Sprint 013) no se toca; sigue siendo un cálculo geométrico distinto (línea recta atacante-objetivo, no vértice de movimiento).
- **Muros que ocupan medio grosor de celda o geometría no alineada a la grilla:** fuera de alcance, igual que en Sprint 015 — `impassableCells` sigue siendo una celda completa o nada.
- **Cambiar la regla de "no se puede atravesar/terminar en la casilla de un enemigo"** (líneas 719-728 de `validateMovePath`): esa es una regla distinta y correcta, no se modifica.

## Riesgos y Mitigaciones
- **Riesgo de romper el test existente sin querer:** mitigado documentando explícitamente el cambio de aserción en `tests/difficult-terrain.test.mjs` como intencional (sección 2.B), no accidental.
- **Riesgo de que una criatura Large 2×2 "esconda" una esquina de muro real detrás de su huella:** no aplica — `getCombatantOccupiedCellsAt` sigue proyectando la huella completa del combatiente en movimiento sobre la celda ancla, y sigue comprobando `isImpassable` sobre cada celda de esa huella, exactamente como antes.
- **Riesgo de que algún otro código dependiera del nombre `isFootprintHardBlocked`:** descartado — es una función no exportada con un único punto de consumo, confirmado por búsqueda exhaustiva en el repositorio.

## Validación Planeada
- Actualizar `tests/difficult-terrain.test.mjs`: dividir el caso de esquina en bloqueo-por-muro (se mantiene) y permiso-junto-a-enemigo (se invierte).
- Nuevo `tests/corners-geometry.test.mjs`: bloqueo incondicional por muro en cualquiera de las dos anclas perpendiculares, permiso diagonal junto a un enemigo consciente y activo, permiso diagonal junto a un aliado, y verificación de que un combatiente Large (huella 2×2) sigue respetando muros en su esquina de anclaje.
- `npm run typecheck`, `npm run build` (con la limitación de entorno ya documentada en Sprints 034-036 para `build:web`/E2E si persiste), y ejecución real del test nuevo (y del actualizado) con el runner nativo de Node contra `packages/shared/dist/rules.js`, tal como se hizo en Sprint 036.
