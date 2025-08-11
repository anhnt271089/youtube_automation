#!/usr/bin/env node

/**
 * Leonardo AI Diagnostics Tool
 * Quick health check and configuration validation for Leonardo AI integration
 */

import { config } from '../config/config.js';
import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

async function runLeonardoDiagnostics() {
  console.log('🔧 Leonardo AI Diagnostics Tool');
  console.log('===============================');
  console.log('');

  try {
    // Configuration Check
    console.log('📋 Configuration Check');
    console.log('----------------------');
    console.log(`API Key: ${config.leonardo.apiKey ? '✅ Configured' : '❌ Missing'}`);
    console.log(`Base URL: ${config.leonardo.baseUrl}`);
    console.log(`Default Model: ${config.leonardo.defaultModel}`);
    console.log(`Alchemy Enabled: ${config.leonardo.enableAlchemy}`);
    console.log(`Request Timeout: ${config.leonardo.requestTimeout}ms`);
    console.log(`Image Provider: ${config.app.imageProvider}`);
    console.log(`Image Model: ${config.app.imageModel}`);
    console.log(`Claude Enhancement: ${config.app.enhancePromptsWithClaudeSonnet}`);
    console.log('');

    if (!config.leonardo.apiKey) {
      console.log('❌ Leonardo AI API key not configured');
      console.log('💡 Set LEONARDO_API_KEY environment variable');
      return;
    }

    // Initialize AI Service
    const aiService = new AIService();

    // API Connectivity Test
    console.log('🌐 API Connectivity Test');
    console.log('-------------------------');
    try {
      const response = await aiService.leonardoClient.get('/me');
      console.log('✅ Leonardo AI API: Connected');
      console.log(`👤 User ID: ${response.data.user_details[0].user?.id || 'N/A'}`);
      
      // Check user credits if available
      if (response.data.user_details[0].user?.tokenRenewalDate) {
        console.log(`🔄 Token Renewal: ${response.data.user_details[0].user.tokenRenewalDate}`);
      }
    } catch (error) {
      console.log('❌ Leonardo AI API: Connection failed');
      console.log(`   Error: ${error.message}`);
      if (error.response?.status === 401) {
        console.log('💡 Check your Leonardo AI API key');
      }
    }
    console.log('');

    // Model Configuration Test
    console.log('🎨 Model Configuration Test');
    console.log('----------------------------');
    const models = Object.keys(aiService.leonardoModels);
    console.log(`Available Models: ${models.join(', ')}`);
    
    const currentModel = aiService.leonardoModels[config.leonardo.defaultModel];
    if (currentModel) {
      console.log(`✅ Default Model: ${currentModel.name}`);
      console.log(`   ID: ${currentModel.id}`);
      console.log(`   Max Dimensions: ${currentModel.maxWidth}x${currentModel.maxHeight}`);
      console.log(`   Alchemy Support: ${currentModel.supportsAlchemy}`);
      console.log(`   Default Style: ${currentModel.defaultPresetStyle}`);
    } else {
      console.log(`❌ Default Model '${config.leonardo.defaultModel}' not found`);
    }
    console.log('');

    // Quick Generation Test
    console.log('⚡ Quick Generation Test');
    console.log('------------------------');
    
    const testPrompt = 'Professional minimalist workspace, clean design, high contrast';
    console.log(`Test Prompt: "${testPrompt}" (${testPrompt.length} chars)`);
    
    try {
      const result = await aiService.generateLeonardoImage(testPrompt, {
        model: config.leonardo.defaultModel,
        width: 512,
        height: 512,
        enableAlchemy: false // Faster generation
      });
      
      console.log('✅ Quick Generation: SUCCESS');
      console.log(`   Generation ID: ${result.generationId}`);
      console.log(`   Dimensions: ${result.dimensions}`);
      console.log(`   Model Used: ${result.model}`);
      console.log(`   Image URL: ${result.url.substring(0, 60)}...`);
      
    } catch (error) {
      console.log('❌ Quick Generation: FAILED');
      console.log(`   Error: ${error.message}`);
      
      if (error.message.includes('prompt too long')) {
        console.log('💡 Prompt length issue detected - this should be fixed');
      } else if (error.message.includes('400')) {
        console.log('💡 API validation error - check request parameters');
      }
    }
    console.log('');

    // Health Summary
    console.log('📊 Health Summary');
    console.log('-----------------');
    
    // Get cost summary
    const costSummary = aiService.getCostSummary();
    console.log(`Total Images Generated: ${costSummary.totalImagesGenerated}`);
    console.log(`Total Cost: $${costSummary.totalCost.toFixed(4)}`);
    console.log(`Leonardo vs DALL-E Savings: $${costSummary.costSavingsVsDallE3.toFixed(4)}`);
    console.log('');
    
    // Integration Status
    const isHealthy = config.leonardo.apiKey && 
                     aiService.leonardoModels[config.leonardo.defaultModel] &&
                     config.app.imageProvider === 'leonardo';
    
    console.log('🎯 Integration Status');
    console.log('--------------------');
    console.log(`Status: ${isHealthy ? '✅ HEALTHY' : '⚠️  NEEDS ATTENTION'}`);
    
    if (!isHealthy) {
      console.log('');
      console.log('🔧 Recommended Actions:');
      if (!config.leonardo.apiKey) {
        console.log('- Set LEONARDO_API_KEY environment variable');
      }
      if (!aiService.leonardoModels[config.leonardo.defaultModel]) {
        console.log('- Check LEONARDO_DEFAULT_MODEL configuration');
      }
      if (config.app.imageProvider !== 'leonardo') {
        console.log('- Set IMAGE_PROVIDER=leonardo to use Leonardo AI by default');
      }
    }
    console.log('');
    
    console.log('✨ Diagnostics Complete');
    
  } catch (error) {
    console.error('❌ Diagnostics failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run diagnostics if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runLeonardoDiagnostics().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default runLeonardoDiagnostics;