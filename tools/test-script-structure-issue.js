#!/usr/bin/env node

/**
 * Quick test to identify the exact structure mismatch in VID-0002 AI script generation
 */

import MetadataService from '../src/services/metadataService.js';
import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

async function testScriptStructure() {
  logger.info('🔍 Testing script structure for VID-0002...');

  try {
    const metadataService = new MetadataService();
    const aiService = new AIService();
    
    // Get VID-0002 metadata
    const videoMetadata = await metadataService.getReliableVideoMetadata('VID-0002');
    
    // Prepare minimal test data
    const testVideoData = {
      videoId: 'VID-0002',
      title: videoMetadata.title,
      transcriptText: videoMetadata.transcriptText || 'Test transcript',
      duration: videoMetadata.duration
    };

    logger.info('Calling AI service with minimal data...');
    
    // Mock a simple version to test structure
    const result = await aiService.enhanceContentWithAI(testVideoData, metadataService);
    
    // Check exactly what status monitor looks for
    logger.info('\n📊 STRUCTURE ANALYSIS:');
    logger.info('✅ enhanceContentWithAI returned:', Object.keys(result));
    logger.info('❌ Status monitor expects: enhancedContent.script');
    logger.info('📋 Actual structure check:');
    logger.info('  - result.script exists:', !!result.script);
    logger.info('  - result.attractiveScript exists:', !!result.attractiveScript);
    logger.info('  - result.attractiveScript type:', typeof result.attractiveScript);
    
    if (!result.script && result.attractiveScript) {
      logger.error('\n🚨 IDENTIFIED THE EXACT ISSUE:');
      logger.error('Status monitor expects: enhancedContent.script');
      logger.error('AI service returns: enhancedContent.attractiveScript');
      logger.error('\nThis is a STRUCTURAL MISMATCH that needs to be fixed in the code.');
      
      // Show the exact fix needed
      logger.info('\n🔧 REQUIRED FIX:');
      logger.info('In statusMonitorService.js line 744, change:');
      logger.info('  FROM: if (!enhancedContent || !enhancedContent.script)');
      logger.info('  TO:   if (!enhancedContent || !enhancedContent.attractiveScript)');
      logger.info('\nAnd update lines 749-751 to use attractiveScript instead of script properties');
      
      return false;
    }
    
    logger.info('✅ Structure looks correct');
    return true;
    
  } catch (error) {
    logger.error('❌ Test failed:', error.message);
    return false;
  }
}

testScriptStructure()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Test crashed:', error);
    process.exit(1);
  });