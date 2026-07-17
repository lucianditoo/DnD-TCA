import { test, describe } from "node:test";
import * as assert from "node:assert";
import { createCombatRulesSnapshot, createCombatantSnapshotFromProfile } from "../packages/shared/dist/combatSnapshot.js";

describe("DT-006: Integrity and mapping validation for CombatRulesSnapshot", () => {
  test("createCombatRulesSnapshot guarantees exactly matching properties for non-ephemeral keys and no undefined", () => {
      const profile = {
        id: "p1",
        name: "Test Combatant",
        type: "hero",
        controller: "player",
        hpMax: 10,
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
        inventory: [{ itemId: "p1-longsword", catalogId: "longsword" }],
        equipmentSlots: { mainHandItemId: "p1-longsword", offHandItemId: null, armorItemId: null },
        intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
        featIds: [],
        position: { x: 0, y: 0, zFeet: 0 },
        buffs: [],
        abilities: []
      };

      const c = createCombatantSnapshotFromProfile(profile, {
        controlledBy: { type: "player", id: "u1" },
        idFactory: (prefix) => "c1"
      });

      // 1. Mock a complete active room

      const mockRoom = {
        code: "TEST_ROOM",
        board: {
          width: 10,
          height: 10,
          cellSizeFeet: 5,
          difficultTerrainCells: ["5,5"],
          impassableCells: ["0,0"]
        },
        combatants: [c],
      turnOrder: ["c1"],
      activeTurnIndex: 0,
      round: 1,
      phase: "active",
      outcome: "none",
      completedAt: null,
      currentTurn: {
        combatantId: "c1",
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
      eventSequence: 1
    };

    // 2. Generate snapshot
    const snapshot = createCombatRulesSnapshot(mockRoom);

    // 3. Define the excluded keys
    const ephemeralKeys = ["code", "log", "completedAt", "outcome", "turnOrder", "activeTurnIndex", "round", "eventSequence"];
    const roomKeys = Object.keys(mockRoom);
    
    // 4. Validate mapping
    for (const key of roomKeys) {
      if (ephemeralKeys.includes(key)) {
        continue;
      }
      
      // Ensure the snapshot has the non-ephemeral property
      assert.ok(key in snapshot, `El campo ${key} de CombatRoom no está presente en el snapshot (posible campo huérfano de DT-006).`);
      
      // Ensure it is not undefined (deep structural mapping)
      const value = snapshot[key];
      assert.notStrictEqual(value, undefined, `El campo ${key} del snapshot fue mapeado como undefined.`);
    }

    // Ensure snapshot does not introduce foreign keys
    const snapshotKeys = Object.keys(snapshot);
    for (const key of snapshotKeys) {
      assert.ok(roomKeys.includes(key), `El snapshot contiene un campo extraño: ${key} que no pertenece a CombatRoom.`);
    }

    // 5. Deep freeze validation (handled automatically in development mode by createCombatRulesSnapshot)
    assert.ok(Object.isFrozen(snapshot), "El snapshot base debe estar congelado.");
    assert.ok(Object.isFrozen(snapshot.board), "El board del snapshot debe estar congelado.");
  });
});
