import type { SizeCategory } from "./types.js";

export interface SizeRule {
  attackAndAcModifier: number;
  grappleModifier: number;
  spaceFeet: number;
  defaultReachFeet: number;
}

export const SizeRulesCatalog: Readonly<Record<SizeCategory, SizeRule>> = {
  fine: { attackAndAcModifier: 8, grappleModifier: -16, spaceFeet: 0.5, defaultReachFeet: 0 },
  diminutive: { attackAndAcModifier: 4, grappleModifier: -12, spaceFeet: 1, defaultReachFeet: 0 },
  tiny: { attackAndAcModifier: 2, grappleModifier: -8, spaceFeet: 2.5, defaultReachFeet: 0 },
  small: { attackAndAcModifier: 1, grappleModifier: -4, spaceFeet: 5, defaultReachFeet: 5 },
  medium: { attackAndAcModifier: 0, grappleModifier: 0, spaceFeet: 5, defaultReachFeet: 5 },
  large: { attackAndAcModifier: -1, grappleModifier: 4, spaceFeet: 10, defaultReachFeet: 10 },
  huge: { attackAndAcModifier: -2, grappleModifier: 8, spaceFeet: 15, defaultReachFeet: 15 },
  gargantuan: { attackAndAcModifier: -4, grappleModifier: 12, spaceFeet: 20, defaultReachFeet: 20 },
  colossal: { attackAndAcModifier: -8, grappleModifier: 16, spaceFeet: 30, defaultReachFeet: 30 }
};

export function getSizeRule(category: SizeCategory): SizeRule {
  const rule = SizeRulesCatalog[category];
  if (!rule) throw new Error(`Categoría de tamaño desconocida: ${String(category)}.`);
  return rule;
}
