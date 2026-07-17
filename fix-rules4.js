const fs = require('fs');
const file = 'packages/shared/src/rules.ts';
let code = fs.readFileSync(file, 'utf8');

// The file is corrupted. Let's find the start of getEffectiveAbilityModifier which should be OUTSIDE the createRuleEvaluator.
// But first, let's just restore createRuleEvaluator properly and remove duplicates.
const startCreateRuleEvaluator = code.indexOf('export function createRuleEvaluator<TCatalog extends Record<string, EffectDefinition>>(catalog: TCatalog) {');
const endRules = code.indexOf('/**\r\n * Instancia productiva del evaluador de reglas.');
if (startCreateRuleEvaluator !== -1 && endRules !== -1) {
  const newCode = export function createRuleEvaluator<TCatalog extends Record<string, EffectDefinition>>(catalog: TCatalog) {
  type TEffectId = keyof TCatalog & string;

  return {
    totalAttackBonus(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant,
      attackContext?: Pick<AttackContext, "abilityForAttack" | "attackType">
    ): { total: number; parts: string[] } {
      const applicable = context.effectInstances.filter(
        (inst) => inst.targets !== undefined && inst.targets.includes(combatant.id)
      );
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });
      const deltaAttack = reduced.numericModifiers["ATTACK"]?.total ?? 0;
      const legacyBuffBonus = combatant.buffs.reduce((sum, buff) => sum + (buff.attackBonus ?? 0), 0);
      const attackAbility = attackContext?.abilityForAttack ?? combatant.weapon?.abilityForAttack ?? "strength";
      const effectiveAbilityScore = _getEffectiveAbilityScoreFromReduced(combatant, attackAbility, reduced);
      const selectedModifier = getAbilityModifier(effectiveAbilityScore) + combatant.armorClassBreakdown.size;
      
      let conditionalDelta = 0;
      if (attackContext && attackContext.attackType) {
        // cast to full AttackContext, we only need attackType for "attack_type" condition
        const fullContext = attackContext as AttackContext;
        conditionalDelta = evaluateConditionalModifiers(applicable, catalog, fullContext, false, "ATTACK");
      }

      const total = combatant.baseAttackBonus + selectedModifier + legacyBuffBonus + deltaAttack + conditionalDelta;
      const parts: string[] = [
        "BAB +" + combatant.baseAttackBonus,
        "mod " + (selectedModifier >= 0 ? "+" : "") + selectedModifier,
        legacyBuffBonus ? "buffs +" + legacyBuffBonus : "buffs +0"
      ];
      if (deltaAttack !== 0) parts.push("efectos " + (deltaAttack >= 0 ? "+" : "") + deltaAttack);
      if (conditionalDelta !== 0) parts.push("condicional " + (conditionalDelta >= 0 ? "+" : "") + conditionalDelta);
      return { total, parts };
    },

    totalArmorClass(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant,
      attackContext?: AttackContext
    ): { total: number; parts: string[] } {
      const applicable = context.effectInstances.filter(
        (inst) => inst.targets !== undefined && inst.targets.includes(combatant.id)
      );
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });
      const suppressDexAndDodge = attackContext?.isFlatFootedOverride === true || hasEffectTrait(reduced, "NO_DEX_TO_AC");
      if (!combatant.armorClassBreakdown) {
        throw new Error(\Invariante de CA violada: \ no posee armorClassBreakdown estructurado.\);
      }
      for (const [component, value] of Object.entries(combatant.armorClassBreakdown)) {
        if (!Number.isFinite(value)) throw new Error(\Invariante de CA violada: \ posee \ no finito.\);
      }
      const projected = projectStructuredArmorClass(combatant.armorClassBreakdown, attackContext, suppressDexAndDodge);
      const baseAC = projected.total;
      const parts = projected.parts;

      const legacyBuffBonus = combatant.buffs.reduce((sum, buff) => {
        const value = buff.acBonus ?? 0;
        return sum + (shouldApplyAcModifier(value, buff.acBonusType, attackContext, suppressDexAndDodge) ? value : 0);
      }, 0);

      const coverBonus = attackContext?.hasObstacleInterception ? 4 : 0;

      const acModifier = reduced.numericModifiers["AC"];
      let deltaAC = [...(acModifier?.bonuses ?? []), ...(acModifier?.penalties ?? [])]
        .filter((trace) => trace.status === "applied")
        .reduce((sum, trace) => sum + (shouldApplyAcModifier(trace.value, trace.stackingGroup, attackContext, suppressDexAndDodge) ? trace.value : 0), 0);

      // Calculo del diferencial de destreza si fue alterada
      const effectiveDexScore = _getEffectiveAbilityScoreFromReduced(combatant, "dexterity", reduced);
      if (effectiveDexScore !== combatant.abilityScores.dexterity) {
        const effectiveDexMod = getAbilityModifier(effectiveDexScore);
        const originalDexMod = combatant.armorClassBreakdown.dexterity;
        const dexDifferential = effectiveDexMod - originalDexMod;
        
        // Si la Destreza base ya fue suprimida (porque era positiva y está Flat-Footed o NO_DEX_TO_AC),
        // no restamos el originalDexMod ya que projectStructuredArmorClass no lo sumó.
        // Pero si el effectiveDexMod es negativo, las reglas dicen que Flat-Footed NO previene penalizadores.
        // Así que debemos asegurarnos de que la CA final aplique el penalizador correcto.
        if (suppressDexAndDodge && originalDexMod > 0) {
           // originalDexMod fue ignorado en baseAC.
           // Si el nuevo modificador es negativo (ej. Paralizado, -5), SÍ debe aplicar.
           // Si el nuevo es positivo, sigue suprimido.
           if (effectiveDexMod < 0) {
             deltaAC += effectiveDexMod; // aplicamos el penalizador puro
           }
        } else {
           deltaAC += dexDifferential; // Diferencial normal
        }
      }

      // Modificadores condicionales: solo cuando se provee contexto táctico de ataque
      let conditionalDelta = 0;
      if (attackContext) {
        conditionalDelta = evaluateConditionalModifiers(applicable, catalog, attackContext, suppressDexAndDodge, "AC");
        if (conditionalDelta !== 0) {
          parts.push("condicional " + (conditionalDelta >= 0 ? "+" : "") + conditionalDelta);
        }
      }
      
      if (coverBonus > 0) {
        parts.push("cobertura +" + coverBonus);
      }

      const total = baseAC + legacyBuffBonus + deltaAC + conditionalDelta + coverBonus;
      parts.push(legacyBuffBonus ? "buffs " + (legacyBuffBonus >= 0 ? "+" : "") + legacyBuffBonus : "buffs +0");
      if (deltaAC !== 0) parts.push("efectos " + (deltaAC >= 0 ? "+" : "") + deltaAC);
      return { total, parts };
    },

    totalSpeedFeet(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant
    ): number {
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });
      if (hasEffectTrait(reduced, "CANNOT_MOVE")) return 0;
      
      const deltaSpeed = reduced.numericModifiers["SPEED"]?.total ?? 0;
      const legacyBuffBonus = combatant.buffs.reduce((sum, buff) => sum + (buff.speedBonusFeet ?? 0), 0);
      const armor = EquipmentCatalog.getArmor(combatant.equipment.armor);
      const armorAdjustedSpeed = armor
        ? combatant.baseSpeedFeet === 20 ? armor.speed20Ft : armor.speed30Ft
        : combatant.baseSpeedFeet;
      return armorAdjustedSpeed + legacyBuffBonus + deltaSpeed;
    },

    evaluateActionAvailability(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant
    ): RuleResult<true> {
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });
      if (hasEffectTrait(reduced, "CANNOT_ACT")) {
        return { ok: false, error: combatant.name + " esta incapacitado y no puede realizar acciones." };
      }
      return { ok: true, value: true };
    },

    canMakeOpportunityAttack(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant
    ): boolean {
      if (combatant.buffs.some((buff) => buff.preventsOpportunityAttacks)) return false;
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });
      return !hasEffectTrait(reduced, "CANNOT_MAKE_AOO");
    }
  };
}

export function getEffectiveAbilityModifier(
  context: CombatRulesSnapshot<ProductionEffectId>,
  combatant: Combatant,
  ability: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
): number {
  const reduced = EffectReducer.reduceEffectsForTarget({
    effectInstances: context.effectInstances,
    targetId: combatant.id,
    catalog: effectsCatalog
  });
  return getAbilityModifier(_getEffectiveAbilityScoreFromReduced(combatant, ability, reduced));
}

export function getSpecialManeuverSizeModifier(sizeCategory: SizeCategory): number {
  return getSizeRule(sizeCategory).grappleModifier;
}

;

  const finalCode = code.substring(0, startCreateRuleEvaluator) + newCode + code.substring(endRules);
  fs.writeFileSync(file, finalCode);
  console.log("Rewrite successful.");
} else {
  console.log("Could not find delimiters.");
}