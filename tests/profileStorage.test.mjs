import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_PROFILE_STORAGE_KEY, PROFILE_STORAGE_BACKUP_KEY, PROFILE_STORAGE_KEY, V5_PROFILE_STORAGE_KEY,
  readStoredProfiles, readStoredProfilesWithIssues, writeStoredProfiles
} from "../packages/shared/src/profileStorage.js";
import { inventoryEquipment } from "./test-utils.mjs";

function base(overrides = {}) {
  return {
    id: "profile-1", name: "Hero", type: "player", controller: "player", icon: "H", hpMax: 20,
    baseAttackBonus: 2, baseFortitude: 0, baseReflex: 0, baseWill: 0, baseSpeedFeet: 30,
    abilityScores: { strength: 12, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium", creatureTypeId: "humanoid", featureIds: [], skillRanks: { escape_artist: 0 }, featIds: [],
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
    abilities: [], buffs: [], position: { x: 0, y: 0, zFeet: 0 }, updatedAt: "2026-07-07T00:00:00.000Z",
    ...overrides
  };
}

function legacy(overrides = {}) {
  return base({ equipment: { mainWeapon: "longbow", offHand: null, armor: "leather", shield: null, weapons: [{ weaponId: "arrows_20", quantity: 20 }] }, ...overrides });
}

function v5(overrides = {}) {
  return base({ ...inventoryEquipment("dagger", { armorCatalogId: "leather" }), ...overrides });
}

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
}

describe("Profile Storage V6", () => {
  test("migra V1/V3/V4 a inventario V6 determinista y conserva backup", () => {
    const storage = memoryStorage({ [LEGACY_PROFILE_STORAGE_KEY]: JSON.stringify([legacy()]) });
    const result = readStoredProfilesWithIssues(storage);
    assert.equal(result.migrated, true);
    assert.equal(result.issues.length, 0);
    assert.equal(result.profiles[0].equipmentSlots.mainHandItemId, "profile-1:item:longbow:1");
    assert.equal(result.profiles[0].inventory.find((item) => item.catalogId === "arrows_20").quantity, 20);
    assert.ok(storage.data.has(PROFILE_STORAGE_BACKUP_KEY));
    assert.equal(JSON.parse(storage.data.get(PROFILE_STORAGE_KEY)).version, 6);
    assert.deepEqual(result.profiles[0].skillRanks, { escape_artist: 0 });
    assert.deepEqual(readStoredProfilesWithIssues(storage).profiles, result.profiles);
  });

  test("perfil opaco queda en cuarentena", () => {
    const result = readStoredProfilesWithIssues(memoryStorage({ [LEGACY_PROFILE_STORAGE_KEY]: JSON.stringify([{ id: "opaque", name: "Opaque" }]) }));
    assert.equal(result.profiles.length, 0);
    assert.equal(result.issues[0].profileId, "opaque");
  });

  test("rechaza referencias de catálogo desconocidas", () => {
    const invalid = v5({ inventory: [{ itemId: "bad", catalogId: "invented" }], equipmentSlots: { mainHandItemId: "bad", offHandItemId: null, armorItemId: null } });
    const result = readStoredProfilesWithIssues(memoryStorage({ [PROFILE_STORAGE_KEY]: JSON.stringify({ version: 6, profiles: [invalid] }) }));
    assert.equal(result.profiles.length, 0);
    assert.match(result.issues[0].message, /desconocido/);
  });

  test("acepta dotes catalogadas y rechaza IDs desconocidos", () => {
    const ids = ["srd_improved_trip", "srd_diehard", "srd_prone_eschewal"];
    assert.deepEqual(readStoredProfiles(memoryStorage({ [PROFILE_STORAGE_KEY]: JSON.stringify({ version: 6, profiles: [v5({ featIds: ids })] }) }))[0].featIds, ids);
    const invalid = readStoredProfilesWithIssues(memoryStorage({ [PROFILE_STORAGE_KEY]: JSON.stringify({ version: 6, profiles: [v5({ featIds: ["invented_feat"] })] }) }));
    assert.equal(invalid.profiles.length, 0);
    assert.match(invalid.issues[0].message, /FeatCatalog/);
  });

  test("datos corruptos producen issue explícito", () => {
    const result = readStoredProfilesWithIssues(memoryStorage({ [PROFILE_STORAGE_KEY]: "JSON inválido" }));
    assert.equal(result.profiles.length, 0);
    assert.equal(result.issues.length, 1);
  });

  test("migra V5 a V6 asentando rangos cero de forma idempotente", () => {
    const profileV5 = v5();
    delete profileV5.skillRanks;
    const storage = memoryStorage({ [V5_PROFILE_STORAGE_KEY]: JSON.stringify({ version: 5, profiles: [profileV5] }) });
    const first = readStoredProfilesWithIssues(storage);
    assert.equal(first.migrated, true);
    assert.deepEqual(first.profiles[0].skillRanks, { escape_artist: 0 });
    assert.equal(JSON.parse(storage.data.get(PROFILE_STORAGE_KEY)).version, 6);
    assert.deepEqual(readStoredProfilesWithIssues(storage).profiles, first.profiles);
  });

  test("writeStoredProfiles guarda y relee exclusivamente V6", () => {
    const storage = memoryStorage();
    const saved = v5();
    writeStoredProfiles(storage, [saved]);
    assert.equal(JSON.parse(storage.data.get(PROFILE_STORAGE_KEY)).version, 6);
    assert.deepEqual(readStoredProfiles(storage), [saved]);
  });
});
