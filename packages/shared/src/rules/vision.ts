import { effectsCatalog, type ProductionEffectId } from "../effects/catalog.js";
import { EffectReducer, type ReducedConcealment } from "../effects/reducer.js";
import { traversedCellKeysBetween } from "../geometry/gridTrace.js";
import { lifeStatus } from "../lifeStatus.js";
import { getCombatantOccupiedCells } from "../movementGeometry.js";
import { type Combatant, type CombatRulesSnapshot, type ConcealmentAssessment, type ConcealmentKind, type CoverAssessment, type CoverKind, type LineOfEffectAssessment, type Position, type VisionAssessment, type VisionTrace, type VisualPathAssessment } from "../types.js";
import { distanceBetweenFootprintsFeet } from "./attack.js";
import { distanceFeet } from "./movement.js";

export { traversedCellKeysBetween } from "../geometry/gridTrace.js";

/**
 * Sprint 042: geometría pura de intercepción de línea de ataque. Detecta criaturas vivas
 * interpuestas (Sprint 013, `creatureBlockerIds`) entre el atacante y el objetivo mediante
 * colinealidad exacta entera.
 *
 * Sprint 052B (corrección de contradicción detectada en Sprint 052A, ver
 * `docs/designs/terrain-cover-line-of-effect-decision.md`): esta función ya NO consulta
 * `board.impassableCells`. Esa consulta (introducida en este mismo Sprint 042 sin NDD propio)
 * hacía que un muro produjera `terrain-cover` (+4 CA, ataque permitido) — un veredicto opuesto
 * al que produce la nueva `getLineOfEffect` (Total Cover, ataque inválido) para la misma celda.
 * Cover queda ahora exclusivamente sobre criaturas interpuestas; la obstrucción física completa
 * es responsabilidad única de `getLineOfEffect`/`LineOfEffectAssessment`.
 */
export interface AttackLineInterception {
  readonly creatureBlockerIds: readonly string[];
}

export function getAttackLineInterception(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): AttackLineInterception {
  const compareCells = (left: Position, right: Position): number =>
    left.x - right.x || left.y - right.y || (left.zFeet ?? 0) - (right.zFeet ?? 0);
  const attackerCells = [...getCombatantOccupiedCells(attacker, room)].sort(compareCells);
  const targetCells = [...getCombatantOccupiedCells(target, room)].sort(compareCells);
  let origin = attackerCells[0] ?? attacker.position;
  let destination = targetCells[0] ?? target.position;
  let shortestDistanceSquared = Number.POSITIVE_INFINITY;
  for (const attackerCell of attackerCells) {
    for (const targetCell of targetCells) {
      const dx = targetCell.x - attackerCell.x;
      const dy = targetCell.y - attackerCell.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < shortestDistanceSquared) {
        shortestDistanceSquared = distanceSquared;
        origin = attackerCell;
        destination = targetCell;
      }
    }
  }

  const ax = origin.x;
  const ay = origin.y;
  const bx = destination.x;
  const by = destination.y;
  const dxAB = bx - ax;
  const dyAB = by - ay;
  const lengthSquaredAB = dxAB * dxAB + dyAB * dyAB;

  const isExactInteriorPoint = (px: number, py: number): boolean => {
    const dxAC = px - ax;
    const dyAC = py - ay;
    const cross = dxAB * dyAC - dyAB * dxAC;
    if (cross !== 0) return false;
    const dot = dxAC * dxAB + dyAC * dyAB;
    return dot > 0 && dot < lengthSquaredAB;
  };

  const creatureBlockerIds: string[] = [];
  for (const combatant of [...room.combatants].sort((left, right) => left.id.localeCompare(right.id))) {
    if (combatant.id === attacker.id || combatant.id === target.id) continue;
    const status = lifeStatus(combatant);
    if (status !== "active" && status !== "disabled") continue;
    if (getCombatantOccupiedCells(combatant, room).some((cell) => isExactInteriorPoint(cell.x, cell.y))) {
      creatureBlockerIds.push(combatant.id);
    }
  }

  return { creatureBlockerIds };
}

/**
 * Sprint 042: proyecta la geometría de `getAttackLineInterception` a un veredicto de Cover para
 * un intento de ataque. Sprint 052B: exclusivamente criaturas interpuestas — ver nota arriba.
 */
export function buildCoverAssessment(interception: AttackLineInterception): CoverAssessment {
  const creatureApplies = interception.creatureBlockerIds.length > 0;
  const kind: CoverKind = creatureApplies ? "creature-cover" : "none";
  return {
    applies: creatureApplies,
    acBonus: creatureApplies ? 4 : 0,
    kind,
    blockerIds: interception.creatureBlockerIds
  };
}

/**
 * Recorrido "supercover" entre dos celdas (Sprint 052B.1, corrige el bug geométrico de Sprint
 * 052B: la versión anterior probaba si el ancla entera de una celda bloqueadora era un punto
 * exactamente colineal del segmento centro-a-centro, lo que fallaba para cualquier línea que
 * atravesara el ÁREA de una celda sin pasar exactamente por su punto ancla — ver
 * `docs/designs/vision-and-line-of-effect-architecture.md` §1.3.1 para la auditoría completa).
 *
 * Modela cada celda como el área unitaria `[x,x+1)×[y,y+1)` y traza el segmento entre los
 * CENTROS de la celda de origen y destino (`(x+0.5, y+0.5)`), devolviendo el conjunto de celdas
 * cuya área el segmento realmente atraviesa. Es el algoritmo "supercover"/"conservative line
 * drawing" estándar para líneas de visión en grillas: en cada paso avanza el eje que va
 * "atrasado" respecto al otro (comparando el avance fraccional de x e y sin dividir, por
 * multiplicación cruzada `(2*ix+1)*ny` vs `(2*iy+1)*nx` — aritmética enteramente entera, sin
 * coma flotante). Cuando el segmento cruza exactamente un vértice compartido por 4 celdas (un
 * cruce diagonal exacto — línea "por vértice"), el algoritmo incluye conservadoramente las DOS
 * celdas vecinas de esa esquina además de la celda de destino de ese paso: una diagonal no puede
 * "colarse" entre dos bloqueadores que se tocan solo en la esquina.
 *
 * Política de bordes explícita: un segmento recto que corre exactamente por una fila o columna
 * (horizontal/vertical) atraviesa el área completa de cada celda de esa fila/columna — nunca
 * "roza" un borde sin entrar, porque el centro de cada celda intermedia está estrictamente dentro
 * de su área. Una diagonal exacta que pasa por un vértice compartido ("por vértice") se resuelve
 * de forma conservadora incluyendo ambas celdas vecinas, como se describe arriba.
 */

/**
 * Sprint 052B: geometría pura e independiente de Line of Effect. Responde exclusivamente si
 * existe obstrucción física completa (`board.lineOfEffectBlockingCells`) entre el atacante y el
 * objetivo — nunca consulta criaturas ni `impassableCells`. No generaliza ni envuelve
 * semánticamente `getAttackLineInterception`: comparte únicamente el mismo tipo de tablero, no la
 * prueba geométrica (que es un recorrido de celdas por área, no una prueba de colinealidad de
 * puntos — ver `traversedCellKeysBetween` arriba, corregido en Sprint 052B.1).
 *
 * Footprints multicasilla (Sprint 052A/052B, decisión de Fase 1, ver
 * `docs/designs/terrain-cover-line-of-effect-decision.md`): existe Line of Effect si **al menos
 * un** par de celdas ocupadas (una del atacante, una del objetivo) tiene un recorrido sin
 * bloqueadores — análogo a que el SRD permita elegir la esquina/casilla más favorable del propio
 * espacio al trazar líneas hacia el objetivo. Hay Total Cover únicamente si **todos** los pares
 * posibles están bloqueados. Para criaturas 1×1 (todas las del catálogo de demo actual) esto
 * colapsa a un único par, igual que antes. Las celdas propias de origen/destino (de cualquiera de
 * los dos combatientes, no solo del par actual) nunca cuentan como bloqueadoras de su propia
 * línea de efecto.
 *
 * `zFeet` (altura): esta primera versión ignora la diferencia de altura entre celdas, igual que
 * `getAttackLineInterception` hace hoy — es una simplificación deliberada y documentada, no un
 * descuido; queda como pregunta abierta para una futura vertical de altura/vuelo.
 */
/**
 * Extracción compartida (Sprint 053B) entre `getLineOfEffect` y `getVisualPathAssessment`: ambas
 * responden la misma CLASE de pregunta geométrica ("¿al menos un par de celdas ocupadas tiene un
 * recorrido supercover sin bloqueadores?") sobre una fuente de celdas bloqueadoras distinta —
 * nunca la misma fuente de datos por fusión conceptual, cada llamador decide su propia fuente
 * (`blockingCellSource`). Extracción puramente mecánica del cuerpo ya probado de
 * `getLineOfEffect` (Sprint 052B.1): mismo comportamiento exacto, cero cambios de lógica.
 */
function computeSupercoverPathAssessment(
  originCells: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  destinationCells: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  blockingCellSource: ReadonlyArray<string> | undefined
): { readonly hasClearPath: boolean; readonly blockedCellKeys: readonly string[] } {
  const ownCellKeys = new Set<string>([
    ...originCells.map((cell) => `${cell.x},${cell.y}`),
    ...destinationCells.map((cell) => `${cell.x},${cell.y}`)
  ]);

  const blockingCellKeys = new Set(
    [...new Set(blockingCellSource ?? [])].filter((key) => {
      const [x, y] = key.split(",").map(Number);
      return Number.isInteger(x) && Number.isInteger(y) && `${x},${y}` === key && !ownCellKeys.has(key);
    })
  );

  let hasClearPath = false;
  const blockedCellKeys = new Set<string>();

  for (const a of originCells) {
    for (const b of destinationCells) {
      const visited = traversedCellKeysBetween(a.x, a.y, b.x, b.y);
      visited.delete(`${a.x},${a.y}`);
      visited.delete(`${b.x},${b.y}`);
      const blockersForThisPair = [...visited].filter((key) => blockingCellKeys.has(key));
      if (blockersForThisPair.length === 0) {
        hasClearPath = true;
      } else {
        for (const key of blockersForThisPair) blockedCellKeys.add(key);
      }
    }
  }

  return {
    hasClearPath,
    blockedCellKeys: [...blockedCellKeys].sort()
  };
}

export function getLineOfEffect(
  room: CombatRulesSnapshot<ProductionEffectId>,
  origin: Combatant,
  target: Combatant
): LineOfEffectAssessment {
  const result = computeSupercoverPathAssessment(
    getCombatantOccupiedCells(origin, room),
    getCombatantOccupiedCells(target, room),
    room.board.lineOfEffectBlockingCells
  );
  return { hasLineOfEffect: result.hasClearPath, blockedCellKeys: result.blockedCellKeys };
}

/**
 * Sprint 053B.2 (Corrección 2 del Blind Targeting): Line of Effect desde un combatiente hacia una
 * CASILLA concreta, sin ningún combatiente objetivo — la legalidad geométrica de un ataque por
 * casilla nunca puede depender de si la casilla está ocupada o no (eso filtraría información).
 * Misma primitiva supercover y misma fuente de bloqueadores que `getLineOfEffect`; la única
 * diferencia es que el destino es exactamente una celda en vez del footprint de un objetivo.
 */
export function getLineOfEffectToCell(
  room: CombatRulesSnapshot<ProductionEffectId>,
  origin: Combatant,
  targetCell: Position
): LineOfEffectAssessment {
  const result = computeSupercoverPathAssessment(
    getCombatantOccupiedCells(origin, room),
    [{ x: targetCell.x, y: targetCell.y }],
    room.board.lineOfEffectBlockingCells
  );
  return { hasLineOfEffect: result.hasClearPath, blockedCellKeys: result.blockedCellKeys };
}

/**
 * Sprint 053B: geometría pura e independiente de Line of Sight (ruta visual) — hermana de
 * `getLineOfEffect`, nunca su alias. Reutiliza la misma primitiva compartida
 * (`computeSupercoverPathAssessment`/`traversedCellKeysBetween`) porque responde la misma clase
 * de pregunta geométrica, pero es una función exportada independiente con su propio contrato
 * (`VisualPathAssessment`). Fuente de bloqueadores: reutiliza provisionalmente
 * `board.lineOfEffectBlockingCells` (autorizado por el NDD, Sprint 053 §3) — eso no fusiona LoE y
 * Visual Path en el mismo assessment; es una reutilización de datos explícitamente provisional,
 * a separar en un campo dedicado (`lineOfSightBlockingCells`) el día que exista un obstáculo real
 * que deba bloquear uno sin el otro (cristal, niebla — ver
 * `docs/designs/vision-and-line-of-effect-architecture.md` §13.4/§3).
 */
export function getVisualPathAssessment(
  room: CombatRulesSnapshot<ProductionEffectId>,
  observer: Combatant,
  target: Combatant
): VisualPathAssessment {
  const result = computeSupercoverPathAssessment(
    getCombatantOccupiedCells(observer, room),
    getCombatantOccupiedCells(target, room),
    room.board.lineOfEffectBlockingCells
  );
  return { hasClearVisualPath: result.hasClearPath, blockedCellKeys: result.blockedCellKeys };
}

/**
 * Sprint 053B.2 (Corrección 1 del Blind Targeting): decide si el targeting por casilla está
 * justificado para este atacante hacia esta casilla — el modo casilla NUNCA es una alternativa
 * libre al targeting directo; solo se admite cuando el atacante no puede ver el contenido de la
 * casilla, exactamente los mismos motivos por los que el assessment final exigiría
 * `requiresTargetSquare` contra un objetivo real allí parado:
 *
 * 1. Ocultación Total declarativa sobre los ataques DEL PROPIO atacante (perspectiva
 *    `attacks_by_target`, ej. `srd_blinded`) — independiente del objetivo por definición.
 * 2. La casilla está en oscuridad total fuera del alcance de Darkvision del atacante (mismos
 *    datos y misma matemática que la regla 2/3 de `getVisionAssessment`, aplicada a la celda).
 *
 * Deliberadamente NO consulta al ocupante de la casilla: la decisión usa solo información que el
 * atacante posee legítimamente (su propio estado + la luz del tablero + geometría), por lo que ni
 * la aceptación ni el rechazo filtran ocupación. La ruta visual bloqueada no se evalúa aquí: con
 * la fuente provisional compartida, ruta bloqueada implica Line of Effect bloqueada hacia la
 * casilla, que se rechaza antes como Cobertura Total (ver `handleResolveAttackDraft`).
 *
 * La luz tenue no justifica el modo casilla: es Ocultación parcial (20%) con
 * `directTargetingAllowed === true`, igual que contra un objetivo real.
 */
export function isSquareTargetingJustified(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  square: Position
): boolean {
  const attackerEffectConcealment = EffectReducer.reduceConcealmentContributions({
    effectInstances: room.effectInstances,
    catalog: effectsCatalog,
    targets: [{ targetId: attacker.id, perspective: "attacks_by_target" }]
  });
  if (attackerEffectConcealment.kind === "total") return true;

  const squareKey = `${square.x},${square.y}`;
  if ((room.board.darknessCells ?? []).includes(squareKey)) {
    const darkvisionFeet = attacker.intrinsicPerception?.darkvisionFeet ?? 0;
    const distance = distanceFeet(attacker.position, square, room.board.cellSizeFeet);
    const withinDarkvisionRange = darkvisionFeet > 0 && distance <= darkvisionFeet;
    if (!withinDarkvisionRange) return true;
  }

  return false;
}

/**
 * Sprint 053B: composición pura de `VisualPathAssessment` + iluminación estática +
 * `IntrinsicPerception` del observador. No depende de `EffectReducer`, `ConcealmentAssessment`
 * ni del Attack Resolver — es un assessment independiente que se compone con Concealment en
 * `getConcealmentAssessment` (severidad máxima), nunca se fusiona con él. Ver
 * `docs/designs/vision-and-line-of-effect-architecture.md` §13.5/§13.9.
 *
 * Precedencia de evaluación (más restrictivo gana, orden fijado por el NDD):
 * 1. Ruta visual bloqueada → total, 50%, requiere casilla, `blocked-visual-path`.
 * 2. Objetivo en oscuridad total, observador sin Darkvision → total, 50%, `darkness`.
 * 3. Objetivo en oscuridad total, observador con Darkvision pero fuera de alcance →
 *    total, 50%, `darkvision-out-of-range`.
 * 4. Objetivo en luz tenue, observador sin Darkvision suficiente (ausente o fuera de alcance)
 *    → parcial, 20%, `dim-light`.
 * 5. Cualquier otro caso (incluida luz tenue/oscuridad con Darkvision suficiente) → `clear`.
 *
 * Precedencia de datos: si una celda aparece en `darknessCells` y `dimLightCells` a la vez,
 * `darkness` domina — se consulta primero.
 *
 * Simplificación deliberada y documentada (misma clase que `zFeet` en `getLineOfEffect`): esta
 * primera vertical consulta únicamente la casilla ancla (`target.position`) del objetivo para
 * determinar su nivel de luz, no la huella completa — footprints multicasilla con niveles de luz
 * mixtos entre sus propias celdas quedan como pregunta abierta para una vertical posterior.
 */
export function getVisionAssessment(
  room: CombatRulesSnapshot<ProductionEffectId>,
  observer: Combatant,
  target: Combatant
): VisionAssessment {
  const visualPath = getVisualPathAssessment(room, observer, target);
  const traces: VisionTrace[] = [];

  if (!visualPath.hasClearVisualPath) {
    traces.push({
      source: "visual-path",
      label: "Ruta visual bloqueada",
      kind: "total",
      missChancePercent: 50,
      status: "applied"
    });
    return {
      canPerceiveVisually: false,
      kind: "total",
      missChancePercent: 50,
      directTargetingAllowed: false,
      requiresTargetSquare: true,
      dominantReason: "blocked-visual-path",
      traces
    };
  }

  const darkvisionFeet = observer.intrinsicPerception?.darkvisionFeet ?? 0;
  const targetCellKey = `${target.position.x},${target.position.y}`;
  const inDarkness = (room.board.darknessCells ?? []).includes(targetCellKey);
  const inDimLight = !inDarkness && (room.board.dimLightCells ?? []).includes(targetCellKey);

  if (inDarkness) {
    const distanceFeet = distanceBetweenFootprintsFeet(room, observer, target);
    const withinDarkvisionRange = darkvisionFeet > 0 && distanceFeet <= darkvisionFeet;
    traces.push({
      source: "board-light",
      label: "Oscuridad total",
      kind: "total",
      missChancePercent: 50,
      status: withinDarkvisionRange ? "suppressed" : "applied"
    });
    if (darkvisionFeet > 0) {
      traces.push({
        source: "intrinsic-perception",
        label: `Darkvision ${darkvisionFeet} ft` + (withinDarkvisionRange ? " (dentro de alcance)" : " (fuera de alcance)"),
        kind: withinDarkvisionRange ? "none" : "total",
        missChancePercent: withinDarkvisionRange ? 0 : 50,
        status: withinDarkvisionRange ? "applied" : "suppressed"
      });
    }
    if (withinDarkvisionRange) {
      return { canPerceiveVisually: true, kind: "none", missChancePercent: 0, directTargetingAllowed: true, requiresTargetSquare: false, dominantReason: "clear", traces };
    }
    return {
      canPerceiveVisually: false,
      kind: "total",
      missChancePercent: 50,
      directTargetingAllowed: false,
      requiresTargetSquare: true,
      dominantReason: darkvisionFeet > 0 ? "darkvision-out-of-range" : "darkness",
      traces
    };
  }

  if (inDimLight) {
    const distanceFeet = distanceBetweenFootprintsFeet(room, observer, target);
    const withinDarkvisionRange = darkvisionFeet > 0 && distanceFeet <= darkvisionFeet;
    traces.push({
      source: "board-light",
      label: "Iluminación tenue",
      kind: "partial",
      missChancePercent: 20,
      status: withinDarkvisionRange ? "suppressed" : "applied"
    });
    if (darkvisionFeet > 0) {
      traces.push({
        source: "intrinsic-perception",
        label: `Darkvision ${darkvisionFeet} ft` + (withinDarkvisionRange ? " (anula luz tenue)" : " (fuera de alcance)"),
        kind: withinDarkvisionRange ? "none" : "partial",
        missChancePercent: withinDarkvisionRange ? 0 : 20,
        status: withinDarkvisionRange ? "applied" : "suppressed"
      });
    }
    if (withinDarkvisionRange) {
      return { canPerceiveVisually: true, kind: "none", missChancePercent: 0, directTargetingAllowed: true, requiresTargetSquare: false, dominantReason: "clear", traces };
    }
    return {
      canPerceiveVisually: true,
      kind: "partial",
      missChancePercent: 20,
      directTargetingAllowed: true,
      requiresTargetSquare: false,
      dominantReason: "dim-light",
      traces
    };
  }

  return {
    canPerceiveVisually: true,
    kind: "none",
    missChancePercent: 0,
    directTargetingAllowed: true,
    requiresTargetSquare: false,
    dominantReason: "clear",
    traces
  };
}

/**
 * Assessment puro y efimero de DEFENSE-CONCEALMENT para un intento concreto. Sprint 053B: compone
 * la reducción declarativa existente (`EffectReducer.reduceConcealmentContributions` — Blinded,
 * futura niebla mágica) con `VisionAssessment` (fuente contextual independiente: geometría + luz
 * + percepción). Nunca se sintetiza un `EffectInstance` ficticio para Vision, y Vision nunca se
 * inyecta dentro del reductor — se componen en `composeConcealmentAssessment` por severidad
 * máxima. Ver `docs/designs/vision-and-line-of-effect-architecture.md` §13.8/§13.9.
 */
export function getConcealmentAssessment(
  room: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  target: Combatant
): ConcealmentAssessment {
  const reduced = EffectReducer.reduceConcealmentContributions({
    effectInstances: room.effectInstances,
    catalog: effectsCatalog,
    targets: [
      { targetId: target.id, perspective: "attacks_against_target" },
      { targetId: attacker.id, perspective: "attacks_by_target" }
    ]
  });
  const vision = getVisionAssessment(room, attacker, target);
  return composeConcealmentAssessment(reduced, vision);
}

/**
 * Convierte la reduccion especializada en el assessment consumido por servidor y UI. `vision` es
 * opcional (retrocompatible con llamadores que solo evalúan la reducción declarativa pura, ej.
 * `tests/concealment-core.test.mjs`) — cuando se provee, se compone por **severidad máxima**
 * (`total > partial > none`), nunca sumando porcentajes ni fusionando ambos assessments en uno
 * solo. Si cualquiera de las dos fuentes exige `requiresTargetSquare`/prohíbe
 * `directTargetingAllowed`, el resultado final hereda esa restricción (la más restrictiva
 * domina) — esto es lo que permite que Blinded (efecto declarativo, total incondicional) siga
 * funcionando exactamente igual que hoy sin ninguna rama especial de "si Blinded, ignorar
 * Vision": su propia severidad ya domina cualquier resultado que Vision produzca para el mismo
 * ataque.
 */
export function composeConcealmentAssessment(reduced: ReducedConcealment, vision?: VisionAssessment): ConcealmentAssessment {
  const effectTotal = reduced.kind === "total";
  const effectPartial = reduced.kind === "partial";
  const visionTotal = vision?.kind === "total";
  const visionPartial = vision?.kind === "partial";

  const total = effectTotal || visionTotal;
  const partial = !total && (effectPartial || visionPartial);
  const kind: ConcealmentKind = total ? "total" : partial ? "partial" : "none";
  const applies = kind !== "none";

  const missChancePercent = total
    ? Math.max(effectTotal ? reduced.missChancePercent : 0, visionTotal ? vision!.missChancePercent : 0)
    : partial
      ? Math.max(effectPartial ? reduced.missChancePercent : 0, visionPartial ? vision!.missChancePercent : 0)
      : 0;

  const labels = reduced.traces
    .filter((trace) => trace.status === "applied")
    .map((trace) => `${trace.label} (${trace.missChancePercent}%)`);
  for (const trace of vision?.traces ?? []) {
    if (trace.status === "applied") labels.push(`${trace.label} (${trace.missChancePercent}%)`);
  }

  return {
    applies,
    kind,
    missChancePercent,
    directTargetingAllowed: !total,
    requiresTargetSquare: total,
    opportunityAttackAllowed: !total,
    labelParts: labels,
    traces: reduced.traces,
    visionTraces: vision?.traces ?? []
  };
}
