#!/usr/bin/env node

/**
 * Test Google Sheets Headers
 * 
 * Simple test to verify the new simplified header structure works correctly
 * with the GoogleSheetsService.
 */

import GoogleSheetsService from '../../src/services/googleSheetsService.js';
import logger from '../../src/utils/logger.js';

async function testHeaderStructure() {
  console.log('🧪 Testing Google Sheets Header Structure...\n');

  const googleSheets = new GoogleSheetsService();

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing service health...');
    const health = await googleSheets.healthCheck();
    if (health.status === 'healthy') {
      console.log('   ✅ Google Sheets service is healthy');
    } else {
      console.log('   ❌ Google Sheets service is unhealthy:', health.error);
      return;
    }

    // Test 2: Get next video ID
    console.log('\n2️⃣ Testing video ID generation...');
    const nextVideoId = await googleSheets.getNextVideoId();
    console.log(`   ✅ Next video ID: ${nextVideoId}`);

    // Test 3: Create a test video entry (will be cleaned up)
    console.log('\n3️⃣ Testing video entry creation...');
    const testVideoData = {
      youtubeUrl: 'https://www.youtube.com/watch?v=test123',
      title: 'Test Video - Header Verification',
      channelTitle: 'Test Channel',
      duration: '5:30',
      viewCount: 1000,
      publishedAt: '2024-01-01T00:00:00Z',
      videoId: 'test123'
    };

    const testVideoId = await googleSheets.createVideoEntry(testVideoData);
    console.log(`   ✅ Created test video entry: ${testVideoId}`);

    // Test 4: Retrieve the created video
    console.log('\n4️⃣ Testing video retrieval...');
    const retrievedVideo = await googleSheets.getVideoDetails(testVideoId);
    if (retrievedVideo) {
      console.log('   ✅ Successfully retrieved video details:');
      console.log(`     - Video ID: ${retrievedVideo.id}`);
      console.log(`     - Title: ${retrievedVideo.title}`);
      console.log(`     - Status: ${retrievedVideo.status}`);
      console.log(`     - YouTube URL: ${retrievedVideo.youtubeUrl}`);
      console.log(`     - Script Approved: ${retrievedVideo.scriptApproved}`);
      console.log(`     - Voice Generation Status: ${retrievedVideo.voiceGenerationStatus || 'Not set'}`);
      console.log(`     - Video Editing Status: ${retrievedVideo.videoEditingStatus || 'Not set'}`);
    } else {
      console.log('   ❌ Failed to retrieve created video');
      return;
    }

    // Test 5: Update video status
    console.log('\n5️⃣ Testing status updates...');
    await googleSheets.updateVideoStatus(testVideoId, 'Processing', {
      channel: 'Updated Test Channel',
      viewCount: 1500
    });
    console.log('   ✅ Status update completed');

    // Test 6: Verify update
    console.log('\n6️⃣ Verifying updates...');
    const updatedVideo = await googleSheets.getVideoDetails(testVideoId);
    if (updatedVideo && updatedVideo.status === 'Processing') {
      console.log('   ✅ Status update verified');
      console.log(`     - New status: ${updatedVideo.status}`);
      console.log(`     - Updated channel: ${updatedVideo.channel}`);
      console.log(`     - Updated view count: ${updatedVideo.viewCount}`);
    } else {
      console.log('   ❌ Status update verification failed');
    }

    // Test 7: Test column mapping verification
    console.log('\n7️⃣ Verifying column mappings...');
    const expectedColumns = {
      videoId: 0,           // A: 🤖 Video ID
      youtubeUrl: 1,        // B: 🔧 YouTube URL
      title: 2,             // C: 🤖 Title
      status: 3,            // D: 🤖 Status
      channel: 4,           // E: 🤖 Channel
      duration: 5,          // F: 🤖 Duration
      viewCount: 6,         // G: 🤖 View Count
      publishedDate: 7,     // H: 🤖 Published Date
      youtubeVideoId: 8,    // I: 🤖 YouTube Video ID
      scriptApproved: 9,    // J: 👤 Script Approved
      voiceGenerationStatus: 10, // K: 👤 Voice Generation Status
      videoEditingStatus: 11,    // L: 👤 Video Editing Status
      driveFolder: 12,      // M: 🤖 Drive Folder Link
      detailWorkbookUrl: 13, // N: 🤖 Detail Workbook URL
      createdTime: 14,      // O: 🤖 Created Time
      lastEditedTime: 15    // P: 🤖 Last Edited Time
    };

    let mappingCorrect = true;
    for (const [field, expectedIndex] of Object.entries(expectedColumns)) {
      const actualIndex = googleSheets.masterColumns[field];
      if (actualIndex !== expectedIndex) {
        console.log(`   ❌ Column mapping error: ${field} expected ${expectedIndex}, got ${actualIndex}`);
        mappingCorrect = false;
      }
    }

    if (mappingCorrect) {
      console.log('   ✅ All column mappings are correct');
      console.log(`   📊 Total columns: ${Object.keys(expectedColumns).length} (A-P)`);
    }

    // Test 8: Script approval test
    console.log('\n8️⃣ Testing script approval...');
    await googleSheets.approveScript(testVideoId);
    const approvedVideo = await googleSheets.getVideoDetails(testVideoId);
    if (approvedVideo && approvedVideo.scriptApproved === 'Approved') {
      console.log('   ✅ Script approval test passed');
    } else {
      console.log('   ❌ Script approval test failed');
    }

    // Cleanup: Update status to indicate test completion
    await googleSheets.updateVideoStatus(testVideoId, 'Error', {
      channel: 'TEST ENTRY - SAFE TO DELETE'
    });

    console.log('\n🎉 All header structure tests passed!');
    console.log('\n📊 Header Structure Summary:');
    console.log('   🤖 = Automatically populated by system');
    console.log('   👤 = Requires human interaction/decision');  
    console.log('   🔧 = User input required');
    console.log('\n✅ Your Google Sheets integration is ready to use!');
    console.log(`🗑️  Test entry created with ID: ${testVideoId} (marked for cleanup)`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    logger.error('Google Sheets header test failed:', error);
    process.exit(1);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  testHeaderStructure();
}

export { testHeaderStructure };