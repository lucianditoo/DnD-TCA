import type { FormEvent } from "react";
import { LogIn, Play, Users } from "lucide-react";
import type { JoinMode } from "../../hooks/useWebSocketRoom";

export function ConnectionPanel({
  name,
  roomCode,
  mode,
  error,
  onNameChange,
  onRoomCodeChange,
  onModeChange,
  onCreateRoom,
  onJoinRoom,
  onStartDemo
}: {
  name: string;
  roomCode: string;
  mode: JoinMode;
  error: string | null;
  onNameChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  onModeChange: (value: JoinMode) => void;
  onCreateRoom: (event: FormEvent) => void;
  onJoinRoom: (event: FormEvent) => void;
  onStartDemo: () => void;
}) {
  return <main className="login-shell">
    <section className="join-panel">
      <div>
        <p className="eyebrow">D&D 3.5 Tactical Combat Assistant</p>
        <h1>Sala local de combate</h1>
      </div>
      <form onSubmit={mode === "gm" ? onCreateRoom : onJoinRoom} className="join-form">
        <label>Nombre<input value={name} onChange={(event) => onNameChange(event.target.value)} /></label>
        <div className="segmented">
          <button type="button" className={mode === "gm" ? "active" : ""} onClick={() => onModeChange("gm")}><Users size={16} /> GM</button>
          <button type="button" className={mode === "player" ? "active" : ""} onClick={() => onModeChange("player")}><LogIn size={16} /> Jugador</button>
        </div>
        {mode === "player" && <label>Codigo de sala<input value={roomCode} onChange={(event) => onRoomCodeChange(event.target.value)} /></label>}
        <button className="primary" type="submit"><LogIn size={18} /> {mode === "gm" ? "Crear sala" : "Unirse"}</button>
      </form>
      <button
        type="button"
        onClick={onStartDemo}
        data-testid="start-demo-btn"
        style={{
          width: "100%",
          borderColor: "#b7a56a",
          background: "#2a271c",
          color: "#f4e3aa",
          fontWeight: 700
        }}
      >
        <Play size={18} /> Empezar demo
      </button>
      <a className="ghost-link" href="/profiles">Editar perfiles guardados</a>
      {error && <p className="error">{error}</p>}
    </section>
  </main>;
}
