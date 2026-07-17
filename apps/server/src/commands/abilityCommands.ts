import { applyDamage, averageDiceDamage, canStandardAttack, getAttackContextModifiers, lifeStatus, makeLog, Rules, createCombatRulesSnapshot, type ClientCommand, type CombatRoom, SpellsCatalog, type Ability, threatensTarget, getCellsIntersectedByAoE, getCombatantOccupiedCells, footprintCellKey, type Combatant } from "@dnd-tactical/shared";
import { requireCombatantControl } from "../auth/control.js";
import { attackRangeFeet, makeDamageBundle, resolveAttack, type ResolvedAttackSource } from "../combat/attackResolver.js";
import { resolveAbility, validateAbilityRange, validateAbilityTarget } from "../combat/abilityResolver.js";
import { rollDice } from "../combat/diceRoller.js";
import { applyDisabledExertion } from "../combat/lifeStatusEffects.js";
import { commitCombatRoomTransaction } from "../room/roomTransaction.js";
import { applySpellSaveToDamageBundle, resolveSpellSavingThrow, type SpellSavingThrowResult } from "../combat/savingThrowResolver.js";
import { ensureActiveTurn } from "../combat/turnManager.js";
import { applyAttackMutations } from "./attackCommands.js";
import { checkCombatOutcome, findCombatant, logStatusChange, syncEncounterPhase } from "../room/roomState.js";
import { broadcast } from "../room/roomStore.js";
import crypto from "crypto";

export function handleUseAbility(room: CombatRoom, command: Extract<ClientCommand, { type: "use-ability" }>): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  const caster = findCombatant(room, command.casterId);
  const target = findCombatant(room, command.targetId);
  requireCombatantControl(command.actorId, caster);
  ensureActiveTurn(room, caster.id);
  const snapshot = createCombatRulesSnapshot(room);
  const availability = Rules.evaluateActionAvailability(snapshot, caster);
  if (!availability.ok) throw new Error(availability.error);
  
  const action = canStandardAttack(snapshot, caster);
  if (!action.ok) throw new Error(action.error);
  const ability = caster.abilities.find((item) => item.id === command.abilityId);
  if (!ability) throw new Error(caster.name + " no tiene esa habilidad preparada.");
  validateAbilityTarget(caster, target, ability.target);
  validateAbilityRange(room, caster, target, ability.rangeFeet);
  const wasDisabledAtActionStart = lifeStatus(caster) === "disabled";
  resolveAbility(room, caster, target, ability, command.amount);
  room.currentTurn.usedStandardAction = true;
  const exertion = applyDisabledExertion(caster, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", caster.name + " actua incapacitado con " + exertion.previousHp + " HP y pierde 1 HP por esfuerzo. HP: " + exertion.currentHp + "/" + caster.hpMax + "."));
    logStatusChange(room, caster, exertion.statusBefore, exertion.statusAfter);
  }
  checkCombatOutcome(room);
  broadcast(room);
}

export function handleResolveAbilityAttack(room: CombatRoom, command: Extract<ClientCommand, { type: "resolve-ability-attack" }>): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  const caster = findCombatant(room, command.casterId);
  const target = findCombatant(room, command.targetId);
  requireCombatantControl(command.actorId, caster);
  ensureActiveTurn(room, caster.id);
  const wasDisabledAtActionStart = lifeStatus(caster) === "disabled";
  const snapshot = createCombatRulesSnapshot(room);
  const availability = Rules.evaluateActionAvailability(snapshot, caster);
  if (!availability.ok) throw new Error(availability.error);
  const action = canStandardAttack(snapshot, caster);
  if (!action.ok) throw new Error(action.error);
  const ability = caster.abilities.find((item) => item.id === command.abilityId);
  if (!ability) throw new Error(caster.name + " no tiene esa habilidad preparada.");
  if (ability.resolution.kind !== "attack-roll") throw new Error(`${ability.name} no se resuelve mediante tirada de ataque.`);
  validateAbilityTarget(caster, target, ability.target);
  validateAbilityRange(room, caster, target, ability.rangeFeet);

  const resolution = ability.resolution;
  const source: ResolvedAttackSource = {
    name: ability.name,
    attackType: resolution.attackType,
    targetAcType: resolution.targetAcType,
    abilityForAttack: resolution.abilityForAttack,
    maxRangeFeet: ability.rangeFeet,
    criticalThreatFrom: resolution.criticalThreatFrom,
    criticalMultiplier: resolution.criticalMultiplier,
    defaultDamage: Math.max(1, Math.floor(averageDiceDamage(resolution.damageExpression)))
  };
  const tactical = getAttackContextModifiers(snapshot, caster, target).byAttackType[resolution.attackType];
  const result = resolveAttack(snapshot, caster, target, command.d20Roll, command.damage, ability.name, tactical.attackBonus, { source });
  result.attackParts.push(...tactical.labelParts);
  const distance = attackRangeFeet(snapshot, caster, target);
  room.currentTurn.usedStandardAction = true;

  if (result.threatened) {
    room.activeAttackThreat = {
      attackerId: caster.id,
      targetId: target.id,
      initialD20Roll: command.d20Roll,
      attackBonusTotal: result.attackBonusTotal ?? 0,
      targetArmorClass: result.targetArmorClass ?? 10,
      normalDamageBundle: result.damageBundle,
      criticalThreatFrom: result.threatFrom ?? 20,
      criticalMultiplier: result.multiplier ?? 2,
      weaponName: result.weaponName ?? ability.name,
      isFullAttack: false,
      label: ability.name
    };
    room.log.unshift(makeLog("status", `${caster.name} amenaza con un crÃ­tico contra ${target.name} usando ${ability.name}. Esperando confirmaciÃ³n...`));
  } else {
    applyAttackMutations(room, caster, target, command.d20Roll, distance, ability.name, result);
  }

  const exertion = applyDisabledExertion(caster, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
  if (exertion.applied) {
    room.log.unshift(makeLog("status", caster.name + " actua incapacitado con " + exertion.previousHp + " HP y pierde 1 HP por esfuerzo. HP: " + exertion.currentHp + "/" + caster.hpMax + "."));
    logStatusChange(room, caster, exertion.statusBefore, exertion.statusAfter);
  }
  checkCombatOutcome(room);
  syncEncounterPhase(room);
  broadcast(room);
}

export function handleRollStabilization(room: CombatRoom, command: Extract<ClientCommand, { type: "roll-stabilization" }>): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  const combatant = findCombatant(room, command.combatantId);
  requireCombatantControl(command.actorId, combatant);
  ensureActiveTurn(room, combatant.id);
  if (lifeStatus(combatant) !== "dying") throw new Error(combatant.name + " no necesita tirada de estabilizacion ahora.");
  if (room.currentTurn.usedStabilization) throw new Error(combatant.name + " ya intento estabilizarse este turno.");
  room.currentTurn.usedStabilization = true;
  if (command.d100Roll <= 10) {
    const before = lifeStatus(combatant);
    combatant.isStable = true;
    room.log.unshift(makeLog("status", combatant.name + " supera la tirada de estabilizacion (" + command.d100Roll + ") y queda estable."));
    logStatusChange(room, combatant, before, lifeStatus(combatant));
  } else {
    const result = applyDamage(combatant, 1);
    room.log.unshift(makeLog("damage", combatant.name + " falla la tirada de estabilizacion (" + command.d100Roll + ") y pierde 1 HP. HP restante: " + combatant.hpCurrent + "/" + combatant.hpMax + "."));
    logStatusChange(room, combatant, result.statusBefore, result.statusAfter);
    checkCombatOutcome(room);
  }
  room.currentTurn.usedStandardAction = true;
  broadcast(room);
}

export interface CastSpellExecutionOptions {
  readonly diceRoller?: (sides: number) => number;
}

export function handleCastSpell(
  room: CombatRoom,
  command: Extract<ClientCommand, { type: "cast-spell" }>,
  options: CastSpellExecutionOptions = {}
): void {
  if (room.phase !== "active") throw new Error("Esta accion solo esta disponible con el combate en curso.");
  const caster = findCombatant(room, command.casterId);
  requireCombatantControl(command.actorId, caster);
  ensureActiveTurn(room, caster.id);
  const wasDisabledAtActionStart = lifeStatus(caster) === "disabled";

  const snapshot = createCombatRulesSnapshot(room);
  const availability = Rules.evaluateActionAvailability(snapshot, caster);
  if (!availability.ok) throw new Error(availability.error);
  const action = canStandardAttack(snapshot, caster);
  if (!action.ok) throw new Error(action.error);

  const slotIndex = caster.preparedSpells.findIndex((preparedSlot) => preparedSlot.slotId === command.slotId);
  if (slotIndex === -1) throw new Error(caster.name + " no tiene el slot de conjuro solicitado.");
  const slot = caster.preparedSpells[slotIndex];
  if (slot.isExpended) throw new Error("El slot de conjuro solicitado ya ha sido consumido.");

  const spell = SpellsCatalog.require(slot.spellId);
  const resolution = spell.resolution;

  if (spell.target !== "area") {
    if (!command.targetId) throw new Error("Se requiere un objetivo.");
    const target = findCombatant(room, command.targetId);
    validateAbilityTarget(caster, target, spell.target);
    validateAbilityRange(room, caster, target, spell.rangeFeet);
  }

  if (resolution.kind === "attack-roll" && command.d20Roll === null) {
    throw new Error("El conjuro " + spell.name + " requiere una tirada de ataque (d20Roll).");
  }

  const draft = structuredClone(room) as CombatRoom;

  if (Rules.actionProvokesOpportunityAttack(snapshot, caster, "cast-spell")) {
    const enemies = snapshot.combatants.filter(e => 
      e.id !== caster.id && 
      e.type !== caster.type && 
      lifeStatus(e) === "active" && 
      threatensTarget(snapshot, e, caster) && 
      Rules.canMakeOpportunityAttack(snapshot, e, caster.id)
    );
    if (enemies.length > 0) {
      room.pendingOpportunityAttacks.push(...enemies.map(e => ({
        id: crypto.randomUUID(),
        attackerId: e.id,
        targetId: caster.id,
        attackerPosition: e.position,
        origin: caster.position,
        destination: caster.position,
        reason: `${caster.name} provoca por conjuro.`,
        createdAt: new Date().toISOString()
      })));
      room.log.unshift(makeLog("attack", `${caster.name} provoca ${enemies.length} Ataques de Oportunidad al lanzar un conjuro.`));
      syncEncounterPhase(room);
      broadcast(room);
      return;
    }
  }

  const draftCaster = findCombatant(draft, caster.id);
  const diceRoller = options.diceRoller ?? rollDice;

  const abilityAdapter: Ability = {
    id: spell.id,
    name: spell.name,
    description: "Conjuro de nivel " + spell.level,
    actionType: spell.castingTime.kind === "swift" ? "swift" : "standard",
    rangeFeet: spell.rangeFeet,
    target: spell.target,
    resolution: spell.resolution
  };

  const dcBreakdown = Rules.calculateSpellSaveDCBreakdown(snapshot, caster, spell.id);
  
  if (spell.target === "area" && spell.aoe) {
    if (!command.direction && !command.targetPosition) throw new Error("Se requiere direccion o posicion objetivo para area de efecto.");
    
    // Obtenemos las celdas del area
    const origin = command.targetPosition ?? draftCaster.position;
    const aoeCells = getCellsIntersectedByAoE(origin, command.direction ?? "N", spell.aoe, room.board.cellSizeFeet);
    
    // Identificamos afectados
    const aoeCellKeys = new Set(aoeCells.map(footprintCellKey));

    const affectedCombatants: Combatant[] = draft.combatants.filter((c) => {
      if (lifeStatus(c) === "dead") return false;
      const occupied = getCombatantOccupiedCells(c, snapshot);
      return occupied.some(occ => aoeCellKeys.has(footprintCellKey(occ)));
    });

    draft.log.unshift(makeLog("status", draftCaster.name + " lanza " + spell.name + " (DC " + dcBreakdown.total + ") atrapando a " + affectedCombatants.length + " objetivo(s)."));

    if (resolution.kind === "automatic-damage") {
       const baseDamage = Math.max(0, command.amount ?? Math.floor(averageDiceDamage(resolution.damageExpression)));
       for (const draftTarget of affectedCombatants) {
          const targetSnapshot = snapshot.combatants.find(c => c.id === draftTarget.id)!;
          const savingThrow = resolveSpellSavingThrow(snapshot, caster, targetSnapshot, spell, diceRoller);
          const bundle = makeDamageBundle([{
             sourceId: spell.id,
             label: spell.name,
             category: "energy",
             amount: baseDamage,
             diceExpression: resolution.damageExpression,
             neverMultiply: true
          }]);
          const damageAfterSave = savingThrow
             ? applySpellSaveToDamageBundle(bundle, savingThrow.saveEffect, savingThrow.success).total
             : baseDamage;
          
          if (savingThrow) {
             const naturalLabel = savingThrow.isNatural1 ? "fallo automático por 1 natural" : savingThrow.isNatural20 ? "éxito automático por 20 natural" : savingThrow.success ? "éxito" : "fallo";
             draft.log.unshift(makeLog("system", draftTarget.name + " realiza salvación de " + savingThrow.saveType + ": " + naturalLabel + "."));
          }
          resolveAbility(draft, draftCaster, draftTarget, abilityAdapter, damageAfterSave);
       }
    }
  } else {
    // Normal single-target resolution
    const target = findCombatant(room, command.targetId!);
    const draftTarget = findCombatant(draft, target.id);
    let savingThrow: SpellSavingThrowResult | null = null;
    let damageBeforeSave = 0;
    let damageAfterSave = 0;
    let effectApplied = false;
    
    if (resolution.kind === "attack-roll") {
      const source: ResolvedAttackSource = {
        name: spell.name,
        attackType: resolution.attackType,
        targetAcType: resolution.targetAcType,
        abilityForAttack: resolution.abilityForAttack,
        maxRangeFeet: spell.rangeFeet,
        criticalThreatFrom: resolution.criticalThreatFrom,
        criticalMultiplier: resolution.criticalMultiplier,
        defaultDamage: Math.max(1, Math.floor(averageDiceDamage(resolution.damageExpression)))
      };
      const tactical = getAttackContextModifiers(snapshot, caster, target).byAttackType[resolution.attackType];
      const result = resolveAttack(snapshot, caster, target, command.d20Roll!, command.amount, spell.name, tactical.attackBonus, { source });
      result.attackParts.push(...tactical.labelParts);
      const distance = attackRangeFeet(snapshot, caster, target);

      if (result.hits) {
        savingThrow = resolveSpellSavingThrow(snapshot, caster, target, spell, diceRoller);
        damageBeforeSave = result.damage;
        if (savingThrow) {
          result.damageBundle = applySpellSaveToDamageBundle(result.damageBundle, savingThrow.saveEffect, savingThrow.success);
          result.damage = result.damageBundle.total;
        }
        damageAfterSave = result.damage;
      }

      if (result.threatened) {
        draft.activeAttackThreat = {
          attackerId: draftCaster.id,
          targetId: draftTarget.id,
          initialD20Roll: command.d20Roll!,
          attackBonusTotal: result.attackBonusTotal ?? 0,
          targetArmorClass: result.targetArmorClass ?? 10,
          normalDamageBundle: result.damageBundle,
          criticalThreatFrom: result.threatFrom ?? 20,
          criticalMultiplier: result.multiplier ?? 2,
          weaponName: result.weaponName ?? spell.name,
          isFullAttack: false,
          label: spell.name
        };
        draft.log.unshift(makeLog("status", draftCaster.name + " amenaza con un crítico contra " + draftTarget.name + " usando " + spell.name + ". Esperando confirmación..."));
      } else {
        applyAttackMutations(draft, draftCaster, draftTarget, command.d20Roll!, distance, spell.name, result);
      }
    } else {
      if (resolution.kind === "automatic-damage") {
        damageBeforeSave = Math.max(0, command.amount ?? Math.floor(averageDiceDamage(resolution.damageExpression)));
        savingThrow = resolveSpellSavingThrow(snapshot, caster, target, spell, diceRoller);
        const bundle = makeDamageBundle([{
          sourceId: spell.id,
          label: spell.name,
          category: "energy",
          amount: damageBeforeSave,
          diceExpression: resolution.damageExpression,
          neverMultiply: true
        }]);
        damageAfterSave = savingThrow
          ? applySpellSaveToDamageBundle(bundle, savingThrow.saveEffect, savingThrow.success).total
          : damageBeforeSave;
        resolveAbility(draft, draftCaster, draftTarget, abilityAdapter, damageAfterSave);
      } else if (resolution.kind === "effect") {
        savingThrow = resolveSpellSavingThrow(snapshot, caster, target, spell, diceRoller);
        const negated = savingThrow?.success === true && savingThrow.saveEffect === "negates";
        if (!negated) {
          resolveAbility(draft, draftCaster, draftTarget, abilityAdapter, command.amount);
          effectApplied = true;
        }
      } else {
        resolveAbility(draft, draftCaster, draftTarget, abilityAdapter, command.amount);
      }
    }
    
    draft.log.unshift(makeLog("status", draftCaster.name + " lanza " + spell.name + " (DC " + dcBreakdown.total + ", Escuela: " + spell.school + ") contra " + draftTarget.name + "."));
    if (savingThrow) {
      const naturalLabel = savingThrow.isNatural1
        ? "fallo automático por 1 natural"
        : savingThrow.isNatural20
          ? "éxito automático por 20 natural"
          : savingThrow.success ? "éxito" : "fallo";
      const consequence = savingThrow.saveEffect === "half"
        ? "daño " + damageBeforeSave + " → " + damageAfterSave
        : savingThrow.saveEffect === "negates"
          ? (effectApplied ? "efecto aplicado" : "efecto negado")
          : "sin mitigación";
      draft.log.unshift(makeLog(
        "system",
        draftTarget.name + " realiza salvación de " + savingThrow.saveType + ": d20 " + savingThrow.d20Roll + " + " + savingThrow.modifier + " = " + savingThrow.total + " contra CD " + savingThrow.dc + "; " + naturalLabel + ". " + consequence + "."
      ));
    }
  }

  draftCaster.preparedSpells = draftCaster.preparedSpells.map((preparedSlot) =>
    preparedSlot.slotId === slot.slotId ? { ...preparedSlot, isExpended: true } : preparedSlot
  );
  draft.currentTurn.usedStandardAction = true;

  const exertion = applyDisabledExertion(draftCaster, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
  if (exertion.applied) {
    draft.log.unshift(makeLog("status", draftCaster.name + " actua incapacitado con " + exertion.previousHp + " HP y pierde 1 HP por esfuerzo. HP: " + exertion.currentHp + "/" + draftCaster.hpMax + "."));
    logStatusChange(draft, draftCaster, exertion.statusBefore, exertion.statusAfter);
  }

  checkCombatOutcome(draft);
  syncEncounterPhase(draft);
  commitCombatRoomTransaction(room, draft);
  broadcast(room);
}
