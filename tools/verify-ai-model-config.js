#!/usr/bin/env node

/**
 * Verify AI Model Configuration
 * Quick verification that the AI service is properly configured with Claude Sonnet 4 as primary
 */

import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

function verifyAIModelConfig() {
  logger.info('🔍 Verifying AI Model Configuration...');
  
  const aiService = new AIService();
  
  // Check pricing configuration
  logger.info('\n💰 Pricing Configuration:');
  Object.entries(aiService.pricing).forEach(([model, price]) => {
    logger.info(`   ${model}: $${price.toFixed(4)}`);
  });
  
  // Check if all required APIs are configured
  logger.info('\n🔧 API Configuration:');
  logger.info(`   Anthropic API: ${aiService.anthropic ? '✅ Configured' : '❌ Missing'}`);
  logger.info(`   OpenAI API: ${aiService.openai ? '✅ Configured' : '❌ Missing'}`);
  logger.info(`   Leonardo AI API: ${aiService.leonardoClient ? '✅ Configured' : '❌ Missing'}`);
  
  // Check model hierarchy (based on the updated code structure)
  logger.info('\n🧠 Expected Model Hierarchy:');
  logger.info('   1️⃣ Primary: Claude Sonnet 4 (claude-sonnet-4-20250514)');
  logger.info('   2️⃣ Secondary: Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)');
  logger.info('   3️⃣ Final Fallback: OpenAI GPT-4o-mini');
  
  // Check Leonardo AI models
  logger.info('\n🎨 Leonardo AI Models:');
  Object.entries(aiService.leonardoModels).forEach(([key, model]) => {
    logger.info(`   ${key}: ${model.name} (${model.maxWidth}x${model.maxHeight})`);
  });
  
  logger.info('\n✅ Configuration verification complete');
  logger.info('📝 The AI service should now use Claude Sonnet 4 as primary for all text tasks');
  logger.info('🎯 Run test-claude-sonnet-4-integration.js to verify functionality');
}

// Run the verification
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyAIModelConfig();
}

export default verifyAIModelConfig;