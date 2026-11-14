import { academyScenarios, type AcademyScenarioId } from "@dnd-tactical/shared";
import { useState, type FormEvent } from "react";
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
  onStartDemo,
  onStartAcademy
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
  onStartAcademy: (id: AcademyScenarioId) => void;
}) {
  const [menu, setMenu] = useState<"main" | "tutorials" | "academy">("main");
  return <main className="login-shell">
    <section className="join-panel">
      <div>
        <p className="eyebrow">D&D 3.5 Tactical Combat Assistant</p>
        <h1>Sala local de combate</h1>
      </div>
      {menu === "main" && <form onSubmit={mode === "gm" ? onCreateRoom : onJoinRoom} className="join-form">
        <label>Nombre<input value={name} onChange={(event) => onNameChange(event.target.value)} /></label>
        <div className="segmented">
          <button type="button" className={mode === "gm" ? "active" : ""} onClick={() => onModeChange("gm")}><Users size={16} /> Crear como GM</button>
          <button type="button" className={mode === "player" ? "active" : ""} onClick={() => onModeChange("player")}><LogIn size={16} /> Unirse como jugador</button>
        </div>
        {mode === "player" && <label>Codigo de sala<input value={roomCode} onChange={(event) => onRoomCodeChange(event.target.value)} /></label>}
        <button className="primary" type="submit"><LogIn size={18} /> {mode === "gm" ? "Crear sala" : "Unirse"}</button>
      </form>}
      {menu === "main" && <button
        type="button"
        onClick={() => setMenu("tutorials")}
        data-testid="tutorials-btn"
        style={{
          width: "100%",
          borderColor: "#b7a56a",
          background: "#2a271c",
          color: "#f4e3aa",
          fontWeight: 700
        }}
      >
        <Play size={18} /> Tutoriales
      </button>}
      {menu === "tutorials" && <>
        <button data-testid="start-demo-btn" onClick={onStartDemo}>Old Demo</button>
        <button onClick={() => setMenu("academy")}>Academia de Combate</button>
      </>}
      {menu === "academy" && academyScenarios.map(scenario => <section key={scenario.id}>
        <h2>{scenario.category}</h2>
        <button onClick={() => onStartAcademy(scenario.id)}>{scenario.title}</button>
      </section>)}
      {menu !== "main" && <button onClick={() => setMenu(menu === "academy" ? "tutorials" : "main")}>Volver</button>}
      <a className="ghost-link" href="/profiles">Editar perfiles guardados</a>
      {error && <p className="error">{error}</p>}
    </section>
  </main>;
}
