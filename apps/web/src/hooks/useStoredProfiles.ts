import { useEffect, useMemo, useState } from "react";
import { EquipmentCatalog, gameCatalog, readStoredProfilesWithIssues, writeStoredProfiles, type CreatureTemplate, type StoredProfile } from "@dnd-tactical/shared";
import { applyDerivedEquipmentStats } from "../profileEquipment";

function defaultProfile(type: "player" | "enemy" = "player"): StoredProfile {
  const weaponId = type === "enemy" ? "greatsword" : "dagger";
  const profileId = "profile-" + Math.random().toString(36).slice(2, 10);
  const weaponItemId = `${profileId}:item:${weaponId}:1`;
  return {
    id: profileId,
    name: type === "enemy" ? "Nuevo enemigo" : "Nuevo heroe",
    type,
    controller: type === "enemy" ? "gm" : "player",
    icon: type === "enemy" ? "E" : "H",
    hpMax: type === "enemy" ? 20 : 30,
    baseAttackBonus: 1,
    baseFortitude: 0,
    baseReflex: 0,
    baseWill: 0,
    baseSpeedFeet: 30,
    abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium",
    creatureTypeId: "humanoid",
    featureIds: [],
    skillRanks: { escape_artist: 0 },
    inventory: [{ itemId: weaponItemId, catalogId: weaponId }],
    equipmentSlots: { mainHandItemId: weaponItemId, offHandItemId: null, armorItemId: null },
    featIds: [],
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
    abilities: [],
    buffs: [],
    position: { x: 0, y: 0, zFeet: 0 },
    updatedAt: new Date().toISOString()
  };
}

export function useStoredProfiles() {
  const initialRead = useMemo(() => readStoredProfilesWithIssues(localStorage), []);
  const [profiles, setProfiles] = useState<StoredProfile[]>(initialRead.profiles);

  useEffect(() => {
    writeStoredProfiles(localStorage, profiles);
  }, [profiles]);

  const heroes = useMemo(() => profiles.filter((profile) => profile.type === "player"), [profiles]);
  const enemies = useMemo(() => profiles.filter((profile) => profile.type === "enemy"), [profiles]);

  function createProfile(type: "player" | "enemy" = "player"): StoredProfile {
    const profile = defaultProfile(type);
    setProfiles((current) => [profile, ...current]);
    return profile;
  }

  function saveProfile(profile: StoredProfile) {
    const baseProfile: StoredProfile = {
      ...profile,
      baseSpeedFeet: Math.max(0, Number(profile.baseSpeedFeet) || 30)
    };
    applyDerivedEquipmentStats(baseProfile);
    const normalized: StoredProfile = {
      ...baseProfile,
      controller: profile.type === "enemy" ? "gm" : "player",
      hpMax: Math.max(1, Number(profile.hpMax) || 1),
      baseAttackBonus: Number(profile.baseAttackBonus) || 0,
      updatedAt: new Date().toISOString()
    };
    setProfiles((current) => current.map((item) => item.id === normalized.id ? normalized : item));
  }

  function duplicateProfile(profile: StoredProfile): StoredProfile {
    const id = "profile-" + Math.random().toString(36).slice(2, 10);
    const idMap = new Map(profile.inventory.map((item, index) => [item.itemId, `${id}:item:${item.catalogId}:${index + 1}`]));
    const copy: StoredProfile = {
      ...profile,
      id,
      name: profile.name + " copia",
      inventory: profile.inventory.map((item) => ({ ...item, itemId: idMap.get(item.itemId)! })),
      equipmentSlots: {
        mainHandItemId: profile.equipmentSlots.mainHandItemId ? idMap.get(profile.equipmentSlots.mainHandItemId) ?? null : null,
        offHandItemId: profile.equipmentSlots.offHandItemId ? idMap.get(profile.equipmentSlots.offHandItemId) ?? null : null,
        armorItemId: profile.equipmentSlots.armorItemId ? idMap.get(profile.equipmentSlots.armorItemId) ?? null : null
      },
      updatedAt: new Date().toISOString()
    };
    setProfiles((current) => [copy, ...current]);
    return copy;
  }

  function deleteProfile(profileId: string) {
    setProfiles((current) => current.filter((profile) => profile.id !== profileId));
  }

  function toCombatTemplate(profile: StoredProfile): CreatureTemplate {
    const { updatedAt: _updatedAt, ...template } = profile;
    return template;
  }

  return { profiles, heroes, enemies, migrationIssues: initialRead.issues, equipmentCatalog: EquipmentCatalog, abilities: gameCatalog.abilities, createProfile, saveProfile, duplicateProfile, deleteProfile, toCombatTemplate };
}
