const fs = require('fs');
const file = 'packages/shared/src/rules.ts';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const newLines = [];
let i = 0;
while (i < lines.length) {
    if (lines[i].includes('canMakeOpportunityAttack(') && !lines[i].includes('export')) {
        let blockText = lines.slice(i, i + 13).join('\n');
        if (blockText.includes('hasEffectTrait(reduced, "CANNOT_MAKE_AOO")')) {
            // Check if it's the floating block at the end (has no closing brace for the parent object before it, or is after getSpecialManeuverSizeModifier)
            if (i > 370) {
                // it's the floating one, delete it
                i += 11; // skip 11 lines
                continue;
            } else {
               // wait it's the one I just deleted, so it's not here
            }
        }
    }
    newLines.push(lines[i]);
    i++;
}

// But I need to put the deleted block back into createRuleEvaluator.
const restoredBlock = \    canMakeOpportunityAttack(
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
}\;

const evalEnd = newLines.findIndex(l => l.includes('export function getEffectiveAbilityModifier'));
if (evalEnd !== -1) {
    newLines.splice(evalEnd, 0, restoredBlock);
}

// And delete the floating block at the end that looks like     ): boolean {
// Actually just search for it:
const floatingStart = newLines.findIndex(l => l.startsWith('    ): boolean {') && newLines[newLines.indexOf(l)+1].includes('if (combatant.buffs.some('));
if (floatingStart !== -1) {
    newLines.splice(floatingStart, 11);
}

fs.writeFileSync(file, newLines.join('\n'));
console.log('Fixed');
