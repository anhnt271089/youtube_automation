import WorkflowService from '../src/services/workflowService.js';
import logger from '../src/utils/logger.js';

const workflow = new WorkflowService();

async function testSelectiveImageGeneration() {
  try {
    console.log('🧪 Testing Selective Image Generation...\n');
    
    // Get all videos to find one for testing
    const allVideos = await workflow.sheetsService.getAllVideos();
    console.log(`📊 Found ${allVideos.length} videos total`);
    
    // Find a video with a detail workbook
    let testVideo = null;
    for (const video of allVideos) {
      if (video.detailWorkbookUrl) {
        testVideo = video;
        break;
      }
    }
    
    if (!testVideo) {
      console.log('❌ No videos found with detail workbooks');
      return;
    }
    
    console.log(`🎬 Using test video: ${testVideo.videoId} - ${testVideo.title}\n`);
    
    // Step 1: Check current script breakdown
    console.log('📋 Step 1: Checking current script breakdown...');
    const breakdown = await workflow.sheetsService.getScriptBreakdown(testVideo.videoId);
    
    if (!breakdown || breakdown.length === 0) {
      console.log('❌ No script breakdown found for test video');
      return;
    }
    
    console.log(`✅ Found ${breakdown.length} script entries`);
    
    // Show current status distribution
    const statusCounts = {};
    breakdown.forEach(entry => {
      const status = entry.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('📊 Current status distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} entries`);
    });
    
    // Step 2: Check if any entries need generation
    console.log('\n📋 Step 2: Checking entries needing image generation...');
    const entriesNeedingGeneration = await workflow.sheetsService.getEntriesNeedingImageGeneration(testVideo.videoId);
    
    console.log(`✅ Found ${entriesNeedingGeneration.length} entries with "Need Generate" status`);
    
    if (entriesNeedingGeneration.length === 0) {
      console.log('\n💡 To test selective generation:');
      console.log('1. Open the Script Breakdown sheet for this video:');
      console.log(`   ${testVideo.detailWorkbookUrl}`);
      console.log('2. Change some entries from "Pending" to "Need Generate" in the Status column');
      console.log('3. Run this test again');
      return;
    }
    
    // Step 3: Test selective image generation
    console.log(`\n🎨 Step 3: Testing selective image generation for ${entriesNeedingGeneration.length} entries...`);
    
    console.log('\nEntries that will be processed:');
    entriesNeedingGeneration.forEach(entry => {
      console.log(`   Sentence ${entry.sentenceNumber}: ${entry.scriptText.substring(0, 50)}...`);
    });
    
    console.log(`\n⚠️  WARNING: This will actually generate images and may incur costs!`);
    console.log(`💰 Estimated cost: ~$${(entriesNeedingGeneration.length * 0.0018).toFixed(4)} (Leonardo AI)`);
    
    // For safety, don't actually run the generation in test mode
    console.log(`\n🔐 Test mode: Skipping actual image generation for safety.`);
    console.log(`\nTo run actual generation, use:`);
    console.log(`   node tools/generate-selective-images.js ${testVideo.videoId}`);
    
    console.log('\n✅ Selective image generation test completed!');
    console.log('\n📝 Summary:');
    console.log(`   - Found test video: ${testVideo.videoId}`);
    console.log(`   - Script breakdown entries: ${breakdown.length}`);
    console.log(`   - Entries needing generation: ${entriesNeedingGeneration.length}`);
    console.log(`   - Ready for selective generation: ${entriesNeedingGeneration.length > 0 ? 'Yes' : 'No'}`);
    
  } catch (error) {
    console.error('❌ Error testing selective image generation:', error.message);
  }
}

testSelectiveImageGeneration();