import type { Dispatch, SetStateAction } from "react";
import { projectWeaponDamage, type CombatRulesSnapshot, type ProductionEffectId, type Combatant } from "@dnd-tactical/shared";
import { rollWeaponDamage } from "../viewModel";

export function useCombatActions({ snapshot, autoD20, d20Roll, setD20Roll, autoDamage, damage, setDamage }: { snapshot: CombatRulesSnapshot<ProductionEffectId> | null; autoD20: boolean; d20Roll: string; setD20Roll: Dispatch<SetStateAction<string>>; autoDamage: boolean; damage: string; setDamage: Dispatch<SetStateAction<string>> }) {
  function getD20Roll(): number {
    if (!autoD20) return Number(d20Roll);
    const roll = Math.floor(Math.random() * 20) + 1;
    setD20Roll(String(roll));
    return roll;
  }

  function getDamageRoll(combatant: Combatant): number {
    if (!autoDamage && damage) return Number(damage);
    const projection = projectWeaponDamage(snapshot, combatant);
    if (!autoDamage) return projection.average;
    const roll = rollWeaponDamage(projection);
    setDamage(String(roll));
    return roll;
  }

  return { getD20Roll, getDamageRoll };
}
