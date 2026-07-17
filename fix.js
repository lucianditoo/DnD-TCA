const fs = require('fs');
const file = 'packages/shared/src/rules.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const evalEnd = lines.findIndex(l => l.includes('export function getEffectiveAbilityModifier'));
if (evalEnd !== -1) {
    const block = [
        '        targetId: combatant.id,',
        '        catalog',
        '      });',
        '      return !hasEffectTrait(reduced, ' + String.fromCharCode(34) + 'CANNOT_MAKE_AOO' + String.fromCharCode(34) + ');',
        '    }',
        '  };',
        '}'
    ];
    lines.splice(evalEnd - 1, 0, ...block);
}

const floatingStart = lines.findIndex((l, i) => i > evalEnd && l.includes('targetId: combatant.id,'));
if (floatingStart !== -1) {
    lines.splice(floatingStart, 7);
}

fs.writeFileSync(file, lines.join('\n'));
console.log('Fixed');