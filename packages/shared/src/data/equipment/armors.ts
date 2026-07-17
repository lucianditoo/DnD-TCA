import { cost } from "./helpers.js";
import type { ArmorEntry } from "./types.js";

export const armors: ArmorEntry[] = [
  { id: "padded", name: "Acolchada", category: "light", cost: cost(5, "gp", "5 po"), armorBonus: 1, maxDexBonus: 8, armorCheckPenalty: 0, arcaneSpellFailurePercent: 5, speed30Ft: 30, speed20Ft: 20, weightLb: 10 },
  { id: "leather", name: "Cuero", category: "light", cost: cost(10, "gp", "10 po"), armorBonus: 2, maxDexBonus: 6, armorCheckPenalty: 0, arcaneSpellFailurePercent: 10, speed30Ft: 30, speed20Ft: 20, weightLb: 15 },
  { id: "studded_leather", name: "Cuero tachonado", category: "light", cost: cost(25, "gp", "25 po"), armorBonus: 3, maxDexBonus: 5, armorCheckPenalty: -1, arcaneSpellFailurePercent: 15, speed30Ft: 30, speed20Ft: 20, weightLb: 20 },
  { id: "chain_shirt", name: "Camisote de mallas", category: "light", cost: cost(100, "gp", "100 po"), armorBonus: 4, maxDexBonus: 4, armorCheckPenalty: -2, arcaneSpellFailurePercent: 20, speed30Ft: 30, speed20Ft: 20, weightLb: 25 },
  { id: "hide", name: "Pieles", category: "medium", cost: cost(15, "gp", "15 po"), armorBonus: 3, maxDexBonus: 4, armorCheckPenalty: -3, arcaneSpellFailurePercent: 20, speed30Ft: 20, speed20Ft: 15, weightLb: 25 },
  { id: "scale_mail", name: "Cota de escamas", category: "medium", cost: cost(50, "gp", "50 po"), armorBonus: 4, maxDexBonus: 3, armorCheckPenalty: -4, arcaneSpellFailurePercent: 25, speed30Ft: 20, speed20Ft: 15, weightLb: 30 },
  { id: "chainmail", name: "Cota de mallas", category: "medium", cost: cost(150, "gp", "150 po"), armorBonus: 5, maxDexBonus: 2, armorCheckPenalty: -5, arcaneSpellFailurePercent: 30, speed30Ft: 20, speed20Ft: 15, weightLb: 40 },
  { id: "breastplate", name: "Coraza", category: "medium", cost: cost(200, "gp", "200 po"), armorBonus: 5, maxDexBonus: 3, armorCheckPenalty: -4, arcaneSpellFailurePercent: 25, speed30Ft: 20, speed20Ft: 15, weightLb: 30 },
  { id: "splint_mail", name: "Armadura laminada", category: "heavy", cost: cost(200, "gp", "200 po"), armorBonus: 6, maxDexBonus: 0, armorCheckPenalty: -7, arcaneSpellFailurePercent: 40, speed30Ft: 20, speed20Ft: 15, weightLb: 45, notes: ["Al correr con armadura pesada, el desplazamiento es triple, no cuádruple."] },
  { id: "banded_mail", name: "Cota de bandas", category: "heavy", cost: cost(250, "gp", "250 po"), armorBonus: 6, maxDexBonus: 1, armorCheckPenalty: -6, arcaneSpellFailurePercent: 35, speed30Ft: 20, speed20Ft: 15, weightLb: 35, notes: ["Al correr con armadura pesada, el desplazamiento es triple, no cuádruple."] },
  { id: "half_plate", name: "Armadura de placas y mallas", category: "heavy", cost: cost(600, "gp", "600 po"), armorBonus: 7, maxDexBonus: 0, armorCheckPenalty: -7, arcaneSpellFailurePercent: 40, speed30Ft: 20, speed20Ft: 15, weightLb: 50, notes: ["Al correr con armadura pesada, el desplazamiento es triple, no cuádruple."] },
  { id: "full_plate", name: "Armadura completa", category: "heavy", cost: cost(1500, "gp", "1.500 po"), armorBonus: 8, maxDexBonus: 1, armorCheckPenalty: -6, arcaneSpellFailurePercent: 35, speed30Ft: 20, speed20Ft: 15, weightLb: 50, notes: ["Al correr con armadura pesada, el desplazamiento es triple, no cuádruple."] },
];
