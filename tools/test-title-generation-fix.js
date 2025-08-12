#!/usr/bin/env node

/**
 * Test Title Generation Fix
 * 
 * This script tests the fixed title generation to ensure:
 * 1. Exactly 5 clean titles are generated
 * 2. No psychological trigger descriptions are mixed in
 * 3. All titles are complete and usable
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

async function testTitleGeneration() {
  try {
    console.log('🧪 Testing Title Generation Fix...\n');
    
    const aiService = new AIService();
    
    // Test data - simulating a typical script and metadata
    const testScript = `
    Have you ever wondered why some people seem to have endless energy while others struggle to get through the day? 
    The answer isn't what you might think. It's not about sleeping more, drinking more coffee, or taking energy supplements. 
    The real culprit behind your energy drain might be something called "brain burnout" - a condition that affects millions of people but is rarely talked about.
    
    In this video, we'll explore the hidden signs of brain burnout, why it happens, and most importantly, how you can fix it naturally. 
    By the end of this video, you'll have a clear understanding of what's been draining your energy and practical steps you can take to feel energized again.
    
    Let's start by understanding what brain burnout really is...
    `;
    
    const originalTitle = "Why You're Always Tired - The Real Reason";
    const keywords = ['tired', 'energy', 'exhausted', 'fatigue', 'brain burnout', 'sleep'];
    
    console.log('📊 Test Input:');
    console.log(`Script Length: ${testScript.length} characters`);
    console.log(`Original Title: ${originalTitle}`);
    console.log(`Keywords: ${keywords.join(', ')}`);
    console.log('─'.repeat(60));
    
    // Generate titles
    const result = await aiService.generateOptimizedTitle(testScript, originalTitle, keywords);
    
    console.log('📝 Generated Title Results:');
    console.log(`Total Titles Generated: ${result.options.length}`);
    console.log(`Recommended Title: ${result.recommended}`);
    console.log('─'.repeat(60));
    
    // Validate results
    console.log('🔍 Validation Results:');
    
    // Test 1: Check if we have exactly 5 titles
    const hasExactly5Titles = result.options.length === 5;
    console.log(`✅ Has exactly 5 titles: ${hasExactly5Titles ? 'PASS' : 'FAIL'} (${result.options.length} titles)`);
    
    // Test 2: Check if all titles are complete and usable
    let allTitlesValid = true;
    let titleIssues = [];
    
    result.options.forEach((title, index) => {
      if (!title || title.length < 10) {
        allTitlesValid = false;
        titleIssues.push(`Title ${index + 1}: Too short (${title ? title.length : 0} chars)`);
      }
      if (title && title.length > 200) {
        allTitlesValid = false;
        titleIssues.push(`Title ${index + 1}: Too long (${title.length} chars)`);
      }
      if (title && (title.includes('Trigger:') || title.includes('(Psychological') || title.includes('- (') || title.includes('Curiosity Gap'))) {
        allTitlesValid = false;
        titleIssues.push(`Title ${index + 1}: Contains trigger description`);
      }
    });
    
    console.log(`✅ All titles are valid: ${allTitlesValid ? 'PASS' : 'FAIL'}`);
    if (titleIssues.length > 0) {
      titleIssues.forEach(issue => console.log(`   ❌ ${issue}`));
    }
    
    // Test 3: Check if titles are unique
    const uniqueTitles = new Set(result.options);
    const allTitlesUnique = uniqueTitles.size === result.options.length;
    console.log(`✅ All titles are unique: ${allTitlesUnique ? 'PASS' : 'FAIL'} (${uniqueTitles.size} unique out of ${result.options.length})`);
    
    console.log('─'.repeat(60));
    console.log('📋 Generated Titles:');
    result.options.forEach((title, index) => {
      console.log(`${index + 1}. ${title}`);
    });
    
    // Overall result
    const allTestsPassed = hasExactly5Titles && allTitlesValid && allTitlesUnique;
    console.log('─'.repeat(60));
    console.log(`🎯 Overall Result: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allTestsPassed) {
      console.log('\n🎉 Title generation fix is working correctly!');
      console.log('✅ The system now generates exactly 5 clean, usable titles');
      console.log('✅ No psychological trigger descriptions are mixed in');
      console.log('✅ All titles are properly formatted and unique');
    } else {
      console.log('\n⚠️ Title generation still has issues that need to be addressed.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testTitleGeneration()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });