const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'tests');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mjs') && !f.includes('utils'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  let changed = false;
  
  const regex = /(const room = \{[\s\S]*?\n\s*)(\};)/g;
  content = content.replace(regex, (match, p1, p2) => {
    if (!p1.includes('effectInstances:')) {
      changed = true;
      return p1 + "effectInstances: [], eventSequence: 0,\n  " + p2;
    }
    return match;
  });

  const regex2 = /(let room = \{[\s\S]*?\n\s*)(\};)/g;
  content = content.replace(regex2, (match, p1, p2) => {
    if (!p1.includes('effectInstances:')) {
      changed = true;
      return p1 + "effectInstances: [], eventSequence: 0,\n  " + p2;
    }
    return match;
  });

  const regex3 = /(makeTestRoom\(\{[\s\S]*?\n\s*)(\}\))/g;
  content = content.replace(regex3, (match, p1, p2) => {
    if (!p1.includes('effectInstances:')) {
      changed = true;
      return p1 + "effectInstances: [], eventSequence: 0,\n  " + p2;
    }
    return match;
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
  }
}
