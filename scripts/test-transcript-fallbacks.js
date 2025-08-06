#!/usr/bin/env node
/**
 * Test script for transcript fallback methods
 * Tests various scenarios where YouTube transcripts may not be available
 */

import YouTubeService from '../src/services/youtubeService.js';
import logger from '../src/utils/logger.js';
import { TEST_SCENARIOS, TEST_VIDEOS } from '../src/test-data/beyondBeingTestData.js';

class TranscriptFallbackTester {
  constructor() {
    this.youtubeService = new YouTubeService();
  }

  async testVideoSet() {
    // Use actual BeyondBeing channel videos for realistic testing
    const testVideos = TEST_SCENARIOS.TRANSCRIPT_FALLBACK.videos;

    console.log('\n🧪 Testing Transcript Fallback Methods with BeyondBeing Channel\n');
    console.log('🎬 Channel: BeyondBeing - Self-improvement & productivity content');
    console.log('='.repeat(60));

    for (const video of testVideos) {
      await this.testSingleVideo(video);
      console.log('-'.repeat(50));
    }
  }

  async testSingleVideo(videoTest) {
    try {
      console.log(`\n📹 Testing: ${videoTest.name}`);
      console.log(`🔗 URL: ${videoTest.url}`);
      
      const startTime = Date.now();
      const result = await this.youtubeService.getCompleteVideoData(videoTest.url);
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  Processing time: ${duration}ms`);
      console.log(`📊 Video: "${result.title}" by ${result.channelTitle}`);
      console.log(`⏰ Duration: ${result.duration}`);
      
      if (result.transcriptStatus) {
        const status = result.transcriptStatus;
        console.log(`\n📝 Transcript Status:`);
        console.log(`   Available: ${status.available ? '✅' : '❌'}`);
        console.log(`   Source: ${status.source}`);
        console.log(`   Quality: ${status.quality}`);
        console.log(`   Length: ${status.length} characters`);
        console.log(`   Segments: ${status.segments}`);
        
        if (status.available) {
          // Show sample of transcript
          const sample = result.transcriptText.substring(0, 200);
          console.log(`   Sample: "${sample}${result.transcriptText.length > 200 ? '...' : ''}"`);
        }
      }
      
      // Test each fallback method individually
      await this.testIndividualMethods(this.youtubeService.extractVideoId(videoTest.url));
      
    } catch (error) {
      console.error(`❌ Error testing ${videoTest.name}:`, error.message);
    }
  }

  async testIndividualMethods(videoId) {
    console.log(`\n🔧 Testing Individual Fallback Methods for ${videoId}:`);
    
    const methods = [
      {
        name: 'Primary (youtube-transcript)',
        test: () => this.testPrimaryMethod(videoId)
      },
      {
        name: 'Alternative Libraries',
        test: () => this.testAlternativeLibraries(videoId)
      },
      {
        name: 'Description Fallback',
        test: () => this.testDescriptionFallback(videoId)
      },
      {
        name: 'Comments Analysis',
        test: () => this.testCommentsAnalysis(videoId)
      }
    ];

    for (const method of methods) {
      try {
        const startTime = Date.now();
        const result = await method.test();
        const duration = Date.now() - startTime;
        
        if (result && result.length > 0) {
          console.log(`   ✅ ${method.name}: ${result.length} segments (${duration}ms)`);
        } else {
          console.log(`   ⚠️  ${method.name}: No results (${duration}ms)`);
        }
      } catch (error) {
        console.log(`   ❌ ${method.name}: Failed - ${error.message}`);
      }
    }
  }

  async testPrimaryMethod(videoId) {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript?.map(item => ({
      text: item.text,
      start: item.offset,
      duration: item.duration
    }));
  }

  async testAlternativeLibraries(videoId) {
    return await this.youtubeService.getAlternativeTranscript(videoId);
  }

  async testDescriptionFallback(videoId) {
    return await this.youtubeService.getDescriptionAsTranscript(videoId);
  }

  async testCommentsAnalysis(videoId) {
    return await this.youtubeService.getCommentsAsTranscript(videoId);
  }

  async testConfigurationScenarios() {
    console.log('\n⚙️ Testing Configuration Scenarios\n');
    console.log('='.repeat(50));

    const scenarios = [
      {
        name: 'All fallbacks disabled',
        config: { enableFallbacks: false }
      },
      {
        name: 'Only description fallback',
        config: { 
          enableFallbacks: true,
          fallbackMethods: ['description']
        }
      },
      {
        name: 'Alternative libs + description',
        config: {
          enableFallbacks: true,
          fallbackMethods: ['alternative-libs', 'description']
        }
      }
    ];

    const testUrl = TEST_VIDEOS[0].youtubeUrl; // Use highest viewed BeyondBeing video

    for (const scenario of scenarios) {
      console.log(`\n📋 Scenario: ${scenario.name}`);
      
      // Temporarily modify config for testing
      const originalConfig = { ...this.youtubeService.config?.transcript };
      if (this.youtubeService.config) {
        Object.assign(this.youtubeService.config.transcript, scenario.config);
      }
      
      try {
        const result = await this.youtubeService.getTranscript(testUrl);
        console.log(`   Result: ${result ? `${result.length} segments` : 'No transcript'}`);
      } catch (error) {
        console.log(`   Error: ${error.message}`);
      }
      
      // Restore original config
      if (originalConfig && this.youtubeService.config) {
        Object.assign(this.youtubeService.config.transcript, originalConfig);
      }
    }
  }

  async runHealthChecks() {
    console.log('\n🏥 Running Health Checks\n');
    console.log('='.repeat(50));

    const checks = [
      {
        name: 'YouTube Service',
        test: () => this.youtubeService.healthCheck()
      },
      {
        name: 'youtube-transcript library',
        test: async () => {
          const { YoutubeTranscript } = await import('youtube-transcript');
          const result = await YoutubeTranscript.fetchTranscript(TEST_VIDEOS[0].videoId);
          return result && result.length > 0;
        }
      },
      {
        name: 'youtube-captions-scraper',
        test: async () => {
          const { getSubtitles } = await import('youtube-captions-scraper');
          const result = await getSubtitles({ videoID: TEST_VIDEOS[0].videoId, lang: 'en' });
          return result && result.length > 0;
        }
      }
    ];

    for (const check of checks) {
      try {
        const result = await check.test();
        console.log(`✅ ${check.name}: ${result ? 'Healthy' : 'Available but no data'}`);
      } catch (error) {
        console.log(`❌ ${check.name}: Failed - ${error.message}`);
      }
    }
  }
}

async function main() {
  const tester = new TranscriptFallbackTester();
  
  try {
    await tester.runHealthChecks();
    await tester.testVideoSet();
    await tester.testConfigurationScenarios();
    
    console.log('\n🎉 Transcript fallback testing completed!\n');
    
    console.log('💡 Configuration Tips for BeyondBeing Content:');
    console.log('   - Self-improvement videos typically have good transcripts');
    console.log('   - Enable description fallback for free, low-quality transcripts');
    console.log('   - Use alternative libraries for better YouTube coverage');
    console.log('   - Enable Whisper fallback only if budget allows (costs per minute)');
    console.log('   - Comments analysis uses API quota but provides unique insights');
    console.log('');
    console.log('🎬 BeyondBeing Test Videos Used:');
    TEST_SCENARIOS.TRANSCRIPT_FALLBACK.videos.forEach((video, index) => {
      console.log(`   ${index + 1}. ${video.name}: ${video.url}`);
    });
    
  } catch (error) {
    console.error('🚨 Testing failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default TranscriptFallbackTester;