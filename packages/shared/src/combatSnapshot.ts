import { assertValidProfileSources } from "./equipmentStats.js";
import { deriveSneakAttackDice } from "./combatFeatureCatalog.js";
import { CreatureTypeCatalog } from "./creatureTypeCatalog.js";
import type { Ability, CombatantControl, CombatantSnapshot, CombatantStats, CreatureTemplate, Position, CombatRoom, CombatRulesSnapshot } from "./types.js";
import type { EffectInstance } from "./effects/index.js";
import type { ProductionEffectId } from "./effects/catalog.js";
import { SpellsCatalog } from "./spells/catalog.js";


export interface CreateCombatantSnapshotOptions {
  controlledBy: CombatantControl;
  index?: number;
  abilitiesCatalog?: Ability[];
  idFactory: (prefix: string) => string;
  position?: Position;
}

export function createCombatantSnapshotFromProfile(profile: CreatureTemplate, options: CreateCombatantSnapshotOptions): CombatantSnapshot {
  const idFactory = options.idFactory;
  const normalized = {
    ...profile,
    controller: profile.type === "enemy" ? "gm" : profile.controller,
    hpMax: Math.max(1, Number(profile.hpMax) || 1),
    baseAttackBonus: Number(profile.baseAttackBonus) || 0,
    baseFortitude: Number(profile.baseFortitude) || 0,
    baseReflex: Number(profile.baseReflex) || 0,
    baseWill: Number(profile.baseWill) || 0,
    baseSpeedFeet: Math.max(0, Number(profile.baseSpeedFeet) || 30),
    buffs: profile.buffs.map((buff) => ({ ...buff })),
    position: { ...profile.position },
    abilityScores: { ...profile.abilityScores },
    creatureTypeId: profile.creatureTypeId,
    featureIds: [...profile.featureIds],
    skillRanks: { ...profile.skillRanks },
    inventory: profile.inventory.map((item) => ({ ...item })),
    equipmentSlots: { ...profile.equipmentSlots },
    featIds: [...profile.featIds],
    intrinsicDefense: { ...profile.intrinsicDefense },
    abilities: [...profile.abilities],
    preparedSpellLoadout: profile.preparedSpellLoadout?.map((slot) => ({ ...slot })) ?? []
  };
  assertValidProfileSources(normalized);
  const index = options.index ?? 1;
  const baseName = normalized.name;
  return {
    id: idFactory(normalized.type === "enemy" ? "enemy" : "hero"),
    sourceProfileId: profile.id,
    name: index > 1 ? baseName + " " + index : baseName,
    type: normalized.type,
    controller: normalized.controller,
    controlledBy: { ...options.controlledBy },
    playerName: normalized.playerName,
    hpCurrent: normalized.hpMax,
    hpMax: normalized.hpMax,
    baseAttackBonus: normalized.baseAttackBonus,
    baseFortitude: normalized.baseFortitude,
    baseReflex: normalized.baseReflex,
    baseWill: normalized.baseWill,
    baseSpeedFeet: normalized.baseSpeedFeet,
    abilityScores: { ...normalized.abilityScores },
    sizeCategory: normalized.sizeCategory,
    creatureTypeId: normalized.creatureTypeId,
    featureIds: [...normalized.featureIds],
    skillRanks: { ...normalized.skillRanks },
    sneakAttackDice: deriveSneakAttackDice(normalized.featureIds),
    ruleTraits: Object.freeze(CreatureTypeCatalog.traitsFor(normalized.creatureTypeId)),
    inventory: normalized.inventory.map((item) => ({ ...item })),
    equipmentSlots: { ...normalized.equipmentSlots },
    intrinsicDefense: { ...normalized.intrinsicDefense },
    naturalAttackId: normalized.naturalAttackId,
    featIds: [...normalized.featIds],
    initiative: null,
    isStable: false,
    buffs: normalized.buffs.map((buff) => ({ ...buff, id: idFactory("buff") })),
    abilities: resolveAbilities(normalized.abilities, options.abilitiesCatalog ?? []),
    preparedSpells: normalized.preparedSpellLoadout.map((slot) => {
      SpellsCatalog.require(slot.spellId);
      return { slotId: slot.slotId, spellId: slot.spellId, isExpended: false };
    }),
    position: options.position ? { ...options.position } : { ...normalized.position },
    icon: normalized.icon,
    stats: createEmptyCombatantStats()
  };
}

export function createEmptyCombatantStats(): CombatantStats {
  return { damageDealt: 0, damageTaken: 0, distanceMovedFeet: 0, attacksMade: 0, hits: 0, misses: 0, opportunityAttacksMade: 0, opportunityAttacksThisRound: 0, targetsAttackedThisRoundViaAoO: [], kills: 0, timesDroppedToZero: 0, healingReceived: 0 };
}

function resolveAbilities(ids: string[], abilitiesCatalog: Ability[]): Ability[] {
  return ids.map((id) => {
    const ability = abilitiesCatalog.find((candidate) => candidate.id === id);
    if (!ability) throw new Error(`La aptitud ${id} no existe en AbilityCatalog.`);
    return { ...ability, resolution: { ...ability.resolution } };
  });
}

function assertDerivedSnapshotIntegrity(combatant: CombatantSnapshot): void {
  if (!Array.isArray(combatant.inventory)) throw new Error(`Invariante de snapshot violada: ${combatant.name} no posee inventory explícito.`);
  if (!combatant.equipmentSlots) throw new Error(`Invariante de snapshot violada: ${combatant.name} no posee equipmentSlots explícitos.`);
  if (!combatant.intrinsicDefense) throw new Error(`Invariante de snapshot violada: ${combatant.name} no posee intrinsicDefense explícita.`);
  if (!Array.isArray(combatant.featureIds)) throw new Error(`Invariante de snapshot violada: ${combatant.name} no posee featureIds explícitas.`);
  if (!combatant.skillRanks || !Number.isInteger(combatant.skillRanks.escape_artist) || combatant.skillRanks.escape_artist < 0) {
    throw new Error(`Invariante de snapshot violada: ${combatant.name} no posee rangos de Escapismo explícitos.`);
  }
  if (!Array.isArray(combatant.ruleTraits)) throw new Error(`Invariante de snapshot violada: ${combatant.name} no posee ruleTraits derivados.`);
  const slotIds = new Set<string>();
  for (const slot of combatant.preparedSpells ?? []) {
    if (slotIds.has(slot.slotId)) throw new Error(`Invariante de snapshot violada: ${combatant.name} repite slotId ${slot.slotId}.`);
    slotIds.add(slot.slotId);
    SpellsCatalog.require(slot.spellId);
  }
  const sourceProfile: CreatureTemplate = {
    id: combatant.sourceProfileId ?? combatant.id,
    name: combatant.name,
    type: combatant.type,
    controller: combatant.controller,
    playerName: combatant.playerName,
    icon: combatant.icon,
    hpMax: combatant.hpMax,
    baseAttackBonus: combatant.baseAttackBonus,
    baseFortitude: combatant.baseFortitude,
    baseReflex: combatant.baseReflex,
    baseWill: combatant.baseWill,
    baseSpeedFeet: combatant.baseSpeedFeet,
    abilityScores: { ...combatant.abilityScores },
    sizeCategory: combatant.sizeCategory,
    creatureTypeId: combatant.creatureTypeId,
    featureIds: [...combatant.featureIds],
    skillRanks: { ...combatant.skillRanks },
    inventory: combatant.inventory.map((item) => ({ ...item })),
    equipmentSlots: { ...combatant.equipmentSlots },
    featIds: [...combatant.featIds],
    intrinsicDefense: { ...combatant.intrinsicDefense },
    naturalAttackId: combatant.naturalAttackId,
    abilities: [],
    buffs: [],
    position: { ...combatant.position }
  };
  assertValidProfileSources(sourceProfile);
  const expectedSneakAttackDice = deriveSneakAttackDice(combatant.featureIds);
  const expectedTraits = CreatureTypeCatalog.traitsFor(combatant.creatureTypeId);
  if (combatant.sneakAttackDice !== expectedSneakAttackDice) {
    throw new Error(`Invariante de snapshot violada: ${combatant.name} posee sneakAttackDice no derivado de sus features.`);
  }
  if (JSON.stringify(combatant.ruleTraits) !== JSON.stringify(expectedTraits)) {
    throw new Error(`Invariante de snapshot violada: ${combatant.name} posee traits raciales no derivados.`);
  }
}

/**
 * Copia defensiva pura de un array de EffectInstances.
 * Garantiza que mutaciones posteriores al room original no afectan al snapshot.
 * Se clonan: instanceId, effectId, source, targets, targetCells, appliedAtEvent, duration, stacks.
 * Es genérica para aceptar cualquier catálogo (producción o prueba).
 * Debe mantenerse en paridad de campos con el whitelist equivalente de `EffectManager.add`
 * (`effects/manager.ts`) — ambos clonan la misma forma de `EffectInstance` de forma independiente;
 * un campo agregado a uno debe agregarse también al otro (ver DT del bug de `targetCells`, Sprint 042.5).
 */
export function cloneEffectInstances<TId extends string>(
  instances: ReadonlyArray<Readonly<EffectInstance<TId>>>
): ReadonlyArray<Readonly<EffectInstance<TId>>> {
  return instances.map((inst): Readonly<EffectInstance<TId>> => ({
    instanceId: inst.instanceId,
    effectId: inst.effectId,
    source: { ...inst.source },
    ...(inst.targets ? { targets: [...inst.targets] } : {}),
    ...(inst.targetCells ? { targetCells: [...inst.targetCells] } : {}),
    appliedAtEvent: { ...inst.appliedAtEvent },
    ...(inst.duration ? { duration: { ...inst.duration } } : {}),
    ...(inst.stacks !== undefined ? { stacks: inst.stacks } : {})
  }));
}

  export function createCombatRulesSnapshot(room: CombatRoom): CombatRulesSnapshot<ProductionEffectId> {
    const snapshot: CombatRulesSnapshot<ProductionEffectId> = {
      board: {
        width: room.board.width,
        height: room.board.height,
        cellSizeFeet: room.board.cellSizeFeet,
        difficultTerrainCells: room.board.difficultTerrainCells ? [...room.board.difficultTerrainCells] : undefined,
        impassableCells: room.board.impassableCells ? [...room.board.impassableCells] : undefined,
        narrowCells: room.board.narrowCells ? [...room.board.narrowCells] : undefined
      },
    combatants: room.combatants.map((c) => {
      assertDerivedSnapshotIntegrity(c);
      return {
        ...c,
        abilityScores: { ...c.abilityScores },
        featureIds: [...c.featureIds],
        skillRanks: { ...c.skillRanks },
        ruleTraits: [...c.ruleTraits],
        inventory: c.inventory.map((item) => ({ ...item })),
        equipmentSlots: { ...c.equipmentSlots },
        intrinsicDefense: { ...c.intrinsicDefense },
        featIds: [...c.featIds],
        position: { ...c.position },
        buffs: c.buffs.map((b) => ({ ...b })),
        abilities: c.abilities.map((a) => ({ ...a, resolution: { ...a.resolution } })),
        preparedSpells: c.preparedSpells ? c.preparedSpells.map(s => ({ ...s })) : [],
        stats: { ...c.stats }
      };
    }),
    currentTurn: { ...room.currentTurn },
    phase: room.phase,
    pendingOpportunityAttacks: room.pendingOpportunityAttacks.map((o) => ({
      ...o,
      attackerPosition: { ...o.attackerPosition },
      origin: { ...o.origin },
      destination: { ...o.destination }
    })),
    pendingCoupDeGrace: room.pendingCoupDeGrace ? { ...room.pendingCoupDeGrace } : null,
    activeAttackThreat: room.activeAttackThreat ? {
      ...room.activeAttackThreat,
      normalDamageBundle: {
        total: room.activeAttackThreat.normalDamageBundle.total,
        components: room.activeAttackThreat.normalDamageBundle.components.map((component) => ({ ...component }))
      }
    } : null,
    effectInstances: cloneEffectInstances(room.effectInstances)
  };

  if (typeof (globalThis as any).process !== "undefined" && (globalThis as any).process.env?.NODE_ENV !== "production") {
    deepFreeze(snapshot);
  }

  return snapshot;
}

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const val = (obj as any)[prop];
    if (val && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  });
  return obj;
}
