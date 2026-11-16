import { averageDiceDamage } from "../equipmentStats.js";
import { traversedCellKeysBetween } from "./gridTrace.js";
import { footprintCellKey, getCombatantOccupiedCells, isPositionInsideBoard } from "../movementGeometry.js";
import { lifeStatus } from "../lifeStatus.js";
import type { SpellDefinition } from "../spells/contracts.js";
import type { CardinalDirection, Combatant, CombatRulesSnapshot, Position } from "../types.js";
import { getDirectionDelta, getDistance5105 } from "./aoe.js";

type Aim = { direction?: CardinalDirection; targetPosition?: { x: number; y: number; zFeet?: number } };
type Point = Pick<Position, "x" | "y">;
const planarKey = ({ x, y }: Point) => `${x},${y}`;

export type SpellAreaProjection =
  | { ok: false; error: string }
  | { ok: true; origin: Point; earlyDetonation: boolean; cells: Position[]; affectedIds: string[]; destroyedBarrierKeys: string[] };

/** Vertex/impact to vertex/cell-center trace. The cell-center supercover
 * used for lines and attacks cannot express these fractional endpoints.
 * Segment entry into a solid grid cell. Point contacts at either endpoint
 * are harmless; interior vertex contacts follow the board's supercover policy. */
function cellEntry(from: Point, to: Point, cell: Point): number | undefined {
  let enter = 0;
  let leave = 1;
  for (const axis of ["x", "y"] as const) {
    const delta = to[axis] - from[axis];
    if (delta === 0) {
      if (from[axis] < cell[axis] || from[axis] > cell[axis] + 1) return;
      continue;
    }
    const a = (cell[axis] - from[axis]) / delta;
    const b = (cell[axis] + 1 - from[axis]) / delta;
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
  }
  if (enter <= leave && leave > 0 && enter < 1) return enter;
}

export function projectSpellArea(snapshot: CombatRulesSnapshot, caster: Combatant, spell: SpellDefinition, aim: Aim): SpellAreaProjection {
  const shape = spell.aoe;
  if (spell.target !== "area" || !shape) return { ok: false, error: "El conjuro no tiene una plantilla de área." };

  const { board } = snapshot;
  const footprint = getCombatantOccupiedCells(caster, snapshot);
  const ownCells = new Set(footprint.map(planarKey));
  const target = aim.targetPosition;
  if (target && (!Number.isInteger(target.x) || !Number.isInteger(target.y) || !isPositionInsideBoard(snapshot, target)
      || (target.zFeet !== undefined && target.zFeet !== caster.position.zFeet))) {
    return { ok: false, error: "La posición objetivo del área no es válida para este tablero." };
  }

  const energyDamage = spell.resolution.kind === "automatic-damage"
    ? averageDiceDamage(spell.resolution.damageExpression)
    : 0;
  const dealHalfToObjects = ["srd_fireball", "srd_lightning_bolt", "srd_burning_hands"].includes(spell.id);
  const objectDamage = energyDamage / (dealHalfToObjects ? 2 : 1);
  const barriers = board.barrierCells ?? {};
  const blockerKeys = new Set([...(board.lineOfEffectBlockingCells ?? []), ...Object.keys(barriers)]
    .map(key => key.split(",").map(Number).join(","))
    .filter(key => !ownCells.has(key)));
  const blockers = [...blockerKeys].map(key => {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
  }).filter(cell => Number.isInteger(cell.x) && Number.isInteger(cell.y) && isPositionInsideBoard(snapshot, cell));
  const breakableKeys = new Set(Object.entries(barriers)
    .filter(([key, barrier]) => blockerKeys.has(key) && objectDamage > barrier.hardness + barrier.hp)
    .map(([key]) => key));
  const destroyedBarrierKeys = new Set<string>();

  function firstImpact(from: Point, to: Point, obstacles: readonly Point[]): number | undefined {
    let first: number | undefined;
    for (const cell of obstacles) {
      const entry = cellEntry(from, to, cell);
      if (entry !== undefined && (first === undefined || entry < first)) first = entry;
    }
    return first;
  }

  const opaque = blockers.filter(cell => !breakableKeys.has(planarKey(cell)));
  const breakable = blockers.filter(cell => breakableKeys.has(planarKey(cell)));
  function reachesCell(from: Point, to: Point): boolean {
    const stop = firstImpact(from, to, opaque);
    for (const cell of breakable) {
      const entry = cellEntry(from, to, cell);
      if (entry !== undefined && (stop === undefined || entry < stop)) destroyedBarrierKeys.add(planarKey(cell));
    }
    return stop === undefined;
  }

  const corners = footprint.flatMap(({ x, y }) => [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }]);
  if (!corners.length) return { ok: false, error: "El lanzador no ocupa una casilla válida." };
  const distance = (a: Point, b: Point) => {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    // Fireball can hit between intersections. Interpolate the final partial
    // diagonal using the cost of the next diagonal step.
    const diagonal = Math.min(dx, dy);
    const whole = Math.floor(diagonal);
    const partial = diagonal - whole;
    return (getDistance5105(Math.max(dx, dy) - partial, whole)
      + partial * (whole % 2 === 0 ? 1 : 2)) * board.cellSizeFeet;
  };
  let origin: Point;
  let earlyDetonation = false;
  const cells: Position[] = [];
  const addCell = (x: number, y: number) => {
    const cell = { x, y, zFeet: caster.position.zFeet };
    if (isPositionInsideBoard(snapshot, cell) && (!blockerKeys.has(planarKey(cell)) || destroyedBarrierKeys.has(planarKey(cell)))) cells.push(cell);
  };

  if (shape.type === "burst") {
    if (!target) return { ok: false, error: "Elegí la posición del estallido." };
    // A selected cell denotes its north-west grid intersection.
    const candidates = corners.filter(corner => distance(corner, target) <= spell.rangeFeet);
    candidates.sort((a, b) => distance(a, target) - distance(b, target) || a.y - b.y || a.x - b.x);
    const start = candidates[0];
    if (!start) return { ok: false, error: "El origen del estallido está fuera del alcance del conjuro." };
    const bodies = spell.id === "srd_fireball"
      ? snapshot.combatants.filter(actor => actor.id !== caster.id && lifeStatus(actor) !== "dead")
          .flatMap(actor => getCombatantOccupiedCells(actor, snapshot))
          .filter(cell => cell.zFeet === caster.position.zFeet && !ownCells.has(planarKey(cell)))
      : [];
    // An axis-aligned shot along a grid line belongs to the row or column
    // named by the selected cell, not to the wall on the other side of the edge.
    const trajectoryObstacles = [...blockers, ...bodies].filter(cell =>
      (start.x !== target.x || cell.x === target.x) &&
      (start.y !== target.y || cell.y === target.y));
    const impact = firstImpact(start, target, trajectoryObstacles);
    earlyDetonation = impact !== undefined;
    origin = impact === undefined ? { x: target.x, y: target.y } : {
      x: start.x + (target.x - start.x) * impact,
      y: start.y + (target.y - start.y) * impact
    };
  } else {
    if (!aim.direction) return { ok: false, error: "Elegí una dirección para el área." };
    const delta = getDirectionDelta(aim.direction);
    const facing = (p: Point) => p.x * delta.dx + p.y * delta.dy;
    corners.sort((a, b) => facing(b) - facing(a) || a.y - b.y || a.x - b.x);
    origin = corners[0];
    if (shape.type === "line") {
      // Choose the row/column bordering the selected corner and advance in order.
      const length = Math.floor(shape.lengthFeet / board.cellSizeFeet);
      const first = { x: origin.x - Number(delta.dx < 0), y: origin.y - Number(delta.dy < 0) };
      let previous = first;
      for (let step = 0; getDistance5105(Math.abs(delta.dx) * (step + 1), Math.abs(delta.dy) * (step + 1)) <= length; step++) {
        const cell = { x: first.x + delta.dx * step, y: first.y + delta.dy * step };
        if (!isPositionInsideBoard(snapshot, cell)) break;
        const crossed = new Set([...traversedCellKeysBetween(previous.x, previous.y, cell.x, cell.y), planarKey(cell)]);
        if ([...crossed].some(key => blockerKeys.has(key) && !breakableKeys.has(key))) break;
        for (const key of crossed) {
          if (breakableKeys.has(key)) destroyedBarrierKeys.add(key);
        }
        addCell(cell.x, cell.y);
        previous = cell;
      }
    }
  }

  if (shape.type !== "line") {
    const radius = shape.type === "burst" ? shape.radiusFeet : shape.lengthFeet;
    const delta = shape.type === "cone" ? getDirectionDelta(aim.direction!) : undefined;
    const radiusCells = Math.ceil(radius / board.cellSizeFeet);
    for (let y = Math.max(0, Math.floor(origin.y) - radiusCells); y < Math.min(board.height, Math.ceil(origin.y) + radiusCells); y++) {
      for (let x = Math.max(0, Math.floor(origin.x) - radiusCells); x < Math.min(board.width, Math.ceil(origin.x) + radiusCells); x++) {
        if (delta && ownCells.has(planarKey({ x, y }))) continue;
        const center = { x: x + 0.5, y: y + 0.5 };
        // The far corner must fall within range and the cone's angular bounds.
        const far = { x: x + Number(center.x >= origin.x), y: y + Number(center.y >= origin.y) };
        if (delta) {
          const dx = far.x - origin.x;
          const dy = far.y - origin.y;
          const forward = dx * delta.dx + dy * delta.dy;
          const sideways = dx * delta.dy - dy * delta.dx;
          if (forward <= 0 || Math.abs(sideways) > forward) continue;
        }
        if (distance(origin, far) <= radius && reachesCell(origin, center)) addCell(x, y);
      }
    }
  }

  const reached = new Set(cells.map(footprintCellKey));
  const affectedIds = snapshot.combatants.filter(actor => lifeStatus(actor) !== "dead"
    && getCombatantOccupiedCells(actor, snapshot).some(cell => reached.has(footprintCellKey(cell)))).map(actor => actor.id);
  return { ok: true, origin, earlyDetonation, cells, affectedIds, destroyedBarrierKeys: [...destroyedBarrierKeys] };
}
