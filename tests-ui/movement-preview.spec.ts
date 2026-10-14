import { test, expect, type Page, type WebSocketRoute } from "@playwright/test";
import { createEmptyRoom, createDemoCombatant, gameCatalog, type CombatRoom } from "@dnd-tactical/shared";
import { handleMoveCombatant } from "../apps/server/src/commands/movementCommands.ts";
import { emptyTurn } from "../apps/server/src/combat/turnManager.ts";
import { clients } from "../apps/server/src/room/roomStore.ts";

/** Controlled transport fixture running the actual, unchanged I6 command handler.
 * It makes initial parity and server dice deterministic without adding test APIs to production. */
async function openFixture(page: Page, options: { parity?: number; speed?: number; height?: number; difficult?: string[]; enemy?: boolean; large?: boolean } = {}) {
  const actor = createDemoCombatant("hero", 1, { type: "gm" });
  actor.position = { x: 2, y: 2, zFeet: options.height ?? 0 };
  actor.baseSpeedFeet = options.speed ?? 30;
  actor.equipmentSlots.armorItemId = null;
  actor.abilityScores.dexterity = 30;
  if (options.large) actor.sizeCategory = "large";
  const room: CombatRoom = createEmptyRoom("I7UI");
  room.phase = "active"; room.combatants = [actor]; room.turnOrder = [actor.id]; room.currentTurn = emptyTurn(actor.id);
  room.currentTurn.normalDiagonalStepsThisTurn = options.parity ?? 0;
  room.board.difficultTerrainCells = options.difficult ?? [];
  if (options.large) room.board.narrowCells = ["3,2", "4,2", "3,3"];
  if (options.enemy) {
    const enemy = createDemoCombatant("enemy", 2, { type: "gm" }); enemy.sizeCategory = "medium";
    enemy.position = { x: 3, y: 2, zFeet: actor.position.zFeet }; room.combatants.push(enemy);
  }
  let route: WebSocketRoute;
  const intents: Record<string, any>[] = [];
  const socket = { OPEN: 1, readyState: 1, send: (message: string) => route.send(message) };
  let delay = false;
  let pending: any;
  function process(command: any) {
    const random = Math.random;
    Math.random = () => .99;
    try { handleMoveCombatant(room, command); }
    catch (error) { route.send(JSON.stringify({ type: "error", message: error instanceof Error ? error.message : String(error) })); }
    finally { Math.random = random; }
  }
  await page.routeWebSocket(/:3333\/?$/, ws => {
    route = ws;
    clients.set(socket as any, { id: "i7-gm", role: "gm", name: "Preview GM", roomCode: room.code });
    ws.onMessage(message => {
      const command = JSON.parse(String(message));
      if (command.type === "create-room") ws.send(JSON.stringify({ type: "hello", room, participant: { id: "i7-gm", role: "gm", name: "Preview GM", roomCode: room.code }, catalog: gameCatalog }));
      else if (command.type === "move-combatant") { intents.push(command); if (delay) pending = command; else process(command); }
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Crear sala" }).click();
  await page.getByTestId("view-mode-2d").click();
  await page.getByRole("button", { name: "Mover", exact: true }).click();
  await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status", "empty");
  return { actor, room, intents, hold: () => { delay = true; }, release: () => process(pending),
    publish: () => route.send(JSON.stringify({ type: "room-update", room })), cleanup: () => clients.delete(socket as any) };
}

for (const [name, options, cells, cost] of [
  ["DT two diagonals", { difficult: ["3,3", "4,4"] }, [[3,3],[4,4]], 30],
  ["initial diagonal context", { parity: 1 }, [[3,3]], 10]
] as const) {
  test(`I7 UI/server parity: ${name}`, async ({ page }) => {
    const fixture = await openFixture(page, { ...options, difficult: "difficult" in options ? [...options.difficult] : undefined });
    try {
      for (const [x,y] of cells) await page.getByTestId(`cell-${x}-${y}`).click();
      await expect(page.getByTestId("movement-preview")).toContainText(`Ruta prevista: ${cost} ft`);
      await expect(page.getByTestId(`cell-${cells.at(-1)![0]}-${cells.at(-1)![1]}`)).toContainText(`${cost} ft`);
      await page.getByRole("button", { name: "Confirmar movimiento", exact: true }).click();
      await expect.poll(() => fixture.room.currentTurn.movementUsedFeet).toBe(cost);
      expect(fixture.intents[0].isAcrobatic).toBe(false);
      expect(Object.keys(fixture.intents[0]).sort()).toEqual(["type","roomCode","actorId","combatantId","to","path","isAcrobatic"].sort());
    } finally { fixture.cleanup(); }
  });
}

test("I7 Tumble drafts occupied endpoint then exit, CD25 is contingent and payload stays intent", async ({ page }) => {
  const fixture = await openFixture(page, { enemy: true, height: 15 });
  try {
    await page.getByTestId("movement-tumble").check();
    await page.getByTestId("cell-3-2").click();
    await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status", "illegal");
    await expect(page.getByRole("button", { name: "Confirmar movimiento", exact: true })).toBeDisabled();
    await page.getByTestId("cell-4-2").click();
    await expect(page.getByTestId("movement-preview")).toContainText("Ruta prevista: 20 ft");
    await expect(page.getByTestId("movement-preview")).toContainText("CD 25; el servidor puede interrumpir la ruta");
    expect(fixture.actor.position).toEqual({ x: 2, y: 2, zFeet: 15 });
    await page.getByRole("button", { name: "Confirmar movimiento", exact: true }).click();
    await expect.poll(() => fixture.room.currentTurn.movementUsedFeet).toBe(20);
    expect(fixture.intents[0].isAcrobatic).toBe(true);
    expect(fixture.intents[0].path.every((p: any) => p.zFeet === 15)).toBe(true);
    expect(fixture.room.log.some(entry => entry.message.includes("CD 25"))).toBe(true);
  } finally { fixture.cleanup(); }
});

test("I7 over-budget is editable and distinct from illegal; Tumble and mode switches recalculate", async ({ page }) => {
  const fixture = await openFixture(page, { speed: 5 });
  try {
    await page.getByTestId("cell-3-2").click();
    await page.getByTestId("movement-tumble").check();
    await expect(page.getByTestId("movement-preview")).toContainText("Exceso 5 ft");
    await page.getByTestId("cell-4-2").click();
    await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status", "over-budget");
    await expect(page.getByRole("button", { name: "Confirmar movimiento", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Deshacer paso" }).click();
    await page.getByTestId("movement-tumble").uncheck();
    await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status", "legal");
    await page.getByTestId("movement-five-foot-mode").click();
    await expect(page.getByTestId("movement-preview")).toHaveCount(0);
    await expect(page.getByTestId("movement-tumble")).toHaveCount(0);
    await page.getByTestId("movement-five-foot-mode").click();
    await expect(page.getByTestId("movement-tumble")).not.toBeChecked();
    expect(fixture.room.currentTurn.movementUsedFeet).toBe(0); expect(fixture.intents).toHaveLength(0);
  } finally { fixture.cleanup(); }
});

test("I7 stale intent is processed by authoritative I6 against state N+1 without optimistic move", async ({ page }) => {
  const fixture = await openFixture(page, { speed: 5 });
  try {
    await page.getByTestId("cell-3-2").click();
    await expect(page.getByTestId("movement-preview")).toContainText("Ruta prevista: 5 ft");
    fixture.room.board.difficultTerrainCells = ["3,2"];
    fixture.publish();
    await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status", "over-budget");
    await expect(page.getByTestId("movement-preview")).toContainText("Exceso 5 ft");
    await expect(page.getByRole("button", { name: "Confirmar movimiento", exact: true })).toBeDisabled();
    fixture.room.board.difficultTerrainCells = [];
    fixture.publish();
    await expect(page.getByTestId("movement-preview")).toHaveAttribute("data-preview-status", "legal");
    fixture.hold();
    await page.getByRole("button", { name: "Confirmar movimiento", exact: true }).click();
    await expect.poll(() => fixture.intents.length).toBe(1);
    fixture.room.board.difficultTerrainCells = ["3,2"];
    fixture.release();
    await expect(page.getByText(/intenta mover 10 pies, pero solo tiene 5 pies disponibles/)).toBeVisible();
    expect(fixture.actor.position).toEqual({ x: 2, y: 2, zFeet: 0 });
    expect(fixture.room.currentTurn.movementUsedFeet).toBe(0); expect(fixture.intents).toHaveLength(1);
  } finally { fixture.cleanup(); }
});

test("I7 both board views consume the same squeezing ghost and persisted token position", async ({ page }) => {
  const fixture = await openFixture(page, { large: true });
  try {
    await page.getByTestId("cell-3-2").click();
    await expect(page.getByTestId("cell-3-2")).toHaveAttribute("data-route-axis", "horizontal");
    await expect(page.getByTestId("cell-4-2")).toHaveAttribute("data-route-ghost", "true");
    await page.getByTestId("view-mode-25d").click();
    await expect(page.getByTestId("scene-cell-3-2")).toHaveAttribute("data-route-axis", "horizontal");
    await expect(page.getByTestId("scene-cell-4-2")).toHaveAttribute("data-route-ghost", "true");
    await expect(page.getByTestId("movement-preview")).toContainText("Ruta prevista: 10 ft");
    expect(fixture.actor.position).toEqual({ x: 2, y: 2, zFeet: 0 }); expect(fixture.room.effectInstances).toHaveLength(0);
  } finally { fixture.cleanup(); }
});
