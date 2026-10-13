import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  ClientCommand,
  CombatRoom,
  DemoClientCommand,
  DemoSessionState,
  DemoSpeedMultiplier,
  GameCatalog,
  Participant,
  ServerEvent
} from "@dnd-tactical/shared";
import { getActiveCombatant } from "../viewModel";

const socketUrl =
  import.meta.env.VITE_WS_URL ??
  `ws://${window.location.hostname}:3333`;
export type JoinMode = "gm" | "player";

export function useWebSocketRoom({ onHello, onActiveTurnChanged }: { onHello: () => void; onActiveTurnChanged: () => void }) {
  const socketRef = useRef<WebSocket | null>(null);
  const activeCombatantIdRef = useRef<string | null>(null);
  const [name, setName] = useState("Lucia");
  const pathRoomCode = window.location.pathname.startsWith("/combat/") ? window.location.pathname.split("/")[2]?.toUpperCase() ?? "" : "";
  const [roomCode, setRoomCode] = useState(pathRoomCode);
  const [mode, setMode] = useState<JoinMode>(pathRoomCode ? "player" : "gm");
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [room, setRoom] = useState<CombatRoom | null>(null);
  const [catalog, setCatalog] = useState<GameCatalog | null>(null);
  const [selectedHeroTemplateId, setSelectedHeroTemplateId] = useState("");
  const [selectedEnemyTemplateId, setSelectedEnemyTemplateId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [demoSessionState, setDemoSessionState] = useState<DemoSessionState | null>(null);
  const demoSessionStateRef = useRef<DemoSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateDemoSessionState(nextState: DemoSessionState | null) {
    demoSessionStateRef.current = nextState;
    setDemoSessionState(nextState);
  }

  function connect(command: ClientCommand | DemoClientCommand) {
    socketRef.current?.close();
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;
    socket.onopen = () => socket.send(JSON.stringify(command));
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as ServerEvent;
      if (payload.type === "hello") {
        const nextActiveId = payload.room.phase === "active" ? getActiveCombatant(payload.room)?.id ?? null : null;
        activeCombatantIdRef.current = nextActiveId;
        setParticipant(payload.participant);
        setRoom(payload.room);
        setCatalog(payload.catalog);
        setSelectedHeroTemplateId(payload.catalog.creatures.heroes[0]?.id ?? "");
        setSelectedEnemyTemplateId(payload.catalog.creatures.enemies[0]?.id ?? "");
        setSelectedId(payload.room.phase === "active" ? nextActiveId : payload.room.combatants[0]?.id ?? null);
        window.history.replaceState({}, "", "/combat/" + payload.room.code);
        onHello();
        setError(null);
      }
      if (payload.type === "room-update") {
        const nextActiveId = payload.room.phase === "active" ? getActiveCombatant(payload.room)?.id ?? null : null;
        if (nextActiveId !== activeCombatantIdRef.current) onActiveTurnChanged();
        activeCombatantIdRef.current = nextActiveId;
        setRoom(payload.room);
        setSelectedId((current) => payload.room.phase === "active" ? nextActiveId : current ?? payload.room.combatants[0]?.id ?? null);
        setError(null);
      }
      if (payload.type === "demo-session-state") {
        updateDemoSessionState(payload.state);
      }
      if (payload.type === "demo-exited") {
        activeCombatantIdRef.current = null;
        updateDemoSessionState(null);
        setRoom(null);
        setParticipant(null);
        setSelectedId(null);
        setError(null);
        window.history.replaceState({}, "", "/");
      }
      if (payload.type === "error") setError(payload.message);
    };
    socket.onerror = () => setError("No se pudo conectar con el servidor local.");
  }

  function send(command: ClientCommand | DemoClientCommand) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("La conexion WebSocket no esta lista.");
      return;
    }
    socketRef.current.send(JSON.stringify(command));
  }

  function createRoom(event: FormEvent) {
    event.preventDefault();
    updateDemoSessionState(null);
    connect({ type: "create-room", name });
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    updateDemoSessionState(null);
    connect({ type: "join-room", roomCode: roomCode.toUpperCase(), name, role: mode });
  }

  function startDemo() {
    connect({ type: "start-demo", demoId: "scripted_tactical_demo_v1" });
  }

  function pauseDemo() {
    const current = demoSessionStateRef.current;
    if (!current) return;
    send({ type: "pause-demo", sessionId: current.sessionId, sequence: current.sequence });
  }

  function resumeDemo() {
    const current = demoSessionStateRef.current;
    if (!current) return;
    send({ type: "resume-demo", sessionId: current.sessionId, sequence: current.sequence });
  }

  function stepDemo() {
    const current = demoSessionStateRef.current;
    if (!current) return;
    send({ type: "step-demo", sessionId: current.sessionId, sequence: current.sequence });
  }

  function setDemoSpeed(speed: DemoSpeedMultiplier) {
    const current = demoSessionStateRef.current;
    if (!current) return;
    send({ type: "set-demo-speed", sessionId: current.sessionId, sequence: current.sequence, speedMultiplier: speed });
  }

  function restartDemo(scope: "scene" | "all") {
    const current = demoSessionStateRef.current;
    if (!current) return;
    send({ type: "restart-demo", sessionId: current.sessionId, sequence: current.sequence, scope });
  }

  function exitDemo() {
    const current = demoSessionStateRef.current;
    if (!current) return;
    send({ type: "exit-demo", sessionId: current.sessionId, sequence: current.sequence });
  }

  function roomCommand<T extends ClientCommand>(command: T) {
    if (!room || !participant || demoSessionStateRef.current) return;
    send(command);
  }

  return {
    name, setName, roomCode, setRoomCode, mode, setMode,
    participant, room, catalog, selectedId, setSelectedId,
    selectedHeroTemplateId, setSelectedHeroTemplateId,
    selectedEnemyTemplateId, setSelectedEnemyTemplateId,
    demoSessionState,
    error, setError, createRoom, joinRoom, roomCommand,
    startDemo, pauseDemo, resumeDemo, stepDemo, setDemoSpeed, restartDemo, exitDemo
  };
}
