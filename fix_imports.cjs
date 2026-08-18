const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const srcDir = path.resolve(__dirname, 'frontend/src');
const allFiles = walk(srcDir);

allFiles.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  const relToSrc = path.relative(srcDir, file);
  const depth = relToSrc.split(path.sep).length - 1;

  if (depth === 1) {
    // 1 level: src/pages/File.tsx
    content = content.replace(/from\s+['"]\.\.\/\.\.\/plugins\//g, "from '../plugins/");
    content = content.replace(/import\(['"]\.\.\/\.\.\/plugins\//g, "import('../plugins/");
    content = content.replace(/from\s+['"]\.\.\/\.\.\/utils\//g, "from '../utils/");
    content = content.replace(/from\s+['"]\.\.\/\.\.\/hooks\//g, "from '../hooks/");
    content = content.replace(/from\s+['"]\.\.\/\.\.\/services\//g, "from '../services/");
    content = content.replace(/from\s+['"]\.\.\/\.\.\/lib\//g, "from '../lib/");
    content = content.replace(/from\s+['"]\.\.\/\.\.\/types\//g, "from '../types/");
    content = content.replace(/from\s+['"]\.\.\/\.\.\/components\//g, "from '../components/");
    content = content.replace(/import\(['"]\.\.\/\.\.\/components\//g, "import('../components/");
    content = content.replace(/import\(['"]\.\.\/\.\.\/lib\//g, "import('../lib/");
    content = content.replace(/import\(['"]\.\.\/\.\.\/utils\//g, "import('../utils/");
    content = content.replace(/import\(['"]\.\.\/\.\.\/pages\//g, "import('../pages/");
  }

  content = content.replace(/from\s+['"]([^'"]+)['"]/g, "from '$1'");
  content = content.replace(/import\(\s*['"]([^'"]+)['"]\s*\)/g, "import('$1')");

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed in: ${relToSrc}`);
  }
});

console.log('Done!');
