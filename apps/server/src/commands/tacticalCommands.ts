import { applyDamage, canStandardAttack, canUseFiveFootStep, canUseMoveAction, canDisabledCombatantTakeAction, canRun, runSpeedBudgetFeet, buildStraightPath, isDifficultTerrain, findTriggeredOpportunityAttacksForPath, getAttackContextModifiers, getCombatantOccupiedCells, footprintCellKey, isAdjacent, lifeStatus, makeLog, Rules, threatensTarget, createCombatRulesSnapshot, validateMovePath, validateStandUp, getEffectiveAbilityModifier, hasEffectTrait, FeatCatalog, EffectManager, cryptoId, type ClientCommand, type CombatRoom, type CombatRulesSnapshot } from "@dnd-tactical/shared";
import { requireCombatantControl } from "../auth/control.js";
import { resolveAttack, resolveWeaponAttackSource } from "../combat/attackResolver.js";
import { applyStartOfNextTurnBuff } from "../combat/buffRules.js";
import { calculatePathDistanceFeet, canCharge, findChargePath } from "../combat/chargeResolver.js";
import { ensureActiveTurn } from "../combat/turnManager.js";
import { pruneInvalidOpportunityAttacks } from "../combat/opportunityAttackResolver.js";
import { checkCombatOutcome, findCombatant, logStatusChange } from "../room/roomState.js";
import { broadcast } from "../room/roomStore.js";
import { applyAttackMutations } from "./attackCommands.js";
import { applyDisabledExertion } from "../combat/lifeStatusEffects.js";
import { resolveSavingThrow } from "../combat/savingThrowResolver.js";
import { rollDice } from "../combat/diceRoller.js";
import { effectsCatalog } from "@dnd-tactical/shared";
import { commitSpatialTransition } from "../combat/spatialTransition.js";
export function handleUseTacticalAction(room: CombatRoom, command: Extract<ClientCommand, { type: "use-tactical-action" }>): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  const combatant = findCombatant(room, command.combatantId);
  requireCombatantControl(command.actorId, combatant);
  ensureActiveTurn(room, combatant.id);
  const snapshot = createCombatRulesSnapshot(room);
  
  const availability = Rules.evaluateActionAvailability(snapshot, combatant);
  if (!availability.ok) throw new Error(availability.error);

  if (command.action === "total-defense") return handleTotalDefense(room, snapshot, combatant);
  if (command.action === "charge") return handleCharge(room, snapshot, command, combatant);
  if (command.action === "aid-another") return handleAidAnother(room, snapshot, command, combatant);
  if (command.action === "five-foot-step") return handleFiveFootStep(room, snapshot, command, combatant);
  if (command.action === "stand-up") return handleStandUp(room, snapshot, command, combatant);
  if (command.action === "withdraw") return handleWithdraw(room, snapshot, command, combatant);
  if (command.action === "run") return handleRun(room, snapshot, command, combatant);
}

/**
 * MOVE-WITHDRAW (NDD Rev. 3): Retirada como acción de asalto completo (o estándar a 1x
 * para Disabled — "retirada limitada" RAW). Toda la validación ocurre antes de cualquier
 * mutación; el commit (posición + economía + log + AdO pendientes) es un solo paso
 * síncrono, patrón handleCharge. Las AdO se calculan sobre el snapshot previo al
 * movimiento y se resuelven DESPUÉS de confirmar la transición (semántica vigente del
 * pipeline — no existe interrupción a mitad de ruta en este comando).
 */
function handleWithdraw(room: CombatRoom, snapshot: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>, command: Extract<ClientCommand, { type: "use-tactical-action"; action: "withdraw" }>, combatant: ReturnType<typeof findCombatant>): void {
  // ── Validación (cero mutaciones hasta completarla) ─────────────────────────
  if (room.pendingOpportunityAttacks && room.pendingOpportunityAttacks.length > 0) {
    throw new Error("Hay ataques de oportunidad pendientes. Resuelvelos antes de continuar.");
  }
  // Gate base reutilizado: amenaza de critico pendiente, canTakeTurn, CANNOT_MOVE,
  // Defensa total, economia Disabled ("move"), usedFullAttack/usedMoveAction.
  const baseGate = canUseMoveAction(snapshot, combatant);
  if (!baseGate.ok) throw new Error(baseGate.error);

  if (room.currentTurn.attackMode !== "none") throw new Error("No puede retirarse con un modo de ataque preparado. Cancele la preparacion primero.");
  if (room.currentTurn.usedStandardAction) throw new Error("Ya uso su accion estandar este turno; no puede retirarse (la Retirada consume el asalto completo).");
  if (room.currentTurn.usedFiveFootStep) throw new Error("Ya uso el paso de 5 pies este turno; no puede retirarse.");
  if (room.currentTurn.attacksMade > 0) throw new Error("Ya ataco este turno; no puede retirarse.");
  if (room.currentTurn.movementUsedFeet > 0) throw new Error("Ya se movio este turno; la Retirada exige el turno completo.");

  // Rama limitada RAW: Disabled se retira como accion estandar a 1x velocidad.
  const fullRoundCheck = canDisabledCombatantTakeAction(snapshot, combatant, "full-round");
  const isLimitedWithdraw = !fullRoundCheck.ok;
  if (isLimitedWithdraw) {
    const standardCheck = canDisabledCombatantTakeAction(snapshot, combatant, "standard");
    if (!standardCheck.ok) throw new Error(standardCheck.error);
  }

  const speedFeet = Rules.totalSpeedFeet(snapshot, combatant);
  const budgetFeet = isLimitedWithdraw ? speedFeet : speedFeet * 2;
  const movePath = command.path && command.path.length > 0 ? command.path : [command.to];
  const validation = validateMovePath(snapshot, combatant, movePath, budgetFeet, false, false);
  if (!validation.ok || !validation.value) throw new Error(validation.error);

  // V1: sin Acrobacias y sin atravesar enemigos (NDD Rev. 3 §5); destino sin solapar a nadie.
  const finalStep = validation.value.path[validation.value.path.length - 1];
  for (let stepIndex = 0; stepIndex < validation.value.path.length; stepIndex++) {
    const step = validation.value.path[stepIndex];
    const projectedStep = validation.value.steps[stepIndex];
    const stepKeys = new Set((projectedStep?.occupiedCells ?? getCombatantOccupiedCells({ ...combatant, position: { ...step } }, snapshot)).map(footprintCellKey));
    const isFinal = stepIndex === validation.value.path.length - 1;
    const blocker = snapshot.combatants.find((other) =>
      other.id !== combatant.id &&
      lifeStatus(other as Parameters<typeof lifeStatus>[0]) !== "dead" &&
      (isFinal || other.type !== combatant.type) &&
      getCombatantOccupiedCells(other, snapshot).some((cell) => stepKeys.has(footprintCellKey(cell)))
    );
    if (blocker) {
      throw new Error(isFinal
        ? "No puede terminar la Retirada sobre la casilla de " + blocker.name + "."
        : "No puede retirarse a traves de " + blocker.name + " (la Retirada V1 no admite Acrobacias).");
    }
  }

  // Huella inicial completa (todas las celdas para Large+): exenta del disparo de AdO.
  const exemptDepartureCellKeys = new Set(getCombatantOccupiedCells(combatant, snapshot).map(footprintCellKey));
  const distanceFeet = validation.value.distanceFeet;
  const opportunities = findTriggeredOpportunityAttacksForPath(
    snapshot,
    combatant,
    validation.value.path,
    distanceFeet,
    (reactor) => Rules.canMakeOpportunityAttack(snapshot, reactor, combatant.id),
    false,
    exemptDepartureCellKeys
  );

  // ── Commit atomico (patrón handleCharge) ───────────────────────────────────
  const wasDisabledAtActionStart = lifeStatus(combatant) === "disabled";
  const spatialTransition = commitSpatialTransition(room, combatant, finalStep, validation.value.finalSpatialMode);
  combatant.stats.distanceMovedFeet += distanceFeet;
  room.currentTurn.movementUsedFeet += distanceFeet;
  if (isLimitedWithdraw) {
    room.currentTurn.usedStandardAction = true; // retirada limitada: accion estandar, NO asalto completo
  } else {
    room.currentTurn.usedFullAttack = true; // marcador vigente de "accion de asalto completo consumida"
  }
  room.log.unshift(makeLog("movement", combatant.name + " se retira del combate: " + distanceFeet + " pies" + (isLimitedWithdraw ? " (retirada limitada: accion estandar)" : " (accion de asalto completo)") + ". Su posicion inicial no provoca ataques de oportunidad."));
  if (spatialTransition.previousMode !== spatialTransition.currentMode) {
    room.log.unshift(makeLog("movement", spatialTransition.currentMode === "squeezing"
      ? combatant.name + " entra en compresion espacial."
      : combatant.name + " recupera su huella natural."));
  }
  if (opportunities.length > 0) {
    room.pendingOpportunityAttacks.push(...opportunities);
    for (const opportunity of opportunities) room.log.unshift(makeLog("opportunity", opportunity.reason + " Resolver ataque de oportunidad con tirada manual."));
  }

  const exertion = applyDisabledExertion(combatant, { wasDisabledAtActionStart, actionKind: isLimitedWithdraw ? "standard" : "full-round", actionWasExerting: true });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", combatant.name + " actua incapacitado con " + exertion.previousHp + " HP y pierde 1 HP por esfuerzo. HP: " + exertion.currentHp + "/" + combatant.hpMax + "."));
    logStatusChange(room, combatant, exertion.statusBefore, exertion.statusAfter);
    checkCombatOutcome(room);
  }

  broadcast(room);
}

/**
 * MOVE-RUN (NDD docs/designs/run-design.md, decisiones D-1 a D-5 cerradas por PROCEED):
 * Correr como accion de asalto completo, movimiento en linea recta x4 (x3 con armadura
 * pesada) sobre la velocidad efectiva ya resuelta. El servidor deriva el camino canonico
 * desde la posicion actual hasta `to` (nunca confia en un camino enviado por el cliente —
 * no existe tal campo en este comando). Terreno dificil es un rechazo absoluto, no un
 * recargo. D-1: sin exencion de AdO (a diferencia de Retirada) — se reutiliza la
 * generacion normal por camino. D-3/D-5: sin la dote de Correr se suprime Destreza y
 * Esquiva (NO_DEX_TO_AC) hasta el inicio del proximo turno del propio combatiente.
 */
function handleRun(room: CombatRoom, snapshot: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>, command: Extract<ClientCommand, { type: "use-tactical-action"; action: "run" }>, combatant: ReturnType<typeof findCombatant>): void {
  // ── Validación (cero mutaciones hasta completarla) ─────────────────────────
  if (room.pendingOpportunityAttacks && room.pendingOpportunityAttacks.length > 0) {
    throw new Error("Hay ataques de oportunidad pendientes. Resuelvelos antes de continuar.");
  }
  if (room.currentTurn.attackMode !== "none") throw new Error("No puede correr con un modo de ataque preparado. Cancele la preparacion primero.");

  const turnCheck = canRun(snapshot, combatant);
  if (!turnCheck.ok) throw new Error(turnCheck.error);

  const path = buildStraightPath(combatant.position, command.to);
  if (!path) throw new Error("No hay una línea recta hacia ese destino; Correr exige movimiento en línea recta.");

  const budgetFeet = runSpeedBudgetFeet(snapshot, combatant);
  const validation = validateMovePath(snapshot, combatant, path, budgetFeet, false, false);
  if (!validation.ok || !validation.value) throw new Error(validation.error);

  // Prohibición absoluta de terreno difícil (no solo recargo de coste, a diferencia del
  // movimiento normal): cualquier casilla atravesada que sea terreno difícil rechaza toda la ruta.
  const crossesDifficultTerrain = validation.value.steps.some((step, stepIndex) => {
    const stepPosition = validation.value!.path[stepIndex];
    const occupiedCells = step?.occupiedCells ?? getCombatantOccupiedCells({ ...combatant, position: { ...stepPosition } }, snapshot);
    return occupiedCells.some((cell) => isDifficultTerrain(snapshot, cell.x, cell.y));
  });
  if (crossesDifficultTerrain) throw new Error("No puede correr a través de terreno difícil.");

  // V1: sin Acrobacias y sin atravesar enemigos (mismo precedente que Retirada); destino sin solapar a nadie.
  const finalStep = validation.value.path[validation.value.path.length - 1];
  for (let stepIndex = 0; stepIndex < validation.value.path.length; stepIndex++) {
    const step = validation.value.path[stepIndex];
    const projectedStep = validation.value.steps[stepIndex];
    const stepKeys = new Set((projectedStep?.occupiedCells ?? getCombatantOccupiedCells({ ...combatant, position: { ...step } }, snapshot)).map(footprintCellKey));
    const isFinal = stepIndex === validation.value.path.length - 1;
    const blocker = snapshot.combatants.find((other) =>
      other.id !== combatant.id &&
      lifeStatus(other as Parameters<typeof lifeStatus>[0]) !== "dead" &&
      (isFinal || other.type !== combatant.type) &&
      getCombatantOccupiedCells(other, snapshot).some((cell) => stepKeys.has(footprintCellKey(cell)))
    );
    if (blocker) {
      throw new Error(isFinal
        ? "No puede terminar de correr sobre la casilla de " + blocker.name + "."
        : "No puede correr a traves de " + blocker.name + " (Correr V1 no admite Acrobacias).");
    }
  }

  // D-1: sin exención de huella inicial — se reutiliza la generación normal de AdO por camino.
  const distanceFeet = validation.value.distanceFeet;
  const opportunities = findTriggeredOpportunityAttacksForPath(
    snapshot,
    combatant,
    validation.value.path,
    distanceFeet,
    (reactor) => Rules.canMakeOpportunityAttack(snapshot, reactor, combatant.id)
  );

  // ── Commit atomico (patrón handleWithdraw/handleCharge) ────────────────────
  const spatialTransition = commitSpatialTransition(room, combatant, finalStep, validation.value.finalSpatialMode);
  combatant.stats.distanceMovedFeet += distanceFeet;
  room.currentTurn.movementUsedFeet += distanceFeet;
  room.currentTurn.usedFullAttack = true; // marcador vigente de "acción de asalto completo consumida"
  room.log.unshift(makeLog("movement", combatant.name + " corre " + distanceFeet + " pies en línea recta (acción de asalto completo)."));
  if (spatialTransition.previousMode !== spatialTransition.currentMode) {
    room.log.unshift(makeLog("movement", spatialTransition.currentMode === "squeezing"
      ? combatant.name + " entra en compresion espacial."
      : combatant.name + " recupera su huella natural."));
  }
  if (opportunities.length > 0) {
    room.pendingOpportunityAttacks.push(...opportunities);
    for (const opportunity of opportunities) room.log.unshift(makeLog("opportunity", opportunity.reason + " Resolver ataque de oportunidad con tirada manual."));
  }

  // D-3/D-5: sin la dote de Correr, se pierde Destreza (y, por la simplificación documentada,
  // también Esquiva) a la CA hasta el inicio del propio próximo turno.
  const keepsDex = FeatCatalog.runContribution(combatant.featIds ?? []).keepsDexBonusWhileRunning;
  if (!keepsDex) {
    const instance = {
      instanceId: cryptoId("effect"),
      effectId: "srd_running_exposed" as const,
      source: { type: "creature" as const, id: combatant.id },
      targets: [combatant.id],
      appliedAtEvent: { type: "ActionResolved" as const, round: room.round },
      duration: {
        type: "until_turn" as const,
        anchorCombatantId: combatant.id,
        phase: "start" as const,
        appliedAtSequence: room.eventSequence
      }
    };
    const nextRoom = EffectManager.add(room, instance);
    Object.assign(room, nextRoom);
    room.log.unshift(makeLog("status", combatant.name + " pierde su bonificador de Destreza a la CA por correr sin la dote de Correr, hasta el inicio de su próximo turno."));
  }

  broadcast(room);
}

export function handleChooseAidBonus(room: CombatRoom, command: Extract<ClientCommand, { type: "choose-aid-bonus" }>): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  const combatant = findCombatant(room, command.combatantId);
  requireCombatantControl(command.actorId, combatant);
  ensureActiveTurn(room, combatant.id);
  const buff = combatant.buffs.find((item) => item.id === command.buffId);
  if (!buff || buff.aidChoice !== "pending") throw new Error("Esa ayuda ya no esta pendiente.");
  buff.aidChoice = command.choice;
  room.log.unshift(makeLog("status", combatant.name + " reserva " + buff.name + " como +" + (buff.aidBonus ?? 2) + " a " + (command.choice === "attack" ? "su proximo ataque" : "su CA contra el proximo ataque") + " contra " + (buff.aidTargetName ?? "el objetivo") + "."));
  broadcast(room);
}

export function handleDeclareAttackMode(room: CombatRoom, command: Extract<ClientCommand, { type: "declare-attack-mode" }>): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  const combatant = findCombatant(room, command.combatantId);
  requireCombatantControl(command.actorId, combatant);
  ensureActiveTurn(room, combatant.id);

  const snapshot = createCombatRulesSnapshot(room);
  const availability = Rules.evaluateActionAvailability(snapshot, combatant);
  if (!availability.ok) throw new Error(availability.error);

  if (room.currentTurn.attacksMade > 0) throw new Error("No se puede cambiar el modo despues de haber atacado.");
  
  if (command.mode === "full") {
    if (lifeStatus(combatant) === "disabled") {
      throw new Error("Un personaje a 0 HP no puede realizar un Ataque Completo.");
    }
    if (room.currentTurn.usedMoveAction || room.currentTurn.movementUsedFeet > 5) {
      throw new Error("El Ataque Completo requiere no haberse movido previamente (excepto paso de 5 pies).");
    }
  }

  room.currentTurn.attackMode = command.mode;
  room.currentTurn.defensiveFightingDeclared = command.defensive;
  room.log.unshift(makeLog("status", combatant.name + " prepara Ataque " + (command.mode === "full" ? "Completo" : "Estandar") + (command.defensive ? " a la defensiva" : "") + "."));
  broadcast(room);
}

export function handleCancelAttackMode(room: CombatRoom, command: Extract<ClientCommand, { type: "cancel-attack-mode" }>): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  const combatant = findCombatant(room, command.combatantId);
  requireCombatantControl(command.actorId, combatant);
  ensureActiveTurn(room, combatant.id);

  if (room.currentTurn.attacksMade > 0) throw new Error("No se puede cancelar el modo despues de haber atacado.");

  room.currentTurn.attackMode = "none";
  room.currentTurn.defensiveFightingDeclared = false;
  room.log.unshift(makeLog("status", combatant.name + " cancela la preparacion de ataque."));
  broadcast(room);
}

function handleTotalDefense(room: CombatRoom, snapshot: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>, combatant: ReturnType<typeof findCombatant>): void {
  const turnCheck = canStandardAttack(snapshot, combatant);
  if (!turnCheck.ok) throw new Error(turnCheck.error);
  if (room.currentTurn.movementUsedFeet > 0 || room.currentTurn.usedMoveAction || room.currentTurn.usedFiveFootStep) throw new Error("Defensa total requiere renunciar al movimiento, ataques y conjuros de este turno.");
  
  const wasDisabledAtActionStart = lifeStatus(combatant) === "disabled";
  
  applyStartOfNextTurnBuff(combatant, { name: "Defensa total", source: "Tacticas", acBonus: 4, acBonusType: "dodge", preventsOpportunityAttacks: true });
  room.currentTurn.usedStandardAction = true;
  room.currentTurn.usedMoveAction = true;
  room.currentTurn.usedTotalDefense = true;
  room.log.unshift(makeLog("status", combatant.name + " usa Defensa total: +4 de esquiva a la CA hasta el inicio de su proximo turno y no puede realizar ataques de oportunidad."));
  
  const exertion = applyDisabledExertion(combatant, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", combatant.name + " actua incapacitado con " + exertion.previousHp + " HP y pierde 1 HP por esfuerzo. HP: " + exertion.currentHp + "/" + combatant.hpMax + "."));
    logStatusChange(room, combatant, exertion.statusBefore, exertion.statusAfter);
    checkCombatOutcome(room);
  }
  
  broadcast(room);
}

function handleCharge(room: CombatRoom, snapshot: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>, command: Extract<ClientCommand, { type: "use-tactical-action"; action: "charge" }>, combatant: ReturnType<typeof findCombatant>): void {
  const target = findCombatant(room, command.targetId);
  const turnCheck = canCharge(snapshot, combatant);
  if (!turnCheck.ok) throw new Error(turnCheck.error);
  if (target.type === combatant.type) throw new Error("Carga requiere un enemigo como objetivo.");
  const chargePath = findChargePath(snapshot, combatant, target);
  if (!chargePath.ok || !chargePath.value) throw new Error(chargePath.error);
  
  const wasDisabledAtActionStart = lifeStatus(combatant) === "disabled";
  
  const movementDistance = calculatePathDistanceFeet(combatant.position, chargePath.value, room.board.cellSizeFeet);
  const opportunities = findTriggeredOpportunityAttacksForPath(
    snapshot, 
    combatant, 
    chargePath.value, 
    movementDistance,
    (c) => Rules.canMakeOpportunityAttack(snapshot, c, combatant.id)
  );
  commitSpatialTransition(room, combatant, chargePath.value[chargePath.value.length - 1], "natural");
  combatant.stats.distanceMovedFeet += movementDistance;
  room.currentTurn.movementUsedFeet += movementDistance;
  room.currentTurn.usedFullAttack = true;
  room.log.unshift(makeLog("movement", combatant.name + " carga " + movementDistance + " pies hacia " + target.name + "."));
  if (opportunities.length > 0) {
    room.pendingOpportunityAttacks.push(...opportunities);
    for (const opportunity of opportunities) room.log.unshift(makeLog("opportunity", opportunity.reason + " Resolver ataque de oportunidad con tirada manual."));
  }
  const tactical = getAttackContextModifiers(snapshot, combatant, target).byAttackType.melee;
  const result = resolveAttack(snapshot, combatant, target, command.d20Roll, command.damage, "carga", 2 + tactical.attackBonus, { source: resolveWeaponAttackSource(combatant, "melee"), cover: tactical.cover });
  result.attackParts.push("carga +2");
  result.attackParts.push(...tactical.labelParts);
  
  if (result.threatened) {
    room.activeAttackThreat = {
      attackerId: combatant.id,
      targetId: target.id,
      initialD20Roll: command.d20Roll,
      attackBonusTotal: result.attackBonusTotal ?? 0,
      targetArmorClass: result.targetArmorClass ?? 10,
      normalDamageBundle: result.damageBundle,
      criticalThreatFrom: result.threatFrom ?? 20,
      criticalMultiplier: result.multiplier ?? 2,
      weaponName: result.weaponName ?? "arma",
      isFullAttack: false,
      fightingDefensively: false,
      label: "carga"
    };
    room.log.unshift(makeLog("status", combatant.name + " amenaza con un crítico contra " + target.name + " en una carga usando " + (result.weaponName ?? "su arma") + "! Esperando confirmación..."));
  } else {
    applyAttackMutations(room, combatant, target, command.d20Roll, 0, "carga", result);
  }
  applyStartOfNextTurnBuff(combatant, { name: "Carga", source: "Tacticas", acBonus: -2 });
  room.log.unshift(makeLog("status", combatant.name + " queda con -2 a la CA por cargar hasta el inicio de su proximo turno."));
  
  const exertion = applyDisabledExertion(combatant, { wasDisabledAtActionStart, actionKind: "full-round", actionWasExerting: true });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", combatant.name + " actua incapacitado con " + exertion.previousHp + " HP y pierde 1 HP por esfuerzo. HP: " + exertion.currentHp + "/" + combatant.hpMax + "."));
    logStatusChange(room, combatant, exertion.statusBefore, exertion.statusAfter);
  }

  checkCombatOutcome(room);
  pruneInvalidOpportunityAttacks(room);
  broadcast(room);
}

function handleAidAnother(room: CombatRoom, snapshot: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>, command: Extract<ClientCommand, { type: "use-tactical-action"; action: "aid-another" }>, combatant: ReturnType<typeof findCombatant>): void {
  const ally = findCombatant(room, command.allyId);
  const target = findCombatant(room, command.targetId);
  const turnCheck = canStandardAttack(snapshot, combatant);
  if (!turnCheck.ok) throw new Error(turnCheck.error);
  if (ally.id === combatant.id) throw new Error("Prestar ayuda requiere elegir otro aliado.");
  if (ally.type !== combatant.type) throw new Error("Prestar ayuda requiere un aliado.");
  if (target.type === combatant.type) throw new Error("Prestar ayuda en combate requiere un enemigo como oponente.");
  if (!threatensTarget(snapshot, combatant, target)) throw new Error(combatant.name + " no amenaza a " + target.name + "; no puede ayudar en ese combate cuerpo a cuerpo.");
  
  const wasDisabledAtActionStart = lifeStatus(combatant) === "disabled";
  
  const attack = Rules.totalAttackBonus(snapshot, combatant);
  const total = command.d20Roll + attack.total;
  room.currentTurn.usedStandardAction = true;
  if (total >= 10) {
    ally.buffs.push({
      id: "buff-" + Math.random().toString(36).slice(2, 10),
      name: "Ayuda de " + combatant.name,
      source: combatant.name,
      remainingTurns: 1,
      expiresAfterTurnOf: ally.id,
      aidBonus: 2,
      aidTargetId: target.id,
      aidTargetName: target.name,
      aidChoice: "pending",
      aidSourceId: combatant.id
    });
    room.log.unshift(makeLog("status", combatant.name + " presta ayuda a " + ally.name + " contra " + target.name + ". d20 " + command.d20Roll + " + ataque " + attack.total + " = " + total + " contra CA 10. " + ally.name + " tendra que elegir +2 ataque o +2 CA en su turno."));
  } else {
    room.log.unshift(makeLog("status", combatant.name + " intenta prestar ayuda a " + ally.name + " contra " + target.name + ", pero falla. d20 " + command.d20Roll + " + ataque " + attack.total + " = " + total + " contra CA 10."));
  }
  
  const exertion = applyDisabledExertion(combatant, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", combatant.name + " actua incapacitado con " + exertion.previousHp + " HP y pierde 1 HP por esfuerzo. HP: " + exertion.currentHp + "/" + combatant.hpMax + "."));
    logStatusChange(room, combatant, exertion.statusBefore, exertion.statusAfter);
  }

  checkCombatOutcome(room);
  broadcast(room);
}

function handleFiveFootStep(room: CombatRoom, snapshot: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>, command: Extract<ClientCommand, { type: "use-tactical-action"; action: "five-foot-step" }>, combatant: ReturnType<typeof findCombatant>): void {
  const stepCheck = canUseFiveFootStep(snapshot, combatant);
  if (!stepCheck.ok) throw new Error(stepCheck.error);

  const validation = validateMovePath(snapshot, combatant, [command.to], room.board.cellSizeFeet, true);
  if (!validation.ok || !validation.value) throw new Error(validation.error);

  const spatialTransition = commitSpatialTransition(room, combatant, command.to, validation.value.finalSpatialMode);
  combatant.stats.distanceMovedFeet += validation.value.distanceFeet;
  room.currentTurn.usedFiveFootStep = true;
  room.currentTurn.movementUsedFeet += validation.value.distanceFeet;

  room.log.unshift(makeLog("movement", combatant.name + " usa paso de 5 pies hacia (" + command.to.x + ", " + command.to.y + "). Sin ataque de oportunidad."));
  if (spatialTransition.previousMode !== spatialTransition.currentMode) {
    room.log.unshift(makeLog("movement", spatialTransition.currentMode === "squeezing"
      ? combatant.name + " entra en compresion espacial."
      : combatant.name + " recupera su huella natural."));
  }
  broadcast(room);
}

function handleStandUp(room: CombatRoom, snapshot: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>, command: Extract<ClientCommand, { type: "use-tactical-action"; action: "stand-up" }>, combatant: ReturnType<typeof findCombatant>): void {
  const validation = validateStandUp(snapshot, combatant);
  if (!validation.ok || !validation.value) throw new Error(validation.error);

  const wasDisabledAtActionStart = lifeStatus(combatant) === "disabled";

  // Remove PRONE effect directly
  room.effectInstances = room.effectInstances.filter(ei => {
    if (!ei.targets || !ei.targets.includes(combatant.id)) return true;
    const effectDef = effectsCatalog[ei.effectId as keyof typeof effectsCatalog];
    return effectDef && (!effectDef.traits || !(effectDef.traits as readonly string[]).includes("PRONE"));
  });

  room.currentTurn.movementUsedFeet += validation.value.costFeet;
  room.currentTurn.usedMoveAction = true;
  room.log.unshift(makeLog("movement", combatant.name + " se levanta consumiendo " + validation.value.costFeet + " pies de movimiento. " + validation.value.labelParts.join(", ") + "."));

  const opportunities = [];
  if (validation.value.provokesOpportunityAttacks) {
    const enemies = room.combatants.filter(c => c.type !== combatant.type && lifeStatus(c) === "active");
    for (const enemy of enemies) {
      if (Rules.canMakeOpportunityAttack(snapshot, enemy, combatant.id) && threatensTarget(snapshot, enemy, combatant)) {
        opportunities.push({
          id: "opp-" + Math.random().toString(36).slice(2, 10),
          attackerId: enemy.id,
          targetId: combatant.id,
          trigger: "stand-up",
          reason: `${enemy.name} ataca a ${combatant.name} por levantarse.`,
          isValid: true,
          positionAtTrigger: { ...combatant.position },
          attackMode: "melee" as const,
          sourceEffectId: null,
          attackerPosition: { ...enemy.position },
          origin: { ...combatant.position },
          destination: { ...combatant.position },
          createdAt: new Date().toISOString()
        });
      }
    }
  }
  room.pendingOpportunityAttacks.push(...opportunities);
  if (opportunities.length > 0) {
    room.log.unshift(makeLog("attack", `${combatant.name} provoca ${opportunities.length} Ataques de Oportunidad al levantarse.`));
  }

  const exertion = applyDisabledExertion(combatant, { wasDisabledAtActionStart, actionKind: "move", actionWasExerting: false });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", combatant.name + " actua incapacitado con " + exertion.previousHp + " HP y pierde 1 HP por esfuerzo. HP: " + exertion.currentHp + "/" + combatant.hpMax + "."));
    logStatusChange(room, combatant, exertion.statusBefore, exertion.statusAfter);
  }

  checkCombatOutcome(room);
  broadcast(room);
}

export function handleResolveSavingThrow(room: CombatRoom, command: Extract<ClientCommand, { type: "resolve-saving-throw" }>): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  const target = findCombatant(room, command.targetId);
  // requireCombatantControl(command.actorId, target); // El DM también puede lanzar salvaciones si es necesario
  const snapshot = createCombatRulesSnapshot(room);

  const result = resolveSavingThrow(snapshot, target, command.saveType, command.dc, command.d20Roll);
  
  let outcomeText = result.success ? "éxito" : "fallo";
  if (result.isNatural1) outcomeText = "Fallo Crítico (1 natural)";
  if (result.isNatural20) outcomeText = "Éxito Crítico (20 natural)";

  room.log.unshift(makeLog(
    "system",
    target.name + " intenta salvación de " + command.saveType + " contra CD " + command.dc + ". Tirada: " + command.d20Roll + " (d20) + " + result.modifier + " = " + result.total + ". Resultado: " + outcomeText
  ));

  broadcast(room);
}

export function handleDeclareDodgeTarget(room: CombatRoom, command: Extract<ClientCommand, { type: "declare-dodge-target" }>): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  const combatant = findCombatant(room, command.combatantId);
  requireCombatantControl(command.actorId, combatant);
  ensureActiveTurn(room, combatant.id);

  if (!FeatCatalog.hasFeat(combatant.featIds, "srd_dodge")) {
    throw new Error(combatant.name + " no posee la dote Esquiva (Dodge).");
  }

  if (command.targetId === null) {
    combatant.dodgeTargetId = null;
    room.log.unshift(makeLog("status", combatant.name + " retira su designación de Esquiva."));
    broadcast(room);
    return;
  }

  const target = findCombatant(room, command.targetId);
  if (lifeStatus(target) === "dead") throw new Error(target.name + " ya esta muerto y no puede ser designado.");

  combatant.dodgeTargetId = target.id;
  room.log.unshift(makeLog("status", combatant.name + " designa a " + target.name + " como objetivo de Esquiva."));
  broadcast(room);
}
