import { normalizeLifeStateAfterHpChange, type Combatant, type LifeStatus } from "@dnd-tactical/shared";

export function applyGMStatus(combatant: Combatant, status: LifeStatus): void {
  if (status === "active") {
    combatant.hpCurrent = Math.max(1, combatant.hpCurrent, Math.min(1, combatant.hpMax));
    combatant.isStable = false;
  } else if (status === "disabled") {
    combatant.hpCurrent = 0;
    combatant.isStable = false;
  } else if (status === "dying") {
    combatant.hpCurrent = combatant.hpCurrent < 0 && combatant.hpCurrent > -10 ? combatant.hpCurrent : -1;
    combatant.isStable = false;
  } else if (status === "stable") {
    combatant.hpCurrent = combatant.hpCurrent < 0 && combatant.hpCurrent > -10 ? combatant.hpCurrent : -1;
    combatant.isStable = true;
  } else {
    combatant.hpCurrent = -10;
    combatant.isStable = false;
  }
  normalizeLifeStateAfterHpChange(combatant);
}
