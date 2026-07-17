import test from "node:test";
import assert from "node:assert/strict";
import { getRangedIntoMeleeAssessment, getAttackContextModifiers, FeatCatalog } from "../packages/shared/dist/index.js";
import { makeTestCombatant, makeTestRoom, inventoryEquipment } from "./test-utils.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// ATK-RANGED-INTO-MELEE — Penalizador -4 por disparar a un objetivo enzarzado
// en combate cuerpo a cuerpo (PHB 3.5 pág. 140; NDD ranged-into-melee-penalty.md).
// Contrato: enemigos + AL MENOS UNO amenaza al otro (RAW "either threatens");
// excepción de 10 ft respecto del personaje amistoso más cercano al atacante;
// exención declarativa de Disparo Preciso vía FeatCatalog.rangedAttackContribution.
// ─────────────────────────────────────────────────────────────────────────────

function makeArcher(overrides = {}) {
  return makeTestCombatant({
    id: "archer", name: "Arquero", type: "player",
    position: { x: 9, y: 9, zFeet: 0 },
    ...inventoryEquipment("longbow", { extraItems: [{ catalogId: "arrows_20", quantity: 20 }] }),
    ...overrides
  });
}

function makeAllySword(overrides = {}) {
  return makeTestCombatant({
    id: "ally-sword", name: "Espadachin", type: "player",
    position: { x: 0, y: 0, zFeet: 0 },
    ...inventoryEquipment("longsword"),
    ...overrides
  });
}

function makeEnemyTarget(overrides = {}) {
  return makeTestCombatant({
    id: "enemy-target", name: "Objetivo", type: "enemy", controller: "gm",
    position: { x: 1, y: 0, zFeet: 0 },
    ...inventoryEquipment("longbow", { extraItems: [{ catalogId: "arrows_20", quantity: 20 }] }),
    ...overrides
  });
}

function makeRoom(combatants) {
  return makeTestRoom({ combatants });
}

test("ATK-RIM T1: melee no recibe el -4 y el flanqueo existente queda intacto (regresion)", () => {
  // Atacante (2,0) y aliado (0,0) en lados opuestos del objetivo (1,0): flanqueo legitimo.
  const archer = makeArcher({ ...inventoryEquipment("longsword"), position: { x: 2, y: 0, zFeet: 0 } });
  const ally = makeAllySword();
  const target = makeEnemyTarget();
  const room = makeRoom([archer, ally, target]);

  const modifiers = getAttackContextModifiers(room, archer, target);
  assert.equal(modifiers.byAttackType.melee.attackBonus, 2, "El flanqueo +2 pre-existente no cambia con este sprint.");
  assert.deepEqual(modifiers.byAttackType.melee.labelParts, ["flanqueo +2"], "Melee solo lleva flanqueo; el -4 de disparo no contamina melee.");
  assert.ok(!modifiers.byAttackType.melee.labelParts.some((p) => p.includes("disparo")), "Ninguna etiqueta de disparo en melee.");

  // Escenario sin flanqueo (mismo lado): melee vuelve a 0.
  const sameSideArcher = makeArcher({ ...inventoryEquipment("longsword"), position: { x: 0, y: 1, zFeet: 0 } });
  const roomSameSide = makeRoom([sameSideArcher, ally, target]);
  const sameSide = getAttackContextModifiers(roomSameSide, sameSideArcher, target);
  assert.equal(sameSide.byAttackType.melee.attackBonus, 0, "Sin flanqueo, melee queda en 0 (el -4 no contamina melee).");
});

test("ATK-RIM T2: ranged contra objetivo NO enzarzado (sin amistosos cerca) no aplica", () => {
  const archer = makeArcher();
  const target = makeEnemyTarget();
  const room = makeRoom([archer, target]);

  const assessment = getRangedIntoMeleeAssessment(room, archer, target);
  assert.equal(assessment.applies, false);
  assert.equal(assessment.penalty, 0);
  assert.equal(getAttackContextModifiers(room, archer, target).byAttackType.ranged.attackBonus, 0);
});

test("ATK-RIM T3: amenaza unilateral basta — el aliado amenaza al objetivo aunque el objetivo (con arco) no amenace de vuelta", () => {
  const archer = makeArcher();
  const ally = makeAllySword({ position: { x: 0, y: 0, zFeet: 0 } });
  const target = makeEnemyTarget({ position: { x: 1, y: 0, zFeet: 0 } });
  const room = makeRoom([archer, ally, target]);

  const assessment = getRangedIntoMeleeAssessment(room, archer, target);
  assert.equal(assessment.applies, true, "RAW 'either threatens the other': una sola direccion de amenaza basta (D-11).");
  assert.equal(assessment.penalty, -4);
  assert.equal(getAttackContextModifiers(room, archer, target).byAttackType.ranged.attackBonus, -4);
});

test("ATK-RIM T4/T5: arma de alcance (longspear) — enzarzado a 10 ft exactos, pero la excepcion de 10 ft exime; a 5 ft con espada aplica", () => {
  const archer = makeArcher();
  // Aliado con lanza larga: amenaza a 10 ft (no a 5) — Sprint 013.
  const allySpear = makeAllySword({ id: "ally-spear", ...inventoryEquipment("longspear"), position: { x: 0, y: 0, zFeet: 0 } });
  const target = makeEnemyTarget({ position: { x: 2, y: 0, zFeet: 0 } });
  const roomAt10 = makeRoom([archer, allySpear, target]);

  const at10 = getRangedIntoMeleeAssessment(roomAt10, archer, target);
  assert.equal(at10.nearestFriendlyDistanceFeet, 10);
  assert.equal(at10.applies, false, "Enzarzado via alcance, pero el amistoso mas cercano esta a >=10 ft.");
  assert.equal(at10.exemption, "distance");

  // Contraparte bajo el umbral: espadachin adyacente (5 ft).
  const allySword = makeAllySword({ position: { x: 1, y: 1, zFeet: 0 } });
  const targetNear = makeEnemyTarget({ position: { x: 1, y: 0, zFeet: 0 } });
  const roomAt5 = makeRoom([archer, allySword, targetNear]);
  const at5 = getRangedIntoMeleeAssessment(roomAt5, archer, targetNear);
  assert.equal(at5.nearestFriendlyDistanceFeet, 5);
  assert.equal(at5.applies, true, "A 5 ft (bajo el umbral) el penalizador aplica.");
});

test("ATK-RIM T6: footprint Large — la distancia se mide entre huellas, no entre anclas", () => {
  const archer = makeArcher();
  // Aliado en (1,3); objetivo Large 2x2 con ancla en (2,1) ocupando (2,1)(3,1)(2,2)(3,2).
  // Distancia ancla->aliado = 10 ft (1 diagonal + 1 recto), pero la celda (2,2) esta a 5 ft (1 diagonal).
  const ally = makeAllySword({ position: { x: 1, y: 3, zFeet: 0 } });
  const target = makeEnemyTarget({ sizeCategory: "large", position: { x: 2, y: 1, zFeet: 0 } });
  const room = makeRoom([archer, ally, target]);

  const assessment = getRangedIntoMeleeAssessment(room, archer, target);
  assert.equal(assessment.nearestFriendlyDistanceFeet, 5, "La huella 2x2 acerca al objetivo a 5 ft del aliado.");
  assert.equal(assessment.applies, true, "Con medicion por anclas (10 ft) se habria eximido erroneamente.");
});

test("ATK-RIM T7: varios amistosos — manda el amistoso mas cercano EN GENERAL, no el involucrado en la melé", () => {
  const archer = makeArcher();
  // Involucrado: lanza larga a 10 ft del objetivo (amenaza, y por si solo eximiria por distancia).
  const allySpear = makeAllySword({ id: "ally-spear", ...inventoryEquipment("longspear"), position: { x: 0, y: 0, zFeet: 0 } });
  // No involucrado: companero con arco (no amenaza) a 5 ft del objetivo.
  const bystander = makeAllySword({ id: "ally-bystander", ...inventoryEquipment("longbow", { extraItems: [{ catalogId: "arrows_20", quantity: 20 }] }), position: { x: 2, y: 1, zFeet: 0 } });
  const target = makeEnemyTarget({ position: { x: 2, y: 0, zFeet: 0 } });
  const room = makeRoom([archer, allySpear, bystander, target]);

  const assessment = getRangedIntoMeleeAssessment(room, archer, target);
  assert.equal(assessment.nearestFriendlyDistanceFeet, 5, "El mas cercano es el no involucrado (5 ft).");
  assert.equal(assessment.applies, true, "No exime: la regla mide al personaje amistoso mas cercano en general.");
});

test("ATK-RIM T8: Disparo Preciso (srd_precise_shot) elimina el -4 declarativamente", () => {
  const archer = makeArcher({ featIds: ["srd_precise_shot"] });
  const ally = makeAllySword();
  const target = makeEnemyTarget();
  const room = makeRoom([archer, ally, target]);

  const assessment = getRangedIntoMeleeAssessment(room, archer, target);
  assert.equal(assessment.applies, false);
  assert.equal(assessment.exemption, "feat");
  const tactical = getAttackContextModifiers(room, archer, target).byAttackType.ranged;
  assert.equal(tactical.attackBonus, 0);
  assert.ok(tactical.labelParts.some((p) => p.includes("Disparo Preciso")), "El desglose explica la exencion.");
  assert.equal(FeatCatalog.rangedAttackContribution(["srd_precise_shot"]).ignoresFiringIntoMeleePenalty, true);
});

test("ATK-RIM T9: Point Blank Shot por si solo NO elimina el penalizador", () => {
  const archer = makeArcher({ featIds: ["srd_point_blank_shot"] });
  const ally = makeAllySword();
  const target = makeEnemyTarget();
  const room = makeRoom([archer, ally, target]);

  const assessment = getRangedIntoMeleeAssessment(room, archer, target);
  assert.equal(assessment.applies, true, "PBS es prerrequisito de Precise Shot, no exencion de este penalizador.");
  assert.equal(assessment.penalty, -4);
});

test("ATK-RIM T10: el desglose (parts) explica el penalizador", () => {
  const archer = makeArcher();
  const ally = makeAllySword();
  const target = makeEnemyTarget();
  const room = makeRoom([archer, ally, target]);

  const tactical = getAttackContextModifiers(room, archer, target).byAttackType.ranged;
  assert.equal(tactical.attackBonus, -4);
  assert.ok(tactical.labelParts.some((p) => p.includes("disparo a melé -4")), "Etiqueta trazable en labelParts.");
});

test("ATK-RIM T11: determinismo — el orden de los combatientes en el snapshot no altera el resultado", () => {
  const archer = makeArcher();
  const allySpear = makeAllySword({ id: "ally-spear", ...inventoryEquipment("longspear"), position: { x: 0, y: 0, zFeet: 0 } });
  const bystander = makeAllySword({ id: "ally-bystander", ...inventoryEquipment("longbow", { extraItems: [{ catalogId: "arrows_20", quantity: 20 }] }), position: { x: 2, y: 1, zFeet: 0 } });
  const target = makeEnemyTarget({ position: { x: 2, y: 0, zFeet: 0 } });

  const forward = getRangedIntoMeleeAssessment(makeRoom([archer, allySpear, bystander, target]), archer, target);
  const reversed = getRangedIntoMeleeAssessment(makeRoom([target, bystander, allySpear, archer]), archer, target);
  assert.deepEqual({ ...forward }, { ...reversed });
});

test("ATK-RIM T12: un objetivo fuera de combate (moribundo) no se considera enzarzado (simplificacion RAW documentada)", () => {
  const archer = makeArcher();
  const ally = makeAllySword();
  const target = makeEnemyTarget({ hpCurrent: -1 });
  const room = makeRoom([archer, ally, target]);

  const assessment = getRangedIntoMeleeAssessment(room, archer, target);
  assert.equal(assessment.applies, false, "Moribundo: no enzarzado, sin penalizador.");
});
