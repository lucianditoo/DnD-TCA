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
            ["--camera-zoom" as string]: String(cameraZoom),
            ["--camera-yaw" as string]: `${presentation.yawDeg}deg`,
            ["--camera-tilt" as string]: `${presentation.tiltDeg}deg`
          }}
        >
          {/* PLINTO SÓLIDO DE LA BASE */}
          <div className="tactical-board-slab">
            {viewMode === "2.5d" && (
              <>
                <div className="slab-face slab-front" aria-hidden="true" />
                <div className="slab-face slab-side" aria-hidden="true" />
              </>
            )}

            {/* SUPERFICIE CONTINUA DEL TABLERO */}
            <div
              className="board"
              style={{
                gridTemplateColumns: `repeat(${presentation.width}, minmax(36px, 1fr))`,
                gridTemplateRows: `repeat(${presentation.height}, minmax(36px, 1fr))`,
                aspectRatio: `${presentation.width} / ${presentation.height}`
              }}
            >
              {/* CAPA DE CELDAS E INTERACCIÓN (Overlays en el suelo) */}
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
                  <span className="cell-overlay-wash" aria-hidden="true" />

                  {cell.routeIndex >= 0 && cell.routeStepCost !== null && (
                    <span className="route-step">{cell.routeStepCost}</span>
                  )}
                </button>
              ))}

              {/* CAPA DE VOLÚMENES ESCÉNICOS (Muros, pilares, escombros, zócalos) */}
              {viewMode === "2.5d" &&
                presentation.volumes.map((vol) => (
                  <div
                    key={vol.key}
                    className={`volumetric-prop prop-${vol.kind}`}
                    style={{
                      gridColumn: vol.projectedGridColumn,
                      gridRow: vol.projectedGridRow,
                      zIndex: vol.paintDepth
                    }}
                    aria-hidden="true"
                  >
                    <div className="prop-shadow" />
                    <div className="prop-prism">
                      <div className="prism-top" />
                      {vol.visibleFaces.map((f) => (
                        <div
                          key={f.face}
                          className={`prism-face face-${f.face} shade-${f.shade}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}

              {/* CAPA DE UNIDADES BILLBOARD (Erguidas perpendicularmente al suelo) */}
              {presentation.tokens.map((token) => {
                const selectedClass = token.isSelected ? " selected-token" : "";
                const targetClass = token.isTarget ? " target-token" : "";
                const activeTurnClass = token.isActiveTurn ? " active-turn-token" : "";
                const proneClass = token.isProne ? " token-prone" : "";
                const paralyzedClass = token.isParalyzed ? " token-paralyzed" : "";
                const squeezingClass = token.isSqueezing ? " token-squeezing" : "";
                const largeClass = token.sprite.isLarge ? " token-large" : "";
                const poseClass = ` token-pose-${token.pose}`;

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
                      largeClass +
                      poseClass
                    }
                    data-testid={`token-${token.id}`}
                    data-combatant-name={token.name}
                    data-footprint-columns={token.projectedFootprint.columns}
                    data-footprint-rows={token.projectedFootprint.rows}
                    data-sprite-archetype={token.sprite.archetypeId}
                    data-sprite-fallback={String(token.sprite.isFallback)}
                    style={{
                      gridColumn: token.projectedFootprint.gridColumnStyle,
                      gridRow: token.projectedFootprint.gridRowStyle,
                      zIndex: 100 + token.paintIndex
                    }}
                  >
                    {/* Sombra de contacto sobre el suelo */}
                    <span
                      className="token-contact-shadow"
                      data-testid={`token-shadow-${token.id}`}
                      aria-hidden="true"
                    />

                    {/* Marcador táctico de base */}
                    <span className="token-ground-marker" aria-hidden="true" />

                    {/* BILLBOARD STANDING FIGURE */}
                    <div className="token-billboard">
                      <div className="token-figure">
                        <CombatantSprite
                          combatant={token.combatant}
                          mirrored={token.mirroredInCamera}
                          variant={viewMode === "2.5d" ? "full" : "portrait"}
                        />
                      </div>

                      {/* Placa flotante compacta con nombre y barra HP */}
                      <div
                        className="token-nameplate"
                        data-testid={`token-name-${token.id}`}
                        data-combatant-nameplate={token.name}
                      >
                        <span className="token-name-text">{token.displayName}</span>
                        <span className="token-hp-bar" aria-hidden="true">
                          <span
                            className="token-hp-fill"
                            style={{ width: `${token.hpPercent}%` }}
                          />
                        </span>
                      </div>

                      {/* Badges de condición y cobertura secundarios */}
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
                              {badge.text ? <span>{badge.text}</span> : null}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
