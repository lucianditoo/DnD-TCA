import test from "node:test";
import assert from "node:assert";
import { advanceTurn } from "@dnd-tactical/server/src/combat/turnManager.js";
import { makeTestCombatant, makeTestRoom } from "./test-utils.mjs";

test("Sprint 021 - Global Round Tracker & Bleeding", async (t) => {
  await t.test("1. Al terminar el turno del ultimo combatiente, la ronda incrementa y las reacciones se limpian", () => {
    const room = makeTestRoom();
    
    // Configurar combatientes
    const c1 = makeTestCombatant({ id: "hero-1" });
    const c2 = makeTestCombatant({ id: "enemy-1" });
    
    // C2 gastó un AdO
    c2.stats.opportunityAttacksThisRound = 1;
    
    room.combatants = [c1, c2];
    room.turnOrder = ["hero-1", "enemy-1"];
    room.activeTurnIndex = 1; // Turno de c2
    room.round = 1;
    room.currentTurn.combatantId = "enemy-1";

    advanceTurn(room);
    room.currentTurn.combatantId = room.combatants[room.activeTurnIndex]?.id ?? null;

    assert.strictEqual(room.round, 2, "La ronda debe incrementar a 2.");
    assert.strictEqual(room.activeTurnIndex, 0, "El indice activo debe volver a 0.");
    assert.strictEqual(room.currentTurn.combatantId, "hero-1", "El nuevo turno debe ser de hero-1.");
    
    const nextC2 = room.combatants.find(c => c.id === "enemy-1");
    assert.strictEqual(nextC2.stats.opportunityAttacksThisRound, 0, "opportunityAttacksThisRound debe haberse reseteado a 0.");
  });

  await t.test("2. Un combatiente inestable en negativo pierde 1 HP (COND-02)", () => {
    const room = makeTestRoom();
    
    const dyingHero = makeTestCombatant({ id: "hero-dying" });
    dyingHero.hpCurrent = -5;
    dyingHero.isStable = false;

    room.combatants = [dyingHero];
    room.turnOrder = ["hero-dying"];
    room.activeTurnIndex = 0;
    room.round = 1;
    room.currentTurn.combatantId = "hero-dying";

    advanceTurn(room); // Avanza turno, provocando RoundStarted
    
    const nextHero = room.combatants.find(c => c.id === "hero-dying");
    assert.strictEqual(nextHero.hpCurrent, -6, "Debe haber perdido 1 HP por sangrado pasivo.");
    assert.strictEqual(nextHero.isStable, false, "Debe seguir inestable.");
    
    // Verificamos el log de sangrado
    const bleedLog = room.log.find(l => l.message.includes("está sangrando"));
    assert.ok(bleedLog, "Debe haberse inyectado un log indicando que sangra.");
  });

  await t.test("3. Un combatiente inestable que llega a -10 HP muere (COND-02)", () => {
    const room = makeTestRoom();
    
    const dyingHero = makeTestCombatant({ id: "hero-dying" });
    dyingHero.hpCurrent = -9;
    dyingHero.isStable = false;

    room.combatants = [dyingHero];
    room.turnOrder = ["hero-dying"];
    room.activeTurnIndex = 0;
    room.round = 1;
    room.currentTurn.combatantId = "hero-dying";

    advanceTurn(room); // Avanza turno, provocando RoundStarted
    
    const nextHero = room.combatants.find(c => c.id === "hero-dying");
    assert.strictEqual(nextHero.hpCurrent, -10, "Debe llegar a -10 HP.");
    
    // Wait, el motor (tickLayer) no cambia el LifeStatus explícitamente a "dead",
    // el resolver de lifeStatus(combatant) leerá "dead" si HP <= -10.
    // Veamos si inyecta el log de muerte.
    const deadLog = room.log.find(l => l.message.includes("se ha desangrado y ha muerto"));
    assert.ok(deadLog, "Debe haberse inyectado un log indicando la muerte.");
  });

  await t.test("4. Un combatiente estable no sufre desangrado", () => {
    const room = makeTestRoom();
    
    const stableHero = makeTestCombatant({ id: "hero-stable" });
    stableHero.hpCurrent = -5;
    stableHero.isStable = true;

    room.combatants = [stableHero];
    room.turnOrder = ["hero-stable"];
    room.activeTurnIndex = 0;
    room.round = 1;
    room.currentTurn.combatantId = "hero-stable";

    advanceTurn(room); // Avanza turno, provocando RoundStarted
    
    const nextHero = room.combatants.find(c => c.id === "hero-stable");
    assert.strictEqual(nextHero.hpCurrent, -5, "No debe haber perdido HP porque esta estable.");
  });
});
