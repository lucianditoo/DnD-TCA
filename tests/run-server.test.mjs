import test from "node:test";
import assert from "node:assert/strict";
import { handleUseTacticalAction } from "../apps/server/src/commands/tacticalCommands.ts";
import { validateClientCommand } from "../apps/server/src/validation/validateClientCommand.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { createCombatRulesSnapshot, resolveMovementPipeline, buildStraightPath, runSpeedBudgetFeet, Rules, EffectManager, effectsTickListener, getCombatantOccupiedCells } from "../packages/shared/src/index.ts";
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
    currentTurn: { combatantId: combatants[0]?.id ?? null, movementUsedFeet: 0, normalDiagonalStepsThisTurn: 0, usedMoveAction: false, usedStandardAction: false, usedFullAttack: false, usedFiveFootStep: false, usedSwiftAction: false, usedTotalDefense: false, usedStabilization: false, attacksMade: 0, attackMode: "none", defensiveFightingDeclared: false },
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

// I10: exercise the real Run handler against independent shared Resolution evidence.
const point = (x,y,zFeet=0) => ({x,y,zFeet});
function narrowBoard(room) {
  room.board.narrowCells = Array.from({length:20},(_,y)=>Array.from({length:40},(_,x)=>`${x},${y}`)).flat();
}
function squeezing(room, actor, axis) {
  room.effectInstances = [{instanceId:'squeeze',effectId:'srd_squeezing',squeezingAxis:axis,
    source:{type:'system'},targets:[actor.id],appliedAtEvent:{type:'SystemInjected',round:1}}];
}
function assertRejected(t, room, to, pattern) {
  const before = structuredClone(room);
  const sent = t.mock.method(mockSocket,'send',()=>{});
  assert.throws(()=>handleUseTacticalAction(room,runCommand(room,to)),pattern);
  assert.deepEqual(room,before); assert.equal(sent.mock.callCount(),0);
}
function assertNormative(t, room, to, expectedCost) {
  const actor=room.combatants[0], snapshot=createCombatRulesSnapshot(room);
  const path=buildStraightPath(snapshot.combatants[0].position,to);
  const oracle=resolveMovementPipeline({context:snapshot,combatant:snapshot.combatants[0],path,
    availableBudgetFeet:runSpeedBudgetFeet(snapshot,snapshot.combatants[0]),
    initialContext:{normalDiagonalStepsThisTurn:snapshot.currentTurn.normalDiagonalStepsThisTurn},isAcrobatic:false});
  assert.equal(oracle.kind,'ready');
  const sent=t.mock.method(mockSocket,'send',raw=>{
    const published=JSON.parse(raw).room;
    assert.equal(published.currentTurn.movementUsedFeet,oracle.totalCostFeet);
    assert.equal(published.currentTurn.usedFullAttack,true);
    assert.deepEqual(published.combatants[0].position,oracle.finalPosition);
    assert.equal(published.effectInstances.some(e=>e.effectId==='srd_running_exposed'),!actor.featIds.includes('srd_run'));
  });
  handleUseTacticalAction(room,runCommand(room,to));
  assert.equal(sent.mock.callCount(),1);
  assert.equal(room.currentTurn.movementUsedFeet,oracle.totalCostFeet);
  if(expectedCost!==undefined) assert.equal(oracle.totalCostFeet,expectedCost);
  assert.equal(actor.stats.distanceMovedFeet,oracle.totalBaseRouteCostFeet);
  assert.equal(room.currentTurn.normalDiagonalStepsThisTurn,oracle.projectedContext.normalDiagonalStepsThisTurn);
  assert.deepEqual(actor.position,oracle.finalPosition);
  assert.deepEqual(getCombatantOccupiedCells(actor,createCombatRulesSnapshot(room)),oracle.steps.at(-1).occupiedCells);
  assert.equal(room.currentTurn.usedMoveAction,false); assert.equal(room.currentTurn.usedStandardAction,false);
  assert.equal(room.currentTurn.usedFiveFootStep,false);
  assert.ok(room.log.some(e=>e.message.includes(`corre ${oracle.totalCostFeet} pies`)));
  return oracle;
}
for(const [name,to,parity,cost] of [
  ['orthogonal',point(3,2),0,5],['vertical',point(2,4),0,10],['diagonal',point(3,3),0,5],
  ['two diagonals',point(4,4),0,15],['initial parity',point(3,3),1,10],['exact x4',point(26,2),0,120]
]) test(`I10 cost ${name}`,t=>{
  const room=makeRoom([makeCombatant()]);room.currentTurn.normalDiagonalStepsThisTurn=parity;
  assertNormative(t,room,to,cost);
});
test('I10 heavy exact/excess and buff apply armor reduction once',t=>{
  const equipment=inventoryEquipment('longsword',{armorCatalogId:'banded_mail'});
  assertNormative(t,makeRoom([makeCombatant({...equipment})]),point(14,2),60);
  assertRejected(t,makeRoom([makeCombatant({...equipment})]),point(15,2),/65.*60/);
  assertNormative(t,makeRoom([makeCombatant({...equipment,buffs:[{id:'speed',name:'Speed',speedBonusFeet:10}]})]),point(20,2),90);
});
test('I10 rate projection does not bypass declarative FORBID_RUN',t=>{
  const actor=makeCombatant(),room=makeRoom([actor]);
  room.effectInstances=[{instanceId:'blind',effectId:'srd_blinded',source:{type:'system'},targets:[actor.id],appliedAtEvent:{type:'SystemInjected',round:1}}];
  assert.equal(runSpeedBudgetFeet(createCombatRulesSnapshot(room),actor),60);
  assertRejected(t,room,point(14,2),/no puede correr/);
});
test('I10 straight path keeps origin height and ignores target height',t=>{
  const room=makeRoom([makeCombatant({position:point(2,2,15)})]);
  assertNormative(t,room,point(4,4,100),15);assert.equal(room.combatants[0].position.zFeet,15);
});
for(const to of [point(5,3),point(2,2),point(2,2,15)]) test(`I10 invalid straight ${JSON.stringify(to)}`,t=>assertRejected(t,makeRoom([makeCombatant()]),to,/línea recta/));
for(const [name,terrain,to,large,narrow,pattern] of [
  ['first',['3,2'],point(6,2),false,false,/terreno difícil/],
  ['middle',['4,2'],point(6,2),false,false,/terreno difícil/],
  ['non-anchor',['4,3'],point(3,2),true,false,/terreno difícil/],
  ['squeezing',['3,2'],point(4,2),true,true,/terreno difícil/],
  ['budget wins',['3,2'],point(27,2),false,false,/130.*120/],
  ['illegal wins',['3,2'],point(6,2),false,false,/obstaculo|muro/]
]) test(`I10 DT ${name} rejects atomically`,t=>{
  const room=makeRoom([makeCombatant({sizeCategory:large?'large':'medium'})]);
  room.board.difficultTerrainCells=terrain;if(narrow)narrowBoard(room);
  if(name==='illegal wins')room.board.impassableCells=['5,2'];
  assertRejected(t,room,to,pattern);
});
for(const initial of [null,'horizontal','vertical'])for(const destination of ['horizontal','vertical','natural']) {
  test(`I10 squeezing ${initial??'natural'} -> ${destination} preserves postcommit effect`,t=>{
    const actor=makeCombatant({sizeCategory:'large',position:point(2,2,15)}),room=makeRoom([actor]);narrowBoard(room);
    if(initial)squeezing(room,actor,initial);
    if(destination==='natural')room.board.narrowCells=initial==='horizontal'?['2,2','3,2']:initial==='vertical'?['2,2','2,3']:[];
    const to=destination==='vertical'?point(2,3,15):point(4,2,15);
    assertNormative(t,room,to);
    const effects=room.effectInstances.filter(e=>e.effectId==='srd_squeezing');
    assert.equal(effects.length,destination==='natural'?0:1);
    if(effects.length)assert.equal(effects[0].squeezingAxis,destination);
    assert.equal(room.effectInstances.filter(e=>e.effectId==='srd_running_exposed').length,1);
    assert.equal(room.log.filter(e=>/entra en compresion|recupera su huella/.test(e.message)).length,!!initial===(destination!=='natural')?0:1);
  });
}
test('I10 diagonal squeezing obeys existing geometry rejection, with zero mutation',t=>{
  const room=makeRoom([makeCombatant({sizeCategory:'large'})]);narrowBoard(room);
  room.currentTurn.normalDiagonalStepsThisTurn=1;assertRejected(t,room,point(3,3));
});
for(const axis of [undefined,'invalid','duplicate'])test(`I10 corrupt axis ${axis}`,t=>{
  const actor=makeCombatant({sizeCategory:'large'}),room=makeRoom([actor]);narrowBoard(room);
  squeezing(room,actor,axis==='duplicate'?'horizontal':axis);
  if(axis==='duplicate')room.effectInstances.push({...room.effectInstances[0],instanceId:'duplicate'});
  assertRejected(t,room,point(4,2));
});
for(const status of ['active','disabled','dying','stable','dead'])for(const final of [false,true])test(`I10 enemy ${status} ${final?'final':'transit'}`,t=>{
  const enemy=makeEnemy({position:point(3,2),hpCurrent:status==='active'?20:status==='disabled'?0:status==='dead'?-10:-1,isStable:status==='stable'});
  const room=makeRoom([makeCombatant(),enemy]),to=point(final?3:4,2);
  if(status==='dead')assertNormative(t,room,to);else assertRejected(t,room,to);
});
for(const final of [false,true])test(`I10 ally ${final?'final':'transit'}`,t=>{
  const room=makeRoom([makeCombatant(),makeCombatant({id:'ally',position:point(3,2)})]);
  if(final)assertRejected(t,room,point(3,2));else assertNormative(t,room,point(4,2));
});
test('I10 Large V1 catches helpless non-anchor endpoint',t=>assertRejected(t,makeRoom([makeCombatant({sizeCategory:'large'}),makeEnemy({position:point(4,3),hpCurrent:-1,isStable:true})]),point(3,2),/terminar de correr/));
test('I10 occupancy at different height is allowed',t=>assertNormative(t,makeRoom([makeCombatant(),makeEnemy({position:point(3,2,15)})]),point(4,2),10));
for(const [name,change] of [
  ['pending',r=>{r.pendingOpportunityAttacks=[{id:'pending'}];}],['mode',r=>{r.currentTurn.attackMode='standard';}],
  ['spent',r=>{r.currentTurn.movementUsedFeet=1;}],['move',r=>{r.currentTurn.usedMoveAction=true;}],
  ['standard',r=>{r.currentTurn.usedStandardAction=true;}],['full',r=>{r.currentTurn.usedFullAttack=true;}],
  ['5ft',r=>{r.currentTurn.usedFiveFootStep=true;}],['critical',r=>{r.activeAttackThreat={attackerId:'mover'};}],
  ['disabled',r=>{r.combatants[0].hpCurrent=0;}],['diehard',r=>{Object.assign(r.combatants[0],{hpCurrent:-1,isStable:true,featIds:['srd_diehard']});}],
  ['phase',r=>{r.phase='preparation';}],['turn',r=>{r.currentTurn.combatantId='other';}],
  ['control',r=>{r.combatants[0].controlledBy.participantId='other';}],['actor',r=>{r.combatants[0].id='other';}],
  ['context',r=>{delete r.currentTurn.normalDiagonalStepsThisTurn;}]
])test(`I10 guard ${name}`,t=>{const room=makeRoom([makeCombatant()]);change(room);assertRejected(t,room,point(4,2));});
for(const [name,change] of [
  ['live actor',(r,a)=>{r.combatants[0]=structuredClone(a);}],['turn',r=>{r.currentTurn.combatantId='enemy-1';}],
  ['round',r=>{r.round++;}],['origin',(r,a)=>{a.position=point(1,2);}],
  ['expenditure',r=>{r.currentTurn.movementUsedFeet=5;}],['context',r=>{r.currentTurn.normalDiagonalStepsThisTurn=1;}],
  ['mobility',(r,a)=>{a.baseSpeedFeet=20;}],['axis',r=>{r.effectInstances[0].squeezingAxis='vertical';}]
])test(`I10 stale ${name} discards all Run buffers`,t=>{
  const actor=makeCombatant({sizeCategory:name==='axis'?'large':'medium'}),room=makeRoom([actor,makeEnemy({position:point(5,1)})]);
  if(name==='axis'){narrowBoard(room);squeezing(room,actor,'horizontal');}
  const original=Rules.canMakeOpportunityAttack;let atCommit;
  t.mock.method(Rules,'canMakeOpportunityAttack',(...args)=>{const allowed=original(...args);if(!atCommit){change(room,actor);atCommit=structuredClone(room);}return allowed;});
  const sent=t.mock.method(mockSocket,'send',()=>{});
  assert.throws(()=>handleUseTacticalAction(room,runCommand(room,point(6,2))));
  assert.ok(atCommit);assert.deepEqual(room,atCommit);assert.equal(sent.mock.callCount(),0);
  assert.equal(room.currentTurn.usedFullAttack,false);assert.equal(room.log.length,0);assert.equal(room.pendingOpportunityAttacks.length,0);
});
test('I10 effect preflight failure is before Movement writes',t=>{
  const room=makeRoom([makeCombatant()]),original=EffectManager.add;
  t.mock.method(EffectManager,'add',(state,instance)=>{if(instance.effectId==='srd_running_exposed')throw new Error('controlled preflight failure');return original(state,instance);});
  assertRejected(t,room,point(4,2),/controlled preflight/);
});
test('I10 pure preflight discarded and second add sees committed state',t=>{
  const actor=makeCombatant({sizeCategory:'large'}),room=makeRoom([actor]);narrowBoard(room);
  const original=EffectManager.add;let calls=0;
  t.mock.method(EffectManager,'add',(state,instance)=>{
    if(instance.effectId==='srd_running_exposed'){
      calls++;assert.equal(state,room);
      assert.equal(state.currentTurn.usedFullAttack,calls===2);
      assert.equal(state.currentTurn.movementUsedFeet,calls===2?20:0);
      assert.equal(actor.stats.distanceMovedFeet,calls===2?10:0);
      assert.equal(actor.position.x,calls===2?4:2);
    }
    const before=structuredClone(state),next=original(state,instance);assert.deepEqual(state,before);return next;
  });
  assertNormative(t,room,point(4,2),20);assert.equal(calls,2);
});
test('I10 exposure identity, stacking, sequence and own next turn',t=>{
  const room=makeRoom([makeCombatant()]);room.eventSequence=17;room.round=3;
  assertNormative(t,room,point(4,2),10);
  const exposed=room.effectInstances.find(e=>e.effectId==='srd_running_exposed');
  assert.deepEqual(exposed.source,{type:'creature',id:'mover'});assert.deepEqual(exposed.targets,['mover']);
  assert.deepEqual(exposed.appliedAtEvent,{type:'ActionResolved',round:3});
  assert.deepEqual(exposed.duration,{type:'until_turn',anchorCombatantId:'mover',phase:'start',appliedAtSequence:17});
  assert.equal(effectsTickListener(room,{type:'TurnStarted',combatantId:'other',round:3,sequence:18}).effectInstances.length,1);
  assert.equal(effectsTickListener(room,{type:'TurnStarted',combatantId:'mover',round:3,sequence:17}).effectInstances.length,1);
  assert.equal(effectsTickListener(room,{type:'TurnStarted',combatantId:'mover',round:4,sequence:18}).effectInstances.length,0);
  const next=makeRoom([makeCombatant()]);next.effectInstances=[structuredClone(exposed)];
  assertNormative(t,next,point(4,2));assert.equal(next.effectInstances.length,1);assert.deepEqual(next.effectInstances[0],exposed);
});
for(const axis of [null,'horizontal','vertical'])test(`I10 initial and later multiple AdO, confirmed ${axis??'natural'} footprints`,t=>{
  const actor=makeCombatant({sizeCategory:axis?'large':'medium'}),room=makeRoom([actor,makeEnemy({id:'initial',position:point(1,2)}),makeEnemy({id:'later',position:point(6,1)})]);
  if(axis){narrowBoard(room);squeezing(room,actor,axis);}
  const oracle=assertNormative(t,room,point(8,2));
  assert.deepEqual(new Set(room.pendingOpportunityAttacks.map(a=>a.attackerId)),new Set(['initial','later']));
  assert.equal(room.pendingOpportunityAttacks.find(a=>a.attackerId==='initial').movementCostFeet,oracle.totalCostFeet);
});
