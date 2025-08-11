import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const sheetsService = new GoogleSheetsService();

async function testScriptBreakdownRetrieval() {
  try {
    console.log('🔍 Testing script breakdown retrieval...');
    
    // Get all videos to find one with a detail workbook
    const allVideos = await sheetsService.getAllVideos();
    console.log(`📊 Found ${allVideos.length} videos total`);
    
    // Find a video with a detail workbook URL
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
    
    console.log(`🎬 Testing with video: ${testVideo.videoId} - ${testVideo.title}`);
    console.log(`📋 Detail workbook: ${testVideo.detailWorkbookUrl}`);
    
    // Get script breakdown
    const breakdown = await sheetsService.getScriptBreakdown(testVideo.videoId);
    
    if (!breakdown || breakdown.length === 0) {
      console.log('❌ No script breakdown data found');
      return;
    }
    
    console.log(`✅ Retrieved ${breakdown.length} script breakdown entries`);
    
    // Check first few entries for image prompts
    console.log('\n📝 Sample script breakdown entries:');
    for (let i = 0; i < Math.min(3, breakdown.length); i++) {
      const entry = breakdown[i];
      console.log(`\n${i + 1}. Sentence ${entry.sentenceNumber}:`);
      console.log(`   Script: ${entry.scriptText.substring(0, 100)}...`);
      console.log(`   Image Prompt: ${entry.imagePrompt || 'undefined'}`);
      console.log(`   Image URL: ${entry.imageUrl || 'undefined'}`);
      console.log(`   Status: ${entry.status || 'undefined'}`);
    }
    
    // Check if all image prompts are undefined
    const undefinedPrompts = breakdown.filter(entry => !entry.imagePrompt || entry.imagePrompt === '');
    const totalPrompts = breakdown.length;
    
    console.log(`\n📊 Image Prompt Analysis:`);
    console.log(`   Total entries: ${totalPrompts}`);
    console.log(`   Empty/undefined prompts: ${undefinedPrompts.length}`);
    console.log(`   Valid prompts: ${totalPrompts - undefinedPrompts.length}`);
    
    if (undefinedPrompts.length === totalPrompts) {
      console.log('\n❌ ALL IMAGE PROMPTS ARE UNDEFINED!');
      console.log('🔍 This confirms the issue - image prompts are not being saved or retrieved properly.');
    } else {
      console.log('\n✅ Some image prompts found - may be a partial issue.');
    }
    
  } catch (error) {
    console.error('❌ Error testing script breakdown retrieval:', error.message);
  }
}

testScriptBreakdownRetrieval();