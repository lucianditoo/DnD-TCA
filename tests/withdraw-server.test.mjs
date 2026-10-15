import test from "node:test";
import assert from "node:assert/strict";
import { handleUseTacticalAction } from "../apps/server/src/commands/tacticalCommands.ts";
import { validateClientCommand } from "../apps/server/src/validation/validateClientCommand.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { inventoryEquipment } from "./test-utils.mjs";
import { Rules, createCombatRulesSnapshot, resolveMovementPipeline, getCombatantOccupiedCells, lifeStatus, footprintCellKey, findTriggeredOpportunityAttacksForPath } from "@dnd-tactical/shared";

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
    currentTurn: { normalDiagonalStepsThisTurn: 0, combatantId: combatants[0]?.id ?? null, movementUsedFeet: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false },
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

// I8: oracle is the common resolver, not a second implementation of Movement Cost.
const point = (x, y, zFeet = 0) => ({ x, y, zFeet });
function narrowBoard(room) {
  room.board.narrowCells = Array.from({ length: 20 }, (_, y) => Array.from({ length: 20 }, (_, x) => `${x},${y}`)).flat();
}
function squeezing(room, actor, axis) {
  room.effectInstances = [{ instanceId: "squeeze", effectId: "srd_squeezing", squeezingAxis: axis,
    source: { type: "system" }, targets: [actor.id], appliedAtEvent: { type: "SystemInjected", round: 1 } }];
}
function assertRejected(t, room, path, pattern) {
  const before = structuredClone(room);
  const sent = t.mock.method(mockSocket, "send", () => {});
  assert.throws(() => handleUseTacticalAction(room, withdrawCommand(room, path.at(-1), path)), pattern);
  assert.deepEqual(room, before);
  assert.equal(sent.mock.callCount(), 0);
}
function assertNormative(t, room, path, expectedCost) {
  const actor = room.combatants[0];
  const snapshot = createCombatRulesSnapshot(room);
  const oracle = resolveMovementPipeline({ context: snapshot, combatant: snapshot.combatants[0], path,
    initialContext: { normalDiagonalStepsThisTurn: snapshot.currentTurn.normalDiagonalStepsThisTurn },
    availableBudgetFeet: Rules.totalSpeedFeet(snapshot, actor) * (lifeStatus(actor) === "disabled" ? 1 : 2), isAcrobatic: false });
  assert.equal(oracle.kind, "ready");
  const sent = t.mock.method(mockSocket, "send", raw => {
    const published = JSON.parse(raw).room;
    assert.equal(published.currentTurn.movementUsedFeet, oracle.totalCostFeet);
    assert.deepEqual(published.combatants[0].position, oracle.finalPosition);
    assert.equal(published.currentTurn.usedFullAttack || published.currentTurn.usedStandardAction, true);
  });
  handleUseTacticalAction(room, withdrawCommand(room, path.at(-1), path));
  assert.equal(sent.mock.callCount(), 1);
  assert.equal(room.currentTurn.movementUsedFeet, oracle.totalCostFeet);
  if (expectedCost !== undefined) assert.equal(oracle.totalCostFeet, expectedCost);
  assert.equal(actor.stats.distanceMovedFeet, oracle.totalBaseRouteCostFeet);
  assert.equal(room.currentTurn.normalDiagonalStepsThisTurn, oracle.projectedContext.normalDiagonalStepsThisTurn);
  assert.deepEqual(actor.position, oracle.finalPosition);
  assert.deepEqual(getCombatantOccupiedCells(actor, createCombatRulesSnapshot(room)), oracle.steps.at(-1).occupiedCells);
  assert.ok(room.log.some(entry => entry.message.includes(`se retira del combate: ${oracle.totalCostFeet} pies`)));
  return oracle;
}

for (const [name, path, terrain, parity, cost] of [
  ["orthogonal", [point(3,2),point(4,2)], [], 0, 10],
  ["two normal diagonals", [point(3,3),point(4,4)], [], 0, 15],
  ["nonzero diagonal context", [point(3,3)], [], 1, 10],
  ["DT diagonals fixed, not legacy 35", [point(3,3),point(4,4)], ["3,3","4,4"], 0, 30],
  ["normal to DT to normal", [point(3,3),point(4,4),point(5,5)], ["4,4"], 0, 30]
]) test(`I8 resolver parity: ${name}`, t => {
  const room = makeRoom([makeCombatant()]); room.board.difficultTerrainCells = terrain;
  room.currentTurn.normalDiagonalStepsThisTurn = parity;
  assertNormative(t, room, path, cost);
});

for (const initial of [null, "horizontal", "vertical"]) for (const destination of ["horizontal", "vertical", "natural"]) {
  test(`I8 squeezing ${initial ?? "natural"} -> ${destination}, xyz and single transition`, t => {
    const actor = makeCombatant({ sizeCategory: "large", position: point(2,2,15) });
    const room = makeRoom([actor]); narrowBoard(room);
    if (initial) squeezing(room, actor, initial);
    if (destination === "natural") room.board.narrowCells = initial === "horizontal" ? ["2,2","3,2"] : initial === "vertical" ? ["2,2","2,3"] : [];
    const to = destination === "vertical" ? point(2,3,15) : point(3,2,15);
    assertNormative(t, room, destination === "natural" ? [to,point(4,2,15)] : [to]);
    const effects = room.effectInstances.filter(e => e.effectId === "srd_squeezing");
    assert.equal(effects.length, destination === "natural" ? 0 : 1);
    if (effects.length) assert.equal(effects[0].squeezingAxis, destination);
    const transitions = room.log.filter(e => /entra en compresion|recupera su huella/.test(e.message));
    assert.equal(transitions.length, !!initial === (destination !== "natural") ? 0 : 1);
  });
}
test("I8 squeezing plus DT spends cost, statistics remain base route", t => {
  const room = makeRoom([makeCombatant({ sizeCategory: "large" })]); narrowBoard(room);
  room.board.difficultTerrainCells = ["3,2"];
  assertNormative(t, room, [point(3,2)], 20);
  assert.equal(room.combatants[0].stats.distanceMovedFeet, 5);
});
for (const axis of [undefined, "diagonal", "duplicate"]) test(`I8 corrupt axis ${axis} rejects without publication`, t => {
  const actor = makeCombatant({ sizeCategory: "large" }); const room = makeRoom([actor]); narrowBoard(room);
  squeezing(room, actor, axis === "duplicate" ? "horizontal" : axis);
  if (axis === "duplicate") room.effectInstances.push({ ...room.effectInstances[0], instanceId: "duplicate" });
  assertRejected(t, room, [point(3,2)]);
});

for (const status of ["active", "disabled", "dying", "stable", "dead"]) for (const final of [false, true]) {
  test(`I8 V1 enemy ${status} ${final ? "endpoint" : "transit"}`, t => {
    const other = makeEnemy({ position: point(3,2), hpCurrent: status === "active" ? 20 : status === "disabled" ? 0 : status === "dead" ? -10 : -1, isStable: status === "stable" });
    const room = makeRoom([makeCombatant(), other]); const path = final ? [point(3,2)] : [point(3,2),point(4,2)];
    if (status === "dead") assertNormative(t, room, path); else assertRejected(t, room, path);
  });
}
for (const final of [false,true]) test(`I8 ally ${final ? "endpoint blocked" : "intermediate allowed"}`, t => {
  const room = makeRoom([makeCombatant(), makeCombatant({ id: "ally", position: point(3,2) })]);
  const path = final ? [point(3,2)] : [point(3,2),point(4,2)];
  if (final) assertRejected(t, room, path); else assertNormative(t, room, path);
});
for (const isStable of [false,true]) test(`I8 Large V1 endpoint rejects helpless at non-anchor cell, stable=${isStable}`, t => {
  const room=makeRoom([makeCombatant({sizeCategory:"large"}),makeEnemy({position:point(4,3),hpCurrent:-1,isStable})]);
  assertRejected(t,room,[point(3,2)]);
});

for (const [name, change] of [
  ["move", r => {r.currentTurn.usedMoveAction=true;}], ["standard", r => {r.currentTurn.usedStandardAction=true;}],
  ["5ft", r => {r.currentTurn.usedFiveFootStep=true;}], ["full", r => {r.currentTurn.usedFullAttack=true;}],
  ["attacks", r => {r.currentTurn.attacksMade=1;}], ["mode", r => {r.currentTurn.attackMode="standard";}],
  ["spent", r => {r.currentTurn.movementUsedFeet=1;}], ["pending", r => {r.pendingOpportunityAttacks=[{id:"pending"}];}],
  ["cannot move", r => {r.combatants[0].ruleTraits.push("CANNOT_MOVE");}], ["phase", r => {r.phase="preparation";}],
  ["wrong turn", r => {r.currentTurn.combatantId="other";}], ["control", r => {r.combatants[0].controlledBy.participantId="other";}],
  ["critical", r => {r.activeAttackThreat={attackerId:"mover"};}], ["missing context", r => {delete r.currentTurn.normalDiagonalStepsThisTurn;}]
]) test(`I8 guard ${name} rejects atomically`, t => {
  const room=makeRoom([makeCombatant()]); change(room); assertRejected(t, room, [point(3,2)]);
});

test("I8 effective speed changes budget, exact and excess", t => {
  const actor=makeCombatant(); const room=makeRoom([actor]);
  room.effectInstances=[{instanceId:"entangled",effectId:"srd_entangled",targets:[actor.id],source:{type:"system"},appliedAtEvent:{type:"SystemInjected",round:1}}];
  assert.equal(Rules.totalSpeedFeet(createCombatRulesSnapshot(room),actor),15);
  assertNormative(t,room,straightPath(2,8,2),30);
});
test("I8 over-budget Disabled never applies exertion or partial path", t => {
  const room=makeRoom([makeCombatant({hpCurrent:0})]); assertRejected(t,room,straightPath(2,9,2),/35.*30/);
});
test("I8 limited success publishes effort once, status and outcome coherently", t => {
  const room=makeRoom([makeCombatant({hpCurrent:0}),makeEnemy({position:point(15,15)})]);
  assertNormative(t,room,[point(3,2)]);
  assert.equal(room.combatants[0].hpCurrent,-1); assert.equal(room.currentTurn.usedStandardAction,true);
  assert.equal(room.currentTurn.usedFullAttack,false); assert.equal(room.currentTurn.usedMoveAction,false);
  assert.equal(room.log.filter(e=>/pierde 1 HP por esfuerzo/.test(e.message)).length,1);
  assert.equal(lifeStatus(room.combatants[0]),"dying"); assert.equal(room.outcome,"ongoing");
});
test("I8 Diehard limited exertion reaches death and checks TPK before broadcast", t => {
  const actor=makeCombatant({hpCurrent:-9,isStable:true,featIds:["srd_diehard"]});
  const room=makeRoom([actor,makeEnemy({position:point(15,15)})]);
  assertNormative(t,room,[point(3,2)]);
  assert.equal(actor.hpCurrent,-10); assert.equal(room.outcome,"tpk"); assert.equal(room.phase,"finished");
  assert.equal(room.log.filter(e=>/pierde 1 HP por esfuerzo/.test(e.message)).length,1);
});

for (const [name, change] of [
  ["live actor", (r,a)=>{r.combatants[0]=structuredClone(a);}], ["actor id", (r,a)=>{a.id="other";}],
  ["turn", r=>{r.currentTurn.combatantId="enemy-1";}], ["round", r=>{r.round++;}],
  ["origin", (r,a)=>{a.position=point(1,2);}], ["expenditure", r=>{r.currentTurn.movementUsedFeet=5;}],
  ["context", r=>{r.currentTurn.normalDiagonalStepsThisTurn=1;}], ["mobility", (r,a)=>{a.baseSpeedFeet=20;}],
  ["squeezing axis", r=>{r.effectInstances[0].squeezingAxis="vertical";}]
]) test(`I8 stale ${name}: rejected Commit discards buffered AoO, logs and economy`, t => {
  const actor=makeCombatant({hpCurrent:0,sizeCategory:name==="squeezing axis"?"large":"medium",baseSpeedFeet:60});
  const room=makeRoom([actor,makeEnemy({position:point(5,1)})]);
  if(name==="squeezing axis"){narrowBoard(room);squeezing(room,actor,"horizontal");}
  const original=Rules.canMakeOpportunityAttack; let atCommit;
  t.mock.method(Rules,"canMakeOpportunityAttack",(...args)=>{
    const allowed=original(...args); if(!atCommit){change(room,actor);atCommit=structuredClone(room);} return allowed;
  });
  const sent=t.mock.method(mockSocket,"send",()=>{});
  assert.throws(()=>handleUseTacticalAction(room,withdrawCommand(room,point(6,2),straightPath(2,6,2))));
  assert.ok(atCommit); assert.deepEqual(room,atCommit); assert.equal(sent.mock.callCount(),0);
  assert.equal(room.log.length,0); assert.equal(room.pendingOpportunityAttacks.length,0);
  assert.equal(room.currentTurn.usedStandardAction,false); assert.equal(actor.hpCurrent,0);
});

for (const axis of ["horizontal","vertical"]) test(`I8 compressed ${axis} origin exemption and later AdO use confirmed cells`, t => {
  const actor=makeCombatant({sizeCategory:"large",baseSpeedFeet:60});
  const room=makeRoom([actor,makeEnemy({id:"initial",position:point(1,2)}),makeEnemy({id:"later",position:point(6,1)})]);
  narrowBoard(room); squeezing(room,actor,axis);
  const snapshot=createCombatRulesSnapshot(room); const path=straightPath(2,7,2);
  const oracle=resolveMovementPipeline({context:snapshot,combatant:snapshot.combatants[0],path,
    initialContext:{normalDiagonalStepsThisTurn:0},availableBudgetFeet:Rules.totalSpeedFeet(snapshot,actor)*2,isAcrobatic:false});
  assert.equal(oracle.kind,"ready");
  const expected=findTriggeredOpportunityAttacksForPath(snapshot,snapshot.combatants[0],path,oracle.totalCostFeet,
    reactor=>Rules.canMakeOpportunityAttack(snapshot,reactor,actor.id),false,
    new Set(getCombatantOccupiedCells(snapshot.combatants[0],snapshot).map(footprintCellKey)),oracle.steps);
  assertNormative(t,room,path);
  assert.equal(room.pendingOpportunityAttacks.length,1);
  assert.equal(room.pendingOpportunityAttacks[0].attackerId,"later");
  assert.deepEqual(room.pendingOpportunityAttacks.map(({id,createdAt,...evidence})=>evidence),expected.map(({id,createdAt,...evidence})=>evidence));
  assert.equal(room.effectInstances[0].squeezingAxis,"horizontal");
});
test("I8 path intent retains fallback, copying, and no new to/path equality constraint", t => {
  const room=makeRoom([makeCombatant()]); const path=[point(3,2)]; const before=structuredClone(path);
  handleUseTacticalAction(room,withdrawCommand(room,point(19,19),path));
  assert.deepEqual(path,before); assert.deepEqual(room.combatants[0].position,point(3,2));
  const next=makeRoom([makeCombatant()]);
  handleUseTacticalAction(next,withdrawCommand(next,point(3,2),[]));
  assert.deepEqual(next.combatants[0].position,point(3,2));
});
