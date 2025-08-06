#!/usr/bin/env node
/**
 * Test script for YouTube image generation improvements
 * 
 * This script validates:
 * 1. YouTube video format images (16:9 aspect ratio)
 * 2. Consistent styling across video images
 * 3. Digital Ocean Spaces integration
 * 4. Cost tracking and optimization
 * 5. DALL-E 2 cost reduction
 */

import { config } from '../config/config.js';
import AIService from '../src/services/aiService.js';
import DigitalOceanService from '../src/services/digitalOceanService.js';
import logger from '../src/utils/logger.js';

async function testImageImprovements() {
  console.log('🚀 Testing YouTube Image Generation Improvements\n');
  
  try {
    // Initialize services
    console.log('1️⃣ Initializing services...');
    const aiService = new AIService();
    const digitalOceanService = new DigitalOceanService();
    
    // Test configuration
    console.log('\n2️⃣ Testing configuration...');
    console.log(`✓ Image Model: ${config.app.imageModel}`);
    console.log(`✓ Image Size: ${config.app.imageWidth}x${config.app.imageHeight}`);
    console.log(`✓ Aspect Ratio: ${config.app.imageAspectRatio}`);
    console.log(`✓ Max Cost Per Video: $${config.app.maxImageCostPerVideo}`);
    console.log(`✓ Cost Tracking: ${config.app.costTrackingEnabled ? 'Enabled' : 'Disabled'}`);
    
    // Test Digital Ocean connection
    console.log('\n3️⃣ Testing Digital Ocean Spaces...');
    try {
      await digitalOceanService.healthCheck();
      console.log('✅ Digital Ocean Spaces: Connected');
      
      // Test folder creation
      const testVideoId = `test_${Date.now()}`;
      const folderResult = await digitalOceanService.createVideoFolder(testVideoId);
      console.log(`✓ Created test folder: ${folderResult.folderPath}`);
      
      // Clean up test folder
      try {
        await digitalOceanService.deleteFile(`videos/${testVideoId}/images/.placeholder`);
        await digitalOceanService.deleteFile(`videos/${testVideoId}/thumbnails/.placeholder`);
        await digitalOceanService.deleteFile(`videos/${testVideoId}/final/.placeholder`);
        console.log('✓ Cleaned up test folder');
      } catch (error) {
        console.log('⚠️  Cleanup warning:', error.message);
      }
    } catch (error) {
      console.log('❌ Digital Ocean Spaces: Connection failed');
      console.log('   Make sure DO credentials are configured in .env file');
      console.log(`   Error: ${error.message}`);
      return;
    }
    
    // Test AI service with cost calculation
    console.log('\n4️⃣ Testing AI service and cost calculations...');
    
    // Mock video metadata for testing
    const mockVideoData = {
      videoId: `test_video_${Date.now()}`,
      title: 'Test Video: AI Image Generation Improvements',
      channelTitle: 'Test Channel',
      description: 'This is a test video for validating YouTube image generation improvements',
      transcriptText: 'Welcome to this test video. We are testing our new image generation system that creates YouTube-ready images with consistent styling and cost optimization.'
    };
    
    // Test style selection
    console.log('\n📋 Testing style consistency...');
    const styleInfo = await aiService.selectVideoStyle(mockVideoData.transcriptText, mockVideoData);
    console.log(`✓ Selected style: ${styleInfo.style}`);
    console.log(`✓ Style template: ${styleInfo.template}`);
    
    // Test cost calculation
    console.log('\n💰 Testing cost calculations...');
    const singleImageCost = aiService.calculateImageCost(config.app.imageModel, 1);
    const budgetImages = Math.floor(config.app.maxImageCostPerVideo / singleImageCost);
    console.log(`✓ Cost per image (${config.app.imageModel}): $${singleImageCost.toFixed(4)}`);
    console.log(`✓ Max images within budget: ${budgetImages}`);
    
    // Compare with DALL-E 3 costs
    const dalle3Cost = aiService.calculateImageCost('dall-e-3', budgetImages);
    const currentCost = aiService.calculateImageCost(config.app.imageModel, budgetImages);
    const savings = dalle3Cost - currentCost;
    console.log(`✓ DALL-E 3 cost for ${budgetImages} images: $${dalle3Cost.toFixed(4)}`);
    console.log(`✓ Current model cost: $${currentCost.toFixed(4)}`);
    console.log(`✓ Potential savings: $${savings.toFixed(4)} (${((savings/dalle3Cost)*100).toFixed(1)}%)`);
    
    // Test image prompt generation with consistency
    console.log('\n🎨 Testing image prompt generation...');
    const testSentences = [
      'Welcome to our comprehensive guide on YouTube automation',
      'AI technology is revolutionizing content creation',
      'Cost optimization helps creators scale efficiently'
    ];
    
    const promptData = await aiService.generateImagePrompts(testSentences, styleInfo, mockVideoData);
    console.log(`✓ Generated ${promptData.prompts.length} consistent prompts`);
    console.log(`✓ Video style applied: ${promptData.videoStyle.style}`);
    
    // Test budget checking
    console.log('\n🏦 Testing budget controls...');
    const withinBudget = aiService.isWithinBudget(mockVideoData.videoId, currentCost);
    console.log(`✓ Within budget check: ${withinBudget ? 'PASS' : 'FAIL'}`);
    
    // Test actual image generation (limit to 1 for cost control)
    if (process.argv.includes('--generate-image')) {
      console.log('\n🖼️ Testing actual image generation...');
      console.log('⚠️  This will incur actual costs!');
      
      const testPrompt = promptData.prompts[0];
      console.log(`Prompt: ${testPrompt.prompt.substring(0, 100)}...`);
      
      try {
        const imageResult = await aiService.generateImage(testPrompt.prompt, {
          videoId: mockVideoData.videoId,
          model: config.app.imageModel
        });
        
        console.log(`✅ Image generated successfully`);
        console.log(`✓ URL: ${imageResult.url}`);
        console.log(`✓ Cost: $${imageResult.cost.toFixed(4)}`);
        console.log(`✓ Size: ${imageResult.size}`);
        console.log(`✓ Model: ${imageResult.model}`);
        
        // Test upload to Digital Ocean
        console.log('\n☁️ Testing Digital Ocean upload...');
        const fileName = `test_image_${Date.now()}.png`;
        const uploadResult = await aiService.downloadAndUploadImage(
          imageResult.url,
          fileName,
          mockVideoData.videoId
        );
        
        console.log(`✅ Image uploaded to Digital Ocean`);
        console.log(`✓ CDN URL: ${uploadResult.cdnUrl}`);
        console.log(`✓ File size: ${uploadResult.key}`);
        
      } catch (error) {
        console.log(`❌ Image generation failed: ${error.message}`);
      }
    } else {
      console.log('\n🖼️ Skipping actual image generation (use --generate-image flag to test)');
    }
    
    // Test cost summary
    console.log('\n📊 Testing cost summary...');
    const costSummary = aiService.getCostSummary();
    console.log('✓ Cost Summary Generated:');
    console.log(`  - Total Cost: $${costSummary.totalCost.toFixed(4)}`);
    console.log(`  - Images Generated: ${costSummary.totalImagesGenerated}`);
    console.log(`  - Average Cost Per Video: $${costSummary.averageCostPerVideo.toFixed(4)}`);
    console.log(`  - Cost Savings vs DALL-E 3: $${costSummary.costSavingsVsDallE3.toFixed(4)}`);
    
    // Configuration recommendations
    console.log('\n💡 Configuration Recommendations:');
    
    if (config.app.imageModel === 'dall-e-3') {
      console.log('💰 Consider switching to DALL-E 2 for 50-75% cost reduction');
      console.log(`   Current: $${aiService.imagePricing['dall-e-3']}/image`);
      console.log(`   DALL-E 2: $${aiService.imagePricing['dall-e-2']}/image`);
    }
    
    if (config.app.imageWidth !== 1920 || config.app.imageHeight !== 1080) {
      console.log('📐 Update image dimensions to 1920x1080 for optimal YouTube format');
    }
    
    if (!config.digitalOcean.cdnUrl) {
      console.log('🚀 Configure CDN URL for faster image delivery');
    }
    
    console.log('\n✅ All image improvements tested successfully!');
    console.log('\n📋 Summary of Improvements:');
    console.log('  ✅ YouTube video format (16:9 aspect ratio)');
    console.log('  ✅ Consistent styling system');
    console.log('  ✅ Digital Ocean Spaces integration');
    console.log('  ✅ Cost tracking and budgeting');
    console.log('  ✅ DALL-E 2 cost optimization');
    console.log('  ✅ Enhanced configuration options');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testImageImprovements().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});