import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Rules, createCombatRulesSnapshot, resolveMovementPipeline } from "@dnd-tactical/shared";
import { buildWithdrawMovementPreview, buildWithdrawCandidates, getWithdrawPreviewAvailability } from "../apps/web/src/movementPreview.ts";
import { MovementPreviewSummary } from "../apps/web/src/components/ActionsPanel/MovementPreviewSummary.tsx";
import { buildBoardPresentationModel } from "../apps/web/src/components/Board/presentationModel.ts";
import { handleUseTacticalAction } from "../apps/server/src/commands/tacticalCommands.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";
const p=(x,y,zFeet=0)=>({x,y,zFeet});
function setup(extra={}){const actor=makeTestCombatant({controlledBy:{type:"gm"},position:p(2,2),...extra});return makeTestRoom({combatants:[actor],turnOrder:[actor.id]});}
const input=(room,path)=>({snapshot:createCombatRulesSnapshot(room),actorId:room.combatants[0].id,path});
const preview=(room,path)=>buildWithdrawMovementPreview(input(room,path));
const allNarrow=room=>{room.board.narrowCells=Array.from({length:100},(_,i)=>`${i%10},${Math.floor(i/10)}`);};
function squeeze(room,axis){room.effectInstances=[{instanceId:"sq",effectId:"srd_squeezing",squeezingAxis:axis,targets:[room.combatants[0].id],source:{type:"system"},appliedAtEvent:{type:"SystemInjected",round:1}}];}
function opponent(room,extra={}){room.combatants.push(makeTestCombatant({id:"other",name:"Other",type:"enemy",controlledBy:{type:"gm"},position:p(3,2),...extra}));}
function parity(room,path,status){
  const before=structuredClone(room); const args=input(room,path); const result=buildWithdrawMovementPreview(args);
  const availability=getWithdrawPreviewAvailability(args.snapshot,args.actorId,true);
  assert.equal(result.status,status); assert.deepEqual(room,before);
  const oracle=resolveMovementPipeline({context:args.snapshot,combatant:args.snapshot.combatants[0],path,
    initialContext:{normalDiagonalStepsThisTurn:room.currentTurn.normalDiagonalStepsThisTurn},availableBudgetFeet:availability.evaluationLimitFeet,isAcrobatic:false});
  if(status==="legal" || status==="over-budget"){
    assert.deepEqual(result.steps,oracle.steps); assert.deepEqual(result.projectedContext,oracle.projectedContext);
    assert.equal(result.totalCostFeet,oracle.kind==="ready"?oracle.totalCostFeet:oracle.requiredCostFeet);
  }
  const serverRoom=structuredClone(before);let broadcasts=0;
  const socket={OPEN:1,readyState:1,send:()=>broadcasts++}; clients.set(socket,{id:"i9",role:"gm",roomCode:room.code});
  try{
    const cmd={type:"use-tactical-action",action:"withdraw",roomCode:room.code,actorId:"i9",combatantId:args.actorId,to:path.at(-1),path:structuredClone(path)};
    if(status==="legal" && !availability.blockedReason){
      handleUseTacticalAction(serverRoom,cmd);
      assert.equal(serverRoom.currentTurn.movementUsedFeet,result.totalCostFeet);
      assert.deepEqual(serverRoom.combatants[0].position,path.at(-1));
      assert.equal(serverRoom.currentTurn.normalDiagonalStepsThisTurn,result.projectedContext.normalDiagonalStepsThisTurn);
      assert.equal(serverRoom.combatants[0].stats.distanceMovedFeet,oracle.totalBaseRouteCostFeet);
      assert.equal(broadcasts,1);
    }else{assert.throws(()=>handleUseTacticalAction(serverRoom,cmd));assert.deepEqual(serverRoom,before);assert.equal(broadcasts,0);}
  }finally{clients.delete(socket);}
  return result;
}
for(const [name,path,terrain,context] of [
  ["orthogonal",[p(3,2)],[],0],["diagonal",[p(3,3)],[],0],["two diagonals",[p(3,3),p(4,4)],[],0],
  ["real context",[p(3,3)],[],1],["DT",[p(3,3)],["3,3"],0],
  ["two DT diagonals",[p(3,3),p(4,4)],["3,3","4,4"],0],["normal DT normal",[p(3,3),p(4,4),p(5,5)],["4,4"],0]
])test(`I9 preview/resolver/I8 parity: ${name}`,()=>{const room=setup();room.board.difficultTerrainCells=terrain;room.currentTurn.normalDiagonalStepsThisTurn=context;const result=parity(room,path,"legal");if(name==="two DT diagonals")assert.equal(result.totalCostFeet,30);});
for(const limited of [false,true])for(const excess of [false,true])test(`I9 ${limited?"limited x1":"normal x2"} ${excess?"excess":"exact"}`,()=>{
  const room=setup({baseSpeedFeet:10,hpCurrent:limited?0:20});
  const path=Array.from({length:(limited?2:4)+(excess?1:0)},(_,i)=>p(3+i,2));
  const availability=getWithdrawPreviewAvailability(input(room,[]).snapshot,room.combatants[0].id,true);
  assert.equal(availability.variant,limited?"limited":"normal");assert.match(availability.actionLabel,limited?/acción estándar/:/asalto completo/);
  parity(room,path,excess?"over-budget":"legal");
});
test("I9 Diehard and effective speed use shared action economy and speed",()=>{
  const room=setup({hpCurrent:-1,isStable:true,featIds:["srd_diehard"]});
  room.effectInstances=[{instanceId:"e",effectId:"srd_entangled",targets:[room.combatants[0].id],source:{type:"system"},appliedAtEvent:{type:"SystemInjected",round:1}}];
  const a=getWithdrawPreviewAvailability(input(room,[]).snapshot,room.combatants[0].id,true);
  assert.equal(a.variant,"limited");assert.equal(a.evaluationLimitFeet,15);parity(room,[p(3,2),p(4,2),p(5,2)],"legal");
});
for(const hp of [20,0,-1,-10])for(const stable of hp===-1?[false,true]:[false])for(const final of [false,true])test(`I9 V1 parity hp=${hp} stable=${stable} final=${final}`,()=>{
  const room=setup();opponent(room,{hpCurrent:hp,isStable:stable});const result=parity(room,final?[p(3,2)]:[p(3,2),p(4,2)],hp===-10?"legal":"illegal");
  if(hp===-1){assert.equal(result.reasonSource,"withdraw-policy");assert.equal("totalCostFeet" in result,false);assert.equal("steps" in result,false);}
  if(hp>=0)assert.equal(result.reasonSource,"movement");
});
for(const final of [false,true])test(`I9 ally ${final?"endpoint":"transit"}`,()=>{const room=setup();opponent(room,{type:"player"});parity(room,final?[p(3,2)]:[p(3,2),p(4,2)],final?"illegal":"legal");});
test("I9 Large V1 non-anchor and altitude discriminate with real server",()=>{
  const room=setup({sizeCategory:"large",position:p(2,2,15)});opponent(room,{hpCurrent:-1,position:p(4,3,15)});
  assert.equal(parity(room,[p(3,2,15)],"illegal").reasonSource,"withdraw-policy");
  room.combatants[1].position.zFeet=0;parity(room,[p(3,2,15)],"legal");
});
test("I9 budget rejection precedes helpless V1 policy",()=>{const room=setup({baseSpeedFeet:5});opponent(room,{hpCurrent:-1});const result=parity(room,[p(3,2),p(4,2),p(5,2)],"over-budget");assert.equal("reasonSource" in result,false);assert.equal(result.steps.length,3);});
for(const initial of [null,"horizontal","vertical"])for(const axis of ["horizontal","vertical","natural"])test(`I9 spatial parity ${initial} -> ${axis}`,()=>{
  const room=setup({sizeCategory:"large",position:p(2,2,15)});allNarrow(room);if(initial)squeeze(room,initial);
  if(axis==="natural")room.board.narrowCells=initial==="horizontal"?["2,2","3,2"]:initial==="vertical"?["2,2","2,3"]:[];
  const path=axis==="natural"?[p(3,2,15),p(4,2,15)]:[axis==="horizontal"?p(3,2,15):p(2,3,15)];
  const result=parity(room,path,"legal");
  assert.equal(result.steps.at(-1).squeezingAxis,axis==="natural"?undefined:axis);
});
test("I9 squeezing+DT parity",()=>{const room=setup({sizeCategory:"large"});allNarrow(room);room.board.difficultTerrainCells=["3,2"];assert.equal(parity(room,[p(3,2)],"legal").totalCostFeet,20);});
for(const axis of [undefined,"diagonal","duplicate"])test(`I9 empty detects corrupt axis ${axis}`,()=>{const room=setup({sizeCategory:"large"});allNarrow(room);squeeze(room,axis==="duplicate"?"horizontal":axis);if(axis==="duplicate")room.effectInstances.push({...room.effectInstances[0],instanceId:"other"});assert.equal(preview(room,[]).status,"unavailable");assert.equal(preview(room,[p(3,2)]).status,"unavailable");});
for(const [name,mutate] of [
  ["spent",r=>r.currentTurn.movementUsedFeet=5],["move",r=>r.currentTurn.usedMoveAction=true],["full",r=>r.currentTurn.usedFullAttack=true],
  ["standard",r=>r.currentTurn.usedStandardAction=true],["5ft",r=>r.currentTurn.usedFiveFootStep=true],["attacks",r=>r.currentTurn.attacksMade=1],
  ["attack mode",r=>r.currentTurn.attackMode="standard"],["pending",r=>r.pendingOpportunityAttacks=[{id:"p"}]],
  ["cannot move",r=>r.effectInstances.push({instanceId:"p",effectId:"srd_paralyzed",targets:[r.combatants[0].id],source:{type:"system"},appliedAtEvent:{type:"SystemInjected",round:1}})],["critical",r=>r.activeAttackThreat={attackerId:r.combatants[0].id,normalDamageBundle:{total:0,components:[]}}],
  ["availability",r=>r.effectInstances.push({instanceId:"s",effectId:"srd_stunned",targets:[r.combatants[0].id],source:{type:"system"},appliedAtEvent:{type:"SystemInjected",round:1}})],["defense",r=>r.currentTurn.usedTotalDefense=true]
])test(`I9 blocked ${name} stays separate from route status`,()=>{const room=setup();mutate(room);const a=getWithdrawPreviewAvailability(input(room,[]).snapshot,room.combatants[0].id,true);assert.ok(a.blockedReason);assert.equal(a.evaluationLimitFeet,Rules.totalSpeedFeet(input(room,[]).snapshot,room.combatants[0])*2);parity(room,[p(3,2)],a.evaluationLimitFeet >= 5 ? "legal" : "over-budget");});
test("I9 structural unavailable, no control, empty and pure eight candidates",t=>{
  const room=setup({position:p(2,2,15)});const args=input(room,[]);const before=structuredClone(args);
  const freeze=o=>{if(o&&typeof o==="object"){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};freeze(args);
  const random=t.mock.method(Math,"random",()=>{throw Error("preview RNG");});
  assert.equal(buildWithdrawMovementPreview(args).status,"empty");assert.equal("totalCostFeet" in buildWithdrawMovementPreview(args),false);
  for(let i=0;i<2;i++){const candidates=buildWithdrawCandidates(args);assert.equal(candidates.size,8);assert.ok([...candidates.values()].every(c=>c.path.at(-1).zFeet===15));}
  assert.deepEqual(args,before);assert.equal(random.mock.callCount(),0);
  assert.ok(getWithdrawPreviewAvailability(args.snapshot,args.actorId,false).blockedReason);
  assert.equal(buildWithdrawMovementPreview({...args,snapshot:null}).status,"unavailable");
  const wrong=structuredClone(room);wrong.phase="preparation";assert.equal(preview(wrong,[]).status,"unavailable");
  assert.ok(getWithdrawPreviewAvailability(input(wrong,[]).snapshot,args.actorId,true).blockedReason);
  wrong.phase="active";wrong.currentTurn.combatantId="other";assert.equal(preview(wrong,[]).status,"unavailable");
  assert.ok(getWithdrawPreviewAvailability(input(wrong,[]).snapshot,args.actorId,true).blockedReason);
  for(const patch of [{actorId:"missing"},{snapshot:{...args.snapshot,currentTurn:null}},
    {snapshot:{...args.snapshot,currentTurn:{...args.snapshot.currentTurn,movementUsedFeet:NaN}}},
    {snapshot:{...args.snapshot,currentTurn:{...args.snapshot.currentTurn,normalDiagonalStepsThisTurn:NaN}}}]){
    assert.equal(buildWithdrawMovementPreview({...args,...patch}).status,"unavailable");
  }
});
test("I9 common summary/model, both modes/four cameras and separate blocked copy",()=>{
  const room=setup({sizeCategory:"large"});allNarrow(room);const result=preview(room,[p(3,2)]);const before=structuredClone(room);
  for(const viewMode of ["2d","2.5d"])for(const angle of ["nw","ne","se","sw"]){const model=buildBoardPresentationModel({room,snapshot:input(room,[]).snapshot,selected:room.combatants[0],targetId:"",displayedPath:result.path,displayedPathCosts:[999],highlightedCells:new Map(),chargePreviewPath:null,movementPreview:result,camera:{viewMode,angle,zoom:1}});assert.equal(model.cells.find(c=>c.x===3&&c.y===2).routeStepCost,result.totalCostFeet);assert.equal(model.cells.filter(c=>c.routeGhost).length,2);assert.deepEqual(model.tokens[0].combatant.position,room.combatants[0].position);}
  const html=renderToStaticMarkup(createElement(MovementPreviewSummary,{preview:result,isWithdraw:true,blockedReason:"Ya se movió"}));assert.match(html,/Límite de evaluación/);assert.doesNotMatch(html,/Quedarían|CD25|Tumble/);assert.deepEqual(room,before);
});
