import type { MovementPreviewProjection } from "../../movementPreview";
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
import { resolveCombatantSprite, type CombatantSpriteDescriptor } from "./sprites";

/**
 * Modelo visual derivado y efímero del tablero táctico.
 *
 * Consume exclusivamente el estado compartido (CombatRoom + CombatRulesSnapshot)
 * y produce una descripción de presentación: suelo, overlays, volúmenes
 * escénicos, unidades billboard, orden de pintura y caras visibles por cámara.
 * Nunca muta el estado, nunca calcula reglas nuevas y nunca persiste nada.
 * La profundidad (altura de muros, alto de sprites) es exclusivamente visual.
 */

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
export const CAMERA_ZOOM_MAX = 3.0;
export const CAMERA_ZOOM_STEP = 0.125;

export const CAMERA_TILT_DEG = 55;

export const CAMERA_YAW_DEG: Readonly<Record<CameraAngle, number>> = {
  nw: -3,
  ne: 3,
  se: -3,
  sw: 3
};

export const CAMERA_ANGLE_OPTIONS: ReadonlyArray<{
  readonly id: CameraAngle;
  readonly shortLabel: string;
  readonly title: string;
}> = [
  { id: "nw", shortLabel: "NO", title: "Cámara mirando al Noroeste" },
  { id: "ne", shortLabel: "NE", title: "Cámara mirando al Noreste" },
  { id: "se", shortLabel: "SE", title: "Cámara mirando al Sudeste" },
  { id: "sw", shortLabel: "SO", title: "Cámara mirando al Sudoeste" }
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

export type VolumeFace = "north" | "east" | "south" | "west";
export const VOLUME_FACES: readonly VolumeFace[] = ["north", "east", "south", "west"];

export function clampCameraZoom(zoom: number): number {
  const clamped = Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, zoom));
  return Math.round(clamped * 1000) / 1000;
}

/**
 * Caras verticales de un volumen orientadas hacia la cámara según el ángulo visual.
 */
export function getCameraFacingFaces(angle: CameraAngle, viewMode: BoardViewMode = "2.5d"): readonly VolumeFace[] {
  if (viewMode === "2d") return [];
  switch (angle) {
    case "nw":
      return ["south", "east"];
    case "ne":
      return ["south", "west"];
    case "se":
      return ["north", "west"];
    case "sw":
      return ["north", "east"];
  }
}

export function getFaceShade(face: VolumeFace, angle: CameraAngle): "lit" | "shade" {
  if (face === "south" || face === "north") {
    return angle === "nw" || angle === "se" ? "lit" : "shade";
  }
  return angle === "nw" || angle === "sw" ? "shade" : "lit";
}

export type ScenicPropKind = "none" | "barrier-block" | "rubble" | "narrow-corridor" | "loe-pillar";

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
  /** Etiqueta textual de depuración (BLOQ, 5 FT…). Oculta por defecto. */
  readonly debugLabel: string | null;
  readonly terrainBadge: string | null;
  readonly className: string;
  readonly routeIndex: number;
  readonly routeStepCost: number | null;
  readonly routeStatus: "legal" | "over-budget" | "illegal" | "unassessed" | null;
  readonly routeGhost: boolean;
  readonly routeLabel: string | null;
  readonly previewLabel: string;
  readonly routeAxis: string | null;
  readonly requiresAcrobatics: boolean;
}

export type VolumeKind = "wall" | "pillar" | "rubble-stone" | "ledge";

export interface VolumeFacePresentation {
  readonly face: VolumeFace;
  readonly shade: "lit" | "shade";
}

export interface TacticalVolumePresentation {
  readonly key: string;
  readonly kind: VolumeKind;
  readonly cellX: number;
  readonly cellY: number;
  readonly projectedGridColumn: number;
  readonly projectedGridRow: number;
  readonly paintDepth: number;
  readonly visibleFaces: readonly VolumeFacePresentation[];
}

export interface TokenBadgePresentation {
  readonly id: string;
  readonly symbol: string;
  readonly code: string;
  readonly text: string;
  readonly label: string;
  readonly tone: "amber" | "orange" | "purple" | "cyan" | "teal" | "green" | "red" | "slate";
}

export type UnitPose = "standing" | "prone" | "paralyzed" | "fallen";

export interface TacticalTokenPresentation {
  readonly combatant: Combatant;
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
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
  readonly pose: UnitPose;
  readonly footprint: ProjectedGridFootprint;
  readonly projectedFootprint: ProjectedGridFootprint;
  readonly occupiedCells: readonly Position[];
  readonly paintIndex: number;
  readonly spriteScale: number;
  readonly widthScale: number;
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
  readonly yawDeg: number;
  readonly tiltDeg: number;
  readonly facingFaces: readonly VolumeFace[];
  readonly cells: readonly TacticalCellPresentation[];
  readonly volumes: readonly TacticalVolumePresentation[];
  readonly tokens: readonly TacticalTokenPresentation[];
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

const SYMBOL_ONLY_CODES = new Set(["FF"]);
const NAME_MAX_VISIBLE = 12;

export function abbreviateCombatantName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= NAME_MAX_VISIBLE) return trimmed;
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return `${trimmed.slice(0, NAME_MAX_VISIBLE - 1)}…`;
  const first = words[0];
  const last = words[words.length - 1];
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

function buildVolumes(params: {
  readonly width: number;
  readonly height: number;
  readonly impassable: ReadonlySet<string>;
  readonly difficult: ReadonlySet<string>;
  readonly narrow: ReadonlySet<string>;
  readonly loeBlocked: ReadonlySet<string>;
  readonly angle: CameraAngle;
  readonly viewMode: BoardViewMode;
}): TacticalVolumePresentation[] {
  const { width, height, impassable, difficult, narrow, loeBlocked, angle, viewMode } = params;
  const facing = getCameraFacingFaces(angle, viewMode);
  const volumes: TacticalVolumePresentation[] = [];
  const key = (x: number, y: number) => `${x},${y}`;

  const faceList = () => facing.map((face) => ({ face, shade: getFaceShade(face, angle) }));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const k = key(x, y);
      const projected = projectCellToCameraGrid(x, y, width, height, angle);
      const paintDepth = 50 + projected.gridRow * 10;

      if (impassable.has(k)) {
        volumes.push({
          key: `wall-${x}-${y}`,
          kind: "wall",
          cellX: x,
          cellY: y,
          projectedGridColumn: projected.gridColumn,
          projectedGridRow: projected.gridRow,
          paintDepth,
          visibleFaces: faceList()
        });
      } else if (loeBlocked.has(k)) {
        volumes.push({
          key: `pillar-${x}-${y}`,
          kind: "pillar",
          cellX: x,
          cellY: y,
          projectedGridColumn: projected.gridColumn,
          projectedGridRow: projected.gridRow,
          paintDepth,
          visibleFaces: faceList()
        });
      } else if (difficult.has(k)) {
        volumes.push({
          key: `rubble-${x}-${y}`,
          kind: "rubble-stone",
          cellX: x,
          cellY: y,
          projectedGridColumn: projected.gridColumn,
          projectedGridRow: projected.gridRow,
          paintDepth,
          visibleFaces: faceList()
        });
      } else if (narrow.has(k)) {
        volumes.push({
          key: `ledge-${x}-${y}`,
          kind: "ledge",
          cellX: x,
          cellY: y,
          projectedGridColumn: projected.gridColumn,
          projectedGridRow: projected.gridRow,
          paintDepth,
          visibleFaces: faceList()
        });
      }
    }
  }

  return volumes;
}

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
  readonly movementPreview?: MovementPreviewProjection | null;
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
    movementPreview = null,
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

  const ordinary = movementPreview !== null;
  const evaluatedPreview = movementPreview?.status === "legal" || movementPreview?.status === "over-budget" ? movementPreview : null;
  const routeFinal = chargePreviewPath?.at(-1);
  const routeFootprintKeys = new Set(ordinary
    ? evaluatedPreview?.steps.at(-1)?.occupiedCells.map(cellKey) ?? []
    : routeFinal && routeFootprintCombatant
      ? getCombatantOccupiedCells({ ...routeFootprintCombatant, position: routeFinal }, snapshot).map(cellKey) : []);
  const projectedStepsByCell = new Map<string, NonNullable<typeof evaluatedPreview>["steps"][number]>();
  for (const step of evaluatedPreview?.steps ?? []) for (const cell of step.occupiedCells) projectedStepsByCell.set(cellKey(cell), step);

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
    const routeStep = routeIndex >= 0 ? evaluatedPreview?.steps[routeIndex] : projectedStepsByCell.get(key);
    const routeGhost = ordinary && isRouteFootprint;
    const routeStatus: TacticalCellPresentation["routeStatus"] = !ordinary || (routeIndex < 0 && !routeStep) ? null
      : movementPreview?.status === "illegal" ? (routeIndex === movementPreview.failedStepIndex ? "illegal" : "unassessed")
      : routeStep && evaluatedPreview ? (routeStep.cumulativeCostFeet > evaluatedPreview.availableBudgetFeet ? "over-budget" : "legal") : "unassessed";
    const requiresAcrobatics = !!routeStep && !!evaluatedPreview?.acrobaticsChecks.some(check => check.stepIndex === routeStep.stepIndex);
    const routeAxis = routeStep?.squeezingAxis ?? null;
    const routeLabel = ordinary && routeIndex >= 0
      ? routeStep ? `${routeStep.cumulativeCostFeet} ft${requiresAcrobatics ? " · CD25" : ""}${routeAxis ? ` · ${routeAxis}` : ""}`
        : routeStatus === "illegal" ? "Inválido" : "No evaluado" : null;
    const candidateStatus = highlight.includes("preview-over-budget") ? "Excede presupuesto"
      : highlight.includes("preview-illegal") ? "Candidato inválido" : highlight.includes("preview-legal") ? "Candidato legal" : "";
    const previewLabel = [`Casilla ${x}, ${y}`, candidateStatus, routeLabel,
      routeGhost ? `Huella prevista${routeAxis ? ` Squeezing ${routeAxis}` : ""}` : ""].filter(Boolean).join(". ");

    const isImpassable = impassableSet.has(key);
    const isDifficultTerrain = difficultSet.has(key);
    const isNarrow = narrowSet.has(key);
    const isLoEBlocked = loeBlockedSet.has(key);
    const isDimLight = dimLightSet.has(key);
    const isDarkness = darknessSet.has(key);

    let scenicProp: ScenicPropKind = "none";
    let debugLabel: string | null = null;
    let terrainBadge: string | null = null;
    if (isImpassable) {
      scenicProp = "barrier-block";
      debugLabel = "BLOQ";
      terrainBadge = "BLOQ";
    } else if (isLoEBlocked) {
      scenicProp = "loe-pillar";
      debugLabel = "SIN LOE";
      terrainBadge = "SIN LOE";
    } else if (isDifficultTerrain) {
      scenicProp = "rubble";
      debugLabel = "2×";
      terrainBadge = "2×";
    } else if (isNarrow) {
      scenicProp = "narrow-corridor";
      debugLabel = "5 FT";
      terrainBadge = "5 FT";
    }

    const routeClass =
      routeIndex >= 0 || isRouteFootprint || (ordinary && projectedStepsByCell.has(key))
        ? " route-cell" +
          (routeIndex === displayedPath.length - 1 || isRouteFootprint ? " route-end" : "") +
          (chargePreviewPath ? " charge-route" : "")
        : "";
    const movementClass = `${routeStatus ? ` route-${routeStatus}` : ""}${routeGhost ? " route-ghost" : ""}${requiresAcrobatics ? " route-acrobatics" : ""}`;
    const aoeClass = aoePreviewKeys.has(key) ? " aoe-preview" : "";
    const aoeAffectedClass = aoeAffectedKeys.has(key) ? " aoe-affected" : "";
    const hazardClass = hazardCellKeys.has(key) ? " hazard-cell" : "";
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
      debugLabel,
      terrainBadge,
      className: `cell${highlight}${routeClass}${movementClass}${aoeClass}${aoeAffectedClass}${hazardClass}${terrainClass}`,
      routeIndex,
      routeStatus, routeGhost, routeLabel, previewLabel, routeAxis, requiresAcrobatics,
      routeStepCost: routeIndex >= 0 ? (ordinary ? routeStep?.cumulativeCostFeet ?? null : displayedPathCosts[routeIndex] ?? null) : null
    });
  }

  // Lectura pura del contexto de cobertura del combatiente activo (badges de solo lectura).
  const activeCombatant = room.combatants.find((c) => c.id === room.currentTurn.combatantId) ?? selected ?? null;
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
        for (const blockerId of modifiers.cover.blockerIds) coverBlockerIds.add(blockerId);
      }
    }
  }

  const mirroredInCamera = camera.angle === "ne" || camera.angle === "se";

  const tokens: TacticalTokenPresentation[] = room.combatants.map((combatant, index) => {
    const occupiedCells = occupiedCellsByCombatant.get(combatant.id) ?? [combatant.position];
    const footprint = projectFootprintToCameraGrid(occupiedCells, width, height, camera.angle);
    const status = lifeStatus(combatant);
    const hpPercent =
      combatant.hpMax > 0 ? Math.max(0, Math.min(100, Math.round((combatant.hpCurrent / combatant.hpMax) * 100))) : 0;
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
          text: SYMBOL_ONLY_CODES.has(meta.code) ? "" : meta.code,
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
        text: "COV +4",
        label: "Cobertura por criatura interpuesta (+4 CA)",
        tone: "cyan"
      });
    } else if (coverBlockerIds.has(combatant.id)) {
      badges.push({
        id: "tactical_cover_blocker",
        symbol: "⛨",
        code: "INTERP",
        text: "INTERP",
        label: "Criatura interpuesta (otorga cobertura)",
        tone: "teal"
      });
    }

    const isProne = effectIds.has("srd_prone");
    const isParalyzed = effectIds.has("srd_paralyzed");
    const isSqueezing = effectIds.has("srd_squeezing");
    const pose: UnitPose =
      status === "dead" ? "fallen" : isProne ? "prone" : isParalyzed ? "paralyzed" : "standing";
    const isSelected = combatant.id === selected?.id;

    // Profundidad de pintura: fila inferior en pantalla se pinta encima de la superior
    const depthOrder = footprint.rowStart * 10 + index;

    return {
      combatant,
      id: combatant.id,
      name: combatant.name,
      displayName: isSelected ? combatant.name : abbreviateCombatantName(combatant.name),
      type: combatant.type,
      status,
      hpCurrent: combatant.hpCurrent,
      hpMax: combatant.hpMax,
      hpPercent,
      isSelected,
      isTarget: combatant.id === targetId,
      isActiveTurn: room.phase !== "preparation" && room.currentTurn.combatantId === combatant.id,
      isProne,
      isParalyzed,
      isSqueezing,
      pose,
      footprint,
      projectedFootprint: footprint,
      occupiedCells,
      paintIndex: depthOrder,
      spriteScale: sprite.isLarge ? 1.85 : 1,
      widthScale: isSqueezing ? 0.75 : 1,
      sprite,
      mirroredInCamera,
      badges
    };
  });

  const volumes = buildVolumes({
    width,
    height,
    impassable: impassableSet,
    difficult: difficultSet,
    narrow: narrowSet,
    loeBlocked: loeBlockedSet,
    angle: camera.angle,
    viewMode: camera.viewMode
  });

  return {
    width,
    height,
    viewMode: camera.viewMode,
    cameraAngle: camera.angle,
    cameraZoom: camera.zoom,
    yawDeg: camera.viewMode === "2.5d" ? CAMERA_YAW_DEG[camera.angle] : 0,
    tiltDeg: camera.viewMode === "2.5d" ? CAMERA_TILT_DEG : 0,
    facingFaces: getCameraFacingFaces(camera.angle, camera.viewMode),
    cells,
    volumes,
    tokens
  };
}
