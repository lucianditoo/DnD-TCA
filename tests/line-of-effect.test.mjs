import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getLineOfEffect, createCombatRulesSnapshot } from "@dnd-tactical/shared";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

function roomWith(originPos, targetPos, boardOverrides = {}, extra = {}) {
  const origin = makeTestCombatant({ id: "origin", position: originPos });
  const target = makeTestCombatant({ id: "target", position: targetPos });
  const room = makeTestRoom({
    combatants: [origin, target, ...(extra.combatants ?? [])],
    board: { width: 10, height: 10, cellSizeFeet: 5, ...boardOverrides }
  });
  return { room, origin, target };
}

describe("Sprint 052B - Line of Effect (getLineOfEffect)", () => {
  it("linea despejada: sin lineOfEffectBlockingCells hay LoE y sin bloqueadores", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 });
    const result = getLineOfEffect(room, origin, target);
    assert.equal(result.hasLineOfEffect, true);
    assert.deepEqual(result.blockedCellKeys, []);
  });

  it("una celda bloqueadora interior produce Total Cover (sin LoE)", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { lineOfEffectBlockingCells: ["1,0"] });
    const result = getLineOfEffect(room, origin, target);
    assert.equal(result.hasLineOfEffect, false);
    assert.deepEqual(result.blockedCellKeys, ["1,0"]);
  });

  it("varias celdas bloqueadoras en el mismo segmento se listan todas", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 3, y: 0, zFeet: 0 }, { lineOfEffectBlockingCells: ["1,0", "2,0"] });
    const result = getLineOfEffect(room, origin, target);
    assert.equal(result.hasLineOfEffect, false);
    assert.deepEqual(result.blockedCellKeys, ["1,0", "2,0"]);
  });

  it("obstaculo fuera del segmento no bloquea", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { lineOfEffectBlockingCells: ["1,5"] });
    const result = getLineOfEffect(room, origin, target);
    assert.equal(result.hasLineOfEffect, true);
    assert.deepEqual(result.blockedCellKeys, []);
  });

  it("horizontal: bloqueador interior colineal bloquea", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 3, zFeet: 0 }, { x: 4, y: 3, zFeet: 0 }, { lineOfEffectBlockingCells: ["2,3"] });
    assert.equal(getLineOfEffect(room, origin, target).hasLineOfEffect, false);
  });

  it("vertical: bloqueador interior colineal bloquea", () => {
    const { room, origin, target } = roomWith({ x: 3, y: 0, zFeet: 0 }, { x: 3, y: 4, zFeet: 0 }, { lineOfEffectBlockingCells: ["3,2"] });
    assert.equal(getLineOfEffect(room, origin, target).hasLineOfEffect, false);
  });

  it("diagonal exacta: bloqueador interior colineal bloquea", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 3, y: 3, zFeet: 0 }, { lineOfEffectBlockingCells: ["1,1"] });
    assert.equal(getLineOfEffect(room, origin, target).hasLineOfEffect, false);
  });

  it("diagonal exacta sin bloqueador tiene LoE", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 3, y: 3, zFeet: 0 });
    assert.equal(getLineOfEffect(room, origin, target).hasLineOfEffect, true);
  });

  it("adyacencia: no existe punto interior posible, siempre hay LoE", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 1, y: 0, zFeet: 0 }, { lineOfEffectBlockingCells: ["0,0", "1,0"] });
    const result = getLineOfEffect(room, origin, target);
    assert.equal(result.hasLineOfEffect, true, "Adyacente: no hay celda estrictamente interior al segmento.");
    assert.deepEqual(result.blockedCellKeys, [], "Las celdas de origen/destino nunca cuentan como bloqueadoras interiores.");
  });

  it("borde del mapa: geometria funciona en las esquinas del tablero sin errores", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 9, y: 0, zFeet: 0 });
    const result = getLineOfEffect(room, origin, target);
    assert.equal(result.hasLineOfEffect, true);
  });

  it("claves invalidas o mal formadas se ignoran, sin lanzar", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { lineOfEffectBlockingCells: ["no-es-una-clave", "1,0"] });
    const result = getLineOfEffect(room, origin, target);
    assert.equal(result.hasLineOfEffect, false, "La clave valida '1,0' sigue bloqueando.");
    assert.deepEqual(result.blockedCellKeys, ["1,0"]);
  });

  it("claves duplicadas se deduplican en blockedCellKeys", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { lineOfEffectBlockingCells: ["1,0", "1,0"] });
    const result = getLineOfEffect(room, origin, target);
    assert.deepEqual(result.blockedCellKeys, ["1,0"]);
  });

  it("impassableCells sin lineOfEffectBlockingCells no bloquea LoE (independencia de campos)", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { impassableCells: ["1,0"] });
    const result = getLineOfEffect(room, origin, target);
    assert.equal(result.hasLineOfEffect, true, "impassableCells nunca debe bloquear LoE.");
  });

  it("lineOfEffectBlockingCells sin impassableCells si bloquea LoE (independencia de campos)", () => {
    const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { lineOfEffectBlockingCells: ["1,0"] });
    const result = getLineOfEffect(room, origin, target);
    assert.equal(result.hasLineOfEffect, false);
  });

  it("footprints multicasilla: basta un par despejado entre los footprints para tener LoE", () => {
    const largeOrigin = makeTestCombatant({ id: "large-origin", position: { x: 0, y: 0, zFeet: 0 }, sizeCategory: "large" });
    const target = makeTestCombatant({ id: "target", position: { x: 4, y: 0, zFeet: 0 } });
    // Bloquea el segmento (0,0)->(4,0) pero no el segmento (0,1)->(4,0) (footprint Large 2x2: (0,0)-(1,0)-(0,1)-(1,1)).
    const room = makeTestRoom({
      combatants: [largeOrigin, target],
      board: { width: 10, height: 10, cellSizeFeet: 5, lineOfEffectBlockingCells: ["2,0"] }
    });
    const result = getLineOfEffect(room, largeOrigin, target);
    assert.equal(result.hasLineOfEffect, true, "Al menos un par de celdas del footprint Large tiene linea despejada hacia el objetivo.");
  });

  it("footprints multicasilla: Total Cover solo si TODOS los pares posibles estan bloqueados", () => {
    // La geometria exige un punto lattice interior EXACTO por cada par (celda de origen, celda
    // de destino). Para un footprint Large 2x2 (4 celdas) contra un objetivo 1x1, esto solo es
    // alcanzable con un destino cuyas 4 diferencias (dx,dy) respecto a cada esquina del footprint
    // compartan factor >= 2 (si no, ese par carece de punto interior y la linea es "siempre
    // despejada" para ese par). (15,21) es el destino mas pequeno que satisface esa condicion
    // para las 4 esquinas de un footprint 2x2 anclado en (0,0); un bloqueador por par basta.
    const largeOrigin = makeTestCombatant({ id: "large-origin", position: { x: 0, y: 0, zFeet: 0 }, sizeCategory: "large" });
    const target = makeTestCombatant({ id: "target", position: { x: 15, y: 21, zFeet: 0 } });
    const room = makeTestRoom({
      combatants: [largeOrigin, target],
      board: { width: 24, height: 24, cellSizeFeet: 5, lineOfEffectBlockingCells: ["5,7", "3,3", "3,5", "8,11"] }
    });
    const result = getLineOfEffect(room, largeOrigin, target);
    assert.equal(result.hasLineOfEffect, false, "Con los 4 pares del footprint bloqueados, no queda ninguna linea despejada.");
  });

  it("sobrevive al limite de Snapshot: lineOfEffectBlockingCells se transporta por createCombatRulesSnapshot", () => {
    const origin = makeTestCombatant({ id: "origin", position: { x: 0, y: 0, zFeet: 0 } });
    const target = makeTestCombatant({ id: "target", position: { x: 2, y: 0, zFeet: 0 } });
    const room = makeTestRoom({
      combatants: [origin, target],
      board: { width: 10, height: 10, cellSizeFeet: 5, lineOfEffectBlockingCells: ["1,0"] }
    });
    const snapshot = createCombatRulesSnapshot(room);
    assert.deepEqual(snapshot.board.lineOfEffectBlockingCells, ["1,0"]);
    assert.equal(getLineOfEffect(snapshot, origin, target).hasLineOfEffect, false);
  });
});
