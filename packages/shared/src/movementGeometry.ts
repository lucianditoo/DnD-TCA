import type {
  CombatRulesSnapshot,
  Combatant,
  CombatantSnapshot,
  Position,
} from "./types.js";
import { getSizeRule } from "./sizeRules.js";

/**
 * Módulo inferior de geometría/ocupación espacial (Sprint D-1B-I3R1).
 * No importa desde `rules.ts` ni desde `routeValidation.ts`: ambos importan desde aquí.
 * Esto rompe el ciclo `rules.ts ↔ routeValidation.ts` detectado en la revisión del
 * commit 3696f08. No introduce reglas nuevas ni cambia comportamiento — es una
 * relocalización 1:1 de los helpers ya existentes en `rules.ts`.
 */

export type SpatialMode = "natural" | "squeezing";
export type SqueezingAxis = "horizontal" | "vertical";

export interface MovementFootprintProjection {
  readonly occupiedCells: Position[];
  readonly spatialMode: SpatialMode;
  readonly squeezingAxis?: SqueezingAxis;
}

export interface FootprintGeometry {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly zFeet: number;
}

export function isPositionInsideBoard(snapshot: CombatRulesSnapshot, position: Pick<Position, "x" | "y">): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < snapshot.board.width && position.y < snapshot.board.height;
}

export function isImpassable(context: CombatRulesSnapshot<any>, x: number, y: number): boolean {
  if (!context.board.impassableCells) return false;
  return context.board.impassableCells.includes(`${x},${y}`);
}

function isNarrowCell(snapshot: CombatRulesSnapshot, cell: Pick<Position, "x" | "y">): boolean {
  return snapshot.board.narrowCells?.includes(`${cell.x},${cell.y}`) ?? false;
}

function isSqueezingCombatant(snapshot: CombatRulesSnapshot, combatantId: string): boolean {
  return snapshot.effectInstances?.some((instance) =>
    instance.effectId === "srd_squeezing" && instance.targets?.includes(combatantId)
  ) ?? false;
}

export function projectFootprintGeometry(cells: readonly Position[]): FootprintGeometry {
  const first = cells[0];
  if (!first) throw new Error("Una huella de combatiente debe contener al menos una celda.");
  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;
  for (let index = 1; index < cells.length; index++) {
    const cell = cells[index];
    minX = Math.min(minX, cell.x);
    maxX = Math.max(maxX, cell.x);
    minY = Math.min(minY, cell.y);
    maxY = Math.max(maxY, cell.y);
  }
  return { minX, maxX, minY, maxY, zFeet: first.zFeet ?? 0 };
}

export function getNaturalCombatantOccupiedCellsAt(
  combatant: CombatantSnapshot,
  snapshot: CombatRulesSnapshot,
  position: Position
): Position[] {
  const sizeRule = getSizeRule(combatant.sizeCategory ?? "medium");
  const cellsPerSide = Math.max(1, Math.ceil(sizeRule.spaceFeet / snapshot.board.cellSizeFeet));
  const cells: Position[] = [];
  for (let dy = 0; dy < cellsPerSide; dy++) {
    for (let dx = 0; dx < cellsPerSide; dx++) {
      cells.push({ x: position.x + dx, y: position.y + dy, zFeet: position.zFeet ?? 0 });
    }
  }
  return cells;
}

function getSqueezedFootprintAt(
  combatant: CombatantSnapshot,
  snapshot: CombatRulesSnapshot,
  position: Position,
  preferredAxis?: SqueezingAxis
): MovementFootprintProjection | null {
  const naturalCells = getNaturalCombatantOccupiedCellsAt(combatant, snapshot, position);
  const naturalGeometry = projectFootprintGeometry(naturalCells);
  const width = naturalGeometry.maxX - naturalGeometry.minX + 1;
  const height = naturalGeometry.maxY - naturalGeometry.minY + 1;
  if (width !== 2 || height !== 2) return null;

  const zFeet = position.zFeet ?? 0;
  const candidates: Array<{ axis: SqueezingAxis; cells: Position[] }> = [
    {
      axis: "horizontal",
      cells: [
        { x: position.x, y: position.y, zFeet },
        { x: position.x + 1, y: position.y, zFeet }
      ]
    },
    {
      axis: "vertical",
      cells: [
        { x: position.x, y: position.y, zFeet },
        { x: position.x, y: position.y + 1, zFeet }
      ]
    }
  ];
  const legal = candidates.filter((candidate) => candidate.cells.every((cell) =>
    isPositionInsideBoard(snapshot, cell) &&
    !isImpassable(snapshot, cell.x, cell.y) &&
    isNarrowCell(snapshot, cell)
  ));
  const selected = preferredAxis
    ? legal.find((candidate) => candidate.axis === preferredAxis)
    : legal[0];
  return selected ? { occupiedCells: selected.cells, spatialMode: "squeezing", squeezingAxis: selected.axis } : null;
}

export function projectMovementFootprint(
  snapshot: CombatRulesSnapshot,
  combatant: CombatantSnapshot,
  position: Position,
  direction: { dx: number; dy: number }
): MovementFootprintProjection | null {
  const naturalCells = getNaturalCombatantOccupiedCellsAt(combatant, snapshot, position);
  const naturalIsLegal = naturalCells.every((cell) =>
    isPositionInsideBoard(snapshot, cell) && !isImpassable(snapshot, cell.x, cell.y)
  );
  const touchesNarrow = naturalCells.some((cell) => isNarrowCell(snapshot, cell));
  const isLargeSquare = naturalCells.length === 4;
  if (touchesNarrow && isLargeSquare && direction.dx !== 0 && direction.dy !== 0) return null;
  const preferredAxis: SqueezingAxis = direction.dx !== 0 ? "horizontal" : "vertical";
  if (touchesNarrow && isLargeSquare) {
    const squeezed = getSqueezedFootprintAt(combatant, snapshot, position, preferredAxis);
    if (squeezed) return squeezed;
  }
  if (naturalIsLegal) return { occupiedCells: naturalCells, spatialMode: "natural" };
  if (direction.dx !== 0 && direction.dy !== 0) return null;
  return getSqueezedFootprintAt(combatant, snapshot, position, preferredAxis);
}

export function getCombatantOccupiedCellsAt(
  combatant: CombatantSnapshot,
  snapshot: CombatRulesSnapshot,
  position: Position
): Position[] {
  if (isSqueezingCombatant(snapshot, combatant.id)) {
    const squeezed = getSqueezedFootprintAt(combatant, snapshot, position);
    if (squeezed) return squeezed.occupiedCells;
  }
  return getNaturalCombatantOccupiedCellsAt(combatant, snapshot, position);
}

/** Deriva de forma autoritativa las celdas ocupadas desde tamaño, ancla y escala del tablero. */
export function getCombatantOccupiedCells(
  combatant: CombatantSnapshot,
  snapshot: CombatRulesSnapshot
): Position[] {
  return getCombatantOccupiedCellsAt(combatant, snapshot, combatant.position);
}

/** Clave canónica de celda de grid ("x,y,zFeet"). Única fuente de serialización compartida por
 * footprints de combatientes, intersección de AoE de conjuros y hazards ambientales persistentes. */
export function footprintCellKey(position: Pick<Position, "x" | "y" | "zFeet">): string {
  return `${position.x},${position.y},${position.zFeet ?? 0}`;
}

type FootprintOccupancyIndex = ReadonlyMap<string, readonly Combatant[]>;

export function createFootprintOccupancyIndex(snapshot: CombatRulesSnapshot): FootprintOccupancyIndex {
  const index = new Map<string, Combatant[]>();
  for (const combatant of snapshot.combatants as Combatant[]) {
    for (const cell of getCombatantOccupiedCells(combatant, snapshot)) {
      const key = footprintCellKey(cell);
      const occupants = index.get(key);
      if (occupants) occupants.push(combatant);
      else index.set(key, [combatant]);
    }
  }
  return index;
}

export function getCombatantsIntersectingCells(
  occupancyIndex: FootprintOccupancyIndex,
  cells: readonly Position[],
  exceptId?: string
): Combatant[] {
  const intersecting = new Map<string, Combatant>();
  for (const cell of cells) {
    for (const combatant of occupancyIndex.get(footprintCellKey(cell)) ?? []) {
      if (combatant.id !== exceptId) intersecting.set(combatant.id, combatant);
    }
  }
  return [...intersecting.values()];
}

/**
 * Sprint 037: comprobación pura y exclusiva de terreno/límites del tablero para el corte de
 * esquina diagonal (Rule ID MOVE-05, Cap. 8 pág. 147). Deliberadamente NO consulta ocupación por
 * combatientes — una criatura (aliada o enemiga) nunca bloquea el vértice diagonal, solo un
 * obstáculo sólido (`board.impassableCells`) o el límite del tablero. Ver
 * `docs/designs/corners-geometry-design.md` (corrige una divergencia deliberada de Sprint 015).
 */
export function isCornerAnchorBlockedByTerrain(
  snapshot: CombatRulesSnapshot,
  combatant: Combatant,
  anchor: Position
): boolean {
  const cells = getCombatantOccupiedCellsAt(combatant, snapshot, anchor);
  return cells.some((cell) => !isPositionInsideBoard(snapshot, cell) || isImpassable(snapshot, cell.x, cell.y));
}
