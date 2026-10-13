import type { WebSocket } from "ws";
import {
  DemoCatalog,
   cryptoId,
  gameCatalog,
  type ClientCommand,
  type CombatRoom,
  type Combatant,
  type DemoScriptDefinition,
  type DemoStepCheckpoint,
  type DemoStepCommandSpec,
  type DemoStepDefinition,
  type DemoSpeedMultiplier,
  type Participant
} from "@dnd-tactical/shared";
import { dispatchInternalDemoCommand } from "../commands/dispatcher.js";
import type { ManeuverDiceSource } from "../commands/specialManeuverCommands.js";
import { rooms, send } from "../room/roomStore.js";
import {
  clearDemoSessionTimer,
  createDemoRoomWithBoard,
  generateUniqueDemoRoomCode,
  registerDemoSession,
  replaceDemoSessionRoom,
  toDemoSessionState,
  type DemoSessionRecord
} from "./sessionStore.js";

export function emitDemoSessionState(record: DemoSessionRecord): void {
  record.sequence += 1;
  send(record.socket, {
    type: "demo-session-state",
    state: toDemoSessionState(record)
  });
}

export function findDemoCombatant(room: CombatRoom, refId: string): Combatant {
  const combatant = room.combatants.find(
    (candidate) => candidate.id === refId || candidate.sourceProfileId === refId
  );
  if (!combatant) {
    throw new Error(`Combatiente de demo no encontrado para referencia '${refId}'.`);
  }
  return combatant;
}

export function resolveCombatantId(room: CombatRoom, refId: string): string {
  return findDemoCombatant(room, refId).id;
}

export function buildClientCommandForStep(
  room: CombatRoom,
  actorId: string,
  spec: DemoStepCommandSpec
): ClientCommand {
  const roomCode = room.code;
  switch (spec.kind) {
    case "sort-initiative":
      return { type: "sort-initiative", roomCode, actorId };
    case "end-turn":
      return { type: "end-turn", roomCode, actorId };
    case "move-combatant":
      return {
        type: "move-combatant",
        roomCode,
        actorId,
        combatantId: resolveCombatantId(room, spec.combatantId),
        to: { ...spec.to },
        ...(spec.path ? { path: spec.path.map((pos) => ({ ...pos })) } : {}),
        ...(spec.isAcrobatic !== undefined ? { isAcrobatic: spec.isAcrobatic } : {})
      };
    case "declare-attack-mode":
      return {
        type: "declare-attack-mode",
        roomCode,
        actorId,
        combatantId: resolveCombatantId(room, spec.combatantId),
        mode: spec.mode,
        defensive: spec.defensive
      };
    case "resolve-attack":
      return {
        type: "resolve-attack",
        roomCode,
        actorId,
        attackerId: resolveCombatantId(room, spec.attackerId),
        targetId: resolveCombatantId(room, spec.targetId),
        d20Roll: spec.d20Roll,
        damage: spec.damage
      };
    case "resolve-attack-confirmation":
      return {
        type: "resolve-attack-confirmation",
        roomCode,
        actorId,
        d20Roll: spec.d20Roll,
        damage: spec.damage
      };
    case "resolve-opportunity-attack": {
      const pending = room.pendingOpportunityAttacks[0];
      if (!pending) {
        throw new Error("No existe Ataque de Oportunidad pendiente para resolver en el paso de demo.");
      }
      return {
        type: "resolve-opportunity-attack",
        roomCode,
        actorId,
        opportunityId: pending.id,
        d20Roll: spec.d20Roll,
        damage: spec.damage
      };
    }
    case "use-tactical-action":
      if (spec.action === "stand-up") {
        return {
          type: "use-tactical-action",
          roomCode,
          actorId,
          combatantId: resolveCombatantId(room, spec.combatantId),
          action: "stand-up"
        };
      }
      return {
        type: "use-tactical-action",
        roomCode,
        actorId,
        combatantId: resolveCombatantId(room, spec.combatantId),
        action: "five-foot-step",
        to: { ...spec.to }
      };
    case "resolve-special-maneuver":
      return {
        type: "resolve-special-maneuver",
        roomCode,
        actorId,
        maneuver: {
          type: "trip",
          attackerId: resolveCombatantId(room, spec.maneuver.attackerId),
          targetId: resolveCombatantId(room, spec.maneuver.targetId),
          d20TouchRoll: spec.maneuver.d20TouchRoll,
          d20OpposedRoll: spec.maneuver.d20OpposedRoll
        }
      };
    case "cast-spell":
      return {
        type: "cast-spell",
        roomCode,
        actorId,
        casterId: resolveCombatantId(room, spec.casterId),
        targetId: resolveCombatantId(room, spec.targetId),
        slotId: spec.slotId,
        d20Roll: spec.d20Roll,
        amount: spec.amount
      };
  }
}

export function createStepRngContext(step: DemoStepDefinition): {
  diceRoller: (sides: number) => number;
  maneuverDiceSource: ManeuverDiceSource;
  assertAllPreparedRollsConsumed: () => void;
} {
  const diceQueue = [...(step.diceRolls ?? [])];
  const maneuverRolls = { ...(step.maneuverRolls ?? {}) } as Record<string, number | undefined>;
  const consumedManeuverKeys = new Set<string>();

  const diceRoller = (sides: number): number => {
    if (diceQueue.length === 0) {
      throw new Error(`Tirada de dado no preparada (d${sides}) en el paso '${step.id}'.`);
    }
    const roll = diceQueue.shift()!;
    if (!Number.isInteger(roll) || roll < 1 || roll > sides) {
      throw new Error(`Tirada de dado fuera de rango (${roll} para d${sides}) en el paso '${step.id}'.`);
    }
    return roll;
  };

  const maneuverDiceSource: ManeuverDiceSource = {
    d20(purpose) {
      const value = maneuverRolls[purpose];
      if (value === undefined) {
        throw new Error(`Tirada de maniobra no preparada para '${purpose}' en el paso '${step.id}'.`);
      }
      consumedManeuverKeys.add(purpose);
      return value;
    },
    d100() {
      const value = maneuverRolls.d100;
      if (value === undefined) {
        throw new Error(`Tirada d100 de maniobra no preparada en el paso '${step.id}'.`);
      }
      consumedManeuverKeys.add("d100");
      return value;
    },
    rollDie(sides: number) {
      return diceRoller(sides);
    }
  };

  const assertAllPreparedRollsConsumed = (): void => {
    if (diceQueue.length > 0) {
      throw new Error(`Quedaron ${diceQueue.length} tiradas de dado sin consumir en el paso '${step.id}'.`);
    }
    for (const key of Object.keys(maneuverRolls)) {
      if (maneuverRolls[key] !== undefined && !consumedManeuverKeys.has(key)) {
        throw new Error(`La tirada de maniobra '${key}' no fue consumida en el paso '${step.id}'.`);
      }
    }
  };

  return { diceRoller, maneuverDiceSource, assertAllPreparedRollsConsumed };
}

export function evaluateStepCheckpoint(
  room: CombatRoom,
  expect: DemoStepCheckpoint,
  stepId: string
): void {
  if (expect.phase !== undefined && room.phase !== expect.phase) {
    throw new Error(`Checkpoint fallido en '${stepId}': se esperaba phase='${expect.phase}', actual='${room.phase}'.`);
  }
  if (expect.round !== undefined && room.round !== expect.round) {
    throw new Error(`Checkpoint fallido en '${stepId}': se esperaba round=${expect.round}, actual=${room.round}.`);
  }
  if (expect.activeCombatantId !== undefined) {
    const expectedId = resolveCombatantId(room, expect.activeCombatantId);
    const actualId = room.turnOrder[room.activeTurnIndex] ?? null;
    if (actualId !== expectedId) {
      throw new Error(`Checkpoint fallido en '${stepId}': combatiente activo esperado '${expect.activeCombatantId}', actual '${actualId}'.`);
    }
  }
  if (expect.combatantPosition !== undefined) {
    const combatant = findDemoCombatant(room, expect.combatantPosition.combatantId);
    const expectedPos = expect.combatantPosition.position;
    if (combatant.position.x !== expectedPos.x || combatant.position.y !== expectedPos.y) {
      throw new Error(
        `Checkpoint fallido en '${stepId}': posicion de ${combatant.name} esperada (${expectedPos.x},${expectedPos.y}), actual (${combatant.position.x},${combatant.position.y}).`
      );
    }
  }
  if (expect.targetHp !== undefined) {
    const combatant = findDemoCombatant(room, expect.targetHp.combatantId);
    if (combatant.hpCurrent !== expect.targetHp.hpCurrent) {
      throw new Error(
        `Checkpoint fallido en '${stepId}': HP de ${combatant.name} esperado ${expect.targetHp.hpCurrent}, actual ${combatant.hpCurrent}.`
      );
    }
  }
  if (expect.hasEffect !== undefined) {
    const targetId = resolveCombatantId(room, expect.hasEffect.combatantId);
    const present = room.effectInstances.some(
      (instance) => instance.effectId === expect.hasEffect!.effectId && (instance.targets?.includes(targetId) ?? false)
    );
    if (present !== expect.hasEffect.present) {
      throw new Error(
        `Checkpoint fallido en '${stepId}': efecto '${expect.hasEffect.effectId}' en '${expect.hasEffect.combatantId}' esperado=${expect.hasEffect.present}, actual=${present}.`
      );
    }
  }
  if (expect.spellSlotExpended !== undefined) {
    const combatant = findDemoCombatant(room, expect.spellSlotExpended.combatantId);
    const slot = combatant.preparedSpells?.find((candidate) => candidate.slotId === expect.spellSlotExpended!.slotId);
    if (!slot || slot.isExpended !== expect.spellSlotExpended.isExpended) {
      throw new Error(
        `Checkpoint fallido en '${stepId}': slot '${expect.spellSlotExpended.slotId}' esperado isExpended=${expect.spellSlotExpended.isExpended}, actual=${slot?.isExpended}.`
      );
    }
  }
  if (expect.ammoRemaining !== undefined) {
    const combatant = findDemoCombatant(room, expect.ammoRemaining.combatantId);
    const item = combatant.inventory.find((candidate) => candidate.itemId === expect.ammoRemaining!.itemId);
    if (!item || item.quantity !== expect.ammoRemaining.quantity) {
      throw new Error(
        `Checkpoint fallido en '${stepId}': municion '${expect.ammoRemaining.itemId}' esperada=${expect.ammoRemaining.quantity}, actual=${item?.quantity}.`
      );
    }
  }
  if (expect.movementUsedFeet !== undefined && room.currentTurn.movementUsedFeet !== expect.movementUsedFeet) {
    throw new Error(
      `Checkpoint fallido en '${stepId}': movementUsedFeet esperado=${expect.movementUsedFeet}, actual=${room.currentTurn.movementUsedFeet}.`
    );
  }
  if (
    expect.pendingOpportunityAttacksCount !== undefined &&
    room.pendingOpportunityAttacks.length !== expect.pendingOpportunityAttacksCount
  ) {
    throw new Error(
      `Checkpoint fallido en '${stepId}': pendingOpportunityAttacks esperado=${expect.pendingOpportunityAttacksCount}, actual=${room.pendingOpportunityAttacks.length}.`
    );
  }
  if (expect.opportunityAttacksThisRound !== undefined) {
    const combatant = findDemoCombatant(room, expect.opportunityAttacksThisRound.combatantId);
    const actual = combatant.stats.opportunityAttacksThisRound ?? 0;
    if (actual !== expect.opportunityAttacksThisRound.count) {
      throw new Error(
        `Checkpoint fallido en '${stepId}': opportunityAttacksThisRound de ${combatant.name} esperado=${expect.opportunityAttacksThisRound.count}, actual=${actual}.`
      );
    }
  }
}

export function prepareSceneInRoom(
  record: DemoSessionRecord,
  sceneIndex: number,
  options?: { newRoomCode?: boolean }
): CombatRoom {
  const scene = record.script.scenes[sceneIndex];
  if (!scene) {
    throw new Error(`Escena de demo fuera de rango: ${sceneIndex}.`);
  }

  record.status = "preparing";
  const roomCode = options?.newRoomCode ? generateUniqueDemoRoomCode() : record.roomCode;
  const participant: Participant = {
    ...record.participant,
    roomCode
  };
  const room = createDemoRoomWithBoard(roomCode, scene.board);
  replaceDemoSessionRoom(record, room, participant);

  if (options?.newRoomCode) {
    send(record.socket, {
      type: "hello",
      participant,
      room,
      catalog: gameCatalog
    });
  }

  for (const profile of scene.combatants) {
    dispatchInternalDemoCommand(
      record.socket,
      {
        type: "add-profile-combatant",
        roomCode: room.code,
        actorId: participant.id,
        profile
      },
      { source: "demo-runner" }
    );
  }

  for (const init of scene.initiatives) {
    const combatantId = resolveCombatantId(room, init.combatantId);
    dispatchInternalDemoCommand(
      record.socket,
      {
        type: "set-initiative",
        roomCode: room.code,
        actorId: participant.id,
        combatantId,
        initiative: init.value
      },
      { source: "demo-runner" }
    );
  }

  record.currentSceneIndex = sceneIndex;
  record.currentStepIndex = 0;
  record.activeActorName = "Sistema";
  record.actionSummary = `Escena preparada: ${scene.title}`;
  record.ruleExplanation = scene.description;
  record.errorMessage = null;

  return room;
}

export function startNewDemoSession(
  socket: WebSocket,
  demoId: string,
  observerName?: string,
  options?: { autoPlay?: boolean; initialSpeed?: DemoSpeedMultiplier; customScript?: DemoScriptDefinition }
): DemoSessionRecord {
  const script = options?.customScript ?? DemoCatalog.get(demoId);
  if (!script) {
    throw new Error(`Guion de demostracion desconocido: ${demoId}.`);
  }

  const sessionId = cryptoId("demo");
  const roomCode = generateUniqueDemoRoomCode();
  const participant: Participant = {
    id: cryptoId("gm"),
    name: observerName?.trim() || "Observador Demo",
    role: "gm",
    roomCode
  };

  const firstScene = script.scenes[0];
  if (!firstScene) {
    throw new Error(`El guion '${demoId}' no contiene escenas.`);
  }

  const initialRoom = createDemoRoomWithBoard(roomCode, firstScene.board);
  const record: DemoSessionRecord = {
    sessionId,
    sequence: 0,
    demoId: script.id,
    script,
    socket,
    roomCode,
    participant,
    status: "starting",
    currentSceneIndex: 0,
    currentStepIndex: 0,
    activeActorName: "Sistema",
    actionSummary: `Iniciando ${script.title}`,
    ruleExplanation: firstScene.description,
    speedMultiplier: options?.initialSpeed ?? 1,
    errorMessage: null,
    commandInFlight: false,
    timerHandle: null
  };

  registerDemoSession(record, initialRoom);

  send(socket, {
    type: "hello",
    participant,
    room: initialRoom,
    catalog: gameCatalog
  });

  prepareSceneInRoom(record, 0, { newRoomCode: false });

  const autoPlay = options?.autoPlay ?? true;
  record.status = autoPlay ? "playing" : "paused";
  emitDemoSessionState(record);

  if (autoPlay) {
    scheduleNextAutoStep(record, 250);
  }

  return record;
}

export function executeNextDemoStep(record: DemoSessionRecord): boolean {
  if (record.commandInFlight) {
    return false;
  }
  if (record.status === "completed" || record.status === "failed") {
    return false;
  }

  let currentScene = record.script.scenes[record.currentSceneIndex];
  if (!currentScene) {
    record.status = "completed";
    clearDemoSessionTimer(record);
    emitDemoSessionState(record);
    return false;
  }

  if (record.currentStepIndex >= currentScene.steps.length) {
    const nextSceneIndex = record.currentSceneIndex + 1;
    if (nextSceneIndex >= record.script.scenes.length) {
      record.status = "completed";
      clearDemoSessionTimer(record);
      emitDemoSessionState(record);
      return false;
    }
    const previousStatus = record.status;
    try {
      prepareSceneInRoom(record, nextSceneIndex, { newRoomCode: false });
      record.status = previousStatus === "playing" ? "playing" : "paused";
    } catch (error) {
      record.status = "failed";
      record.errorMessage = error instanceof Error ? error.message : "Error preparando la siguiente escena.";
      clearDemoSessionTimer(record);
      emitDemoSessionState(record);
      send(record.socket, { type: "error", message: record.errorMessage });
      return false;
    }
    currentScene = record.script.scenes[record.currentSceneIndex]!;
  }

  const step = currentScene.steps[record.currentStepIndex];
  if (!step) {
    record.status = "completed";
    clearDemoSessionTimer(record);
    emitDemoSessionState(record);
    return false;
  }

  record.commandInFlight = true;
  try {
    const room = rooms.get(record.roomCode);
    if (!room) {
      throw new Error("Sala de demostracion no encontrada.");
    }

    const rng = createStepRngContext(step);
    const command = buildClientCommandForStep(room, record.participant.id, step.command);
    dispatchInternalDemoCommand(record.socket, command, {
      source: "demo-runner",
      diceRoller: rng.diceRoller,
      maneuverDiceSource: rng.maneuverDiceSource
    });

    rng.assertAllPreparedRollsConsumed();
    evaluateStepCheckpoint(room, step.expect, step.id);

    record.activeActorName = step.actorName;
    record.actionSummary = step.actionSummary;
    record.ruleExplanation = step.ruleExplanation;
    record.currentStepIndex += 1;

    const isLastScene = record.currentSceneIndex === record.script.scenes.length - 1;
    const isEndOfScene = record.currentStepIndex >= currentScene.steps.length;
    if (isLastScene && isEndOfScene) {
      record.status = "completed";
      clearDemoSessionTimer(record);
    }

    emitDemoSessionState(record);
    return true;
  } catch (error) {
    record.status = "failed";
    record.errorMessage = error instanceof Error ? error.message : "Error inesperado en la demostracion.";
    clearDemoSessionTimer(record);
    emitDemoSessionState(record);
    send(record.socket, { type: "error", message: record.errorMessage });
    return false;
  } finally {
    record.commandInFlight = false;
  }
}

export function scheduleNextAutoStep(record: DemoSessionRecord, overrideBaseMs?: number): void {
  clearDemoSessionTimer(record);
  if (record.status !== "playing") return;

  const scene = record.script.scenes[record.currentSceneIndex];
  const prevStep = scene && record.currentStepIndex > 0 ? scene.steps[record.currentStepIndex - 1] : undefined;
  const baseMs = overrideBaseMs ?? prevStep?.pauseAfterMs ?? 900;
  const delayMs = Math.max(20, Math.round(baseMs / record.speedMultiplier));

  record.timerHandle = setTimeout(() => {
    record.timerHandle = null;
    if (record.status !== "playing") return;
    const ok = executeNextDemoStep(record);
    if (ok && record.status === "playing") {
      scheduleNextAutoStep(record);
    }
  }, delayMs);
}
