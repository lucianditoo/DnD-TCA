import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { createEmptyRoom, createDemoCombatant, gameCatalog, type Position } from "@dnd-tactical/shared";
import { handleUseTacticalAction } from "../apps/server/src/commands/tacticalCommands.ts";
import { emptyTurn } from "../apps/server/src/combat/turnManager.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";

/** Only transport/initial state are controlled: every confirmation runs the unchanged I8 handler. */
async function fixture(page: Page, options: { parity?: number; speed?: number; limited?: boolean; terrain?: string[]; large?: boolean; height?: number; blocker?: "dying" | "ally" | "dead" | "active" } = {}) {
  const actor = createDemoCombatant("hero",1,{type:"gm"});
  actor.position={x:2,y:2,zFeet:options.height??0}; actor.baseSpeedFeet=options.speed??30; actor.equipmentSlots.armorItemId=null;
  if(options.limited)actor.hpCurrent=0;
  if(options.large)actor.sizeCategory="large";
  const room=createEmptyRoom("I9UI"); room.phase="active"; room.combatants=[actor];room.turnOrder=[actor.id];room.currentTurn=emptyTurn(actor.id);
  room.currentTurn.normalDiagonalStepsThisTurn=options.parity??0;room.board.difficultTerrainCells=options.terrain??[];
  if(options.large)room.board.narrowCells=Array.from({length:room.board.width*room.board.height},(_,i)=>`${i%room.board.width},${Math.floor(i/room.board.width)}`);
  if(options.blocker){const other=createDemoCombatant("enemy",2,{type:"gm"});other.sizeCategory="medium";other.position={x:3,y:2,zFeet:actor.position.zFeet};
    if(options.blocker==="dying")other.hpCurrent=-1;
    if(options.blocker==="dead")other.hpCurrent=-10;
    if(options.blocker==="ally")other.type=actor.type;
    room.combatants.push(other);
  }
  let route: WebSocketRoute; let held=false;let pending:any;const intents:any[]=[];
  const socket={OPEN:1,readyState:1,send:(message:string)=>route.send(message)};
  const process=(command:any)=>{try{handleUseTacticalAction(room,command);}catch(e){route.send(JSON.stringify({type:"error",message:e instanceof Error?e.message:String(e)}));}};
  await page.routeWebSocket(/:3333\/?$/,ws=>{route=ws;clients.set(socket as any,{id:"i9-ui",role:"gm",name:"I9 GM",roomCode:room.code});
    ws.onMessage(message=>{const command=JSON.parse(String(message));
      if(command.type==="create-room")ws.send(JSON.stringify({type:"hello",room,participant:{id:"i9-ui",role:"gm",name:"I9 GM",roomCode:room.code},catalog:gameCatalog}));
      else if(command.type==="use-tactical-action"){intents.push(command);if(held)pending=command;else process(command);}
    });
  });
  await page.goto("/");await page.getByRole("button",{name:"Crear sala"}).click();await page.getByTestId("view-mode-2d").click();
  await page.getByRole("button",{name:"Mover",exact:true}).click();await page.getByTestId("withdraw-mode").click();
  await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status","empty");
  await expect(page.getByTestId("withdraw-availability")).toContainText("Tu huella inicial completa está exenta");
  return {room,actor,intents,publish:()=>route.send(JSON.stringify({type:"room-update",room})),hold:()=>{held=true;},release:()=>process(pending),
    direct:(path:Position[])=>process({type:"use-tactical-action",action:"withdraw",roomCode:room.code,actorId:"i9-ui",combatantId:actor.id,to:path.at(-1),path}),
    cleanup:()=>clients.delete(socket as any)};
}
const confirm=(page:Page)=>page.getByRole("button",{name:"Confirmar Retirada",exact:true});
for(const [name,options,cells,cost] of [
  ["DT two diagonals",{terrain:["3,3","4,4"]},[[3,3],[4,4]],30],
  ["nonzero context",{parity:1},[[3,3]],10]
] as const)test(`I9 UI/server ${name}`,async({page})=>{
  const f=await fixture(page,{...options,terrain:"terrain" in options?[...options.terrain]:undefined,height:15});
  try{for(const [x,y]of cells)await page.getByTestId(`cell-${x}-${y}`).click();
    await expect(page.getByTestId("movement-preview")).toContainText(`Ruta prevista: ${cost} ft`);
    await expect(page.getByTestId("movement-tumble")).toHaveCount(0);
    await confirm(page).click();await expect.poll(()=>f.room.currentTurn.movementUsedFeet).toBe(cost);
    expect(Object.keys(f.intents[0]).sort()).toEqual(["type","action","roomCode","actorId","combatantId","to","path"].sort());
    expect(f.intents[0].path.every((p:Position)=>p.zFeet===15)).toBe(true);
  }finally{f.cleanup();}
});
test("I9 limited x1 standard action, excess editable, effort only after server commit",async({page})=>{
  const f=await fixture(page,{limited:true,speed:10});try{
    await expect(page.getByTestId("withdraw-availability")).toContainText("Retirada limitada — hasta 1× velocidad — acción estándar");
    await page.getByTestId("cell-3-2").click();await page.getByTestId("cell-4-2").click();
    await expect(page.getByTestId("movement-preview")).toContainText("Ruta prevista: 10 ft");
    await page.getByTestId("cell-5-2").click();await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status","over-budget");
    await expect(page.getByTestId("movement-preview")).toContainText("Policy V1 no completada");await expect(confirm(page)).toBeDisabled();expect(f.actor.hpCurrent).toBe(0);
    await page.getByRole("button",{name:"Deshacer paso"}).click();await confirm(page).click();
    await expect.poll(()=>f.room.currentTurn.usedStandardAction).toBe(true);expect(f.room.currentTurn.usedFullAttack).toBe(false);expect(f.actor.hpCurrent).toBe(-1);
  }finally{f.cleanup();}
});
for(const blocker of ["dying","active","ally","dead"] as const)test(`I9 V1 UI ${blocker} and independent server guard`,async({page})=>{
  const f=await fixture(page,{blocker});try{
    await page.getByTestId("cell-3-2").click();
    if(blocker==="dead"){await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status","legal");await confirm(page).click();await expect.poll(()=>f.room.currentTurn.usedFullAttack).toBe(true);}
    else{await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status","illegal");await expect(confirm(page)).toBeDisabled();
      await expect(page.getByTestId("movement-preview")).toContainText(blocker==="dying"?"Regla de Retirada V1":"Movement");
      const before=structuredClone(f.room);f.direct([{x:3,y:2,zFeet:0}]);expect(f.room).toEqual(before);expect(f.intents).toHaveLength(0);
      if(blocker==="ally"){await page.getByTestId("cell-4-2").click();await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status","legal");await confirm(page).click();await expect.poll(()=>f.room.currentTurn.usedFullAttack).toBe(true);}
    }
  }finally{f.cleanup();}
});
test("I9 room-update recomputes intact draft; economy blocked is separate and cancel stays accessible",async({page})=>{
  const f=await fixture(page,{speed:5});try{
    await page.getByTestId("cell-3-2").click();await page.getByTestId("cell-4-2").click();
    await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status","legal");
    f.room.board.difficultTerrainCells=["3,2"];f.publish();await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status","over-budget");
    f.room.board.difficultTerrainCells=[];f.room.currentTurn.movementUsedFeet=5;f.publish();
    await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status","legal");
    await expect(page.getByTestId("movement-preview")).toContainText("Límite de evaluación: 10 ft; acción bloqueada");
    await expect(confirm(page)).toBeDisabled();await expect(page.getByRole("button",{name:"Deshacer paso"})).toBeEnabled();
    await page.getByTestId("withdraw-mode").click();await expect(page.getByTestId("movement-tumble")).not.toBeChecked();expect(f.intents).toHaveLength(0);
  }finally{f.cleanup();}
});
test("I9 same actor new round clears Withdraw while ordinary lifecycle stays separate",async({page})=>{
  const f=await fixture(page);try{
    await page.getByTestId("cell-3-2").click();f.room.round++;f.publish();
    await expect(page.getByTestId("withdraw-mode")).toHaveText("Retirarse (×2 velocidad)");
    await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status","empty");
    await expect(page.getByTestId("movement-tumble")).not.toBeChecked();expect(f.intents).toHaveLength(0);
  }finally{f.cleanup();}
});
test("I9 delayed intent uses authoritative N+1, no optimistic move or retry",async({page})=>{
  const f=await fixture(page,{speed:5});try{
    await page.getByTestId("cell-3-2").click();await page.getByTestId("cell-4-2").click();f.hold();await confirm(page).click();await expect.poll(()=>f.intents.length).toBe(1);
    expect(f.actor.position).toEqual({x:2,y:2,zFeet:0});f.room.board.difficultTerrainCells=["3,2"];f.release();
    await expect(page.getByText(/intenta mover 15 pies, pero solo tiene 10 pies disponibles/)).toBeVisible();expect(f.actor.position.x).toBe(2);expect(f.room.currentTurn.movementUsedFeet).toBe(0);expect(f.intents).toHaveLength(1);
  }finally{f.cleanup();}
});
test("I9 squeezing same ghost/cost/axis in 2D and 2.5D, four cameras and server confirmation",async({page})=>{
  const f=await fixture(page,{large:true});try{
    await page.getByTestId("cell-3-2").click();await expect(page.getByTestId("cell-3-2")).toHaveAttribute("data-route-axis","horizontal");
    await expect(page.getByTestId("cell-4-2")).toHaveAttribute("data-route-ghost","true");await page.getByTestId("view-mode-25d").click();
    for(const angle of ["nw","ne","se","sw"]){await page.getByTestId(`camera-angle-${angle}`).click();await expect(page.getByTestId("scene-cell-3-2")).toHaveAttribute("data-route-axis","horizontal");await expect(page.getByTestId("scene-cell-3-2")).toHaveAttribute("data-route-cost","10");await expect(page.getByTestId("scene-cell-4-2")).toHaveAttribute("data-route-ghost","true");await expect(page.getByTestId("movement-preview")).toContainText("Ruta prevista: 10 ft");}
    expect(f.actor.position.x).toBe(2);expect(f.room.effectInstances).toHaveLength(0);await confirm(page).click();
    await expect.poll(()=>f.room.effectInstances.find(e=>e.effectId==="srd_squeezing")?.squeezingAxis).toBe("horizontal");expect(f.room.currentTurn.movementUsedFeet).toBe(10);
  }finally{f.cleanup();}
});
