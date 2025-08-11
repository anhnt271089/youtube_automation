#!/usr/bin/env node

import AIService from '../src/services/aiService.js';
import logger from '../src/utils/logger.js';

async function testSimpleLeonardoGeneration() {
  console.log('🎨 Testing Simple Leonardo AI Generation\n');
  
  const aiService = new AIService();
  
  // Simple, short prompt for testing
  const simplePrompt = "Professional overhead photograph of organized desk workspace with planning materials, notebooks, pens, coffee cup. Warm lighting, inspiring aesthetic.";
  
  console.log('📝 Test Prompt:', simplePrompt);
  console.log(`📏 Prompt Length: ${simplePrompt.length} characters\n`);
  
  try {
    console.log('🚀 Generating image with Leonardo AI...');
    
    const result = await aiService.generateImage(simplePrompt, {
      size: '1024x832',
      quality: 'hd',
      videoId: 'TEST-SIMPLE',
      isThumbnail: true
    });
    
    console.log('✅ Image generated successfully!');
    console.log('🔗 URL:', result.url);
    console.log('💰 Cost:', result.cost || 'N/A');
    
    return result;
    
  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    
    if (error.response) {
      console.log('📊 Status:', error.response.status);
      console.log('📋 Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    throw error;
  }
}

testSimpleLeonardoGeneration().catch(console.error);