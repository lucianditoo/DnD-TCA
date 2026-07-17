import type { Combatant, LifeStatus } from "@dnd-tactical/shared";
import { lifeStatus, applyDamage } from "@dnd-tactical/shared";

export interface ExertionOptions {
  wasDisabledAtActionStart: boolean;
  actionKind: "standard" | "move" | "full-round";
  actionWasExerting: boolean;
}

export interface ExertionResult {
  applied: boolean;
  previousHp: number;
  currentHp: number;
  statusBefore: LifeStatus;
  statusAfter: LifeStatus;
}

export function applyDisabledExertion(
  combatant: Combatant,
  options: ExertionOptions
): ExertionResult {
  const previousHp = combatant.hpCurrent;
  const statusBefore = lifeStatus(combatant);

  const shouldApply =
    options.wasDisabledAtActionStart &&
    options.actionKind === "standard" &&
    options.actionWasExerting &&
    combatant.hpCurrent <= 0;

  if (shouldApply) {
    const damageResult = applyDamage(combatant, 1);
    return {
      applied: true,
      previousHp: damageResult.hpBefore,
      currentHp: damageResult.hpAfter,
      statusBefore: damageResult.statusBefore,
      statusAfter: damageResult.statusAfter,
    };
  }

  return {
    applied: false,
    previousHp,
    currentHp: previousHp,
    statusBefore,
    statusAfter: statusBefore,
  };
}
