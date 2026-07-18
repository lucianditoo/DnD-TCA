import {
  distanceFeet,
  lifeStatus,
  Rules,
  isCriticalThreat,
  isCriticalConfirmed,
  canApplySneakAttack,
  averageWeaponDamageForCombatant,
  getAbilityModifier,
  type Buff,
  type CombatRoom,
  type CombatRulesSnapshot,
  type Combatant,
  type AttackThreatState,
  type DamageBundle,
  type DamageComponent,
  type CoverAssessment,
  EffectReducer,
  effectsCatalog,
  hasEffectTrait,
  getEffectiveSneakAttackDice,
  resolveEquippedWeaponProfile
} from "@dnd-tactical/shared";

export interface AttackResult {
  hits: boolean;
  damage: number;
  damageBundle: DamageBundle;
  threatened?: boolean;
  attackBonusTotal?: number;
  targetArmorClass?: number;
  threatFrom?: number;
  multiplier?: number;
  weaponName?: string;
  attackParts: string[];
  acParts: string[];
  totalAttack: number;
  isNatural1: boolean;
  isNatural20: boolean;
  consumedAttackerAidId?: string;
  consumedTargetAidId?: string;
}

export interface AttackResolutionOptions {
  /** Fuente resuelta por el servidor. Nunca se construye desde flags mecánicos del payload cliente. */
  source?: ResolvedAttackSource;
  diceRoller?: (sides: number) => number;
  /** Sprint 035: banderas de contexto para Movilidad, derivadas autoritativamente por el servidor. */
  isOpportunityAttack?: boolean;
  isMovementProvoked?: boolean;
  /** Sprint 042: Cover ya resuelto por el caller vía getAttackContextModifiers(...).byAttackType[tipo].cover. */
  cover?: CoverAssessment;
}

export interface ResolvedAttackSource {
  name: string;
  attackType: "melee" | "ranged";
  targetAcType: "normal" | "touch";
  abilityForAttack: "strength" | "dexterity";
  maxRangeFeet: number;
  rangeIncrementFeet?: number;
  maxRangeIncrements?: number;
  criticalThreatFrom: number;
  criticalMultiplier: number;
  defaultDamage: number;
  damageDice?: string;
  damageModifier?: number;
}


export function resolveAttack(
  context: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  d20Roll: number,
  damageInput: number | null,
  _label: string,
  situationalAttackBonus = 0,
  options: AttackResolutionOptions = {}
): AttackResult {
  if (lifeStatus(attacker) === "dead" || lifeStatus(attacker) === "dying" || lifeStatus(attacker) === "stable") throw new Error(attacker.name + " no puede atacar en su estado actual.");
  if (lifeStatus(target) === "dead") throw new Error(target.name + " ya esta muerto.");
  const source = options.source ?? resolveWeaponAttackSource(attacker);
  const range = attackRangeFeet(context, attacker, target);
  validateAttackRange(attacker, target, range, source);
  const rangePenalty = calculateRangePenalty(source, range);
  
  const reducedTarget = EffectReducer.reduceEffectsForTarget({ effectInstances: context.effectInstances, targetId: target.id, catalog: effectsCatalog });
  const isHelpless = hasEffectTrait(reducedTarget, "HELPLESS");
  const helplessBonus = (isHelpless && source.attackType === "melee") ? 4 : 0;

  const attack = Rules.totalAttackBonus(context, attacker, { abilityForAttack: source.abilityForAttack, attackType: source.attackType });
  const aidAttackBonus = sumAidBonus(attacker.buffs, target.id, "attack");
  const attackTotal = attack.total + rangePenalty.penalty + situationalAttackBonus + aidAttackBonus + helplessBonus;
  
  const helplessLabel = helplessBonus ? "indefenso +4" : "";
  const attackParts = [...attack.parts, rangePenalty.label, aidAttackBonus ? "ayuda +" + aidAttackBonus : "", helplessLabel].filter(Boolean);
  
  const ac = Rules.totalArmorClass(context, target, {
    attackType: source.attackType,
    targetAcType: source.targetAcType,
    attackerId: attacker.id,
    cover: options.cover,
    isOpportunityAttack: options.isOpportunityAttack,
    isMovementProvoked: options.isMovementProvoked
  });
  const aidAcBonus = sumAidBonus(target.buffs, attacker.id, "ac");
  const targetArmorClass = ac.total + aidAcBonus;
  const acParts = [...ac.parts, aidAcBonus ? "ayuda +" + aidAcBonus : ""].filter(Boolean);
  const total = d20Roll + attackTotal;
  
  // Regla fundamental D&D 3.5: 1 natural siempre falla, 20 natural siempre impacta
  const isNatural1 = d20Roll === 1;
  const isNatural20 = d20Roll === 20;
  const hits = isNatural1 ? false : isNatural20 ? true : total >= targetArmorClass;
  const baseDamage = hits ? Math.max(1, damageInput ?? source.defaultDamage) : 0;
  const damageComponents: DamageComponent[] = hits ? [{
    sourceId: source.name,
    label: source.name,
    category: "base",
    amount: baseDamage,
    neverMultiply: false
  }] : [];
  const delivery = { attackType: source.attackType, distanceFeet: range, requiresAttackRoll: true, dealsDamage: true } as const;
  if (hits && canApplySneakAttack(context, attacker, target, delivery)) {
    const roller = options.diceRoller ?? ((sides: number) => Math.floor(Math.random() * sides) + 1);
    let precisionDamage = 0;
    const sneakAttackDice = getEffectiveSneakAttackDice(context, attacker);
    for (let die = 0; die < sneakAttackDice; die += 1) precisionDamage += roller(6);
    damageComponents.push({
      sourceId: "srd_sneak_attack",
      label: `Ataque furtivo +${sneakAttackDice}d6`,
      category: "precision",
      amount: precisionDamage,
      diceExpression: `${sneakAttackDice}d6`,
      neverMultiply: true
    });
  }
  const damageBundle = makeDamageBundle(damageComponents);
  const damage = damageBundle.total;

  const threatFrom = source.criticalThreatFrom;
  const multiplier = source.criticalMultiplier;
  const weaponName = source.name;
  
  const isThreat = hits
    && !target.ruleTraits.includes("IMMUNE_TO_CRITICAL_HITS")
    && isCriticalThreat(d20Roll, total, targetArmorClass, threatFrom);

  return {
    hits,
    damage,
    threatened: isThreat,
    damageBundle,
    attackBonusTotal: attackTotal,
    targetArmorClass,
    threatFrom,
    multiplier,
    weaponName,
    attackParts,
    acParts,
    totalAttack: total,
    isNatural1,
    isNatural20,
    consumedAttackerAidId: attacker.buffs.some((b) => b.aidChoice === "attack" && b.aidTargetId === target.id) ? target.id : undefined,
    consumedTargetAidId: target.buffs.some((b) => b.aidChoice === "ac" && b.aidTargetId === attacker.id) ? attacker.id : undefined
  };
}

export function resolveCriticalConfirmation(
  room: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>,
  attacker: Combatant,
  target: Combatant,
  threat: AttackThreatState,
  confirmD20Roll: number,
  criticalDamageInput: number | null
): { confirmed: boolean; damage: number; damageBundle: DamageBundle; totalConfirm: number; consumedAttackerAidId?: string; consumedTargetAidId?: string } {
  const confirmed = isCriticalConfirmed(confirmD20Roll, threat.attackBonusTotal, threat.targetArmorClass);
  const damageBundle = confirmed
    ? multiplyDamageBundle(threat.normalDamageBundle, threat.criticalMultiplier, criticalDamageInput)
    : makeDamageBundle(threat.normalDamageBundle.components);
  const finalDamage = damageBundle.total;
  const totalConfirm = confirmD20Roll + threat.attackBonusTotal;

  return {
    confirmed,
    damage: finalDamage,
    damageBundle,
    totalConfirm,
    consumedAttackerAidId: attacker.buffs.some((b) => b.aidChoice === "attack" && b.aidTargetId === target.id) ? target.id : undefined,
    consumedTargetAidId: target.buffs.some((b) => b.aidChoice === "ac" && b.aidTargetId === attacker.id) ? attacker.id : undefined
  };
}


export function attackRangeFeet(room: CombatRulesSnapshot<import("@dnd-tactical/shared").ProductionEffectId>, attacker: Combatant, target: Combatant): number {
  return distanceFeet(attacker.position, target.position, room.board.cellSizeFeet);
}

function validateAttackRange(attacker: Combatant, target: Combatant, rangeFeet: number, source: ResolvedAttackSource): void {
  const maxRange = source.maxRangeFeet;
  if (rangeFeet > maxRange) {
    throw new Error(target.name + " esta a " + rangeFeet + " ft, fuera del alcance de " + attacker.name + " (maximo " + maxRange + " ft).");
  }
}

function calculateRangePenalty(source: ResolvedAttackSource, rangeFeet: number): { penalty: number; label: string } {
  if (!source.rangeIncrementFeet) return { penalty: 0, label: "alcance +0" };
  const increment = Math.max(1, source.rangeIncrementFeet);
  const incrementNumber = Math.max(1, Math.ceil(rangeFeet / increment));
  const penalty = -2 * Math.max(0, incrementNumber - 1);
  return { penalty, label: "alcance " + penalty + " (incremento " + incrementNumber + " de " + (source.maxRangeIncrements ?? Math.ceil(source.maxRangeFeet / increment)) + ")" };
}

export function resolveWeaponAttackSource(attacker: Combatant, attackType?: "melee" | "ranged"): ResolvedAttackSource {
  const weapon = resolveEquippedWeaponProfile(attacker).profile;
  const ranged = attackType ? attackType === "ranged" : weapon.handedness === "ranged" || weapon.handedness === "thrown";
  return {
    name: weapon.name,
    attackType: ranged ? "ranged" : "melee",
    targetAcType: "normal",
    abilityForAttack: weapon.abilityForAttack,
    maxRangeFeet: ranged ? weapon.maxRangeFeet : weapon.meleeReachFeet,
    ...(ranged && weapon.rangeIncrementFeet ? { rangeIncrementFeet: weapon.rangeIncrementFeet } : {}),
    ...(ranged && weapon.maxRangeIncrements ? { maxRangeIncrements: weapon.maxRangeIncrements } : {}),
    criticalThreatFrom: weapon.criticalThreatFrom ?? 20,
    criticalMultiplier: weapon.criticalMultiplier ?? 2,
    defaultDamage: averageWeaponDamageForCombatant(attacker),
    damageDice: weapon.damageDice,
    damageModifier: weapon.abilityForDamage === "none"
      ? 0
      : Math.floor(getAbilityModifier(attacker.abilityScores[weapon.abilityForDamage]) * weapon.damageAbilityMultiplier)
  };
}

export function makeDamageBundle(components: readonly DamageComponent[]): DamageBundle {
  const copied = components.map((component) => ({ ...component }));
  return { components: copied, total: copied.reduce((sum, component) => sum + Math.max(0, component.amount), 0) };
}

export function multiplyDamageBundle(bundle: DamageBundle, multiplier: number, baseDamageInput: number | null = null): DamageBundle {
  let replacedBaseInput = false;
  return makeDamageBundle(bundle.components.map((component) => {
    if (component.neverMultiply) return { ...component };
    if (baseDamageInput !== null && !replacedBaseInput && component.category === "base") {
      replacedBaseInput = true;
      return { ...component, amount: Math.max(1, baseDamageInput), label: `${component.label} crítico` };
    }
    return { ...component, amount: component.amount * multiplier, label: `${component.label} ×${multiplier}` };
  }));
}

function sumAidBonus(buffs: Buff[], opponentId: string, choice: "attack" | "ac"): number {
  return buffs.reduce((sum, buff) => sum + (buff.aidChoice === choice && buff.aidTargetId === opponentId ? buff.aidBonus ?? 2 : 0), 0);
}

function consumeChosenAid(combatant: Combatant, opponentId: string, choice: "attack" | "ac"): void {
  combatant.buffs = combatant.buffs.filter((buff) => !(buff.aidChoice === choice && buff.aidTargetId === opponentId));
}

