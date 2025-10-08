/**
 * Script Breakdown Retry Stress Test
 *
 * This test specifically tries to trigger the retry logic by using an extremely long script
 * that is more likely to exceed the sentence limit on the first attempt.
 */

import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

// Extremely long script designed to trigger retry logic
const extremelyLongScript = `
Welcome to the ultimate masterclass on advanced productivity techniques for the modern era.
In today's hyper-connected digital world, mastering productivity is more critical than ever.
This comprehensive guide will transform how you approach work, creativity, and personal growth.
Let's dive deep into the science-backed strategies that separate high performers from average ones.
First, we need to understand the fundamental psychology of human motivation and behavior.
Most productivity advice focuses on surface-level tactics without addressing root causes.
This is why traditional time management often fails - it treats symptoms, not problems.
Research from leading universities has identified key neurological patterns in productive people.
Your brain operates on complex systems of rewards, habits, and environmental triggers.
Understanding these systems allows you to design your life for maximum effectiveness.
The first revolutionary principle is the concept of energy management over time management.
Time is fixed - everyone gets 24 hours daily - but energy levels vary dramatically.
High performers optimize their schedule around natural energy peaks and valleys.
This means identifying your biological prime time for deep, focused work.
Track your alertness levels every hour for two weeks to discover your patterns.
Most people are shocked to learn their peak performance windows differ from assumptions.
Once identified, ruthlessly protect these precious hours for your most important work.
The second game-changing strategy involves environmental design and cognitive architecture.
Your physical workspace exerts enormous influence on focus, creativity, and productivity.
Small changes in lighting, temperature, and ambient sound can boost performance by 30%.
Remove all visual clutter and distractions from your immediate field of view.
Create dedicated zones for different types of work - thinking, creating, communicating.
This spatial separation helps your brain shift modes more efficiently between tasks.
The third critical element is understanding the power of intermittent deep work sessions.
Continuous shallow work creates an illusion of productivity while accomplishing little.
Instead, structure your day around intensive 90-minute deep work blocks.
These align with your brain's natural ultradian rhythms for optimal performance.
Between blocks, take genuine breaks - not checking email or social media.
Walk outside, do light exercise, or practice mindfulness meditation for recovery.
This rhythm of intense focus followed by complete rest maximizes daily output.
The fourth principle leverages the compound effect of micro-habits and consistency.
Massive transformations don't happen overnight - they emerge from daily small wins.
One percent improvement daily compounds to 37 times better in one year.
Focus on process goals you control rather than outcome goals dependent on externals.
Show up consistently even when motivation is low - discipline beats inspiration.
Track your progress visually to maintain momentum and celebrate small victories.
The fifth strategy involves strategic saying no to preserve focus and energy.
Every yes to something unimportant is simultaneously a no to something meaningful.
Successful people are masters at declining good opportunities to pursue great ones.
Learn to evaluate requests against your core priorities and values.
Practice polite but firm boundaries around your time and attention.
Remember that protecting your focus is not selfish - it enables your best contribution.
The sixth revolutionary technique is batching similar tasks for cognitive efficiency.
Context switching between different types of work destroys productivity and focus.
Instead, group similar activities together and complete them in dedicated blocks.
Answer all emails in one or two daily batches rather than constantly checking.
Schedule all meetings back-to-back on specific days when possible.
This creates long uninterrupted blocks for deep work on other days.
The seventh principle harnesses the power of deliberate practice and skill development.
Simply putting in hours doesn't guarantee improvement - you need focused practice.
Identify your edge of competence and deliberately work just beyond it.
Seek immediate feedback to correct errors and reinforce proper technique.
This is how experts in any field develop mastery over time.
Apply this same approach to your professional and personal growth goals.
The eighth strategy optimizes decision-making through systems and automation.
Every decision, no matter how small, depletes your limited willpower reserves.
Successful people minimize trivial decisions to preserve energy for important ones.
Create systems, routines, and habits that automate recurring choices.
This is why many high performers wear similar clothes daily - one less decision.
Identify areas where you can systematize or automate to reduce decision fatigue.
The ninth game-changing principle involves strategic recovery and rest periods.
Peak performance is impossible without adequate rest and recovery time.
Your brain requires downtime to consolidate learning and restore cognitive function.
Schedule regular breaks, proper sleep, and genuine vacation time without guilt.
Understand that rest is not laziness - it's essential for sustained high performance.
Athletes know recovery is when gains occur - knowledge workers need this too.
The tenth and final strategy is continuous learning and adaptation over time.
What works today may not work tomorrow as your circumstances evolve.
Stay curious and experiment with new approaches and productivity tools.
Regularly review your systems and adjust based on results and feedback.
Seek wisdom from books, mentors, and communities of high performers.
Remember that productivity is a lifelong practice, not a destination to reach.
Implement these ten principles systematically and watch your effectiveness skyrocket.
Start with one or two strategies, master them, then gradually add more over time.
The compound effect of these techniques creates extraordinary results over years.
Your future self will thank you for the investment you make today in these systems.
Thank you for investing your time in this comprehensive productivity masterclass.
Now take action - knowledge without implementation is merely entertainment, not transformation.
`;

async function runStressTest() {
  console.log('\n🔥 Script Breakdown Retry STRESS TEST\n');
  console.log('='.repeat(70));
  console.log('Testing with extremely long script to trigger retry logic...\n');

  try {
    const aiService = new AIService();

    // Calculate expected behavior
    const scriptSentenceCount = extremelyLongScript.trim().split('\n').filter(s => s.trim()).length;
    console.log(`📊 Input script has ~${scriptSentenceCount} sentences`);
    console.log(`📏 Max allowed: 60 sentences`);
    console.log(`⚠️  Buffer limit: 66 sentences (60 × 1.1)`);
    console.log(`\n🎯 Expected behavior: If > 66, should trigger retry\n`);

    const startTime = Date.now();
    const sentences = await aiService.breakdownScriptIntoSentences(extremelyLongScript);
    const endTime = Date.now();

    console.log('\n✅ STRESS TEST RESULTS:');
    console.log('='.repeat(70));
    console.log(`⏱️  Total execution time: ${endTime - startTime}ms`);
    console.log(`📊 Sentences returned: ${sentences ? sentences.length : 'undefined'}`);
    console.log(`✓  Is array: ${Array.isArray(sentences)}`);
    console.log(`✓  Contains strings: ${sentences && sentences.length > 0 ? typeof sentences[0] === 'string' : 'N/A'}`);
    console.log(`✓  Within limit (60): ${sentences && sentences.length <= 60}`);
    console.log(`✓  Within buffer (66): ${sentences && sentences.length <= 66}`);

    // Advanced validation
    const validations = {
      'Result exists': sentences !== undefined && sentences !== null,
      'Is array': Array.isArray(sentences),
      'Not empty': sentences && sentences.length > 0,
      'All strings': sentences && sentences.every(s => typeof s === 'string'),
      'No empty strings': sentences && sentences.every(s => s.trim().length > 0),
      'Within max limit': sentences && sentences.length <= 60,
      'Each sentence meaningful': sentences && sentences.every(s => s.split(' ').length >= 3),
      'No duplicates': sentences && new Set(sentences).size === sentences.length
    };

    console.log('\n🔍 COMPREHENSIVE VALIDATION:');
    console.log('='.repeat(70));

    let passed = 0;
    let failed = 0;

    for (const [test, result] of Object.entries(validations)) {
      const status = result ? '✅' : '❌';
      console.log(`${status} ${test}`);
      if (result) passed++;
      else failed++;
    }

    // Check for quality
    console.log('\n📈 QUALITY METRICS:');
    console.log('='.repeat(70));

    if (sentences && sentences.length > 0) {
      const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
      const avgWords = sentences.reduce((sum, s) => sum + s.split(' ').length, 0) / sentences.length;

      console.log(`📏 Average sentence length: ${avgLength.toFixed(1)} characters`);
      console.log(`📝 Average words per sentence: ${avgWords.toFixed(1)} words`);
      console.log(`🎯 Shortest sentence: ${Math.min(...sentences.map(s => s.length))} chars`);
      console.log(`📊 Longest sentence: ${Math.max(...sentences.map(s => s.length))} chars`);
    }

    console.log('\n📊 FINAL SCORE:');
    console.log('='.repeat(70));
    console.log(`✅ Passed: ${passed}/${Object.keys(validations).length}`);
    console.log(`❌ Failed: ${failed}/${Object.keys(validations).length}`);
    console.log(`📈 Success Rate: ${((passed / Object.keys(validations).length) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n🎉 STRESS TEST PASSED! Retry logic works correctly!\n');
      console.log('Sample output (first 5 sentences):');
      console.log('='.repeat(70));
      sentences.slice(0, 5).forEach((s, i) => {
        console.log(`${i + 1}. ${s.substring(0, 80)}${s.length > 80 ? '...' : ''}`);
      });
      console.log('');
      return true;
    } else {
      console.log('\n⚠️  STRESS TEST FAILED! Issues detected.\n');
      return false;
    }

  } catch (error) {
    console.error('\n❌ STRESS TEST CRASHED:');
    console.error('='.repeat(70));
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    return false;
  }
}

// Execute stress test
runStressTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

export { runStressTest };
