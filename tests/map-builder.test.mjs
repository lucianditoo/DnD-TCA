import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyRoom,
  createDemoCombatant,
  createCombatRulesSnapshot,
  boardCellKeySchema,
  updateBoardSchema,
  getLineOfEffect,
  validateMovePath
} from "@dnd-tactical/shared";
import { handleUpdateBoard } from "../apps/server/src/commands/roomCommands.ts";
import { register, resetAllRoomsForTest } from "../apps/server/src/room/roomStore.ts";

describe("D-5R1 Map Builder Architecture Remediation", () => {
  describe("MINOR 1 — boardCellKeySchema y updateBoardSchema", () => {
    test("valida claves de celda 'x,y' con enteros no negativos", () => {
      assert.equal(boardCellKeySchema.safeParse("0,0").success, true);
      assert.equal(boardCellKeySchema.safeParse("12,7").success, true);
      assert.equal(boardCellKeySchema.safeParse("foo").success, false);
      assert.equal(boardCellKeySchema.safeParse("1,2,3").success, false);
      assert.equal(boardCellKeySchema.safeParse("-1,2").success, false);
      assert.equal(boardCellKeySchema.safeParse("2.5,3").success, false);
    });

    test("updateBoardSchema rechaza escalas arbitrarias y acepta 5 u omitido", () => {
      const basePayload = {
        type: "update-board",
        roomCode: "TEST1",
        actorId: "gm-1",
        board: { width: 10, height: 10 }
      };
      assert.equal(updateBoardSchema.safeParse(basePayload).success, true);
      assert.equal(updateBoardSchema.safeParse({ ...basePayload, board: { ...basePayload.board, cellSizeFeet: 5 } }).success, true);
      assert.equal(updateBoardSchema.safeParse({ ...basePayload, board: { ...basePayload.board, cellSizeFeet: 10 } }).success, false);
      assert.equal(updateBoardSchema.safeParse({ ...basePayload, board: { ...basePayload.board, cellSizeFeet: 0 } }).success, false);
      assert.equal(updateBoardSchema.safeParse({ ...basePayload, board: { ...basePayload.board, cellSizeFeet: -5 } }).success, false);
    });
  });

  describe("Autorización y Dimensiones", () => {
    test("rechaza update-board si el actor no es GM", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("AUTH1");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const player = register(fakeSocket, "AUTH1", "Jugador1", "player");

      assert.throws(
        () => {
          handleUpdateBoard(room, {
            type: "update-board",
            roomCode: "AUTH1",
            actorId: player.id,
            board: { width: 12, height: 10 }
          });
        },
        /Solo el GM/
      );
    });

    test("rechaza GM de otra sala diferente", () => {
      resetAllRoomsForTest();
      const room1 = createEmptyRoom("ROOM1");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const foreignGm = register(fakeSocket, "ROOM2", "MasterAjeno", "gm");

      assert.throws(
        () => {
          handleUpdateBoard(room1, {
            type: "update-board",
            roomCode: "ROOM1",
            actorId: foreignGm.id,
            board: { width: 12, height: 10 }
          });
        },
        /Solo el GM de esta sala/
      );
    });

    test("rechaza dimensiones fuera de 6 a 40", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("DIMS1");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "DIMS1", "DM", "gm");

      assert.throws(
        () => {
          handleUpdateBoard(room, {
            type: "update-board",
            roomCode: "DIMS1",
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
            roomCode: "DIMS1",
            actorId: gm.id,
            board: { width: 10, height: 41 }
          });
        },
        /alto del tablero debe ser un entero entre 6 y 40/
      );
    });
  });

  describe("MAJOR 2 — cellSizeFeet normalizado siempre a 5", () => {
    test("el servidor siempre fuerza cellSizeFeet a 5 independientemente del payload", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("CELL1");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "CELL1", "DM", "gm");

      // Payload normal sin cellSizeFeet
      handleUpdateBoard(room, {
        type: "update-board",
        roomCode: "CELL1",
        actorId: gm.id,
        board: { width: 10, height: 10 }
      });
      assert.equal(room.board.cellSizeFeet, 5);

      // Intento de forzar 10
      handleUpdateBoard(room, {
        type: "update-board",
        roomCode: "CELL1",
        actorId: gm.id,
        board: { width: 12, height: 12, cellSizeFeet: 10 }
      });
      assert.equal(room.board.cellSizeFeet, 5, "El servidor debe ignorar 10 y fijar 5");
    });
  });

  describe("MAJOR 1 — Eliminación de auto-clamp y validación atómica de límites", () => {
    test("rechaza achicar si un combatiente Medium quedaría fuera", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("CLAMP1");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "CLAMP1", "DM", "gm");

      const hero = createDemoCombatant("cedrick", 1);
      hero.position = { x: 10, y: 5, zFeet: 0 };
      room.combatants.push(hero);

      assert.throws(
        () => {
          handleUpdateBoard(room, {
            type: "update-board",
            roomCode: "CLAMP1",
            actorId: gm.id,
            board: { width: 8, height: 8 }
          });
        },
        /No se puede reducir el mapa a 8x8: Cedrick quedaría fuera de los límites. Reubícalo antes de redimensionar./
      );

      // Verificación atómica: posición intacta y board original intacto
      assert.equal(hero.position.x, 10);
      assert.equal(hero.position.y, 5);
      assert.equal(room.board.width, 16);
    });

    test("rechaza achicar si parte de la huella de una criatura Large (2x2) quedaría fuera", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("CLAMP2");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "CLAMP2", "DM", "gm");

      const largeCreature = createDemoCombatant("enemy", 1);
      largeCreature.name = "Ogro Gigante";
      largeCreature.sizeCategory = "large"; // Huella ocupa (7,7), (8,7), (7,8), (8,8)
      largeCreature.position = { x: 7, y: 7, zFeet: 0 };
      room.combatants.push(largeCreature);

      assert.throws(
        () => {
          handleUpdateBoard(room, {
            type: "update-board",
            roomCode: "CLAMP2",
            actorId: gm.id,
            board: { width: 8, height: 8 }
          });
        },
        /No se puede reducir el mapa a 8x8: Ogro Gigante quedaría fuera de los límites. Reubícalo antes de redimensionar./
      );

      assert.equal(largeCreature.position.x, 7);
      assert.equal(largeCreature.position.y, 7);
    });

    test("rechaza criatura Huge (3x3) evaluando huella canónica espacial (sin hardcode)", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("CLAMP3");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "CLAMP3", "DM", "gm");

      const hugeCreature = createDemoCombatant("enemy", 2);
      hugeCreature.name = "Behemoth";
      hugeCreature.sizeCategory = "huge"; // Huella 3x3: ancla (6,6) ocupa hasta (8,8)
      hugeCreature.position = { x: 6, y: 6, zFeet: 0 };
      room.combatants.push(hugeCreature);

      assert.throws(
        () => {
          handleUpdateBoard(room, {
            type: "update-board",
            roomCode: "CLAMP3",
            actorId: gm.id,
            board: { width: 8, height: 8 }
          });
        },
        /No se puede reducir el mapa a 8x8: Behemoth quedaría fuera de los límites. Reubícalo antes de redimensionar./
      );

      assert.equal(hugeCreature.position.x, 6);
      assert.equal(hugeCreature.position.y, 6);
    });

    test("resize válido conserva exactamente todas las posiciones de combatientes sin mover nada", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("RESIZE1");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "RESIZE1", "DM", "gm");

      const hero = createDemoCombatant("cedrick", 1);
      hero.position = { x: 2, y: 3, zFeet: 0 };
      const largeEnemy = createDemoCombatant("enemy", 2);
      largeEnemy.sizeCategory = "large";
      largeEnemy.position = { x: 4, y: 4, zFeet: 0 };
      room.combatants.push(hero, largeEnemy);

      handleUpdateBoard(room, {
        type: "update-board",
        roomCode: "RESIZE1",
        actorId: gm.id,
        board: { width: 10, height: 10 }
      });

      assert.equal(room.board.width, 10);
      assert.equal(room.board.height, 10);
      assert.deepEqual(hero.position, { x: 2, y: 3, zFeet: 0 });
      assert.deepEqual(largeEnemy.position, { x: 4, y: 4, zFeet: 0 });
    });
  });

  describe("Colisión con combatientes", () => {
    test("rechaza colocar muros sobre casillas ocupadas por combatientes vivos", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("WALL1");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "WALL1", "DM", "gm");

      const hero = createDemoCombatant("cedrick", 1);
      hero.position = { x: 3, y: 4, zFeet: 0 };
      room.combatants.push(hero);

      assert.throws(
        () => {
          handleUpdateBoard(room, {
            type: "update-board",
            roomCode: "WALL1",
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
  });

  describe("MAJOR 3 — Eliminación de jerarquía inventada y semántica del pincel", () => {
    test("un muro guardado permanece simultáneamente en impassableCells y lineOfEffectBlockingCells", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("LAYERS1");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "LAYERS1", "DM", "gm");

      // El editor envía un Wall en (2,2) con impassable y LoE
      // Un Pillar en (3,3) con LoE solamente
      // Rubble en (4,4) con difficult solamente
      handleUpdateBoard(room, {
        type: "update-board",
        roomCode: "LAYERS1",
        actorId: gm.id,
        board: {
          width: 10,
          height: 10,
          impassableCells: ["2,2"],
          lineOfEffectBlockingCells: ["2,2", "3,3"],
          difficultTerrainCells: ["4,4"]
        }
      });

      assert.deepEqual(room.board.impassableCells, ["2,2"]);
      // lineOfEffectBlockingCells DEBE conservar (2,2) y (3,3) sin que el servidor borre (2,2)
      assert.deepEqual(room.board.lineOfEffectBlockingCells, ["2,2", "3,3"]);
      assert.deepEqual(room.board.difficultTerrainCells, ["4,4"]);
    });

    test("Line of Effect detrás de un muro pintado por D-5 queda bloqueada según reglas productivas", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("LOE1");
      room.board = {
        width: 10,
        height: 10,
        cellSizeFeet: 5,
        impassableCells: ["1,0"],
        lineOfEffectBlockingCells: ["1,0"]
      };

      const attacker = createDemoCombatant("cedrick", 1);
      attacker.position = { x: 0, y: 0, zFeet: 0 };
      const target = createDemoCombatant("enemy", 2);
      target.position = { x: 2, y: 0, zFeet: 0 };
      room.combatants = [attacker, target];

      const loe = getLineOfEffect(room, attacker, target);
      assert.equal(loe.hasLineOfEffect, false, "El muro debe bloquear Line of Effect");
      assert.deepEqual(loe.blockedCellKeys, ["1,0"]);
    });

    test("movimiento hacia un muro pintado por D-5 queda bloqueado por reglas productivas", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("MOV1");
      room.board = {
        width: 10,
        height: 10,
        cellSizeFeet: 5,
        impassableCells: ["1,0"],
        lineOfEffectBlockingCells: ["1,0"]
      };

      const mover = createDemoCombatant("cedrick", 1);
      mover.position = { x: 0, y: 0, zFeet: 0 };
      room.combatants = [mover];

      assert.equal(room.board.impassableCells?.includes("1,0"), true);

      const moveValidation = validateMovePath(room, mover, [{ x: 1, y: 0, zFeet: 0 }], 30);
      assert.equal(moveValidation.ok, false);
      assert.match(moveValidation.error, /impasable|bloquead|ocupad|pared|muro/i);
    });

    test("sanitiza coordenadas fuera de rango al redimensionar", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("SAN1");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "SAN1", "DM", "gm");

      handleUpdateBoard(room, {
        type: "update-board",
        roomCode: "SAN1",
        actorId: gm.id,
        board: {
          width: 8,
          height: 8,
          impassableCells: ["1,1", "15,15"],
          lineOfEffectBlockingCells: ["2,2", "8,8"],
          difficultTerrainCells: ["3,3", "-1,2"]
        }
      });

      assert.deepEqual(room.board.impassableCells, ["1,1"]);
      assert.deepEqual(room.board.lineOfEffectBlockingCells, ["2,2"]);
      assert.deepEqual(room.board.difficultTerrainCells, ["3,3"]);
    });
  });
});
