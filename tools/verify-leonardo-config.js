#!/usr/bin/env node

import { config } from '../config/config.js';

console.log('🔑 Leonardo AI Configuration Check');
console.log('================================\n');

// Check if API key is configured
const apiKey = process.env.LEONARDO_API_KEY || config.leonardo?.apiKey;

if (!apiKey || apiKey === 'paste_your_actual_api_key_here' || apiKey === 'your_leonardo_api_key_here') {
  console.log('❌ Leonardo AI API key not configured');
  console.log('📝 Please add your API key to .env file:');
  console.log('   LEONARDO_API_KEY=your_actual_api_key');
  process.exit(1);
}

console.log('✅ Leonardo AI API key configured');
console.log(`🔐 Key starts with: ${apiKey.substring(0, 10)}...`);
console.log(`📏 Key length: ${apiKey.length} characters`);

console.log('\n🎯 Current Settings:');
console.log(`📦 Image Provider: ${process.env.IMAGE_PROVIDER || 'openai'}`);
console.log(`🤖 Default Model: ${process.env.IMAGE_MODEL || 'leonardo-phoenix'}`);
console.log(`✨ Alchemy Enabled: ${process.env.LEONARDO_ENABLE_ALCHEMY || 'true'}`);
console.log(`🎬 Preset Style: ${process.env.LEONARDO_PRESET_STYLE || 'CINEMATIC'}`);

console.log('\n🚀 Ready to generate thumbnails with Leonardo AI!');
console.log('💡 Run: node tools/generate-thumbnails-vid-0001.js');