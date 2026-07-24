import test from "node:test";
import assert from "node:assert/strict";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { handleResolveAttack } from "../apps/server/src/commands/attackCommands.ts";
import { createEmptyRoom } from "../packages/shared/src/index.ts";
import { structuredSnapshotFields, inventoryEquipment } from "./test-utils.mjs";

// ---------------------------------------------------------------------------
// Sprint 053B: integración de Vision + Blind Targeting (NDD §13.7/§13.8) en el
// camino real de resolución de ataque ordinario (handleResolveAttack). Mismo
// patrón que tests/line-of-effect-server.test.mjs / tests/attack-rules.test.mjs
// — construcción directa de CombatRoom, sin bypass de WebSocket.
// ---------------------------------------------------------------------------

const mockSocketGM = { readyState: 1, OPEN: 1, send: () => {} };
const mockSocketPlayer = { readyState: 1, OPEN: 1, send: () => {} };

clients.set(mockSocketGM, { id: "gm-blind-actor", role: "gm", name: "GM", roomCode: "BLIND01" });
clients.set(mockSocketPlayer, { id: "player-blind-actor", role: "player", name: "Player", roomCode: "BLIND01" });

function makeRoom({ darknessCells, lineOfEffectBlockingCells, targetPosition = { x: 1, y: 0, zFeet: 0 }, targetSizeCategory, ranged = false } = {}) {
  const room = createEmptyRoom("BLIND01");
  room.phase = "active";
  room.board = {
    ...room.board,
    ...(darknessCells ? { darknessCells } : {}),
    ...(lineOfEffectBlockingCells ? { lineOfEffectBlockingCells } : {})
  };

  const attacker = {
    id: "blind-attacker",
    name: "Atacante",
    type: "player",
    hpCurrent: 20,
    hpMax: 20,
    baseAttackBonus: 5, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(15),
    ...(ranged ? inventoryEquipment("longbow", { extraItems: [{ itemId: "arrow-stack", catalogId: "arrows_20", quantity: 20 }] }) : {}),
    abilityScores: { strength: 16, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    position: { x: 0, y: 0, zFeet: 0 },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0, healingReceived: 0 },
    controlledBy: { type: "player", participantId: "player-blind-actor" },
    buffs: [],
    abilities: []
  };

  const target = {
    id: "blind-target",
    name: "Objetivo",
    type: "enemy",
    hpCurrent: 100,
    hpMax: 100,
    baseAttackBonus: 0, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(10),
    ...(targetSizeCategory ? { sizeCategory: targetSizeCategory } : {}),
    baseSpeedFeet: 20,
    position: targetPosition,
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0, healingReceived: 0 },
    controlledBy: { type: "gm" },
    buffs: [],
    abilities: []
  };

  room.combatants.push(attacker, target);
  room.turnOrder.push(attacker.id, target.id);
  room.activeTurnIndex = 0;
  room.currentTurn.combatantId = attacker.id;
  room.currentTurn.attackMode = "standard";

  return { room, attacker, target };
}

function attackDirect(room, actorId, targetId, options = {}) {
  handleResolveAttack(room, {
    type: "resolve-attack",
    roomCode: "BLIND01",
    actorId,
    attackerId: "blind-attacker",
    target: { kind: "combatant", combatantId: targetId },
    d20Roll: 15,
    damage: 9
  }, options);
}

function attackSquare(room, actorId, position, options = {}) {
  handleResolveAttack(room, {
    type: "resolve-attack",
    roomCode: "BLIND01",
    actorId,
    attackerId: "blind-attacker",
    target: { kind: "square", position },
    d20Roll: 15,
    damage: 9
  }, options);
}

test("targeting directo permitido en luz brillante (sin restriccion de Vision)", () => {
  const { room, target } = makeRoom();
  attackDirect(room, "player-blind-actor", "blind-target");
  assert.equal(target.hpCurrent, 100 - 9);
  assert.equal(room.currentTurn.attacksMade, 1);
});

test("targeting directo permitido en luz tenue (20% de ocultacion parcial, no rechazado)", () => {
  const { room, target } = makeRoom({ targetPosition: { x: 1, y: 0, zFeet: 0 } });
  room.board = { ...room.board, dimLightCells: ["1,0"] };
  // d20=15 + ataque suficiente vs CA 10 impacta; el 20% de ocultacion se resuelve con d100 via diceRoller.
  attackDirect(room, "player-blind-actor", "blind-target", { diceRoller: (sides) => (sides === 100 ? 50 : 15) });
  assert.equal(target.hpCurrent, 100 - 9, "d100=50 > 20% de fallo, el ataque impacta.");
});

test("targeting directo rechazado bajo Ocultacion Total: debe elegir una casilla", () => {
  const { room, target } = makeRoom({ darknessCells: ["2,0"], targetPosition: { x: 2, y: 0, zFeet: 0 } });
  const refusingRoller = () => { throw new Error("REGRESION: no debe consumirse RNG en un rechazo de targeting directo."); };
  assert.throws(
    () => attackDirect(room, "player-blind-actor", "blind-target", { diceRoller: refusingRoller }),
    /Ocultación Total.*casilla/i
  );
  assert.equal(target.hpCurrent, 100, "el rechazo no debe mutar HP.");
  assert.equal(room.currentTurn.attacksMade, 0, "el rechazo no debe consumir el ataque de la rutina.");
});

test("targeting por casilla ocupada resuelve contra el combatiente real", () => {
  const { room, target } = makeRoom({ darknessCells: ["1,0"], targetPosition: { x: 1, y: 0, zFeet: 0 } });
  attackSquare(room, "player-blind-actor", { x: 1, y: 0, zFeet: 0 }, { diceRoller: (sides) => (sides === 100 ? 99 : 15) });
  assert.equal(target.hpCurrent, 100 - 9, "d100=99 > 50% de fallo, el ataque impacta con normalidad.");
});

test("targeting por casilla acepta cualquier celda ocupada por una criatura Large", () => {
  // Large ancla en (1,0) ocupa (1,0),(2,0),(1,1),(2,1). (1,1) esta a 5 ft (diagonal adyacente).
  const { room, target } = makeRoom({ targetPosition: { x: 1, y: 0, zFeet: 0 }, targetSizeCategory: "large" });
  room.board = { ...room.board, darknessCells: ["1,1"] };
  attackSquare(room, "player-blind-actor", { x: 1, y: 1, zFeet: 0 }, { diceRoller: (sides) => (sides === 100 ? 99 : 15) });
  assert.equal(target.hpCurrent, 100 - 9, "la celda (1,1) del footprint Large (no el ancla) debe resolver contra el mismo combatiente.");
});

test("targeting por casilla vacia produce un fallo automatico indistinguible, sin revelar ocupacion", () => {
  const { room, target } = makeRoom({ darknessCells: ["1,0", "1,1"], targetPosition: { x: 1, y: 0, zFeet: 0 } });
  const refusingRoller = () => { throw new Error("REGRESION: no debe consumirse tirada de ataque contra una casilla vacia."); };
  attackSquare(room, "player-blind-actor", { x: 1, y: 1, zFeet: 0 }, { diceRoller: refusingRoller });
  assert.equal(target.hpCurrent, 100, "no hay objetivo real en (1,1): no debe mutarse HP.");
  const lastLog = room.log[0].message;
  assert.match(lastLog, /ataque falla/i);
  assert.doesNotMatch(lastLog, /Objetivo|blind-target|vacia|vacía/i, "el log publico no debe mencionar el nombre del objetivo real ni revelar que la casilla estaba vacia.");
});

test("casilla vacia consume el intento de ataque y la accion declarada", () => {
  const { room } = makeRoom({ darknessCells: ["1,0", "1,1"], targetPosition: { x: 1, y: 0, zFeet: 0 } });
  attackSquare(room, "player-blind-actor", { x: 1, y: 1, zFeet: 0 });
  assert.equal(room.currentTurn.attacksMade, 1, "el intento de ataque se consume aunque la casilla este vacia.");
  assert.equal(room.currentTurn.usedStandardAction, true, "la accion estandar declarada se consume igual que un ataque fallido normal.");
});

test("casilla vacia consume municion si el arma la requiere", () => {
  // El objetivo real se posiciona lejos (15 ft) para que no amenace al atacante — de lo
  // contrario, disparar un arma a distancia en una casilla amenazada provoca un Ataque de
  // Oportunidad y difiere el ataque (mismo comportamiento ya existente para ataques normales),
  // lo que impediria observar el consumo de municion en este mismo intento.
  const { room, attacker } = makeRoom({ darknessCells: ["9,9"], targetPosition: { x: 3, y: 0, zFeet: 0 }, ranged: true });
  const ammoBefore = attacker.inventory.find((item) => item.catalogId === "arrows_20").quantity;
  attackSquare(room, "player-blind-actor", { x: 9, y: 9, zFeet: 0 });
  const ammoAfter = attacker.inventory.find((item) => item.catalogId === "arrows_20").quantity;
  assert.equal(ammoAfter, ammoBefore - 1, "el ataque a una casilla vacia con arma a distancia debe consumir municion igual que un ataque fallido normal.");
});

test("casilla vacia no muta HP ni crea amenaza de critico pendiente", () => {
  const { room, target } = makeRoom({ darknessCells: ["1,0", "1,1"], targetPosition: { x: 1, y: 0, zFeet: 0 } });
  attackSquare(room, "player-blind-actor", { x: 1, y: 1, zFeet: 0 }, { diceRoller: () => 20 });
  assert.equal(target.hpCurrent, 100);
  assert.equal(room.activeAttackThreat, null, "una casilla vacia nunca puede amenazar critico: no hay tirada de ataque real.");
});

test("targeting por casilla no es un bypass: contra un objetivo con Vision clara, resuelve igual que targeting directo", () => {
  const { room: roomDirect, target: targetDirect } = makeRoom();
  attackDirect(roomDirect, "player-blind-actor", "blind-target");
  const { room: roomSquare, target: targetSquare } = makeRoom({ targetPosition: { x: 1, y: 0, zFeet: 0 } });
  attackSquare(roomSquare, "player-blind-actor", { x: 1, y: 0, zFeet: 0 });
  assert.equal(targetDirect.hpCurrent, targetSquare.hpCurrent, "elegir casilla en vez de combatiente no cambia el resultado cuando Vision no exigia una casilla.");
});

test("regresion: Line of Effect sigue bloqueando antes que cualquier verificacion de Vision", () => {
  const { room, target } = makeRoom({ lineOfEffectBlockingCells: ["1,0"], targetPosition: { x: 2, y: 0, zFeet: 0 } });
  assert.throws(
    () => attackDirect(room, "player-blind-actor", "blind-target"),
    /Cobertura Total/,
    "cuando no hay Line of Effect, el rechazo debe ser por Cobertura Total, no por Ocultacion Total."
  );
  assert.equal(target.hpCurrent, 100);
});

test("regresion: criatura interpuesta sigue dando Cover +4 (sin cambios por Vision)", () => {
  // 10 ft de distancia (fuera de alcance cuerpo a cuerpo): arma a distancia para que el ataque
  // pueda resolverse y as poder observar el +4 de Cover en el log, sin que la geometria de
  // Cover (que exige al menos una celda de separacion) se vea afectada por Vision.
  const { room, target } = makeRoom({ targetPosition: { x: 2, y: 0, zFeet: 0 }, ranged: true });
  const ally = {
    id: "blind-ally", name: "Aliado", type: "player", hpCurrent: 10, hpMax: 10,
    baseAttackBonus: 0, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(10), position: { x: 1, y: 0, zFeet: 0 },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0, healingReceived: 0 },
    controlledBy: { type: "player", participantId: "player-blind-actor" }, buffs: [], abilities: []
  };
  room.combatants.push(ally);
  room.turnOrder.push(ally.id);
  attackDirect(room, "player-blind-actor", "blind-target", { diceRoller: (sides) => (sides === 100 ? 99 : 1) });
  assert.equal(target.hpCurrent, 100 - 9, "d20=15 + ataque suficiente vs CA 10+4 de Cover aun impacta.");
  const lastAttackLog = room.log.find((entry) => entry.kind === "attack");
  assert.match(lastAttackLog.message, /cobertura \+4/i, "El log del ataque debe seguir mostrando el +4 de Cover por criatura interpuesta, sin cambios por Vision.");
});

test("regresion: Blinded sigue produciendo Ocultacion Total via su contribucion declarativa existente, sin ningun 'if blinded' nuevo", () => {
  // Sprint 053B hace cumplir por primera vez requiresTargetSquare/directTargetingAllowed como
  // gate real (antes solo eran campos informativos sin consumidor). Blinded ya producia
  // kind:"total" desde Sprint 047 (ver tests/vision-core.test.mjs, "Vision partial + Blinded
  // total"); lo que este test confirma es que, con el gate ahora activo, un atacante ciego
  // tambien debe recurrir a targeting por casilla para sus propios ataques — sin que
  // attackCommands.ts contenga ninguna rama especial para "si Blinded"; es la misma
  // composicion por severidad maxima ya usada para Vision.
  const { room, target } = makeRoom({ targetPosition: { x: 1, y: 0, zFeet: 0 } });
  room.effectInstances.push({
    effectId: "srd_blinded",
    targets: ["blind-attacker"],
    source: { type: "system" },
    instanceId: "eff-blind-regression",
    appliedAtEvent: { type: "SystemInjected", round: 1 }
  });
  assert.throws(
    () => attackDirect(room, "player-blind-actor", "blind-target"),
    /Ocultación Total.*casilla/i,
    "un atacante con Blinded debe ser redirigido a targeting por casilla, igual que Vision total."
  );
  attackSquare(room, "player-blind-actor", { x: 1, y: 0, zFeet: 0 }, { diceRoller: (sides) => (sides === 100 ? 99 : 15) });
  assert.equal(target.hpCurrent, 100 - 9, "por casilla, el ataque de un atacante ciego se resuelve con normalidad (50% ya superado por d100=99).");
});

test("regresion: ataques normales existentes con targetId legado siguen funcionando sin cambios", () => {
  const room2 = createEmptyRoom("BLIND01");
  room2.phase = "active";
  const attacker = {
    id: "legacy-attacker", name: "Legado", type: "player", hpCurrent: 20, hpMax: 20,
    baseAttackBonus: 5, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(15),
    abilityScores: { strength: 16, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    position: { x: 0, y: 0, zFeet: 0 },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0, healingReceived: 0 },
    controlledBy: { type: "player", participantId: "player-blind-actor" }, buffs: [], abilities: []
  };
  const target = {
    id: "legacy-target", name: "Blanco", type: "enemy", hpCurrent: 100, hpMax: 100,
    baseAttackBonus: 0, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...structuredSnapshotFields(10), baseSpeedFeet: 20, position: { x: 1, y: 0, zFeet: 0 },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, opportunityAttacksMade: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0, healingReceived: 0 },
    controlledBy: { type: "gm" }, buffs: [], abilities: []
  };
  room2.combatants.push(attacker, target);
  room2.turnOrder.push(attacker.id, target.id);
  room2.currentTurn.combatantId = attacker.id;
  room2.currentTurn.attackMode = "standard";

  handleResolveAttack(room2, { type: "resolve-attack", roomCode: "BLIND01", actorId: "player-blind-actor", attackerId: "legacy-attacker", targetId: "legacy-target", d20Roll: 15, damage: 9 });
  assert.equal(target.hpCurrent, 100 - 9, "el formato legado targetId debe seguir funcionando identico a antes de Sprint 053B.");
});

test("regresion: manual roll y auto-roll siguen funcionando con el nuevo camino de targeting", () => {
  const { room: roomManual, target: targetManual } = makeRoom();
  attackDirect(roomManual, "player-blind-actor", "blind-target");
  assert.equal(targetManual.hpCurrent, 100 - 9, "tirada manual (d20Roll=15) sigue funcionando.");

  const { room: roomAuto, target: targetAuto } = makeRoom();
  handleResolveAttack(roomAuto, {
    type: "resolve-attack", roomCode: "BLIND01", actorId: "player-blind-actor", attackerId: "blind-attacker",
    target: { kind: "combatant", combatantId: "blind-target" }, d20Roll: null, damage: null, isAutoRoll: true
  }, { diceRoller: (sides) => (sides === 20 ? 15 : 3) });
  assert.equal(targetAuto.hpCurrent < 100, true, "auto-roll (isAutoRoll=true) sigue funcionando y aplica dano.");
});
