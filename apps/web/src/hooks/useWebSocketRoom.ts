import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ClientCommand, CombatRoom, GameCatalog, Participant, ServerEvent } from "@dnd-tactical/shared";
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
  const [error, setError] = useState<string | null>(null);

  function connect(command: ClientCommand) {
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
      if (payload.type === "error") setError(payload.message);
    };
    socket.onerror = () => setError("No se pudo conectar con el servidor local.");
  }

  function send(command: ClientCommand) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError("La conexion WebSocket no esta lista.");
      return;
    }
    socketRef.current.send(JSON.stringify(command));
  }

  function createRoom(event: FormEvent) {
    event.preventDefault();
    connect({ type: "create-room", name });
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    connect({ type: "join-room", roomCode: roomCode.toUpperCase(), name, role: mode });
  }

  function roomCommand<T extends ClientCommand>(command: T) {
    if (!room || !participant) return;
    send(command);
  }

  return {
    name, setName, roomCode, setRoomCode, mode, setMode,
    participant, room, catalog, selectedId, setSelectedId,
    selectedHeroTemplateId, setSelectedHeroTemplateId,
    selectedEnemyTemplateId, setSelectedEnemyTemplateId,
    error, setError, createRoom, joinRoom, roomCommand
  };
}
