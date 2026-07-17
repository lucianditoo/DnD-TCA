import type { CombatRoom } from "@dnd-tactical/shared";

export function cloneCombatRoom(room: CombatRoom): CombatRoom {
  return structuredClone(room);
}

export function commitCombatRoomTransaction(room: CombatRoom, draft: CombatRoom): void {
  const liveCombatants = new Map(room.combatants.map((combatant) => [combatant.id, combatant]));
  const committedCombatants = draft.combatants.map((draftCombatant) => {
    const liveCombatant = liveCombatants.get(draftCombatant.id);
    if (!liveCombatant) return draftCombatant;
    Object.assign(liveCombatant, draftCombatant);
    return liveCombatant;
  });
  Object.assign(room, draft, { combatants: committedCombatants });
}
