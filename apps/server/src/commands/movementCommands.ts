import { applyDisabledExertion } from "../combat/lifeStatusEffects.js";
import { canCharge } from "../combat/chargeResolver.js";
import { enqueueMovementOpportunities, findStationaryOpportunityAttacks } from "../combat/opportunityAttackResolver.js";
import { rollDice } from "../combat/diceRoller.js";
import {
  footprintCellKey, getCombatantOccupiedCells, getEffectiveAbilityModifier,
  lifeStatus, Rules, canUseMoveAction, canRun, runSpeedBudgetFeet, createMovementStateFingerprint, findTriggeredOpportunityAttacksForPath, makeLog,
  createCombatRulesSnapshot, resolveMovementPipeline, commitMovementResolution,
  type MovementResolutionResult, type ClientCommand, type Combatant, type CombatRoom, type CombatLogEntry, type OpportunityAttack
} from "@dnd-tactical/shared";
import { requireCombatantControl } from "../auth/control.js";
import { ensureActiveTurn } from "../combat/turnManager.js";
import { checkCombatOutcome, logStatusChange, findCombatant, formatCell, isCombatantInsideBoard, isCellOccupied, syncEncounterPhase } from "../room/roomState.js";
import { broadcast } from "../room/roomStore.js";
import { commitSpatialTransition } from "../combat/spatialTransition.js";

export function handleMoveCombatant(room: CombatRoom, command: Extract<ClientCommand, { type: "move-combatant" }>): void {
  const combatant = findCombatant(room, command.combatantId);
  requireCombatantControl(command.actorId, combatant);
  if (room.phase === "preparation") {
    const naturalCandidate = { ...room, effectInstances: room.effectInstances.filter(instance =>
      !(instance.effectId === "srd_squeezing" && instance.targets?.includes(combatant.id))) };
    if (!isCombatantInsideBoard(naturalCandidate, combatant, command.to)) throw new Error("La huella elegida esta fuera del tablero.");
    if (isCellOccupied(naturalCandidate, command.to, combatant.id)) throw new Error("Esa casilla esta ocupada.");
    commitSpatialTransition(room, combatant, command.to, { spatialMode: "natural" });
    room.log.unshift(makeLog("movement", combatant.name + " queda colocado en " + formatCell(command.to) + "."));
    broadcast(room);
    return;
  }
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  ensureActiveTurn(room, combatant.id);
  const snapshot = createCombatRulesSnapshot(room);
  const availability = Rules.evaluateActionAvailability(snapshot, combatant);
  if (!availability.ok) throw new Error(availability.error);
  const moveAction = canUseMoveAction(snapshot, combatant);
  if (!moveAction.ok) throw new Error(moveAction.error);
  if (snapshot.currentTurn.usedFiveFootStep) throw new Error("Ya uso paso de 5 pies este turno.");
  if (room.currentTurn.attackMode === "full" || (room.currentTurn.attackMode === "standard" && !room.currentTurn.usedStandardAction)) {
    throw new Error("No puede realizar un movimiento normal mientras tenga preparado un modo de ataque (Estandar o Completo). Cancele la preparacion primero.");
  }

  const resolutionActor = snapshot.combatants.find(c => c.id === combatant.id)! as Combatant;
  const candidatePath = command.path && command.path.length > 0 ? command.path : [command.to];
  const isAcrobatic = !!command.isAcrobatic;
  const initialContext = { normalDiagonalStepsThisTurn: snapshot.currentTurn.normalDiagonalStepsThisTurn };
  const availableBudgetFeet = Math.max(0, Rules.totalSpeedFeet(snapshot, combatant) - snapshot.currentTurn.movementUsedFeet);
  const preconditions = {
    expectedTurnCombatantId: snapshot.currentTurn.combatantId,
    expectedRound: room.round,
    expectedOrigin: { ...combatant.position },
    expectedMovementUsedFeet: snapshot.currentTurn.movementUsedFeet,
    expectedDiagonalContext: initialContext
  };
  let resolution = resolveMovementPipeline({ context: snapshot, combatant: resolutionActor, path: candidatePath,
    initialContext, availableBudgetFeet, isAcrobatic });
  if (resolution.kind !== "ready") throw new Error(resolution.kind === "illegal-route" ? resolution.reason
    : `${combatant.name} intenta mover ${resolution.requiredCostFeet} pies, pero solo tiene ${resolution.availableBudgetFeet} pies disponibles.`);

  const wasSqueezing = room.effectInstances.some(instance =>
    instance.effectId === "srd_squeezing" && instance.targets?.includes(combatant.id));
  const pending: { logs: CombatLogEntry[]; opportunities: OpportunityAttack[] } = { logs: [], opportunities: [] };
  let interruptedByEnemyId: string | null = null;
  let confirmedPath = candidatePath;
  for (const step of resolution.steps) {
    const keys = new Set(step.occupiedCells.map(footprintCellKey));
    const enemy = snapshot.combatants.find(c => c.id !== combatant.id && c.type !== combatant.type &&
      !["dead", "dying", "stable"].includes(lifeStatus(c as Combatant)) &&
      getCombatantOccupiedCells(c, snapshot).some(cell => keys.has(footprintCellKey(cell))));
    if (enemy && isAcrobatic) {
      const dexMod = getEffectiveAbilityModifier(snapshot, combatant, "dexterity");
      const roll = rollDice(20);
      const result = roll + dexMod;
      pending.logs.unshift(makeLog("skill", `${combatant.name} tira Acrobacias (CD 25) para atravesar a ${enemy.name}: 1d20 (${roll}) + DES (${dexMod}) = ${result}`));
      if (result < 25) {
        interruptedByEnemyId = enemy.id;
        confirmedPath = candidatePath.slice(0, step.stepIndex);
        pending.logs.unshift(makeLog("movement", `${combatant.name} falla la prueba de Acrobacias y su movimiento es interrumpido.`));
        break;
      }
    }
  }
  if (interruptedByEnemyId) {
    if (confirmedPath.length === 0) throw new Error("Movimiento interrumpido en el primer paso.");
    resolution = resolveMovementPipeline({ context: snapshot, combatant: resolutionActor, path: confirmedPath,
      initialContext, availableBudgetFeet, isAcrobatic: true });
    if (resolution.kind !== "ready") throw new Error(resolution.kind === "illegal-route" ? resolution.reason
      : `${combatant.name} intenta mover ${resolution.requiredCostFeet} pies, pero solo tiene ${resolution.availableBudgetFeet} pies disponibles.`);
  }

  const opportunities = findTriggeredOpportunityAttacksForPath(snapshot, combatant, confirmedPath,
    resolution.totalCostFeet, c => Rules.canMakeOpportunityAttack(snapshot, c, combatant.id), isAcrobatic,
    undefined, resolution.steps);
  const evadedReactors: string[] = [];
  for (const opp of opportunities) {
    if (pending.opportunities.length && opp.movementStepIndex !== pending.opportunities[0].movementStepIndex) break;
    if (opp.requiredCd === 15) {
      const dexMod = getEffectiveAbilityModifier(snapshot, combatant, "dexterity");
      const roll = rollDice(20);
      const result = roll + dexMod;
      const enemy = snapshot.combatants.find(c => c.id === opp.attackerId);
      pending.logs.unshift(makeLog("skill", `${combatant.name} tira Acrobacias (CD 15) para esquivar AdO de ${enemy?.name}: 1d20 (${roll}) + DES (${dexMod}) = ${result}`));
      if (result >= 15) {
        evadedReactors.push(opp.attackerId);
        pending.logs.unshift(makeLog("movement", `${combatant.name} esquiva exitosamente el AdO.`));
        continue;
      }
      pending.logs.unshift(makeLog("opportunity", `${combatant.name} falla la prueba de Acrobacias. ${enemy?.name} tiene un AdO.`));
    }
    pending.opportunities.push(opp);
  }
  if (interruptedByEnemyId && !pending.opportunities.some(item => item.attackerId === interruptedByEnemyId)) {
    const stoppedActor = { ...resolutionActor, position: { ...resolution.finalPosition } };
    const opportunity = findStationaryOpportunityAttacks(snapshot, stoppedActor, "fallo al atravesar a un enemigo")
      .find(item => item.attackerId === interruptedByEnemyId);
    const reactor = snapshot.combatants.find(item => item.id === interruptedByEnemyId);
    if (opportunity && !reactor?.stats.movementOpportunityTargetsThisRound?.includes(combatant.id)) {
      pending.opportunities.push(opportunity);
    }
  }

  if (suspendMovement(room, snapshot, combatant, confirmedPath, availableBudgetFeet, isAcrobatic, pending.opportunities, preconditions, { kind: "move", evadedReactors }, resolution)) {
    room.currentTurn.usedMoveAction = true;
    room.log.unshift(...pending.logs);
    broadcast(room);
    return;
  }

  const result = commitMovementResolution({ room, combatant, resolution, preconditions });
  if (result.kind === "rejected") throw new Error(result.reason);
  room.currentTurn.usedMoveAction = true;
  room.log.unshift(...pending.logs);
  room.log.unshift(makeLog("movement", `${combatant.name} avanza ${resolution.totalCostFeet} pies por ${confirmedPath.length} casilla(s). Movimiento usado: ${result.movementUsedFeetAfter} pies.`));
  const isSqueezingNow = result.finalSpatialMode === "squeezing";
  if (!wasSqueezing && isSqueezingNow) room.log.unshift(makeLog("movement", `${combatant.name} se ha metido en un espacio estrecho y esta Apretujandose.`));
  if (wasSqueezing && !isSqueezingNow) room.log.unshift(makeLog("movement", `${combatant.name} dejo el espacio estrecho.`));
  enqueueMovementOpportunities(room, pending.opportunities);
  for (const opportunity of pending.opportunities) {
    room.log.unshift(makeLog("opportunity", opportunity.reason + " Resolver ataque de oportunidad."));
  }
  syncEncounterPhase(room);
  broadcast(room);
}

export function suspendMovement(room: CombatRoom, snapshot: ReturnType<typeof createCombatRulesSnapshot>, combatant: Combatant, path: NonNullable<CombatRoom["pendingMovement"]>["path"], availableBudgetFeet: number, isAcrobatic: boolean, opportunities: OpportunityAttack[], preconditions: Parameters<typeof commitMovementResolution>[0]["preconditions"], intent: Pick<NonNullable<CombatRoom["pendingMovement"]>, "kind" | "charge" | "exemptDepartureCells" | "startedDisabled" | "evadedReactors"> = { kind: "move" }, resolution?: Extract<MovementResolutionResult, { kind: "ready" }>): boolean {
  const resolutionActor = snapshot.combatants.find(actor => actor.id === combatant.id)! as Combatant;
  const initialContext = { normalDiagonalStepsThisTurn: snapshot.currentTurn.normalDiagonalStepsThisTurn };
  const firstStep = opportunities[0]?.movementStepIndex;
  if (firstStep !== undefined) {
    const prefix = path.slice(0, firstStep);
    if (prefix.length) {
      const result = resolution ? movementPrefix(resolution, firstStep) : resolveMovementPipeline({ context: snapshot, combatant: resolutionActor, path: prefix,
        initialContext, availableBudgetFeet, isAcrobatic });
      if (result.kind !== "ready") throw new Error("El tramo previo al AdO no es legal.");
      const commit = commitMovementResolution({ room, combatant, resolution: result, preconditions });
      if (commit.kind === "rejected") throw new Error(commit.reason);
    } else if (room.combatants.find(actor => actor.id === combatant.id) !== combatant ||
        room.currentTurn.combatantId !== preconditions.expectedTurnCombatantId ||
        room.round !== preconditions.expectedRound ||
        (resolution && createMovementStateFingerprint(room, combatant) !== resolution.rulesStateFingerprint) ||
        room.currentTurn.movementUsedFeet !== preconditions.expectedMovementUsedFeet ||
        room.currentTurn.normalDiagonalStepsThisTurn !== initialContext.normalDiagonalStepsThisTurn ||
        footprintCellKey(combatant.position) !== footprintCellKey(preconditions.expectedOrigin)) {
      throw new Error("El movimiento cambio antes de la reaccion.");
    }
    room.pendingMovement = { ...intent, actorId: combatant.id, path: path.slice(firstStep),
      remainingBudget: availableBudgetFeet - (room.currentTurn.movementUsedFeet - preconditions.expectedMovementUsedFeet),
      isAcrobatic, origin: { ...combatant.position } };
    enqueueMovementOpportunities(room, opportunities.filter(item => item.movementStepIndex === firstStep));
    return true;
  }

  return false;
}

function movementPrefix(resolution: Extract<MovementResolutionResult, { kind: "ready" }>, count: number): Extract<MovementResolutionResult, { kind: "ready" }> {
  const steps = resolution.steps.slice(0, count);
  const last = steps[steps.length - 1];
  return { ...resolution, steps, finalPosition: last.position, totalCostFeet: last.cumulativeCostFeet,
    totalBaseRouteCostFeet: last.cumulativeBaseRouteCostFeet, projectedContext: last.resultingContext };
}

export function resumeMovement(room: CombatRoom): Extract<ClientCommand, { action: "charge" }> | undefined {
  const pending = room.pendingMovement;
  if (!pending) return;
  delete room.pendingMovement;
  const actor = room.combatants.find(item => item.id === pending.actorId);
  if (!actor || room.phase !== "active" || room.currentTurn.combatantId !== actor.id ||
      !["active", "disabled"].includes(lifeStatus(actor)) ||
      footprintCellKey(actor.position) !== footprintCellKey(pending.origin)) return;
  const snapshot = createCombatRulesSnapshot(room);
  const initialContext = { normalDiagonalStepsThisTurn: room.currentTurn.normalDiagonalStepsThisTurn };
  const speed = Rules.totalSpeedFeet(snapshot, actor);
  const budget = pending.kind === "run" ? runSpeedBudgetFeet(snapshot, actor) :
    pending.kind === "charge" || (pending.kind === "withdraw" && !pending.startedDisabled) ? speed * 2 : speed;
  const availableBudgetFeet = Math.min(pending.remainingBudget, Math.max(0, budget - room.currentTurn.movementUsedFeet));
  const movementCheck = { ...snapshot, currentTurn: { ...snapshot.currentTurn, usedMoveAction: false,
    usedFullAttack: false, usedStandardAction: pending.kind === "move" ? snapshot.currentTurn.usedStandardAction : false,
    movementUsedFeet: pending.kind === "move" ? snapshot.currentTurn.movementUsedFeet : 0 } };
  const check = pending.kind === "run" ? canRun(movementCheck, actor) : pending.kind === "charge" ? canCharge(movementCheck, actor) : canUseMoveAction(movementCheck, actor);
  if (!check.ok || !Rules.evaluateActionAvailability(snapshot, actor).ok) return;

  const resolution = resolveMovementPipeline({ context: snapshot, combatant: actor, path: pending.path,
    initialContext, availableBudgetFeet, isAcrobatic: pending.isAcrobatic, isCharge: pending.kind === "charge" });
  if (resolution.kind !== "ready" || (pending.kind !== "move" && resolution.steps.some(step => {
    if (pending.kind === "run" && step.isDifficultTerrain) return true;
    if (pending.kind === "charge") return step.isDifficultTerrain || step.spatialMode !== "natural";
    const cells = new Set(step.occupiedCells.map(footprintCellKey));
    return snapshot.combatants.some(other => other.id !== actor.id &&
      lifeStatus(other) !== "dead" && (other.type !== actor.type || step.stepIndex === resolution.steps.length - 1) &&
      getCombatantOccupiedCells(other, snapshot).some(cell => cells.has(footprintCellKey(cell))));
  }))) {
    room.log.unshift(makeLog("movement", actor.name + " no puede continuar por la ruta prevista."));
    broadcast(room);
    return;
  }
  const candidates = findTriggeredOpportunityAttacksForPath(snapshot, actor, pending.path,
    resolution.totalCostFeet, reactor => Rules.canMakeOpportunityAttack(snapshot, reactor), pending.isAcrobatic,
    new Set(pending.exemptDepartureCells), resolution.steps);
  const opportunities: OpportunityAttack[] = [];
  const evaded = new Set(pending.evadedReactors);
  for (const candidate of candidates) {
    if (evaded.has(candidate.attackerId)) continue;
    if (opportunities.length && candidate.movementStepIndex !== opportunities[0].movementStepIndex) break;
    if (candidate.requiredCd !== 15 || rollDice(20) + getEffectiveAbilityModifier(snapshot, actor, "dexterity") < 15) opportunities.push(candidate);
    else evaded.add(candidate.attackerId);
  }
  const first = opportunities[0]?.movementStepIndex;
  if (first !== 0) {
    const prefix = first === undefined ? resolution : movementPrefix(resolution, first);
    const committed = commitMovementResolution({ room, combatant: actor, resolution: prefix, preconditions: {
      expectedTurnCombatantId: actor.id, expectedRound: room.round, expectedOrigin: pending.origin,
      expectedMovementUsedFeet: room.currentTurn.movementUsedFeet, expectedDiagonalContext: initialContext
    } });
    if (committed.kind === "rejected") return;
    pending.remainingBudget = availableBudgetFeet - prefix.totalCostFeet;
  }
  if (first !== undefined) {
    room.pendingMovement = { ...pending, evadedReactors: [...evaded], origin: { ...actor.position }, path: pending.path.slice(first) };
    enqueueMovementOpportunities(room, opportunities.filter(item => item.movementStepIndex === first));
  }
  if (first === undefined && pending.kind === "withdraw") {
    const exertion = applyDisabledExertion(actor, { wasDisabledAtActionStart: pending.startedDisabled ?? false, actionKind: pending.startedDisabled ? "standard" : "full-round", actionWasExerting: true });
    if (exertion.applied) {
      room.log.unshift(makeLog("status", actor.name + " pierde 1 HP por esfuerzo al retirarse."));
      logStatusChange(room, actor, exertion.statusBefore, exertion.statusAfter);
      checkCombatOutcome(room);
    }
  }
  if (first === undefined && pending.charge) return pending.charge;
  broadcast(room);
}
