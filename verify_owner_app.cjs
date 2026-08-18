const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🍕 OLIVE PIZZA OWNER — FULL ARCHITECTURE VERIFICATION');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
  }
}

const ROOT = path.resolve(__dirname);

// 1. Workspace Root Files
const rootConfigs = [
  'package.json',
  'README.md',
  '.env',
  'OWNER_FEATURE_PARITY.md',
  'OWNER_API_CONTRACT.md',
];
rootConfigs.forEach((file) => {
  assert(fs.existsSync(path.join(ROOT, file)), `Workspace root file: ${file}`);
});

// 2. Brand Assets & Public Files in frontend/public/
const publicAssets = [
  'frontend/public/favicon.ico',
  'frontend/public/favicon.png',
  'frontend/public/logo-transparent.png',
  'frontend/public/pizza-loader.gif',
  'frontend/public/firebase-messaging-sw.js',
  'frontend/public/icons',
];
publicAssets.forEach((asset) => {
  assert(fs.existsSync(path.join(ROOT, asset)), `Brand asset exists: ${asset}`);
});

// 3. Frontend & Backend Configs
const subProjectConfigs = [
  'frontend/package.json',
  'frontend/tsconfig.json',
  'frontend/vite.config.ts',
  'frontend/capacitor.config.ts',
  'frontend/index.html',
  'frontend/.env',
  'backend/package.json',
  'backend/tsconfig.json',
  'backend/src/server.ts',
];
subProjectConfigs.forEach((file) => {
  assert(fs.existsSync(path.join(ROOT, file)), `Sub-project config: ${file}`);
});

// 4. Rich Owner Components in frontend/src/components/owner/
const ownerComponents = [
  'frontend/src/components/owner/AIImageGeneratorModal.tsx',
  'frontend/src/components/owner/InlineAIImageGenerator.tsx',
  'frontend/src/components/owner/UnifiedImageSelectorHub.tsx',
  'frontend/src/components/owner/ComboBuilder.tsx',
  'frontend/src/components/owner/LiveOrdersTable.tsx',
  'frontend/src/components/owner/NewOrderEmergencyOverlay.tsx',
  'frontend/src/components/owner/OwnerLiveMap.tsx',
  'frontend/src/components/owner/OwnerLiveMapModal.tsx',
  'frontend/src/components/owner/DashboardCharts.tsx',
  'frontend/src/components/owner/BusinessIntelligence.tsx',
];
ownerComponents.forEach((c) => {
  assert(fs.existsSync(path.join(ROOT, c)), `Rich component exists: ${c}`);
});

// 5. DataManager Sub-Module
const dataManagerFiles = [
  'frontend/src/pages/DataManager/DataManagerHub.tsx',
  'frontend/src/pages/DataManager/Overview.tsx',
  'frontend/src/pages/DataManager/ProviderDetail.tsx',
  'frontend/src/pages/DataManager/ProviderRequirementsWizard.tsx',
];
dataManagerFiles.forEach((f) => {
  assert(fs.existsSync(path.join(ROOT, f)), `DataManager module file: ${f}`);
});

// 6. Security and RBAC Whitelist Check
const storeContent = fs.readFileSync(path.join(ROOT, 'frontend/src/lib/store.ts'), 'utf8');
assert(
  storeContent.includes('olivepizzarjn@gmail.com') && storeContent.includes('webhub2811@gmail.com'),
  'Security model preserves authorized accounts (olivepizzarjn@gmail.com & webhub2811@gmail.com)'
);

// 7. Favicon Link in index.html Check
const indexHtml = fs.readFileSync(path.join(ROOT, 'frontend/index.html'), 'utf8');
assert(
  indexHtml.includes('href="/favicon.png"') && indexHtml.includes('Olive Pizza — Owner Portal'),
  'HTML head links favicon.png and brand title'
);

console.log('\n====================================================');
console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  console.log('🎉 ALL ARCHITECTURE, ASSET & FEATURE PARITY CHECKS PASSED!');
  process.exit(0);
} else {
  console.error('❌ Verification failures detected.');
  process.exit(1);
}
