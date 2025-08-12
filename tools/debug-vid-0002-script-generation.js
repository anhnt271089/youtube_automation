#!/usr/bin/env node

/**
 * Debug VID-0002 AI Script Generation Failure
 * This tool investigates the specific error: "AI failed to generate new script content"
 */

import { fileURLToPath } from 'url';
import path from 'path';
import MetadataService from '../src/services/metadataService.js';
import AIService from '../src/services/aiService.js';
import YouTubeService from '../src/services/youtubeService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugVID0002ScriptGeneration() {
  logger.info('🔍 Starting VID-0002 Script Generation Debug Session');

  try {
    // Step 1: Check if VID-0002 metadata exists and is valid
    logger.info('\n📋 Step 1: Checking VID-0002 metadata availability...');
    const metadataService = new MetadataService();
    const videoId = 'VID-0002';
    
    let videoMetadata;
    try {
      videoMetadata = await metadataService.getReliableVideoMetadata(videoId);
      logger.info('✅ VID-0002 metadata found:', {
        title: videoMetadata.title,
        duration: videoMetadata.duration,
        hasTranscript: !!videoMetadata.transcriptText,
        transcriptLength: videoMetadata.transcriptText?.length || 0
      });
    } catch (metadataError) {
      logger.error('❌ Failed to get VID-0002 metadata:', metadataError.message);
      return false;
    }

    // Step 2: Test YouTube service connectivity
    logger.info('\n🔗 Step 2: Testing YouTube service connectivity...');
    const youtubeService = new YouTubeService();
    const youtubeUrl = videoMetadata.youtubeUrl || videoMetadata.originalUrl;
    
    if (!youtubeUrl) {
      logger.error('❌ No YouTube URL found in metadata');
      return false;
    }

    try {
      const youtubeData = await youtubeService.getCompleteVideoData(youtubeUrl);
      logger.info('✅ YouTube service working:', {
        title: youtubeData.title,
        duration: youtubeData.duration,
        hasTranscript: !!youtubeData.transcriptText
      });
    } catch (youtubeError) {
      logger.error('❌ YouTube service failed:', youtubeError.message);
      return false;
    }

    // Step 3: Test AI service initialization
    logger.info('\n🤖 Step 3: Testing AI service initialization...');
    const aiService = new AIService();
    
    // Check API keys
    const apiKeyChecks = {
      claude: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      leonardo: !!process.env.LEONARDO_API_KEY
    };
    
    logger.info('API Key availability:', apiKeyChecks);
    
    if (!apiKeyChecks.claude && !apiKeyChecks.openai) {
      logger.error('❌ No AI service API keys available (need either Claude or OpenAI)');
      return false;
    }

    // Step 4: Test the exact workflow that's failing
    logger.info('\n🧪 Step 4: Testing enhanceContentWithAI method...');
    
    // Prepare the exact data structure as used by status monitor
    const testVideoData = {
      videoId: videoId,
      title: videoMetadata.title,
      description: videoMetadata.description,
      transcriptText: videoMetadata.transcriptText,
      duration: videoMetadata.duration,
      youtubeUrl: youtubeUrl
    };

    logger.info('Calling enhanceContentWithAI with data:', {
      videoId: testVideoData.videoId,
      title: testVideoData.title,
      hasTranscript: !!testVideoData.transcriptText,
      transcriptLength: testVideoData.transcriptText?.length || 0
    });

    let enhancedContent;
    try {
      enhancedContent = await aiService.enhanceContentWithAI(testVideoData, metadataService);
      logger.info('✅ enhanceContentWithAI completed successfully');
      
      // Step 5: Check the exact structure that status monitor expects
      logger.info('\n📊 Step 5: Analyzing returned structure...');
      logger.info('Enhanced content structure:', {
        hasAttractiveScript: !!enhancedContent.attractiveScript,
        hasOptimizedDescription: !!enhancedContent.optimizedDescription,
        hasOptimizedTitles: !!enhancedContent.optimizedTitles,
        hasKeywords: !!enhancedContent.keywords,
        hasScriptSentences: !!enhancedContent.scriptSentences,
        scriptSentencesCount: enhancedContent.scriptSentences?.length || 0,
        // Check what status monitor looks for
        hasScriptProperty: !!enhancedContent.script, // THIS IS THE KEY CHECK
        enhancedContentKeys: Object.keys(enhancedContent)
      });

      // Step 6: Identify the exact mismatch
      logger.info('\n🔍 Step 6: Identifying the problem...');
      
      if (!enhancedContent.script) {
        logger.error('❌ FOUND THE ISSUE: enhanceContentWithAI returns "attractiveScript" but status monitor expects "script"');
        logger.error('Status monitor checks: enhancedContent.script (undefined)');
        logger.error('AI service returns: enhancedContent.attractiveScript (exists)');
        
        logger.info('\n🔧 SOLUTION NEEDED:');
        logger.info('1. Either modify statusMonitorService.js to check enhancedContent.attractiveScript');
        logger.info('2. Or modify aiService.js to return { script: attractiveScript } instead of { attractiveScript }');
        
        return false;
      } else {
        logger.info('✅ Script structure looks correct');
        return true;
      }

    } catch (aiError) {
      logger.error('❌ enhanceContentWithAI failed:', aiError.message);
      logger.error('Full error:', aiError);
      return false;
    }

  } catch (error) {
    logger.error('❌ Debug session failed:', error);
    return false;
  }
}

// Run debug if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugVID0002ScriptGeneration()
    .then(success => {
      if (success) {
        logger.info('\n✅ Debug completed successfully - no issues found');
        process.exit(0);
      } else {
        logger.error('\n❌ Debug identified issues that need fixing');
        process.exit(1);
      }
    })
    .catch(error => {
      logger.error('Debug session crashed:', error);
      process.exit(1);
    });
}

export { debugVID0002ScriptGeneration };