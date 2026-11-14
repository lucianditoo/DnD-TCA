import test from "node:test";
import assert from "node:assert/strict";
import { createCombatRulesSnapshot, projectSpellArea, SpellsCatalog } from "../packages/shared/src/index.ts";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";
import { buildBoardPresentationModel, DEFAULT_CAMERA_STATE } from "../apps/web/src/components/Board/presentationModel.ts";

const at = (x, y) => ({ x, y, zFeet: 0 });
const caster = makeTestCombatant({ id: "caster", position: at(1, 2) });
const victim = (id, x, y, extra = {}) => makeTestCombatant({ id, position: at(x, y), ...extra });
const board = (walls = []) => ({ width: 12, height: 10, cellSizeFeet: 5, lineOfEffectBlockingCells: walls });
const get = (name) => SpellsCatalog.require("srd_" + name);
const east = { direction: "E", targetPosition: at(9, 2) };

test("Lightning Bolt termina en el pilar y la LoE del cono deja una sombra", () => {
  const near = victim("near", 2, 2);
  const behind = victim("behind", 4, 2);
  const room = makeTestRoom({ board: board(["3,2"]), combatants: [caster, near, behind] });
  const snapshot = createCombatRulesSnapshot(room);
  for (const name of ["lightning_bolt", "burning_hands"]) {
    const result = projectSpellArea(snapshot, caster, get(name), east);
    assert.equal(result.ok, true);
    assert.deepEqual(result.origin, { x: 2, y: 2 });
    assert.deepEqual(result.affectedIds, ["near"]);
    assert.ok(result.cells.every(cell => cell.x !== 3 || cell.y !== 2));
    if (name === "lightning_bolt") assert.ok(result.cells.every(cell => cell.x < 3));
  }
});

test("Fireball detona en la primera barrera; el preview dibuja las mismas celdas alcanzadas", () => {
  const room = makeTestRoom({ board: board(Array.from({ length: 10 }, (_, y) => "5," + y)),
    combatants: [caster, victim("near", 4, 2), victim("behind", 6, 2)] });
  const snapshot = createCombatRulesSnapshot(room);
  const result = projectSpellArea(snapshot, caster, get("fireball"), east);
  assert.equal(result.ok, true);
  assert.equal(result.earlyDetonation, true);
  assert.equal(result.origin.x, 5);
  assert.ok(result.affectedIds.includes("near"));
  assert.ok(!result.affectedIds.includes("behind"));
  const view = buildBoardPresentationModel({ room, snapshot, selected: caster, targetId: "",
    displayedPath: [], displayedPathCosts: [], highlightedCells: new Map(), chargePreviewPath: null,
    actionMode: "ability", preparedSpellId: "srd_fireball", targetPosition: east.targetPosition, camera: DEFAULT_CAMERA_STATE });
  const marked = view.cells.filter(cell => cell.className.includes("aoe-preview")).map(cell => [cell.x, cell.y]);
  assert.equal(marked.length, result.cells.length);
  assert.deepEqual(new Set(marked.map(String)), new Set(result.cells.map(cell => [cell.x, cell.y].toString())));
});

test("Fireball valida el origen y usa la misma celda alcanzada para una huella Large", () => {
  const large = victim("large", 5, 3, { sizeCategory: "large" });
  const room = makeTestRoom({ board: board(), combatants: [caster, large] });
  const snapshot = createCombatRulesSnapshot(room);
  const spell = { ...get("fireball"), rangeFeet: 15 };
  assert.equal(projectSpellArea(snapshot, caster, spell, { targetPosition: at(5, 3) }).ok, true);
  for (const targetPosition of [undefined, at(6, 3), at(-1, 0), at(2.5, 1), at(2, 3.5), { ...at(2, 3), zFeet: 5 }]) {
    assert.equal(projectSpellArea(snapshot, caster, spell, { targetPosition }).ok, false);
  }
  const result = projectSpellArea(snapshot, caster, get("fireball"), { targetPosition: at(3, 3) });
  assert.equal(result.ok, true);
  assert.ok(result.affectedIds.includes("large"));
  assert.ok(result.cells.some(cell => cell.x === 5 && cell.y === 3));
  assert.ok(!result.cells.some(cell => cell.x === 6 && cell.y === 4));
});

test("Lightning Bolt diagonal respeta el rango 5-10-5 y la barrera de esquina", () => {
  const snapshot = createCombatRulesSnapshot(makeTestRoom({ board: board(), combatants: [caster] }));
  const spell = { ...get("lightning_bolt"), aoe: { ...get("lightning_bolt").aoe, lengthFeet: 15 } };
  const aim = { direction: "SE" };
  assert.deepEqual(projectSpellArea(snapshot, caster, spell, aim).cells, [at(2, 3), at(3, 4)]);
  const blocked = createCombatRulesSnapshot(makeTestRoom({ board: board(["3,3"]), combatants: [caster] }));
  assert.deepEqual(projectSpellArea(blocked, caster, spell, aim).cells, [at(2, 3)]);
});

test("Fireball oblicua prorratea la segunda diagonal desde el punto de impacto", () => {
  const snapshot = createCombatRulesSnapshot(makeTestRoom({ board: board(["5,2"]), combatants: [caster] }));
  const result = projectSpellArea(snapshot, caster, get("fireball"), { targetPosition: at(9, 3) });
  assert.equal(result.ok, true);
  assert.equal(result.earlyDetonation, true);
  assert.equal(result.origin.x, 5);
  assert.ok(result.origin.y > 2 && result.origin.y < 3);
  assert.ok(!result.cells.some(cell => cell.x === 1 && cell.y === 1));
  assert.ok(result.cells.some(cell => cell.x === 1 && cell.y === 2));
});
