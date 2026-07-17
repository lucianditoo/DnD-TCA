import { applyDamage, applyHealing, cryptoId, EffectManager, isProductionEffectId, lifeStatus, makeLog, type Ability, type CombatRoom, type Combatant } from "@dnd-tactical/shared";
import { logStatusChange, movementDistanceFeet } from "../room/roomState.js";

export function validateAbilityTarget(caster: Combatant, target: Combatant, targetType: string): void {
  if (lifeStatus(target) === "dead" && targetType !== "ally") throw new Error(target.name + " ya esta muerto.");
  if (targetType === "ally" && caster.type !== target.type) throw new Error("La habilidad requiere un aliado como objetivo.");
  if (targetType === "enemy" && caster.type === target.type) throw new Error("La habilidad requiere un enemigo como objetivo.");
}

export function validateAbilityRange(room: CombatRoom, caster: Combatant, target: Combatant, rangeFeet: number): void {
  const distance = movementDistanceFeet(caster.position, target.position, room.board.cellSizeFeet);
  if (distance > rangeFeet) throw new Error(target.name + " esta a " + distance + " ft, fuera del alcance de la habilidad (" + rangeFeet + " ft).");
}

export function resolveAbility(room: CombatRoom, caster: Combatant, target: Combatant, ability: Ability, amount: number | null): void {
  if (ability.resolution.kind === "attack-roll") throw new Error(`${ability.name} requiere una tirada de ataque autoritativa.`);
  if (ability.resolution.kind === "healing") {
    const result = applyHealing(target, amount ?? 0);
    target.stats.healingReceived += result.appliedHealing;
    room.log.unshift(makeLog("status", caster.name + " usa Cure Light Wounds sobre " + target.name + " y cura " + result.appliedHealing + " HP. HP: " + target.hpCurrent + "/" + target.hpMax + "."));
    logStatusChange(room, target, result.statusBefore, result.statusAfter);
    return;
  }
  if (ability.resolution.kind === "effect" && (ability.resolution.effectId === "haste" || ability.resolution.effectId === "srd_haste")) {
    target.buffs.push({ id: "buff-" + Math.random().toString(36).slice(2, 10), name: "Haste", source: caster.name, attackBonus: 1, speedBonusFeet: 10, remainingTurns: 5 });
    room.log.unshift(makeLog("status", caster.name + " usa Haste sobre " + target.name + ". +1 ataque y +10 ft velocidad por 5 turnos."));
    return;
  }
  if (ability.resolution.kind === "effect") {
    if (!isProductionEffectId(ability.resolution.effectId)) {
      throw new Error(`Efecto de habilidad desconocido: ${ability.resolution.effectId}.`);
    }
    Object.assign(room, EffectManager.add(room, {
      instanceId: cryptoId("effect"),
      effectId: ability.resolution.effectId,
      source: { type: "creature", id: caster.id },
      targets: [target.id],
      appliedAtEvent: { type: "ActionResolved", combatantId: caster.id, round: room.round },
      duration: { type: "until_dispelled" }
    }));
    room.log.unshift(makeLog("status", `${caster.name} aplica ${ability.name} sobre ${target.name}.`));
    return;
  }
  if (ability.resolution.kind === "automatic-damage") {
    const damage = Math.max(0, amount ?? 0);
    const result = applyDamage(target, damage);
    const appliedDamage = Math.max(0, result.hpBefore - result.hpAfter);
    caster.stats.damageDealt += appliedDamage;
    target.stats.damageTaken += appliedDamage;
    if (result.statusBefore === "active" && result.statusAfter !== "active") target.stats.timesDroppedToZero += 1;
    if (result.statusBefore !== "dead" && result.statusAfter === "dead") caster.stats.kills += 1;
    room.log.unshift(makeLog("damage", caster.name + " usa " + ability.name + " contra " + target.name + " por " + appliedDamage + " puntos de daño. HP restante: " + target.hpCurrent + "/" + target.hpMax + "."));
    logStatusChange(room, target, result.statusBefore, result.statusAfter);
    return;
  }
  throw new Error(`La resolución de ${ability.name} no está implementada.`);
}
