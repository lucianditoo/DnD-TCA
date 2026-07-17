import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Rules, EffectReducer, effectsCatalog } from '@dnd-tactical/shared';
import { resolveAttack } from '../apps/server/src/combat/attackResolver.js';
import { inventoryEquipment } from './test-utils.mjs';

describe('Sprint 014 - Condiciones V3 Formales', () => {

  function createTestCombatant(id, name, overrides = {}) {
    return {
      id,
      name,
      type: 'hero',
      controller: 'player1',
      hpCurrent: 10,
      hpMax: 10,
      baseSpeedFeet: 30,
      baseAttackBonus: 1, baseFortitude: 0, baseReflex: 0, baseWill: 0,
      abilityScores: { strength: 14, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      sizeCategory: 'medium',
      creatureTypeId: 'humanoid',
      ...inventoryEquipment(null),
      featIds: [],
      featureIds: [],
      buffs: [],
      position: { x: 0, y: 0 },
      ruleTraits: [],
      intrinsicDefense: { naturalArmorBonus: 0, dodgeBonus: 0, deflectionBonus: 0, miscArmorClassBonus: 0 },
      abilities: [],
      sneakAttackDice: 0,
      roomId: "room1",
      stats: { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, kills: 0, timesDroppedToZero: 0, healingReceived: 0 },
      ...overrides
    };
  }

  function createEffectInstance(effectId, targetId) {
    return {
      instanceId: 'inst_123',
      effectId,
      source: { type: 'system' },
      targets: [targetId],
      duration: { type: 'infinite' },
      turnApplied: 1
    };
  }

  it('srd_paralyzed reduce Destreza a 0, CA aplica -5 puro, y otorga +4 al atacante melee (HELPLESS)', () => {
    const target = createTestCombatant('c1', 'Hero');
    const instParalyzed = createEffectInstance('srd_paralyzed', target.id);
    const context = {
      effectInstances: [instParalyzed],
      board: { width: 10, height: 10, cellSizeFeet: 5 },
      combatants: [target],
      turn: 1
    };
    
    const speed = Rules.totalSpeedFeet(context, target);
    assert.strictEqual(speed, 0, 'La velocidad debe ser 0 al estar paralizado');

    const ac = Rules.totalArmorClass(context, target, { attackType: 'melee', targetAcType: 'normal' });
    assert.strictEqual(ac.total, 5, 'La CA debe caer de 12 a 5 debido al override de Destreza a 0 (-5 mod)');

    const actionAv = Rules.evaluateActionAvailability(context, target);
    assert.strictEqual(actionAv.ok, false, 'Debe impedir acciones por CANNOT_ACT');

    const attacker = createTestCombatant('a1', 'Attacker', { 
      position: { x: 1, y: 0 },
      baseAttackBonus: 5, baseFortitude: 0, baseReflex: 0, baseWill: 0,
      abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
    });
    
    const attackSource = {
      name: 'Espada Larga',
      attackType: 'melee',
      targetAcType: 'normal',
      abilityForAttack: 'strength',
      maxRangeFeet: 5,
      criticalThreatFrom: 19,
      criticalMultiplier: 2,
      defaultDamage: 8
    };

    const res = resolveAttack(context, attacker, target, 10, null, 'Ataque Test', 0, { source: attackSource });
    assert.strictEqual(res.attackBonusTotal, 9, 'El bono total debe incluir el +4 circunstancial por HELPLESS');
    assert.strictEqual(res.attackParts.some(p => p.includes('indefenso +4')), true, 'Debe mostrar el label de indefenso');
  });

  it('srd_fatigued reduce Fuerza y Destreza en 2 puntos', () => {
    const target = createTestCombatant('c2', 'Hero', {
      abilityScores: { strength: 14, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 }
    });
    const instFatigued = createEffectInstance('srd_fatigued', target.id);
    const context = {
      effectInstances: [instFatigued],
      board: { width: 10, height: 10, cellSizeFeet: 5 },
      combatants: [target],
      turn: 1
    };

    const ac = Rules.totalArmorClass(context, target, { attackType: 'melee', targetAcType: 'normal' });
    assert.strictEqual(ac.total, 11, 'La CA debe bajar a 11 (-1 por pérdida de 2 pts de Dex)');

    const atk = Rules.totalAttackBonus(context, target, { abilityForAttack: 'strength' });
    assert.strictEqual(atk.total, 2, 'El ataque debe bajar a +2 (-1 por pérdida de 2 pts de Str)');
  });

  it('srd_prone aplica -4 CA melee, +4 CA ranged, y -4 Ataque melee', () => {
    const target = createTestCombatant('c3', 'Hero');
    const instProne = createEffectInstance('srd_prone', target.id);
    const context = {
      effectInstances: [instProne],
      board: { width: 10, height: 10, cellSizeFeet: 5 },
      combatants: [target],
      turn: 1
    };

    const acMelee = Rules.totalArmorClass(context, target, { attackType: 'melee', targetAcType: 'normal' });
    assert.strictEqual(acMelee.total, 8, 'CA contra melee debe ser 12 - 4 = 8');

    const acRanged = Rules.totalArmorClass(context, target, { attackType: 'ranged', targetAcType: 'normal' });
    assert.strictEqual(acRanged.total, 16, 'CA contra ranged debe ser 12 + 4 = 16');

    const atkMelee = Rules.totalAttackBonus(context, target, { abilityForAttack: 'strength', attackType: 'melee' });
    assert.strictEqual(atkMelee.total, -1, 'Ataque melee debe recibir -4 por estar Prone');
  });
});
