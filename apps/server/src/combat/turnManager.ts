import { currentCombatant, lifeStatus, type CombatRoom, type TurnState, dispatchCombatEvent, effectsTickListener, type CombatEvent, type CombatEventListener, type CombatEventData } from "@dnd-tactical/shared";
import { expireEndOfTurnBuffs, expireStartOfTurnBuffs } from "./buffRules.js";
import { roundTickListener } from "@dnd-tactical/shared";
import { resolveEnvironmentalHazards } from "./environmentalHazardResolver.js";
import { rollDice } from "./diceRoller.js";

// Composition Root
const combatListeners = [effectsTickListener, roundTickListener];

export function emitCombatEvent(
  room: CombatRoom,
  eventData: CombatEventData,
  listeners: readonly CombatEventListener[]
): CombatRoom {
  const nextSequence = room.eventSequence + 1;
  const event: CombatEvent = { ...eventData, sequence: nextSequence } as CombatEvent;
  
  const nextRoom = dispatchCombatEvent(room, event, listeners);
  
  // Update eventSequence directly on the resulting room to maintain monotonic invariant
  nextRoom.eventSequence = nextSequence;
  return nextRoom;
}

export function advanceTurn(room: CombatRoom, diceRoller: (sides: number) => number = rollDice): void {
  const outgoing = currentCombatant(room);

  if (outgoing) {
    // 1. [Legacy] Buffs de fin de turno
    expireEndOfTurnBuffs(room, outgoing);

    // 2. [EventBus] Despachar TurnEnded (y TickLayer evalúa)
    const afterTurnEnded = emitCombatEvent(
      room,
      { type: "TurnEnded", combatantId: outgoing.id, round: room.round },
      combatListeners
    );
    Object.assign(room, afterTurnEnded);
  }

  // 3. Avanzar turno
  for (let attempts = 0; attempts < room.turnOrder.length; attempts += 1) {
    room.activeTurnIndex += 1;
    if (room.activeTurnIndex >= room.turnOrder.length) { 
      const afterRoundEnded = emitCombatEvent(
        room,
        { type: "RoundEnded", round: room.round },
        combatListeners
      );
      Object.assign(room, afterRoundEnded);

      room.activeTurnIndex = 0;
      room.round += 1;

      const afterRoundStarted = emitCombatEvent(
        room,
        { type: "RoundStarted", round: room.round },
        combatListeners
      );
      Object.assign(room, afterRoundStarted);

      // Paso de orquestación imperativo (fuera del Event Bus puro): resuelve salvaciones
      // pasivas ambientales contra hazards de área persistentes activos en la sala.
      resolveEnvironmentalHazards(room, diceRoller);
    }
    const active = currentCombatant(room);
    if (active && lifeStatus(active) !== "dead" && lifeStatus(active) !== "stable") {
      break;
    }
  }

  const incoming = currentCombatant(room);

  if (incoming) {
    // D-1B-I1: el contexto diagonal pertenece al turno y se reinicia al comenzar uno nuevo.
    room.currentTurn.normalDiagonalStepsThisTurn = 0;

    // 4. [Legacy] Buffs de inicio de turno
    expireStartOfTurnBuffs(room, incoming);

    // 5. [EventBus] Despachar TurnStarted (y TickLayer evalúa)
    const afterTurnStarted = emitCombatEvent(
      room,
      { type: "TurnStarted", combatantId: incoming.id, round: room.round },
      combatListeners
    );
    Object.assign(room, afterTurnStarted);
  }
}

export function ensureActiveTurn(room: CombatRoom, combatantId: string): void {
  if (room.currentTurn.combatantId && room.currentTurn.combatantId !== combatantId) throw new Error("Solo puede actuar el combatiente del turno actual.");
}

export function emptyTurn(combatantId: string | null): TurnState {
  return { combatantId, normalDiagonalStepsThisTurn: 0, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false };
}
