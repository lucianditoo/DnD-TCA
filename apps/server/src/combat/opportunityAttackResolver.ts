import { Rules, getOpportunityAttackLegality, lifeStatus, resolveEquippedWeaponProfile, threatensTarget, type CombatRoom, type CombatRulesSnapshot, type Combatant, type ProductionEffectId } from "@dnd-tactical/shared";

import { syncEncounterPhase } from "../room/roomState.js";

export function findTriggeredRangedOpportunityAttacks(context: CombatRulesSnapshot<ProductionEffectId>, attacker: Combatant, attackDistanceFeet: number) {
  const weapon = resolveEquippedWeaponProfile(attacker).profile;
  if (weapon.handedness !== "ranged" && weapon.handedness !== "thrown") return [];
  if (weapon.handedness === "thrown" && attackDistanceFeet <= weapon.meleeReachFeet) return [];
  if (lifeStatus(attacker) !== "active" && lifeStatus(attacker) !== "disabled") return [];
  return context.combatants
    .filter((other) => other.id !== attacker.id && lifeStatus(other) === "active" && Rules.canMakeOpportunityAttack(context, other, attacker.id) && threatensTarget(context, other, attacker))
    // Sprint 055B (NDD §14.5/§14.7): Line of Effect/Cover/Ocultación Total pueden impedir que este
    // reactor concreto ejecute el AdO, sin duplicar el cálculo de amenaza ya resuelto arriba.
    .filter((other) => getOpportunityAttackLegality(context, other, attacker).allowed)
    .map((other) => ({
      id: "aoo-" + Math.random().toString(36).slice(2, 10),
      attackerId: other.id,
      targetId: attacker.id,
      attackerPosition: { ...other.position },
      origin: { ...attacker.position },
      destination: { ...attacker.position },
      reason: attacker.name + " usa un ataque a distancia estando amenazado por " + other.name + ".",
      createdAt: new Date().toISOString()
    }));
}

export function pruneInvalidOpportunityAttacks(room: CombatRoom): void {
  room.pendingOpportunityAttacks = room.pendingOpportunityAttacks.filter((opportunity) => {
    const attacker = room.combatants.find((combatant) => combatant.id === opportunity.attackerId);
    const target = room.combatants.find((combatant) => combatant.id === opportunity.targetId);
    return !!attacker && !!target && lifeStatus(attacker) === "active" && lifeStatus(target) !== "dead";
  });
  syncEncounterPhase(room);
}
