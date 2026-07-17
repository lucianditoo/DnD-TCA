import type { Dispatch, SetStateAction } from "react";
import { averageWeaponDamageForCombatant, type Combatant } from "@dnd-tactical/shared";
import { rollWeaponDamage } from "../viewModel";

export function useCombatActions({ autoD20, d20Roll, setD20Roll, autoDamage, damage, setDamage }: { autoD20: boolean; d20Roll: string; setD20Roll: Dispatch<SetStateAction<string>>; autoDamage: boolean; damage: string; setDamage: Dispatch<SetStateAction<string>> }) {
  function getD20Roll(): number {
    if (!autoD20) return Number(d20Roll);
    const roll = Math.floor(Math.random() * 20) + 1;
    setD20Roll(String(roll));
    return roll;
  }

  function getDamageRoll(combatant: Combatant): number {
    if (!autoDamage) return Number(damage || averageWeaponDamageForCombatant(combatant));
    const roll = rollWeaponDamage(combatant);
    setDamage(String(roll));
    return roll;
  }

  return { getD20Roll, getDamageRoll };
}
