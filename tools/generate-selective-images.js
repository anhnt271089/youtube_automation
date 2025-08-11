import WorkflowService from '../src/services/workflowService.js';
import logger from '../src/utils/logger.js';

const workflow = new WorkflowService();

async function generateSelectiveImages() {
  try {
    const videoId = process.argv[2];
    
    if (!videoId) {
      console.log('❌ Error: Video ID is required');
      console.log('Usage: node tools/generate-selective-images.js <VIDEO_ID>');
      console.log('Example: node tools/generate-selective-images.js VID-0001');
      return;
    }
    
    console.log(`🎨 Generating selective images for ${videoId}...\n`);
    
    // Check if the video exists
    const videoDetails = await workflow.sheetsService.getVideoDetails(videoId);
    if (!videoDetails) {
      console.log(`❌ Video ${videoId} not found`);
      return;
    }
    
    console.log(`🎬 Video: ${videoDetails.title}`);
    console.log(`📋 Detail Workbook: ${videoDetails.detailWorkbookUrl}`);
    
    // Check entries needing generation
    const entriesNeedingGeneration = await workflow.sheetsService.getEntriesNeedingImageGeneration(videoId);
    
    if (entriesNeedingGeneration.length === 0) {
      console.log('\n✅ No entries need image generation');
      console.log('💡 To generate images:');
      console.log('1. Open the Script Breakdown sheet');
      console.log('2. Change status from "Pending" to "Need Generate" for desired entries');
      console.log('3. Run this command again');
      return;
    }
    
    console.log(`\n📊 Found ${entriesNeedingGeneration.length} entries needing image generation:`);
    entriesNeedingGeneration.forEach((entry, index) => {
      console.log(`   ${index + 1}. Sentence ${entry.sentenceNumber}: ${entry.scriptText.substring(0, 60)}...`);
    });
    
    const estimatedCost = entriesNeedingGeneration.length * 0.0018; // Leonardo AI cost
    console.log(`\n💰 Estimated cost: ~$${estimatedCost.toFixed(4)}`);
    
    console.log('\n🚀 Starting selective image generation...');
    
    // Process selective image generation
    const result = await workflow.processSelectiveImageGeneration(videoId);
    
    console.log('\n🎉 Selective image generation completed!');
    console.log(`📊 Results:`);
    console.log(`   - Images generated: ${result.generated}`);
    console.log(`   - Total cost: $${(result.totalCost || 0).toFixed(4)}`);
    console.log(`   - Message: ${result.message}`);
    
    if (result.images && result.images.length > 0) {
      console.log('\n🖼️ Generated images:');
      result.images.forEach(img => {
        console.log(`   Sentence ${img.sentenceNumber}: ${img.fileName}`);
        console.log(`      URL: ${img.uploadedUrl}`);
      });
    }
    
    console.log(`\n✅ Check the Script Breakdown sheet to see updated image URLs and statuses`);
    console.log(`📋 ${videoDetails.detailWorkbookUrl}`);
    
  } catch (error) {
    console.error('❌ Error generating selective images:', error.message);
    process.exit(1);
  }
}

generateSelectiveImages();