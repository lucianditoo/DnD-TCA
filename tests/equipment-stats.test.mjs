import test from "node:test";
import assert from "node:assert/strict";
import {
  Rules,
  averageWeaponDamageForCombatant,
  createCombatRulesSnapshot,
  createCombatantSnapshotFromProfile,
  createEmptyRoom,
  deriveEquipmentStats,
  readStoredProfiles,
  writeStoredProfiles
} from "../packages/shared/dist/index.js";
import { inventoryEquipment } from "./test-utils.mjs";

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
}

function profile(overrides = {}) {
  return {
    id: "profile-test", name: "Test Hero", type: "player", controller: "player", icon: "T", hpMax: 25,
    baseAttackBonus: 3, baseFortitude: 0, baseReflex: 0, baseWill: 0, baseSpeedFeet: 30,
    abilityScores: { strength: 10, dexterity: 14, constitution: 12, intelligence: 11, wisdom: 13, charisma: 9 },
    sizeCategory: "medium", creatureTypeId: "humanoid", featureIds: [], skillRanks: { escape_artist: 0 }, featIds: [],
    ...inventoryEquipment("dagger", { offHandCatalogId: "buckler" }),
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
    abilities: ["cure-light-wounds", "haste"], buffs: [], position: { x: 0, y: 0, zFeet: 0 },
    updatedAt: "2026-07-07T00:00:00.000Z", ...overrides
  };
}

function snapshotFrom(input = profile()) {
  let nextId = 1;
  return createCombatantSnapshotFromProfile({ ...input, abilities: [] }, {
    controlledBy: { type: "player", participantId: "player-a" },
    idFactory: (prefix) => `${prefix}-${nextId++}`
  });
}

test("persistencia V6 conserva inventario, ranuras, rangos y campos base", () => {
  const storage = memoryStorage();
  const saved = profile({ name: "Persistido", hpMax: 31, ...inventoryEquipment("longsword", { offHandCatalogId: "heavy_steel_shield", armorCatalogId: "chainmail", extraItems: [{ catalogId: "arrows_20", quantity: 20 }] }) });
  writeStoredProfiles(storage, [saved]);
  const [loaded] = readStoredProfiles(storage);
  assert.deepEqual(loaded, saved);
  assert.equal(JSON.parse(storage.data.get("dnd-tactical.profiles.v6")).version, 6);
});

test("estadísticas de equipo se derivan del catálogo sin mutar fuentes", () => {
  const sourced = profile({ ...inventoryEquipment("longsword", { offHandCatalogId: "heavy_steel_shield", armorCatalogId: "chainmail" }) });
  const before = structuredClone(sourced);
  const derived = deriveEquipmentStats(sourced);
  assert.equal(derived.weaponDamage, "1d8");
  assert.equal(derived.weaponCritical, "19-20/x2");
  assert.equal(derived.armorBonus, 5);
  assert.equal(derived.shieldBonus, 2);
  assert.equal(derived.maxDexBonus, 2);
  assert.equal(derived.armorAdjustedSpeedFeet, 20);
  assert.equal(derived.normalArmorClassPreview, 19);
  assert.deepEqual(sourced, before);
  assert.deepEqual(deriveEquipmentStats(sourced), derived);
});

test("cambiar arma recalcula daño, crítico, alcance y tipo", () => {
  const dagger = deriveEquipmentStats(profile({ ...inventoryEquipment("dagger") }));
  const greatsword = deriveEquipmentStats(profile({ ...inventoryEquipment("greatsword") }));
  const longbow = deriveEquipmentStats(profile({ ...inventoryEquipment("longbow", { extraItems: [{ catalogId: "arrows_20", quantity: 20 }] }) }));
  assert.deepEqual([dagger.weaponDamage, dagger.weaponCritical, dagger.weaponRange], ["1d4", "19-20/x2", "10 ft inc."]);
  assert.deepEqual([greatsword.weaponDamage, greatsword.weaponRange], ["2d6", "melee"]);
  assert.deepEqual([longbow.weaponDamage, longbow.weaponCritical, longbow.weaponRange], ["1d8", "x3", "100 ft inc."]);
});

test("velocidad por armadura siempre parte de baseSpeedFeet", () => {
  assert.equal(deriveEquipmentStats(profile({ baseSpeedFeet: 30, ...inventoryEquipment("dagger") })).armorAdjustedSpeedFeet, 30);
  assert.equal(deriveEquipmentStats(profile({ baseSpeedFeet: 30, ...inventoryEquipment("dagger", { armorCatalogId: "chainmail" }) })).armorAdjustedSpeedFeet, 20);
  assert.equal(deriveEquipmentStats(profile({ baseSpeedFeet: 20, ...inventoryEquipment("dagger", { armorCatalogId: "full_plate" }) })).armorAdjustedSpeedFeet, 15);
});

test("snapshot conserva solo fuentes y Rules proyecta los valores dinámicos", () => {
  const combatant = snapshotFrom(profile({ ...inventoryEquipment("greatsword", { armorCatalogId: "chainmail" }) }));
  const room = createEmptyRoom("EQUIP-V5");
  room.combatants = [combatant];
  const snapshot = createCombatRulesSnapshot(room);
  assert.equal("weapon" in combatant, false);
  assert.equal("armorClassBreakdown" in combatant, false);
  assert.equal("threatProfile" in combatant, false);
  assert.equal(averageWeaponDamageForCombatant(combatant), 7);
  assert.equal(Rules.totalArmorClass(snapshot, combatant).total, 17);
  assert.equal(Rules.totalSpeedFeet(snapshot, combatant), 20);
});

test("snapshot separa estado temporal y copia defensivamente las fuentes", () => {
  const permanent = profile({ hpMax: 31, ...inventoryEquipment("dagger", { extraItems: [{ catalogId: "arrows_20", quantity: 20 }] }) });
  const before = structuredClone(permanent);
  const snapshot = snapshotFrom(permanent);
  snapshot.hpCurrent = 9;
  snapshot.inventory[1].quantity = 3;
  assert.equal(snapshot.hpCurrent, 9);
  assert.equal(snapshot.hpMax, 31);
  assert.deepEqual(permanent, before);
});

test("ataques naturales derivan daño y amenaza sin arma persistida", () => {
  const natural = profile({
    id: "canocrock", type: "enemy", controller: "gm", hpMax: 59,
    abilityScores: { strength: 16, dexterity: 12, constitution: 16, intelligence: 2, wisdom: 12, charisma: 6 },
    creatureTypeId: "magical_beast", ...inventoryEquipment(null), naturalAttackId: "canocrock-bite",
    intrinsicDefense: { naturalArmorBonus: 11, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 }
  });
  const derived = deriveEquipmentStats(natural);
  assert.equal(derived.normalArmorClassPreview, 22);
  assert.equal(derived.averageWeaponDamage, 10);
  assert.deepEqual(derived.meleeThreatSources, [{ sourceId: "canocrock-bite", kind: "natural", minReachFeet: 0, maxReachFeet: 5 }]);
});

test("daga amenaza melee; arco y golpe sin arma no", () => {
  assert.equal(deriveEquipmentStats(profile({ ...inventoryEquipment("dagger") })).meleeThreatSources.length, 1);
  assert.deepEqual(deriveEquipmentStats(profile({ ...inventoryEquipment("longbow", { extraItems: [{ catalogId: "arrows_20", quantity: 20 }] }) })).meleeThreatSources, []);
  assert.deepEqual(deriveEquipmentStats(profile({ ...inventoryEquipment(null) })).meleeThreatSources, []);
});
