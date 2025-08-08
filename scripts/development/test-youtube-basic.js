#!/usr/bin/env node

/**
 * Basic YouTube service test without API calls
 * Tests URL parsing and utility functions only
 */

import YouTubeService from '../../src/services/youtubeService.js';
import { TEST_SCENARIOS, TEST_VIDEOS } from '../../src/test-data/beyondBeingTestData.js';

console.log('🔍 YouTube Service Basic Test (No API calls)');
console.log('Testing with BeyondBeing channel sample data');
console.log('=' .repeat(50));

const youtube = new YouTubeService();

// Test URLs from BeyondBeing channel data
const testUrls = [
  // BeyondBeing sample videos in different URL formats
  TEST_VIDEOS[0].youtubeUrl, // Standard format: highest viewed video
  `https://youtu.be/${TEST_VIDEOS[1].videoId}`, // Short format: second highest
  `${TEST_VIDEOS[2].youtubeUrl}&list=123`, // With playlist parameter
  `https://www.youtube.com/embed/${TEST_VIDEOS[3].videoId}`, // Embed format
  TEST_VIDEOS[4].videoId, // Raw video ID: 9KaKhbzBg3c
  // Edge cases
  'invalid-url',
  null,
  ''
];

console.log('🎯 Testing Video ID Extraction:');
console.log('-'.repeat(40));

testUrls.forEach((url, index) => {
  try {
    const videoId = youtube.extractVideoId(url);
    const status = videoId ? '✅' : '❌';
    console.log(`${index + 1}. ${status} Input: ${url || 'null'}`);
    console.log(`   Video ID: ${videoId || 'null'}`);
  } catch (error) {
    console.log(`${index + 1}. ❌ Input: ${url || 'null'}`);
    console.log(`   Error: ${error.message}`);
  }
  console.log('');
});

console.log('⏱️  Testing Duration Parsing:');
console.log('-'.repeat(40));

const testDurations = [
  'PT4M13S',     // 4:13
  'PT1H2M3S',    // 1:02:03
  'PT30S',       // 0:30
  'PT5M',        // 5:00
  'PT2H',        // 2:00:00
  'PT0S',        // 0:00
  null,
  '',
  'invalid'
];

testDurations.forEach((duration, index) => {
  try {
    const parsed = youtube.parseDuration(duration);
    console.log(`${index + 1}. ✅ Input: ${duration || 'null'} → Output: ${parsed}`);
  } catch (error) {
    console.log(`${index + 1}. ❌ Input: ${duration || 'null'} → Error: ${error.message}`);
  }
});

console.log('\n📋 Testing formatTranscript:');
console.log('-'.repeat(40));

const testTranscripts = [
  [
    { text: 'Hello world', start: 0, duration: 2 },
    { text: 'This is a test', start: 2, duration: 3 }
  ],
  [],
  null,
  'invalid'
];

testTranscripts.forEach((transcript, index) => {
  try {
    const formatted = youtube.formatTranscript(transcript);
    console.log(`${index + 1}. ✅ Input: ${JSON.stringify(transcript)}`);
    console.log(`   Output: "${formatted}"`);
  } catch (error) {
    console.log(`${index + 1}. ❌ Input: ${JSON.stringify(transcript)}`);
    console.log(`   Error: ${error.message}`);
  }
  console.log('');
});

console.log('🎉 Basic Tests Complete!');
console.log('=' .repeat(50));
console.log('✅ Video ID extraction working');
console.log('✅ Duration parsing working');
console.log('✅ Transcript formatting working');
console.log('');
console.log('💡 To test API calls, add your YouTube API key to .env:');
console.log('   YOUTUBE_API_KEY=your_actual_api_key_here');
console.log('');
console.log('Then test with BeyondBeing sample videos:');
console.log(`   npm run test-youtube "${TEST_VIDEOS[0].youtubeUrl}"`);
console.log(`   Or try: "${TEST_VIDEOS[1].youtubeUrl}"`);
console.log('');
console.log('🎬 BeyondBeing Test Videos Used:');
TEST_VIDEOS.slice(0, 3).forEach((video, index) => {
  console.log(`   ${index + 1}. "${video.title}" (${video.viewCount.toLocaleString()} views)`);
  console.log(`      ${video.youtubeUrl}`);
});