import type { CombatRoom, CombatantSnapshot } from "../types.js";
import type { CombatEvent } from "../events/types.js";
import { getLifeStateProjection, makeLog, normalizeLifeStateAfterHpChange } from "../rules.js";

export function roundTickListener(room: CombatRoom, event: CombatEvent): CombatRoom {
  if (event.type !== "RoundStarted") {
    return room;
  }

  let hasMutations = false;
  const newCombatants = room.combatants.map((c) => {
    let mutated = false;
    let nextC = { ...c };
    
    // 1. Reset de Reacciones
    const hasAoOs = (nextC.stats.opportunityAttacksThisRound ?? 0) !== 0;
    const hasAoOTargets = nextC.stats.targetsAttackedThisRoundViaAoO && nextC.stats.targetsAttackedThisRoundViaAoO.length > 0;
    
    if (hasAoOs || hasAoOTargets) {
      nextC.stats = { 
        ...nextC.stats, 
        opportunityAttacksThisRound: 0,
        targetsAttackedThisRoundViaAoO: [] 
      };
      mutated = true;
    }

    // 2. Desangrado Pasivo Automático (COND-02)
    if (getLifeStateProjection(nextC).bleedsAtRoundStart) {
      nextC.hpCurrent -= 1;
      normalizeLifeStateAfterHpChange(nextC);
      mutated = true;
    }

    if (mutated) {
      hasMutations = true;
      return nextC as CombatantSnapshot;
    }
    return c;
  });

  if (!hasMutations) return room;

  // Evaluar muertes e inyectar logs
  const nextRoom = { ...room, combatants: newCombatants, log: [...room.log] };
  for (let i = 0; i < nextRoom.combatants.length; i++) {
    const c = nextRoom.combatants[i];
    const oldC = room.combatants[i];
    
    if (c.hpCurrent <= -10 && oldC.hpCurrent > -10) {
      nextRoom.log.unshift(makeLog("status", `${c.name} se ha desangrado y ha muerto.`));
    } else if (c.hpCurrent < oldC.hpCurrent && c.hpCurrent <= -1 && !c.isStable) {
      nextRoom.log.unshift(makeLog("status", `${c.name} está sangrando. HP actual: ${c.hpCurrent}.`));
    }
  }

  return nextRoom;
}
