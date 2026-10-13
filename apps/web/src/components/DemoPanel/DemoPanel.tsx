import type { DemoSessionState, DemoSpeedMultiplier } from "@dnd-tactical/shared";
import { FastForward, LogOut, Pause, Play, RotateCcw, SkipForward } from "lucide-react";

export interface DemoPanelProps {
  readonly state: DemoSessionState;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onStep: () => void;
  readonly onSetSpeed: (speed: DemoSpeedMultiplier) => void;
  readonly onRestart: (scope: "scene" | "all") => void;
  readonly onExit: () => void;
}

const SPEED_OPTIONS: readonly DemoSpeedMultiplier[] = [0.5, 1, 2];

function statusBadgeLabel(status: DemoSessionState["status"]): string {
  switch (status) {
    case "starting":
    case "preparing":
      return "Preparando";
    case "playing":
      return "En ejecución";
    case "paused":
      return "En pausa";
    case "completed":
      return "Completada";
    case "failed":
      return "Error";
  }
}

export function DemoPanel({
  state,
  onPause,
  onResume,
  onStep,
  onSetSpeed,
  onRestart,
  onExit
}: DemoPanelProps) {
  const stepNumber = state.currentStepIndex < 0 ? 0 : state.currentStepIndex + 1;
  const progressPercent =
    state.totalStepsInScene > 0 ? Math.min(100, Math.round((stepNumber / state.totalStepsInScene) * 100)) : 0;
  const isPlaying = state.status === "playing" || state.status === "starting" || state.status === "preparing";

  return (
    <section
      className="panel demo-panel"
      data-testid="demo-panel"
      data-sequence={String(state.sequence)}
      data-current-step-index={String(state.currentStepIndex)}
      style={{
        display: "grid",
        gap: "8px",
        padding: "10px 14px",
        borderColor: state.status === "failed" ? "#c46b4f" : "#b7a56a",
        background: "#1c2019"
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: "2px" }}>
            Demostración Táctica Automática · Escena {state.currentSceneIndex + 1} de {state.totalScenes}
          </p>
          <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#f4e3aa" }} data-testid="demo-scene-title">
            {state.currentSceneTitle}
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span
            className="turn-pill"
            data-testid="demo-status-badge"
            style={{
              padding: "5px 10px",
              fontSize: "0.84rem",
              borderColor:
                state.status === "failed"
                  ? "#c46b4f"
                  : state.status === "completed"
                    ? "#58b6a9"
                    : "#b7a56a"
            }}
          >
            {statusBadgeLabel(state.status)} · Paso {stepNumber} de {state.totalStepsInScene}
          </span>
        </div>
      </div>

      <div
        aria-label="Progreso de la escena"
        style={{
          width: "100%",
          height: "5px",
          borderRadius: "999px",
          background: "#11130f",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: "100%",
            background: state.status === "completed" ? "#58b6a9" : "#b7a56a",
            transition: "width 0.2s ease"
          }}
        />
      </div>

      <div
        className="rules-box"
        style={{
          display: "grid",
          gap: "4px",
          padding: "7px 10px",
          borderColor: "#46483e",
          background: "#141712"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "0.9rem" }}>
          <strong style={{ color: "#f4e3aa" }} data-testid="demo-actor-name">
            {state.activeActorName ?? "Sistema"}
          </strong>
          <span style={{ color: "#bdb6a6" }}>—</span>
          <span style={{ color: "#f7f3e8", fontWeight: 600 }} data-testid="demo-action-summary">
            {state.actionSummary}
          </span>
        </div>
        <p style={{ margin: 0, color: "#d7d1bf", fontSize: "0.84rem", lineHeight: 1.35 }} data-testid="demo-rule-explanation">
          {state.ruleExplanation}
        </p>
      </div>

      {state.status === "failed" && state.errorMessage && (
        <p className="error" data-testid="demo-error-message">
          Error en la demostración: {state.errorMessage}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          {isPlaying ? (
            <button type="button" onClick={onPause} data-testid="demo-pause-btn">
              <Pause size={16} /> Pausar
            </button>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={onResume}
              disabled={state.status === "completed" || state.status === "failed"}
              data-testid="demo-resume-btn"
            >
              <Play size={16} /> Continuar
            </button>
          )}

          <button
            type="button"
            onClick={onStep}
            disabled={state.status !== "paused"}
            data-testid="demo-step-btn"
          >
            <SkipForward size={16} /> Siguiente paso
          </button>

          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginLeft: "4px" }}>
            <FastForward size={15} style={{ color: "#b7a56a", marginRight: "2px" }} />
            {SPEED_OPTIONS.map((speedOption) => (
              <button
                key={speedOption}
                type="button"
                onClick={() => onSetSpeed(speedOption)}
                data-testid={`demo-speed-${speedOption}x`}
                style={{
                  minHeight: "34px",
                  padding: "0 10px",
                  borderColor: state.speedMultiplier === speedOption ? "#c46b4f" : "#46483e",
                  background: state.speedMultiplier === speedOption ? "#503126" : "#24261f"
                }}
              >
                {speedOption}x
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
          <button type="button" onClick={() => onRestart("scene")} data-testid="demo-restart-scene-btn">
            <RotateCcw size={16} /> Reiniciar escena
          </button>
          <button type="button" onClick={() => onRestart("all")} data-testid="demo-restart-all-btn">
            <RotateCcw size={16} /> Reiniciar demo
          </button>
          <button
            type="button"
            onClick={onExit}
            data-testid="demo-exit-btn"
            style={{ borderColor: "#c46b4f", color: "#ffd6cd" }}
          >
            <LogOut size={16} /> Salir de la demo
          </button>
        </div>
      </div>
    </section>
  );
}
