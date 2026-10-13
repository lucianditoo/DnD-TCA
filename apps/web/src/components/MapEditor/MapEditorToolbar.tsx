import { useState } from "react";
import type { Board } from "@dnd-tactical/shared";

export type MapEditorBrush = "wall" | "pillar" | "rubble" | "clear";

export function areBoardsSemanticallyEqual(a: Board, b: Board): boolean {
  if (a.width !== b.width || a.height !== b.height) return false;
  if ((a.cellSizeFeet ?? 5) !== (b.cellSizeFeet ?? 5)) return false;

  const compareSets = (listA?: readonly string[], listB?: readonly string[]) => {
    const setA = new Set(listA ?? []);
    const setB = new Set(listB ?? []);
    if (setA.size !== setB.size) return false;
    for (const item of setA) {
      if (!setB.has(item)) return false;
    }
    return true;
  };

  return (
    compareSets(a.impassableCells, b.impassableCells) &&
    compareSets(a.lineOfEffectBlockingCells, b.lineOfEffectBlockingCells) &&
    compareSets(a.difficultTerrainCells, b.difficultTerrainCells) &&
    compareSets(a.narrowCells, b.narrowCells) &&
    compareSets(a.dimLightCells, b.dimLightCells) &&
    compareSets(a.darknessCells, b.darknessCells)
  );
}

export interface MapEditorToolbarProps {
  readonly board: Board;
  readonly activeBrush: MapEditorBrush;
  readonly isSaving?: boolean;
  readonly onSelectBrush: (brush: MapEditorBrush) => void;
  readonly onResizeBoard: (width: number, height: number) => void;
  readonly onClearAllObstacles: () => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
  readonly error?: string | null;
}

export function MapEditorToolbar({
  board,
  activeBrush,
  isSaving = false,
  onSelectBrush,
  onResizeBoard,
  onClearAllObstacles,
  onSave,
  onCancel,
  error
}: MapEditorToolbarProps) {
  const [widthInput, setWidthInput] = useState(String(board.width));
  const [heightInput, setHeightInput] = useState(String(board.height));

  const handleApplyDimensions = () => {
    const w = parseInt(widthInput, 10);
    const h = parseInt(heightInput, 10);
    if (!Number.isNaN(w) && !Number.isNaN(h)) {
      const clampedW = Math.max(6, Math.min(40, w));
      const clampedH = Math.max(6, Math.min(40, h));
      setWidthInput(String(clampedW));
      setHeightInput(String(clampedH));
      onResizeBoard(clampedW, clampedH);
    }
  };

  const impassableSet = new Set(board.impassableCells ?? []);
  const wallCount = board.impassableCells?.length ?? 0;
  const pillarCount = (board.lineOfEffectBlockingCells ?? []).filter((k) => !impassableSet.has(k)).length;
  const rubbleCount = board.difficultTerrainCells?.length ?? 0;

  return (
    <div className="map-editor-toolbar card" data-testid="map-editor-toolbar">
      <div className="map-editor-header">
        <div className="map-editor-title">
          <span className="badge badge-gm">GM</span>
          <strong>Editor Táctico de Mapa (D-5 MVP)</strong>
          <span className="map-editor-hint">
            Hacé click en cualquier casilla del tablero para pintarla con el pincel activo.
          </span>
        </div>
        <div className="map-editor-stats">
          <span>Dimensiones: <strong>{board.width}×{board.height}</strong></span>
          <span>🧱 Muros: <strong>{wallCount}</strong></span>
          <span>🏛️ Pilares: <strong>{pillarCount}</strong></span>
          <span>🪨 Escombros: <strong>{rubbleCount}</strong></span>
        </div>
      </div>

      {error ? (
        <div className="map-editor-error" role="alert" data-testid="map-editor-error">
          ⚠️ {error}
        </div>
      ) : null}

      <div className="map-editor-controls">
        <div className="map-editor-group" role="group" aria-label="Dimensiones de la sala">
          <span className="control-label">Tamaño:</span>
          <div className="dimension-inputs">
            <input
              type="number"
              min={6}
              max={40}
              value={widthInput}
              disabled={isSaving}
              aria-label="Ancho del mapa"
              data-testid="map-editor-width"
              onChange={(e) => setWidthInput(e.target.value)}
            />
            <span>×</span>
            <input
              type="number"
              min={6}
              max={40}
              value={heightInput}
              disabled={isSaving}
              aria-label="Alto del mapa"
              data-testid="map-editor-height"
              onChange={(e) => setHeightInput(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              data-testid="map-editor-apply-dims"
              disabled={isSaving}
              onClick={handleApplyDimensions}
            >
              Redimensionar
            </button>
          </div>
        </div>

        <div className="map-editor-group" role="radiogroup" aria-label="Pinceles de mapa">
          <span className="control-label">Pincel:</span>
          <button
            type="button"
            className={`brush-btn ${activeBrush === "wall" ? "active" : ""}`}
            role="radio"
            aria-checked={activeBrush === "wall"}
            data-testid="brush-wall"
            disabled={isSaving}
            onClick={() => onSelectBrush("wall")}
          >
            🧱 Muro
          </button>
          <button
            type="button"
            className={`brush-btn ${activeBrush === "pillar" ? "active" : ""}`}
            role="radio"
            aria-checked={activeBrush === "pillar"}
            data-testid="brush-pillar"
            disabled={isSaving}
            onClick={() => onSelectBrush("pillar")}
          >
            🏛️ Columna LoE
          </button>
          <button
            type="button"
            className={`brush-btn ${activeBrush === "rubble" ? "active" : ""}`}
            role="radio"
            aria-checked={activeBrush === "rubble"}
            data-testid="brush-rubble"
            disabled={isSaving}
            onClick={() => onSelectBrush("rubble")}
          >
            🪨 Escombros (2×)
          </button>
          <button
            type="button"
            className={`brush-btn ${activeBrush === "clear" ? "active" : ""}`}
            role="radio"
            aria-checked={activeBrush === "clear"}
            data-testid="brush-clear"
            disabled={isSaving}
            onClick={() => onSelectBrush("clear")}
          >
            🧹 Borrador
          </button>
        </div>

        <div className="map-editor-actions">
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            data-testid="map-editor-clear-all"
            disabled={isSaving}
            onClick={onClearAllObstacles}
          >
            Limpiar Todo
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            data-testid="map-editor-save"
            disabled={isSaving}
            onClick={onSave}
          >
            {isSaving ? "Guardando..." : "Guardar y Aplicar"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            data-testid="map-editor-cancel"
            disabled={isSaving}
            onClick={onCancel}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
