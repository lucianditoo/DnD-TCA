import { applyDamage, canFullAttack, canStandardAttack, consumeInventoryQuantity, distanceFeet, getCombatantOccupiedCells, getConcealmentAssessment, getEquippedWeaponEntry, getLineOfEffect, lifeStatus, makeLog, createCombatRulesSnapshot, resolveEquippedWeaponProfile, validateAttackAmmunition, type AttackTarget, type ClientCommand, type Combatant, type CombatRoom, type AttackThreatState, type CombatRulesSnapshot, type DamageBundle, type Position, type ProductionEffectId } from "@dnd-tactical/shared";
import { requireCombatantControl, requireTurnControl } from "../auth/control.js";
import { attackRangeFeet, resolveAttack, resolveCriticalConfirmation, resolveWeaponAttackSource } from "../combat/attackResolver.js";
import { applyStartOfNextTurnBuff } from "../combat/buffRules.js";
import { ensureActiveTurn } from "../combat/turnManager.js";
import { findTriggeredRangedOpportunityAttacks, pruneInvalidOpportunityAttacks } from "../combat/opportunityAttackResolver.js";
import { checkCombatOutcome, findCombatant, logStatusChange, movementDistanceFeet, sameCell, syncEncounterPhase } from "../room/roomState.js";
import { getAttackContextModifiers, getAttackRoutine, getGrappleAttackEligibility, getWeaponAttackTypeForTarget, Rules } from "@dnd-tactical/shared";
import { broadcast } from "../room/roomStore.js";
import { applyDisabledExertion } from "../combat/lifeStatusEffects.js";
import { cloneCombatRoom, commitCombatRoomTransaction } from "../room/roomTransaction.js";
import { commitSpatialTransition } from "../combat/spatialTransition.js";
import { rollDice } from "../combat/diceRoller.js";

export interface PhysicalAttackExecutionOptions {
  readonly diceRoller?: (sides: number) => number;
}

function rollDiceExpression(expression: string | undefined, roller: (sides: number) => number, fallback: number): number {
  const match = expression?.match(/^(\d+)d(\d+)$/i);
  if (!match) return fallback;
  let total = 0;
  for (let die = 0; die < Number(match[1]); die += 1) total += roller(Number(match[2]));
  return total;
}

function resolveCommandRolls(command: { d20Roll: number | null; damage: number | null; isAutoRoll?: boolean }, source: ReturnType<typeof resolveWeaponAttackSource>, roller: (sides: number) => number): { d20Roll: number; damage: number | null } {
  if (command.isAutoRoll) {
    const d20Roll = roller(20);
    const rolledWeaponDamage = rollDiceExpression(source.damageDice, roller, source.defaultDamage);
    return { d20Roll, damage: Math.max(1, rolledWeaponDamage + (source.damageModifier ?? 0)) };
  }
  if (!Number.isInteger(command.d20Roll) || command.d20Roll === null || command.d20Roll < 1 || command.d20Roll > 20) throw new Error("La tirada d20 manual debe ser un entero entre 1 y 20.");
  return { d20Roll: command.d20Roll, damage: command.damage };
}

export function handleResolveAttack(room: CombatRoom, command: Extract<ClientCommand, { type: "resolve-attack" }>, options: PhysicalAttackExecutionOptions = {}): void {
  const draft = cloneCombatRoom(room);
  handleResolveAttackDraft(draft, command, options);
  commitCombatRoomTransaction(room, draft);
  broadcast(room);
}

/**
 * Sprint 053B: resuelve la intención genérica de objetivo (§13.7 del NDD) — por combatiente
 * (targeting directo) o por casilla (Blind Targeting bajo Ocultación Total). `targetId` se
 * conserva como forma legada equivalente a `{ kind: "combatant", combatantId: targetId }`.
 * Devuelve `target: null` cuando la casilla elegida no tiene ningún combatiente atacable —
 * el llamador es responsable de resolver ese caso como un fallo automático indistinguible
 * (nunca reveleando la casilla vacía), nunca como un rechazo. Esta función solo RESUELVE quién es
 * el objetivo — no valida todavía si el targeting directo está permitido (eso ocurre después de
 * Line of Effect, ver `handleResolveAttackDraft`: Cobertura Total es un bloqueo más fundamental y
 * severo que Ocultación Total, y debe evaluarse primero).
 */
function resolveAttackIntent(
  room: CombatRoom,
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  command: Extract<ClientCommand, { type: "resolve-attack" }>
): { target: Combatant | null; square: Position | null; wasDirectTargeting: boolean } {
  const intent: AttackTarget | undefined = command.target ?? (command.targetId ? { kind: "combatant", combatantId: command.targetId } : undefined);
  if (!intent) throw new Error("Debe especificarse un objetivo.");

  if (intent.kind === "combatant") {
    return { target: findCombatant(room, intent.combatantId), square: null, wasDirectTargeting: true };
  }

  // Sprint 053B: el servidor resuelve en secreto qué combatiente (si alguno) ocupa la casilla —
  // el cliente nunca envía ni conoce esa respuesta antes de tiempo. Cualquier celda ocupada por
  // un footprint multicasilla es una casilla objetivo válida (mismo principio ya usado por Line
  // of Effect, §1.3.1: "puede elegir cualquier casilla que ocupa").
  const occupant = room.combatants.find((candidate) => {
    if (candidate.id === attacker.id) return false;
    const status = lifeStatus(candidate);
    if (status !== "active" && status !== "disabled") return false;
    return getCombatantOccupiedCells(candidate, snapshot).some((cell) => cell.x === intent.position.x && cell.y === intent.position.y);
  }) ?? null;
  return { target: occupant, square: intent.position, wasDirectTargeting: false };
}

function handleResolveAttackDraft(room: CombatRoom, command: Extract<ClientCommand, { type: "resolve-attack" }>, options: PhysicalAttackExecutionOptions): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  const attacker = findCombatant(room, command.attackerId);
  requireCombatantControl(command.actorId, attacker);
  ensureActiveTurn(room, attacker.id);
  if (room.currentTurn.attackMode === "none") throw new Error("Debe preparar un modo de ataque (Estandar o Completo) antes de atacar.");

  const wasDisabledAtActionStart = lifeStatus(attacker) === "disabled";

  const isFullAttack = room.currentTurn.attackMode === "full";
  const fightingDefensively = room.currentTurn.defensiveFightingDeclared;

  const snapshot = createCombatRulesSnapshot(room);
  const { target, square, wasDirectTargeting } = resolveAttackIntent(room, snapshot, attacker, command);

  const grappleEligibility = getGrappleAttackEligibility(snapshot, attacker);
  if (!grappleEligibility.ok) throw new Error(grappleEligibility.error ?? "Fuente de ataque inválida durante la Presa.");

  const availability = Rules.evaluateActionAvailability(snapshot, attacker);
  if (!availability.ok) throw new Error(availability.error);

  const routine = getAttackRoutine(attacker);
  if (room.currentTurn.attacksMade >= routine.length) {
    throw new Error("No le quedan mas ataques en su rutina.");
  }

  if (room.currentTurn.attackMode === "standard" && room.currentTurn.attacksMade >= 1) {
    throw new Error("El Ataque Estandar solo permite un (1) ataque.");
  }

  if (room.currentTurn.attacksMade === 0) {
    const action = isFullAttack ? canFullAttack(snapshot, attacker) : canStandardAttack(snapshot, attacker);
    if (!action.ok) throw new Error(action.error);
  }

  const currentAttack = routine[room.currentTurn.attacksMade];

  if (target === null) {
    // Sprint 053B (Blind Targeting, NDD §13.7/§13.8): casilla elegida sin ningún combatiente
    // atacable. Consume el intento de ataque, la acción y la munición exactamente igual que un
    // ataque fallido contra un objetivo real — nunca revela que la casilla estaba vacía.
    resolveBlindSquareMiss(room, snapshot, attacker, square!, fightingDefensively, wasDisabledAtActionStart);
    return;
  }

  // Sprint 052B (DEFENSE-LINE-OF-EFFECT, Parcial): legalidad de objetivo antes de cualquier
  // tirada/consumo/mutación. Ausencia de Line of Effect = Total Cover = el ataque no puede
  // intentarse en absoluto (distinto de Cover por criatura, que solo aporta +4 CA y no bloquea
  // el intento). Ver docs/designs/vision-and-line-of-effect-architecture.md y
  // docs/designs/terrain-cover-line-of-effect-decision.md.
  const lineOfEffect = getLineOfEffect(snapshot, attacker, target);
  if (!lineOfEffect.hasLineOfEffect) {
    throw new Error(target.name + " tiene Cobertura Total: " + attacker.name + " no tiene línea de efecto hacia el objetivo.");
  }

  // Sprint 053B (Blind Targeting, NDD §13.7): targeting directo nunca es un bypass. Se evalúa
  // después de Line of Effect (Cobertura Total es un bloqueo más severo y fundamental que
  // Ocultación Total: si no hay Line of Effect, el ataque ya es ilegal sin importar Vision). Si
  // el resultado final de Concealment (Vision + efectos declarativos) exige elegir una casilla,
  // el intento directo se rechaza aquí, sin mutación ni tirada, sin importar qué combatantId haya
  // enviado el cliente — no se revela la posición real del objetivo más allá de lo que el propio
  // cliente ya conocía (fue su combatantId).
  if (wasDirectTargeting) {
    const concealment = getConcealmentAssessment(snapshot, attacker, target);
    if (!concealment.directTargetingAllowed) {
      throw new Error(target.name + " tiene Ocultación Total: debe elegir una casilla en vez de un objetivo directo.");
    }
  }

  const attackDistance = attackRangeFeet(snapshot, attacker, target);
  const attackType = getWeaponAttackTypeForTarget(snapshot, attacker, target);
  const source = resolveWeaponAttackSource(attacker, attackType);
  const weaponEntry = getEquippedWeaponEntry(attacker);
  const ammunition = attackType === "ranged" ? validateAttackAmmunition(attacker, weaponEntry) : { ok: true as const, value: { required: false, availableQuantity: 0 } };
  if (!ammunition.ok || !ammunition.value) throw new Error(ammunition.error ?? "No hay munición disponible.");
  const roller = options.diceRoller ?? rollDice;
  const rolls = resolveCommandRolls(command, source, roller);
  const rangedOpportunities = findTriggeredRangedOpportunityAttacks(snapshot, attacker, attackDistance);
  if (rangedOpportunities.length > 0) {
    room.pendingOpportunityAttacks.push(...rangedOpportunities);
    room.log.unshift(makeLog("attack", `${attacker.name} provoca ${rangedOpportunities.length} Ataques de Oportunidad al usar un ataque a distancia.`));
    syncEncounterPhase(room);
    return;
  }
  const isIterative = room.currentTurn.attacksMade > 0;
  const attackNum = room.currentTurn.attacksMade + 1;
  const attackLabel = isIterative 
    ? attackNum + "º ataque iterativo" 
    : isFullAttack 
      ? "ataque completo" 
      : fightingDefensively 
        ? "ataque a la defensiva" 
        : "ataque simple";
  const context = getAttackContextModifiers(snapshot, attacker, target);
  const tactical = context.byAttackType[attackType];
  const finalModifier = (fightingDefensively ? -4 : 0) + tactical.attackBonus + currentAttack.penalty;
  const result = resolveAttack(snapshot, attacker, target, rolls.d20Roll, rolls.damage, attackLabel, finalModifier, { source, diceRoller: roller, cover: tactical.cover, concealment: tactical.concealment });
  if (ammunition.value.required && ammunition.value.selectedItemId) {
    const nextAttacker = consumeInventoryQuantity(attacker, ammunition.value.selectedItemId, 1);
    attacker.inventory = nextAttacker.inventory;
    room.log.unshift(makeLog("system", `${attacker.name} consume 1 unidad de munición; quedan ${ammunition.value.availableQuantity - 1}.`));
  }
  if (fightingDefensively) {
    result.attackParts.push("defensiva -4");
  }
  
  if (currentAttack.penalty < 0) {
    result.attackParts.push("iterativo " + currentAttack.penalty);
  }
  if (tactical.labelParts.length > 0) {
    result.attackParts.push(...tactical.labelParts);
  }

  if (result.threatened) {
    room.activeAttackThreat = {
      attackerId: attacker.id,
      targetId: target.id,
      initialD20Roll: rolls.d20Roll,
      attackBonusTotal: result.attackBonusTotal ?? 0,
      targetArmorClass: result.targetArmorClass ?? 10,
      normalDamageBundle: result.damageBundle,
      criticalThreatFrom: result.threatFrom ?? 20,
      criticalMultiplier: result.multiplier ?? 2,
      weaponName: result.weaponName ?? "arma",
      isFullAttack: isFullAttack,
      fightingDefensively: fightingDefensively,
      label: attackLabel
    };
    room.log.unshift(makeLog("status", attacker.name + " amenaza con un crítico contra " + target.name + " usando " + (result.weaponName ?? "su arma") + "! Esperando confirmación..."));
    if (room.currentTurn.attacksMade === 0) {
      if (room.currentTurn.attackMode === "standard") room.currentTurn.usedStandardAction = true;
      if (room.currentTurn.attackMode === "full") room.currentTurn.usedFullAttack = true;
      if (fightingDefensively) {
        applyStartOfNextTurnBuff(attacker, { name: "Luchar a la defensiva", source: "Ataque", acBonus: 2, acBonusType: "dodge" });
        room.log.unshift(makeLog("status", attacker.name + " activa Luchar a la Defensiva: -4 al ataque y +2 de esquiva a la CA hasta el inicio de su proximo turno."));
      }
    }
    room.currentTurn.attacksMade += 1;
    
    const exertion = applyDisabledExertion(attacker, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
    if (exertion.applied) {
      room.log.unshift(makeLog("status", attacker.name + " actua incapacitado con " + exertion.previousHp + " HP y pierde 1 HP por esfuerzo. HP: " + exertion.currentHp + "/" + attacker.hpMax + "."));
      logStatusChange(room, attacker, exertion.statusBefore, exertion.statusAfter);
      checkCombatOutcome(room);
    }
    
    syncEncounterPhase(room);
    return;
  }

  // Apply mutations for non-threat attack
  applyAttackMutations(room, attacker, target, rolls.d20Roll, attackDistance, attackLabel, result);

  checkCombatOutcome(room);
  pruneInvalidOpportunityAttacks(room);
  if (room.currentTurn.attacksMade === 0) {
    if (room.currentTurn.attackMode === "standard") room.currentTurn.usedStandardAction = true;
    if (room.currentTurn.attackMode === "full") room.currentTurn.usedFullAttack = true;
    if (fightingDefensively) {
      applyStartOfNextTurnBuff(attacker, { name: "Luchar a la defensiva", source: "Ataque", acBonus: 2, acBonusType: "dodge" });
      room.log.unshift(makeLog("status", attacker.name + " activa Luchar a la Defensiva: -4 al ataque y +2 de esquiva a la CA hasta el inicio de su proximo turno."));
    }
  }
  room.currentTurn.attacksMade += 1;
  
  const exertion = applyDisabledExertion(attacker, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", attacker.name + " actua incapacitado con " + exertion.previousHp + " HP y pierde 1 HP por esfuerzo. HP: " + exertion.currentHp + "/" + attacker.hpMax + "."));
    logStatusChange(room, attacker, exertion.statusBefore, exertion.statusAfter);
    checkCombatOutcome(room);
  }
  
}

function resolveThreatOutcome(
  room: CombatRoom,
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  threat: AttackThreatState,
  confirmD20Roll: number | null,
  criticalDamageInput: number | null
): void {
  const attacker = findCombatant(room, threat.attackerId);
  const target = findCombatant(room, threat.targetId);

  let finalDamage = 0;
  let finalDamageBundle: DamageBundle = threat.normalDamageBundle;
  if (confirmD20Roll !== null) {
    const result = resolveCriticalConfirmation(snapshot, attacker, target, threat, confirmD20Roll, criticalDamageInput);
    finalDamage = result.damage;
    finalDamageBundle = result.damageBundle;
    
    attacker.stats.attacksMade += 1;
    if (threat.label === "ataque de oportunidad") {
      attacker.stats.opportunityAttacksMade += 1;
      attacker.stats.opportunityAttacksThisRound = (attacker.stats.opportunityAttacksThisRound ?? 0) + 1;
      attacker.stats = { ...attacker.stats, targetsAttackedThisRoundViaAoO: [...(attacker.stats.targetsAttackedThisRoundViaAoO || []), target.id] };
    }
    attacker.stats.hits += 1;

    if (result.confirmed) {
      room.log.unshift(makeLog("attack", attacker.name + " realiza confirmación de crítico contra " + target.name + ". d20 " + confirmD20Roll + " + ataque " + threat.attackBonusTotal + " = " + result.totalConfirm + " contra CA " + threat.targetArmorClass + ". ¡CRÍTICO CONFIRMADO! (Multiplicador x" + threat.criticalMultiplier + ")"));
    } else {
      room.log.unshift(makeLog("attack", attacker.name + " realiza confirmación de crítico contra " + target.name + ". d20 " + confirmD20Roll + " + ataque " + threat.attackBonusTotal + " = " + result.totalConfirm + " contra CA " + threat.targetArmorClass + ". Crítico fallido, impacto normal."));
    }
    
    if (result.consumedAttackerAidId) attacker.buffs = attacker.buffs.filter((b) => !(b.aidChoice === "attack" && b.aidTargetId === result.consumedAttackerAidId));
    if (result.consumedTargetAidId) target.buffs = target.buffs.filter((b) => !(b.aidChoice === "ac" && b.aidTargetId === result.consumedTargetAidId));

  } else {
    finalDamage = threat.normalDamageBundle.total;
    attacker.stats.attacksMade += 1;
    if (threat.label === "ataque de oportunidad") {
      attacker.stats.opportunityAttacksMade += 1;
      attacker.stats.opportunityAttacksThisRound = (attacker.stats.opportunityAttacksThisRound ?? 0) + 1;
      attacker.stats = { ...attacker.stats, targetsAttackedThisRoundViaAoO: [...(attacker.stats.targetsAttackedThisRoundViaAoO || []), target.id] };
    }
    attacker.stats.hits += 1;

    room.log.unshift(
      makeLog(
        "attack",
        attacker.name + " realiza confirmación de crítico contra " + target.name + ". Amenaza cancelada por el controlador o GM, impacto normal."
      )
    );
  }

  if (finalDamage > 0) {
    const applyResult = applyDamage(target, finalDamage);
    const appliedDamage = Math.max(0, applyResult.hpBefore - applyResult.hpAfter);
    attacker.stats.damageDealt += appliedDamage;
    target.stats.damageTaken += appliedDamage;
    if (applyResult.statusBefore === "active" && applyResult.statusAfter !== "active") target.stats.timesDroppedToZero += 1;
    if (applyResult.statusBefore !== "dead" && applyResult.statusAfter === "dead") attacker.stats.kills += 1;
    room.log.unshift(makeLog("damage", target.name + " recibe " + appliedDamage + " puntos de daño (" + describeDamageBundle(finalDamageBundle) + "). HP restante: " + target.hpCurrent + "/" + target.hpMax + "."));
    logStatusChange(room, target, applyResult.statusBefore, applyResult.statusAfter);
  }

  if (threat.opportunityAttackId) {
    const opportunity = room.pendingOpportunityAttacks.find((o) => o.id === threat.opportunityAttackId);
    if (opportunity) {
      const targetAlreadyStopped = sameCell(target.position, opportunity.origin);
      const opportunityMovementFeet = targetAlreadyStopped ? 0 : opportunity.movementCostFeet ?? movementDistanceFeet(opportunity.origin, opportunity.destination, room.board.cellSizeFeet);
      
      if (opportunityMovementFeet === 0) {
        room.log.unshift(makeLog("opportunity", "El ataque de oportunidad contra " + target.name + " se resuelve sin desplazar al objetivo."));
      } else if (finalDamage > 0) {
        commitSpatialTransition(room, target, opportunity.origin, "natural");
          target.stats.distanceMovedFeet = Math.max(0, target.stats.distanceMovedFeet - opportunityMovementFeet);
        room.log.unshift(makeLog("opportunity", target.name + " no logra abandonar la casilla amenazada y vuelve a su posicion original."));
      } else {
        commitSpatialTransition(room, target, opportunity.destination, "natural");
          room.log.unshift(makeLog("opportunity", target.name + " completa el movimiento porque el ataque de oportunidad no lo detuvo."));
      }
      room.pendingOpportunityAttacks = room.pendingOpportunityAttacks.filter((o) => o.id !== threat.opportunityAttackId);
    }
  }

  room.activeAttackThreat = null;
  checkCombatOutcome(room);
  pruneInvalidOpportunityAttacks(room);
  broadcast(room);
}

export function handleResolveAttackConfirmation(room: CombatRoom, command: Extract<ClientCommand, { type: "resolve-attack-confirmation" }>, options: PhysicalAttackExecutionOptions = {}): void {
  const threat = room.activeAttackThreat;
  if (!threat) throw new Error("No hay una amenaza de critico activa.");
  const attacker = findCombatant(room, threat.attackerId);
  requireCombatantControl(command.actorId, attacker);
  const snapshot = createCombatRulesSnapshot(room);
  const roller = options.diceRoller ?? rollDice;
  const d20Roll = command.isAutoRoll ? roller(20) : command.d20Roll;
  if (!Number.isInteger(d20Roll) || d20Roll === null || d20Roll < 1 || d20Roll > 20) throw new Error("La confirmación d20 manual debe ser un entero entre 1 y 20.");
  resolveThreatOutcome(room, snapshot, threat, d20Roll, command.damage);
}

export function handleCancelAttackThreat(room: CombatRoom, command: Extract<ClientCommand, { type: "cancel-attack-threat" }>): void {
  const threat = room.activeAttackThreat;
  if (!threat) throw new Error("No hay una amenaza de critico activa.");
  const attacker = findCombatant(room, threat.attackerId);
  requireCombatantControl(command.actorId, attacker);
  const snapshot = createCombatRulesSnapshot(room);
  resolveThreatOutcome(room, snapshot, threat, null, null);
}

export function handleResolveOpportunityAttack(room: CombatRoom, command: Extract<ClientCommand, { type: "resolve-opportunity-attack" }>, options: PhysicalAttackExecutionOptions = {}): void {
  const opportunity = room.pendingOpportunityAttacks.find((item) => item.id === command.opportunityId);
  if (!opportunity) throw new Error("Ataque de oportunidad no encontrado.");
  const attacker = findCombatant(room, opportunity.attackerId);
  const target = findCombatant(room, opportunity.targetId);
  requireTurnControl(command.actorId, attacker);
  if (lifeStatus(attacker) !== "active") throw new Error(attacker.name + " no puede hacer ataque de oportunidad en su estado actual.");
  const attackerCurrentPosition = { ...attacker.position };
  const targetCurrentPosition = { ...target.position };
  const source = resolveWeaponAttackSource(attacker, "melee");
  const roller = options.diceRoller ?? rollDice;
  const rolls = resolveCommandRolls(command, source, roller);
  let result: ReturnType<typeof resolveAttack>;
  try {
    attacker.position = opportunity.attackerPosition ? { ...opportunity.attackerPosition } : attacker.position;
    target.position = opportunity.origin;
    const oppSnapshot = createCombatRulesSnapshot(room);
    const context = getAttackContextModifiers(oppSnapshot, attacker, target);
    const tactical = context.byAttackType.melee;
    result = resolveAttack(oppSnapshot, attacker, target, rolls.d20Roll, rolls.damage, "ataque de oportunidad", tactical.attackBonus, {
      source,
      diceRoller: roller,
      isOpportunityAttack: true,
      isMovementProvoked: opportunity.movementCostFeet !== undefined,
      cover: tactical.cover,
      concealment: tactical.concealment
    });
    
    if (tactical.labelParts.length > 0) {
      result.attackParts.push(...tactical.labelParts);
    }
  } finally {
    attacker.position = attackerCurrentPosition;
    target.position = targetCurrentPosition;
  }

  if (result.threatened) {
    room.activeAttackThreat = {
      attackerId: attacker.id,
      targetId: target.id,
      initialD20Roll: rolls.d20Roll,
      attackBonusTotal: result.attackBonusTotal ?? 0,
      targetArmorClass: result.targetArmorClass ?? 10,
      normalDamageBundle: result.damageBundle,
      criticalThreatFrom: result.threatFrom ?? 20,
      criticalMultiplier: result.multiplier ?? 2,
      weaponName: result.weaponName ?? "arma",
      isFullAttack: false,
      fightingDefensively: false,
      label: "ataque de oportunidad",
      opportunityAttackId: opportunity.id
    };
    room.log.unshift(makeLog("status", attacker.name + " amenaza con un crítico contra " + target.name + " en un ataque de oportunidad usando " + (result.weaponName ?? "su arma") + "! Esperando confirmación..."));
    syncEncounterPhase(room);
    broadcast(room);
    return;
  }

  checkCombatOutcome(room);
  applyAttackMutations(room, attacker, target, rolls.d20Roll, movementDistanceFeet(opportunity.attackerPosition ?? attackerCurrentPosition, opportunity.origin, room.board.cellSizeFeet), "ataque de oportunidad", result);

  const targetAlreadyStopped = sameCell(targetCurrentPosition, opportunity.origin);
  const opportunityMovementFeet = targetAlreadyStopped ? 0 : opportunity.movementCostFeet ?? movementDistanceFeet(opportunity.origin, opportunity.destination, room.board.cellSizeFeet);
  if (opportunityMovementFeet === 0) {
    commitSpatialTransition(room, target, targetCurrentPosition, "natural");
      room.log.unshift(makeLog("opportunity", "El ataque de oportunidad contra " + target.name + " se resuelve sin desplazar al objetivo."));
    room.pendingOpportunityAttacks = room.pendingOpportunityAttacks.filter((item) => item.id !== command.opportunityId);
  } else if (result.hits && result.damage > 0) {
    commitSpatialTransition(room, target, opportunity.origin, "natural");
          target.stats.distanceMovedFeet = Math.max(0, target.stats.distanceMovedFeet - opportunityMovementFeet);
    room.log.unshift(makeLog("opportunity", target.name + " no logra abandonar la casilla amenazada y vuelve a su posicion original."));
    room.pendingOpportunityAttacks = room.pendingOpportunityAttacks.filter((item) => item.id !== command.opportunityId);
  } else {
    commitSpatialTransition(room, target, opportunity.destination, "natural");
          room.log.unshift(makeLog("opportunity", target.name + " completa el movimiento porque el ataque de oportunidad no lo detuvo."));
    room.pendingOpportunityAttacks = room.pendingOpportunityAttacks.filter((item) => item.id !== command.opportunityId);
  }
  pruneInvalidOpportunityAttacks(room);
  broadcast(room);
}

export function applyAttackMutations(room: CombatRoom, attacker: ReturnType<typeof findCombatant>, target: ReturnType<typeof findCombatant>, d20Roll: number, range: number, label: string, result: ReturnType<typeof resolveAttack>) {
  attacker.stats.attacksMade += 1;
  if (label === "ataque de oportunidad") {
    attacker.stats.opportunityAttacksMade += 1;
    attacker.stats.opportunityAttacksThisRound = (attacker.stats.opportunityAttacksThisRound ?? 0) + 1;
    attacker.stats = { ...attacker.stats, targetsAttackedThisRoundViaAoO: [...(attacker.stats.targetsAttackedThisRoundViaAoO || []), target.id] };
  }
  if (result.hits) attacker.stats.hits += 1;
  else attacker.stats.misses += 1;

  const hitSuffix = result.concealment.missed
    ? `La tirada alcanza la CA, pero falla por ocultacion ${result.concealment.assessment.kind === "total" ? "total" : "parcial"} (${result.concealment.assessment.missChancePercent}%; d100 ${result.concealment.d100Roll}).`
    : result.isNatural20 && result.hits
    ? "¡Impacto automático! (20 natural)."
    : result.isNatural1
    ? "Falla automática (1 natural)."
    : result.hits
    ? "Impacta por " + (result.totalAttack - (result.targetArmorClass ?? 10)) + "."
    : "Falla.";

  room.log.unshift(makeLog("attack", attacker.name + " realiza " + label + " contra " + target.name + " a " + range + " ft. d20 " + d20Roll + " + ataque " + result.attackBonusTotal + " (" + result.attackParts.join(", ") + ") = " + result.totalAttack + " contra CA " + result.targetArmorClass + " (" + result.acParts.join(", ") + "). " + hitSuffix));

  if (result.consumedAttackerAidId) attacker.buffs = attacker.buffs.filter((b) => !(b.aidChoice === "attack" && b.aidTargetId === result.consumedAttackerAidId));
  if (result.consumedTargetAidId) target.buffs = target.buffs.filter((b) => !(b.aidChoice === "ac" && b.aidTargetId === result.consumedTargetAidId));

  if (result.hits) {
    const applyResult = applyDamage(target, result.damage);
    const appliedDamage = Math.max(0, applyResult.hpBefore - applyResult.hpAfter);
    attacker.stats.damageDealt += appliedDamage;
    target.stats.damageTaken += appliedDamage;
    if (applyResult.statusBefore === "active" && applyResult.statusAfter !== "active") target.stats.timesDroppedToZero += 1;
    if (applyResult.statusBefore !== "dead" && applyResult.statusAfter === "dead") attacker.stats.kills += 1;
    room.log.unshift(makeLog("damage", target.name + " recibe " + appliedDamage + " puntos de daño (" + describeDamageBundle(result.damageBundle) + "). HP restante: " + target.hpCurrent + "/" + target.hpMax + "."));
    logStatusChange(room, target, applyResult.statusBefore, applyResult.statusAfter);
  }
}

function describeDamageBundle(bundle: DamageBundle): string {
  return bundle.components.map((component) => `${component.label}: ${component.amount}`).join(", ");
}

/**
 * Sprint 053B: mismo criterio que `getWeaponAttackTypeForTarget`, pero contra una `Position`
 * cruda en vez de un `Combatant` real — necesario para el intento de ataque a una casilla vacía,
 * donde no existe ningún objetivo con footprint que medir. Réplica exacta de la lógica (arma a
 * distancia siempre "ranged"; arma arrojadiza cuenta como "melee" solo dentro de su alcance
 * cuerpo a cuerpo), usando distancia punto a punto en vez de distancia entre footprints.
 */
function getWeaponAttackTypeForPosition(attacker: Combatant, distanceToSquareFeet: number): "melee" | "ranged" {
  const weapon = resolveEquippedWeaponProfile(attacker).profile;
  if (weapon.handedness !== "ranged" && weapon.handedness !== "thrown") return "melee";
  if (weapon.handedness === "ranged") return "ranged";
  return distanceToSquareFeet <= weapon.meleeReachFeet ? "melee" : "ranged";
}

/**
 * Sprint 053B (Blind Targeting, NDD §13.7/§13.8): resuelve un intento de ataque contra una
 * casilla sin ningún combatiente atacable. Consume el intento de ataque, la acción declarada y
 * la munición exactamente igual que un ataque fallido contra un objetivo real — nunca revela que
 * la casilla estaba vacía (ni en el mensaje público, ni en el consumo de recursos, ni en si se
 * tiró o no un dado: el SRD no exige tirada de ataque contra una casilla vacía, así que no se
 * consume ninguna, igual que el rechazo por Cobertura Total ya no consume tirada — pero a
 * diferencia de Cobertura Total, aquí SÍ es un objetivo válido que el jugador eligió y falló, por
 * lo que sí se consume la acción/munición, nunca se trata como intento inválido).
 */
function resolveBlindSquareMiss(
  room: CombatRoom,
  snapshot: CombatRulesSnapshot<ProductionEffectId>,
  attacker: Combatant,
  square: Position,
  fightingDefensively: boolean,
  wasDisabledAtActionStart: boolean
): void {
  const rangeFeet = distanceFeet(attacker.position, square, room.board.cellSizeFeet);
  const attackType = getWeaponAttackTypeForPosition(attacker, rangeFeet);
  const source = resolveWeaponAttackSource(attacker, attackType);
  if (rangeFeet > source.maxRangeFeet) {
    throw new Error("La casilla elegida esta fuera del alcance de " + attacker.name + " (maximo " + source.maxRangeFeet + " ft).");
  }
  const weaponEntry = getEquippedWeaponEntry(attacker);
  const ammunition = attackType === "ranged" ? validateAttackAmmunition(attacker, weaponEntry) : { ok: true as const, value: { required: false, availableQuantity: 0 } };
  if (!ammunition.ok || !ammunition.value) throw new Error(ammunition.error ?? "No hay munición disponible.");

  const rangedOpportunities = findTriggeredRangedOpportunityAttacks(snapshot, attacker, rangeFeet);
  if (rangedOpportunities.length > 0) {
    room.pendingOpportunityAttacks.push(...rangedOpportunities);
    room.log.unshift(makeLog("attack", `${attacker.name} provoca ${rangedOpportunities.length} Ataques de Oportunidad al usar un ataque a distancia.`));
    syncEncounterPhase(room);
    return;
  }

  if (ammunition.value.required && ammunition.value.selectedItemId) {
    const nextAttacker = consumeInventoryQuantity(attacker, ammunition.value.selectedItemId, 1);
    attacker.inventory = nextAttacker.inventory;
    room.log.unshift(makeLog("system", `${attacker.name} consume 1 unidad de munición; quedan ${ammunition.value.availableQuantity - 1}.`));
  }

  // Log público estructuralmente idéntico a un fallo ordinario (NDD §13.8, Payload seguro): no
  // menciona ningún nombre de combatiente ni "casilla vacía" — solo el resultado binario.
  attacker.stats.attacksMade += 1;
  attacker.stats.misses += 1;
  room.log.unshift(makeLog("attack", `${attacker.name} ataca a una casilla a ${rangeFeet} ft. El ataque falla.`));

  if (room.currentTurn.attacksMade === 0) {
    if (room.currentTurn.attackMode === "standard") room.currentTurn.usedStandardAction = true;
    if (room.currentTurn.attackMode === "full") room.currentTurn.usedFullAttack = true;
    if (fightingDefensively) {
      applyStartOfNextTurnBuff(attacker, { name: "Luchar a la defensiva", source: "Ataque", acBonus: 2, acBonusType: "dodge" });
      room.log.unshift(makeLog("status", attacker.name + " activa Luchar a la Defensiva: -4 al ataque y +2 de esquiva a la CA hasta el inicio de su proximo turno."));
    }
  }
  room.currentTurn.attacksMade += 1;

  const exertion = applyDisabledExertion(attacker, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", attacker.name + " actua incapacitado con " + exertion.previousHp + " HP y pierde 1 HP por esfuerzo. HP: " + exertion.currentHp + "/" + attacker.hpMax + "."));
    logStatusChange(room, attacker, exertion.statusBefore, exertion.statusAfter);
    checkCombatOutcome(room);
  }

  checkCombatOutcome(room);
  pruneInvalidOpportunityAttacks(room);
  syncEncounterPhase(room);
}
