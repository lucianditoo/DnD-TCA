import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Rules,
  createEmptyRoom,
  getAttackLineInterception,
  threatensTarget
} from "../packages/shared/dist/index.js";
import { inventoryEquipment } from "./test-utils.mjs";

function setupRoom() {
  const room = createEmptyRoom("COVER_REACH");
  const hero = {
    id: "hero-1",
    name: "hero-1",
    type: "player",
    hpCurrent: 10,
    hpMax: 10,
    isStable: false,
    position: { x: 0, y: 0, zFeet: 0 },
    ...inventoryEquipment(null, { armorCatalogId: "leather" }),
    baseAttackBonus: 1, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium",
    creatureTypeId: "humanoid",
    featureIds: [],
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
    buffs: [],
    ruleTraits: []
  };

  const ally = { ...hero, id: "ally-1", name: "ally-1" };
  const enemy = { ...hero, id: "enemy-1", name: "enemy-1", type: "monster" };

  room.combatants = [hero, ally, enemy];
  return { room, hero, ally, enemy };
}

test("Alcance (Longspear Reach) asegura amenaza a 10 ft pero no a 5 ft", () => {
  const { room, hero, enemy } = setupRoom();
  
  // Equip longspear (reach weapon for medium size: minReach: 5, maxReach: 10)
  Object.assign(hero, inventoryEquipment("longspear", { armorCatalogId: "leather" }));
  
  // Enemy at 5 ft (adjacent)
  hero.position = { x: 0, y: 0, zFeet: 0 };
  enemy.position = { x: 1, y: 0, zFeet: 0 }; // distance = 5
  
  assert.equal(threatensTarget(room, hero, enemy), false, "Longspear no debe amenazar a 5 pies");

  // Enemy at 10 ft
  enemy.position = { x: 2, y: 0, zFeet: 0 }; // distance = 10
  assert.equal(threatensTarget(room, hero, enemy), true, "Longspear debe amenazar a 10 pies");
});

test("Cobertura Viva para asegurar el bono de +4", () => {
  const { room, hero, ally, enemy } = setupRoom();

  // hero at (0,0), ally at (1,0), enemy at (2,0)
  hero.position = { x: 0, y: 0, zFeet: 0 };
  ally.position = { x: 1, y: 0, zFeet: 0 };
  enemy.position = { x: 2, y: 0, zFeet: 0 };
  
  // Interception check
  const interception = getAttackLineInterception(room, hero, enemy);
  assert.equal(interception.hasObstacleInterception, true, "Debe haber intercepcion por el aliado");
  assert.deepEqual(interception.blockerIds, [ally.id]);

  // AC calculation check
  const acWithoutCover = Rules.totalArmorClass(room, enemy, { attackType: "ranged" });
  const acWithCover = Rules.totalArmorClass(room, enemy, { attackType: "ranged", hasObstacleInterception: true });

  assert.equal(acWithCover.total, acWithoutCover.total + 4, "La cobertura debe dar +4 a la CA");
  assert.ok(acWithCover.parts.some(p => p.includes("cobertura +4")), "Debe incluir 'cobertura +4' en las partes");
});
