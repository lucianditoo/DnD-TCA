const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/shared/src/rules.ts');
let content = fs.readFileSync(filePath, 'utf8');

// I will just read the original file that I botched and fix it up with regex or exact matching.
// Since it's a huge mess, it's safer to just recreate the `createRuleEvaluator` function entirely from scratch, as I know what it should contain.

const newEvaluator = `
export function createRuleEvaluator<TCatalog extends Record<string, EffectDefinition>>(catalog: TCatalog) {
  type TEffectId = keyof TCatalog & string;

  return {
    totalAttackBonus(
      context: CombatRulesSnapshot<TEffectId>,
      combatant: Combatant,
      attackContext?: Pick<AttackContext, "abilityForAttack">
    ): { total: number; parts: string[] } {
      const reduced = EffectReducer.reduceEffectsForTarget({
        effectInstances: context.effectInstances,
        targetId: combatant.id,
        catalog
      });
      const deltaAttack = reduced.numericModifiers["ATTACK"]?.total ?? 0;
      const legacyBuffBonus = combatant.buffs.reduce((sum, buff) => sum + (buff.attackBonus ?? 0), 0);
      const attackAbility = attackContext?.abilityForAttack ?? combatant.weapon?.abilityForAttack ?? "strength";
      const selectedModifier = getAbilityModifier(combatant.abilityScores[attackAbility]) + combatant.armorClassBreakdown.size;
      const total = combatant.baseAttackBonus + selectedModifier + legacyBuffBonus + deltaAttack;
      const parts: string[] = [
        "BAB +" + combatant.baseAttackBonus,
        "mod " + (selectedModifier >= 0 ? "+" : "") + selectedModifier,
        legacyBuffBonus ? "buffs +" + legacyBuffBonus : "buffs +0"
      ];
      if (deltaAttack !== 0) parts.push("efectos " + (deltaAttack >= 0 ? "+" : "") + deltaAttack);
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
        throw new Error(\`Invariante de CA violada: \${combatant.name} no posee armorClassBreakdown estructurado.\`);
      }
      for (const [component, value] of Object.entries(combatant.armorClassBreakdown)) {
        if (!Number.isFinite(value)) throw new Error(\`Invariante de CA violada: \${combatant.name} posee \${component} no finito.\`);
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
      const deltaAC = [...(acModifier?.bonuses ?? []), ...(acModifier?.penalties ?? [])]
        .filter((trace) => trace.status === "applied")
        .reduce((sum, trace) => sum + (shouldApplyAcModifier(trace.value, trace.stackingGroup, attackContext, suppressDexAndDodge) ? trace.value : 0), 0);

      // Modificadores condicionales: solo cuando se provee contexto táctico de ataque
      let conditionalDelta = 0;
      if (attackContext) {
        conditionalDelta = evaluateConditionalModifiers(applicable, catalog, attackContext, suppressDexAndDodge);
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
`;

// Now find the start and end of createRuleEvaluator in the actual file and replace it.
const startRegex = /export function createRuleEvaluator<TCatalog extends Record<string, EffectDefinition>>\(catalog: TCatalog\) \{/g;
let match = startRegex.exec(content);
if (match) {
    const startIndex = match.index;
    const endRegex = /\/\*\*\r?\n \* Instancia productiva del evaluador de reglas\./;
    const endMatch = endRegex.exec(content);
    if (endMatch) {
        const endIndex = endMatch.index;
        content = content.substring(0, startIndex) + newEvaluator + "\n" + content.substring(endIndex);
        fs.writeFileSync(filePath, content);
        console.log("Successfully replaced createRuleEvaluator block.");
    } else {
        console.log("Could not find endString.");
    }
} else {
    console.log("Could not find createRuleEvaluator start.");
}
