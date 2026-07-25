import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getOpportunityAttackLegality,
  findTriggeredOpportunityAttacksForPath,
  createCombatRulesSnapshot
} from "@dnd-tactical/shared";
import { findTriggeredRangedOpportunityAttacks } from "../apps/server/src/combat/opportunityAttackResolver.ts";
import { makeTestCombatant, makeTestRoom, inventoryEquipment } from "./test-utils.mjs";

// Sprint 055B (NDD §14.5/§14.7): Opportunity Legality Assessment — Line of Effect, Cover
// (cualquier grado) y Ocultación Total (via ConcealmentAssessment.opportunityAttackAllowed, ya
// correcto desde Sprint 053B) ahora gatean la GENERACIÓN de un Ataque de Oportunidad. Ocultación
// parcial nunca bloquea — solo aporta miss chance en la resolución, sin cambios. Ningún assessment
// se recalcula: getOpportunityAttackLegality consume exclusivamente getLineOfEffect y
// getAttackContextModifiers (Cover + Concealment ya compuestos) via una sola llamada.

const alwaysCanAoO = () => true;

describe("Sprint 055B - getOpportunityAttackLegality (unitarios)", () => {
  it("sin Cover, sin Concealment, con Line of Effect: allowed=true, reason=clear", () => {
    const reactor = makeTestCombatant({ id: "reactor", position: { x: 0, y: 0, zFeet: 0 } });
    const provoker = makeTestCombatant({ id: "provoker", type: "enemy", position: { x: 1, y: 0, zFeet: 0 } });
    const room = makeTestRoom({ combatants: [reactor, provoker] });

    const result = getOpportunityAttackLegality(room, reactor, provoker);
    assert.equal(result.allowed, true);
    assert.equal(result.reason, "clear");
  });

  it("Line of Effect rota (bloqueador de terreno entre reactor y provocador): allowed=false, reason=no-line-of-effect", () => {
    const reactor = makeTestCombatant({ id: "reactor", position: { x: 0, y: 0, zFeet: 0 } });
    const provoker = makeTestCombatant({ id: "provoker", type: "enemy", position: { x: 2, y: 0, zFeet: 0 } });
    const room = makeTestRoom({
      combatants: [reactor, provoker],
      board: { width: 10, height: 10, cellSizeFeet: 5, lineOfEffectBlockingCells: ["1,0"] }
    });

    const result = getOpportunityAttackLegality(room, reactor, provoker);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "no-line-of-effect");
  });

  it("Cover por criatura interpuesta (cualquier grado, no solo Total Cover): allowed=false, reason=cover", () => {
    const reactor = makeTestCombatant({ id: "reactor", position: { x: 0, y: 0, zFeet: 0 } });
    const ally = makeTestCombatant({ id: "ally", type: "enemy", position: { x: 1, y: 0, zFeet: 0 } });
    const provoker = makeTestCombatant({ id: "provoker", type: "enemy", position: { x: 2, y: 0, zFeet: 0 } });
    const room = makeTestRoom({ combatants: [reactor, ally, provoker] });

    const result = getOpportunityAttackLegality(room, reactor, provoker);
    assert.equal(result.allowed, false, "cualquier grado de Cover bloquea el AdO, regla mas estricta que para ataques normales.");
    assert.equal(result.reason, "cover");
  });

  it("Ocultacion Total (oscuridad fuera de Darkvision): allowed=false, reason=total-concealment", () => {
    const reactor = makeTestCombatant({ id: "reactor", position: { x: 0, y: 0, zFeet: 0 } });
    const provoker = makeTestCombatant({ id: "provoker", type: "enemy", position: { x: 1, y: 0, zFeet: 0 } });
    const room = makeTestRoom({
      combatants: [reactor, provoker],
      board: { width: 10, height: 10, cellSizeFeet: 5, darknessCells: ["1,0"] }
    });

    const result = getOpportunityAttackLegality(room, reactor, provoker);
    assert.equal(result.allowed, false, "no puedes realizar un AdO contra Ocultacion Total, ni conociendo la casilla (cita SRD 10_modificadores).");
    assert.equal(result.reason, "total-concealment");
  });

  it("Ocultacion parcial (luz tenue) NO bloquea el AdO: allowed=true, reason=clear", () => {
    const reactor = makeTestCombatant({ id: "reactor", position: { x: 0, y: 0, zFeet: 0 } });
    const provoker = makeTestCombatant({ id: "provoker", type: "enemy", position: { x: 1, y: 0, zFeet: 0 } });
    const room = makeTestRoom({
      combatants: [reactor, provoker],
      board: { width: 10, height: 10, cellSizeFeet: 5, dimLightCells: ["1,0"] }
    });

    const result = getOpportunityAttackLegality(room, reactor, provoker);
    assert.equal(result.allowed, true, "la ocultacion parcial solo aporta miss chance en la resolucion, nunca bloquea el intento.");
    assert.equal(result.reason, "clear");
  });
});

describe("Sprint 055B - findTriggeredOpportunityAttacksForPath (integracion, disparo por movimiento)", () => {
  function makeMover(overrides = {}) {
    return makeTestCombatant({
      id: "mover", name: "Movil", type: "player",
      position: { x: 2, y: 2, zFeet: 0 },
      ...inventoryEquipment("longsword"),
      ...overrides
    });
  }

  function makeEnemy(overrides = {}) {
    return makeTestCombatant({
      id: "enemy-1", name: "Enemigo", type: "enemy",
      position: { x: 1, y: 2, zFeet: 0 },
      ...inventoryEquipment("longsword"),
      ...overrides
    });
  }

  it("sin Cover y sin Concealment: genera el AdO normalmente (regresion)", () => {
    const mover = makeMover();
    const enemy = makeEnemy();
    const room = makeTestRoom({ combatants: [mover, enemy] });
    const path = [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }];

    const opportunities = findTriggeredOpportunityAttacksForPath(room, mover, path, 10, alwaysCanAoO);
    assert.equal(opportunities.length, 1, "abandonar una casilla amenazada sin Cover/Concealment sigue provocando normal.");
    assert.equal(opportunities[0].attackerId, "enemy-1");
  });

  it("Cover por criatura interpuesta entre el reactor y la casilla abandonada: NO genera el AdO", () => {
    // El enemigo necesita alcance (lanza larga, 5-10 ft) para amenazar a 10 ft con un aliado del
    // movil interpuesto a 5 ft — a distancia adyacente no cabe ninguna casilla intermedia.
    const mover = makeMover();
    const enemy = makeEnemy({ position: { x: 0, y: 2, zFeet: 0 }, ...inventoryEquipment("longspear") });
    // Aliado del propio movil (mismo type: "player") interpuesto entre el enemigo (0,2) y la
    // casilla abandonada (2,2) — al ser del mismo bando que el movil, nunca es el mismo un
    // reactor valido (evita que el propio "bloqueador" genere su propio AdO independiente).
    const blocker = makeTestCombatant({ id: "blocker", type: "player", position: { x: 1, y: 2, zFeet: 0 } });
    const room = makeTestRoom({ combatants: [mover, enemy, blocker] });
    const path = [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }];

    const opportunities = findTriggeredOpportunityAttacksForPath(room, mover, path, 10, alwaysCanAoO);
    assert.equal(opportunities.length, 0, "Cover (cualquier grado) impide generar el AdO.");
  });

  it("Ocultacion Total (oscuridad fuera de Darkvision) entre reactor y provocador: NO genera el AdO", () => {
    const mover = makeMover();
    const enemy = makeEnemy();
    const room = makeTestRoom({
      combatants: [mover, enemy],
      board: { width: 10, height: 10, cellSizeFeet: 5, darknessCells: ["2,2"] }
    });
    const path = [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }];

    const opportunities = findTriggeredOpportunityAttacksForPath(room, mover, path, 10, alwaysCanAoO);
    assert.equal(opportunities.length, 0, "Ocultacion Total impide generar el AdO.");
  });

  it("Line of Effect rota entre reactor y provocador: NO genera el AdO", () => {
    // Mismo ajuste de alcance que el caso de Cover: el bloqueador de terreno debe quedar en una
    // celda que no sea la propia celda de ninguno de los dos combatientes (excluida por diseno
    // de computeSupercoverPathAssessment), lo que exige 10 ft de separacion real.
    const mover = makeMover();
    const enemy = makeEnemy({ position: { x: 0, y: 2, zFeet: 0 }, ...inventoryEquipment("longspear") });
    const room = makeTestRoom({
      combatants: [mover, enemy],
      board: { width: 10, height: 10, cellSizeFeet: 5, lineOfEffectBlockingCells: ["1,2"] }
    });
    const path = [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }];

    const opportunities = findTriggeredOpportunityAttacksForPath(room, mover, path, 10, alwaysCanAoO);
    assert.equal(opportunities.length, 0, "sin Line of Effect no hay capacidad fisica real de ejecutar el AdO.");
  });

  it("Ocultacion parcial (luz tenue) NO bloquea: sigue generando el AdO normalmente", () => {
    const mover = makeMover();
    const enemy = makeEnemy();
    const room = makeTestRoom({
      combatants: [mover, enemy],
      board: { width: 10, height: 10, cellSizeFeet: 5, dimLightCells: ["2,2"] }
    });
    const path = [{ x: 3, y: 2, zFeet: 0 }, { x: 4, y: 2, zFeet: 0 }];

    const opportunities = findTriggeredOpportunityAttacksForPath(room, mover, path, 10, alwaysCanAoO);
    assert.equal(opportunities.length, 1, "la ocultacion parcial no bloquea la generacion del AdO.");
  });
});

describe("Sprint 055B - findTriggeredRangedOpportunityAttacks (integracion, disparo por ataque a distancia/conjuro)", () => {
  it("sin Cover y sin Concealment: genera el AdO normalmente contra quien dispara a distancia (regresion)", () => {
    const archer = makeTestCombatant({ id: "archer", type: "player", position: { x: 5, y: 5, zFeet: 0 }, ...inventoryEquipment("longbow") });
    const reactor = makeTestCombatant({ id: "reactor", type: "enemy", position: { x: 4, y: 5, zFeet: 0 } });
    const room = makeTestRoom({ combatants: [archer, reactor] });
    const snapshot = createCombatRulesSnapshot(room);

    const opportunities = findTriggeredRangedOpportunityAttacks(snapshot, archer, 5);
    assert.equal(opportunities.length, 1);
    assert.equal(opportunities[0].attackerId, "reactor");
  });

  it("Cover por criatura interpuesta entre el reactor y quien dispara: NO genera el AdO", () => {
    // El reactor necesita alcance (lanza larga, 10 ft) para amenazar a 10 ft con un bloqueador
    // interpuesto a 5 ft — a la distancia adyacente por defecto no cabe ninguna casilla intermedia.
    // El bloqueador es del mismo bando que el archer (type: "player") para que nunca sea, el
    // mismo, un reactor valido contra el archer (threatensTarget excluye mismo type).
    const archer = makeTestCombatant({ id: "archer", type: "player", position: { x: 5, y: 5, zFeet: 0 }, ...inventoryEquipment("longbow") });
    const reactor = makeTestCombatant({ id: "reactor", type: "enemy", position: { x: 3, y: 5, zFeet: 0 }, ...inventoryEquipment("longspear") });
    const blocker = makeTestCombatant({ id: "blocker", type: "player", position: { x: 4, y: 5, zFeet: 0 } });
    const room = makeTestRoom({ combatants: [archer, reactor, blocker] });
    const snapshot = createCombatRulesSnapshot(room);

    const opportunities = findTriggeredRangedOpportunityAttacks(snapshot, archer, 5);
    assert.equal(opportunities.length, 0, "Cover impide generar el AdO tambien en el camino de ataques a distancia/conjuros.");
  });
});
