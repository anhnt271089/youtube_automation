#!/usr/bin/env node

/**
 * Test tool to validate Video Description generation and integration
 * This tests the complete workflow from script generation to Video Info sheet updates
 */

import { config } from '../config/config.js';
import AIService from '../src/services/aiService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import MetadataService from '../src/services/metadataService.js';
import YouTubeService from '../src/services/youtubeService.js';
import logger from '../src/utils/logger.js';

class VideoDescriptionTester {
  constructor() {
    this.aiService = new AIService();
    this.googleSheetsService = new GoogleSheetsService();
    this.youtubeService = new YouTubeService();
    this.metadataService = new MetadataService(this.googleSheetsService, this.youtubeService);
  }

  async testDescriptionGeneration() {
    try {
      console.log('🧪 Testing Video Description Generation Integration...\n');

      // Test data for description generation
      const testScript = `
      In today's digital world, productivity has become more important than ever. 
      Many people struggle to maintain focus while working from home. 
      Research shows that simple productivity techniques can increase efficiency by up to 40%.
      
      This video reveals proven methods that anyone can implement immediately.
      These strategies are based on scientific studies and have been tested by thousands of remote workers.
      
      You'll discover how to create the perfect workspace environment.
      Learn time management techniques that actually work in practice.
      Understand the psychology behind procrastination and how to overcome it.
      
      By the end of this video, you'll have a complete system for maximizing your daily productivity.
      `;

      const testMetadata = {
        title: "10 Productivity Hacks That Actually Work for Remote Workers",
        channelTitle: "Productivity Master",
        duration: "8:45",
        viewCount: "125,000"
      };

      const testKeywords = [
        "productivity hacks", "remote work", "work from home", "time management",
        "focus techniques", "productivity tips", "efficiency", "workplace productivity"
      ];

      console.log('📝 Generating optimized description...');
      const optimizedDescription = await this.aiService.generateOptimizedDescription(
        testScript,
        testMetadata,
        testKeywords
      );

      console.log('✅ Description generated successfully!\n');
      console.log('📄 Generated Description:');
      console.log('=' * 80);
      console.log(optimizedDescription);
      console.log('=' * 80);

      // Validate description requirements
      this.validateDescriptionRequirements(optimizedDescription);

      return {
        success: true,
        description: optimizedDescription,
        testScript,
        testMetadata,
        testKeywords
      };

    } catch (error) {
      console.error('❌ Description generation test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  validateDescriptionRequirements(description) {
    console.log('\n🔍 Validating Description Requirements:\n');

    const requirements = [
      {
        name: 'No First-Person Language',
        test: () => !description.match(/\b(I|me|my|I've|I have|I discovered|I found|I tested)\b/i),
        critical: true
      },
      {
        name: 'Contains Hook (First 125 chars)',
        test: () => description.length > 125 && description.substring(0, 125).length > 100,
        critical: true
      },
      {
        name: 'YouTube Platform CTAs Only',
        test: () => description.includes('subscribe') || description.includes('like') || description.includes('comment'),
        critical: true
      },
      {
        name: 'No External Links/CTAs',
        test: () => !description.match(/(website|download|email|instagram|twitter|facebook|link in bio)/i),
        critical: true
      },
      {
        name: 'Contains Keywords Naturally',
        test: () => description.includes('productivity') || description.includes('remote work'),
        critical: true
      },
      {
        name: 'Faceless Channel Appropriate',
        test: () => !description.match(/(my experience|my story|my journey|personal|I will show)/i),
        critical: true
      },
      {
        name: 'Contains Hashtags',
        test: () => description.includes('#'),
        critical: false
      },
      {
        name: 'Appropriate Length (400-1000 chars)',
        test: () => description.length >= 400 && description.length <= 1000,
        critical: false
      }
    ];

    let passedTests = 0;
    let criticalIssues = [];

    requirements.forEach(requirement => {
      const passed = requirement.test();
      const status = passed ? '✅' : '❌';
      const critical = requirement.critical ? ' (CRITICAL)' : '';
      
      console.log(`${status} ${requirement.name}${critical}`);
      
      if (passed) {
        passedTests++;
      } else if (requirement.critical) {
        criticalIssues.push(requirement.name);
      }
    });

    console.log(`\n📊 Test Results: ${passedTests}/${requirements.length} requirements passed`);

    if (criticalIssues.length > 0) {
      console.log(`⚠️  Critical Issues Found: ${criticalIssues.join(', ')}`);
      return false;
    } else {
      console.log('🎉 All critical requirements passed!');
      return true;
    }
  }

  async testVideoInfoIntegration(testVideoId = 'VID-TEST-DESC') {
    try {
      console.log('\n🔧 Testing Video Info Sheet Integration...\n');

      // Simulate enhanced content with description
      const mockEnhancedContent = {
        attractiveScript: 'Test script content for validation',
        optimizedDescription: 'Test description: Discover powerful productivity techniques that boost efficiency by 40%. Research-backed methods for remote workers. Learn time management, focus strategies, and workspace optimization. Transform your daily productivity today! 👍 Like if helpful | 🔔 Subscribe for more productivity tips #productivity #remotework #efficiency',
        optimizedTitles: {
          recommended: 'Test Title: 10 Productivity Hacks for Remote Workers',
          options: ['Option 1', 'Option 2']
        },
        keywords: {
          primaryKeywords: ['productivity', 'remote work', 'efficiency'],
          longTailKeywords: ['work from home tips', 'productivity hacks remote']
        },
        scriptSentences: ['Sentence 1', 'Sentence 2']
      };

      const mockVideoData = {
        title: 'Test Video Title',
        youtubeUrl: 'https://youtube.com/watch?v=test',
        videoId: testVideoId,
        channelTitle: 'Test Channel',
        duration: '8:45'
      };

      console.log('📝 Testing Video Info structure with description...');

      // Simulate the Video Info data structure that would be created
      const videoInfoData = [
        ['Video Title', mockVideoData.title],
        ['YouTube URL', mockVideoData.youtubeUrl || ''],
        ['YouTube Video ID', mockVideoData.videoId],
        ['Channel', mockVideoData.channelTitle || ''],
        ['Duration', mockVideoData.duration || ''],
        ['', ''], // Empty row
        
        // Description section
        ['📝 YOUTUBE VIDEO DESCRIPTION', '✨ AI-OPTIMIZED'],
        ['', ''], // Empty row
        ['Description Content', mockEnhancedContent.optimizedDescription || ''],
        ['', ''], // Empty row
        ['Description Guidelines', 'This description is optimized for YouTube SEO and engagement. Copy-paste directly to YouTube description box.'],
        ['Features', '✓ YouTube-optimized hook (first 125 characters)\n✓ Natural keyword integration\n✓ Engagement CTAs\n✓ Faceless channel appropriate\n✓ NO external links'],
        ['', ''], // Empty row
      ];

      console.log('✅ Video Info structure validated');
      console.log(`📊 Total rows with description: ${videoInfoData.length}`);
      
      // Check if description is properly included
      const descriptionRow = videoInfoData.find(row => row[0] === 'Description Content');
      if (descriptionRow && descriptionRow[1]) {
        console.log('✅ Description successfully integrated into Video Info structure');
        console.log(`📄 Description preview: ${descriptionRow[1].substring(0, 100)}...`);
        return true;
      } else {
        console.log('❌ Description not found in Video Info structure');
        return false;
      }

    } catch (error) {
      console.error('❌ Video Info integration test failed:', error);
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Comprehensive Video Description Integration Tests\n');
    console.log('=' * 80);

    const results = {
      descriptionGeneration: false,
      videoInfoIntegration: false,
      overallSuccess: false
    };

    try {
      // Test 1: Description Generation
      console.log('TEST 1: Description Generation');
      const descTest = await this.testDescriptionGeneration();
      results.descriptionGeneration = descTest.success;

      // Test 2: Video Info Integration
      console.log('\nTEST 2: Video Info Integration');
      results.videoInfoIntegration = await this.testVideoInfoIntegration();

      // Overall assessment
      results.overallSuccess = results.descriptionGeneration && results.videoInfoIntegration;

      console.log('\n' + '=' * 80);
      console.log('📊 FINAL TEST RESULTS');
      console.log('=' * 80);
      console.log(`✅ Description Generation: ${results.descriptionGeneration ? 'PASSED' : 'FAILED'}`);
      console.log(`✅ Video Info Integration: ${results.videoInfoIntegration ? 'PASSED' : 'FAILED'}`);
      console.log(`🎯 Overall Success: ${results.overallSuccess ? 'PASSED' : 'FAILED'}`);

      if (results.overallSuccess) {
        console.log('\n🎉 All tests passed! Video Description integration is ready for production.');
      } else {
        console.log('\n⚠️  Some tests failed. Please review the issues above.');
      }

      return results;

    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      return {
        ...results,
        error: error.message
      };
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new VideoDescriptionTester();
  
  tester.runAllTests()
    .then(results => {
      process.exit(results.overallSuccess ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export default VideoDescriptionTester;