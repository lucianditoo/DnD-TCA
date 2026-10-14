import test from "node:test";
import assert from "node:assert/strict";
import { handleMoveCombatant } from "../apps/server/src/commands/movementCommands.ts";
import { handleUseTacticalAction } from "../apps/server/src/commands/tacticalCommands.ts";
import { handleGmApplyEffect, handleGmMoveCombatant } from "../apps/server/src/commands/gmCommands.ts";
import { resolveAbility } from "../apps/server/src/combat/abilityResolver.ts";
import { commitSpatialTransition } from "../apps/server/src/combat/spatialTransition.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { getCombatantOccupiedCells, createCombatRulesSnapshot } from "@dnd-tactical/shared";
import { makeTestRoom, makeTestCombatant } from "./test-utils.mjs";

function setup(extra={}) {
 const actor=makeTestCombatant({controlledBy:{type:"gm"},position:{x:2,y:2,zFeet:0},...extra});
 const room=makeTestRoom({combatants:[actor],turnOrder:[actor.id]});
 let sent=0; const socket={OPEN:1,readyState:1,send:()=>sent++};
 clients.set(socket,{id:"gm-i6",role:"gm",roomCode:room.code});
 return {actor,room,sent:()=>sent};
}
const pos=(x,y)=>({x,y,zFeet:0});
const command=(room,actor,path,isAcrobatic=false)=>({type:"move-combatant",actorId:"gm-i6",roomCode:room.code,combatantId:actor.id,to:path.at(-1),path,isAcrobatic});
function enemy(room,x,y) {const c=makeTestCombatant({id:`enemy-${x}-${y}`,name:"Enemy",type:"enemy",controlledBy:{type:"gm"},position:pos(x,y)});room.combatants.push(c);return c;}
function dice(t,roll,onRoll=()=>{}) {
 let count=0;
 t.mock.method(Math,"random",()=>{
  if(new Error().stack.includes("diceRoller")){onRoll(++count);return (roll-0.5)/20;}
  return 0.5;
 });
 return ()=>count;
}
const allNarrow=room=>{room.board.narrowCells=Array.from({length:100},(_,i)=>`${i%10},${Math.floor(i/10)}`);};
for(const [name,path,cost,parity] of [["orthogonal",[pos(3,2),pos(4,2)],10,0],["diagonal",[pos(3,3),pos(4,4)],15,2]]) {
 test(`I6 active ${name} flow and second move rejected`,()=>{
  const {room,actor,sent}=setup();handleMoveCombatant(room,command(room,actor,path));
  assert.deepEqual(actor.position,path.at(-1));assert.equal(room.currentTurn.movementUsedFeet,cost);assert.equal(room.currentTurn.normalDiagonalStepsThisTurn,parity);assert.equal(room.currentTurn.usedMoveAction,true);assert.equal(sent(),1);
  const before=structuredClone(room);assert.throws(()=>handleMoveCombatant(room,command(room,actor,[pos(5,4)])),/accion de movimiento/);assert.deepEqual(room,before);
 });
}
for(const [mode,spent,allowed] of [["full",false,false],["standard",false,false],["standard",true,true]]) {
 test(`I6 attack gating ${mode}, standard spent=${spent}`,()=>{
  const {room,actor}=setup();room.currentTurn.attackMode=mode;room.currentTurn.usedStandardAction=spent;
  if(allowed){handleMoveCombatant(room,command(room,actor,[pos(3,2)]));assert.equal(room.currentTurn.usedMoveAction,true);}
  else{const before=structuredClone(room);assert.throws(()=>handleMoveCombatant(room,command(room,actor,[pos(3,2)])),/preparado/);assert.deepEqual(room,before);}
 });
}
test("I6 full route insufficient budget rejects before dice with zero mutation",t=>{
 const {room,actor,sent}=setup({baseSpeedFeet:5});enemy(room,3,2);const rolls=dice(t,1);const before=structuredClone(room);
 assert.throws(()=>handleMoveCombatant(room,command(room,actor,[pos(3,2),pos(4,2)],true)),/pies disponibles/);
 assert.equal(rolls(),0);assert.deepEqual(room,before);assert.equal(sent(),0);
});
test("I6 preparation remains free legacy placement",()=>{
 const {room,actor}=setup();room.phase="preparation";room.currentTurn.usedMoveAction=true;
 handleMoveCombatant(room,command(room,actor,[pos(8,8)]));assert.deepEqual(actor.position,pos(8,8));assert.equal(room.currentTurn.movementUsedFeet,0);
});
test("I6 Tumble succeeds through enemy with doubled cost and diagonal parity",t=>{
 const {room,actor}=setup({abilityScores:{strength:10,dexterity:30,constitution:10,intelligence:10,wisdom:10,charisma:10}});enemy(room,3,3);dice(t,20);
 handleMoveCombatant(room,command(room,actor,[pos(3,3),pos(4,4)],true));
 assert.equal(room.currentTurn.movementUsedFeet,30);assert.equal(room.currentTurn.normalDiagonalStepsThisTurn,2);assert.equal(actor.stats.distanceMovedFeet,15);assert.ok(room.log.some(l=>l.message.includes("CD 25")));
});
test("I6 CD25 failure commits re-resolved prefix and forced opportunity with cost",t=>{
 const {room,actor}=setup();enemy(room,4,2);dice(t,1);
 handleMoveCombatant(room,command(room,actor,[pos(3,2),pos(4,2),pos(5,2)],true));
 assert.deepEqual(actor.position,pos(3,2));assert.equal(room.currentTurn.movementUsedFeet,10);assert.equal(actor.stats.distanceMovedFeet,5);assert.equal(room.currentTurn.normalDiagonalStepsThisTurn,0);
 assert.ok(room.pendingOpportunityAttacks.some(o=>o.reason.includes("fallo al atravesar")&&o.movementCostFeet===10));
});
test("I6 CD25 first-step failure has no commit, log, economy or broadcast",t=>{
 const {room,actor,sent}=setup();enemy(room,3,2);dice(t,1);const before=structuredClone(room);
 assert.throws(()=>handleMoveCombatant(room,command(room,actor,[pos(3,2),pos(4,2)],true)),/primer paso/);assert.deepEqual(room,before);assert.equal(sent(),0);
});
test("I6 interrupted prefix persists horizontal, not discarded vertical destination axis",t=>{
 const {room,actor}=setup({sizeCategory:"large",baseSpeedFeet:100});allNarrow(room);enemy(room,3,3);dice(t,1);
 handleMoveCombatant(room,command(room,actor,[pos(3,2),pos(3,3),pos(4,3)],true));
 assert.deepEqual(actor.position,pos(3,2));assert.equal(room.effectInstances[0].squeezingAxis,"horizontal");assert.equal(room.currentTurn.movementUsedFeet,20);
 assert.deepEqual(getCombatantOccupiedCells(actor,createCombatRulesSnapshot(room)),[pos(3,2),pos(4,2)]);
});
for(const [name,mutate] of [["origin",(r,a)=>{a.position=pos(1,2);}],["movement used",r=>{r.currentTurn.movementUsedFeet=1;}],["diagonal",r=>{r.currentTurn.normalDiagonalStepsThisTurn=1;}],["fingerprint",r=>{r.board.difficultTerrainCells=["9,9"];}],["squeezing axis",r=>{r.effectInstances[0].squeezingAxis="vertical";}]]) {
 test(`I6 stale ${name}: buffered dice/logs/opportunities never publish`,t=>{
  const {room,actor,sent}=setup({sizeCategory:name==="squeezing axis"?"large":"medium",baseSpeedFeet:100});
  if(name==="squeezing axis"){allNarrow(room);room.effectInstances=[{instanceId:"s",effectId:"srd_squeezing",squeezingAxis:"horizontal",targets:[actor.id],source:{type:"system"},appliedAtEvent:{type:"SystemInjected",round:1}}];}
  enemy(room,4,2);let after;
  dice(t,1,()=>{mutate(room,actor);after=structuredClone(room);});
  assert.throws(()=>handleMoveCombatant(room,command(room,actor,[pos(3,2),pos(4,2),pos(5,2)],true)));
  assert.ok(after);assert.deepEqual(room,after);assert.equal(room.currentTurn.usedMoveAction,false);assert.equal(room.log.length,0);assert.equal(room.pendingOpportunityAttacks.length,0);assert.equal(sent(),0);
 });
}
for(const [roll,pending] of [[20,0],[1,1]]) {
 test(`I6 CD15 ${roll}: legacy evasion and AoO receives doubled movement cost`,t=>{
  const {room,actor}=setup();enemy(room,2,3);dice(t,roll);
  handleMoveCombatant(room,command(room,actor,[pos(3,2)],true));
  assert.equal(room.currentTurn.movementUsedFeet,10);assert.equal(room.pendingOpportunityAttacks.length,pending);
  if(pending)assert.equal(room.pendingOpportunityAttacks[0].movementCostFeet,10);
  assert.ok(room.log.some(l=>l.message.includes("CD 15")));
 });
}
for(const axis of ["horizontal","vertical"]) {
 test(`I6 Move commits ${axis} with next snapshot identical`,()=>{
  const {room,actor}=setup({sizeCategory:"large"});allNarrow(room);const destination=axis==="horizontal"?pos(3,2):pos(2,3);
  handleMoveCombatant(room,command(room,actor,[destination]));assert.equal(room.effectInstances[0].squeezingAxis,axis);
  assert.deepEqual(getCombatantOccupiedCells(actor,createCombatRulesSnapshot(room)),[destination,axis==="horizontal"?pos(destination.x+1,destination.y):pos(destination.x,destination.y+1)]);
 });
}
for(const action of ["withdraw","run"])for(const axis of ["horizontal","vertical"]) {
 test(`I6 legacy ${action} propagates ${axis} without changing cost/economy`,()=>{
  const {room,actor}=setup({sizeCategory:"large"});allNarrow(room);const to=axis==="horizontal"?pos(3,2):pos(2,3);
  handleUseTacticalAction(room,{type:"use-tactical-action",actorId:"gm-i6",combatantId:actor.id,roomCode:room.code,action,to});
  assert.equal(room.effectInstances.find(e=>e.effectId==="srd_squeezing").squeezingAxis,axis);assert.equal(room.currentTurn.movementUsedFeet,10);assert.equal(room.currentTurn.usedFullAttack,true);assert.equal(room.currentTurn.usedMoveAction,false);
 });
}
test("I6 Five-Foot Step keeps legacy squeezing budget rejection",()=>{
 const {room,actor}=setup({sizeCategory:"large"});allNarrow(room);const before=structuredClone(room);
 assert.throws(()=>handleUseTacticalAction(room,{type:"use-tactical-action",actorId:"gm-i6",combatantId:actor.id,roomCode:room.code,action:"five-foot-step",to:pos(3,2)}));assert.deepEqual(room,before);
});
test("I6 spatial transition missing evidence and GM/manual/dynamic producers reject atomically",()=>{
 const {room,actor,sent}=setup({sizeCategory:"large"});const before=structuredClone(room);
 assert.throws(()=>commitSpatialTransition(room,actor,pos(3,2),{spatialMode:"squeezing"}),/evidencia/);
 assert.throws(()=>handleGmApplyEffect(room,{type:"gm-apply-effect",actorId:"gm-i6",targetId:actor.id,effectId:"srd_squeezing"}),/espacial/);
 assert.throws(()=>resolveAbility(room,actor,actor,{name:"Invalid",resolution:{kind:"effect",effectId:"srd_squeezing"}},null),/espacial/);
 assert.deepEqual(room,before);assert.equal(sent(),0);
});


test("I6 Move exits squeezing with confirmed future footprints for AoO",()=>{
 const {room,actor}=setup({sizeCategory:"large"});
 room.board.narrowCells=["2,2","3,2"];
 room.effectInstances=[{instanceId:"s",effectId:"srd_squeezing",squeezingAxis:"horizontal",targets:[actor.id],source:{type:"system"},appliedAtEvent:{type:"SystemInjected",round:1}}];
 handleMoveCombatant(room,command(room,actor,[pos(2,3),pos(2,4)]));
 assert.equal(room.effectInstances.length,0);assert.equal(room.currentTurn.movementUsedFeet,10);
 assert.equal(getCombatantOccupiedCells(actor,createCombatRulesSnapshot(room)).length,4);
 assert.equal(room.log.filter(l=>l.message.includes("dejo el espacio estrecho")).length,1);
});
for(const mode of ["preparation","teleport"]) {
 test(`I6 ${mode} validates explicit natural candidate and clears squeezing`,()=>{
  const {room,actor}=setup({sizeCategory:"large"});room.board.narrowCells=["2,2","3,2"];
  room.effectInstances=[{instanceId:"s",effectId:"srd_squeezing",squeezingAxis:"horizontal",targets:[actor.id],source:{type:"system"},appliedAtEvent:{type:"SystemInjected",round:1}}];
  if(mode==="preparation"){room.phase="preparation";handleMoveCombatant(room,command(room,actor,[pos(5,5)]));}
  else handleGmMoveCombatant(room,{type:"gm-move-combatant",actorId:"gm-i6",combatantId:actor.id,to:pos(5,5)});
  assert.equal(room.effectInstances.length,0);assert.deepEqual(actor.position,pos(5,5));assert.equal(room.currentTurn.movementUsedFeet,0);
 });
}

for(const action of ["withdraw","run"]) {
 test(`I6 legacy ${action} exits squeezing using existing route evidence`,()=>{
  const {room,actor}=setup({sizeCategory:"large"});room.board.narrowCells=["2,2","3,2"];
  room.effectInstances=[{instanceId:"s",effectId:"srd_squeezing",squeezingAxis:"horizontal",targets:[actor.id],source:{type:"system"},appliedAtEvent:{type:"SystemInjected",round:1}}];
  handleUseTacticalAction(room,{type:"use-tactical-action",actorId:"gm-i6",combatantId:actor.id,roomCode:room.code,action,to:pos(2,4),...(action==="withdraw"?{path:[pos(2,3),pos(2,4)]}:{})});
  assert.equal(room.effectInstances.some(e=>e.effectId==="srd_squeezing"),false);assert.equal(room.currentTurn.movementUsedFeet,10);assert.equal(room.currentTurn.usedFullAttack,true);
 });
}

test("I6 prior Five-Foot Step still blocks ordinary Move",()=>{
 const {room,actor}=setup();room.currentTurn.usedFiveFootStep=true;const before=structuredClone(room);
 assert.throws(()=>handleMoveCombatant(room,command(room,actor,[pos(3,2)])),/paso de 5 pies/);assert.deepEqual(room,before);
});
