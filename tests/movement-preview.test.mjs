import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { createCombatRulesSnapshot, resolveMovementPipeline } from "@dnd-tactical/shared";
import { buildMovementPreview, buildMovementCandidates, getMovementPreviewKind,
  getOrdinaryMoveBlockedReason, ordinaryGridPosition, createOrdinaryMoveIntent } from "../apps/web/src/movementPreview.ts";
import { MovementPreviewSummary } from "../apps/web/src/components/ActionsPanel/MovementPreviewSummary.tsx";
import { buildBoardPresentationModel } from "../apps/web/src/components/Board/presentationModel.ts";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

const pos=(x,y,zFeet=0)=>({x,y,zFeet});
function setup(overrides={}) {
  const actor=makeTestCombatant({position:pos(2,2),controlledBy:{type:"gm"},...overrides});
  const room=makeTestRoom({combatants:[actor],turnOrder:[actor.id]});
  return {room,actor};
}
const freeze=value=>{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function compare(room,actor,path,isAcrobatic=false) {
  const snapshot=createCombatRulesSnapshot(room);
  const input={snapshot,actorId:actor.id,path,isAcrobatic};
  const preview=buildMovementPreview(input);
  const resolution=resolveMovementPipeline({context:snapshot,combatant:snapshot.combatants[0],path,
    availableBudgetFeet:Math.max(0,actor.baseSpeedFeet-room.currentTurn.movementUsedFeet),
    initialContext:{normalDiagonalStepsThisTurn:room.currentTurn.normalDiagonalStepsThisTurn},isAcrobatic});
  if(resolution.kind==="illegal-route") {
    assert.equal(preview.status,"illegal");assert.equal(preview.reason,resolution.reason);assert.equal(preview.failedStepIndex,resolution.failedStepIndex);
    for(const key of ["steps","totalCostFeet","projectedContext","remainingBudgetFeet"])assert.equal(key in preview,false);
  } else {
    assert.equal(preview.status,resolution.kind==="ready"?"legal":"over-budget");
    assert.deepEqual(preview.steps,resolution.steps);assert.deepEqual(preview.projectedContext,resolution.projectedContext);
    assert.equal(preview.totalCostFeet,resolution.kind==="ready"?resolution.totalCostFeet:resolution.requiredCostFeet);
    assert.equal(preview.remainingBudgetFeet,resolution.availableBudgetFeet-preview.totalCostFeet);
  }
  return {preview,input,resolution};
}
for(const [name,path,parity,difficult,tumble] of [
  ["orthogonal",[pos(3,2),pos(4,2)],0,[],false],
  ["diagonal",[pos(3,3),pos(4,4)],0,[],false],
  ["initial parity !=0",[pos(3,3)],1,[],false],
  ["DT diagonals fixed",[pos(3,3),pos(4,4)],0,["3,3","4,4"],false],
  ["Tumble 10/20",[pos(3,3),pos(4,4)],0,[],true],
  ["Tumble + DT",[pos(3,3),pos(4,4)],0,["3,3","4,4"],true],
  ["normal hampered normal",[pos(3,3),pos(4,4),pos(5,5)],1,["4,4"],false]
]) test(`I7 adapter shared parity: ${name}`,()=>{
  const {room,actor}=setup({baseSpeedFeet:100});room.board.difficultTerrainCells=difficult;room.currentTurn.normalDiagonalStepsThisTurn=parity;
  compare(room,actor,path,tumble);
});
for(const difficult of [false,true])for(const tumble of [false,true])for(const axis of ["horizontal","vertical"]) {
  test(`I7 squeezing ${axis}, DT=${difficult}, Tumble=${tumble}`,()=>{
    const {room,actor}=setup({sizeCategory:"large",baseSpeedFeet:100});
    const path=[axis==="horizontal"?pos(3,2):pos(2,3)];
    room.board.narrowCells=axis==="horizontal"?["3,2","4,2"]:["2,3","2,4"];
    room.board.difficultTerrainCells=difficult?[`${path[0].x},${path[0].y}`]:[];
    const {preview}=compare(room,actor,path,tumble);
    assert.equal(preview.steps[0].squeezingAxis,axis);assert.equal(preview.steps[0].spatialMode,"squeezing");assert.equal(room.effectInstances.length,0);
  });
}
for(const axis of ["horizontal","vertical"]) test(`I7 current persisted ${axis} respected without mutation`,()=>{
  const {room,actor}=setup({sizeCategory:"large",baseSpeedFeet:100});
  room.board.narrowCells=Array.from({length:100},(_,i)=>`${i%10},${Math.floor(i/10)}`);
  room.effectInstances=[{instanceId:"s",effectId:"srd_squeezing",squeezingAxis:axis,targets:[actor.id],source:{type:"system"},appliedAtEvent:{type:"SystemInjected",round:1}}];
  const before=structuredClone(room);compare(room,actor,[axis==="horizontal"?pos(3,2):pos(2,3)]);assert.deepEqual(room,before);
});
for(const [name,speed,spent,path,status] of [
  ["exact budget",10,0,[pos(3,2),pos(4,2)],"legal"],
  ["partly used",30,25,[pos(3,2)],"legal"],
  ["over budget",5,0,[pos(3,2),pos(4,2)],"over-budget"],
  ["zero budget",30,30,[pos(3,2)],"over-budget"]
]) test(`I7 ${name}`,()=>{const {room,actor}=setup({baseSpeedFeet:speed});room.currentTurn.movementUsedFeet=spent;const {preview}=compare(room,actor,path);assert.equal(preview.status,status);assert.equal(preview.steps.length,path.length);if(status==="over-budget")assert.ok(preview.remainingBudgetFeet<0);});
test("I7 empty has budget and no evaluated resolution data",()=>{
  const {room,actor}=setup();const p=buildMovementPreview({snapshot:createCombatRulesSnapshot(room),actorId:actor.id,path:[]});
  assert.equal(p.status,"empty");assert.equal(p.availableBudgetFeet,30);assert.equal("steps" in p,false);
});
test("I7 obstacle illegal has no fabricated cost/prefix",()=>{
  const {room,actor}=setup();room.board.impassableCells=["4,2"];const {preview}=compare(room,actor,[pos(3,2),pos(4,2)]);assert.equal(preview.failedStepIndex,1);
});
test("I7 provisional enemy endpoint can become legal by extending full Tumble draft",()=>{
  const {room,actor}=setup();const enemy=makeTestCombatant({id:"enemy",type:"enemy",position:pos(3,2)});room.combatants.push(enemy);
  const first=buildMovementPreview({snapshot:createCombatRulesSnapshot(room),actorId:actor.id,path:[pos(3,2)],isAcrobatic:true});assert.equal(first.status,"illegal");
  const final=buildMovementPreview({snapshot:createCombatRulesSnapshot(room),actorId:actor.id,path:[pos(3,2),pos(4,2)],isAcrobatic:true});
  assert.equal(final.status,"legal");assert.deepEqual(final.acrobaticsChecks,[{stepIndex:0,enemyId:enemy.id,enemyName:enemy.name}]);
});
for(const [status,hp,stable] of [["dead",-10,false],["dying",-1,false],["stable",-1,true]]) test(`I7 CD25 excludes ${status}`,()=>{
  const {room,actor}=setup();room.combatants.push(makeTestCombatant({id:"enemy",type:"enemy",position:pos(3,2),hpCurrent:hp,isStable:stable}));
  const p=buildMovementPreview({snapshot:createCombatRulesSnapshot(room),actorId:actor.id,path:[pos(3,2),pos(4,2)],isAcrobatic:true});assert.equal(p.acrobaticsChecks.length,0);
});
test("I7 repeated preview/candidates and toggle are pure, never use RNG",t=>{
  const {room,actor}=setup();const snapshot=freeze(createCombatRulesSnapshot(room));const path=freeze([pos(3,3)]);const before=structuredClone(room);
  t.mock.method(Math,"random",()=>{throw new Error("preview must not consume RNG");});
  for(let i=0;i<3;i++){const p=buildMovementPreview({snapshot,actorId:actor.id,path,isAcrobatic:i%2===0});assert.equal(p.status,"legal");const c=buildMovementCandidates({snapshot,actorId:actor.id,path,isAcrobatic:false});assert.equal(c.size,8);}
  assert.deepEqual(room,before);assert.equal(snapshot.currentTurn.normalDiagonalStepsThisTurn,0);
});
for(const variant of ["missing","wrong actor","axisless","context"]) test(`I7 unavailable: ${variant}`,()=>{
  const {room,actor}=setup({sizeCategory:variant==="axisless"?"large":"medium"});
  if(variant==="axisless")room.effectInstances=[{instanceId:"s",effectId:"srd_squeezing",targets:[actor.id],source:{type:"system"},appliedAtEvent:{type:"SystemInjected",round:1}}];
  if(variant==="context")delete room.currentTurn.normalDiagonalStepsThisTurn;
  const p=buildMovementPreview({snapshot:variant==="missing"?null:createCombatRulesSnapshot(room),actorId:variant==="wrong actor"?"other":actor.id,path:[pos(3,2)]});assert.equal(p.status,"unavailable");assert.equal("steps" in p,false);
});
test("I7 action availability is separate from legal prediction and keeps I6 gating",()=>{
  const {room,actor}=setup();room.currentTurn.usedMoveAction=true;const snapshot=createCombatRulesSnapshot(room);
  assert.equal(buildMovementPreview({snapshot,actorId:actor.id,path:[pos(3,2)]}).status,"legal");assert.ok(getOrdinaryMoveBlockedReason(snapshot,actor.id,true));
  room.currentTurn.usedMoveAction=false;room.currentTurn.attackMode="standard";room.currentTurn.usedStandardAction=true;
  assert.equal(getOrdinaryMoveBlockedReason(createCombatRulesSnapshot(room),actor.id,true),null);
  room.currentTurn.usedStandardAction=false;assert.ok(getOrdinaryMoveBlockedReason(createCombatRulesSnapshot(room),actor.id,true));
});
for(const [name,overrides,kind] of [["placement",{phase:"preparation"},"placement"],["gm",{gmMoveMode:true},"gm-placement"],["withdraw",{withdrawArmed:true},"legacy-withdraw"],["run",{runArmed:true},"legacy-run"],["5ft",{fiveFootStepArmed:true},"legacy-five-foot-step"],["charge",{actionMode:"tactics",tacticMode:"charge"},"legacy-charge"],["bull rush",{actionMode:"tactics",tacticMode:"bull-rush"},"legacy-forced"],["demo",{isDemoActive:true},"none"],["D5",{isMapEditing:true},"none"]]) {
 test(`I7 previewKind isolates ${name}`,()=>assert.equal(getMovementPreviewKind({phase:"active",actionMode:"move",tacticMode:"total-defense",gmMoveMode:false,withdrawArmed:false,runArmed:false,fiveFootStepArmed:false,...overrides}),kind));
}
for(const tumble of [false,true]) test(`I7 payload only intent, Tumble=${tumble}, height preserved`,()=>{
  const {actor}=setup({position:pos(2,2,15)});const first=ordinaryGridPosition([],actor,pos(3,2));const next=ordinaryGridPosition([pos(3,2,20)],actor,pos(4,2));assert.equal(first.zFeet,15);assert.equal(next.zFeet,20);
  const intent=createOrdinaryMoveIntent("ROOM","gm",actor.id,[first,next],tumble);
  assert.deepEqual(Object.keys(intent).sort(),["type","roomCode","actorId","combatantId","to","path","isAcrobatic"].sort());assert.equal(intent.isAcrobatic,tumble);assert.deepEqual(intent.to,next);
});
test("I7 same projection supplies presentation and summary; camera never changes evidence",()=>{
  const {room,actor}=setup({sizeCategory:"large"});room.board.narrowCells=["2,3","2,4"];
  const {preview,input}=compare(room,actor,[pos(2,3)]);const before=structuredClone(room);
  const markup=renderToStaticMarkup(createElement(MovementPreviewSummary,{preview,blockedReason:null}));assert.match(markup,/Ruta prevista: 10 ft/);assert.match(markup,/vertical/);
  for(const viewMode of ["2d","2.5d"])for(const angle of ["nw","ne","se","sw"]){
    const model=buildBoardPresentationModel({room,snapshot:input.snapshot,selected:actor,targetId:"",displayedPath:preview.path,displayedPathCosts:[999],highlightedCells:new Map(),chargePreviewPath:null,movementPreview:preview,camera:{viewMode,angle,zoom:1}});
    assert.deepEqual(model.cells.filter(c=>c.routeGhost).map(c=>[c.x,c.y]),[[2,3],[2,4]]);
    assert.equal(model.cells.find(c=>c.x===2&&c.y===3).routeStepCost,10);assert.equal(model.cells.find(c=>c.x===2&&c.y===3).routeAxis,"vertical");assert.deepEqual(model.tokens[0].combatant.position,actor.position);
  }
  assert.deepEqual(room,before);
});
test("I7 over-budget and illegal are textually distinct without illegal invented cost",()=>{
  const {room,actor}=setup({baseSpeedFeet:5});const over=buildMovementPreview({snapshot:createCombatRulesSnapshot(room),actorId:actor.id,path:[pos(3,2),pos(4,2)]});
  room.board.impassableCells=["4,2"];const illegal=buildMovementPreview({snapshot:createCombatRulesSnapshot(room),actorId:actor.id,path:[pos(3,2),pos(4,2)]});
  const html=p=>renderToStaticMarkup(createElement(MovementPreviewSummary,{preview:p,blockedReason:null}));assert.match(html(over),/Exceso 5 ft/);assert.match(html(illegal),/Ruta inválida/);assert.match(html(illegal),/Coste no evaluado/);
});
