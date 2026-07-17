import { makeLog, type ArmorClassBonusType, type CombatRoom, type Combatant } from "@dnd-tactical/shared";

export function applyStartOfNextTurnBuff(combatant: Combatant, buff: { name: string; source: string; acBonus?: number; acBonusType?: ArmorClassBonusType; attackBonus?: number; speedBonusFeet?: number; preventsOpportunityAttacks?: boolean }): void {
  combatant.buffs = combatant.buffs.filter((item) => item.name !== buff.name || item.expiresAtStartOfTurnOf !== combatant.id);
  combatant.buffs.push({
    id: "buff-" + Math.random().toString(36).slice(2, 10),
    name: buff.name,
    source: buff.source,
    acBonus: buff.acBonus,
    acBonusType: buff.acBonusType,
    attackBonus: buff.attackBonus,
    speedBonusFeet: buff.speedBonusFeet,
    preventsOpportunityAttacks: buff.preventsOpportunityAttacks,
    remainingTurns: 1,
    expiresAtStartOfTurnOf: combatant.id
  });
}

export function expireStartOfTurnBuffs(room: CombatRoom, combatant: Combatant): void {
  const expiring = combatant.buffs.filter((buff) => buff.expiresAtStartOfTurnOf === combatant.id);
  if (expiring.length === 0) return;
  combatant.buffs = combatant.buffs.filter((buff) => buff.expiresAtStartOfTurnOf !== combatant.id);
  room.log.unshift(makeLog("status", combatant.name + " pierde " + expiring.map((buff) => buff.name).join(", ") + " al iniciar su turno."));
}

export function expireEndOfTurnBuffs(room: CombatRoom, combatant: Combatant): void {
  const expiring = combatant.buffs.filter((buff) => buff.expiresAfterTurnOf === combatant.id);
  if (expiring.length === 0) return;
  combatant.buffs = combatant.buffs.filter((buff) => buff.expiresAfterTurnOf !== combatant.id);
  room.log.unshift(makeLog("status", combatant.name + " pierde " + expiring.map((buff) => buff.name).join(", ") + " al terminar su turno."));
}
