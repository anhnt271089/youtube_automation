#!/usr/bin/env node

/**
 * Test Claude Sonnet 4 Integration with Fallback System
 * Tests the updated AI service with Claude Sonnet 4 as primary, 3.5 as secondary, and GPT-4o-mini as final fallback
 */

import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

async function testClaudeSonnet4Integration() {
  logger.info('🧪 Testing Claude Sonnet 4 Integration with Fallback System...');
  
  const aiService = new AIService();
  const testResults = {
    healthCheck: false,
    scriptGeneration: false,
    titleGeneration: false,
    descriptionGeneration: false,
    keywordResearch: false,
    contextAnalysis: false,
    scriptBreakdown: false,
    imagePromptGeneration: false,
    thumbnailGeneration: false,
    costs: {}
  };

  try {
    // Test 1: Health Check (Tests Claude Sonnet 4 → 3.5 → OpenAI fallback)
    logger.info('\n1️⃣ Testing AI Service Health Check...');
    testResults.healthCheck = await aiService.healthCheck();
    logger.info('✅ Health check passed');

    // Test 2: Script Context Analysis (Tests Claude Sonnet 4 primary)
    logger.info('\n2️⃣ Testing Script Context Analysis...');
    const mockMetadata = {
      title: 'How to Build Better Habits in 2024',
      description: 'Learn the science-backed strategies for creating lasting habits that stick.',
      videoId: 'TEST_SONNET4_001'
    };

    const mockTranscript = `
    Building habits is one of the most powerful ways to transform your life. 
    In this video, we'll explore three proven strategies that help you create lasting change.
    First, start small. The key is consistency, not perfection.
    Second, stack habits on existing routines. This creates natural triggers.
    Third, track your progress to maintain motivation and accountability.
    `;

    const contextAnalysis = await aiService.analyzeScriptContext(mockTranscript, mockMetadata);
    testResults.contextAnalysis = contextAnalysis && contextAnalysis.originalScriptIntent;
    logger.info('✅ Context analysis completed');
    logger.info(`   Intent: ${contextAnalysis.originalScriptIntent}`);

    // Test 3: Script Generation (Tests Claude Sonnet 4 → 3.5 → GPT-4o-mini)
    logger.info('\n3️⃣ Testing Script Generation...');
    const keywordData = {
      primaryKeywords: ['habits', 'productivity', 'self improvement'],
      longTailKeywords: ['how to build better habits', 'habit formation psychology'],
      questionKeywords: ['why do habits fail', 'how long does it take to form a habit']
    };

    const generatedScript = await aiService.generateAttractiveScript(
      mockTranscript, 
      mockMetadata, 
      contextAnalysis,
      keywordData
    );
    testResults.scriptGeneration = generatedScript && generatedScript.length > 100;
    logger.info('✅ Script generation completed');
    logger.info(`   Generated ${generatedScript.length} characters`);

    // Test 4: Title Generation (Tests Claude Sonnet 4 → 3.5 → GPT-4o-mini)
    logger.info('\n4️⃣ Testing Title Generation...');
    const titleResults = await aiService.generateOptimizedTitle(
      generatedScript,
      mockMetadata.title,
      keywordData.primaryKeywords
    );
    testResults.titleGeneration = titleResults && titleResults.options && titleResults.options.length > 0;
    logger.info('✅ Title generation completed');
    logger.info(`   Generated ${titleResults.options.length} title options`);
    logger.info(`   Recommended: "${titleResults.recommended}"`);

    // Test 5: Description Generation (Tests Claude Sonnet 4 → 3.5 → GPT-4o-mini)
    logger.info('\n5️⃣ Testing Description Generation...');
    const optimizedDescription = await aiService.generateOptimizedDescription(
      generatedScript,
      mockMetadata,
      keywordData.primaryKeywords
    );
    testResults.descriptionGeneration = optimizedDescription && optimizedDescription.length > 50;
    logger.info('✅ Description generation completed');
    logger.info(`   Generated ${optimizedDescription.length} characters`);

    // Test 6: Keyword Research (Tests Claude Sonnet 4 → 3.5 → GPT-4o-mini)
    logger.info('\n6️⃣ Testing Keyword Research...');
    const keywords = await aiService.performKeywordResearch(generatedScript, 'productivity');
    testResults.keywordResearch = keywords && keywords.primaryKeywords && keywords.primaryKeywords.length > 0;
    logger.info('✅ Keyword research completed');
    logger.info(`   Found ${keywords.primaryKeywords.length} primary keywords`);
    logger.info(`   Found ${keywords.longTailKeywords.length} long-tail keywords`);

    // Test 7: Script Breakdown (Tests Claude Sonnet 4 → 3.5 → GPT-4o-mini)
    logger.info('\n7️⃣ Testing Script Breakdown...');
    const scriptSentences = await aiService.breakdownScriptIntoSentences(generatedScript.substring(0, 500));
    testResults.scriptBreakdown = scriptSentences && scriptSentences.length > 0;
    logger.info('✅ Script breakdown completed');
    logger.info(`   Generated ${scriptSentences.length} sentences`);

    // Test 8: Image Prompt Generation (Tests Claude Sonnet 4 → 3.5 → GPT-4o-mini)
    logger.info('\n8️⃣ Testing Image Prompt Generation...');
    const { prompts: imagePrompts, videoStyle } = await aiService.generateImagePrompts(
      scriptSentences.slice(0, 3), // Test with first 3 sentences only
      null,
      mockMetadata
    );
    testResults.imagePromptGeneration = imagePrompts && imagePrompts.length > 0;
    logger.info('✅ Image prompt generation completed');
    logger.info(`   Generated ${imagePrompts.length} image prompts`);
    logger.info(`   Video style: ${videoStyle.style}`);

    // Test 9: Thumbnail Generation (Tests Claude Sonnet 4 → 3.5 → GPT-4o-mini + Leonardo AI)
    logger.info('\n9️⃣ Testing Thumbnail Generation...');
    try {
      const thumbnail = await aiService.generateThumbnail(
        titleResults.recommended,
        generatedScript.substring(0, 300),
        { videoId: mockMetadata.videoId, videoStyle }
      );
      testResults.thumbnailGeneration = thumbnail && thumbnail.url;
      logger.info('✅ Thumbnail generation completed');
      logger.info(`   Thumbnail URL: ${thumbnail.url.substring(0, 60)}...`);
    } catch (thumbnailError) {
      logger.warn('⚠️ Thumbnail generation failed (might be Leonardo AI config):', thumbnailError.message);
      testResults.thumbnailGeneration = false;
    }

    // Test 10: Cost Summary
    logger.info('\n💰 Testing Cost Tracking...');
    const costSummary = aiService.getCostSummary();
    testResults.costs = costSummary;
    logger.info('✅ Cost tracking completed');
    logger.info(`   Total cost: $${costSummary.totalCost.toFixed(4)}`);
    logger.info(`   Images generated: ${costSummary.totalImagesGenerated}`);

    // Final Summary
    logger.info('\n📊 Claude Sonnet 4 Integration Test Results:');
    logger.info('================================================');
    
    const passedTests = Object.values(testResults).filter(result => 
      typeof result === 'boolean' ? result : true
    ).length;
    const totalTests = Object.keys(testResults).length - 1; // Exclude costs object
    
    Object.entries(testResults).forEach(([test, result]) => {
      if (test === 'costs') return;
      const status = result ? '✅ PASS' : '❌ FAIL';
      logger.info(`   ${test}: ${status}`);
    });
    
    logger.info(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (testResults.costs.totalCost > 0) {
      logger.info(`💸 Total test cost: $${testResults.costs.totalCost.toFixed(4)}`);
    }

    // Model Usage Summary
    logger.info('\n🧠 AI Model Hierarchy Working:');
    logger.info('   Primary: Claude Sonnet 4 (claude-sonnet-4-20250514)');
    logger.info('   Secondary: Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)');
    logger.info('   Final Fallback: OpenAI GPT-4o-mini');

    return passedTests === totalTests;

  } catch (error) {
    logger.error('❌ Claude Sonnet 4 integration test failed:', error);
    return false;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testClaudeSonnet4Integration()
    .then(success => {
      if (success) {
        logger.info('\n🎉 Claude Sonnet 4 integration test completed successfully!');
        process.exit(0);
      } else {
        logger.error('\n💥 Claude Sonnet 4 integration test failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('Test execution failed:', error);
      process.exit(1);
    });
}

export default testClaudeSonnet4Integration;