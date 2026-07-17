import test from "node:test";
import assert from "node:assert/strict";
import { createCombatRulesSnapshot, getEnvironmentalHazardHits, footprintCellKey, parseCellKey } from "@dnd-tactical/shared";
import { advanceTurn } from "../apps/server/src/combat/turnManager.js";
import { resolveEnvironmentalHazards } from "../apps/server/src/combat/environmentalHazardResolver.js";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

function hazardInstance(overrides = {}) {
  return {
    instanceId: "hazard-1",
    effectId: "srd_wall_of_fire_hazard",
    source: { type: "environment" },
    targetCells: ["5,5,0"],
    appliedAtEvent: { type: "SystemInjected", round: 1 },
    ...overrides
  };
}

function roomWithSingleCombatant(combatant, effectInstances = []) {
  return makeTestRoom({
    combatants: [combatant],
    turnOrder: [combatant.id],
    activeTurnIndex: 0,
    round: 1,
    currentTurn: { ...makeTestRoom().currentTurn, combatantId: combatant.id },
    effectInstances
  });
}

test("Sprint 034 - Salvaciones Pasivas Ambientales & Trampas", async (t) => {
  await t.test("footprintCellKey/parseCellKey son inversas exactas", () => {
    const position = { x: 3, y: -2, zFeet: 10 };
    const key = footprintCellKey(position);
    assert.equal(key, "3,-2,10");
    assert.deepEqual(parseCellKey(key), position);
  });

  await t.test("parseCellKey rechaza claves mal formadas", () => {
    assert.throws(() => parseCellKey("no-es-una-clave"), /Clave de celda inválida/);
    assert.throws(() => parseCellKey("1,2"), /Clave de celda inválida/);
  });

  await t.test("getEnvironmentalHazardHits detecta huella Large 2x2 parcialmente solapada, sin dados ni mutación", () => {
    const largeHero = makeTestCombatant({ id: "large-hero", sizeCategory: "large", position: { x: 5, y: 4, zFeet: 0 } });
    const bystander = makeTestCombatant({ id: "bystander", position: { x: 0, y: 0, zFeet: 0 } });
    const deadInZone = makeTestCombatant({ id: "dead-in-zone", position: { x: 5, y: 5, zFeet: 0 }, hpCurrent: -10 });
    const room = makeTestRoom({
      combatants: [largeHero, bystander, deadInZone],
      effectInstances: [hazardInstance()]
    });

    const snapshot = createCombatRulesSnapshot(room);
    const hits = getEnvironmentalHazardHits(snapshot);

    assert.equal(hits.length, 1, "Solo el Large parcialmente solapado debe detectarse; el muerto se excluye y el transeúnte no se solapa.");
    assert.equal(hits[0].combatantId, "large-hero");
    assert.equal(hits[0].effectId, "srd_wall_of_fire_hazard");
    // Pureza: la sala no debe mutarse ni el HP debe alterarse por la sola detección.
    assert.equal(room.combatants.find((c) => c.id === "large-hero").hpCurrent, 20);
  });

  await t.test("una ronda con Muro de Fuego activo: salvación exitosa mitiga el daño a la mitad limpia", () => {
    const largeHero = makeTestCombatant({ id: "large-hero", sizeCategory: "large", position: { x: 5, y: 4, zFeet: 0 } });
    const room = roomWithSingleCombatant(largeHero, [hazardInstance()]);

    advanceTurn(room, () => 20); // 20 natural: éxito automático de salvación.

    const updated = room.combatants.find((c) => c.id === "large-hero");
    // averageDiceDamage("2d4") = 5; mitigado a la mitad => max(1, floor(5/2)) = 2.
    assert.equal(updated.hpCurrent, 18);
    assert.ok(room.log.some((entry) => entry.message.includes("atrapado por Muro de Fuego")));
    assert.ok(room.log.some((entry) => entry.message.includes("éxito automático por 20 natural")));
    assert.ok(room.log.some((entry) => entry.message.includes("Daño: 2")));
  });

  await t.test("una ronda con Muro de Fuego activo: salvación fallida (1 natural) aplica el daño completo", () => {
    const largeHero = makeTestCombatant({ id: "large-hero", sizeCategory: "large", position: { x: 5, y: 4, zFeet: 0 } });
    const room = roomWithSingleCombatant(largeHero, [hazardInstance()]);

    advanceTurn(room, () => 1); // 1 natural: fallo automático.

    const updated = room.combatants.find((c) => c.id === "large-hero");
    assert.equal(updated.hpCurrent, 15); // 20 - 5 (sin mitigar)
    assert.ok(room.log.some((entry) => entry.message.includes("fallo automático por 1 natural")));
    assert.ok(room.log.some((entry) => entry.message.includes("Daño: 5")));
  });

  await t.test("hazard sin damageExpression no rompe la resolución y aplica el efecto secundario solo en fallo", () => {
    const target = makeTestCombatant({ id: "gas-target", position: { x: 2, y: 2, zFeet: 0 } });
    const gasInstance = {
      instanceId: "hazard-gas",
      effectId: "srd_poison_gas_hazard",
      source: { type: "environment" },
      targetCells: ["2,2,0"],
      appliedAtEvent: { type: "SystemInjected", round: 1 }
    };
    const room = roomWithSingleCombatant(target, [gasInstance]);

    advanceTurn(room, () => 1); // 1 natural: fallo automático de Fortaleza.

    const updated = room.combatants.find((c) => c.id === "gas-target");
    assert.equal(updated.hpCurrent, 20, "El hazard sin damageExpression no debe alterar el HP.");
    assert.ok(
      room.effectInstances.some((effect) => effect.effectId === "srd_fatigued" && effect.targets?.includes("gas-target")),
      "El efecto secundario declarado en onFailEffectId debe materializarse tras el fallo."
    );
    assert.ok(room.log.some((entry) => entry.message.includes("Efecto adicional aplicado")));
  });

  await t.test("una salvación exitosa contra el hazard de gas no aplica el efecto secundario", () => {
    const target = makeTestCombatant({ id: "gas-target-2", position: { x: 2, y: 2, zFeet: 0 } });
    const gasInstance = {
      instanceId: "hazard-gas-2",
      effectId: "srd_poison_gas_hazard",
      source: { type: "environment" },
      targetCells: ["2,2,0"],
      appliedAtEvent: { type: "SystemInjected", round: 1 }
    };
    const room = roomWithSingleCombatant(target, [gasInstance]);

    advanceTurn(room, () => 20); // 20 natural: éxito automático.

    const updated = room.combatants.find((c) => c.id === "gas-target-2");
    assert.equal(updated.hpCurrent, 20);
    assert.equal(
      room.effectInstances.some((effect) => effect.effectId === "srd_fatigued"),
      false,
      "Con salvación exitosa no debe inyectarse el efecto secundario."
    );
  });

  await t.test("idempotencia: un combatiente estable en negativo fuera de la zona no sufre daño pasivo extra tras rondas repetidas", () => {
    const stableHero = makeTestCombatant({ id: "stable-hero", position: { x: 0, y: 0, zFeet: 0 }, hpCurrent: -5, isStable: true });
    const room = roomWithSingleCombatant(stableHero, [hazardInstance()]); // hazard en (5,5), lejos de (0,0)

    advanceTurn(room, () => 1);
    let updated = room.combatants.find((c) => c.id === "stable-hero");
    assert.equal(updated.hpCurrent, -5, "No debe sufrir sangrado (estable) ni daño ambiental (fuera de la zona) tras la primera ronda.");

    advanceTurn(room, () => 1);
    updated = room.combatants.find((c) => c.id === "stable-hero");
    assert.equal(updated.hpCurrent, -5, "El comportamiento debe ser idéntico e idempotente tras una segunda ronda consecutiva.");
  });

  await t.test("sin recursión: múltiples hazards solapados sobre la misma celda se resuelven en una única pasada acotada", () => {
    const target = makeTestCombatant({ id: "stacked-target", position: { x: 7, y: 7, zFeet: 0 } });
    const stackedInstances = [
      hazardInstance({ instanceId: "hazard-a", targetCells: ["7,7,0"] }),
      hazardInstance({ instanceId: "hazard-b", targetCells: ["7,7,0"] }),
      hazardInstance({ instanceId: "hazard-c", targetCells: ["7,7,0"] })
    ];
    const room = roomWithSingleCombatant(target, stackedInstances);

    const snapshot = createCombatRulesSnapshot(room);
    const hits = getEnvironmentalHazardHits(snapshot);
    assert.equal(hits.length, 3, "Cada instancia de hazard solapada debe producir exactamente un hit, sin duplicación ni explosión combinatoria.");

    const logLengthBefore = room.log.length;
    resolveEnvironmentalHazards(room, () => 20);
    assert.equal(room.log.length - logLengthBefore, 3, "Debe agregarse exactamente un log por hit procesado, en una sola pasada acotada sin recursión.");
  });

  await t.test("resolveEnvironmentalHazards es no-op determinista cuando no hay hazards activos", () => {
    const hero = makeTestCombatant({ id: "solo-hero", position: { x: 1, y: 1, zFeet: 0 } });
    const room = roomWithSingleCombatant(hero, []);
    const logLengthBefore = room.log.length;

    resolveEnvironmentalHazards(room, () => { throw new Error("no debería tirar dados si no hay hazards"); });

    assert.equal(room.log.length, logLengthBefore);
    assert.equal(room.combatants.find((c) => c.id === "solo-hero").hpCurrent, 20);
  });
});
