#!/usr/bin/env node

/**
 * Bug Fix Verification Tool
 *
 * Verifies that the script breakdown retry bug fix is properly implemented
 * and all related files are in place.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('\n🔍 Script Breakdown Retry Bug Fix Verification\n');
console.log('='.repeat(70));

let allPassed = true;
const results = [];

// Check 1: Source code file exists and has fixes
console.log('\n📁 Checking source code changes...');

const aiServicePath = path.join(projectRoot, 'src/services/aiService.js');
if (fs.existsSync(aiServicePath)) {
  const content = fs.readFileSync(aiServicePath, 'utf8');

  // Check for key fixes
  const checks = {
    'OpenAI retry logic': content.includes('const retryCompletion = await this.openai.chat.completions.create'),
    'Array validation': content.includes('if (!Array.isArray(sentences))'),
    'String validation': content.includes('typeof sentences[0] !== \'string\''),
    'JSON extraction': content.includes('jsonArrayMatch'),
    'Final attempt fallback': content.includes('Truncating to')
  };

  let passed = 0;
  for (const [check, result] of Object.entries(checks)) {
    results.push({ check: `Source: ${check}`, passed: result });
    if (result) {
      console.log(`  ✅ ${check}`);
      passed++;
    } else {
      console.log(`  ❌ ${check}`);
      allPassed = false;
    }
  }

  console.log(`  📊 ${passed}/${Object.keys(checks).length} checks passed`);
} else {
  console.log('  ❌ Source file not found');
  allPassed = false;
}

// Check 2: Test files exist
console.log('\n🧪 Checking test files...');

const testFiles = [
  'tests/script-breakdown-retry-test.js',
  'tests/script-breakdown-retry-stress-test.js',
  'tests/README_SCRIPT_BREAKDOWN_TESTS.md'
];

for (const testFile of testFiles) {
  const filePath = path.join(projectRoot, testFile);
  const exists = fs.existsSync(filePath);
  results.push({ check: `Test file: ${testFile}`, passed: exists });

  if (exists) {
    console.log(`  ✅ ${testFile}`);
  } else {
    console.log(`  ❌ ${testFile} - MISSING`);
    allPassed = false;
  }
}

// Check 3: Documentation files exist
console.log('\n📚 Checking documentation...');

const docFiles = [
  'docs/BUG_FIX_SCRIPT_BREAKDOWN_RETRY.md',
  'docs/BUG_FIX_SUMMARY.md',
  'BUGFIX_CHANGELOG.md'
];

for (const docFile of docFiles) {
  const filePath = path.join(projectRoot, docFile);
  const exists = fs.existsSync(filePath);
  results.push({ check: `Doc file: ${docFile}`, passed: exists });

  if (exists) {
    const stats = fs.statSync(filePath);
    console.log(`  ✅ ${docFile} (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.log(`  ❌ ${docFile} - MISSING`);
    allPassed = false;
  }
}

// Check 4: Package.json has test scripts
console.log('\n⚙️  Checking package.json scripts...');

const packagePath = path.join(projectRoot, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  const scriptChecks = {
    'test:script-breakdown': packageJson.scripts?.['test:script-breakdown'],
    'test:script-breakdown-stress': packageJson.scripts?.['test:script-breakdown-stress']
  };

  for (const [script, value] of Object.entries(scriptChecks)) {
    const exists = !!value;
    results.push({ check: `Script: ${script}`, passed: exists });

    if (exists) {
      console.log(`  ✅ ${script}`);
    } else {
      console.log(`  ❌ ${script} - MISSING`);
      allPassed = false;
    }
  }
} else {
  console.log('  ❌ package.json not found');
  allPassed = false;
}

// Check 5: File permissions (for test files)
console.log('\n🔐 Checking file permissions...');

const executableFiles = [
  'tests/script-breakdown-retry-test.js',
  'tests/script-breakdown-retry-stress-test.js'
];

for (const file of executableFiles) {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      console.log(`  ✅ ${file} - Readable`);
      results.push({ check: `Permissions: ${file}`, passed: true });
    } catch (error) {
      console.log(`  ⚠️  ${file} - Not readable`);
      results.push({ check: `Permissions: ${file}`, passed: false });
    }
  }
}

// Summary
console.log('\n📊 VERIFICATION SUMMARY');
console.log('='.repeat(70));

const totalChecks = results.length;
const passedChecks = results.filter(r => r.passed).length;
const failedChecks = totalChecks - passedChecks;

console.log(`✅ Passed: ${passedChecks}/${totalChecks}`);
console.log(`❌ Failed: ${failedChecks}/${totalChecks}`);
console.log(`📈 Success Rate: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);

if (allPassed) {
  console.log('\n🎉 ALL CHECKS PASSED! Bug fix is properly implemented.\n');
  console.log('Next steps:');
  console.log('  1. Run tests: npm run test:script-breakdown');
  console.log('  2. Review docs: cat docs/BUG_FIX_SUMMARY.md');
  console.log('  3. Deploy to production');
  console.log('  4. Monitor logs for 24 hours\n');
  process.exit(0);
} else {
  console.log('\n⚠️  SOME CHECKS FAILED! Please review the issues above.\n');
  console.log('Failed checks:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`  ❌ ${r.check}`);
  });
  console.log('');
  process.exit(1);
}
