#!/usr/bin/env node

/**
 * Manual test script for YouTube metadata extraction
 * Usage: node scripts/test-youtube-metadata.js [YOUTUBE_URL]
 */

import YouTubeService from '../src/services/youtubeService.js';
import logger from '../src/utils/logger.js';

class YouTubeMetadataTest {
  constructor() {
    this.youtubeService = new YouTubeService();
  }

  async testMetadataExtraction(youtubeUrl) {
    console.log('🔍 YouTube Metadata Extraction Test');
    console.log('=' .repeat(50));
    console.log(`📹 Testing URL: ${youtubeUrl}`);
    console.log('');

    try {
      // Step 1: Extract Video ID
      console.log('Step 1: Extracting Video ID...');
      const videoId = this.youtubeService.extractVideoId(youtubeUrl);
      console.log(`✅ Video ID: ${videoId}`);
      console.log('');

      // Step 2: Get Video Metadata
      console.log('Step 2: Fetching Video Metadata...');
      const metadata = await this.youtubeService.getVideoMetadata(videoId);
      
      console.log('✅ Metadata Retrieved:');
      console.log(`   📊 Title: ${metadata.title}`);
      console.log(`   📺 Channel: ${metadata.channelTitle}`);
      console.log(`   ⏱️  Duration: ${metadata.duration}`);
      console.log(`   👀 Views: ${metadata.viewCount?.toLocaleString() || 'N/A'}`);
      console.log(`   📅 Published: ${metadata.publishedAt}`);
      console.log(`   🏷️  Tags: ${metadata.tags?.slice(0, 5).join(', ') || 'None'}`);
      console.log(`   📝 Description length: ${metadata.description?.length || 0} chars`);
      console.log('');

      // Step 3: Get Video Transcript
      console.log('Step 3: Fetching Video Transcript...');
      try {
        const transcript = await this.youtubeService.getTranscript(videoId);
        const transcriptText = this.youtubeService.formatTranscript(transcript);
        
        console.log('✅ Transcript Retrieved:');
        console.log(`   📄 Length: ${transcriptText.length} characters`);
        console.log(`   📝 Word count: ~${transcriptText.split(' ').length} words`);
        console.log(`   📋 Sample: ${transcriptText.substring(0, 200)}...`);
        console.log('');
      } catch (transcriptError) {
        console.log('⚠️  Transcript extraction failed:');
        console.log(`   Error: ${transcriptError.message}`);
        console.log('   (This is common for videos without captions)');
        console.log('');
      }

      // Step 4: Download Thumbnail (optional)
      console.log('Step 4: Testing Thumbnail Download...');
      try {
        const thumbnailPath = `./temp/test-thumbnail-${videoId}.jpg`;
        await this.youtubeService.downloadThumbnail(videoId, thumbnailPath);
        console.log(`✅ Thumbnail downloaded: ${thumbnailPath}`);
        console.log('');
      } catch (thumbnailError) {
        console.log('⚠️  Thumbnail download failed:');
        console.log(`   Error: ${thumbnailError.message}`);
        console.log('');
      }

      // Summary
      console.log('🎉 Test Summary:');
      console.log('=' .repeat(50));
      console.log('✅ YouTube metadata extraction completed successfully!');
      console.log('');
      console.log('📋 Complete Metadata Object:');
      console.log(JSON.stringify(metadata, null, 2));

      return metadata;

    } catch (error) {
      console.error('❌ Test Failed:');
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      throw error;
    }
  }

  async testMultipleUrls(urls) {
    console.log('🔍 Multiple URLs Test');
    console.log('=' .repeat(50));
    
    for (let i = 0; i < urls.length; i++) {
      console.log(`\n📹 Testing URL ${i + 1}/${urls.length}: ${urls[i]}`);
      console.log('-'.repeat(30));
      
      try {
        await this.testMetadataExtraction(urls[i]);
        console.log('✅ Success!');
      } catch (error) {
        console.error('❌ Failed!');
        console.error(`Error: ${error.message}`);
      }
      
      if (i < urls.length - 1) {
        console.log('\n⏳ Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testUrl = args[0];

  // Test URLs if none provided
  const defaultTestUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Rick Astley
    'https://www.youtube.com/watch?v=9bZkp7q19f0', // Gangnam Style
    'https://www.youtube.com/watch?v=kJQP7kiw5Fk'  // Despacito
  ];

  const tester = new YouTubeMetadataTest();

  try {
    if (testUrl) {
      // Test single URL
      await tester.testMetadataExtraction(testUrl);
    } else {
      // Test multiple default URLs
      console.log('No URL provided. Testing with default URLs...\n');
      await tester.testMultipleUrls(defaultTestUrls);
    }
  } catch (error) {
    console.error('\n💥 Test execution failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Test interrupted by user');
  process.exit(0);
});

// Run the test
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});