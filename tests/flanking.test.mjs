import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Rules,
  createEmptyRoom,
  getAttackContextModifiers,
  getWeaponAttackTypeForTarget,
  isFlanking,
  threatensTarget
} from "../packages/shared/dist/index.js";
import { inventoryEquipment, structuredSnapshotFields } from "./test-utils.mjs";

function combatant(id, type, overrides = {}) {
  return {
    id,
    name: id,
    type,
    hpCurrent: 10,
    hpMax: 10,
    isStable: false,
    position: { x: 0, y: 0, zFeet: 0 },
    ...structuredSnapshotFields(10),
    buffs: [],
    ...overrides
  };
}

function setupRoom() {
  const room = createEmptyRoom("FLANK");
  const hero = combatant("hero-1", "player");
  const ally = combatant("ally-1", "player");
  const enemy = combatant("enemy-1", "enemy");
  room.combatants = [hero, ally, enemy];
  return { room, hero, ally, enemy };
}

function effect(effectId, targetId) {
  return {
    instanceId: `effect-${effectId}-${targetId}`,
    effectId,
    source: { type: "system" },
    targets: [targetId],
    appliedAtEvent: { type: "CombatStarted", round: 1 }
  };
}

test("threatensTarget", async (t) => {
  await t.test("arma melee amenaza dentro de alcance", () => {
    const { room, hero, enemy } = setupRoom();
    enemy.position = { x: 1, y: 0, zFeet: 0 };
    assert.equal(threatensTarget(room, hero, enemy), true);
  });

  await t.test("ataque natural amenaza como fuente derivada", () => {
    const { room, hero, enemy } = setupRoom();
    Object.assign(hero, inventoryEquipment(null), { naturalAttackId: "canocrock-bite" });
    enemy.position = { x: 1, y: 0, zFeet: 0 };
    assert.equal(threatensTarget(room, hero, enemy), true);
  });

  await t.test("sin fuente melee explícita no amenaza", () => {
    const { room, hero, enemy } = setupRoom();
    Object.assign(hero, inventoryEquipment(null));
    enemy.position = { x: 1, y: 0, zFeet: 0 };
    assert.equal(threatensTarget(room, hero, enemy), false);
  });

  await t.test("fuera de alcance no amenaza", () => {
    const { room, hero, enemy } = setupRoom();
    enemy.position = { x: 2, y: 0, zFeet: 0 };
    assert.equal(threatensTarget(room, hero, enemy), false);
  });

  await t.test("daga arrojadiza conserva capacidad melee a 5 ft", () => {
    const { room, hero, enemy } = setupRoom();
    Object.assign(hero, inventoryEquipment("dagger"));
    enemy.position = { x: 1, y: 0, zFeet: 0 };
    assert.equal(threatensTarget(room, hero, enemy), true);
    assert.equal(getWeaponAttackTypeForTarget(room, hero, enemy), "melee");
  });

  await t.test("daga fuera de meleeReach no amenaza y se resuelve ranged", () => {
    const { room, hero, enemy } = setupRoom();
    Object.assign(hero, inventoryEquipment("dagger"));
    enemy.position = { x: 4, y: 0, zFeet: 0 };
    assert.equal(threatensTarget(room, hero, enemy), false);
    assert.equal(getWeaponAttackTypeForTarget(room, hero, enemy), "ranged");
  });

  for (const [name, hpCurrent, isStable] of [
    ["dying", -5, false],
    ["stable", -5, true],
    ["dead", -10, false]
  ]) {
    await t.test(`${name} no amenaza`, () => {
      const { room, hero, enemy } = setupRoom();
      hero.hpCurrent = hpCurrent;
      hero.isStable = isStable;
      enemy.position = { x: 1, y: 0, zFeet: 0 };
      assert.equal(threatensTarget(room, hero, enemy), false);
    });
  }

  await t.test("disabled sigue consciente y amenaza", () => {
    const { room, hero, enemy } = setupRoom();
    hero.hpCurrent = 0;
    enemy.position = { x: 1, y: 0, zFeet: 0 };
    assert.equal(threatensTarget(room, hero, enemy), true);
  });

  await t.test("misma facción no es objetivo amenazado", () => {
    const { room, hero, ally } = setupRoom();
    ally.position = { x: 1, y: 0, zFeet: 0 };
    assert.equal(threatensTarget(room, hero, ally), false);
  });
});

test("oposición 1x1 e isFlanking", async (t) => {
  for (const [name, heroPosition, allyPosition] of [
    ["Norte / Sur", { x: 1, y: 0, zFeet: 0 }, { x: 1, y: 2, zFeet: 0 }],
    ["Este / Oeste", { x: 2, y: 1, zFeet: 0 }, { x: 0, y: 1, zFeet: 0 }],
    ["Diagonal NE / SW", { x: 2, y: 0, zFeet: 0 }, { x: 0, y: 2, zFeet: 0 }]
  ]) {
    await t.test(`${name} flanquea`, () => {
      const { room, hero, ally, enemy } = setupRoom();
      enemy.position = { x: 1, y: 1, zFeet: 0 };
      hero.position = heroPosition;
      ally.position = allyPosition;
      assert.equal(isFlanking(room, hero, enemy), true);
    });
  }

  await t.test("Norte / Este no flanquea", () => {
    const { room, hero, ally, enemy } = setupRoom();
    enemy.position = { x: 1, y: 1, zFeet: 0 };
    hero.position = { x: 1, y: 0, zFeet: 0 };
    ally.position = { x: 2, y: 1, zFeet: 0 };
    assert.equal(isFlanking(room, hero, enemy), false);
  });

  await t.test("aliado sin fuente melee no concede flanqueo", () => {
    const { room, hero, ally, enemy } = setupRoom();
    enemy.position = { x: 1, y: 1, zFeet: 0 };
    hero.position = { x: 1, y: 0, zFeet: 0 };
    ally.position = { x: 1, y: 2, zFeet: 0 };
    Object.assign(ally, inventoryEquipment(null));
    assert.equal(isFlanking(room, hero, enemy), false);
  });

  await t.test("aliado fuera de alcance no concede flanqueo", () => {
    const { room, hero, ally, enemy } = setupRoom();
    enemy.position = { x: 1, y: 1, zFeet: 0 };
    hero.position = { x: 1, y: 0, zFeet: 0 };
    ally.position = { x: 1, y: 3, zFeet: 0 };
    assert.equal(isFlanking(room, hero, enemy), false);
  });
});

test("NO_THREAT y CANNOT_MAKE_AOO son capacidades distintas", () => {
  const { room, hero, ally, enemy } = setupRoom();
  enemy.position = { x: 1, y: 1, zFeet: 0 };
  hero.position = { x: 1, y: 0, zFeet: 0 };
  ally.position = { x: 1, y: 2, zFeet: 0 };

  room.effectInstances = [effect("srd_flat_footed", ally.id)];
  assert.equal(Rules.canMakeOpportunityAttack(room, ally), false);
  assert.equal(threatensTarget(room, ally, enemy), true, "Flat-Footed no elimina amenaza");
  assert.equal(isFlanking(room, hero, enemy), true);

  room.effectInstances = [effect("srd_stunned", ally.id)];
  assert.equal(threatensTarget(room, ally, enemy), false, "NO_THREAT elimina amenaza inmediatamente");
  assert.equal(isFlanking(room, hero, enemy), false);
});

test("getAttackContextModifiers separa melee y ranged", () => {
  const { room, hero, ally, enemy } = setupRoom();
  enemy.position = { x: 1, y: 1, zFeet: 0 };
  hero.position = { x: 1, y: 0, zFeet: 0 };
  ally.position = { x: 1, y: 2, zFeet: 0 };

  const context = getAttackContextModifiers(room, hero, enemy);
  assert.equal(context.flanking, true);
  const noConcealment = { applies: false, kind: "none", missChancePercent: 0, directTargetingAllowed: true, requiresTargetSquare: false, opportunityAttackAllowed: true, labelParts: [], traces: [] };
  assert.deepEqual(context.byAttackType.melee.concealment, noConcealment);
  assert.deepEqual(context.byAttackType.ranged.concealment, noConcealment);
  delete context.byAttackType.melee.concealment;
  delete context.byAttackType.ranged.concealment;
  const noCover = { applies: false, acBonus: 0, kind: "none", blockerIds: [], blockedCellKeys: [] };
  assert.deepEqual(context.byAttackType.melee, { attackBonus: 2, labelParts: ["flanqueo +2"], cover: noCover });
  assert.deepEqual(context.byAttackType.ranged, { attackBonus: -4, labelParts: ["disparo a melé -4"], cover: noCover });
});

test("sin flanqueo ambos contextos retornan cero", () => {
  const { room, hero, ally, enemy } = setupRoom();
  enemy.position = { x: 1, y: 1, zFeet: 0 };
  hero.position = { x: 1, y: 0, zFeet: 0 };
  ally.position = { x: 2, y: 1, zFeet: 0 };
  const context = getAttackContextModifiers(room, hero, enemy);
  assert.equal(context.flanking, false);
  assert.equal(context.byAttackType.melee.attackBonus, 0);
  assert.equal(context.byAttackType.ranged.attackBonus, -4);
});
