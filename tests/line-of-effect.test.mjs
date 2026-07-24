import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getLineOfEffect, createCombatRulesSnapshot } from "@dnd-tactical/shared";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

// Sprint 052B.1: corrige el bug geometrico confirmado de Sprint 052B (una celda bloqueadora
// solo bloqueaba si su ancla entera era un punto EXACTAMENTE colineal del segmento
// centro-a-centro; una linea que atraviesa el AREA de una celda sin pasar por ese punto exacto
// no bloqueaba). La nueva implementacion (ver `traversedCellKeysBetween` en rules.ts) usa un
// recorrido "supercover" de celdas: modela cada celda como su area unitaria y determina el
// conjunto de celdas que el segmento centro-a-centro realmente atraviesa, incluyendo
// conservadoramente ambas celdas vecinas cuando el segmento cruza exactamente un vertice
// compartido (diagonal exacta). Todos los fixtures de este archivo se verificaron ejecutando la
// implementacion real (no se derivaron a mano) para evitar el mismo tipo de error que motivo
// esta correccion.

function roomWith(originPos, targetPos, boardOverrides = {}, originOverrides = {}, targetOverrides = {}) {
  const origin = makeTestCombatant({ id: "origin", position: originPos, ...originOverrides });
  const target = makeTestCombatant({ id: "target", position: targetPos, ...targetOverrides });
  const room = makeTestRoom({
    combatants: [origin, target],
    board: { width: 30, height: 30, cellSizeFeet: 5, ...boardOverrides }
  });
  return { room, origin, target };
}

describe("Sprint 052B.1 - Line of Effect (getLineOfEffect, geometria por area de celda)", () => {
  describe("Matriz de pendientes obligatoria", () => {
    const slopes = [
      { name: "(0,0) -> (2,1)", from: { x: 0, y: 0 }, to: { x: 2, y: 1 }, onPath: "1,0", nearNotOnPath: "2,0" },
      { name: "(0,0) -> (3,1)", from: { x: 0, y: 0 }, to: { x: 3, y: 1 }, onPath: "2,0", nearNotOnPath: "0,1" },
      { name: "(0,0) -> (3,2)", from: { x: 0, y: 0 }, to: { x: 3, y: 2 }, onPath: "1,1", nearNotOnPath: "0,2" },
      { name: "(1,1) -> (4,3)", from: { x: 1, y: 1 }, to: { x: 4, y: 3 }, onPath: "2,2", nearNotOnPath: "1,3" }
    ];

    for (const slope of slopes) {
      it(`${slope.name}: celda realmente atravesada bloquea`, () => {
        const { room, origin, target } = roomWith(
          { ...slope.from, zFeet: 0 },
          { ...slope.to, zFeet: 0 },
          { lineOfEffectBlockingCells: [slope.onPath] }
        );
        const result = getLineOfEffect(room, origin, target);
        assert.equal(result.hasLineOfEffect, false, `${slope.name}: la celda ${slope.onPath} esta en el recorrido supercover del segmento.`);
        assert.deepEqual(result.blockedCellKeys, [slope.onPath]);
      });

      it(`${slope.name}: celda cercana pero no atravesada no bloquea`, () => {
        const { room, origin, target } = roomWith(
          { ...slope.from, zFeet: 0 },
          { ...slope.to, zFeet: 0 },
          { lineOfEffectBlockingCells: [slope.nearNotOnPath] }
        );
        const result = getLineOfEffect(room, origin, target);
        assert.equal(result.hasLineOfEffect, true, `${slope.name}: la celda ${slope.nearNotOnPath} no forma parte del recorrido real.`);
        assert.deepEqual(result.blockedCellKeys, []);
      });
    }
  });

  describe("Politica de bordes explicita: cruce por borde (ordinario) vs por vertice (diagonal exacta)", () => {
    it("linea por borde: paso ordinario de un solo eje bloquea via la celda cuyo borde cruza", () => {
      // (0,0) -> (3,1): nx=3, ny=1. El primer avance es un paso ordinario en x (cruce de borde,
      // no de vertice, porque nx != ny en ese punto de la caminata).
      const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 3, y: 1, zFeet: 0 }, { lineOfEffectBlockingCells: ["1,0"] });
      const result = getLineOfEffect(room, origin, target);
      assert.equal(result.hasLineOfEffect, false);
      assert.deepEqual(result.blockedCellKeys, ["1,0"]);
    });

    it("linea por vertice: diagonal exacta 45 grados incluye conservadoramente ambas celdas vecinas del cruce", () => {
      // (0,0) -> (3,3): cruces exactos en (1,1) y (2,2). El vertice (1,1) es compartido por
      // (0,0),(1,0),(0,1),(1,1); (1,0) y (0,1) tambien deben quedar marcados como bloqueadores
      // validos por la politica conservadora "supercover", aunque el segmento no pase por su
      // ancla entera.
      const diagonalCases = [
        { blocker: "1,1", label: "vertice mismo" },
        { blocker: "1,0", label: "vecino del vertice (eje x)" },
        { blocker: "0,1", label: "vecino del vertice (eje y)" }
      ];
      for (const { blocker, label } of diagonalCases) {
        const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 3, y: 3, zFeet: 0 }, { lineOfEffectBlockingCells: [blocker] });
        const result = getLineOfEffect(room, origin, target);
        assert.equal(result.hasLineOfEffect, false, `Diagonal 45°, ${label} (${blocker}) debe bloquear por la politica conservadora de vertice compartido.`);
      }
    });

    it("linea por vertice: una celda fuera de cualquier vertice del cruce no bloquea", () => {
      const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 3, y: 3, zFeet: 0 }, { lineOfEffectBlockingCells: ["5,5"] });
      const result = getLineOfEffect(room, origin, target);
      assert.equal(result.hasLineOfEffect, true);
    });
  });

  describe("Orientaciones basicas", () => {
    it("horizontal: bloqueador en la fila del segmento bloquea", () => {
      const { room, origin, target } = roomWith({ x: 0, y: 3, zFeet: 0 }, { x: 4, y: 3, zFeet: 0 }, { lineOfEffectBlockingCells: ["2,3"] });
      assert.equal(getLineOfEffect(room, origin, target).hasLineOfEffect, false);
    });

    it("horizontal: bloqueador fuera de la fila no bloquea", () => {
      const { room, origin, target } = roomWith({ x: 0, y: 3, zFeet: 0 }, { x: 4, y: 3, zFeet: 0 }, { lineOfEffectBlockingCells: ["2,4"] });
      assert.equal(getLineOfEffect(room, origin, target).hasLineOfEffect, true);
    });

    it("vertical: bloqueador en la columna del segmento bloquea", () => {
      const { room, origin, target } = roomWith({ x: 3, y: 0, zFeet: 0 }, { x: 3, y: 4, zFeet: 0 }, { lineOfEffectBlockingCells: ["3,2"] });
      assert.equal(getLineOfEffect(room, origin, target).hasLineOfEffect, false);
    });

    it("vertical: bloqueador fuera de la columna no bloquea", () => {
      const { room, origin, target } = roomWith({ x: 3, y: 0, zFeet: 0 }, { x: 3, y: 4, zFeet: 0 }, { lineOfEffectBlockingCells: ["4,2"] });
      assert.equal(getLineOfEffect(room, origin, target).hasLineOfEffect, true);
    });

    it("diagonal 45 grados: sin bloqueador hay LoE", () => {
      const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 3, y: 3, zFeet: 0 });
      assert.equal(getLineOfEffect(room, origin, target).hasLineOfEffect, true);
    });
  });

  describe("Adyacencia, claves invalidas/duplicadas e independencia de campos", () => {
    it("adyacencia: celdas propias listadas como bloqueadoras nunca bloquean su propia linea", () => {
      const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 1, y: 0, zFeet: 0 }, { lineOfEffectBlockingCells: ["0,0", "1,0"] });
      const result = getLineOfEffect(room, origin, target);
      assert.equal(result.hasLineOfEffect, true, "Las celdas ocupadas por el propio origen/objetivo nunca cuentan como bloqueadoras.");
      assert.deepEqual(result.blockedCellKeys, []);
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

    it("sobrevive al limite de Snapshot: lineOfEffectBlockingCells se transporta por createCombatRulesSnapshot", () => {
      const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { lineOfEffectBlockingCells: ["1,0"] });
      const snapshot = createCombatRulesSnapshot(room);
      assert.deepEqual(snapshot.board.lineOfEffectBlockingCells, ["1,0"]);
      assert.equal(getLineOfEffect(snapshot, origin, target).hasLineOfEffect, false);
    });
  });

  describe("Footprints multicasilla (1x1, origen Large, objetivo Large, ambos Large)", () => {
    it("footprint 1x1 (baseline): un bloqueador en el unico trazado posible produce Total Cover", () => {
      const { room, origin, target } = roomWith({ x: 0, y: 0, zFeet: 0 }, { x: 2, y: 0, zFeet: 0 }, { lineOfEffectBlockingCells: ["1,0"] });
      assert.equal(getLineOfEffect(room, origin, target).hasLineOfEffect, false);
    });

    it("origen Large: al menos un par de celdas del footprint despejado basta para tener LoE", () => {
      const { room, origin, target } = roomWith(
        { x: 0, y: 0, zFeet: 0 },
        { x: 5, y: 0, zFeet: 0 },
        { lineOfEffectBlockingCells: ["2,0"] },
        { sizeCategory: "large" }
      );
      const result = getLineOfEffect(room, origin, target);
      assert.equal(result.hasLineOfEffect, true, "Al menos un par (origen Large) evita el bloqueador y llega despejado.");
    });

    it("origen Large: todos los pares bloqueados produce Total Cover", () => {
      const { room, origin, target } = roomWith(
        { x: 0, y: 0, zFeet: 0 },
        { x: 5, y: 0, zFeet: 0 },
        { lineOfEffectBlockingCells: ["2,0", "2,1"] },
        { sizeCategory: "large" }
      );
      const result = getLineOfEffect(room, origin, target);
      assert.equal(result.hasLineOfEffect, false, "Con ambos bloqueadores, ningun par del footprint origen queda despejado.");
    });

    it("objetivo Large: al menos un par de celdas del footprint despejado basta para tener LoE", () => {
      const { room, origin, target } = roomWith(
        { x: 5, y: 0, zFeet: 0 },
        { x: 0, y: 0, zFeet: 0 },
        { lineOfEffectBlockingCells: ["2,0"] },
        {},
        { sizeCategory: "large" }
      );
      const result = getLineOfEffect(room, origin, target);
      assert.equal(result.hasLineOfEffect, true, "Al menos un par (objetivo Large) evita el bloqueador y llega despejado.");
    });

    it("objetivo Large: todos los pares bloqueados produce Total Cover", () => {
      const { room, origin, target } = roomWith(
        { x: 5, y: 0, zFeet: 0 },
        { x: 0, y: 0, zFeet: 0 },
        { lineOfEffectBlockingCells: ["2,0", "2,1"] },
        {},
        { sizeCategory: "large" }
      );
      const result = getLineOfEffect(room, origin, target);
      assert.equal(result.hasLineOfEffect, false, "Con ambos bloqueadores, ningun par del footprint objetivo queda despejado.");
    });

    it("ambos Large: al menos un par de celdas despejado basta para tener LoE", () => {
      const { room, origin, target } = roomWith(
        { x: 0, y: 0, zFeet: 0 },
        { x: 6, y: 0, zFeet: 0 },
        { lineOfEffectBlockingCells: ["2,0"] },
        { sizeCategory: "large" },
        { sizeCategory: "large" }
      );
      const result = getLineOfEffect(room, origin, target);
      assert.equal(result.hasLineOfEffect, true, "Con ambos footprints Large, un unico bloqueador no cubre todos los pares posibles.");
    });

    it("ambos Large: una pared que cubre todos los pares produce Total Cover", () => {
      const { room, origin, target } = roomWith(
        { x: 0, y: 0, zFeet: 0 },
        { x: 6, y: 0, zFeet: 0 },
        { lineOfEffectBlockingCells: ["2,0", "2,1", "3,0", "3,1"] },
        { sizeCategory: "large" },
        { sizeCategory: "large" }
      );
      const result = getLineOfEffect(room, origin, target);
      assert.equal(result.hasLineOfEffect, false, "Una pared que cubre ambas filas de los dos footprints Large bloquea todos los pares.");
    });
  });
});
