export function structuredSnapshotFields(defenseTotal = 10, dexterityScore = 10) {
  const dexterity = Math.floor((dexterityScore - 10) / 2);
  return {
    abilityScores: { strength: 10, dexterity: dexterityScore, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium",
    creatureTypeId: "humanoid",
    featureIds: [],
    skillRanks: { escape_artist: 0 },
    sneakAttackDice: 0,
    ruleTraits: [],
    baseSpeedFeet: 30,
    inventory: [{ itemId: "test-item-longsword", catalogId: "longsword" }],
    equipmentSlots: { mainHandItemId: "test-item-longsword", offHandItemId: null, armorItemId: null },
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: defenseTotal - 10 - dexterity },
    featIds: [],
  };
}

export function inventoryEquipment(mainCatalogId = "longsword", options = {}) {
  const inventory = [];
  const add = (catalogId, role, quantity) => {
    if (!catalogId) return null;
    const itemId = `test-item-${role}-${catalogId}`;
    inventory.push({ itemId, catalogId, ...(quantity !== undefined ? { quantity } : {}) });
    return itemId;
  };
  const mainHandItemId = add(mainCatalogId, "main", options.mainQuantity);
  const offHandItemId = add(options.offHandCatalogId ?? null, "off", options.offHandQuantity);
  const armorItemId = add(options.armorCatalogId ?? null, "armor", options.armorQuantity);
  for (const [index, item] of (options.extraItems ?? []).entries()) {
    inventory.push({ itemId: item.itemId ?? `test-item-extra-${index + 1}-${item.catalogId}`, ...item });
  }
  return { inventory, equipmentSlots: { mainHandItemId, offHandItemId, armorItemId } };
}

export function setStructuredDexterity(combatant, dexterityScore, defenseTotal) {
  const previousDexterity = Math.floor((combatant.abilityScores.dexterity - 10) / 2);
  const currentTotal = 10 + previousDexterity + combatant.intrinsicDefense.miscArmorClassBonus;
  const total = defenseTotal ?? currentTotal;
  const dexterity = Math.floor((dexterityScore - 10) / 2);
  combatant.abilityScores = { ...combatant.abilityScores, dexterity: dexterityScore };
  combatant.intrinsicDefense = { ...combatant.intrinsicDefense, miscArmorClassBonus: combatant.intrinsicDefense.miscArmorClassBonus + previousDexterity - dexterity + (total - currentTotal) };
}

export function completeWeapon(overrides = {}) {
  return {
    name: "Arma de prueba",
    handedness: "one-handed",
    damageDice: "1d6",
    critical: "20/x2",
    abilityForAttack: "strength",
    abilityForDamage: "strength",
    damageAbilityMultiplier: 1,
    meleeReachFeet: 5,
    maxRangeFeet: 5,
    notes: "",
    criticalThreatFrom: 20,
    criticalMultiplier: 2,
    ...overrides
  };
}

export function makeTestCombatant(overrides = {}) {
  return {
    id: "hero-test",
    type: "player",
    name: "Hero",
    hpMax: 20,
    hpCurrent: 20,
    ...structuredSnapshotFields(15),
    baseAttackBonus: 2, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    controller: "player",
    controlledBy: { type: "player" },
    initiative: null,
    buffs: [],
    abilities: [],
    position: { x: 0, y: 0, zFeet: 0 },
    icon: "T",
    isStable: false,
    stats: { attacksMade: 0, opportunityAttacksMade: 0, hits: 0, damageDealt: 0, distanceMovedFeet: 0, enemiesDefeated: 0, opportunityAttacksThisRound: 0 },
    ...overrides
  };
}

export function makeTestRoom(overrides = {}) {
  return {
    code: "TEST", 
    board: { width: 10, height: 10, cellSizeFeet: 5 },
    combatants: [], 
    turnOrder: [], 
    activeTurnIndex: 0, 
    round: 1,
    phase: "active", 
    outcome: "ongoing", 
    completedAt: null,
    currentTurn: { 
      combatantId: "hero-test", 
      movementUsedFeet: 0, 
      usedMoveAction: false, 
      usedStandardAction: false, 
      usedFullAttack: false, 
      usedFiveFootStep: false, 
      usedSwiftAction: false, 
      usedTotalDefense: false, 
      usedStabilization: false, 
      attacksMade: 0, 
      attackMode: "none", 
      defensiveFightingDeclared: false 
    },
    pendingOpportunityAttacks: [], 
    log: [], 
    activeAttackThreat: null,
    effectInstances: [], 
    eventSequence: 0,
    ...overrides
  };
}
