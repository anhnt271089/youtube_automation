#!/usr/bin/env node

import YouTubeService from '../src/services/youtubeService.js';
import logger from '../src/utils/logger.js';

/**
 * Test script to verify video ID extraction works properly
 * This tests the core functionality that was failing
 */

console.log('🎬 Testing Video ID Extraction...\n');

const youtubeService = new YouTubeService();

// Test various YouTube URL formats
const testUrls = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ',
  'https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
  'https://www.youtube.com/embed/dQw4w9WgXcQ',
  'dQw4w9WgXcQ' // Direct video ID
];

console.log('Test 1: Video ID extraction from various formats');

for (const url of testUrls) {
  try {
    const videoId = youtubeService.extractVideoId(url);
    if (videoId) {
      console.log(`✅ ${url} → ${videoId}`);
    } else {
      console.log(`❌ ${url} → No video ID extracted`);
    }
  } catch (error) {
    console.log(`❌ ${url} → Error: ${error.message}`);
  }
}

// Test invalid URLs
console.log('\nTest 2: Invalid URL handling');

const invalidUrls = [
  null,
  undefined,
  '',
  'https://example.com',
  'not-a-url'
];

for (const url of invalidUrls) {
  try {
    const videoId = youtubeService.extractVideoId(url);
    console.log(`${url || 'null/undefined'} → ${videoId || 'null'}`);
  } catch (error) {
    console.log(`❌ ${url || 'null/undefined'} → Error: ${error.message}`);
  }
}

// Test duration parsing
console.log('\nTest 3: Duration parsing');

const testDurations = [
  'PT4M13S', // 4:13
  'PT1H2M3S', // 1:02:03
  'PT30S', // 0:30
  'PT10M', // 10:00
  'PT2H', // 2:00:00
  null,
  undefined,
  'invalid'
];

for (const duration of testDurations) {
  try {
    const parsed = youtubeService.parseDuration(duration);
    console.log(`✅ ${duration || 'null/undefined'} → ${parsed}`);
  } catch (error) {
    console.log(`❌ ${duration || 'null/undefined'} → Error: ${error.message}`);
  }
}

console.log('\n🎯 Video ID Extraction Testing Complete!');
console.log('✨ If all tests show ✅, the video ID extraction is working correctly.');