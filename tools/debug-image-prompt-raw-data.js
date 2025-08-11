import GoogleSheetsService from '../src/services/googleSheetsService.js';
import { config } from '../config/config.js';

const sheetsService = new GoogleSheetsService();

async function debugRawImagePromptData() {
  try {
    console.log('🔍 Debugging raw image prompt data from Google Sheets...');
    
    // Get all videos to find one with a detail workbook
    const allVideos = await sheetsService.getAllVideos();
    
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
    
    // Get raw data directly from Google Sheets API
    const workbookUrl = testVideo.detailWorkbookUrl;
    const workbookId = workbookUrl.split('/d/')[1].split('/')[0];
    
    console.log(`📊 Workbook ID: ${workbookId}`);
    
    // Get raw values from the Script Breakdown sheet
    const response = await sheetsService.sheets.spreadsheets.values.get({
      spreadsheetId: workbookId,
      range: 'Script Breakdown!A:G'
    });
    
    const values = response.data.values || [];
    
    if (values.length <= 1) {
      console.log('❌ No data found in Script Breakdown sheet');
      return;
    }
    
    console.log(`✅ Found ${values.length - 1} data rows`);
    
    // Check headers
    console.log('\n📋 Headers:');
    const headers = values[0];
    headers.forEach((header, index) => {
      console.log(`   Column ${String.fromCharCode(65 + index)}: "${header}"`);
    });
    
    // Check first few data rows for image prompts
    console.log('\n🔍 Raw image prompt data (Column C):');
    for (let i = 1; i <= Math.min(3, values.length - 1); i++) {
      const row = values[i];
      const imagePrompt = row[2]; // Column C (index 2) should be Image Prompt
      
      console.log(`\nRow ${i + 1}:`);
      console.log(`   Script Text (B): ${row[1]?.substring(0, 50)}...`);
      console.log(`   Raw Image Prompt (C): "${imagePrompt}"`);
      console.log(`   Image Prompt Type: ${typeof imagePrompt}`);
      console.log(`   Image Prompt Length: ${imagePrompt ? imagePrompt.length : 0}`);
      
      if (imagePrompt && imagePrompt.includes('undefined')) {
        console.log(`   🚨 FOUND "undefined" in prompt!`);
        const parts = imagePrompt.split('undefined');
        console.log(`   🔍 Split by "undefined": [${parts.length} parts]`);
        parts.forEach((part, index) => {
          console.log(`      Part ${index}: "${part.substring(0, 100)}..."`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging raw image prompt data:', error.message);
  }
}

debugRawImagePromptData();