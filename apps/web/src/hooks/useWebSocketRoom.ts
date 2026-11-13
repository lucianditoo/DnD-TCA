import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  ClientCommand,
  CombatRoom,
  DemoClientCommand,
  DemoSessionState,
  DemoSpeedMultiplier,
  GameCatalog,
  Participant,
  ResumeGmSessionCommand,
  RoomInterruption,
  ServerEvent
} from "@dnd-tactical/shared";
import { getActiveCombatant } from "../viewModel";

const socketUrl =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:3333`;
const endpoint = new URL(socketUrl, window.location.href);
const localUi = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
const canResume = (endpoint.protocol === "wss:" && (localUi || window.location.protocol === "https:")) ||
  (endpoint.protocol === "ws:" && ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname) &&
    localUi);

function storageKey(roomCode: string) {
  return "dnd-tca:gm:" + endpoint.href + ":" + roomCode;
}

function readResume(roomCode: string): ResumeGmSessionCommand | null {
  if (!canResume || !roomCode) return null;
  try {
    const token = sessionStorage.getItem(storageKey(roomCode));
    return token && /^[A-Za-z0-9_-]{43}$/.test(token)
      ? { type: "resume-gm-session", roomCode, token }
      : null;
  } catch {
    return null;
  }
}

export type JoinMode = "gm" | "player";

export function useWebSocketRoom({ onHello, onActiveTurnChanged }: { onHello: () => void; onActiveTurnChanged: (room: CombatRoom) => void }) {
  const socketRef = useRef<WebSocket | null>(null);
  const activeCombatantIdRef = useRef<string | null>(null);
  const [name, setName] = useState("Lucia");
  const pathRoomCode = window.location.pathname.startsWith("/combat/") ? window.location.pathname.split("/")[2]?.toUpperCase() ?? "" : "";
  const [initialResume] = useState(() => readResume(pathRoomCode));
  const resumeRef = useRef(initialResume);
  const retryTimer = useRef<number | undefined>(undefined);
  const handshakeTimer = useRef<number | undefined>(undefined);
  const [reconnecting, setReconnecting] = useState(Boolean(initialResume));
  const [roomCode, setRoomCode] = useState(pathRoomCode);
  const [mode, setMode] = useState<JoinMode>(pathRoomCode ? "player" : "gm");
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [room, setRoom] = useState<CombatRoom | null>(null);
  const [interruption, setInterruption] = useState<RoomInterruption | null>(null);
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

  function connect(command: ClientCommand | DemoClientCommand | ResumeGmSessionCommand, attempt = 0) {
    window.clearTimeout(retryTimer.current);
    window.clearTimeout(handshakeTimer.current);
    const resuming = command.type === "resume-gm-session";
    setReconnecting(resuming);
    if (!resuming) resumeRef.current = null;
    setError(null);
    socketRef.current?.close();
    const socket = new WebSocket(socketUrl);
    socketRef.current = socket;
    let established = false;
    function armWatchdog() {
      window.clearTimeout(handshakeTimer.current);
      handshakeTimer.current = window.setTimeout(disconnect, 40_000);
    }
    socket.onopen = () => {
      if (socketRef.current === socket) socket.send(JSON.stringify(command));
    };
    if (resuming) {
      handshakeTimer.current = window.setTimeout(disconnect, 8_000);
    }
    socket.onmessage = (event) => {
      if (socketRef.current !== socket) return;
      const payload = JSON.parse(event.data) as ServerEvent;
      if (payload.type === "gm-resume-rejected" && resuming) {
        if (payload.reason === "unavailable") {
          resumeRef.current = null;
          try { sessionStorage.removeItem(storageKey(command.roomCode)); } catch {}
          setError("La sesion del GM ya no esta disponible.");
        }
        socket.close();
        return;
      }
      if (payload.type === "gm-session-heartbeat" && resumeRef.current && established) {
        armWatchdog();
      }
      if (payload.type === "hello") {
        established = true;
        window.clearTimeout(handshakeTimer.current);
        setReconnecting(false);
        attempt = 0;
        if (canResume && payload.participant.role === "gm" && payload.gmResumeToken) {
          resumeRef.current = { type: "resume-gm-session", roomCode: payload.room.code, token: payload.gmResumeToken };
          try { sessionStorage.setItem(storageKey(payload.room.code), payload.gmResumeToken); } catch {}
        }
        if (resumeRef.current) armWatchdog();
        setRoomCode(payload.room.code);
        const nextActiveId = payload.room.phase === "active" ? getActiveCombatant(payload.room)?.id ?? null : null;
        activeCombatantIdRef.current = nextActiveId;
        setParticipant(payload.participant);
        setRoom(payload.room);
        setInterruption(payload.interruption ?? null);
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
        if (nextActiveId !== activeCombatantIdRef.current) onActiveTurnChanged(payload.room);
        activeCombatantIdRef.current = nextActiveId;
        setRoom(payload.room);
        setInterruption(payload.interruption ?? null);
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
        setInterruption(null);
        setParticipant(null);
        setSelectedId(null);
        setError(null);
        window.history.replaceState({}, "", "/");
      }
      if (payload.type === "error") setError(payload.message);
    };
    socket.onerror = () => {
      if (socketRef.current === socket) setError("No se pudo conectar con el servidor local.");
    };
    function disconnect() {
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      socket.close();
      window.clearTimeout(handshakeTimer.current);
      activeCombatantIdRef.current = null;
      updateDemoSessionState(null);
      setParticipant(null);
      setRoom(null);
      setInterruption(null);
      setCatalog(null);
      setSelectedId(null);
      const resume = resumeRef.current;
      setReconnecting(Boolean(resume));
      if (resume) {
        retryTimer.current = window.setTimeout(() => connect(resume, attempt + 1), Math.min(500 * 2 ** attempt, 5_000));
      } else {
        setError((current) => current ?? "Se cerro la conexion con el servidor local.");
      }
    }
    socket.onclose = disconnect;
  }

  useEffect(() => {
    if (initialResume) connect(initialResume);
    return () => {
      window.clearTimeout(retryTimer.current);
      window.clearTimeout(handshakeTimer.current);
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();
    };
  }, [initialResume]);

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
    connect({ type: "join-room", roomCode: roomCode.toUpperCase(), name, role: "player" });
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
    participant, room, catalog, interruption, selectedId, setSelectedId,
    selectedHeroTemplateId, setSelectedHeroTemplateId,
    selectedEnemyTemplateId, setSelectedEnemyTemplateId,
    demoSessionState, reconnecting,
    error, setError, createRoom, joinRoom, roomCommand,
    startDemo, pauseDemo, resumeDemo, stepDemo, setDemoSpeed, restartDemo, exitDemo
  };
}
