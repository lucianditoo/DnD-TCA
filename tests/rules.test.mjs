import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePathCostFeet,
  calculatePathStepCostsFeet,
  Rules,
  createCombatRulesSnapshot,
  isCriticalThreat,
  isCriticalConfirmed
} from "../packages/shared/dist/index.js";
import { structuredSnapshotFields } from "./test-utils.mjs";

test("calculatePathStepCostsFeet calcula correctamente costos de ruta recta", () => {
  const origin = { x: 0, y: 0, zFeet: 0 };
  const path = [
    { x: 1, y: 0, zFeet: 0 },
    { x: 2, y: 0, zFeet: 0 },
    { x: 3, y: 0, zFeet: 0 }
  ];
  const costs = calculatePathStepCostsFeet(origin, path, { board: { cellSizeFeet: 5 } });
  assert.deepEqual(costs, [5, 10, 15]);
});

test("calculatePathStepCostsFeet calcula costos de ruta diagonal alternando 5 y 10 ft", () => {
  const origin = { x: 0, y: 0, zFeet: 0 };
  const path = [
    { x: 1, y: 1, zFeet: 0 }, // 1 diagonal: 5
    { x: 2, y: 2, zFeet: 0 }, // 2 diagonal: 5 + 10 = 15
    { x: 3, y: 3, zFeet: 0 }, // 3 diagonal: 15 + 5 = 20
    { x: 4, y: 4, zFeet: 0 }  // 4 diagonal: 20 + 10 = 30
  ];
  const costs = calculatePathStepCostsFeet(origin, path, { board: { cellSizeFeet: 5 } });
  assert.deepEqual(costs, [5, 15, 20, 30]);
});

test("calculatePathStepCostsFeet calcula costos de ruta mixta", () => {
  const origin = { x: 0, y: 0, zFeet: 0 };
  const path = [
    { x: 1, y: 1, zFeet: 0 }, // diagonal (1): 5
    { x: 2, y: 1, zFeet: 0 }, // recta: 5 + 5 = 10
    { x: 3, y: 2, zFeet: 0 }  // diagonal (2): 10 + 10 = 20
  ];
  const costs = calculatePathStepCostsFeet(origin, path, { board: { cellSizeFeet: 5 } });
  assert.deepEqual(costs, [5, 10, 20]);
});

test("calculatePathCostFeet devuelve la suma total acumulada", () => {
  const origin = { x: 0, y: 0, zFeet: 0 };
  const path = [
    { x: 1, y: 1, zFeet: 0 }, // 1 diagonal: 5
    { x: 2, y: 1, zFeet: 0 }, // recta: 10
    { x: 3, y: 2, zFeet: 0 }  // 2 diagonal: 20
  ];
  const cost = calculatePathCostFeet(origin, path, { board: { cellSizeFeet: 5 } });
  assert.equal(cost, 20);
});

test("calculatePathCostFeet con ruta vacia devuelve 0", () => {
  const origin = { x: 0, y: 0, zFeet: 0 };
  const cost = calculatePathCostFeet(origin, [], { board: { cellSizeFeet: 5 } });
  assert.equal(cost, 0);
});

test("Rules.totalSpeedFeet, totalArmorClass y totalAttackBonus resuelven stats considerando buffs legacy (catálogo productivo neutro)", () => {
  const combatant = {
    id: "hero-test",
    name: "Test Hero",
    type: "player",
    controller: "player",
    hpCurrent: 10,
    hpMax: 20,
    ...structuredSnapshotFields(15),
    abilityScores: { strength: 16, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    baseAttackBonus: 2, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    controlledBy: { type: "player" },
    initiative: null,
    buffs: [
      { id: "b1", name: "Bless", source: "spell", attackBonus: 1 },
      { id: "b2", name: "Shield", source: "spell", acBonus: 4, acBonusType: "deflection" },
      { id: "b3", name: "Haste", source: "spell", speedBonusFeet: 10, attackBonus: 1 }
    ],
    abilities: [],
    position: { x: 0, y: 0, zFeet: 0 },
    icon: "T",
    isStable: false,
    stats: {}
  };
  const room = {
    code: "TEST", board: { width: 10, height: 10, cellSizeFeet: 5 },
    combatants: [combatant], turnOrder: ["hero-test"], activeTurnIndex: 0, round: 1,
    phase: "active", outcome: "ongoing", completedAt: null,
    currentTurn: { combatantId: "hero-test", movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false },
    pendingOpportunityAttacks: [], log: [], activeAttackThreat: null,
    effectInstances: [], eventSequence: 0
  };
  const context = createCombatRulesSnapshot(room);

  assert.equal(Rules.totalSpeedFeet(context, combatant), 40);
  
  const ac = Rules.totalArmorClass(context, combatant);
  assert.equal(ac.total, 19);
  assert.deepEqual(ac.parts, ["base +10", "misc +5", "buffs +4"]);

  const attack = Rules.totalAttackBonus(context, combatant);
  assert.equal(attack.total, 7); // 2 BAB + 3 mod + 2 buffs (Bless 1 + Haste 1)
  assert.deepEqual(attack.parts, ["BAB +2", "mod +3", "buffs +2"]);
});

test("TypeScript (compilación): las funciones standalone antiguas ya no están exportadas y deben fallar si se intentan importar directamente", () => {
  // Este test valida el contrato de compilación. Las funciones 'totalAttackBonus',
  // 'totalArmorClass' y 'totalSpeedFeet' ya no existen como exportaciones standalone.
  // Si este archivo compila y funciona, es porque nadie las importó directamente.
  // El typecheck (npm run typecheck) validará el rechazo en tiempo de compilación.
  assert.ok(Rules, "Rules evaluator debe estar exportado");
  assert.equal(typeof Rules.totalAttackBonus, "function");
  assert.equal(typeof Rules.totalArmorClass, "function");
  assert.equal(typeof Rules.totalSpeedFeet, "function");
});

test("createCombatRulesSnapshot genera un objeto congelado en runtime que arroja TypeError al mutarse", () => {
  const room = {
    code: "TEST",
    board: { width: 10, height: 10, cellSizeFeet: 5 },
    combatants: [
      {
        id: "hero-1",
        name: "Elaen",
        type: "player",
        controller: "player",
        hpCurrent: 12,
        hpMax: 12,
        ...structuredSnapshotFields(15),
        baseAttackBonus: 1, baseFortitude: 0, baseReflex: 0, baseWill: 0,
        buffs: [],
        abilities: [],
        position: { x: 1, y: 1, zFeet: 0 },
        icon: "E",
        isStable: false,
        stats: { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, kills: 0, timesDroppedToZero: 0, healingReceived: 0 }
      }
    ],
    turnOrder: ["hero-1"],
    activeTurnIndex: 0,
    round: 1,
    phase: "active",
    outcome: "active",
    completedAt: null,
    currentTurn: {
      combatantId: "hero-1",
      movementUsedFeet: 0,
      usedMoveAction: false,
      usedStandardAction: false,
      usedFullAttack: false,
      usedFiveFootStep: false,
      usedSwiftAction: false,
      usedTotalDefense: false,
      usedStabilization: false
    },
    pendingOpportunityAttacks: [],
    log: [],
    activeAttackThreat: null,
    effectInstances: [{ instanceId: "inst-1", effectId: "__INFRASTRUCTURE_SAMPLE__", source: { type: "system" }, targets: ["hero-1"], appliedAtEvent: { type: "SystemInjected", round: 1 } }],
    eventSequence: 0
  };

  const snapshot = createCombatRulesSnapshot(room);

  // Verificar campos
  assert.equal(snapshot.board.width, 10);
  assert.equal(snapshot.combatants[0].name, "Elaen");
  assert.equal(snapshot.effectInstances.length, 1, "El snapshot debe contener las instancias copiadas");

  // Verificar inmutabilidad en runtime (TypeError)
  assert.throws(() => {
    snapshot.currentTurn.movementUsedFeet = 5;
  }, TypeError);

  assert.throws(() => {
    snapshot.combatants[0].position.x = 2;
  }, TypeError);
});

test("createCombatRulesSnapshot: mutaciones posteriores a room.effectInstances no afectan al snapshot (copia defensiva pura)", () => {
  const room = {
    code: "ISOL", board: { width: 5, height: 5, cellSizeFeet: 5 },
    combatants: [], turnOrder: [], activeTurnIndex: 0, round: 1,
    phase: "active", outcome: "ongoing", completedAt: null,
    currentTurn: { combatantId: null, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false },
    pendingOpportunityAttacks: [], log: [], activeAttackThreat: null,
    effectInstances: [{ instanceId: "iso-1", effectId: "__INFRASTRUCTURE_SAMPLE__", source: { type: "system" }, targets: ["c1"], appliedAtEvent: { type: "SystemInjected", round: 1 } }],
    eventSequence: 0
  };

  const snapshot = createCombatRulesSnapshot(room);

  // Mutar el array del room DESPUÉS de crear el snapshot
  room.effectInstances.push({ instanceId: "iso-2", effectId: "__INFRASTRUCTURE_SAMPLE__", source: { type: "system" }, targets: ["c2"], appliedAtEvent: { type: "SystemInjected", round: 1 } });

  // El snapshot NO debe verse afectado por la mutación posterior
  assert.equal(snapshot.effectInstances.length, 1, "El snapshot debe conservar 1 instancia, no 2");
  assert.equal(snapshot.effectInstances[0].instanceId, "iso-1");
});

test("isCriticalThreat valida correctamente 20 natural, rango de amenaza y acierto", () => {
  // 20 natural siempre amenaza e impacta automáticamente
  assert.equal(isCriticalThreat(20, 21, 25, 20), true); // 20 natural, total 21 contra CA 25, amenaza 20
  
  // 1 natural falla automáticamente y nunca amenaza
  assert.equal(isCriticalThreat(1, 25, 10, 20), false);

  // 19 con arma 19-20 amenaza solo si el ataque total iguala o supera la CA
  assert.equal(isCriticalThreat(19, 24, 24, 19), true);  // 19 natural, total 24 >= CA 24
  assert.equal(isCriticalThreat(19, 23, 24, 19), false); // 19 natural, total 23 < CA 24 (no es impacto, no hay amenaza)
});

test("isCriticalConfirmed valida confirmaciones usando modificadores y reglas 1/20 natural", () => {
  // Confirmación con 1 natural falla automáticamente
  assert.equal(isCriticalConfirmed(1, 10, 5), false);
  
  // Confirmación con 20 natural confirma automáticamente
  assert.equal(isCriticalConfirmed(20, 0, 30), true);

  // Confirmación ordinaria sumando modificador contra CA
  assert.equal(isCriticalConfirmed(15, 5, 20), true);  // 15 + 5 = 20 >= CA 20
  assert.equal(isCriticalConfirmed(14, 5, 20), false); // 14 + 5 = 19 < CA 20
});

import { validateMovePath } from "../packages/shared/dist/index.js";
import { findChargePath } from "../apps/server/src/combat/chargeResolver.ts";

test("Movimiento normal atraviesa aliado consciente pero no termina sobre el", () => {
  const room = {
    activeAttackThreat: null,
    board: { width: 10, height: 10, cellSizeFeet: 5 },
    currentTurn: { movementUsedFeet: 0, usedFiveFootStep: false },
    combatants: [
      { id: "hero-1", type: "player", hpCurrent: 10, isStable: false, position: { x: 1, y: 1, zFeet: 0 }, buffs: [] },
      { id: "hero-2", name: "Ally", type: "player", hpCurrent: 10, isStable: false, position: { x: 2, y: 1, zFeet: 0 } }
    ],
    effectInstances: []
  };
  const mover = room.combatants[0];

  // Atraviesa al aliado
  let res = validateMovePath(room, mover, [{ x: 2, y: 1, zFeet: 0 }, { x: 3, y: 1, zFeet: 0 }]);
  assert.equal(res.ok, true);

  // Termina sobre el aliado
  res = validateMovePath(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);
  assert.equal(res.ok, false);
  assert.equal(res.error.includes("terminar en la casilla ocupada por Ally"), true);
});

test("Movimiento normal puede terminar sobre aliado helpless/dead", () => {
  const room = {
    activeAttackThreat: null,
    board: { width: 10, height: 10, cellSizeFeet: 5 },
    currentTurn: { movementUsedFeet: 0, usedFiveFootStep: false },
    combatants: [
      { id: "hero-1", name: "hero-1", type: "player", hpCurrent: 10, isStable: false, position: { x: 1, y: 1, zFeet: 0 }, baseSpeedFeet: 30, inventory: [{ itemId: "hero-longsword", catalogId: "longsword" }], equipmentSlots: { mainHandItemId: "hero-longsword", offHandItemId: null, armorItemId: null }, buffs: [] },
      { id: "hero-2", name: "DyingAlly", type: "player", hpCurrent: -5, isStable: false, position: { x: 2, y: 1, zFeet: 0 } },
      { id: "hero-3", name: "DeadAlly", type: "player", hpCurrent: -10, isStable: false, position: { x: 2, y: 2, zFeet: 0 } }
    ],
    effectInstances: []
  };
  const mover = room.combatants[0];

  // Atraviesa helpless ally
  let res = validateMovePath(room, mover, [{ x: 2, y: 1, zFeet: 0 }, { x: 3, y: 1, zFeet: 0 }]);
  assert.equal(res.ok, true);

  // Termina en helpless ally (pasa)
  res = validateMovePath(room, mover, [{ x: 2, y: 1, zFeet: 0 }]);
  assert.equal(res.ok, true);

  // Termina en dead ally (pasa)
  res = validateMovePath(room, mover, [{ x: 2, y: 2, zFeet: 0 }]);
  assert.equal(res.ok, true);
});

test("Movimiento normal no atraviesa enemigo consciente pero sí enemigo helpless", () => {
  const room = {
    activeAttackThreat: null,
    board: { width: 10, height: 10, cellSizeFeet: 5 },
    currentTurn: { movementUsedFeet: 0, usedFiveFootStep: false },
    combatants: [
      { id: "hero-1", name: "hero-1", type: "player", hpCurrent: 10, isStable: false, position: { x: 1, y: 1, zFeet: 0 }, baseSpeedFeet: 30, inventory: [{ itemId: "hero-longsword", catalogId: "longsword" }], equipmentSlots: { mainHandItemId: "hero-longsword", offHandItemId: null, armorItemId: null }, buffs: [] },
      { id: "enemy-1", name: "ActiveEnemy", type: "enemy", hpCurrent: 10, isStable: false, position: { x: 2, y: 1, zFeet: 0 } },
      { id: "enemy-2", name: "HelplessEnemy", type: "enemy", hpCurrent: -5, isStable: false, position: { x: 1, y: 2, zFeet: 0 } }
    ],
    effectInstances: []
  };
  const mover = room.combatants[0];

  // Intenta atravesar enemigo consciente
  let res = validateMovePath(room, mover, [{ x: 2, y: 1, zFeet: 0 }, { x: 3, y: 1, zFeet: 0 }]);
  assert.equal(res.ok, false);
  assert.equal(res.error.includes("atravesar la casilla ocupada por el enemigo ActiveEnemy"), true);

  // Intenta atravesar enemigo helpless
  res = validateMovePath(room, mover, [{ x: 1, y: 2, zFeet: 0 }, { x: 1, y: 3, zFeet: 0 }]);
  assert.equal(res.ok, true);

  // Termina sobre enemigo helpless (pasa)
  res = validateMovePath(room, mover, [{ x: 1, y: 2, zFeet: 0 }]);
  assert.equal(res.ok, true);
});

test("Charge falla si hay aliado o enemigo helpless en la ruta", () => {
  const room = {
    board: { width: 10, height: 10, cellSizeFeet: 5 },
    combatants: [
      { id: "hero-1", name: "hero-1", type: "player", hpCurrent: 10, isStable: false, position: { x: 1, y: 1, zFeet: 0 }, baseSpeedFeet: 30, inventory: [{ itemId: "hero-longsword", catalogId: "longsword" }], equipmentSlots: { mainHandItemId: "hero-longsword", offHandItemId: null, armorItemId: null }, buffs: [] },
      { id: "hero-2", name: "Ally", type: "player", hpCurrent: 10, isStable: false, position: { x: 2, y: 1, zFeet: 0 } },
      { id: "enemy-1", name: "Target", type: "enemy", hpCurrent: 10, isStable: false, position: { x: 4, y: 1, zFeet: 0 } }
    ],
    currentTurn: { movementUsedFeet: 0, usedFiveFootStep: false },
    effectInstances: []
  };
  const charger = room.combatants[0];
  const target = room.combatants[2];

  let res = findChargePath(room, charger, target);
  assert.equal(res.ok, false); // Ally en el medio (x:2)

  // Cambiamos aliado a helpless enemy
  room.combatants[1].type = "enemy";
  room.combatants[1].hpCurrent = -5;
  res = findChargePath(room, charger, target);
  assert.equal(res.ok, false); // Helpless enemy en el medio (x:2)
  
  // Cambiamos a dead enemy (debe fallar la busqueda según simplificación de charge)
  room.combatants[1].hpCurrent = -10;
  res = findChargePath(room, charger, target);
  assert.equal(res.ok, false);
});
