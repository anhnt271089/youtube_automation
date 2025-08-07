#!/usr/bin/env node

/**
 * Google Integration Test Script
 * 
 * Tests the Google Sheets and Drive integration to ensure everything is working properly.
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import logger from '../src/utils/logger.js';

class GoogleIntegrationTest {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.driveService = new GoogleDriveService();
  }

  async runTests() {
    console.log('🧪 Starting Google Integration Tests...\n');

    const results = {
      sheetsConnection: false,
      driveConnection: false,
      videoCreation: false,
      scriptBreakdown: false,
      imageUpload: false,
      overall: false
    };

    try {
      // Test 1: Google Sheets Connection
      console.log('1️⃣ Testing Google Sheets connection...');
      try {
        const sheetsHealth = await this.sheetsService.healthCheck();
        if (sheetsHealth.status === 'healthy') {
          console.log('   ✅ Google Sheets connection successful');
          results.sheetsConnection = true;
        } else {
          console.log('   ❌ Google Sheets connection failed:', sheetsHealth.error);
        }
      } catch (error) {
        console.log('   ❌ Google Sheets connection error:', error.message);
      }

      // Test 2: Google Drive Connection
      console.log('\n2️⃣ Testing Google Drive connection...');
      try {
        await this.driveService.testConnection();
        console.log('   ✅ Google Drive connection successful');
        results.driveConnection = true;
      } catch (error) {
        console.log('   ❌ Google Drive connection failed:', error.message);
      }

      // Test 3: Video Entry Creation
      console.log('\n3️⃣ Testing video entry creation...');
      try {
        const testVideoData = {
          youtubeUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
          title: 'Test Video - Integration Test',
          channelTitle: 'Test Channel',
          duration: '3:32',
          viewCount: 1000000,
          publishedAt: '2023-01-01T00:00:00Z',
          videoId: 'dQw4w9WgXcQ'
        };

        const videoId = await this.sheetsService.createVideoEntry(testVideoData);
        console.log(`   ✅ Video entry created: ${videoId}`);
        results.videoCreation = true;
        results.testVideoId = videoId;

        // Create detail workbook
        const workbook = await this.sheetsService.createVideoDetailWorkbook(videoId, testVideoData.title);
        console.log(`   ✅ Detail workbook created: ${workbook.workbookUrl}`);
        results.workbookId = workbook.workbookId;

      } catch (error) {
        console.log('   ❌ Video entry creation failed:', error.message);
      }

      // Test 4: Script Breakdown
      if (results.testVideoId) {
        console.log('\n4️⃣ Testing script breakdown creation...');
        try {
          const scriptSentences = [
            'This is the first sentence of our test script.',
            'This is the second sentence with more content.',
            'This is the final sentence to conclude our test.'
          ];

          const imagePrompts = [
            'A professional office setting with modern lighting',
            'Abstract geometric shapes with blue and green colors',
            'A celebration scene with confetti and happy people'
          ];

          const editorKeywords = [
            'office, professional, lighting',
            'abstract, geometric, blue, green',
            'celebration, confetti, happy, people'
          ];

          await this.sheetsService.createScriptBreakdown(
            results.testVideoId, 
            scriptSentences, 
            imagePrompts, 
            editorKeywords
          );
          console.log('   ✅ Script breakdown created successfully');
          results.scriptBreakdown = true;

          // Test updating sentence status
          await this.sheetsService.updateSentenceStatus(
            results.testVideoId, 
            1, 
            'Complete',
            'https://example.com/test-image.jpg'
          );
          console.log('   ✅ Sentence status updated successfully');

        } catch (error) {
          console.log('   ❌ Script breakdown failed:', error.message);
        }
      }

      // Test 5: Image Upload (mock test - create dummy file)
      console.log('\n5️⃣ Testing image upload to Google Drive...');
      try {
        // Create a dummy text file to test upload
        const fs = await import('fs');
        const path = await import('path');
        const testFilePath = path.join(process.cwd(), 'temp', 'test-image.txt');
        
        // Ensure temp directory exists
        const tempDir = path.dirname(testFilePath);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        fs.writeFileSync(testFilePath, 'This is a test file for upload testing');

        const uploadResult = await this.driveService.uploadImage(
          testFilePath,
          'test-upload.txt',
          process.env.GOOGLE_DRIVE_FOLDER_ID,
          { makePublic: true }
        );

        console.log('   ✅ Image upload successful');
        console.log(`   📁 File ID: ${uploadResult.fileId}`);
        console.log(`   🔗 Public URL: ${uploadResult.publicUrl}`);
        results.imageUpload = true;
        results.testFileId = uploadResult.fileId;

        // Clean up test file
        fs.unlinkSync(testFilePath);
        console.log('   🧹 Test file cleaned up locally');

      } catch (error) {
        console.log('   ❌ Image upload failed:', error.message);
      }

      // Test 6: Get video details
      if (results.testVideoId) {
        console.log('\n6️⃣ Testing video details retrieval...');
        try {
          const videoDetails = await this.sheetsService.getVideoDetails(results.testVideoId);
          if (videoDetails) {
            console.log('   ✅ Video details retrieved successfully');
            console.log(`   📝 Title: ${videoDetails.title}`);
            console.log(`   📊 Status: ${videoDetails.status}`);
            console.log(`   📈 Total Sentences: ${videoDetails.totalSentences}`);
            console.log(`   ✅ Completed Sentences: ${videoDetails.completedSentences}`);
          } else {
            console.log('   ❌ No video details found');
          }
        } catch (error) {
          console.log('   ❌ Video details retrieval failed:', error.message);
        }
      }

      // Cleanup
      console.log('\n🧹 Cleaning up test data...');
      try {
        // Delete test file from Drive
        if (results.testFileId) {
          await this.driveService.drive.files.delete({
            fileId: results.testFileId
          });
          console.log('   ✅ Test file deleted from Drive');
        }

        // Delete test workbook
        if (results.workbookId) {
          await this.driveService.drive.files.delete({
            fileId: results.workbookId
          });
          console.log('   ✅ Test workbook deleted from Drive');
        }

        console.log('   ℹ️  Note: Master sheet test entry left for reference');
      } catch (error) {
        console.log('   ⚠️  Cleanup partially failed:', error.message);
      }

      // Overall result
      results.overall = results.sheetsConnection && 
                       results.driveConnection && 
                       results.videoCreation && 
                       results.scriptBreakdown;

      console.log('\n📊 Test Results Summary:');
      console.log(`   Google Sheets Connection: ${results.sheetsConnection ? '✅' : '❌'}`);
      console.log(`   Google Drive Connection: ${results.driveConnection ? '✅' : '❌'}`);
      console.log(`   Video Entry Creation: ${results.videoCreation ? '✅' : '❌'}`);
      console.log(`   Script Breakdown: ${results.scriptBreakdown ? '✅' : '❌'}`);
      console.log(`   Image Upload: ${results.imageUpload ? '✅' : '❌'}`);
      console.log(`   Overall Integration: ${results.overall ? '✅ PASS' : '❌ FAIL'}`);

      if (results.overall) {
        console.log('\n🎉 All critical tests passed! Google integration is working correctly.');
      } else {
        console.log('\n⚠️  Some tests failed. Please check the configuration and try again.');
      }

    } catch (error) {
      console.error('\n❌ Test suite failed:', error.message);
      logger.error('Google integration test failed:', error);
    }

    return results;
  }

  async quickHealthCheck() {
    console.log('🏥 Running quick health check...\n');

    try {
      const [sheetsHealth, driveTest] = await Promise.allSettled([
        this.sheetsService.healthCheck(),
        this.driveService.testConnection()
      ]);

      console.log('Google Sheets:', sheetsHealth.status === 'fulfilled' ? '✅ Healthy' : '❌ Unhealthy');
      console.log('Google Drive:', driveTest.status === 'fulfilled' ? '✅ Healthy' : '❌ Unhealthy');

      if (sheetsHealth.status === 'fulfilled' && driveTest.status === 'fulfilled') {
        console.log('\n✅ All services are healthy!');
        return true;
      } else {
        console.log('\n❌ Some services are unhealthy.');
        return false;
      }
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return false;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const tester = new GoogleIntegrationTest();

  try {
    if (args.includes('--health')) {
      await tester.quickHealthCheck();
    } else {
      await tester.runTests();
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default GoogleIntegrationTest;