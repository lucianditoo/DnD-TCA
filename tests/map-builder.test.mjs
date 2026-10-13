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
import { areBoardsSemanticallyEqual } from "../apps/web/src/components/MapEditor/MapEditorToolbar.tsx";

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

  describe("D-5R2 — Candidate Board Validation & Squeezing Invariants", () => {
    test("rechaza actualización si un Large con srd_squeezing pierde las narrowCells de su compresión", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("SQUEEZE_CAND1");
      room.board = {
        width: 12,
        height: 12,
        cellSizeFeet: 5,
        narrowCells: ["1,0", "2,0"],
        impassableCells: ["1,1", "2,1"]
      };

      const large = createDemoCombatant("canocrock", 1);
      large.sizeCategory = "large";
      large.position = { x: 1, y: 0, zFeet: 0 };
      room.combatants = [large];
      room.effectInstances = [
        {
          instanceId: "eff-squeeze-1",
          effectId: "srd_squeezing",
          source: { type: "system" },
          targets: [large.id],
          appliedAtEvent: { type: "SystemInjected", round: 1 }
        }
      ];

      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "SQUEEZE_CAND1", "DM", "gm");

      // Intento de actualización que elimina narrowCells ("1,0", "2,0")
      // Esto hace que la entidad Large ya no pueda comprimirse en su posición actual
      assert.throws(
        () => {
          handleUpdateBoard(room, {
            type: "update-board",
            roomCode: "SQUEEZE_CAND1",
            actorId: gm.id,
            board: {
              width: 12,
              height: 12,
              narrowCells: [], // Eliminadas!
              impassableCells: ["1,1", "2,1"]
            }
          });
        },
        /invalida la compresión \(srd_squeezing\)/i
      );

      // Invariantes: room.board original no cambia, posición no cambia, efectos no cambian
      assert.deepEqual(room.board.narrowCells, ["1,0", "2,0"]);
      assert.deepEqual(large.position, { x: 1, y: 0, zFeet: 0 });
      assert.equal(room.effectInstances.length, 1);
      assert.equal(room.effectInstances[0].effectId, "srd_squeezing");
    });

    test("rechaza actualización si el footprint candidato de una criatura comprimida choca con un muro candidato", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("SQUEEZE_WALL1");
      room.board = {
        width: 12,
        height: 12,
        cellSizeFeet: 5,
        narrowCells: ["1,0", "2,0"],
        impassableCells: []
      };

      const large = createDemoCombatant("canocrock", 1);
      large.sizeCategory = "large";
      large.position = { x: 1, y: 0, zFeet: 0 };
      room.combatants = [large];
      room.effectInstances = [
        {
          instanceId: "eff-squeeze-2",
          effectId: "srd_squeezing",
          source: { type: "system" },
          targets: [large.id],
          appliedAtEvent: { type: "SystemInjected", round: 1 }
        }
      ];

      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "SQUEEZE_WALL1", "DM", "gm");

      // Intento de colocar un muro sobre una de las casillas comprimidas ocupadas ("2,0")
      assert.throws(
        () => {
          handleUpdateBoard(room, {
            type: "update-board",
            roomCode: "SQUEEZE_WALL1",
            actorId: gm.id,
            board: {
              width: 12,
              height: 12,
              narrowCells: ["1,0", "2,0"],
              impassableCells: ["2,0"] // Colisión directa con footprint comprimido
            }
          });
        },
        /No se puede colocar un muro en la casilla \(2, 0\) ocupada por/i
      );

      assert.deepEqual(room.board.impassableCells, []);
    });

    test("rechaza actualización si el footprint candidato de una criatura comprimida queda fuera de límites candidatos", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("SQUEEZE_BOUNDS1");
      room.board = {
        width: 12,
        height: 12,
        cellSizeFeet: 5,
        narrowCells: ["6,0", "7,0"],
        impassableCells: []
      };

      const large = createDemoCombatant("canocrock", 1);
      large.sizeCategory = "large";
      large.position = { x: 6, y: 0, zFeet: 0 };
      room.combatants = [large];
      room.effectInstances = [
        {
          instanceId: "eff-squeeze-3",
          effectId: "srd_squeezing",
          source: { type: "system" },
          targets: [large.id],
          appliedAtEvent: { type: "SystemInjected", round: 1 }
        }
      ];

      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "SQUEEZE_BOUNDS1", "DM", "gm");

      // Reducir ancho a 7 hace que (7,0) quede fuera de límites
      assert.throws(
        () => {
          handleUpdateBoard(room, {
            type: "update-board",
            roomCode: "SQUEEZE_BOUNDS1",
            actorId: gm.id,
            board: {
              width: 7,
              height: 10,
              narrowCells: ["6,0"],
              impassableCells: []
            }
          });
        },
        /quedaría fuera de los límites|invalida la compresión/i
      );
    });

    test("areBoardsSemanticallyEqual compara todos los campos incluyendo iluminación sin orden dependiente", () => {
      const b1 = {
        width: 10,
        height: 10,
        cellSizeFeet: 5,
        impassableCells: ["1,1", "2,2"],
        lineOfEffectBlockingCells: ["3,3"],
        difficultTerrainCells: ["4,4"],
        narrowCells: ["5,5"],
        dimLightCells: ["6,6", "7,7"],
        darknessCells: ["8,8"]
      };

      const b2 = {
        width: 10,
        height: 10,
        cellSizeFeet: 5,
        impassableCells: ["2,2", "1,1"], // Orden inverso
        lineOfEffectBlockingCells: ["3,3"],
        difficultTerrainCells: ["4,4"],
        narrowCells: ["5,5"],
        dimLightCells: ["7,7", "6,6"], // Orden inverso
        darknessCells: ["8,8"]
      };

      assert.equal(areBoardsSemanticallyEqual(b1, b2), true);

      // Diferencia en dimLightCells
      assert.equal(areBoardsSemanticallyEqual(b1, { ...b2, dimLightCells: ["6,6"] }), false);
      // Diferencia en darknessCells
      assert.equal(areBoardsSemanticallyEqual(b1, { ...b2, darknessCells: [] }), false);
    });

    test("D-5R3: rechaza si el CandidateBoard alteraría la orientación/huella comprimida de horizontal a vertical", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("SQUEEZE_ORIENT1");
      // Corredor horizontal inicial en (1,1) y (2,1)
      room.board = {
        width: 10,
        height: 10,
        cellSizeFeet: 5,
        narrowCells: ["1,1", "2,1"],
        impassableCells: ["1,0", "2,0", "1,2", "2,2"]
      };

      const large = createDemoCombatant("enemy", 1);
      large.sizeCategory = "large";
      large.position = { x: 1, y: 1, zFeet: 0 };
      room.combatants = [large];
      room.effectInstances = [
        {
          instanceId: "eff-squeeze-orient-1",
          effectId: "srd_squeezing",
          source: { type: "system" },
          targets: [large.id],
          appliedAtEvent: { type: "SystemInjected", round: 1 }
        }
      ];

      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "SQUEEZE_ORIENT1", "DM", "gm");

      // CandidateBoard elimina el corredor horizontal y crea uno vertical en (1,1) y (1,2)
      // Para que (2,1) no choque con la pre-validación de muro sobre celda actual ocupada,
      // no ponemos muro en (2,1), sino que quitamos narrowCells de (2,1) y dejamos narrowCells en (1,1) y (1,2)
      assert.throws(
        () => {
          handleUpdateBoard(room, {
            type: "update-board",
            roomCode: "SQUEEZE_ORIENT1",
            actorId: gm.id,
            board: {
              width: 10,
              height: 10,
              narrowCells: ["1,1", "1,2"], // Ahora vertical
              impassableCells: ["0,1", "0,2", "2,2"] // Paredes para el pasaje vertical sin pisar (2,1)
            }
          });
        },
        /alteraría la huella comprimida actual de Canocrock/i
      );

      // Posición y tablero intactos
      assert.deepEqual(large.position, { x: 1, y: 1, zFeet: 0 });
      assert.deepEqual(room.board.narrowCells, ["1,1", "2,1"]);
    });

    test("D-5R3: rechaza cambio de orientación que crearía overlap sobre combatiente existente", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("SQUEEZE_ORIENT2");
      room.board = {
        width: 10,
        height: 10,
        cellSizeFeet: 5,
        narrowCells: ["1,1", "2,1"],
        impassableCells: ["1,0", "2,0"]
      };

      const large = createDemoCombatant("enemy", 1);
      large.sizeCategory = "large";
      large.position = { x: 1, y: 1, zFeet: 0 };

      // Otro combatiente en (1, 2)
      const bystander = createDemoCombatant("cedrick", 2);
      bystander.position = { x: 1, y: 2, zFeet: 0 };

      room.combatants = [large, bystander];
      room.effectInstances = [
        {
          instanceId: "eff-squeeze-orient-2",
          effectId: "srd_squeezing",
          source: { type: "system" },
          targets: [large.id],
          appliedAtEvent: { type: "SystemInjected", round: 1 }
        }
      ];

      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "SQUEEZE_ORIENT2", "DM", "gm");

      // Intento de forzar corredor vertical en (1,1) y (1,2)
      assert.throws(
        () => {
          handleUpdateBoard(room, {
            type: "update-board",
            roomCode: "SQUEEZE_ORIENT2",
            actorId: gm.id,
            board: {
              width: 10,
              height: 10,
              narrowCells: ["1,1", "1,2"],
              impassableCells: ["0,1", "0,2", "2,2"]
            }
          });
        },
        /alteraría la huella comprimida actual de Canocrock/i
      );

      assert.deepEqual(bystander.position, { x: 1, y: 2, zFeet: 0 });
    });

    test("D-5R3: cambio no relacionado conserva la misma huella comprimida y se acepta", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("SQUEEZE_ORIENT3");
      room.board = {
        width: 10,
        height: 10,
        cellSizeFeet: 5,
        narrowCells: ["1,1", "2,1"],
        impassableCells: ["1,0", "2,0"]
      };

      const large = createDemoCombatant("canocrock", 1);
      large.sizeCategory = "large";
      large.position = { x: 1, y: 1, zFeet: 0 };
      room.combatants = [large];
      room.effectInstances = [
        {
          instanceId: "eff-squeeze-orient-3",
          effectId: "srd_squeezing",
          source: { type: "system" },
          targets: [large.id],
          appliedAtEvent: { type: "SystemInjected", round: 1 }
        }
      ];

      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "SQUEEZE_ORIENT3", "DM", "gm");

      // Cambio en una casilla lejana (8,8)
      handleUpdateBoard(room, {
        type: "update-board",
        roomCode: "SQUEEZE_ORIENT3",
        actorId: gm.id,
        board: {
          width: 10,
          height: 10,
          narrowCells: ["1,1", "2,1"],
          impassableCells: ["1,0", "2,0", "8,8"]
        }
      });

      assert.equal(room.board.impassableCells?.includes("8,8"), true);
      assert.deepEqual(large.position, { x: 1, y: 1, zFeet: 0 });
    });

    test("D-5R3: log del sistema calcula purePillarCount excluyendo celdas impasables", () => {
      resetAllRoomsForTest();
      const room = createEmptyRoom("LOG_PILLAR1");
      const fakeSocket = { OPEN: 1, readyState: 1, send() {} };
      const gm = register(fakeSocket, "LOG_PILLAR1", "DM", "gm");

      // 1 Wall en (1,1) con impassable + LoE
      // 1 Pillar en (2,2) con LoE solamente
      handleUpdateBoard(room, {
        type: "update-board",
        roomCode: "LOG_PILLAR1",
        actorId: gm.id,
        board: {
          width: 10,
          height: 10,
          impassableCells: ["1,1"],
          lineOfEffectBlockingCells: ["1,1", "2,2"],
          difficultTerrainCells: ["3,3"]
        }
      });

      const lastLog = room.log[0]?.message ?? "";
      assert.match(lastLog, /1 muros, 1 pilares, 1 escombros/);
    });
  });
});
