/**
 * Script Breakdown Retry Bug Fix Test
 *
 * Tests the fix for the bug where retry logic returned undefined instead of sentence array
 *
 * Bug: When script breakdown exceeded sentence limit, retry succeeded but returned undefined
 * Fix: Changed from Claude API to OpenAI for retries (consistency) + added validation
 */

import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

// Mock script that historically triggered the retry bug
const longScript = `
Welcome to this comprehensive guide on mastering productivity in the digital age.
In today's fast-paced world, staying productive is more challenging than ever before.
Let me share with you the revolutionary techniques that have transformed countless lives.
First, we need to understand the psychology behind procrastination and why it happens.
Most people think procrastination is about laziness, but that's completely wrong.
Research shows that procrastination is actually an emotional regulation problem.
Your brain tries to protect you from uncomfortable feelings by avoiding tasks.
This is why willpower alone never works for beating procrastination long-term.
Instead, you need to rewire your brain's response to challenging tasks.
The first step is to break down large goals into tiny, manageable actions.
When a task feels overwhelming, your brain activates its threat response system.
But when you chunk it down, the task becomes less threatening and more approachable.
This simple technique can dramatically increase your completion rate overnight.
Next, let's talk about the power of environmental design for productivity.
Your physical space has an enormous impact on your ability to focus and perform.
Remove all distractions from your workspace and create dedicated zones for different activities.
The third secret is understanding your biological prime time for peak performance.
Everyone has specific hours when their brain operates at maximum capacity.
Track your energy levels throughout the day for one week to identify patterns.
Then schedule your most important work during these high-energy windows.
The fourth principle involves leveraging the compound effect of small daily habits.
Tiny improvements of just one percent daily lead to massive results over time.
Most people overestimate what they can do in a day and underestimate decades.
Focus on consistency rather than intensity for sustainable long-term success.
Finally, learn to say no to good opportunities so you can say yes to great ones.
Your time and attention are your most valuable and limited resources.
Protecting them fiercely is essential for achieving your biggest goals.
Start implementing these strategies today and watch your productivity skyrocket.
Remember, small changes consistently applied create extraordinary transformations over time.
`;

async function testScriptBreakdownRetry() {
  console.log('\n🧪 Testing Script Breakdown Retry Bug Fix\n');
  console.log('='.repeat(60));

  try {
    const aiService = new AIService();

    console.log('\n📝 Testing with long script (should trigger retry logic)...\n');

    const startTime = Date.now();
    const sentences = await aiService.breakdownScriptIntoSentences(longScript);
    const endTime = Date.now();

    console.log('\n✅ TEST RESULTS:');
    console.log('='.repeat(60));
    console.log(`⏱️  Execution time: ${endTime - startTime}ms`);
    console.log(`📊 Sentences returned: ${sentences ? sentences.length : 'undefined'}`);
    console.log(`✓  Is array: ${Array.isArray(sentences)}`);
    console.log(`✓  Contains strings: ${sentences && sentences.length > 0 ? typeof sentences[0] === 'string' : 'N/A'}`);
    console.log(`✓  Within limit (60): ${sentences && sentences.length <= 60}`);

    // Validation checks
    const tests = {
      'Result is defined': sentences !== undefined,
      'Result is array': Array.isArray(sentences),
      'Array is not empty': sentences && sentences.length > 0,
      'Contains strings': sentences && sentences.length > 0 && typeof sentences[0] === 'string',
      'Within max limit (60)': sentences && sentences.length <= 60,
      'All items are strings': sentences && sentences.every(s => typeof s === 'string'),
      'No empty strings': sentences && sentences.every(s => s.trim().length > 0)
    };

    console.log('\n🔍 VALIDATION CHECKS:');
    console.log('='.repeat(60));

    let passedTests = 0;
    let failedTests = 0;

    for (const [testName, result] of Object.entries(tests)) {
      const status = result ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${testName}`);
      if (result) passedTests++;
      else failedTests++;
    }

    console.log('\n📈 TEST SUMMARY:');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passedTests}/${Object.keys(tests).length}`);
    console.log(`❌ Failed: ${failedTests}/${Object.keys(tests).length}`);

    if (failedTests === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Bug fix verified successfully.\n');
      console.log('Sample sentences (first 3):');
      console.log('='.repeat(60));
      sentences.slice(0, 3).forEach((sentence, i) => {
        console.log(`${i + 1}. ${sentence}`);
      });
    } else {
      console.log('\n⚠️  SOME TESTS FAILED! Please investigate.\n');
    }

    return failedTests === 0;

  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:');
    console.error('='.repeat(60));
    console.error(error);
    return false;
  }
}

// Run test
testScriptBreakdownRetry()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal test error:', error);
    process.exit(1);
  });

export { testScriptBreakdownRetry };
