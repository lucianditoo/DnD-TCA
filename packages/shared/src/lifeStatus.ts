import type { Combatant, LifeStatus } from "./types.js";
import { FeatCatalog } from "./featCatalog.js";

/**
 * Módulo inferior de estado vital (Sprint D-1B-I3R1).
 * No importa desde `rules.ts` ni desde `routeValidation.ts`: ambos importan desde aquí.
 * Relocalización 1:1 de `LifeStateProjection`/`getLifeStateProjection`/`lifeStatus`, ya
 * existentes en `rules.ts`, para romper el ciclo `rules.ts ↔ routeValidation.ts`. Sin
 * cambio de comportamiento.
 */

export interface LifeStateProjection {
  readonly status: LifeStatus;
  readonly conscious: boolean;
  readonly canAct: boolean;
  readonly usesDisabledActionEconomy: boolean;
  readonly bleedsAtRoundStart: boolean;
  readonly mustBeStable: boolean;
}

export function getLifeStateProjection(combatant: Combatant): LifeStateProjection {
  const lifeRules = FeatCatalog.lifeRules(combatant.featIds ?? []);
  const inNegativeHpRange = combatant.hpCurrent <= -1 && combatant.hpCurrent >= -9;
  const mustBeStable = inNegativeHpRange && lifeRules.autoStabilizeNegativeHp;

  let status: LifeStatus;
  if (combatant.hpCurrent <= -10) status = "dead";
  else if (combatant.hpCurrent < 0 && lifeRules.negativeHpActionState === "disabled") status = "disabled";
  else if (combatant.hpCurrent < 0) status = combatant.isStable ? "stable" : "dying";
  else if (combatant.hpCurrent === 0) status = "disabled";
  else status = "active";

  const conscious = status === "active" || status === "disabled";
  return {
    status,
    conscious,
    canAct: conscious,
    usesDisabledActionEconomy: status === "disabled",
    bleedsAtRoundStart: inNegativeHpRange && !combatant.isStable && lifeRules.bleedsWhileNegative,
    mustBeStable
  };
}

export function lifeStatus(combatant: Combatant): LifeStatus {
  return getLifeStateProjection(combatant).status;
}
