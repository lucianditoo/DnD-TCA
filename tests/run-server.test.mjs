import test from "node:test";
import assert from "node:assert/strict";
import { handleUseTacticalAction } from "../apps/server/src/commands/tacticalCommands.ts";
import { validateClientCommand } from "../apps/server/src/validation/validateClientCommand.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { inventoryEquipment } from "./test-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// MOVE-RUN — capa servidor autoritativo (NDD docs/designs/run-design.md).
// Requiere el toolchain tsx (suite completa `npm test` en Windows); en el sandbox
// Linux este archivo comparte la limitacion pre-existente de withdraw-server.
//
// Decisiones cerradas por PROCEED (Sprint 041), verificadas aqui:
// D-1: sin exencion de AdO (a diferencia de Retirada) — la huella inicial SI provoca.
// D-3: reutiliza NO_DEX_TO_AC (Destreza + Esquiva juntos) salvo dote de Correr.
// D-5: la dote de Correr (srd_run) conserva Destreza/Esquiva mientras se corre.
// ─────────────────────────────────────────────────────────────────────────────

function makeCombatant(overrides = {}) {
  return {
    id: "mover", name: "Corredor", type: "player", controller: "player",
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
    code: "TEST", board: { width: 40, height: 20, cellSizeFeet: 5 }, combatants,
    turnOrder: combatants.map((c) => c.id), activeTurnIndex: 0, round: 1,
    phase: "active", outcome: "ongoing", completedAt: null,
    currentTurn: { combatantId: combatants[0]?.id ?? null, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false },
    pendingOpportunityAttacks: [], log: [], activeAttackThreat: null, effectInstances: [], eventSequence: 0,
    ...overrides
  };
}

const mockSocket = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(mockSocket, { id: "player-1", role: "player", name: "Jugador 1", roomCode: "TEST" });

function runCommand(room, to, combatantId = "mover", actorId = "player-1") {
  return { type: "use-tactical-action", roomCode: room.code, actorId, combatantId, action: "run", to };
}

const straightPath = (fromX, toX, y) => {
  const path = [];
  for (let x = fromX + 1; x <= toX; x++) path.push({ x, y, zFeet: 0 });
  return path;
};

test("MOVE-RUN servidor", async (t) => {
  await t.test("R1: correr valido hasta exactamente x4 velocidad (120 ft = 24 casillas)", () => {
    const mover = makeCombatant({ position: { x: 2, y: 2, zFeet: 0 } });
    const room = makeRoom([mover]);
    const dest = { x: 26, y: 2, zFeet: 0 };
    handleUseTacticalAction(room, runCommand(room, dest));
    assert.equal(mover.position.x, 26);
    assert.equal(room.currentTurn.movementUsedFeet, 120);
  });

  await t.test("R2: rechazo al superar x4 (125 ft = 25 casillas)", () => {
    const mover = makeCombatant();
    const room = makeRoom([mover]);
    assert.throws(() => handleUseTacticalAction(room, runCommand(room, { x: 27, y: 2, zFeet: 0 })));
    assert.equal(mover.position.x, 2, "Sin mutacion de posicion tras rechazo.");
    assert.equal(room.currentTurn.movementUsedFeet, 0, "Sin consumo de economia tras rechazo.");
  });

  await t.test("R3: con armadura pesada, presupuesto x3 sobre la velocidad ya reducida (60 ft = 12 casillas)", () => {
    const mover = makeCombatant({ ...inventoryEquipment("longsword", { armorCatalogId: "banded_mail" }) });
    const room = makeRoom([mover]);
    handleUseTacticalAction(room, runCommand(room, { x: 14, y: 2, zFeet: 0 }));
    assert.equal(mover.position.x, 14);
    assert.equal(room.currentTurn.movementUsedFeet, 60);

    const mover2 = makeCombatant({ ...inventoryEquipment("longsword", { armorCatalogId: "banded_mail" }) });
    const room2 = makeRoom([mover2]);
    assert.throws(() => handleUseTacticalAction(room2, runCommand(room2, { x: 15, y: 2, zFeet: 0 })), undefined, "13 casillas = 65 ft > 60: rechazo.");
  });

  await t.test("R4: rechazo cuando el destino no forma una linea recta (ni ortogonal ni diagonal de 45)", () => {
    const mover = makeCombatant();
    const room = makeRoom([mover]);
    assert.throws(() => handleUseTacticalAction(room, runCommand(room, { x: 5, y: 3, zFeet: 0 })), /línea recta|linea recta/);
  });

  await t.test("R5: terreno dificil en cualquier punto de la ruta es rechazo absoluto (no solo recargo)", () => {
    const mover = makeCombatant();
    const room = makeRoom([mover], { board: { width: 40, height: 20, cellSizeFeet: 5, difficultTerrainCells: ["4,2"] } });
    // Solo 5 casillas normales (25 ft), muy por debajo del presupuesto de 120 ft, pero UNA es terreno dificil.
    assert.throws(() => handleUseTacticalAction(room, runCommand(room, { x: 7, y: 2, zFeet: 0 })), /terreno difícil|terreno dificil/);
  });

  await t.test("R6: Disabled (0 HP) no tiene ninguna via legal para correr", () => {
    const disabled = makeCombatant({ hpCurrent: 0 });
    const room = makeRoom([disabled]);
    assert.throws(() => handleUseTacticalAction(room, runCommand(room, { x: 5, y: 2, zFeet: 0 })), /asalto completo/);
    assert.equal(disabled.position.x, 2, "Sin mutacion tras rechazo.");
  });

  await t.test("R7: Fatigado (FORBID_RUN) no puede correr", () => {
    const mover = makeCombatant();
    const room = makeRoom([mover], {
      effectInstances: [{
        instanceId: "fatigue-1", effectId: "srd_fatigued", source: { type: "system" },
        targets: ["mover"], appliedAtEvent: { type: "SystemInjected", round: 1 }
      }]
    });
    assert.throws(() => handleUseTacticalAction(room, runCommand(room, { x: 5, y: 2, zFeet: 0 })), /correr/);
  });

  await t.test("R8-R11: economia previa bloquea (movimiento, estandar, 5ft, asalto completo)", () => {
    const cases = [
      { patch: { movementUsedFeet: 5 } },
      { patch: { usedStandardAction: true } },
      { patch: { usedFiveFootStep: true } },
      { patch: { usedFullAttack: true } }
    ];
    for (const { patch } of cases) {
      const mover = makeCombatant();
      const room = makeRoom([mover]);
      Object.assign(room.currentTurn, patch);
      assert.throws(() => handleUseTacticalAction(room, runCommand(room, { x: 5, y: 2, zFeet: 0 })), undefined, JSON.stringify(patch));
      assert.equal(mover.position.x, 2, "Estado intacto tras rechazo: " + JSON.stringify(patch));
    }
  });

  await t.test("R12: mutaciones exactas del caso valido (usedFullAttack, sin escritura redundante)", () => {
    const mover = makeCombatant();
    const room = makeRoom([mover]);
    handleUseTacticalAction(room, runCommand(room, { x: 6, y: 2, zFeet: 0 }));
    assert.equal(room.currentTurn.usedFullAttack, true, "Marcador vigente de asalto completo.");
    assert.equal(room.currentTurn.usedStandardAction, false, "Sin escritura redundante.");
    assert.equal(room.currentTurn.usedMoveAction, false, "Sin escritura redundante.");
    assert.equal(room.currentTurn.movementUsedFeet, 20);
  });

  await t.test("R13: D-1 — la huella inicial SI provoca Ataque de Oportunidad (sin exencion, a diferencia de Retirada)", () => {
    const mover = makeCombatant();
    const adjacentEnemy = makeEnemy({ position: { x: 1, y: 2, zFeet: 0 } }); // amenaza la huella inicial (2,2)
    const room = makeRoom([mover, adjacentEnemy]);
    handleUseTacticalAction(room, runCommand(room, { x: 6, y: 2, zFeet: 0 }));
    assert.equal(room.pendingOpportunityAttacks.length, 1, "Abandonar la huella inicial amenazada SI provoca al correr (D-1).");
    assert.equal(room.pendingOpportunityAttacks[0].attackerId, "enemy-1");
  });

  await t.test("R14: D-3/D-5 — sin la dote de Correr, se suprime Destreza y Esquiva (NO_DEX_TO_AC) hasta el proximo turno", () => {
    const mover = makeCombatant({ featIds: [] });
    const room = makeRoom([mover]);
    handleUseTacticalAction(room, runCommand(room, { x: 6, y: 2, zFeet: 0 }));
    const applied = room.effectInstances.find((instance) => instance.targets?.includes("mover"));
    assert.ok(applied, "Debe aplicarse un efecto de supresion al correr sin la dote de Correr.");
    assert.equal(applied.duration?.type, "until_turn");
    assert.equal(applied.duration?.phase, "start");
    assert.equal(applied.duration?.anchorCombatantId, "mover");
  });

  await t.test("R15: D-5 — con la dote de Correr, NO se suprime Destreza/Esquiva", () => {
    const mover = makeCombatant({ featIds: ["srd_run"] });
    const room = makeRoom([mover]);
    handleUseTacticalAction(room, runCommand(room, { x: 6, y: 2, zFeet: 0 }));
    const applied = room.effectInstances.find((instance) => instance.targets?.includes("mover"));
    assert.equal(applied, undefined, "Con la dote de Correr no debe aplicarse la supresion de Destreza/Esquiva.");
  });

  await t.test("R16: ownership — otro participante no puede hacer correr a un combatiente ajeno", () => {
    const mover = makeCombatant();
    const room = makeRoom([mover]);
    assert.throws(() => handleUseTacticalAction(room, runCommand(room, { x: 5, y: 2, zFeet: 0 }, "mover", "player-2")));
  });

  await t.test("R17: payload invalido rechazado por el schema runtime", () => {
    const bad = validateClientCommand({ type: "use-tactical-action", roomCode: "TEST", actorId: "player-1", combatantId: "mover", action: "run" });
    assert.equal(bad.success, false, "run sin 'to' debe fallar la validacion Zod.");
    const good = validateClientCommand({ type: "use-tactical-action", roomCode: "TEST", actorId: "player-1", combatantId: "mover", action: "run", to: { x: 6, y: 2, zFeet: 0 } });
    assert.equal(good.success, true, "Payload correcto valida.");
  });

  await t.test("R18: regresion — movimiento normal sigue provocando AdO por huella inicial (geometria compartida sin romper Carga)", async () => {
    const { handleMoveCombatant } = await import("../apps/server/src/commands/movementCommands.ts");
    const mover = makeCombatant();
    const adjacentEnemy = makeEnemy({ position: { x: 1, y: 2, zFeet: 0 } });
    const room = makeRoom([mover, adjacentEnemy]);
    handleMoveCombatant(room, { type: "move-combatant", roomCode: room.code, actorId: "player-1", combatantId: "mover", to: { x: 5, y: 2, zFeet: 0 }, path: straightPath(2, 5, 2) });
    assert.equal(room.pendingOpportunityAttacks.length, 1, "El movimiento normal sigue provocando al abandonar la casilla inicial amenazada.");
  });
});
