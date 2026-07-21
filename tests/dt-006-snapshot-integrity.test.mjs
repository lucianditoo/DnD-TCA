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

  // Sprint 042.5 — cierre del blind spot que dejó pasar el bug de `targetCells` (Sprint 034):
  // el test anterior solo verifica que las LLAVES DE NIVEL SUPERIOR de CombatRoom sobrevivan al
  // snapshot (ej. que `effectInstances` exista y no sea undefined), pero nunca desciende a verificar
  // que cada elemento DENTRO de esos arrays conserve TODOS sus campos. Este test verifica
  // comportamiento (¿el snapshot reproduce exactamente lo que entró?), no la lista de campos que
  // clona la implementación — por eso no enumera "instanceId, effectId, source..." a mano: arma un
  // EffectInstance con valores reales en cada campo declarado por el tipo y compara por
  // `deepStrictEqual`, que falla tanto si falta un campo como si sobra uno. Si mañana se agrega un
  // campo nuevo a EffectInstance y algún clon deja de propagarlo, este test se pone rojo solo con
  // que el fixture de abajo se actualice para incluirlo (no hace falta tocar ninguna lista de la
  // implementación).
  test("createCombatRulesSnapshot preserva íntegramente cada EffectInstance, incluidos targetCells/duration/stacks", () => {
    const fullEffectInstance = {
      instanceId: "effect-1",
      effectId: "srd_wall_of_fire_hazard",
      source: { type: "environment" },
      targets: ["combatant-a", "combatant-b"],
      targetCells: ["5,5,0", "6,5,0"],
      appliedAtEvent: { type: "SystemInjected", round: 3 },
      duration: { type: "rounds", count: 4, appliedRound: 3 },
      stacks: 2
    };

    const mockRoom = {
      code: "TEST_ROOM_2",
      board: { width: 10, height: 10, cellSizeFeet: 5 },
      combatants: [],
      turnOrder: [],
      activeTurnIndex: 0,
      round: 3,
      phase: "active",
      outcome: "none",
      completedAt: null,
      currentTurn: {
        combatantId: null, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false,
        usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false,
        usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false
      },
      pendingOpportunityAttacks: [],
      log: [],
      activeAttackThreat: null,
      effectInstances: [fullEffectInstance],
      eventSequence: 1
    };

    const snapshot = createCombatRulesSnapshot(mockRoom);

    assert.deepStrictEqual(
      snapshot.effectInstances[0],
      fullEffectInstance,
      "El EffectInstance clonado en el snapshot debe reproducir exactamente el original (ni campos perdidos ni agregados) — este es el comportamiento cuya ausencia dejó pasar el bug de targetCells no propagado."
    );

    // Copia defensiva real: mutar el original después de crear el snapshot no debe afectarlo.
    fullEffectInstance.targetCells.push("99,99,0");
    fullEffectInstance.targets.push("combatant-c");
    assert.deepStrictEqual(
      snapshot.effectInstances[0].targetCells,
      ["5,5,0", "6,5,0"],
      "El snapshot no debe reflejar mutaciones posteriores del array targetCells original."
    );
    assert.deepStrictEqual(
      snapshot.effectInstances[0].targets,
      ["combatant-a", "combatant-b"],
      "El snapshot no debe reflejar mutaciones posteriores del array targets original."
    );
  });
});
