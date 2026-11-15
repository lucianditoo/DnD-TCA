import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import {
  academyScenarios, createCatalogCombatant, createCombatRulesSnapshot, createEmptyRoom, gameCatalog, lifeStatus, makeLog,
  projectSpellArea, SpellsCatalog, type AcademyCommand, type AcademyScenarioId, type AcademyState,
  type CombatRoom, type ClientCommand, type Participant
} from "@dnd-tactical/shared";
import { clients, createRoomCode, register, rooms, send, broadcast } from "../room/roomStore.js";

interface Attempt {
  state: AcademyState;
  room: CombatRoom;
  player: Participant;
  heroId: string;
  enemyIds: string[];
}

const bySocket = new Map<WebSocket, Attempt>();
const privateRooms = new Set<string>();
export const getAcademyAttempt = (socket: WebSocket) => bySocket.get(socket);
export const isAcademyRoom = (code: string) => privateRooms.has(code.toUpperCase());

export function closeAcademy(socket: WebSocket): void {
  const attempt = bySocket.get(socket);
  if (!attempt) return;
  bySocket.delete(socket);
  rooms.delete(attempt.room.code);
  privateRooms.delete(attempt.room.code);
  if (clients.get(socket) === attempt.player) clients.delete(socket);
}

function start(socket: WebSocket, scenarioId: AcademyScenarioId): void {
  if (clients.has(socket)) throw new Error("La conexión ya pertenece a una sala.");
  const room = createEmptyRoom(createRoomCode());
  const player = register(socket, room.code, "Aprendiz", "player");
  try {
    const hero = createCatalogCombatant("bane", "heroes", 1, { type: "player", participantId: player.id });
    hero.position = { x: 1, y: 2, zFeet: 0 };
    hero.initiative = 20;
    const enemy = (x: number, y: number, index: number) => {
      const token = createCatalogCombatant("canocrock", "enemies", index, { type: "gm" });
      token.position = { x, y, zFeet: 0 };
      token.initiative = 1;
      return token;
    };
    const enemies = scenarioId === "fireball" ? [enemy(4, 2, 1), enemy(6, 2, 2)]
      : scenarioId === "opportunity" ? [enemy(1, 1, 1)] : [enemy(4, 1, 1)];
    const barrier = scenarioId === "fireball" ? Array.from({ length: 8 }, (_, y) => "5," + y)
      : scenarioId === "camera" ? ["3,1"] : [];
    room.board = { ...room.board, impassableCells: barrier, lineOfEffectBlockingCells: barrier };
    if (scenarioId === "fireball") {
      // Survive the tutorial's single real blast even when the caster is exposed.
      hero.preparedSpells = [{ slotId: "academy-fireball", spellId: "srd_fireball", isExpended: false }];
    }
    room.combatants = [hero, ...enemies];
    room.turnOrder = room.combatants.map(actor => actor.id);
    room.currentTurn.combatantId = hero.id;
    room.phase = "active";
    const goal = scenarioId === "camera" ? { x: 4, y: 4 } : scenarioId === "opportunity" ? { x: 5, y: 2 } : undefined;
    const state: AcademyState = { attemptId: randomUUID(), scenarioId, status: "active", goal };
    bySocket.set(socket, { state, room, player, heroId: hero.id, enemyIds: enemies.map(actor => actor.id) });
    privateRooms.add(room.code);
    rooms.set(room.code, room);
    send(socket, { type: "hello", participant: player, room, catalog: gameCatalog, academy: state });
  } catch (error) {
    closeAcademy(socket);
    clients.delete(socket);
    throw error;
  }
}

export function handleAcademyCommand(socket: WebSocket, raw: Record<string, unknown>): void {
  if (raw.type === "start-academy" && Object.keys(raw).length === 2) {
    const scenario = academyScenarios.find(item => item.id === raw.scenarioId);
    if (scenario) return start(socket, scenario.id);
  }
  if ((raw.type === "restart-academy" || raw.type === "exit-academy") && Object.keys(raw).length === 2) {
    const attempt = bySocket.get(socket);
    if (attempt && raw.attemptId === attempt.state.attemptId) {
      const command = raw as AcademyCommand;
      closeAcademy(socket);
      if (command.type === "restart-academy") return start(socket, attempt.state.scenarioId);
      send(socket, { type: "academy-exited" });
      return;
    }
  }
  throw new Error("Comando o intento de Academia inválido.");
}

export function executeAcademyAction(
  socket: WebSocket, attempt: Attempt, command: Exclude<ClientCommand, { type: "create-room" | "join-room" }>,
  execute: (command: Exclude<ClientCommand, { type: "create-room" | "join-room" }>) => void,
  runReactions: () => void
): void {
  const { room, state, heroId, enemyIds } = attempt;
  const fireball = state.scenarioId === "fireball";
  if (state.status !== "active" || !rooms.has(room.code)) throw new Error("El intento ya terminó.");
  if (command.type !== "end-turn" && command.type !== (fireball ? "cast-spell" : "move-combatant")) {
    throw new Error("Acción no disponible en este tutorial.");
  }
  const hero = room.combatants.find(actor => actor.id === heroId)!;
  const before = room.combatants.map(actor => ({ id: actor.id, hp: actor.hpCurrent }));
  const projection = command.type === "cast-spell" && fireball
    ? projectSpellArea(createCombatRulesSnapshot(room), hero, SpellsCatalog.require("srd_fireball"), command) : undefined;
  // Academy casts always use the real server default damage and saves.
  execute(command.type === "cast-spell" ? { ...command, amount: null, d20Roll: null }
    : command.type === "move-combatant" ? { ...command, isAcrobatic: false } : command);
  const reaction = room.pendingMovement && room.pendingOpportunityAttacks.find(attack =>
    enemyIds.includes(attack.attackerId) && attack.targetId === heroId);
  const reactor = reaction && room.combatants.find(actor => actor.id === reaction.attackerId);
  const reactionBefore = reactor && { name: reactor.name, hits: reactor.stats.hits, id: reactor.id };
  const stoppedAt = { ...hero.position };
  runReactions();
  const current = room.combatants.find(actor => actor.id === heroId)!;
  if (reactionBefore) {
    const resolved = room.combatants.find(actor => actor.id === reactionBefore.id);
    const hit = resolved && resolved.stats.hits > reactionBefore.hits;
    const continued = !room.pendingMovement && (stoppedAt.x !== current.position.x ||
      stoppedAt.y !== current.position.y || stoppedAt.zFeet !== current.position.zFeet);
    room.log.unshift(makeLog("system",
      `Academia: el movimiento se interrumpió en (${stoppedAt.x}, ${stoppedAt.y}). ${reactionBefore.name} ${hit ? "acertó" : "falló"} su AdO. ${
        continued ? `El movimiento continuó hasta (${current.position.x}, ${current.position.y}).` : "El movimiento no continuó."} `.trim()));
    broadcast(room);
  }
  const spent = Boolean(current.preparedSpells[0]?.isExpended);
  const changedHp = (id: string) => room.combatants.find(actor => actor.id === id)!.hpCurrent !== before.find(actor => actor.id === id)!.hp;
  const reached = state.goal && current.position.x === state.goal.x && current.position.y === state.goal.y;
  const passed = fireball ? spent && projection?.ok && projection.earlyDetonation && changedHp(enemyIds[0]) && !changedHp(enemyIds[1])
    : reached && (state.scenarioId !== "opportunity" || reactionBefore) && !room.pendingMovement;
  if (lifeStatus(current) !== "active" || command.type === "end-turn") {
    state.status = "failed";
    state.reason = "El turno terminó o el aprendiz quedó incapacitado.";
  } else if (passed) state.status = "victory";
  else if ((fireball && spent) || room.outcome !== "ongoing") {
    state.status = "failed";
    state.reason = "El intento terminó sin completar el objetivo.";
  }
  send(socket, { type: "academy-state", state });
}
