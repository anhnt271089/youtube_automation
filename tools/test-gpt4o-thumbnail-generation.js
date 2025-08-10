#!/usr/bin/env node

/**
 * Test GPT-4o Enhanced Thumbnail Generation
 * 
 * This tool tests the new GPT-4o enhanced thumbnail generation pipeline
 * to ensure that prompts are being enhanced by GPT-4o before being sent to DALL-E 3
 * 
 * Usage:
 *   node tools/test-gpt4o-thumbnail-generation.js --test-basic
 *   node tools/test-gpt4o-thumbnail-generation.js --test-video VID-0001
 *   node tools/test-gpt4o-thumbnail-generation.js --compare-prompts
 */

import AIService from '../src/services/aiService.js';
import ThumbnailService from '../src/services/thumbnailService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import logger from '../src/utils/logger.js';
import { config } from '../config/config.js';

class GPT4oThumbnailTester {
  constructor() {
    this.aiService = new AIService();
    this.googleDriveService = new GoogleDriveService();
    this.thumbnailService = new ThumbnailService(this.aiService, this.googleDriveService);
  }

  /**
   * Test basic GPT-4o prompt enhancement
   */
  async testPromptEnhancement() {
    console.log('🧪 Testing GPT-4o prompt enhancement...\n');
    
    const originalPrompt = 'Create a YouTube thumbnail about productivity tips with a person working at a desk';
    
    try {
      const enhancedPrompt = await this.aiService.enhancePromptWithGPT4o(originalPrompt, {
        isThumbnail: true,
        size: '1792x1024',
        videoId: 'TEST-001'
      });
      
      console.log('✅ GPT-4o Enhancement Test Results:');
      console.log('\n📝 Original Prompt:');
      console.log(originalPrompt);
      console.log('\n✨ GPT-4o Enhanced Prompt:');
      console.log(enhancedPrompt);
      console.log('\n📊 Enhancement Stats:');
      console.log(`- Original length: ${originalPrompt.length} characters`);
      console.log(`- Enhanced length: ${enhancedPrompt.length} characters`);
      console.log(`- Enhancement ratio: ${(enhancedPrompt.length / originalPrompt.length).toFixed(2)}x`);
      
      return {
        success: true,
        original: originalPrompt,
        enhanced: enhancedPrompt,
        lengthRatio: enhancedPrompt.length / originalPrompt.length
      };
      
    } catch (error) {
      console.log('❌ GPT-4o enhancement test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test full thumbnail generation with GPT-4o enhancement
   */
  async testThumbnailGeneration() {
    console.log('🎨 Testing full thumbnail generation with GPT-4o...\n');
    
    const testVideoData = {
      title: 'How to Control Your Brain Before It\'s Too Late',
      script: 'Your brain is constantly working against your success. Every day, it creates patterns and habits that sabotage your potential. But what if I told you there\'s a way to rewire your thinking and take control?'
    };
    
    try {
      // Test with GPT-4o enhancement enabled
      console.log('🧠 Generating thumbnail WITH GPT-4o enhancement...');
      const enhancedResult = await this.thumbnailService.generateThumbnailVariant(
        testVideoData.title,
        testVideoData.script,
        { style: 'Emotional/Dramatic' },
        'TEST-002'
      );
      
      console.log('✅ GPT-4o Enhanced Thumbnail Generated:');
      console.log(`- URL: ${enhancedResult.url}`);
      console.log(`- GPT-4o Enhanced: ${enhancedResult.gpt4oEnhanced ? 'YES' : 'NO'}`);
      console.log(`- Model: ${enhancedResult.model}`);
      console.log(`- Size: ${enhancedResult.size}`);
      console.log(`- Cost: $${enhancedResult.cost.toFixed(4)}`);
      console.log(`- Style: ${enhancedResult.style}`);
      
      if (enhancedResult.enhancedPrompt) {
        console.log('\n📝 Enhanced Prompt Preview:');
        console.log(enhancedResult.enhancedPrompt.substring(0, 200) + '...');
      }
      
      return {
        success: true,
        result: enhancedResult,
        gpt4oEnhanced: enhancedResult.gpt4oEnhanced
      };
      
    } catch (error) {
      console.log('❌ Thumbnail generation test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Compare prompts with and without GPT-4o enhancement
   */
  async testPromptComparison() {
    console.log('🔬 Comparing thumbnail generation with/without GPT-4o...\n');
    
    const basePrompt = 'Professional YouTube thumbnail for productivity video showing person at organized desk with success elements';
    
    try {
      // Test without GPT-4o enhancement
      console.log('1️⃣ Testing WITHOUT GPT-4o enhancement...');
      const withoutGPT4o = await this.aiService.generateImage(basePrompt, {
        size: '1792x1024',
        model: 'dall-e-3',
        quality: 'standard',
        videoId: 'TEST-003A',
        enhanceWithGPT4o: false,
        isThumbnail: true
      });
      
      // Test with GPT-4o enhancement
      console.log('2️⃣ Testing WITH GPT-4o enhancement...');
      const withGPT4o = await this.aiService.generateImage(basePrompt, {
        size: '1792x1024',
        model: 'dall-e-3',
        quality: 'standard',
        videoId: 'TEST-003B',
        enhanceWithGPT4o: true,
        isThumbnail: true
      });
      
      console.log('\n📊 COMPARISON RESULTS:');
      console.log('='.repeat(60));
      console.log('WITHOUT GPT-4o Enhancement:');
      console.log(`- Prompt: "${withoutGPT4o.prompt}"`);
      console.log(`- URL: ${withoutGPT4o.url}`);
      console.log(`- Cost: $${withoutGPT4o.cost.toFixed(4)}`);
      
      console.log('\nWITH GPT-4o Enhancement:');
      console.log(`- Original Prompt: "${withGPT4o.prompt}"`);
      console.log(`- Enhanced Prompt: "${withGPT4o.enhancedPrompt?.substring(0, 150)}..."`);
      console.log(`- URL: ${withGPT4o.url}`);
      console.log(`- Cost: $${withGPT4o.cost.toFixed(4)}`);
      console.log(`- GPT-4o Enhanced: ${withGPT4o.gpt4oEnhanced}`);
      
      console.log('\n📈 Enhancement Impact:');
      const enhancementRatio = withGPT4o.enhancedPrompt ? 
        (withGPT4o.enhancedPrompt.length / withGPT4o.prompt.length) : 1;
      console.log(`- Prompt expansion: ${enhancementRatio.toFixed(2)}x longer`);
      console.log(`- Additional cost: $${(withGPT4o.cost - withoutGPT4o.cost).toFixed(4)}`);
      console.log('='.repeat(60));
      
      return {
        success: true,
        withoutGPT4o: withoutGPT4o,
        withGPT4o: withGPT4o,
        enhancementRatio: enhancementRatio
      };
      
    } catch (error) {
      console.log('❌ Comparison test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Display system configuration
   */
  displayConfiguration() {
    console.log('⚙️ Current GPT-4o Configuration:');
    console.log('='.repeat(40));
    console.log(`- Image Model: ${config.app.imageModel}`);
    console.log(`- GPT-4o Enhancement: ${config.app.enhancePromptsWithGPT4o}`);
    console.log(`- Thumbnail Generation: ${config.app.enableThumbnailGeneration}`);
    console.log(`- Max Cost Per Video: $${config.app.maxImageCostPerVideo}`);
    console.log(`- Image Size: ${config.app.imageWidth}x${config.app.imageHeight}`);
    console.log('='.repeat(40));
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('GPT-4o Enhanced Thumbnail Generation Tester');
    console.log('');
    console.log('Usage:');
    console.log('  --test-basic          Test basic GPT-4o prompt enhancement');
    console.log('  --test-generation     Test full thumbnail generation pipeline');
    console.log('  --compare-prompts     Compare results with/without GPT-4o');
    console.log('  --config             Show current configuration');
    console.log('');
    console.log('Examples:');
    console.log('  node tools/test-gpt4o-thumbnail-generation.js --test-basic');
    console.log('  node tools/test-gpt4o-thumbnail-generation.js --compare-prompts');
    process.exit(1);
  }

  const tester = new GPT4oThumbnailTester();
  
  try {
    const command = args[0];
    
    // Always show configuration first
    tester.displayConfiguration();
    console.log('');
    
    switch (command) {
      case '--test-basic':
        await tester.testPromptEnhancement();
        break;
        
      case '--test-generation':
        await tester.testThumbnailGeneration();
        break;
        
      case '--compare-prompts':
        await tester.testPromptComparison();
        break;
        
      case '--config':
        console.log('✅ Configuration displayed above');
        break;
        
      default:
        console.log(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
    
    console.log('\n✅ GPT-4o thumbnail testing completed successfully');
    
  } catch (error) {
    console.log('\n❌ Testing failed:', error.message);
    console.log('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main().catch(error => {
  console.log('Unhandled error in GPT-4o testing:', error);
  process.exit(1);
});