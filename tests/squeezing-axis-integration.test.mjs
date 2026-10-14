import test from "node:test";
import assert from "node:assert/strict";
import { EffectManager, cloneEffectInstances, createCombatRulesSnapshot, getCombatantOccupiedCells,
  resolveMovementPipeline, commitMovementResolution, createMovementStateFingerprint } from "@dnd-tactical/shared";
import { makeTestRoom, makeTestCombatant } from "./test-utils.mjs";
import { readFileSync } from "node:fs";

const effect = (axis) => ({ instanceId: "squeeze", effectId: "srd_squeezing", source: {type:"system"}, targets:["hero-test"], appliedAtEvent:{type:"SystemInjected",round:1}, ...(axis === undefined ? {} : {squeezingAxis:axis}) });
function setup(size="large") {
  const actor=makeTestCombatant({sizeCategory:size,position:{x:2,y:2,zFeet:5}});
  const room=makeTestRoom({combatants:[actor]});
  room.board.narrowCells=Array.from({length:100},(_,i)=>`${i%10},${Math.floor(i/10)}`);
  return {room,actor};
}
function commit(room,actor,path) {
  const resolution=resolveMovementPipeline({context:createCombatRulesSnapshot(room),combatant:actor,path,availableBudgetFeet:100,initialContext:{normalDiagonalStepsThisTurn:room.currentTurn.normalDiagonalStepsThisTurn}});
  assert.equal(resolution.kind,"ready");
  const result=commitMovementResolution({room,combatant:actor,resolution,preconditions:{expectedTurnCombatantId:actor.id,expectedRound:room.round,expectedOrigin:{...actor.position},expectedMovementUsedFeet:room.currentTurn.movementUsedFeet}});
  assert.equal(result.kind,"committed");
  assert.deepEqual(getCombatantOccupiedCells(actor,createCombatRulesSnapshot(room)),result.occupiedCells);
  return {result,resolution};
}
for (const axis of ["horizontal","vertical"]) {
 test(`I6 manager/snapshot/JSON preserve ${axis} defensively`,()=>{
  const {room}=setup(); const input=effect(axis); const added=EffectManager.add(room,input);
  assert.equal(added.effectInstances[0].squeezingAxis,axis);
  input.squeezingAxis=axis==="horizontal"?"vertical":"horizontal"; input.targets[0]="other"; input.source.type="environment";
  assert.equal(added.effectInstances[0].squeezingAxis,axis); assert.deepEqual(added.effectInstances[0].targets,["hero-test"]);
  assert.equal(added.effectInstances[0].source.type,"system");
  const clone=cloneEffectInstances(added.effectInstances);
  assert.notEqual(clone[0].targets,added.effectInstances[0].targets);
  assert.equal(createCombatRulesSnapshot(added).effectInstances[0].squeezingAxis,axis);
  assert.equal(JSON.parse(JSON.stringify(added)).effectInstances[0].squeezingAxis,axis);
  assert.equal(EffectManager.remove(added,"squeeze").effectInstances.length,0);
  assert.equal(EffectManager.removeMany(added,["squeeze"]).effectInstances.length,0);
 });
}
test("I6 manager validates structure before onStack early return, without geometry",()=>{
 const room=makeTestRoom(); room.board=null; room.combatants=[];
 const added=EffectManager.add(room,effect("horizontal"));
 for(const input of [{...effect("diagonal")},{...effect("horizontal"),effectId:"srd_prone"}]) {
  const before=structuredClone(added); assert.throws(()=>EffectManager.add(added,input),/Invalid squeezingAxis/); assert.deepEqual(added,before);
 }
 assert.equal(EffectManager.add(room,effect()).effectInstances[0].squeezingAxis,undefined);
 const ordinary=EffectManager.add(room,{...effect(),effectId:"srd_prone"}); assert.equal("squeezingAxis" in ordinary.effectInstances[0],false);
 const leaf=readFileSync(new URL("../packages/shared/src/movementContracts.ts",import.meta.url),"utf8");
 assert.doesNotMatch(leaf,/\bimport\b/);
 const manager=readFileSync(new URL("../packages/shared/src/effects/manager.ts",import.meta.url),"utf8");
 assert.doesNotMatch(manager,/movementGeometry|sizeRules|room\.board|sizeCategory/);
});
for(const invalid of ["missing","invalid","duplicate","illegal"]) {
 test(`I6 geometry integrity: ${invalid}`,()=>{
  const {room,actor}=setup(); room.effectInstances=[effect(invalid==="missing"?undefined:invalid==="invalid"?"diagonal":"vertical")];
  if(invalid==="duplicate")room.effectInstances.push({...effect("vertical"),instanceId:"duplicate"});
  if(invalid==="illegal")room.board.narrowCells=["2,2","3,2"];
  const before=structuredClone(room); assert.throws(()=>getCombatantOccupiedCells(actor,room),/Integridad espacial/); assert.deepEqual(room,before);
 });
}
test("I6 effect-only nonorientable axisless fixture remains legal",()=>{
 const {room,actor}=setup("medium"); room.effectInstances=[effect()];
 assert.deepEqual(getCombatantOccupiedCells(actor,room),[{x:2,y:2,zFeet:5}]);
});
test("I6 both axes legal: persisted orientation, deterministic replacement and natural cleanup",()=>{
 const {room,actor}=setup();
 commit(room,actor,[{x:3,y:2,zFeet:5}]); assert.equal(room.effectInstances[0].squeezingAxis,"horizontal");
 const first=room.effectInstances[0].instanceId;
 commit(room,actor,[{x:4,y:2,zFeet:5}]); assert.equal(room.effectInstances[0].instanceId,first);
 commit(room,actor,[{x:4,y:3,zFeet:5}]); assert.equal(room.effectInstances[0].squeezingAxis,"vertical"); assert.notEqual(room.effectInstances[0].instanceId,first);
 const vertical=room.effectInstances[0].instanceId;
 commit(room,actor,[{x:5,y:3,zFeet:5}]); assert.equal(room.effectInstances[0].squeezingAxis,"horizontal"); assert.notEqual(room.effectInstances[0].instanceId,vertical);
 room.board.narrowCells=["5,3","6,3"];
 commit(room,actor,[{x:5,y:4,zFeet:5}]); assert.equal(room.effectInstances.length,0);
});
test("I6 fingerprint tracks confirmed axis, stale commit leaves state untouched",()=>{
 const {room,actor}=setup(); room.effectInstances=[effect("horizontal")];
 const preconditions={expectedTurnCombatantId:actor.id,expectedRound:room.round,expectedOrigin:{...actor.position},expectedMovementUsedFeet:0};
 const resolution=resolveMovementPipeline({context:room,combatant:actor,path:[{x:3,y:2,zFeet:5}],availableBudgetFeet:100,initialContext:{normalDiagonalStepsThisTurn:0}});
 const fingerprint=createMovementStateFingerprint(room,actor); room.effectInstances[0].squeezingAxis="vertical";
 assert.notEqual(createMovementStateFingerprint(room,actor),fingerprint);
 const before=structuredClone(room); const result=commitMovementResolution({room,combatant:actor,resolution,preconditions});
 assert.equal(result.rejectionCode,"stale-rules-state"); assert.deepEqual(room,before);
});
test("I6 commit refuses squeezing without confirmed axis before mutation",()=>{
 const {room,actor}=setup(); const resolution=resolveMovementPipeline({context:room,combatant:actor,path:[{x:3,y:2,zFeet:5}],availableBudgetFeet:100,initialContext:{normalDiagonalStepsThisTurn:0}});
 delete resolution.steps[0].squeezingAxis; const before=structuredClone(room);
 const result=commitMovementResolution({room,combatant:actor,resolution,preconditions:{expectedTurnCombatantId:actor.id,expectedRound:1,expectedOrigin:{...actor.position},expectedMovementUsedFeet:0}});
 assert.equal(result.rejectionCode,"invalid-spatial-evidence"); assert.deepEqual(room,before);
});
