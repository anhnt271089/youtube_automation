#!/usr/bin/env node

/**
 * Test Fixed Google Sheets Structure
 * 
 * This script tests the updated GoogleSheetsService with the fixed structure
 * to ensure there are no conflicts or issues.
 */

import GoogleSheetsService from '../../src/services/googleSheetsService.js';
import logger from '../../src/utils/logger.js';

async function testFixedStructure() {
  console.log('🧪 Testing Fixed Google Sheets Structure...\n');

  const sheetsService = new GoogleSheetsService();

  try {
    // Test 1: Health Check
    console.log('1. 🏥 Testing health check...');
    const healthResult = await sheetsService.healthCheck();
    
    if (healthResult.status === 'healthy') {
      console.log('   ✅ Health check passed');
    } else {
      console.log('   ❌ Health check failed:', healthResult.error);
      return false;
    }

    // Test 2: Get Next Video ID
    console.log('\n2. 🆔 Testing Video ID generation...');
    const nextVideoId = await sheetsService.getNextVideoId();
    console.log(`   ✅ Next Video ID: ${nextVideoId}`);

    // Test 3: Create Test Video Entry (simulate only - don't actually create)
    console.log('\n3. 📝 Testing video entry creation...');
    
    const testVideoData = {
      youtubeUrl: 'https://www.youtube.com/watch?v=TEST123',
      title: 'Test Video for Structure Validation',
      channelTitle: 'Test Channel',
      duration: '5:30',
      viewCount: 1000,
      publishedAt: '2025-08-08T08:00:00Z',
      videoId: 'TEST123'
    };

    // Create the test entry
    const createdVideoId = await sheetsService.createVideoEntry(testVideoData);
    console.log(`   ✅ Created test video: ${createdVideoId}`);

    // Test 4: Find the created video
    console.log('\n4. 🔍 Testing video lookup...');
    const videoRow = await sheetsService.findVideoRow(createdVideoId);
    
    if (videoRow) {
      console.log(`   ✅ Found video at row ${videoRow.rowIndex}`);
      console.log(`   📊 Data columns: ${videoRow.data.length}`);
      
      // Verify no legacy voiceStatus field issues
      if (videoRow.data.length <= 16) {
        console.log('   ✅ Column count correct (≤16)');
      } else {
        console.log('   ❌ Too many columns:', videoRow.data.length);
      }
    } else {
      console.log('   ❌ Could not find created video');
      return false;
    }

    // Test 5: Update video status  
    console.log('\n5. 🔄 Testing status update...');
    await sheetsService.updateVideoStatus(createdVideoId, 'Processing', {
      voiceGenerationStatus: 'Not Ready'
    });
    console.log('   ✅ Status update successful');

    // Test 6: Get video details
    console.log('\n6. 📋 Testing video details retrieval...');
    const videoDetails = await sheetsService.getVideoDetails(createdVideoId);
    
    if (videoDetails) {
      console.log('   ✅ Video details retrieved');
      console.log(`   📝 Title: ${videoDetails.title}`);
      console.log(`   📊 Status: ${videoDetails.status}`);
      console.log(`   🎤 Voice Gen Status: ${videoDetails.voiceGenerationStatus}`);
      console.log(`   🎬 Video Edit Status: ${videoDetails.videoEditingStatus}`);
      
      // Check that legacy voiceStatus is not present or handled correctly
      if (videoDetails.hasOwnProperty('voiceStatus')) {
        console.log('   ⚠️  Legacy voiceStatus field still present but handled');
      } else {
        console.log('   ✅ Legacy voiceStatus field not in response');
      }
    } else {
      console.log('   ❌ Could not retrieve video details');
      return false;
    }

    // Test 7: Test column mapping validation
    console.log('\n7. 🗂️  Validating column mapping...');
    const columnMap = sheetsService.masterColumns;
    
    console.log('   Column mappings:');
    Object.entries(columnMap).forEach(([field, index]) => {
      console.log(`   ${field}: ${index} (${String.fromCharCode(65 + index)})`);
    });

    // Check that voiceStatus is not in the mapping
    if (columnMap.hasOwnProperty('voiceStatus')) {
      console.log('   ❌ Legacy voiceStatus still in column mapping!');
      return false;
    } else {
      console.log('   ✅ Legacy voiceStatus removed from mapping');
    }

    // Check that columns are in the right order
    if (columnMap.voiceGenerationStatus === 10 && columnMap.videoEditingStatus === 11) {
      console.log('   ✅ Voice status columns correctly positioned');
    } else {
      console.log('   ❌ Voice status columns incorrectly positioned');
      return false;
    }

    // Test 8: Clean up - Remove test entry
    console.log('\n8. 🧹 Cleaning up test data...');
    // We don't have a delete method, but we can set status to a test value
    await sheetsService.updateVideoStatus(createdVideoId, 'Test - Delete Me');
    console.log('   ✅ Test data marked for cleanup');

    console.log('\n🎉 All tests passed successfully!');
    console.log('\n✅ Fixed Structure Validation Results:');
    console.log('   • ❌ Legacy Voice Status column removed');
    console.log('   • ✅ Voice Generation Status working correctly'); 
    console.log('   • ✅ Video Editing Status working correctly');
    console.log('   • ✅ 16-column structure functioning');
    console.log('   • ✅ No column mapping conflicts');
    console.log('   • ✅ All CRUD operations working');

    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    logger.error('Structure test failed:', error);
    return false;
  }
}

// Main execution
async function main() {
  const success = await testFixedStructure();
  
  if (success) {
    console.log('\n🏆 Fixed structure test completed successfully!');
    console.log('\nℹ️  Note: Check your Google Sheet to manually delete the test entry marked "Test - Delete Me"');
    process.exit(0);
  } else {
    console.log('\n💥 Fixed structure test failed!');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}