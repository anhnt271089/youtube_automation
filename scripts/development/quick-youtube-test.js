#!/usr/bin/env node

/**
 * Quick YouTube metadata test - minimal version
 * For testing single URLs quickly
 */

import YouTubeService from '../../src/services/youtubeService.js';

async function quickTest(url) {
  const youtube = new YouTubeService();
  
  try {
    console.log(`Testing: ${url}`);
    const videoId = youtube.extractVideoId(url);
    console.log(`Video ID: ${videoId}`);
    
    const metadata = await youtube.getVideoMetadata(videoId);
    console.log('\nMetadata:');
    console.log(`- Title: ${metadata.title}`);
    console.log(`- Channel: ${metadata.channelTitle}`);
    console.log(`- Duration: ${metadata.duration}`);
    console.log(`- Views: ${metadata.viewCount?.toLocaleString()}`);
    console.log(`- Published: ${metadata.publishedAt}`);
    
    return metadata;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// If called directly with URL argument
if (process.argv.length > 2) {
  const url = process.argv[2];
  quickTest(url).catch(console.error);
}

export default quickTest;