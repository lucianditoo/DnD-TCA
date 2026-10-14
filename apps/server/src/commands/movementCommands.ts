import { rollDice } from "../combat/diceRoller.js";
import {
  cryptoId, footprintCellKey, getCombatantOccupiedCells, getEffectiveAbilityModifier,
  lifeStatus, Rules, canUseMoveAction, findTriggeredOpportunityAttacksForPath, makeLog,
  createCombatRulesSnapshot, resolveMovementPipeline, commitMovementResolution,
  type ClientCommand, type Combatant, type CombatRoom, type CombatLogEntry, type OpportunityAttack
} from "@dnd-tactical/shared";
import { requireCombatantControl } from "../auth/control.js";
import { ensureActiveTurn } from "../combat/turnManager.js";
import { findCombatant, formatCell, isCombatantInsideBoard, isCellOccupied, syncEncounterPhase } from "../room/roomState.js";
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
  for (const opp of opportunities) {
    if (opp.requiredCd === 15) {
      const dexMod = getEffectiveAbilityModifier(snapshot, combatant, "dexterity");
      const roll = rollDice(20);
      const result = roll + dexMod;
      const enemy = snapshot.combatants.find(c => c.id === opp.attackerId);
      pending.logs.unshift(makeLog("skill", `${combatant.name} tira Acrobacias (CD 15) para esquivar AdO de ${enemy?.name}: 1d20 (${roll}) + DES (${dexMod}) = ${result}`));
      if (result >= 15) {
        pending.logs.unshift(makeLog("movement", `${combatant.name} esquiva exitosamente el AdO.`));
        continue;
      }
      pending.logs.unshift(makeLog("opportunity", `${combatant.name} falla la prueba de Acrobacias. ${enemy?.name} tiene un AdO.`));
    }
    pending.opportunities.push(opp);
  }
  if (interruptedByEnemyId) {
    const enemy = snapshot.combatants.find(c => c.id === interruptedByEnemyId)!;
    pending.opportunities.push({
      id: cryptoId("aoo"), attackerId: enemy.id, targetId: combatant.id,
      attackerPosition: { ...enemy.position }, origin: { ...preconditions.expectedOrigin },
      destination: { ...resolution.finalPosition }, movementCostFeet: resolution.totalCostFeet,
      reason: `${combatant.name} fallo al atravesar a ${enemy.name}.`, createdAt: new Date().toISOString()
    });
  }

  const result = commitMovementResolution({ room, combatant, resolution, preconditions });
  if (result.kind === "rejected") throw new Error(result.reason);
  room.currentTurn.usedMoveAction = true;
  room.log.unshift(...pending.logs);
  room.log.unshift(makeLog("movement", `${combatant.name} avanza ${resolution.totalCostFeet} pies por ${confirmedPath.length} casilla(s). Movimiento usado: ${result.movementUsedFeetAfter} pies.`));
  const isSqueezingNow = result.finalSpatialMode === "squeezing";
  if (!wasSqueezing && isSqueezingNow) room.log.unshift(makeLog("movement", `${combatant.name} se ha metido en un espacio estrecho y esta Apretujandose.`));
  if (wasSqueezing && !isSqueezingNow) room.log.unshift(makeLog("movement", `${combatant.name} dejo el espacio estrecho.`));
  room.pendingOpportunityAttacks.push(...pending.opportunities);
  for (const opportunity of pending.opportunities) {
    room.log.unshift(makeLog("opportunity", opportunity.reason + " Resolver ataque de oportunidad."));
  }
  syncEncounterPhase(room);
  broadcast(room);
}
