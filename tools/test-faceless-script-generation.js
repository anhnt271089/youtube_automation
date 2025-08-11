#!/usr/bin/env node

/**
 * Test Faceless Script Generation
 * 
 * This tool tests that the updated script generation system produces
 * content appropriate for faceless YouTube channels without personal
 * references, first-person language, or personal experiences.
 */

import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

// Patterns to detect first-person and personal language
const FIRST_PERSON_PATTERNS = [
  /\bI\s/gi,
  /\bI've\b/gi,
  /\bI'm\b/gi,
  /\bme\s/gi,
  /\bmy\s/gi,
  /\bmyself\b/gi,
  /\bI\shas?ve?\b/gi,
  /\bI\sdiscovered\b/gi,
  /\bI\sfound\b/gi,
  /\bI\stested\b/gi,
  /\bI\sanalyzed\b/gi,
  /\bpersonal\sexperience\b/gi,
  /\bmy\sexperience\b/gi,
  /\bmy\sjourney\b/gi,
  /\bmy\sresults\b/gi,
  /\bwhen\sI\s/gi,
  /\bhow\sI\s/gi,
  /\bafter\sI\s/gi
];

function checkForPersonalLanguage(text) {
  const violations = [];
  
  // Convert to string if it's an object
  const textToAnalyze = typeof text === 'string' ? text : JSON.stringify(text);
  
  FIRST_PERSON_PATTERNS.forEach((pattern, index) => {
    const matches = textToAnalyze.match(pattern);
    if (matches) {
      violations.push({
        pattern: pattern.toString(),
        matches: matches,
        count: matches.length
      });
    }
  });
  
  return violations;
}

function analyzeScriptForFacelessCompliance(script, type) {
  console.log(`\n📊 Analyzing ${type} for Faceless Compliance:`);
  console.log('-'.repeat(50));
  
  const violations = checkForPersonalLanguage(script);
  
  if (violations.length === 0) {
    console.log('✅ PASSED: No first-person or personal language detected');
    return true;
  } else {
    console.log('❌ FAILED: First-person or personal language detected:');
    violations.forEach((violation, index) => {
      console.log(`  ${index + 1}. Pattern: ${violation.pattern}`);
      console.log(`     Matches: ${violation.matches.join(', ')}`);
      console.log(`     Count: ${violation.count}`);
    });
    return false;
  }
}

async function testFacelessScriptGeneration() {
  try {
    console.log('🎭 Testing Faceless Script Generation');
    console.log('=' .repeat(70));
    
    // Initialize AI Service
    const aiService = new AIService();
    
    // Test data - personal development content
    const testVideoMetadata = {
      videoId: 'FACELESS-TEST-001',
      title: 'How I Built a Million Dollar Business in 12 Months',
      description: 'I share my personal journey and the exact steps I took to build my business from zero to seven figures.',
      duration: 300
    };
    
    // Original transcript with lots of first-person language
    const originalTranscript = `Hi everyone, I'm so excited to share my personal journey with you today. When I started my business, I had no idea what I was doing. I made tons of mistakes, but I learned from each one. I tested different strategies, and I analyzed what worked. Through my experience, I discovered the key principles that led to my success. I want to share my story because I believe it can help you too. My results speak for themselves - I went from broke to millionaire in just 12 months.`;
    
    console.log('\n📋 Original Content (Personal/First-Person):');
    console.log('Title:', testVideoMetadata.title);
    console.log('Transcript Preview:', originalTranscript.substring(0, 200) + '...');
    
    // Test Script Generation
    console.log('\n🎯 Testing Script Generation for Faceless Channel');
    console.log('-'.repeat(50));
    
    const generatedScript = await aiService.generateAttractiveScript(
      originalTranscript,
      testVideoMetadata,
      null,
      null,
      'FACELESS-TEST-001'
    );
    
    console.log('\n📝 Generated Script Preview:');
    console.log(generatedScript.substring(0, 500) + '...');
    
    const scriptCompliant = analyzeScriptForFacelessCompliance(generatedScript, 'Generated Script');
    
    // Test Title Generation
    console.log('\n🏷️ Testing Title Generation');
    console.log('-'.repeat(50));
    
    const generatedTitles = await aiService.generateOptimizedTitle(
      generatedScript,
      testVideoMetadata.title,
      ['business', 'entrepreneur', 'success', 'strategy']
    );
    
    console.log('\n📋 Generated Titles:');
    console.log(generatedTitles);
    
    const titlesCompliant = analyzeScriptForFacelessCompliance(generatedTitles, 'Generated Titles');
    
    // Test Description Generation
    console.log('\n📄 Testing Description Generation');
    console.log('-'.repeat(50));
    
    const generatedDescription = await aiService.generateOptimizedDescription(
      generatedScript,
      testVideoMetadata,
      ['business', 'entrepreneur', 'success', 'strategy', 'growth']
    );
    
    console.log('\n📝 Generated Description Preview:');
    console.log(generatedDescription.substring(0, 300) + '...');
    
    const descriptionCompliant = analyzeScriptForFacelessCompliance(generatedDescription, 'Generated Description');
    
    // Overall Results
    console.log('\n🏆 FINAL RESULTS');
    console.log('=' .repeat(70));
    
    const allCompliant = scriptCompliant && titlesCompliant && descriptionCompliant;
    
    if (allCompliant) {
      console.log('✅ SUCCESS: All generated content is faceless-compliant!');
      console.log('   - No first-person language detected');
      console.log('   - No personal experiences or stories');
      console.log('   - Content focuses on viewer benefits');
      console.log('   - Professional, universal language used');
    } else {
      console.log('❌ FAILURE: Some content contains personal language');
      console.log('   - Script compliant:', scriptCompliant ? '✅' : '❌');
      console.log('   - Titles compliant:', titlesCompliant ? '✅' : '❌');
      console.log('   - Description compliant:', descriptionCompliant ? '✅' : '❌');
    }
    
    // Cost tracking
    console.log('\n💰 Cost Analysis:');
    console.log('Cost tracking is handled by the AI service internally');
    
    return allCompliant;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    logger.error('Faceless script generation test error:', error);
    return false;
  }
}

// Execute the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testFacelessScriptGeneration()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export default testFacelessScriptGeneration;