#!/usr/bin/env node

/**
 * Test Content-Aware Thumbnail Generation
 * 
 * This tool tests the fixed thumbnail generation system to ensure it creates
 * content-relevant thumbnails instead of generic portraits.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../src/utils/logger.js';
import { config } from '../config/config.js';
import AIService from '../src/services/aiService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import ThumbnailService from '../src/services/thumbnailService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ThumbnailTester {
  constructor() {
    this.aiService = new AIService();
    this.googleDriveService = new GoogleDriveService();
    this.thumbnailService = new ThumbnailService(this.aiService, this.googleDriveService);
  }

  /**
   * Test content type analysis
   */
  async testContentAnalysis() {
    logger.info('🧪 Testing Content Type Analysis');
    
    const testCases = [
      {
        title: 'The Art Of Making A Plan ( That Actually Works )',
        content: 'Learn how to create effective planning systems that help you achieve your goals',
        expected: { contentType: 'planning', humanFacesAppropriate: false }
      },
      {
        title: 'How I Made $10K in 30 Days',
        content: 'My personal journey to financial success and the business strategies that worked',
        expected: { contentType: 'business', humanFacesAppropriate: true }
      },
      {
        title: 'Python Tutorial: Learn Programming in 1 Hour',
        content: 'Complete beginner guide to Python programming with examples and exercises',
        expected: { contentType: 'educational', humanFacesAppropriate: false }
      },
      {
        title: 'Transform Your Life: Mindset Secrets',
        content: 'Personal development strategies for building confidence and changing your mindset',
        expected: { contentType: 'personal', humanFacesAppropriate: true }
      }
    ];

    for (const testCase of testCases) {
      const analysis = this.thumbnailService.analyzeContentType(testCase.title, testCase.content);
      
      logger.info(`📝 Title: "${testCase.title}"`);
      logger.info(`🔍 Detected: ${analysis.contentType} (human faces: ${analysis.humanFacesAppropriate})`);
      logger.info(`🎯 Expected: ${testCase.expected.contentType} (human faces: ${testCase.expected.humanFacesAppropriate})`);
      logger.info(`✅ Match: ${analysis.contentType === testCase.expected.contentType && analysis.humanFacesAppropriate === testCase.expected.humanFacesAppropriate}`);
      logger.info(`📊 Visual Elements: ${analysis.visualElements.join(', ')}`);
      logger.info('---');
    }
  }

  /**
   * Test thumbnail context generation
   */
  async testThumbnailContext() {
    logger.info('🎨 Testing Thumbnail Context Generation');
    
    const testVideo = {
      title: 'The Art Of Making A Plan ( That Actually Works )',
      content: `Learn the systematic approach to planning that actually gets results. We'll cover:
      - Setting realistic goals
      - Creating actionable timelines  
      - Tracking progress effectively
      - Adjusting plans when needed
      - Tools and systems for organization`
    };

    try {
      const context = await this.thumbnailService.generateThumbnailContext(
        testVideo.title, 
        testVideo.content
      );

      logger.info('📋 Generated Context:');
      logger.info(`  Main Theme: ${context.mainTheme}`);
      logger.info(`  Content Type: ${context.contentType || 'not detected'}`);
      logger.info(`  Emotional Hook: ${context.emotionalHook}`);
      logger.info(`  Human Elements: [${context.humanElements?.join(', ') || 'none'}]`);
      logger.info(`  Primary Visual: ${context.visualElements?.primary || 'not specified'}`);
      logger.info(`  Secondary Visual: ${context.visualElements?.secondary || 'not specified'}`);
      logger.info(`  Content-Specific: [${context.contentSpecific?.join(', ') || 'not specified'}]`);
      logger.info(`  Colors: ${context.colorPsychology?.primary || 'not specified'} / ${context.colorPsychology?.accent || 'not specified'}`);

      // Verify it's content-aware
      const isContentAware = (
        context.humanElements.length === 0 && // Planning content shouldn't have faces
        (context.contentSpecific?.some(el => el.includes('plan') || el.includes('calendar') || el.includes('checklist')) ||
         context.visualElements?.primary?.includes('plan') ||
         context.visualElements?.primary?.includes('organization'))
      );

      logger.info(`🎯 Content-Aware: ${isContentAware ? '✅ YES' : '❌ NO'}`);
      
      if (!isContentAware) {
        logger.warn('⚠️ Context still appears to be generic rather than content-specific');
      }

      return context;

    } catch (error) {
      logger.error('❌ Context generation failed:', error);
      return null;
    }
  }

  /**
   * Test enhanced prompt generation
   */
  async testEnhancedPrompt() {
    logger.info('📝 Testing Enhanced Prompt Generation');
    
    const testVideo = {
      title: 'The Art Of Making A Plan ( That Actually Works )',
      videoId: 'TEST-001'
    };

    // First get context
    const context = await this.thumbnailService.generateThumbnailContext(
      testVideo.title, 
      'Learn systematic planning approaches for better goal achievement'
    );

    if (!context) {
      logger.error('❌ Cannot test prompt without context');
      return;
    }

    try {
      const enhancedPrompt = await this.thumbnailService.getEnhancedBasePrompt(
        context, 
        testVideo.title, 
        testVideo.videoId
      );

      logger.info('📝 Enhanced Prompt Generated:');
      logger.info(`   Length: ${enhancedPrompt.length} characters`);
      
      // Check if prompt is content-aware (not forcing faces)
      const forcesHumanFace = enhancedPrompt.includes('HUMAN FACE: Close-up') || 
                              enhancedPrompt.includes('EYE CONTACT: Direct viewer');
      const isContentSpecific = enhancedPrompt.includes('planning') || 
                                enhancedPrompt.includes('calendar') || 
                                enhancedPrompt.includes('organization') ||
                                enhancedPrompt.includes('checklist');

      logger.info(`🚫 Forces Human Face: ${forcesHumanFace ? '❌ YES (BAD)' : '✅ NO (GOOD)'}`);
      logger.info(`🎯 Content-Specific: ${isContentSpecific ? '✅ YES (GOOD)' : '❌ NO (BAD)'}`);

      // Show a preview of the prompt
      const preview = enhancedPrompt.substring(0, 300) + '...';
      logger.info(`📄 Preview:\n${preview}`);

      return enhancedPrompt;

    } catch (error) {
      logger.error('❌ Enhanced prompt generation failed:', error);
      return null;
    }
  }

  /**
   * Run complete test suite
   */
  async runTests() {
    try {
      logger.info('🧪 Starting Content-Aware Thumbnail Tests\n');
      
      // Test 1: Content Analysis
      await this.testContentAnalysis();
      console.log('\n');

      // Test 2: Context Generation  
      const context = await this.testThumbnailContext();
      console.log('\n');

      // Test 3: Enhanced Prompt
      if (context) {
        await this.testEnhancedPrompt();
      }

      logger.info('\n✅ Content-Aware Thumbnail Testing Complete');
      
    } catch (error) {
      logger.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ThumbnailTester();
  tester.runTests().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export default ThumbnailTester;