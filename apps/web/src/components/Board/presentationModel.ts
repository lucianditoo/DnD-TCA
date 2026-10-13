import {
  EffectQueries,
  SpellsCatalog,
  getAttackContextModifiers,
  getCellsIntersectedByAoE,
  getCombatantOccupiedCells,
  getWeaponAttackTypeForTarget,
  lifeStatus,
  parseCellKey,
  type Ability,
  type CombatRoom,
  type CombatRulesSnapshot,
  type Combatant,
  type LifeStatus,
  type Position,
  type ProductionEffectId
} from "@dnd-tactical/shared";
import { cellKey, getCardinalDirection, type ActionMode } from "../../viewModel";
import {
  resolveCombatantSprite,
  type CombatantSpriteDescriptor
} from "./sprites";

export type BoardViewMode = "2.5d" | "2d";
export type CameraAngle = "nw" | "ne" | "se" | "sw";

export interface CameraState {
  readonly viewMode: BoardViewMode;
  readonly angle: CameraAngle;
  readonly zoom: number;
}

export const DEFAULT_CAMERA_STATE: CameraState = {
  viewMode: "2.5d",
  angle: "nw",
  zoom: 1
};

export const CAMERA_ZOOM_MIN = 0.75;
export const CAMERA_ZOOM_MAX = 1.3;
export const CAMERA_ZOOM_STEP = 0.125;

export const CAMERA_ANGLE_OPTIONS: ReadonlyArray<{
  readonly id: CameraAngle;
  readonly shortLabel: string;
  readonly title: string;
}> = [
  { id: "nw", shortLabel: "NO", title: "Vista Noroeste" },
  { id: "ne", shortLabel: "NE", title: "Vista Noreste" },
  { id: "se", shortLabel: "SE", title: "Vista Sudeste" },
  { id: "sw", shortLabel: "SO", title: "Vista Sudoeste" }
];

export interface ProjectedGridCell {
  readonly gridColumn: number;
  readonly gridRow: number;
}

export interface ProjectedGridFootprint {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly columns: number;
  readonly rows: number;
  readonly colStart: number;
  readonly rowStart: number;
  readonly gridColumnStyle: string;
  readonly gridRowStyle: string;
}

export type ScenicPropKind =
  | "none"
  | "barrier-block"
  | "rubble"
  | "narrow-corridor"
  | "loe-pillar";

export interface TacticalCellPresentation {
  readonly x: number;
  readonly y: number;
  readonly position: Position;
  readonly key: string;
  readonly projected: ProjectedGridCell;
  readonly occupant: Combatant | undefined;
  readonly isImpassable: boolean;
  readonly isDifficultTerrain: boolean;
  readonly isNarrow: boolean;
  readonly isLoEBlocked: boolean;
  readonly isDimLight: boolean;
  readonly isDarkness: boolean;
  readonly scenicProp: ScenicPropKind;
  readonly terrainBadge: string | null;
  readonly className: string;
  readonly routeIndex: number;
  readonly routeStepCost: number | null;
}

export interface TokenBadgePresentation {
  readonly id: string;
  readonly symbol: string;
  readonly code: string;
  readonly label: string;
  readonly tone: "amber" | "orange" | "purple" | "cyan" | "teal" | "green" | "red" | "slate";
}

export interface TacticalTokenPresentation {
  readonly combatant: Combatant;
  readonly id: string;
  readonly name: string;
  readonly type: "player" | "enemy";
  readonly status: LifeStatus;
  readonly hpCurrent: number;
  readonly hpMax: number;
  readonly hpPercent: number;
  readonly isSelected: boolean;
  readonly isTarget: boolean;
  readonly isActiveTurn: boolean;
  readonly isProne: boolean;
  readonly isParalyzed: boolean;
  readonly isSqueezing: boolean;
  readonly footprint: ProjectedGridFootprint;
  readonly occupiedCells: readonly Position[];
  readonly sprite: CombatantSpriteDescriptor;
  readonly mirroredInCamera: boolean;
  readonly badges: readonly TokenBadgePresentation[];
}

export interface TacticalBoardPresentation {
  readonly width: number;
  readonly height: number;
  readonly viewMode: BoardViewMode;
  readonly cameraAngle: CameraAngle;
  readonly cameraZoom: number;
  readonly cells: readonly TacticalCellPresentation[];
  readonly tokens: readonly TacticalTokenPresentation[];
}

export function clampCameraZoom(zoom: number): number {
  const clamped = Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, zoom));
  return Math.round(clamped * 1000) / 1000;
}

export function projectCellToCameraGrid(
  x: number,
  y: number,
  boardWidth: number,
  boardHeight: number,
  angle: CameraAngle
): ProjectedGridCell {
  switch (angle) {
    case "nw":
      return { gridColumn: x + 1, gridRow: y + 1 };
    case "ne":
      return { gridColumn: boardWidth - x, gridRow: y + 1 };
    case "se":
      return { gridColumn: boardWidth - x, gridRow: boardHeight - y };
    case "sw":
      return { gridColumn: x + 1, gridRow: boardHeight - y };
  }
}

export function projectFootprintToCameraGrid(
  occupiedCells: readonly Position[],
  boardWidth: number,
  boardHeight: number,
  angle: CameraAngle
): ProjectedGridFootprint {
  const xs = occupiedCells.map((cell) => cell.x);
  const ys = occupiedCells.map((cell) => cell.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const columns = maxX - minX + 1;
  const rows = maxY - minY + 1;

  let colStart = minX + 1;
  let rowStart = minY + 1;
  switch (angle) {
    case "nw":
      colStart = minX + 1;
      rowStart = minY + 1;
      break;
    case "ne":
      colStart = boardWidth - maxX;
      rowStart = minY + 1;
      break;
    case "se":
      colStart = boardWidth - maxX;
      rowStart = boardHeight - maxY;
      break;
    case "sw":
      colStart = minX + 1;
      rowStart = boardHeight - maxY;
      break;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    columns,
    rows,
    colStart,
    rowStart,
    gridColumnStyle: `${colStart} / span ${columns}`,
    gridRowStyle: `${rowStart} / span ${rows}`
  };
}

const CONDITION_BADGE_MAP: Readonly<
  Record<
    string,
    {
      readonly symbol: string;
      readonly code: string;
      readonly label: string;
      readonly tone: TokenBadgePresentation["tone"];
    }
  >
> = {
  srd_prone: { symbol: "▼", code: "PRN", label: "Derribado (Prone)", tone: "amber" },
  srd_squeezing: { symbol: "⇄", code: "SQZ", label: "Apretujado (Squeezing)", tone: "orange" },
  srd_paralyzed: { symbol: "❖", code: "PAR", label: "Paralizado (Hold Person)", tone: "purple" },
  srd_flat_footed: { symbol: "!", code: "FF", label: "Desprevenido (Flat-Footed)", tone: "slate" },
  srd_stunned: { symbol: "✦", code: "STN", label: "Aturdido (Stunned)", tone: "amber" },
  srd_blinded: { symbol: "◌", code: "BLD", label: "Cegado (Blinded)", tone: "slate" },
  srd_entangled: { symbol: "⌗", code: "ENT", label: "Enredado (Entangled)", tone: "green" },
  srd_grappled: { symbol: "⛓", code: "GRP", label: "En Presa (Grappled)", tone: "orange" },
  srd_helpless: { symbol: "✖", code: "HLP", label: "Indefenso (Helpless)", tone: "red" },
  srd_fatigued: { symbol: "~", code: "FAT", label: "Fatigado (Fatigued)", tone: "slate" },
  srd_exhausted: { symbol: "≈", code: "EXH", label: "Exhausto (Exhausted)", tone: "orange" }
};

export function buildBoardPresentationModel(params: {
  readonly room: CombatRoom;
  readonly snapshot: CombatRulesSnapshot<ProductionEffectId>;
  readonly selected: Combatant | null;
  readonly targetId: string;
  readonly displayedPath: readonly Position[];
  readonly displayedPathCosts: readonly number[];
  readonly highlightedCells: ReadonlyMap<string, string>;
  readonly chargePreviewPath: readonly Position[] | null;
  readonly routeFootprintCombatant?: Combatant | null;
  readonly actionMode?: ActionMode;
  readonly selectedAbility?: Ability | null;
  readonly targetPosition?: Position | null;
  readonly hoveredCell?: Position | null;
  readonly camera?: CameraState;
  readonly forceSpriteFallback?: boolean;
}): TacticalBoardPresentation {
  const {
    room,
    snapshot,
    selected,
    targetId,
    displayedPath,
    displayedPathCosts,
    highlightedCells,
    chargePreviewPath,
    routeFootprintCombatant,
    actionMode,
    selectedAbility,
    targetPosition,
    hoveredCell = null,
    camera = DEFAULT_CAMERA_STATE,
    forceSpriteFallback = false
  } = params;

  const { width, height } = room.board;
  const occupiedByCell = new Map<string, Combatant>();
  const occupiedCellsByCombatant = new Map<string, Position[]>();

  for (const combatant of room.combatants) {
    const cells = getCombatantOccupiedCells(combatant, snapshot);
    occupiedCellsByCombatant.set(combatant.id, cells);
    for (const cell of cells) {
      occupiedByCell.set(cellKey(cell), combatant);
    }
  }

  const routeFinal = chargePreviewPath?.at(-1);
  const routeFootprintKeys = new Set(
    routeFinal && routeFootprintCombatant
      ? getCombatantOccupiedCells({ ...routeFootprintCombatant, position: routeFinal }, snapshot).map(cellKey)
      : []
  );

  const aoePreviewKeys = new Set<string>();
  if (actionMode === "ability" && selected && selectedAbility) {
    const spell = SpellsCatalog.get(selectedAbility.id);
    const targetCell = hoveredCell ?? targetPosition ?? null;
    if (spell && spell.target === "area" && spell.aoe && targetCell) {
      const direction = getCardinalDirection(selected.position, targetCell);
      const origin = spell.aoe.type === "burst" ? targetCell : selected.position;
      const cells = getCellsIntersectedByAoE(origin, direction, spell.aoe, room.board.cellSizeFeet);
      for (const cell of cells) aoePreviewKeys.add(cellKey(cell));
    }
  }

  const aoeAffectedKeys = new Set<string>();
  if (aoePreviewKeys.size > 0) {
    for (const combatant of room.combatants) {
      if (lifeStatus(combatant) === "dead") continue;
      const footprint = occupiedCellsByCombatant.get(combatant.id) ?? [];
      if (footprint.some((cell) => aoePreviewKeys.has(cellKey(cell)))) {
        for (const cell of footprint) aoeAffectedKeys.add(cellKey(cell));
      }
    }
  }

  const hazardCellKeys = new Set<string>();
  for (const instance of room.effectInstances) {
    if (!instance.targetCells) continue;
    for (const cellString of instance.targetCells) {
      hazardCellKeys.add(cellKey(parseCellKey(cellString)));
    }
  }

  const impassableSet = new Set(room.board.impassableCells ?? []);
  const difficultSet = new Set(room.board.difficultTerrainCells ?? []);
  const narrowSet = new Set(room.board.narrowCells ?? []);
  const loeBlockedSet = new Set(room.board.lineOfEffectBlockingCells ?? []);
  const dimLightSet = new Set(room.board.dimLightCells ?? []);
  const darknessSet = new Set(room.board.darknessCells ?? []);

  const cells: TacticalCellPresentation[] = [];
  for (let index = 0; index < width * height; index += 1) {
    const x = index % width;
    const y = Math.floor(index / width);
    const position: Position = { x, y, zFeet: 0 };
    const key = cellKey(position);
    const occupant = occupiedByCell.get(key);
    const highlight = highlightedCells.get(key) ?? "";
    const routeIndex = displayedPath.findIndex((step) => step.x === x && step.y === y);
    const isRouteFootprint = routeFootprintKeys.has(key);
    const isAoE = aoePreviewKeys.has(key);
    const isAoEAffected = aoeAffectedKeys.has(key);
    const isHazard = hazardCellKeys.has(key);

    const isImpassable = impassableSet.has(key);
    const isDifficultTerrain = difficultSet.has(key);
    const isNarrow = narrowSet.has(key);
    const isLoEBlocked = loeBlockedSet.has(key);
    const isDimLight = dimLightSet.has(key);
    const isDarkness = darknessSet.has(key);

    let scenicProp: ScenicPropKind = "none";
    let terrainBadge: string | null = null;
    if (isLoEBlocked) {
      scenicProp = "loe-pillar";
      terrainBadge = "SIN LOE";
    } else if (isImpassable) {
      scenicProp = "barrier-block";
      terrainBadge = "BLOQ";
    } else if (isDifficultTerrain) {
      scenicProp = "rubble";
      terrainBadge = "2×";
    } else if (isNarrow) {
      scenicProp = "narrow-corridor";
      terrainBadge = "5 FT";
    }

    const routeClass =
      routeIndex >= 0 || isRouteFootprint
        ? " route-cell" +
          (routeIndex === displayedPath.length - 1 || isRouteFootprint ? " route-end" : "") +
          (chargePreviewPath ? " charge-route" : "")
        : "";
    const aoeClass = isAoE ? " aoe-preview" : "";
    const aoeAffectedClass = isAoEAffected ? " aoe-affected" : "";
    const hazardClass = isHazard ? " hazard-cell" : "";
    const terrainClass =
      (isImpassable ? " cell-impassable" : "") +
      (isDifficultTerrain ? " cell-difficult" : "") +
      (isNarrow ? " cell-narrow" : "") +
      (isLoEBlocked ? " cell-loe-blocked" : "") +
      (isDimLight ? " cell-dim-light" : "") +
      (isDarkness ? " cell-darkness" : "");

    const projected = projectCellToCameraGrid(x, y, width, height, camera.angle);

    cells.push({
      x,
      y,
      position,
      key,
      projected,
      occupant,
      isImpassable,
      isDifficultTerrain,
      isNarrow,
      isLoEBlocked,
      isDimLight,
      isDarkness,
      scenicProp,
      terrainBadge,
      className: `cell${highlight}${routeClass}${aoeClass}${aoeAffectedClass}${hazardClass}${terrainClass}`,
      routeIndex,
      routeStepCost: routeIndex >= 0 ? (displayedPathCosts[routeIndex] ?? null) : null
    });
  }

  // Pure read of cover context from the active/selected combatant to enemies so Scene B's creature cover is visually evident
  const activeCombatant =
    room.combatants.find((c) => c.id === room.currentTurn.combatantId) ?? selected ?? null;
  const coverProtectedIds = new Set<string>();
  const coverBlockerIds = new Set<string>();
  if (activeCombatant && lifeStatus(activeCombatant) !== "dead") {
    for (const candidate of room.combatants) {
      if (candidate.id === activeCombatant.id || candidate.type === activeCombatant.type || lifeStatus(candidate) === "dead") {
        continue;
      }
      const attackType = getWeaponAttackTypeForTarget(snapshot, activeCombatant, candidate);
      const modifiers = getAttackContextModifiers(snapshot, activeCombatant, candidate).byAttackType[attackType];
      if (modifiers.cover.applies) {
        coverProtectedIds.add(candidate.id);
        for (const blockerId of modifiers.cover.blockerIds) {
          coverBlockerIds.add(blockerId);
        }
      }
    }
  }

  const mirroredInCamera = camera.angle === "ne" || camera.angle === "se";

  const tokens: TacticalTokenPresentation[] = room.combatants.map((combatant) => {
    const occupiedCells = occupiedCellsByCombatant.get(combatant.id) ?? [combatant.position];
    const footprint = projectFootprintToCameraGrid(occupiedCells, width, height, camera.angle);
    const status = lifeStatus(combatant);
    const hpPercent = combatant.hpMax > 0 ? Math.max(0, Math.min(100, Math.round((combatant.hpCurrent / combatant.hpMax) * 100))) : 0;
    const sprite = resolveCombatantSprite(combatant, { forceFallback: forceSpriteFallback });

    const activeEffects = EffectQueries.getByTarget(room, combatant.id);
    const effectIds = new Set<string>(activeEffects.map((inst) => inst.effectId));
    const badges: TokenBadgePresentation[] = [];

    for (const instance of activeEffects) {
      const meta = CONDITION_BADGE_MAP[instance.effectId];
      if (meta && !badges.some((b) => b.id === instance.effectId)) {
        badges.push({
          id: instance.effectId,
          symbol: meta.symbol,
          code: meta.code,
          label: meta.label,
          tone: meta.tone
        });
      }
    }

    if (coverProtectedIds.has(combatant.id)) {
      badges.push({
        id: "tactical_cover_protected",
        symbol: "🛡",
        code: "COV +4",
        label: "Cobertura por criatura (+4 CA)",
        tone: "cyan"
      });
    } else if (coverBlockerIds.has(combatant.id)) {
      badges.push({
        id: "tactical_cover_blocker",
        symbol: "⛨",
        code: "INTERP",
        label: "Criatura interpuesta (otorga cobertura)",
        tone: "teal"
      });
    }

    return {
      combatant,
      id: combatant.id,
      name: combatant.name,
      type: combatant.type,
      status,
      hpCurrent: combatant.hpCurrent,
      hpMax: combatant.hpMax,
      hpPercent,
      isSelected: combatant.id === selected?.id,
      isTarget: combatant.id === targetId,
      isActiveTurn: room.phase !== "preparation" && room.currentTurn.combatantId === combatant.id,
      isProne: effectIds.has("srd_prone"),
      isParalyzed: effectIds.has("srd_paralyzed"),
      isSqueezing: effectIds.has("srd_squeezing"),
      footprint,
      occupiedCells,
      sprite,
      mirroredInCamera,
      badges
    };
  });

  return {
    width,
    height,
    viewMode: camera.viewMode,
    cameraAngle: camera.angle,
    cameraZoom: camera.zoom,
    cells,
    tokens
  };
}
