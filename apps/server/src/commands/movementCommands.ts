import { rollDice } from "../combat/diceRoller.js";
import { cryptoId, getCombatantOccupiedCells, getEffectiveAbilityModifier, calculatePathCostFeet, lifeStatus, Rules, canUseMoveAction, findTriggeredOpportunityAttacksForPath, makeLog, validateMovePath, createCombatRulesSnapshot, type ClientCommand, type Combatant, type CombatRoom } from "@dnd-tactical/shared";
import { requireCombatantControl } from "../auth/control.js";
import { ensureActiveTurn } from "../combat/turnManager.js";
import { findCombatant, formatCell, isCombatantInsideBoard, isCellOccupied, syncEncounterPhase } from "../room/roomState.js";
import { broadcast } from "../room/roomStore.js";
import { commitSpatialTransition } from "../combat/spatialTransition.js";

export function handleMoveCombatant(room: CombatRoom, command: Extract<ClientCommand, { type: "move-combatant" }>): void {
  const combatant = findCombatant(room, command.combatantId);
  requireCombatantControl(command.actorId, combatant);
  if (room.phase === "preparation") {
    if (!isCombatantInsideBoard(room, combatant, command.to)) throw new Error("La huella elegida esta fuera del tablero.");
    if (isCellOccupied(room, command.to, combatant.id)) throw new Error("Esa casilla esta ocupada.");
    commitSpatialTransition(room, combatant, command.to, "natural");
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
  if (room.currentTurn.attackMode === "full" || (room.currentTurn.attackMode === "standard" && !room.currentTurn.usedStandardAction)) {
    throw new Error("No puede realizar un movimiento normal mientras tenga preparado un modo de ataque (Estandar o Completo). Cancele la preparacion primero.");
  }
  const movePath = command.path && command.path.length > 0 ? command.path : [command.to];
  const isAcrobatic = !!command.isAcrobatic;
  const validation = validateMovePath(snapshot, combatant, movePath, Rules.totalSpeedFeet(snapshot, combatant), false, isAcrobatic);
  if (!validation.ok || validation.value === undefined) throw new Error(validation.error);
  let actualPath = [];
  let interrupted = false;
  let interruptedByEnemyId = null;

  for (let stepIndex = 0; stepIndex < validation.value.path.length; stepIndex++) {
    const step = validation.value.path[stepIndex];
    const projectedStep = validation.value.steps[stepIndex];
    const stepKeys = new Set((projectedStep?.occupiedCells ?? getCombatantOccupiedCells({ ...combatant, position: { ...step } }, snapshot)).map((cell) => `${cell.x},${cell.y},${cell.zFeet}`));
    const occupiedByEnemy = snapshot.combatants.find(c =>
      c.id !== combatant.id &&
      c.type !== combatant.type &&
      lifeStatus(c as Combatant) !== "dead" &&
      lifeStatus(c as Combatant) !== "dying" &&
      lifeStatus(c as Combatant) !== "stable" &&
      getCombatantOccupiedCells(c, snapshot).some((cell) => stepKeys.has(`${cell.x},${cell.y},${cell.zFeet}`))
    );
    
    if (occupiedByEnemy && isAcrobatic) {
      const dexMod = getEffectiveAbilityModifier(snapshot, combatant, "dexterity");
      const roll = rollDice(20);
      const result = roll + dexMod;
      room.log.unshift(makeLog("skill", `${combatant.name} tira Acrobacias (CD 25) para atravesar a ${occupiedByEnemy.name}: 1d20 (${roll}) + DES (${dexMod}) = ${result}`));
      if (result < 25) {
        interrupted = true;
        interruptedByEnemyId = occupiedByEnemy.id;
        room.log.unshift(makeLog("movement", `${combatant.name} falla la prueba de Acrobacias y su movimiento es interrumpido.`));
        break;
      }
    }
    actualPath.push(step);
  }

  if (actualPath.length === 0) {
    throw new Error("Movimiento interrumpido en el primer paso.");
  }

  const movementDistance = calculatePathCostFeet(combatant.position, actualPath, snapshot, isAcrobatic);
  const destination = actualPath[actualPath.length - 1];

  const opportunities = findTriggeredOpportunityAttacksForPath(
    snapshot, 
    combatant, 
    actualPath, 
    movementDistance,
    (c) => Rules.canMakeOpportunityAttack(snapshot, c, combatant.id),
    isAcrobatic
  );

  const finalOpportunities = [];
  for (const opp of opportunities) {
    if (opp.requiredCd === 15) {
      const dexMod = getEffectiveAbilityModifier(snapshot, combatant, "dexterity");
      const roll = rollDice(20);
      const result = roll + dexMod;
      const enemy = room.combatants.find(c => c.id === opp.attackerId);
      room.log.unshift(makeLog("skill", `${combatant.name} tira Acrobacias (CD 15) para esquivar AdO de ${enemy?.name}: 1d20 (${roll}) + DES (${dexMod}) = ${result}`));
      if (result >= 15) {
        room.log.unshift(makeLog("movement", `${combatant.name} esquiva exitosamente el AdO.`));
        continue;
      } else {
        room.log.unshift(makeLog("opportunity", `${combatant.name} falla la prueba de Acrobacias. ${enemy?.name} tiene un AdO.`));
        finalOpportunities.push(opp);
      }
    } else {
      finalOpportunities.push(opp);
    }
  }

  if (interrupted && interruptedByEnemyId) {
    const enemy = room.combatants.find(c => c.id === interruptedByEnemyId);
    if (enemy) {
      finalOpportunities.push({
        id: cryptoId("aoo"),
        attackerId: interruptedByEnemyId,
        targetId: combatant.id,
        attackerPosition: enemy.position,
        origin: combatant.position,
        destination: destination,
        movementCostFeet: movementDistance,
        reason: `${combatant.name} fallo al atravesar a ${enemy.name}.`,
        createdAt: new Date().toISOString()
      });
    }
  }

  const destinationStep = validation.value.steps[actualPath.length - 1];
  const spatialTransition = commitSpatialTransition(room, combatant, destination, destinationStep?.spatialMode ?? "natural");
  combatant.stats.distanceMovedFeet += movementDistance;
  room.currentTurn.movementUsedFeet += movementDistance;
  room.currentTurn.usedMoveAction = true;
  room.log.unshift(makeLog("movement", combatant.name + " avanza " + movementDistance + " pies por " + actualPath.length + " casilla(s). Movimiento usado: " + room.currentTurn.movementUsedFeet + " pies."));

  if (spatialTransition.previousMode !== spatialTransition.currentMode && spatialTransition.currentMode === "squeezing") {
    room.log.unshift(makeLog("movement", combatant.name + " se ha metido en un espacio estrecho y esta Apretujandose."));
  } else if (spatialTransition.previousMode !== spatialTransition.currentMode) {
    room.log.unshift(makeLog("movement", combatant.name + " dejo el espacio estrecho."));
  }
  
  if (finalOpportunities.length > 0) {
    room.pendingOpportunityAttacks.push(...finalOpportunities);
    for (const opportunity of finalOpportunities) {
       room.log.unshift(makeLog("opportunity", opportunity.reason + " Resolver ataque de oportunidad."));
    }
  }
syncEncounterPhase(room);
  broadcast(room);
}
