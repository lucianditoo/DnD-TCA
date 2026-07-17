export * from "./types.js";
export * from "./weapons.simple.js";
export * from "./weapons.martial.js";
export * from "./weapons.exotic.js";
export * from "./armors.js";
export * from "./shields.js";

import { simpleWeapons } from "./weapons.simple.js";
import { martialWeapons } from "./weapons.martial.js";
import { exoticWeapons } from "./weapons.exotic.js";
import { armors } from "./armors.js";
import { shields } from "./shields.js";

export const weapons = [...simpleWeapons, ...martialWeapons, ...exoticWeapons];
export const equipmentCatalog = {
  weapons,
  simpleWeapons,
  martialWeapons,
  exoticWeapons,
  armors,
  shields,
} as const;
