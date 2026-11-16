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
  const room = makeTestRoom({ board: board(["03,2"]), combatants: [caster, near, behind] });
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
    combatants: [caster, victim("near", 4, 3), victim("behind", 6, 2)] });
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

for (const [name, hp, hardness, broken] of [
  ["papel", 2, 0, true], ["cristal", 1, 1, true], ["madera", 10, 5, false],
  ["piedra", 15, 8, false], ["hierro", 30, 10, false],
]) {
  test("Fireball 8d6 aplica mitad de daño a barrera de " + name, () => {
    const room = makeTestRoom({ board: { ...board(["3,2"]), barrierCells: { "3,2": { hp, hardness } } },
      combatants: [caster, victim("behind", 4, 2)] });
    const snapshot = createCombatRulesSnapshot(room);
    const before = structuredClone(snapshot);
    const result = projectSpellArea(snapshot, caster, get("fireball"), east);
    assert.equal(result.ok, true);
    assert.deepEqual(result.origin, { x: 3, y: 2 });
    assert.deepEqual(result.destroyedBarrierKeys, broken ? ["3,2"] : []);
    assert.equal(result.affectedIds.includes("behind"), broken);
    assert.deepEqual(snapshot, before);
    assert.deepEqual(room.board.barrierCells, { "3,2": { hp, hardness } });
  });
}

test("Lightning Bolt y Burning Hands usan mitad de daño al evaluar una barrera", () => {
  const snapshot = createCombatRulesSnapshot(makeTestRoom({
    board: { ...board(["3,2"]), barrierCells: { "3,2": { hp: 5, hardness: 3 } } },
    combatants: [caster, victim("behind", 4, 2)],
  }));
  const line = projectSpellArea(snapshot, caster, get("lightning_bolt"), east);
  const cone = projectSpellArea(snapshot, caster, get("burning_hands"), east);
  assert.deepEqual(line.destroyedBarrierKeys, ["3,2"]);
  assert.ok(line.affectedIds.includes("behind"));
  assert.deepEqual(cone.destroyedBarrierKeys, []);
  assert.ok(!cone.affectedIds.includes("behind"));
});

test("Fireball detona en el primer cuerpo y no en la barrera posterior", () => {
  const snapshot = createCombatRulesSnapshot(makeTestRoom({ board: board(["6,2"]),
    combatants: [caster, victim("first", 3, 2), victim("second", 5, 2)] }));
  const result = projectSpellArea(snapshot, caster, get("fireball"), east);
  assert.equal(result.earlyDetonation, true);
  assert.deepEqual(result.origin, { x: 3, y: 2 });
  assert.ok(result.affectedIds.includes("first"));
  assert.ok(result.affectedIds.includes("second"));
});

test("Fireball atraviesa un corredor de una casilla sin tirar dados", () => {
  const walls = [1, 3].flatMap(y => Array.from({ length: 5 }, (_, index) => (index + 3) + "," + y));
  const corridorCaster = victim("caster", 2, 2);
  const snapshot = createCombatRulesSnapshot(makeTestRoom({ board: board(walls), combatants: [corridorCaster] }));
  const result = projectSpellArea(snapshot, corridorCaster, get("fireball"), { targetPosition: at(8, 2) });
  assert.deepEqual(result.origin, { x: 8, y: 2 });
  assert.equal(result.earlyDetonation, false);
});
