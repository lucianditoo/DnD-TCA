import test from "node:test";
import assert from "node:assert/strict";
import { handleMoveCombatant } from "../apps/server/src/commands/movementCommands.ts";
import { handleDeclareAttackMode, handleCancelAttackMode, handleUseTacticalAction } from "../apps/server/src/commands/tacticalCommands.ts";
import { handleResolveAttack } from "../apps/server/src/commands/attackCommands.ts";
import { applyDisabledExertion } from "../apps/server/src/combat/lifeStatusEffects.ts";
import { applyDamage, createEmptyRoom } from "@dnd-tactical/shared";
import { clients } from "../apps/server/src/room/roomStore.ts";
import { inventoryEquipment, structuredSnapshotFields } from "./test-utils.mjs";

const mockSocketSystem = { readyState: 1, OPEN: 1, send: () => {} };
clients.set(mockSocketSystem, { id: "system", role: "gm", name: "System", roomCode: "test-room" });

function setupRoom() {
  const room = createEmptyRoom("test-room");
  const hero = {
    id: "hero",
    name: "Hero",
    type: "player",
    hpMax: 10,
    hpCurrent: 0, // Disabled
    isStable: false,
    ...structuredSnapshotFields(10),
    baseAttackBonus: 1, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    position: { x: 0, y: 0 },
    buffs: [],
    abilities: [],
    controlledBy: { type: "gm" },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0, opportunityAttacksMade: 0 }
  };
  const goblin = {
    id: "goblin",
    name: "Goblin",
    type: "enemy",
    hpMax: 10,
    hpCurrent: 10,
    isStable: false,
    ...structuredSnapshotFields(10),
    baseAttackBonus: 1, baseFortitude: 0, baseReflex: 0, baseWill: 0,
    ...inventoryEquipment("dagger"),
    position: { x: 1, y: 0 },
    buffs: [],
    abilities: [],
    controlledBy: { type: "gm" },
    stats: { attacksMade: 0, hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, timesDroppedToZero: 0, kills: 0, distanceMovedFeet: 0, opportunityAttacksMade: 0 }
  };
  room.combatants.push(hero, goblin);
  room.phase = "active";
  room.turnOrder = ["hero", "goblin"];
  room.activeTurnIndex = 0;
  return { room, hero, goblin };
}

test("Disabled a 0 HP: Reglas de Esfuerzo e Incapacitación", async (t) => {
  await t.test("Declarar modo 'standard' o cancelarlo no consume acción ni HP", () => {
    const { room, hero } = setupRoom();
    
    // Preparar standard
    handleDeclareAttackMode(room, { type: "declare-attack-mode", actorId: "system", combatantId: hero.id, mode: "standard", defensive: false });
    assert.equal(room.currentTurn.attackMode, "standard");
    assert.equal(hero.hpCurrent, 0); // Sigue a 0
    assert.equal(room.currentTurn.usedStandardAction, false); // No gastó acción

    // Cancelar
    handleCancelAttackMode(room, { type: "cancel-attack-mode", actorId: "system", combatantId: hero.id });
    assert.equal(room.currentTurn.attackMode, "none");
    assert.equal(hero.hpCurrent, 0);
  });

  await t.test("Declarar modo 'full' es rechazado a 0 HP", () => {
    const { room, hero } = setupRoom();
    assert.throws(() => {
      handleDeclareAttackMode(room, { type: "declare-attack-mode", actorId: "system", combatantId: hero.id, mode: "full", defensive: false });
    }, /Un personaje a 0 HP no puede realizar un Ataque Completo/);
    assert.equal(hero.hpCurrent, 0);
  });

  await t.test("Ataque exitoso causa pérdida de 1 HP", () => {
    const { room, hero, goblin } = setupRoom();
    handleDeclareAttackMode(room, { type: "declare-attack-mode", actorId: "system", combatantId: hero.id, mode: "standard", defensive: false });
    
    // Ataque acierta (d20 = 15 contra CA 10)
    handleResolveAttack(room, { type: "resolve-attack", actorId: "system", attackerId: hero.id, targetId: goblin.id, d20Roll: 15, damage: 5 });
    
    assert.equal(hero.hpCurrent, -1);
    assert.equal(room.currentTurn.usedStandardAction, true);
  });

  await t.test("Ataque fallido causa pérdida de 1 HP", () => {
    const { room, hero, goblin } = setupRoom();
    handleDeclareAttackMode(room, { type: "declare-attack-mode", actorId: "system", combatantId: hero.id, mode: "standard", defensive: false });
    
    // Ataque falla (d20 = 2 contra CA 10)
    handleResolveAttack(room, { type: "resolve-attack", actorId: "system", attackerId: hero.id, targetId: goblin.id, d20Roll: 2, damage: 5 });
    
    assert.equal(hero.hpCurrent, -1);
    assert.equal(room.currentTurn.usedStandardAction, true);
  });

  await t.test("Ataque rechazado NO causa pérdida de HP", () => {
    const { room, hero, goblin } = setupRoom();
    
    assert.throws(() => {
      // Rechazado por no preparar modo
      handleResolveAttack(room, { type: "resolve-attack", actorId: "system", attackerId: hero.id, targetId: goblin.id, d20Roll: 15, damage: 5 });
    }, /Debe preparar un modo/);
    
    assert.equal(hero.hpCurrent, 0);
    assert.equal(room.currentTurn.usedStandardAction, false);
  });

  await t.test("Movimiento normal no causa pérdida de HP y bloquea acción estándar posterior", () => {
    const { room, hero, goblin } = setupRoom();
    
    // Mover 5 pies
    handleMoveCombatant(room, { type: "move-combatant", actorId: "system", combatantId: hero.id, path: [{ x: 0, y: 1 }] });
    
    assert.equal(hero.hpCurrent, 0);
    assert.equal(room.currentTurn.usedMoveAction, true);

    // Intentar atacar luego debe ser rechazado
    handleDeclareAttackMode(room, { type: "declare-attack-mode", actorId: "system", combatantId: hero.id, mode: "standard", defensive: false });
    assert.throws(() => {
      handleResolveAttack(room, { type: "resolve-attack", actorId: "system", attackerId: hero.id, targetId: goblin.id, d20Roll: 15, damage: 5 });
    }, /0 HP y ya consumio su unica accion/);
    
    // El HP sigue en 0 porque el ataque fue rechazado antes de procesarse
    assert.equal(hero.hpCurrent, 0);
  });

  await t.test("Ataque estándar bloquea movimiento posterior", () => {
    const { room, hero, goblin } = setupRoom();
    
    handleDeclareAttackMode(room, { type: "declare-attack-mode", actorId: "system", combatantId: hero.id, mode: "standard", defensive: false });
    handleResolveAttack(room, { type: "resolve-attack", actorId: "system", attackerId: hero.id, targetId: goblin.id, d20Roll: 15, damage: 5 });
    
    assert.equal(hero.hpCurrent, -1);
    assert.equal(room.currentTurn.usedStandardAction, true);

    // Intentar mover luego debe ser rechazado
    assert.throws(() => {
      handleMoveCombatant(room, { type: "move-combatant", actorId: "system", combatantId: hero.id, path: [{ x: 0, y: 1 }] });
    }, /(0 HP y ya consumio su unica accion|moribundo e inconsciente)/);
  });

  await t.test("Paso de 5 pies (5-foot step)", async (t) => {
    await t.test("No consume la acción única y permite atacar", () => {
      const { room, hero, goblin } = setupRoom();
      
      handleUseTacticalAction(room, { type: "use-tactical-action", actorId: "system", combatantId: hero.id, action: "five-foot-step", to: { x: 0, y: 1 } });
      assert.equal(hero.hpCurrent, 0); // No causa daño
      
      handleDeclareAttackMode(room, { type: "declare-attack-mode", actorId: "system", combatantId: hero.id, mode: "standard", defensive: false });
      
      // El ataque está permitido
      handleResolveAttack(room, { type: "resolve-attack", actorId: "system", attackerId: hero.id, targetId: goblin.id, d20Roll: 15, damage: 5 });
      assert.equal(hero.hpCurrent, -1); // Pierde el HP por el ataque, no por el paso
    });

    await t.test("Movimiento normal bloquea el 5-foot step", () => {
      const { room, hero } = setupRoom();
      handleMoveCombatant(room, { type: "move-combatant", actorId: "system", combatantId: hero.id, path: [{ x: 0, y: 1 }] });
      
      assert.throws(() => {
        handleUseTacticalAction(room, { type: "use-tactical-action", actorId: "system", combatantId: hero.id, action: "five-foot-step", to: { x: 0, y: 2 } });
      }, /Ya uso movimiento este turno; no puede dar un paso de 5 pies/);
    });
  });

  await t.test("Helper applyDisabledExertion: Curación evita que se aplique esfuerzo", () => {
    const hero = {
      id: "hero", name: "Hero", hpMax: 10, hpCurrent: 0, isStable: false,
      baseAttackBonus: 1, baseFortitude: 0, baseReflex: 0, baseWill: 0,
      buffs: [], abilities: []
    };
    
    // Capturar que comenzó a 0 HP
    const wasDisabledAtActionStart = hero.hpCurrent === 0;

    // Supongamos que la acción estándar (ej. lanzar conjuro Curar Heridas Ligeras) sana 5 HP
    // La acción es extenuante, pero muta el HP durante la resolución
    hero.hpCurrent = 5;

    // Aplicar la helper al final
    const result = applyDisabledExertion(hero, { wasDisabledAtActionStart, actionKind: "standard", actionWasExerting: true });
    
    assert.equal(result.applied, false);
    assert.equal(hero.hpCurrent, 5); // No sufre el 1 de daño porque ya no tiene <= 0 HP
  });
});
