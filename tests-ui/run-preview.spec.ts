import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { createEmptyRoom, createDemoCombatant, gameCatalog, type Position } from "@dnd-tactical/shared";
import { handleUseTacticalAction } from "../apps/server/src/commands/tacticalCommands.ts";
import { emptyTurn } from "../apps/server/src/combat/turnManager.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";

/** Only transport/initial state are controlled: every confirmation runs the unchanged I10 handler. */
async function fixture(page: Page, options: { heavy?: boolean; large?: boolean; height?: number } = {}) {
  const actor = createDemoCombatant("hero",1,{type:"gm"});
  actor.position={x:2,y:2,zFeet:options.height??0}; actor.baseSpeedFeet=30; actor.equipmentSlots.armorItemId=null;
  if (options.heavy) { actor.inventory.push({ itemId: "heavy", catalogId: "banded_mail" }); actor.equipmentSlots.armorItemId = "heavy"; }
  if(options.large)actor.sizeCategory="large";
  const room=createEmptyRoom("I11UI"); room.board=structuredClone(room.board); room.phase="active"; room.combatants=[actor];room.turnOrder=[actor.id];room.currentTurn=emptyTurn(actor.id);
  room.board.difficultTerrainCells=[];
  if(options.large)room.board.narrowCells=Array.from({length:room.board.width*room.board.height},(_,i)=>`${i%room.board.width},${Math.floor(i/room.board.width)}`);
  let route: WebSocketRoute; let held=false;let pending:any;const intents:any[]=[];
  const socket={OPEN:1,readyState:1,send:(message:string)=>route.send(message)};
  const process=(command:any)=>{try{handleUseTacticalAction(room,command);}catch(e){route.send(JSON.stringify({type:"error",message:e instanceof Error?e.message:String(e)}));}};
  await page.routeWebSocket(/:3333\/?$/,ws=>{route=ws;clients.set(socket as any,{id:"i11-ui",role:"gm",name:"I11 GM",roomCode:room.code});
    ws.onMessage(message=>{const command=JSON.parse(String(message));
      if(command.type==="create-room")ws.send(JSON.stringify({type:"hello",room,participant:{id:"i11-ui",role:"gm",name:"I11 GM",roomCode:room.code},catalog:gameCatalog}));
      else if(command.type==="use-tactical-action"){intents.push(command);if(held)pending=command;else process(command);}
    });
  });
  await page.goto("/");await page.getByRole("button",{name:"Crear sala"}).click();await page.getByTestId("view-mode-2d").click();
  await page.getByRole("button",{name:"Mover",exact:true}).click();await page.getByTestId("run-mode").click();
  await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status","empty");

  return {room,actor,intents,publish:()=>route.send(JSON.stringify({type:"room-update",room})),hold:()=>{held=true;},release:()=>process(pending),
    direct:(to:Position)=>process({type:"use-tactical-action",action:"run",roomCode:room.code,actorId:"i11-ui",combatantId:actor.id,to}),
    cleanup:()=>clients.delete(socket as any)};
}

const confirm = (page: Page) => page.getByRole("button", { name: "Confirmar Correr", exact: true });
const preview = (page: Page) => page.getByTestId("movement-preview");

test("I11 endpoint, two diagonals, destination-only intent and authoritative exposure", async ({ page }) => {
  const f = await fixture(page);
  try {
    const offRay = page.getByTestId("cell-5-3");
    await expect(offRay).not.toHaveClass(/move-candidate/);
    await offRay.click();
    await expect(preview(page)).toHaveAttribute("data-preview-status", "empty");
    await page.getByTestId("cell-4-4").click();
    await expect(preview(page)).toContainText("Ruta prevista: 15 ft");
    await expect(preview(page)).toContainText("Paridad diagonal prevista: 2");
    await expect(page.getByTestId("movement-tumble")).toHaveCount(0);
    f.hold();
    await confirm(page).click();
    await expect.poll(() => f.intents.length).toBe(1);
    expect(Object.keys(f.intents[0]).sort()).toEqual(["type", "action", "roomCode", "actorId", "combatantId", "to"].sort());
    expect(f.intents[0].to).toEqual({ x: 4, y: 4, zFeet: 0 });
    expect(f.actor.position).toEqual({ x: 2, y: 2, zFeet: 0 });
    expect(f.room.effectInstances.some(e => e.effectId === "srd_running_exposed")).toBe(false);
    f.release();
    await expect.poll(() => f.room.currentTurn.movementUsedFeet).toBe(15);
    expect(f.room.currentTurn.normalDiagonalStepsThisTurn).toBe(2);
    expect(f.room.effectInstances.some(e => e.effectId === "srd_running_exposed")).toBe(true);
  } finally { f.cleanup(); }
});

test("I11 heavy armor, server budget and room-update keep the endpoint", async ({ page }) => {
  const f = await fixture(page, { heavy: true });
  try {
    await expect(page.getByTestId("run-availability")).toContainText("60 ft (×3");
    await page.getByTestId("cell-6-2").click();
    await expect(preview(page)).toContainText("Ruta prevista: 20 ft");
    f.actor.equipmentSlots.armorItemId = null;
    f.actor.baseSpeedFeet = 3;
    f.room.board.difficultTerrainCells = ["3,2"];
    f.publish();
    await expect(preview(page)).toHaveAttribute("data-preview-status", "over-budget");
    f.actor.baseSpeedFeet = 30;
    f.actor.equipmentSlots.armorItemId = "heavy";
    f.publish();
    await expect(preview(page)).toContainText("Regla de Correr");
    await expect(confirm(page)).toBeDisabled();
    f.direct({ x: 6, y: 2, zFeet: 0 });
    expect(f.room.currentTurn.movementUsedFeet).toBe(0);
    f.room.board.difficultTerrainCells = [];
    f.publish();
    await expect(preview(page)).toContainText("Ruta prevista: 20 ft");
    await confirm(page).click();
    await expect.poll(() => f.room.currentTurn.movementUsedFeet).toBe(20);
  } finally { f.cleanup(); }
});

test("I11 FORBID_RUN and spent economy keep route evidence and allow cancel", async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.getByTestId("cell-3-2").click();
    f.room.effectInstances.push({ instanceId: "blind", effectId: "srd_blinded", targets: [f.actor.id],
      source: { type: "system" }, appliedAtEvent: { type: "SystemInjected", round: 1 } });
    f.publish();
    await expect(preview(page)).toHaveAttribute("data-preview-status", "legal");
    await expect(page.getByTestId("movement-action-blocked")).toContainText("no puede correr");
    await expect(confirm(page)).toBeDisabled();
    f.room.phase = "critical-confirmation";
    f.publish();
    await expect(preview(page)).toHaveAttribute("data-preview-status", "legal");
    await expect(page.getByTestId("movement-action-blocked")).toBeVisible();
    f.room.phase = "active";
    f.room.effectInstances = [];
    f.room.currentTurn.usedStandardAction = true;
    f.publish();
    await expect(page.getByTestId("movement-action-blocked")).toBeVisible();
    await page.getByRole("button", { name: "Cancelar Correr" }).click();
    await expect(page.getByTestId("movement-tumble")).toBeVisible();
  } finally { f.cleanup(); }
});

test("I11 squeezing projection and commit share the horizontal axis", async ({ page }) => {
  const f = await fixture(page, { large: true, height: 15 });
  try {
    await page.getByTestId("cell-4-2").click();
    await expect(preview(page)).toContainText("Squeezing horizontal");
    await expect(page.getByTestId("cell-4-2")).toHaveAttribute("data-route-axis", "horizontal");
    await page.getByTestId("view-mode-25d").click();
    await expect(page.getByTestId("scene-cell-4-2")).toHaveAttribute("data-route-axis", "horizontal");
    await confirm(page).click();
    await expect.poll(() => f.room.effectInstances.find(e => e.effectId === "srd_squeezing")?.squeezingAxis).toBe("horizontal");
  } finally { f.cleanup(); }
});

test("I11 new round clears Run; stale confirmation is rejected without optimistic movement", async ({ page }) => {
  const f = await fixture(page);
  try {
    await page.getByTestId("cell-4-2").click();
    f.room.round++;
    f.publish();
    await expect(page.getByTestId("run-mode")).toHaveText(/Correr.*×4/);
    await page.getByTestId("run-mode").click();
    await expect(preview(page)).toHaveAttribute("data-preview-status", "empty");
    await page.getByTestId("cell-4-2").click();
    f.hold();
    await confirm(page).click();
    await expect.poll(() => f.intents.length).toBe(1);
    f.room.board.impassableCells = ["3,2"];
    f.release();
    await expect(page.getByText(/muro|obstaculo/i)).toBeVisible();
    expect(f.actor.position).toEqual({ x: 2, y: 2, zFeet: 0 });
    expect(f.room.currentTurn.movementUsedFeet).toBe(0);
    expect(f.intents).toHaveLength(1);
  } finally { f.cleanup(); }
});
