import { useMemo, useState } from "react";
import type {
  Ability,
  CombatRoom,
  CombatRulesSnapshot,
  Combatant,
  Position,
  ProductionEffectId
} from "@dnd-tactical/shared";
import type { ActionMode } from "../../viewModel";
import {
  CAMERA_ANGLE_OPTIONS,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_STEP,
  DEFAULT_CAMERA_STATE,
  buildBoardPresentationModel,
  clampCameraZoom,
  type BoardViewMode,
  type CameraAngle
} from "./presentationModel";
import { CombatantSprite } from "./sprites";

export function Board({
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
  onCellClick
}: {
  room: CombatRoom;
  snapshot: CombatRulesSnapshot<ProductionEffectId>;
  selected: Combatant | null;
  targetId: string;
  displayedPath: Position[];
  displayedPathCosts: number[];
  highlightedCells: Map<string, string>;
  chargePreviewPath: Position[] | null;
  routeFootprintCombatant?: Combatant | null;
  actionMode?: ActionMode;
  selectedAbility?: Ability | null;
  targetPosition?: Position | null;
  onCellClick: (position: Position, token: Combatant | undefined) => void;
}) {
  const [hoveredCell, setHoveredCell] = useState<Position | null>(null);
  const [viewMode, setViewMode] = useState<BoardViewMode>(DEFAULT_CAMERA_STATE.viewMode);
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>(DEFAULT_CAMERA_STATE.angle);
  const [cameraZoom, setCameraZoom] = useState<number>(DEFAULT_CAMERA_STATE.zoom);

  const presentation = useMemo(
    () =>
      buildBoardPresentationModel({
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
        hoveredCell,
        camera: {
          viewMode,
          angle: cameraAngle,
          zoom: cameraZoom
        }
      }),
    [
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
      hoveredCell,
      viewMode,
      cameraAngle,
      cameraZoom
    ]
  );

  function handleResetCamera() {
    setViewMode(DEFAULT_CAMERA_STATE.viewMode);
    setCameraAngle(DEFAULT_CAMERA_STATE.angle);
    setCameraZoom(DEFAULT_CAMERA_STATE.zoom);
  }

  return (
    <section
      className={`board-wrap board-mode-${viewMode} camera-angle-${cameraAngle}`}
      data-testid="tactical-board"
      data-view-mode={viewMode}
      data-camera-angle={cameraAngle}
      data-camera-zoom={String(cameraZoom)}
    >
      <div className="board-toolbar" data-testid="board-camera-toolbar">
        <div className="board-toolbar-group" role="group" aria-label="Modo de vista del tablero">
          <span className="board-toolbar-label">Vista</span>
          <button
            type="button"
            className={`board-tool-btn ${viewMode === "2.5d" ? "active" : ""}`}
            aria-pressed={viewMode === "2.5d"}
            data-testid="view-mode-25d"
            onClick={() => setViewMode("2.5d")}
          >
            2.5D
          </button>
          <button
            type="button"
            className={`board-tool-btn ${viewMode === "2d" ? "active" : ""}`}
            aria-pressed={viewMode === "2d"}
            data-testid="view-mode-2d"
            onClick={() => setViewMode("2d")}
          >
            2D
          </button>
        </div>

        <div className="board-toolbar-group" role="group" aria-label="Ángulo de cámara táctica">
          <span className="board-toolbar-label">Cámara</span>
          {CAMERA_ANGLE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`board-tool-btn ${cameraAngle === option.id ? "active" : ""}`}
              aria-pressed={cameraAngle === option.id}
              title={option.title}
              data-testid={`camera-angle-${option.id}`}
              onClick={() => setCameraAngle(option.id)}
            >
              {option.shortLabel}
            </button>
          ))}
        </div>

        <div className="board-toolbar-group" role="group" aria-label="Zoom y restablecimiento de cámara">
          <button
            type="button"
            className="board-tool-btn"
            title="Alejar cámara"
            data-testid="camera-zoom-out"
            disabled={cameraZoom <= CAMERA_ZOOM_MIN}
            onClick={() => setCameraZoom((z) => clampCameraZoom(z - CAMERA_ZOOM_STEP))}
          >
            −
          </button>
          <span className="board-zoom-readout" data-testid="camera-zoom-label">
            {Math.round(cameraZoom * 100)}%
          </span>
          <button
            type="button"
            className="board-tool-btn"
            title="Acercar cámara"
            data-testid="camera-zoom-in"
            disabled={cameraZoom >= CAMERA_ZOOM_MAX}
            onClick={() => setCameraZoom((z) => clampCameraZoom(z + CAMERA_ZOOM_STEP))}
          >
            +
          </button>
          <button
            type="button"
            className="board-tool-btn"
            title="Restablecer cámara táctica"
            data-testid="camera-reset"
            onClick={handleResetCamera}
          >
            Restablecer
          </button>
        </div>
      </div>

      <div className="board-stage-viewport">
        <div
          className={`board-stage ${viewMode === "2.5d" ? "is-25d" : "is-2d"} angle-${cameraAngle}`}
          data-testid="board-stage"
          data-view-mode={viewMode}
          data-camera-angle={cameraAngle}
          data-camera-zoom={String(cameraZoom)}
          style={{
            ["--camera-zoom" as string]: String(cameraZoom)
          }}
        >
          <div
            className="board"
            style={{
              gridTemplateColumns: `repeat(${presentation.width}, minmax(38px, 1fr))`,
              gridTemplateRows: `repeat(${presentation.height}, minmax(38px, 1fr))`,
              aspectRatio: `${presentation.width} / ${presentation.height}`
            }}
          >
            {presentation.cells.map((cell) => (
              <button
                key={cell.key}
                type="button"
                className={cell.className}
                style={{
                  gridColumn: cell.projected.gridColumn,
                  gridRow: cell.projected.gridRow
                }}
                data-testid={`cell-${cell.x}-${cell.y}`}
                data-cell-coord={`${cell.x},${cell.y}`}
                data-scenic-prop={cell.scenicProp}
                onPointerEnter={() => setHoveredCell(cell.position)}
                onPointerLeave={() =>
                  setHoveredCell((current) =>
                    current?.x === cell.x && current?.y === cell.y ? null : current
                  )
                }
                onClick={() => onCellClick(cell.position, cell.occupant)}
              >
                <span className="cell-surface" aria-hidden="true" />
                <span className="cell-plinth" aria-hidden="true" />

                {cell.scenicProp === "barrier-block" && (
                  <span
                    className="scenic-barrier-block"
                    aria-hidden="true"
                    title="Obstáculo escénico de movimiento (no otorga cobertura automáticamente)"
                  />
                )}
                {cell.scenicProp === "rubble" && (
                  <span className="scenic-rubble" aria-hidden="true">
                    <span className="rubble-stone r1" />
                    <span className="rubble-stone r2" />
                    <span className="rubble-stone r3" />
                  </span>
                )}
                {cell.scenicProp === "narrow-corridor" && (
                  <span className="scenic-narrow-kerb" aria-hidden="true" />
                )}
                {cell.scenicProp === "loe-pillar" && (
                  <span className="scenic-loe-pillar" aria-hidden="true" />
                )}

                {cell.terrainBadge && cell.routeIndex < 0 && (
                  <span className="cell-terrain-tag" aria-hidden="true">
                    {cell.terrainBadge}
                  </span>
                )}

                {cell.routeIndex >= 0 && cell.routeStepCost !== null && (
                  <span className="route-step">{cell.routeStepCost}</span>
                )}
              </button>
            ))}

            {presentation.tokens.map((token) => {
              const selectedClass = token.isSelected ? " selected-token" : "";
              const targetClass = token.isTarget ? " target-token" : "";
              const activeTurnClass = token.isActiveTurn ? " active-turn-token" : "";
              const proneClass = token.isProne ? " token-prone" : "";
              const paralyzedClass = token.isParalyzed ? " token-paralyzed" : "";
              const squeezingClass = token.isSqueezing ? " token-squeezing" : "";
              const largeClass = token.sprite.isLarge ? " token-large" : "";

              return (
                <div
                  key={token.id}
                  className={
                    `board-token ${token.type} ${token.status}` +
                    selectedClass +
                    targetClass +
                    activeTurnClass +
                    proneClass +
                    paralyzedClass +
                    squeezingClass +
                    largeClass
                  }
                  data-testid={`token-${token.id}`}
                  data-combatant-name={token.name}
                  data-footprint-columns={token.footprint.columns}
                  data-footprint-rows={token.footprint.rows}
                  data-sprite-archetype={token.sprite.archetypeId}
                  data-sprite-fallback={String(token.sprite.isFallback)}
                  style={{
                    gridColumn: token.footprint.gridColumnStyle,
                    gridRow: token.footprint.gridRowStyle
                  }}
                >
                  {token.badges.length > 0 && (
                    <div
                      className="token-badges"
                      data-testid={`token-badges-${token.id}`}
                      data-combatant-badges={token.name}
                    >
                      {token.badges.map((badge) => (
                        <span
                          key={badge.id}
                          className={`token-badge tone-${badge.tone}`}
                          title={badge.label}
                          data-badge-code={badge.code}
                        >
                          <span className="token-badge-symbol" aria-hidden="true">
                            {badge.symbol}
                          </span>
                          <span>{badge.code}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <span
                    className="token-contact-shadow"
                    data-testid={`token-shadow-${token.id}`}
                    aria-hidden="true"
                  />
                  <span className="token-pedestal" aria-hidden="true" />

                  <div className="token-figure">
                    <CombatantSprite
                      combatant={token.combatant}
                      mirrored={token.mirroredInCamera}
                    />
                  </div>

                  <div
                    className="token-nameplate"
                    data-testid={`token-name-${token.id}`}
                    data-combatant-nameplate={token.name}
                  >
                    <span className="token-name-text">{token.name}</span>
                    <span className="token-hp-bar" aria-hidden="true">
                      <span
                        className="token-hp-fill"
                        style={{ width: `${token.hpPercent}%` }}
                      />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
