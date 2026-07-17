const fs = require('fs');
const path = require('path');

const COVERAGE_DIR = path.join(__dirname, '../.ai/coverage');

function calculateMarkdownChecklist(filename) {
  const filePath = path.join(COVERAGE_DIR, filename);
  if (!fs.existsSync(filePath)) return { percent: 0, total: 0, done: 0 };

  const content = fs.readFileSync(filePath, 'utf8');
  // Solo filas de tabla que empiezan con "| [x] |" o "| [ ] |" — ignora menciones en prosa.
  const matches = content.match(/^\| \[([ x])\] \|/gm) || [];

  const total = matches.length;
  const done = matches.filter(m => m.includes('[x]')).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return { percent, total, done };
}

function drawProgressBar(percent) {
  const totalBars = 10;
  const filledBars = Math.round((percent / 100) * totalBars);
  const emptyBars = totalBars - filledBars;
  return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

console.log('\n=== D&D 3.5 TACTICAL COMBAT ASSISTANT ===');
console.log('=== PHB V1.0 MASTER COVERAGE DASHBOARD ===\n');

// 1. Dotes
const feats = calculateMarkdownChecklist('FEATS_PHB_CHECKLIST.md');
console.log(`Feats            [${drawProgressBar(feats.percent)}] ${feats.percent}% (${feats.done}/${feats.total})`);

// 2. Spells
const spells = calculateMarkdownChecklist('SPELLS_PHB_CHECKLIST.md');
console.log(`Spells           [${drawProgressBar(spells.percent)}] ${spells.percent}% (${spells.done}/${spells.total})`);

// 3. Equipment
const equip = calculateMarkdownChecklist('EQUIPMENT_PHB_CHECKLIST.md');
console.log(`Equipment        [${drawProgressBar(equip.percent)}] ${equip.percent}% (${equip.done}/${equip.total})`);

// 4. Combat Rules
const rules = calculateMarkdownChecklist('RULES_PHB_CHECKLIST.md');
console.log(`Combat Rules     [${drawProgressBar(rules.percent)}] ${rules.percent}% (${rules.done}/${rules.total})`);

console.log('\n-----------------------------------------');
const overallPercent = Math.round((feats.percent + spells.percent + equip.percent + rules.percent) / 4);
console.log(`PHB OVERALL      [${drawProgressBar(overallPercent)}] ${overallPercent}%\n`);
