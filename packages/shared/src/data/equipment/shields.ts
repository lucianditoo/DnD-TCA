import { cost } from "./helpers.js";
import type { ShieldEntry } from "./types.js";

export const shields: ShieldEntry[] = [
  { id: "buckler", name: "Broquel o rodela", category: "shield", cost: cost(15, "gp", "15 po"), shieldBonus: 1, maxDexBonus: null, armorCheckPenalty: -1, arcaneSpellFailurePercent: 5, speed30Ft: null, speed20Ft: null, weightLb: 5 },
  { id: "light_wooden_shield", name: "Escudo ligero de madera", category: "shield", cost: cost(3, "gp", "3 po"), shieldBonus: 1, maxDexBonus: null, armorCheckPenalty: -1, arcaneSpellFailurePercent: 5, speed30Ft: null, speed20Ft: null, weightLb: 5 },
  { id: "light_steel_shield", name: "Escudo ligero de acero", category: "shield", cost: cost(9, "gp", "9 po"), shieldBonus: 1, maxDexBonus: null, armorCheckPenalty: -1, arcaneSpellFailurePercent: 5, speed30Ft: null, speed20Ft: null, weightLb: 6 },
  { id: "heavy_wooden_shield", name: "Escudo pesado de madera", category: "shield", cost: cost(7, "gp", "7 po"), shieldBonus: 2, maxDexBonus: null, armorCheckPenalty: -2, arcaneSpellFailurePercent: 15, speed30Ft: null, speed20Ft: null, weightLb: 10 },
  { id: "heavy_steel_shield", name: "Escudo pesado de acero", category: "shield", cost: cost(20, "gp", "20 po"), shieldBonus: 2, maxDexBonus: null, armorCheckPenalty: -2, arcaneSpellFailurePercent: 15, speed30Ft: null, speed20Ft: null, weightLb: 15 },
  { id: "tower_shield", name: "Escudo pavés", category: "shield", cost: cost(30, "gp", "30 po"), shieldBonus: 4, maxDexBonus: 2, armorCheckPenalty: -10, arcaneSpellFailurePercent: 50, speed30Ft: null, speed20Ft: null, weightLb: 45, notes: ["Concede cobertura; consultar descripción.", "No permite libertad suficiente para lanzar conjuros."] },
  { id: "locked_gauntlet", name: "Guantelete de sujeción", category: "accessory", cost: cost(8, "gp", "8 po"), shieldBonus: null, maxDexBonus: null, armorCheckPenalty: null, arcaneSpellFailurePercent: null, speed30Ft: null, speed20Ft: null, weightLb: 5, notes: ["Penalizador de armadura especial."] },
  { id: "armor_spikes_accessory", name: "Púas para armadura", category: "accessory", cost: cost(50, "gp", "+50 po"), shieldBonus: null, maxDexBonus: null, armorCheckPenalty: null, arcaneSpellFailurePercent: null, speed30Ft: null, speed20Ft: null, weightLb: 10 },
  { id: "shield_spikes_accessory", name: "Púas para escudo", category: "accessory", cost: cost(10, "gp", "+10 po"), shieldBonus: null, maxDexBonus: null, armorCheckPenalty: null, arcaneSpellFailurePercent: null, speed30Ft: null, speed20Ft: null, weightLb: 5 },
];
