import {
  EffectManager,
  Rules,
  canStandardAttack,
  createCombatRulesSnapshot,
  cryptoId,
  getAttackContextModifiers,
  getGrappleEscapePreview,
  lifeStatus,
  makeLog,
  projectForcedMovement,
  resolveBullRushOpposedCheck,
  resolveGrappleOpposedCheck,
  resolveGrappleEscapeCheck,
  resolveGrappleTouchAttack,
  resolveTripOpposedCheck,
  resolveTripTouchAttack,
  validateSpecialManeuver,
  type AttackThreatState,
  type ClientCommand,
  type CombatRoom,
  type EffectInstance,
  type ProductionEffectId
} from "@dnd-tactical/shared";
import { requireCombatantControl } from "../auth/control.js";
import { resolveAttack, resolveCriticalConfirmation, resolveWeaponAttackSource, type AttackResult } from "../combat/attackResolver.js";
import { applyDisabledExertion } from "../combat/lifeStatusEffects.js";
import { ensureActiveTurn } from "../combat/turnManager.js";
import { checkCombatOutcome, findCombatant, logStatusChange, syncEncounterPhase } from "../room/roomState.js";
import { broadcast } from "../room/roomStore.js";
import { applyAttackMutations } from "./attackCommands.js";
import { commitSpatialTransition } from "../combat/spatialTransition.js";
import { cloneCombatRoom, commitCombatRoomTransaction } from "../room/roomTransaction.js";

export interface ManeuverDiceSource {
  d20(purpose: "opportunity-attack" | "opportunity-confirmation" | "touch-attacker" | "opposed-attacker" | "opposed-defender" | "opposed-reroll-attacker" | "opposed-reroll-defender"): number;
}

const randomDiceSource: ManeuverDiceSource = {
  d20: () => Math.floor(Math.random() * 20) + 1
};

function checkedD20(diceSource: ManeuverDiceSource, purpose: Parameters<ManeuverDiceSource["d20"]>[0]): number {
  const roll = diceSource.d20(purpose);
  if (!Number.isInteger(roll) || roll < 1 || roll > 20) throw new Error(`Fuente de dados invalida para ${purpose}: ${roll}.`);
  return roll;
}

function resolveInterruptingOpportunityAttack(
  snapshot: ReturnType<typeof createCombatRulesSnapshot>,
  defender: ReturnType<typeof findCombatant>,
  tripper: ReturnType<typeof findCombatant>,
  diceSource: ManeuverDiceSource
): { d20Roll: number; result: AttackResult } {
  const d20Roll = checkedD20(diceSource, "opportunity-attack");
  const tactical = getAttackContextModifiers(snapshot, defender, tripper).byAttackType.melee;
  const source = resolveWeaponAttackSource(defender, "melee");
  let result = resolveAttack(snapshot, defender, tripper, d20Roll, null, "ataque de oportunidad", tactical.attackBonus, { source, cover: tactical.cover });
  if (tactical.labelParts.length > 0) result.attackParts.push(...tactical.labelParts);

  if (result.threatened) {
    const threat: AttackThreatState = {
      attackerId: defender.id,
      targetId: tripper.id,
      initialD20Roll: d20Roll,
      attackBonusTotal: result.attackBonusTotal ?? 0,
      targetArmorClass: result.targetArmorClass ?? 10,
      normalDamageBundle: result.damageBundle,
      criticalThreatFrom: result.threatFrom ?? 20,
      criticalMultiplier: result.multiplier ?? 2,
      weaponName: result.weaponName ?? source.name,
      isFullAttack: false,
      label: "ataque de oportunidad interruptivo"
    };
    const confirmation = resolveCriticalConfirmation(
      snapshot,
      defender,
      tripper,
      threat,
      checkedD20(diceSource, "opportunity-confirmation"),
      null
    );
    result = { ...result, threatened: false, damage: confirmation.damage, damageBundle: confirmation.damageBundle };
  }
  return { d20Roll, result };
}

function resolveTripContest(
  snapshot: ReturnType<typeof createCombatRulesSnapshot>,
  attacker: ReturnType<typeof findCombatant>,
  target: ReturnType<typeof findCombatant>,
  initialAttackerRoll: number,
  diceSource: ManeuverDiceSource
): ReturnType<typeof resolveTripOpposedCheck> {
  return resolveOpposedContest(initialAttackerRoll, diceSource, "Derribo", (attackerRoll, defenderRoll) =>
    resolveTripOpposedCheck(snapshot, attacker, target, attackerRoll, defenderRoll)
  );
}

function resolveOpposedContest<T extends { readonly requiresReroll: boolean }>(
  initialAttackerRoll: number,
  diceSource: ManeuverDiceSource,
  label: string,
  resolver: (attackerRoll: number, defenderRoll: number) => T
): T {
  let result = resolver(initialAttackerRoll, checkedD20(diceSource, "opposed-defender"));
  for (let reroll = 0; result.requiresReroll; reroll += 1) {
    if (reroll >= 20) throw new Error(`La fuente de dados no pudo deshacer un empate exacto de ${label} en 20 rondas.`);
    result = resolver(
      checkedD20(diceSource, "opposed-reroll-attacker"),
      checkedD20(diceSource, "opposed-reroll-defender")
    );
  }
  return result;
}

function resolveBullRushContest(
  snapshot: ReturnType<typeof createCombatRulesSnapshot>,
  attacker: ReturnType<typeof findCombatant>,
  target: ReturnType<typeof findCombatant>,
  initialAttackerRoll: number,
  diceSource: ManeuverDiceSource
): ReturnType<typeof resolveBullRushOpposedCheck> {
  return resolveOpposedContest(initialAttackerRoll, diceSource, "Embestida", (attackerRoll, defenderRoll) =>
    resolveBullRushOpposedCheck(snapshot, attacker, target, attackerRoll, defenderRoll)
  );
}

function requireManualOrAutoRoll(
  value: number | null,
  isAutoRoll: boolean | undefined,
  purpose: "touch-attacker" | "opposed-attacker",
  label: string,
  diceSource: ManeuverDiceSource
): number {
  if (isAutoRoll) return checkedD20(diceSource, purpose);
  if (value === null) throw new Error(`${label} manual requiere una tirada d20 del atacante.`);
  return value;
}

function resolveGrappleContest(
  snapshot: ReturnType<typeof createCombatRulesSnapshot>,
  attacker: ReturnType<typeof findCombatant>,
  target: ReturnType<typeof findCombatant>,
  initialAttackerRoll: number,
  diceSource: ManeuverDiceSource
): ReturnType<typeof resolveGrappleOpposedCheck> {
  return resolveOpposedContest(initialAttackerRoll, diceSource, "Presa", (attackerRoll, defenderRoll) =>
    resolveGrappleOpposedCheck(snapshot, attacker, target, attackerRoll, defenderRoll)
  );
}

export function handleResolveGrappleEscape(
  room: CombatRoom,
  command: Extract<ClientCommand, { type: "resolve-grapple-escape" }>,
  diceSource: ManeuverDiceSource = randomDiceSource
): void {
  const draft = cloneCombatRoom(room);
  const combatant = findCombatant(draft, command.combatantId);
  if (draft.phase !== "active") throw new Error("Escapar de una Presa solo está disponible con el combate en curso.");
  requireCombatantControl(command.actorId, combatant);
  ensureActiveTurn(draft, combatant.id);
  const snapshot = createCombatRulesSnapshot(draft);
  const availability = Rules.evaluateActionAvailability(snapshot, combatant);
  if (!availability.ok) throw new Error(availability.error);
  const action = canStandardAttack(snapshot, combatant);
  if (!action.ok) throw new Error(action.error);
  const projected = getGrappleEscapePreview(snapshot, combatant, command.escapeType);
  if (!projected.ok || !projected.value) throw new Error(projected.error ?? "Intento de Escape inválido.");
  const preview = projected.value;
  const initialRoll = requireManualOrAutoRoll(command.d20Roll, command.isAutoRoll, "opposed-attacker", "Escape de Presa", diceSource);
  const result = resolveOpposedContest(initialRoll, diceSource, "Escape de Presa", (escapeRoll, defenderRoll) =>
    resolveGrappleEscapeCheck(preview, escapeRoll, defenderRoll)
  );
  const wasDisabledAtActionStart = lifeStatus(combatant) === "disabled";

  draft.currentTurn.usedStandardAction = true;
  draft.log.unshift(makeLog("status", `Escape de Presa (${command.escapeType === "escape_artist" ? "Escapismo" : "Presa"}): ${combatant.name} d20 ${result.attackerRoll} + ${result.attackerModifier} = ${result.attackerTotal}; ${preview.opponentName} d20 ${result.defenderRoll} + ${result.defenderModifier} = ${result.defenderTotal}.`));
  if (result.attackerWins) {
    Object.assign(draft, EffectManager.remove(draft, preview.effectInstanceId));
    draft.log.unshift(makeLog("status", `${combatant.name} escapa de la Presa de ${preview.opponentName}; se elimina el vínculo srd_grappling.`));
  } else {
    draft.log.unshift(makeLog("status", `${preview.opponentName} mantiene la Presa sobre ${combatant.name}.`));
  }

  const exertion = applyDisabledExertion(combatant, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
  if (exertion.applied) {
    draft.log.unshift(makeLog("status", `${combatant.name} actua incapacitado con ${exertion.previousHp} HP y pierde 1 HP por esfuerzo. HP: ${exertion.currentHp}/${combatant.hpMax}.`));
    logStatusChange(draft, combatant, exertion.statusBefore, exertion.statusAfter);
  }
  checkCombatOutcome(draft);
  syncEncounterPhase(draft);
  commitCombatRoomTransaction(room, draft);
  broadcast(room);
}

function resolveGrapple(
  room: CombatRoom,
  command: Extract<ClientCommand, { type: "resolve-special-maneuver" }> & { maneuver: { type: "grapple" } },
  attacker: ReturnType<typeof findCombatant>,
  target: ReturnType<typeof findCombatant>,
  snapshot: ReturnType<typeof createCombatRulesSnapshot>,
  diceSource: ManeuverDiceSource
): void {
  const validation = validateSpecialManeuver(snapshot, attacker, target, "grapple");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "grapple") {
    throw new Error(validation.error ?? "Presa invalida.");
  }
  const preview = validation.value;
  const wasDisabledAtActionStart = lifeStatus(attacker) === "disabled";
  const interrupt = preview.defenderCanMakeOpportunityAttack
    ? resolveInterruptingOpportunityAttack(snapshot, target, attacker, diceSource)
    : null;
  const abortedByDamage = Boolean(interrupt?.result.hits && interrupt.result.damage > 0);
  const touch = abortedByDamage
    ? null
    : resolveGrappleTouchAttack(
        snapshot,
        attacker,
        target,
        requireManualOrAutoRoll(command.maneuver.d20TouchRoll, command.maneuver.isAutoRoll, "touch-attacker", "Presa", diceSource)
      );
  const opposed = touch?.hits
    ? resolveGrappleContest(
        snapshot,
        attacker,
        target,
        requireManualOrAutoRoll(command.maneuver.d20OpposedRoll, command.maneuver.isAutoRoll, "opposed-attacker", "Presa", diceSource),
        diceSource
      )
    : null;

  // Commit único: el vínculo no existe hasta que todas las fases fueron resueltas.
  room.currentTurn.usedStandardAction = true;
  if (interrupt) {
    applyAttackMutations(room, target, attacker, interrupt.d20Roll, preview.distanceFeet, "ataque de oportunidad", interrupt.result);
  }

  if (abortedByDamage) {
    room.log.unshift(makeLog("status", `${attacker.name} intenta iniciar una Presa contra ${target.name}, pero el ataque de oportunidad inflige daño y aborta la maniobra.`));
  } else if (touch && !touch.hits) {
    attacker.stats.attacksMade += 1;
    attacker.stats.misses += 1;
    room.log.unshift(makeLog("attack", `${attacker.name} intenta Presa contra ${target.name}: toque melee d20 ${touch.d20Roll} + ${touch.attackBonus} = ${touch.total} contra Touch AC ${touch.targetArmorClass}; falla.`));
  } else if (touch && opposed) {
    attacker.stats.attacksMade += 1;
    attacker.stats.hits += 1;
    room.log.unshift(makeLog("attack", `${attacker.name} conecta el toque de Presa contra ${target.name}: d20 ${touch.d20Roll} + ${touch.attackBonus} = ${touch.total} contra Touch AC ${touch.targetArmorClass}.`));
    room.log.unshift(makeLog("status", `Prueba enfrentada de Presa: ${attacker.name} d20 ${opposed.attackerRoll} + ${opposed.attackerModifier} = ${opposed.attackerTotal}; ${target.name} d20 ${opposed.defenderRoll} + ${opposed.defenderModifier} = ${opposed.defenderTotal}.`));
    if (opposed.attackerWins) {
      const instance: EffectInstance<ProductionEffectId> = {
        instanceId: cryptoId("effect"),
        effectId: "srd_grappling",
        source: { type: "creature", id: attacker.id },
        targets: [attacker.id, target.id],
        appliedAtEvent: { type: "ActionResolved", combatantId: attacker.id, round: room.round },
        duration: { type: "permanent" }
      };
      Object.assign(room, EffectManager.add(room, instance));
      room.log.unshift(makeLog("status", `${attacker.name} gana la oposición y enlaza a ${target.name} en una Presa. Se aplica srd_grappling a ambos participantes.`));
    } else {
      room.log.unshift(makeLog("status", `${target.name} resiste la Presa; no se crea vínculo.`));
    }
  }

  const exertion = applyDisabledExertion(attacker, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", `${attacker.name} actua incapacitado con ${exertion.previousHp} HP y pierde 1 HP por esfuerzo. HP: ${exertion.currentHp}/${attacker.hpMax}.`));
    logStatusChange(room, attacker, exertion.statusBefore, exertion.statusAfter);
  }
  checkCombatOutcome(room);
  broadcast(room);
}

function resolveBullRush(
  room: CombatRoom,
  command: Extract<ClientCommand, { type: "resolve-special-maneuver" }> & { maneuver: { type: "bull_rush" } },
  attacker: ReturnType<typeof findCombatant>,
  target: ReturnType<typeof findCombatant>,
  snapshot: ReturnType<typeof createCombatRulesSnapshot>,
  diceSource: ManeuverDiceSource
): void {
  const validation = validateSpecialManeuver(snapshot, attacker, target, "bull_rush");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "bull_rush") {
    throw new Error(validation.error ?? "Embestida invalida.");
  }
  const preview = validation.value;
  const wasDisabledAtActionStart = lifeStatus(attacker) === "disabled";
  const interrupt = preview.defenderCanMakeOpportunityAttack
    ? resolveInterruptingOpportunityAttack(snapshot, target, attacker, diceSource)
    : null;
  const abortedByDamage = Boolean(interrupt?.result.hits && interrupt.result.damage > 0);
  const opposed = abortedByDamage
    ? null
    : resolveBullRushContest(
        snapshot,
        attacker,
        target,
        command.maneuver.isAutoRoll
          ? checkedD20(diceSource, "opposed-attacker")
          : command.maneuver.d20OpposedRoll ?? (() => { throw new Error("La Embestida manual requiere una tirada d20 del atacante."); })(),
        diceSource
      );
  const theoreticalDistanceFeet = opposed?.attackerWins
    ? room.board.cellSizeFeet * (1 + Math.floor(opposed.margin / 5))
    : 0;
  const forcedMovement = opposed?.attackerWins
    ? projectForcedMovement(snapshot, target, preview.direction, theoreticalDistanceFeet)
    : null;

  // Commit unico: ninguna validacion posterior puede dejar posicion y efectos desincronizados.
  room.currentTurn.usedStandardAction = true;
  if (interrupt) {
    applyAttackMutations(room, target, attacker, interrupt.d20Roll, preview.distanceFeet, "ataque de oportunidad", interrupt.result);
  }

  if (abortedByDamage) {
    room.log.unshift(makeLog("status", `${attacker.name} intenta embestir a ${target.name}, pero el ataque de oportunidad inflige dano y aborta la maniobra.`));
  } else if (opposed) {
    attacker.stats.attacksMade += 1;
    room.log.unshift(makeLog("status", `Prueba enfrentada de Embestida: ${attacker.name} d20 ${opposed.attackerRoll} + ${opposed.attackerModifier} = ${opposed.attackerTotal}; ${target.name} d20 ${opposed.defenderRoll} + ${opposed.defenderModifier} = ${opposed.defenderTotal}.`));
    if (opposed.attackerWins && forcedMovement) {
      attacker.stats.hits += 1;
      commitSpatialTransition(room, target, forcedMovement.finalPosition, "natural");
      room.log.unshift(makeLog("movement", `${attacker.name} gana la Embestida y desplaza a ${target.name} ${forcedMovement.distanceFeet} pies${forcedMovement.blocked ? " hasta la primera colision legal" : ""}.`));
    } else {
      attacker.stats.misses += 1;
      room.log.unshift(makeLog("status", `${target.name} resiste la Embestida y conserva su posicion.`));
    }
  }

  const exertion = applyDisabledExertion(attacker, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", `${attacker.name} actua incapacitado con ${exertion.previousHp} HP y pierde 1 HP por esfuerzo. HP: ${exertion.currentHp}/${attacker.hpMax}.`));
    logStatusChange(room, attacker, exertion.statusBefore, exertion.statusAfter);
  }
  checkCombatOutcome(room);
  broadcast(room);
}

export function handleResolveSpecialManeuver(
  room: CombatRoom,
  command: Extract<ClientCommand, { type: "resolve-special-maneuver" }>,
  diceSource: ManeuverDiceSource = randomDiceSource
): void {
  if (room.phase !== "active") throw new Error("Esta maniobra solo esta disponible con el combate en curso.");

  const attacker = findCombatant(room, command.maneuver.attackerId);
  const target = findCombatant(room, command.maneuver.targetId);
  requireCombatantControl(command.actorId, attacker);
  ensureActiveTurn(room, attacker.id);

  const snapshot = createCombatRulesSnapshot(room);
  const availability = Rules.evaluateActionAvailability(snapshot, attacker);
  if (!availability.ok) throw new Error(availability.error);
  const actionCheck = canStandardAttack(snapshot, attacker);
  if (!actionCheck.ok) throw new Error(actionCheck.error);
  if (command.maneuver.type === "grapple") {
    resolveGrapple(room, command as typeof command & { maneuver: { type: "grapple" } }, attacker, target, snapshot, diceSource);
    return;
  }
  if (command.maneuver.type === "bull_rush") {
    resolveBullRush(room, command as typeof command & { maneuver: { type: "bull_rush" } }, attacker, target, snapshot, diceSource);
    return;
  }
  const validation = validateSpecialManeuver(snapshot, attacker, target, "trip");
  if (!validation.ok || !validation.value || validation.value.maneuverId !== "trip") throw new Error(validation.error ?? "Derribo invalido.");

  const wasDisabledAtActionStart = lifeStatus(attacker) === "disabled";
  const preview = validation.value;
  const interrupt = preview.defenderCanMakeOpportunityAttack
    ? resolveInterruptingOpportunityAttack(snapshot, target, attacker, diceSource)
    : null;
  const abortedByDamage = Boolean(interrupt?.result.hits && interrupt.result.damage > 0);

  const touch = abortedByDamage
    ? null
    : resolveTripTouchAttack(snapshot, attacker, target, command.maneuver.d20TouchRoll);
  const opposed = touch?.hits
    ? resolveTripContest(snapshot, attacker, target, command.maneuver.d20OpposedRoll, diceSource)
    : null;

  // Commit unico: desde este punto no se ejecutan validaciones que puedan dejar la sala a medias.
  room.currentTurn.usedStandardAction = true;

  if (interrupt) {
    applyAttackMutations(room, target, attacker, interrupt.d20Roll, preview.distanceFeet, "ataque de oportunidad", interrupt.result);
  }

  if (abortedByDamage) {
    room.log.unshift(makeLog("status", `${attacker.name} intenta derribar a ${target.name}, pero el ataque de oportunidad inflige daño y aborta la maniobra.`));
  } else if (touch && !touch.hits) {
    attacker.stats.attacksMade += 1;
    attacker.stats.misses += 1;
    room.log.unshift(makeLog("attack", `${attacker.name} intenta Derribo contra ${target.name}: toque melee d20 ${touch.d20Roll} + ${touch.attackBonus} = ${touch.total} contra Touch AC ${touch.targetArmorClass}; falla.`));
  } else if (touch && opposed) {
    attacker.stats.attacksMade += 1;
    attacker.stats.hits += 1;
    room.log.unshift(makeLog("attack", `${attacker.name} conecta el toque de Derribo contra ${target.name}: d20 ${touch.d20Roll} + ${touch.attackBonus} = ${touch.total} contra Touch AC ${touch.targetArmorClass}.`));
    const defenderAbilityLabel = opposed.defenderAbility === "dexterity" ? "DES" : "FUE";
    room.log.unshift(makeLog("status", `Prueba enfrentada de Derribo: ${attacker.name} d20 ${opposed.attackerRoll} + ${opposed.attackerModifier} = ${opposed.attackerTotal}; ${target.name} usa ${defenderAbilityLabel}, d20 ${opposed.defenderRoll} + ${opposed.defenderModifier} = ${opposed.defenderTotal}.`));
    if (opposed.attackerWins) {
      const instance: EffectInstance<ProductionEffectId> = {
        instanceId: cryptoId("effect"),
        effectId: "srd_prone",
        source: { type: "creature", id: attacker.id },
        targets: [target.id],
        appliedAtEvent: { type: "ActionResolved", combatantId: attacker.id, round: room.round },
        duration: { type: "permanent" }
      };
      Object.assign(room, EffectManager.add(room, instance));
      room.log.unshift(makeLog("status", `${attacker.name} gana la prueba enfrentada y derriba a ${target.name}. Se aplica srd_prone.`));
    } else {
      room.log.unshift(makeLog("status", `${target.name} resiste el intento de Derribo. No se aplica contra-derribo.`));
    }
  }

  const exertion = applyDisabledExertion(attacker, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", `${attacker.name} actua incapacitado con ${exertion.previousHp} HP y pierde 1 HP por esfuerzo. HP: ${exertion.currentHp}/${attacker.hpMax}.`));
    logStatusChange(room, attacker, exertion.statusBefore, exertion.statusAfter);
  }
  checkCombatOutcome(room);
  broadcast(room);
}
