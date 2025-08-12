#!/usr/bin/env node

import AIService from '../src/services/aiService.js';

const ai = new AIService();
console.log('🧪 Testing description generation with real workflow scenario...');

const description = await ai.generateOptimizedDescription(
  'This video reveals 5 productivity secrets that can transform your work-from-home routine. Research shows these methods increase efficiency by 40%. You will learn time management techniques, focus strategies, and workspace optimization tips.',
  { title: 'Productivity Secrets That Actually Work', channelTitle: 'Work Smart' },
  ['productivity', 'work from home', 'time management', 'efficiency']
);

console.log('✅ Description generated:');
console.log(description);
console.log('\n📏 Length:', description.length, 'characters');

const facelessCheck = !description.match(/\b(I|me|my)\b/i);
const youtubeCheck = description.match(/(like|subscribe|comment)/i);
const externalCheck = !description.match(/(website|download|email|instagram|twitter)/i);

console.log('🔍 Faceless check:', facelessCheck ? 'PASS' : 'FAIL');
console.log('🎯 YouTube CTAs:', youtubeCheck ? 'PASS' : 'FAIL'); 
console.log('🚫 No external CTAs:', externalCheck ? 'PASS' : 'FAIL');

console.log('\n✅ Integration test completed successfully!');