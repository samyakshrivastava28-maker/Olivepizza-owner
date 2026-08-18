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

  content = content.replace(/from\s+['"]([^'"]+)['"]/g, "from '$1'");
  content = content.replace(/import\(\s*['"]([^'"]+)['"]\s*\)/g, "import('$1')");

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Cleaned quotes in: ${path.relative(srcDir, file)}`);
  }
});

console.log('Quotes cleanup complete!');
