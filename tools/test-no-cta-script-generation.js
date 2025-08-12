#!/usr/bin/env node

/**
 * Test script to verify that script generation follows NO EXTERNAL CTA policy
 * and generates pure educational content without any external calls-to-action
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add the project root to the module path
const projectRoot = path.resolve(__dirname, '..');

import AIService from '../src/services/aiService.js';

// Create an instance of the AI service
const aiService = new AIService();
import logger from '../src/utils/logger.js';

// Test data - sample video metadata and transcript
const testVideoMetadata = {
  title: "How to Build Discipline and Stop Procrastinating",
  description: "Learn the science-backed methods to build unbreakable discipline and eliminate procrastination forever. This comprehensive guide covers proven strategies..."
};

const testTranscript = `
Welcome to today's video about building discipline. Procrastination is something we all struggle with, but there are proven methods to overcome it.

The first thing you need to understand is that discipline isn't about willpower. It's about creating systems and habits that work automatically.

Research shows that the most successful people don't rely on motivation - they rely on consistent daily practices that compound over time.

Let me share the three core principles that will transform your approach to discipline...

Principle 1: Start incredibly small. Instead of trying to meditate for an hour, start with just 2 minutes. Instead of reading for an hour, start with just one page.

Principle 2: Stack your habits. Attach new behaviors to existing ones you already do automatically, like brushing your teeth or having your morning coffee.

Principle 3: Focus on identity, not outcomes. Instead of saying "I want to lose weight," say "I am a person who exercises daily." This shifts your mindset from doing to being.

These principles work because they align with how your brain actually operates. Your brain is designed to conserve energy and stick to familiar patterns.

When you implement these three principles together, you create a powerful system that builds momentum naturally. You'll find yourself becoming more disciplined without forcing it.

The key is consistency over intensity. Small actions done repeatedly will always beat large actions done sporadically.

Remember, building discipline is a skill like any other - it improves with practice and the right approach.
`;

const testContextAnalysis = {
  originalScriptIntent: "Educational content about building discipline and overcoming procrastination",
  targetAudience: "People struggling with procrastination and wanting to build better habits",
  contentVibe: "Educational, motivational, evidence-based",
  coreMessage: "Discipline is about systems and habits, not willpower",
  hookStyle: "Problem-solution with scientific backing",
  callToActionApproach: "Value-focused education",
  contentPillars: ["Self-improvement", "Psychology", "Habit formation", "Productivity"],
  audienceSpecificLanguage: "Motivational but practical, science-backed advice",
  videoFormat: "Educational tutorial"
};

// Forbidden phrases that should NOT appear in generated scripts
const forbiddenPhrases = [
  "click the link below",
  "click the link in the description",
  "download our guide",
  "get our free resource",
  "visit our website",
  "navigate to our website",
  "check the description for links",
  "links below",
  "subscribe and hit the bell",
  "subscribe for more",
  "follow us on social media",
  "join our community",
  "sign up for our newsletter",
  "join our email list",
  "check out our",
  "visit us at",
  "go to our website",
  "click here",
  "link in bio",
  "download now",
  "get instant access",
  "join now",
  "sign up now"
];

// First-person phrases that should NOT appear in faceless content
const firstPersonPhrases = [
  " i ",
  " me ",
  " my ",
  " i've ",
  " i have ",
  " i discovered ",
  " i found ",
  " i tested ",
  " i analyzed ",
  " i learned ",
  " i believe ",
  " i think ",
  " my experience ",
  " my journey ",
  " my story ",
  " my method ",
  " my secret "
];

async function testScriptGeneration() {
  try {
    logger.info('🧪 Testing NO EXTERNAL CTA script generation...');
    
    // Generate script using the updated service
    const generatedScript = await aiService.generateVoiceScript(
      testTranscript,
      testVideoMetadata,
      testContextAnalysis,
      null, // keywordData
      'TEST-001'
    );

    logger.info('📝 Generated script length:', generatedScript.length);
    logger.info('📄 Generated script preview (first 200 chars):', generatedScript.substring(0, 200) + '...');

    // Test 1: Check for forbidden external CTAs
    logger.info('\n🔍 TEST 1: Checking for forbidden external CTAs...');
    let ctagFound = false;
    const foundCTAs = [];

    for (const phrase of forbiddenPhrases) {
      if (generatedScript.toLowerCase().includes(phrase.toLowerCase())) {
        ctagFound = true;
        foundCTAs.push(phrase);
      }
    }

    if (ctagFound) {
      logger.error('❌ FAILED: Found forbidden external CTAs:', foundCTAs);
    } else {
      logger.info('✅ PASSED: No forbidden external CTAs found');
    }

    // Test 2: Check for first-person language
    logger.info('\n🔍 TEST 2: Checking for first-person language...');
    let firstPersonFound = false;
    const foundFirstPerson = [];

    for (const phrase of firstPersonPhrases) {
      if (generatedScript.toLowerCase().includes(phrase.toLowerCase())) {
        firstPersonFound = true;
        foundFirstPerson.push(phrase.trim());
      }
    }

    if (firstPersonFound) {
      logger.error('❌ FAILED: Found first-person language:', foundFirstPerson);
    } else {
      logger.info('✅ PASSED: No first-person language found');
    }

    // Test 3: Check for educational value and self-contained content
    logger.info('\n🔍 TEST 3: Checking for educational value...');
    
    const educationalIndicators = [
      'research shows',
      'studies indicate',
      'proven method',
      'evidence shows',
      'data reveals',
      'science shows',
      'experts',
      'study found',
      'research reveals'
    ];

    let educationalValue = false;
    const foundEducational = [];

    for (const indicator of educationalIndicators) {
      if (generatedScript.toLowerCase().includes(indicator.toLowerCase())) {
        educationalValue = true;
        foundEducational.push(indicator);
      }
    }

    if (educationalValue) {
      logger.info('✅ PASSED: Educational language found:', foundEducational);
    } else {
      logger.warn('⚠️  WARNING: Limited educational language detected');
    }

    // Test 4: Check script structure
    logger.info('\n🔍 TEST 4: Checking script structure...');
    
    const scriptLines = generatedScript.split('\n').filter(line => line.trim().length > 0);
    const scriptWords = generatedScript.split(' ').length;
    
    logger.info(`📊 Script statistics:
    - Lines: ${scriptLines.length}
    - Words: ${scriptWords}
    - Characters: ${generatedScript.length}`);

    if (scriptWords >= 100 && scriptWords <= 600) {
      logger.info('✅ PASSED: Script length is appropriate for short-form content');
    } else {
      logger.warn(`⚠️  WARNING: Script length may not be optimal (${scriptWords} words)`);
    }

    // Test 5: Save generated script for manual review
    logger.info('\n💾 Saving generated script for manual review...');
    
    const outputPath = path.join(__dirname, '../archive/test-script-no-cta.txt');
    fs.writeFileSync(outputPath, `
GENERATED SCRIPT (NO EXTERNAL CTA TEST)
Generated at: ${new Date().toISOString()}

TEST RESULTS:
- External CTAs Found: ${ctagFound ? 'FAILED' : 'PASSED'}
- First-Person Language: ${firstPersonFound ? 'FAILED' : 'PASSED'}
- Educational Value: ${educationalValue ? 'PASSED' : 'WARNING'}

SCRIPT CONTENT:
${generatedScript}

ANALYSIS:
- Total words: ${scriptWords}
- Total characters: ${generatedScript.length}
- Lines: ${scriptLines.length}

FORBIDDEN CTAs CHECKED:
${forbiddenPhrases.join(', ')}

FIRST-PERSON PHRASES CHECKED:
${firstPersonPhrases.join(', ')}
    `);

    logger.info(`✅ Script saved to: ${outputPath}`);

    // Final result
    logger.info('\n🎯 FINAL TEST RESULTS:');
    const allPassed = !ctagFound && !firstPersonFound && educationalValue;
    
    if (allPassed) {
      logger.info('🎉 ALL TESTS PASSED! Script generation successfully follows NO EXTERNAL CTA policy');
    } else {
      logger.error('❌ SOME TESTS FAILED! Review the generated script and update prompts if necessary');
    }

    return {
      success: allPassed,
      results: {
        noCTAs: !ctagFound,
        noFirstPerson: !firstPersonFound,
        hasEducationalValue: educationalValue,
        wordCount: scriptWords,
        generatedScript
      }
    };

  } catch (error) {
    logger.error('💥 Test failed with error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
if (require.main === module) {
  testScriptGeneration().then(results => {
    logger.info('\n📋 Test completed:', results.success ? 'SUCCESS' : 'FAILED');
    process.exit(results.success ? 0 : 1);
  }).catch(error => {
    logger.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

export { testScriptGeneration };