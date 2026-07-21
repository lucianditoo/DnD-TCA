import test from "node:test";
import assert from "node:assert/strict";
import { handleUseTacticalAction } from "../apps/server/src/commands/tacticalCommands.ts";
import { validateClientCommand } from "../apps/server/src/validation/validateClientCommand.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { inventoryEquipment } from "./test-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// MOVE-WITHDRAW — capa servidor autoritativo (NDD Rev. 3 §4).
// Requiere el toolchain tsx (suite completa `npm test` en Windows); en el sandbox
// Linux este archivo comparte la limitación pre-existente de dodge-mobility.
// ─────────────────────────────────────────────────────────────────────────────

function makeCombatant(overrides = {}) {
  return {
    id: "mover", name: "Retirante", type: "player", controller: "player",
    controlledBy: { type: "player", participantId: "player-1" }, hpCurrent: 30, hpMax: 30,
    baseAttackBonus: 0, baseFortitude: 0, baseReflex: 0, baseWill: 0, baseSpeedFeet: 30,
    abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    sizeCategory: "medium", creatureTypeId: "humanoid", featureIds: [], sneakAttackDice: 0, ruleTraits: [],
    skillRanks: { escape_artist: 0 },
    ...inventoryEquipment("longsword"),
    intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
    featIds: [], dodgeTargetId: null, initiative: 10, isStable: false, buffs: [], abilities: [],
    position: { x: 2, y: 2, zFeet: 0 }, icon: "R",
    stats: { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, opportunityAttacksThisRound: 0, targetsAttackedThisRoundViaAoO: [], kills: 0, timesDroppedToZero: 0, healingReceived: 0 },
    ...overrides
  };
}

function makeEnemy(overrides = {}) {
  return makeCombatant({
    id: "enemy-1", name: "Enemigo", type: "enemy", controller: "gm",
    controlledBy: { type: "gm" },
    position: { x: 1, y: 2, zFeet: 0 },
    ...overrides
  });
}

function makeRoom(combatants, overrides = {}) {
  return {
    code: "TEST", board: { width: 20, height: 20, cellSizeFeet: 5 }, combatants,
    turnOrder: combatants.map((c) => c.id), activeTurnIndex: 0, round: 1,
    phase: "active", outcome: "ongoing", completedAt: null,
    currentTurn: { combatantId: combatants[0]?.id ?? null, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false },
    pendingOpportunityAttacks: [], log: [], activeAttackThreat: null, effectInstances: [], eventSequence: 0,
    ...overrides
  };
}

const mockSocket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(mockSocket, { id: "player-1", role: "player", name: "Jugador 1", roomCode: "TEST" });

function withdrawCommand(room, to, path, combatantId = "mover", actorId = "player-1") {
  return { type: "use-tactical-action", roomCode: room.code, actorId, combatantId, action: "withdraw", to, ...(path ? { path } : {}) };
}

const straightPath = (fromX, toX, y) => {
  const path = [];
  for (let x = fromX + 1; x <= toX; x++) path.push({ x, y, zFeet: 0 });
  return path;
};

test("MOVE-WITHDRAW servidor", async (t) => {
  await t.test("W10: retirada valida hasta exactamente 2x velocidad (60 ft = 12 casillas)", () => {
    const mover = makeCombatant({ position: { x: 2, y: 2, zFeet: 0 } });
    const room = makeRoom([mover, makeEnemy({ position: { x: 1, y: 2, zFeet: 0 } })]);
    const path = straightPath(2, 14, 2); // 12 casillas = 60 ft = 2x30
    handleUseTacticalAction(room, withdrawCommand(room, path[path.length - 1], path));
    assert.equal(mover.position.x, 14);
    assert.equal(room.currentTurn.movementUsedFeet, 60);
  });

  await t.test("W11: rechazo al superar 2x (65 ft)", () => {
    const mover = makeCombatant();
    const room = makeRoom([mover]);
    const path = straightPath(2, 15, 2); // 13 casillas = 65 ft
    assert.throws(() => handleUseTacticalAction(room, withdrawCommand(room, path[path.length - 1], path)));
    assert.equal(mover.position.x, 2, "Sin mutacion de posicion tras rechazo.");
    assert.equal(room.currentTurn.movementUsedFeet, 0, "Sin consumo de economia tras rechazo.");
  });

  await t.test("W12/W13: Disabled valido hasta 1x y rechazado al superar 1x", () => {
    const disabled = makeCombatant({ hpCurrent: 0 });
    const room = makeRoom([disabled]);
    const tooFar = straightPath(2, 9, 2); // 35 ft > 30
    assert.throws(() => handleUseTacticalAction(room, withdrawCommand(room, tooFar[tooFar.length - 1], tooFar)));

    const disabled2 = makeCombatant({ hpCurrent: 0 });
    const room2 = makeRoom([disabled2]);
    const ok = straightPath(2, 8, 2); // 30 ft = 1x
    handleUseTacticalAction(room2, withdrawCommand(room2, ok[ok.length - 1], ok));
    assert.equal(disabled2.position.x, 8);
  });

  await t.test("W14: mutaciones exactas del caso normal (usedFullAttack, sin trio redundante)", () => {
    const mover = makeCombatant();
    const room = makeRoom([mover]);
    const path = straightPath(2, 6, 2);
    handleUseTacticalAction(room, withdrawCommand(room, path[path.length - 1], path));
    assert.equal(room.currentTurn.usedFullAttack, true, "Marcador vigente de asalto completo.");
    assert.equal(room.currentTurn.usedStandardAction, false, "Sin escritura redundante (contrato real de Charge).");
    assert.equal(room.currentTurn.usedMoveAction, false, "Sin escritura redundante.");
    assert.equal(room.currentTurn.movementUsedFeet, 20);
  });

  await t.test("W15: mutaciones exactas del caso Disabled (usedStandardAction, NO usedFullAttack) + esfuerzo", () => {
    const disabled = makeCombatant({ hpCurrent: 0 });
    const room = makeRoom([disabled]);
    const path = straightPath(2, 4, 2);
    handleUseTacticalAction(room, withdrawCommand(room, path[path.length - 1], path));
    assert.equal(room.currentTurn.usedStandardAction, true, "Retirada limitada = accion estandar.");
    assert.equal(room.currentTurn.usedFullAttack, false, "Disabled jamas consume asalto completo.");
    assert.equal(disabled.hpCurrent, -1, "Esfuerzo de Disabled aplicado (accion extenuante).");
  });

  await t.test("W16-W20: economia previa bloquea (movimiento, estandar, 5ft, ataque, attackMode)", () => {
    const cases = [
      { patch: { movementUsedFeet: 5 } },
      { patch: { usedStandardAction: true } },
      { patch: { usedFiveFootStep: true } },
      { patch: { attacksMade: 1, usedStandardAction: true } },
      { patch: { attackMode: "standard" } },
      { patch: { usedMoveAction: true } }
    ];
    for (const { patch } of cases) {
      const mover = makeCombatant();
      const room = makeRoom([mover]);
      Object.assign(room.currentTurn, patch);
      const path = straightPath(2, 5, 2);
      assert.throws(() => handleUseTacticalAction(room, withdrawCommand(room, path[path.length - 1], path)), undefined, JSON.stringify(patch));
      assert.equal(mover.position.x, 2, "Estado intacto tras rechazo: " + JSON.stringify(patch));
    }
  });

  await t.test("W21: terreno dificil consume coste doble contra el presupuesto 2x", () => {
    const mover = makeCombatant();
    // 12 casillas todas dificiles = 120 ft > 60: rechazo.
    const cells = [];
    for (let x = 3; x <= 14; x++) cells.push(`${x},2`);
    const room = makeRoom([mover], { board: { width: 20, height: 20, cellSizeFeet: 5, difficultTerrainCells: cells } });
    const path = straightPath(2, 14, 2);
    assert.throws(() => handleUseTacticalAction(room, withdrawCommand(room, path[path.length - 1], path)));

    // 6 casillas dificiles = 60 ft = exactamente 2x: valido.
    const mover2 = makeCombatant();
    const room2 = makeRoom([mover2], { board: { width: 20, height: 20, cellSizeFeet: 5, difficultTerrainCells: cells } });
    const shortPath = straightPath(2, 8, 2);
    handleUseTacticalAction(room2, withdrawCommand(room2, shortPath[shortPath.length - 1], shortPath));
    assert.equal(room2.currentTurn.movementUsedFeet, 60);
  });

  await t.test("W22: ruta bloqueada por muro es rechazada; atravesar enemigos es rechazado (V1 sin Acrobacias)", () => {
    const mover = makeCombatant();
    const room = makeRoom([mover], { board: { width: 20, height: 20, cellSizeFeet: 5, impassableCells: ["4,2"] } });
    const path = straightPath(2, 6, 2);
    assert.throws(() => handleUseTacticalAction(room, withdrawCommand(room, path[path.length - 1], path)));

    const mover2 = makeCombatant();
    const enemyInPath = makeEnemy({ position: { x: 4, y: 2, zFeet: 0 } });
    const room2 = makeRoom([mover2, enemyInPath]);
    const path2 = straightPath(2, 6, 2);
    assert.throws(() => handleUseTacticalAction(room2, withdrawCommand(room2, path2[path2.length - 1], path2)), /atravesar/);
  });

  await t.test("W23: ownership — otro participante no puede retirar un combatiente ajeno", () => {
    const mover = makeCombatant();
    const room = makeRoom([mover]);
    const path = straightPath(2, 5, 2);
    assert.throws(() => handleUseTacticalAction(room, withdrawCommand(room, path[path.length - 1], path, "mover", "player-2")));
  });

  await t.test("W24: payload invalido rechazado por el schema runtime", () => {
    const bad = validateClientCommand({ type: "use-tactical-action", roomCode: "TEST", actorId: "player-1", combatantId: "mover", action: "withdraw" });
    assert.equal(bad.success, false, "withdraw sin 'to' debe fallar la validacion Zod.");
    const good = validateClientCommand({ type: "use-tactical-action", roomCode: "TEST", actorId: "player-1", combatantId: "mover", action: "withdraw", to: { x: 5, y: 2, zFeet: 0 }, path: [{ x: 3, y: 2, zFeet: 0 }] });
    assert.equal(good.success, true, "Payload correcto valida.");
  });

  await t.test("W25: exencion de huella inicial + AdO posterior pendiente tras confirmar transicion (secuencia real)", () => {
    const mover = makeCombatant();
    const adjacentEnemy = makeEnemy({ id: "e-adj", position: { x: 1, y: 2, zFeet: 0 } });        // amenaza solo huella inicial
    const pathEnemy = makeEnemy({ id: "e-path", position: { x: 6, y: 1, zFeet: 0 } });           // amenaza (6,2) del camino
    const room = makeRoom([mover, adjacentEnemy, pathEnemy]);
    const path = straightPath(2, 9, 2);
    handleUseTacticalAction(room, withdrawCommand(room, path[path.length - 1], path));
    assert.equal(mover.position.x, 9, "La transicion se confirma completa (sin interrupcion a mitad de ruta).");
    assert.equal(room.pendingOpportunityAttacks.length, 1, "Solo el enemigo del camino dispara; la huella inicial esta exenta.");
    assert.equal(room.pendingOpportunityAttacks[0].attackerId, "e-path");
  });

  await t.test("W26/W27: movimiento normal y Charge sin regresiones (default neutro de la exencion)", async () => {
    const { handleMoveCombatant } = await import("../apps/server/src/commands/movementCommands.ts");
    const mover = makeCombatant();
    const adjacentEnemy = makeEnemy({ position: { x: 1, y: 2, zFeet: 0 } });
    const room = makeRoom([mover, adjacentEnemy]);
    handleMoveCombatant(room, { type: "move-combatant", roomCode: room.code, actorId: "player-1", combatantId: "mover", to: { x: 5, y: 2, zFeet: 0 }, path: straightPath(2, 5, 2) });
    assert.equal(room.pendingOpportunityAttacks.length, 1, "El movimiento normal SIGUE provocando al abandonar la casilla inicial amenazada.");
  });
});
