import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { createEmptyRoom, createDemoCombatant } from "@dnd-tactical/shared";
import { handleUpdateBoard } from "../apps/server/src/commands/roomCommands.ts";
import { register, resetAllRoomsForTest } from "../apps/server/src/room/roomStore.ts";

describe("D-5 Map Builder MVP (Servidor y Validación)", () => {
  test("1. rechaza update-board si el actor no es GM", () => {
    resetAllRoomsForTest();
    const room = createEmptyRoom("MAP01");
    const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
    const player = register(fakeSocket, "MAP01", "Jugador1", "player");

    assert.throws(
      () => {
        handleUpdateBoard(room, {
          type: "update-board",
          roomCode: "MAP01",
          actorId: player.id,
          board: { width: 12, height: 10 }
        });
      },
      /Solo el GM/
    );
  });

  test("2. rechaza dimensiones fuera del rango permitido (6 a 40)", () => {
    const room = createEmptyRoom("MAP02");
    const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
    const gm = register(fakeSocket, "MAP02", "DungeonMaster", "gm");

    assert.throws(
      () => {
        handleUpdateBoard(room, {
          type: "update-board",
          roomCode: "MAP02",
          actorId: gm.id,
          board: { width: 5, height: 10 }
        });
      },
      /ancho del tablero debe ser un entero entre 6 y 40/
    );

    assert.throws(
      () => {
        handleUpdateBoard(room, {
          type: "update-board",
          roomCode: "MAP02",
          actorId: gm.id,
          board: { width: 20, height: 45 }
        });
      },
      /alto del tablero debe ser un entero entre 6 y 40/
    );
  });

  test("3. rechaza colocar muros sobre casillas ocupadas por combatientes", () => {
    const room = createEmptyRoom("MAP03");
    const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
    const gm = register(fakeSocket, "MAP03", "DungeonMaster", "gm");

    const hero = createDemoCombatant("cedrick", 1);
    hero.position = { x: 3, y: 4, zFeet: 0 };
    room.combatants.push(hero);

    assert.throws(
      () => {
        handleUpdateBoard(room, {
          type: "update-board",
          roomCode: "MAP03",
          actorId: gm.id,
          board: {
            width: 12,
            height: 10,
            impassableCells: ["3,4"]
          }
        });
      },
      /No se puede colocar un muro en la casilla \(3, 4\) ocupada por Cedrick/
    );
  });

  test("4. sanitiza coordenadas, asegura exclusividad de capas (Muros > Pilares > Escombros) y filtra fuera de rango", () => {
    const room = createEmptyRoom("MAP04");
    const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
    const gm = register(fakeSocket, "MAP04", "DungeonMaster", "gm");

    handleUpdateBoard(room, {
      type: "update-board",
      roomCode: "MAP04",
      actorId: gm.id,
      board: {
        width: 10,
        height: 10,
        // (2,2) está en muros, pilares y escombros -> solo debe quedar en muros
        // (3,3) está en pilares y escombros -> solo debe quedar en pilares
        // (4,4) solo en escombros
        // (15,15) fuera de rango -> debe ser descartado
        impassableCells: ["2,2", "15,15", "invalido"],
        lineOfEffectBlockingCells: ["2,2", "3,3"],
        difficultTerrainCells: ["2,2", "3,3", "4,4"]
      }
    });

    assert.equal(room.board.width, 10);
    assert.equal(room.board.height, 10);
    assert.deepEqual(room.board.impassableCells, ["2,2"]);
    assert.deepEqual(room.board.lineOfEffectBlockingCells, ["3,3"]);
    assert.deepEqual(room.board.difficultTerrainCells, ["4,4"]);
  });

  test("5. auto-reubica (clamp) entidades de forma segura si el mapa se achica", () => {
    const room = createEmptyRoom("MAP05");
    const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
    const gm = register(fakeSocket, "MAP05", "DungeonMaster", "gm");

    const mediumHero = createDemoCombatant("cedrick", 1);
    mediumHero.position = { x: 15, y: 7, zFeet: 0 };
    room.combatants.push(mediumHero);

    const largeEnemy = createDemoCombatant("enemy", 2);
    largeEnemy.sizeCategory = "large"; // Huella 2x2
    largeEnemy.position = { x: 14, y: 6, zFeet: 0 };
    room.combatants.push(largeEnemy);

    // Achicamos a 8x8
    handleUpdateBoard(room, {
      type: "update-board",
      roomCode: "MAP05",
      actorId: gm.id,
      board: {
        width: 8,
        height: 8
      }
    });

    assert.equal(room.board.width, 8);
    assert.equal(room.board.height, 8);
    // Criatura Medium debe quedar como máximo en (7, 7)
    assert.equal(mediumHero.position.x, 7);
    assert.equal(mediumHero.position.y, 7);
    // Criatura Large (2x2) debe quedar como máximo en (6, 6) para que toda su huella quede dentro
    assert.equal(largeEnemy.position.x, 6);
    assert.equal(largeEnemy.position.y, 6);
  });
});
